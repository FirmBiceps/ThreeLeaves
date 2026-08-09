import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle,
  Building2,
  Clock3,
  ExternalLink,
  MapPin,
  Navigation,
  RotateCcw,
  Route,
  Truck,
} from 'lucide-react';
import { COMPANY_HQ } from '../../data/company';
import { getTodayString } from '../../utils/date';
import { getDistanceKm } from '../../utils/logistics';

const REGION_OPTIONS = [
  {
    key: 'North',
    label: 'North',
    dotClass: 'bg-sky-500',
    activeClass: 'border-sky-300 bg-sky-50 ring-2 ring-sky-100',
  },
  {
    key: 'West',
    label: 'West',
    dotClass: 'bg-violet-500',
    activeClass: 'border-violet-300 bg-violet-50 ring-2 ring-violet-100',
  },
  {
    key: 'East',
    label: 'East',
    dotClass: 'bg-amber-500',
    activeClass: 'border-amber-300 bg-amber-50 ring-2 ring-amber-100',
  },
  {
    key: 'Central',
    label: 'Central',
    dotClass: 'bg-emerald-500',
    activeClass: 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-100',
  },
];

const DEFAULT_MAP_CENTER = [1.3521, 103.8198];
const DEFAULT_MAP_ZOOM = 11;

// Singapore-only safety bounds. A bad customer coordinate (for example, a
// swapped latitude/longitude or a value from another country) should never
// cause the entire delivery map to zoom out to the Middle East or elsewhere.
const SINGAPORE_BOUNDS = {
  minLat: 1.13,
  maxLat: 1.50,
  minLng: 103.55,
  maxLng: 104.12,
};

function isValidCoordinatePair(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function isWithinSingapore(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  return (
    isValidCoordinatePair(latitude, longitude) &&
    latitude >= SINGAPORE_BOUNDS.minLat &&
    latitude <= SINGAPORE_BOUNDS.maxLat &&
    longitude >= SINGAPORE_BOUNDS.minLng &&
    longitude <= SINGAPORE_BOUNDS.maxLng
  );
}

function getCustomerCoordinates(customer) {
  if (!customer) return { lat: null, lng: null };

  return {
    lat:
      customer?.lat ??
      customer?.latitude ??
      customer?.Latitude ??
      customer?.LAT ??
      null,
    lng:
      customer?.lng ??
      customer?.lon ??
      customer?.longitude ??
      customer?.Longitude ??
      customer?.LNG ??
      null,
  };
}

function normaliseCustomer(customer) {
  if (!customer) return null;

  const { lat, lng } = getCustomerCoordinates(customer);

  // This ERP logistics map is for Singapore deliveries. Reject coordinates
  // outside Singapore so one bad record cannot distort map.fitBounds().
  if (!isWithinSingapore(lat, lng)) {
    return null;
  }

  return {
    ...customer,
    lat: Number(lat),
    lng: Number(lng),
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getCustomerName(customer) {
  return (
    customer?.name ||
    customer?.companyName ||
    customer?.company_name ||
    customer?.customerName ||
    'Unnamed customer'
  );
}

function getCustomerAddress(customer) {
  return (
    customer?.address ||
    customer?.deliveryAddress ||
    customer?.delivery_address ||
    customer?.shippingAddress ||
    customer?.shipping_address ||
    ''
  );
}

function normaliseLookupValue(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getInvoiceCustomerName(invoice) {
  return (
    invoice?.customer ||
    invoice?.customerName ||
    invoice?.customer_name ||
    invoice?.companyName ||
    invoice?.company_name ||
    ''
  );
}

function findCustomerForInvoice(invoice, customers) {
  const customerId =
    invoice?.customerId ??
    invoice?.customer_id ??
    invoice?.customerID ??
    null;

  if (customerId !== null && customerId !== undefined && customerId !== '') {
    const matchedById = customers.find(
      (customer) => String(customer?.id) === String(customerId)
    );

    if (matchedById) return matchedById;
  }

  const invoiceCustomerName = normaliseLookupValue(
    getInvoiceCustomerName(invoice)
  );

  if (!invoiceCustomerName) return null;

  return (
    customers.find(
      (customer) =>
        normaliseLookupValue(getCustomerName(customer)) === invoiceCustomerName
    ) || null
  );
}

function getInvoiceAddress(invoice) {
  return String(
    invoice?.deliveryAddress ||
      invoice?.delivery_address ||
      invoice?.shippingAddress ||
      invoice?.shipping_address ||
      invoice?.customerAddress ||
      invoice?.customer_address ||
      invoice?.address ||
      ''
  ).trim();
}

function getDeliveryAddress(invoice, customer) {
  // Customer master-data address is the primary source for logistics.
  // Invoice address fields are fallback only. Invoice number / ID is never used.
  return getCustomerAddress(customer) || getInvoiceAddress(invoice);
}

function buildNavigationUrl(address, customerWithCoordinates) {
  const cleanAddress = String(address || '').trim();

  // Append Singapore to local addresses so Google Maps cannot resolve an
  // ambiguous street/building name to another country.
  const singaporeAddress = cleanAddress
    ? /\bsingapore\b/i.test(cleanAddress)
      ? cleanAddress
      : `${cleanAddress}, Singapore`
    : '';

  const destination = singaporeAddress
    ? singaporeAddress
    : isWithinSingapore(
          customerWithCoordinates?.lat,
          customerWithCoordinates?.lng
        )
      ? `${Number(customerWithCoordinates.lat)},${Number(
          customerWithCoordinates.lng
        )}`
      : '';

  if (!destination) return '';

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination
  )}&travelmode=driving`;
}

function openNavigation(url) {
  if (!url || typeof window === 'undefined') return;

  window.open(url, '_blank', 'noopener,noreferrer');
}

function formatDuration(totalMinutes) {
  const minutes = Math.max(0, Number(totalMinutes) || 0);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;

  return `${hours} hr ${remainingMinutes} min`;
}

export function LogisticsModule({ sys }) {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const [mapError, setMapError] = useState('');

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const polylineRef = useRef(null);

  const safeInvoices = useMemo(
    () => (Array.isArray(sys?.invoices) ? sys.invoices : []),
    [sys?.invoices]
  );

  const safeCustomers = useMemo(
    () => (Array.isArray(sys?.customers) ? sys.customers : []),
    [sys?.customers]
  );

  const todayString = getTodayString();

  const todayInvoices = useMemo(
    () =>
      safeInvoices.filter(
        (invoice) => String(invoice?.date || '') === String(todayString)
      ),
    [safeInvoices, todayString]
  );

  const todayDeliveryRecords = useMemo(() => {
    return todayInvoices.map((invoice) => {
      const rawCustomer = findCustomerForInvoice(invoice, safeCustomers);
      const mapCustomer = normaliseCustomer(rawCustomer);
      const deliveryAddress = getDeliveryAddress(invoice, rawCustomer);

      const customerFallback = {
        name: getInvoiceCustomerName(invoice) || 'Unknown customer',
        region: invoice?.region || '',
      };

      return {
        ...invoice,
        cust: rawCustomer || customerFallback,
        mapCustomer,
        deliveryAddress,
        navigationUrl: buildNavigationUrl(deliveryAddress, mapCustomer),
      };
    });
  }, [safeCustomers, todayInvoices]);

  const todayStops = useMemo(
    () => todayDeliveryRecords.filter((stop) => Boolean(stop?.mapCustomer)),
    [todayDeliveryRecords]
  );

  const regionalGroups = useMemo(() => {
    const groups = {
      North: [],
      West: [],
      East: [],
      Central: [],
    };

    todayStops.forEach((stop) => {
      const region = String(stop?.cust?.region || stop?.region || '').trim();

      if (!region) return;
      if (!groups[region]) groups[region] = [];

      groups[region].push(stop);
    });

    return groups;
  }, [todayStops]);

  const routeMetrics = useMemo(() => {
    if (!selectedRegion) return null;

    const selectedStops = regionalGroups[selectedRegion];

    if (!Array.isArray(selectedStops) || selectedStops.length === 0) {
      return null;
    }

    const headquarters = normaliseCustomer(COMPANY_HQ);

    if (!headquarters) return null;

    const remainingStops = [...selectedStops];
    const sequence = [];
    let currentPosition = headquarters;
    let totalDistance = 0;

    while (remainingStops.length > 0) {
      let nearestIndex = 0;
      let minimumDistance = getDistanceKm(
        currentPosition,
        remainingStops[0].mapCustomer
      );

      for (let index = 1; index < remainingStops.length; index += 1) {
        const distance = getDistanceKm(
          currentPosition,
          remainingStops[index].mapCustomer
        );

        if (distance < minimumDistance) {
          minimumDistance = distance;
          nearestIndex = index;
        }
      }

      totalDistance += Number(minimumDistance) || 0;
      currentPosition = remainingStops[nearestIndex].mapCustomer;
      sequence.push(remainingStops.splice(nearestIndex, 1)[0]);
    }

    totalDistance += Number(getDistanceKm(currentPosition, headquarters)) || 0;

    const averageSpeedKmh = 70;
    const trafficFactor = 1.35;
    const serviceMinutesPerStop = 12;
    const travelHours = (totalDistance / averageSpeedKmh) * trafficFactor;
    const serviceHours = (sequence.length * serviceMinutesPerStop) / 60;
    const totalDurationMins = Math.round(
      (travelHours + serviceHours) * 60
    );

    return {
      sequence,
      totalDist: totalDistance,
      totalDurationMins,
    };
  }, [regionalGroups, selectedRegion]);

  const totalMappedInvoices = todayStops.length;
  const navigationReadyInvoices = todayDeliveryRecords.filter(
    (stop) => Boolean(stop?.navigationUrl)
  ).length;

  const outsideSingaporeCoordinateCount = todayDeliveryRecords.filter((stop) => {
    const rawCustomer = findCustomerForInvoice(stop, safeCustomers);
    if (!rawCustomer) return false;

    const { lat, lng } = getCustomerCoordinates(rawCustomer);
    return isValidCoordinatePair(lat, lng) && !isWithinSingapore(lat, lng);
  }).length;

  const unmappedInvoices = Math.max(
    todayInvoices.length - totalMappedInvoices,
    0
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !mapContainerRef.current) return undefined;

    let resizeTimer;
    const mapContainer = mapContainerRef.current;

    try {
      setMapError('');

      if (!mapRef.current) {
        mapRef.current = L.map(mapContainer, {
          zoomControl: true,
          attributionControl: true,
        }).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(mapRef.current);
      }

      const map = mapRef.current;

      if (markersLayerRef.current && map.hasLayer(markersLayerRef.current)) {
        map.removeLayer(markersLayerRef.current);
      }

      if (polylineRef.current && map.hasLayer(polylineRef.current)) {
        map.removeLayer(polylineRef.current);
      }

      markersLayerRef.current = null;
      polylineRef.current = null;

      // FeatureGroup is required because it supports getBounds().
      const featureGroup = L.featureGroup();
      const headquarters = normaliseCustomer(COMPANY_HQ);
      let deliveryMarkerCount = 0;

      if (headquarters) {
        L.circleMarker([headquarters.lat, headquarters.lng], {
          radius: 8,
          color: '#dc2626',
          weight: 2,
          fillColor: '#ef4444',
          fillOpacity: 1,
        })
          .bindPopup('<b>Three Leaves HQ</b>')
          .addTo(featureGroup);
      }

      if (routeMetrics?.sequence?.length && headquarters) {
        routeMetrics.sequence.forEach((stop, index) => {
          const customer = normaliseCustomer(stop?.mapCustomer);

          if (!customer) return;

          deliveryMarkerCount += 1;

          const customerName = escapeHtml(getCustomerName(stop?.cust));
          const deliveryAddress = escapeHtml(stop?.deliveryAddress || '');
          const navigationUrl = escapeHtml(stop?.navigationUrl || '');
          const invoiceNumber = escapeHtml(
            stop?.number || stop?.invoiceNumber || stop?.id || ''
          );

          L.circleMarker([customer.lat, customer.lng], {
            radius: 7,
            color: '#1d4ed8',
            weight: 2,
            fillColor: '#3b82f6',
            fillOpacity: 1,
          })
            .bindPopup(
              `<div style="min-width:220px">
                <b>${index + 1}. ${customerName}</b>
                ${
                  deliveryAddress
                    ? `<br/><span style="display:block;margin-top:4px">${deliveryAddress}</span>`
                    : ''
                }
                ${
                  invoiceNumber
                    ? `<br/><span style="color:#2563eb">Invoice #${invoiceNumber}</span>`
                    : ''
                }
                ${
                  navigationUrl
                    ? `<br/><a href="${navigationUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;font-weight:700;color:#ffffff;background:#2563eb;padding:6px 10px;border-radius:8px;text-decoration:none">Navigate to address</a>`
                    : ''
                }
              </div>`
            )
            .addTo(featureGroup);
        });

        const routeCoordinates = [
          [headquarters.lat, headquarters.lng],
          ...routeMetrics.sequence
            .map((stop) => normaliseCustomer(stop?.mapCustomer))
            .filter(Boolean)
            .map((customer) => [customer.lat, customer.lng]),
          [headquarters.lat, headquarters.lng],
        ];

        if (routeCoordinates.length >= 3) {
          polylineRef.current = L.polyline(routeCoordinates, {
            color: '#2563eb',
            weight: 4,
            opacity: 0.9,
            dashArray: '10, 10',
          }).addTo(map);
        }
      } else {
        todayStops.forEach((stop) => {
          const customer = normaliseCustomer(stop?.mapCustomer);

          if (!customer) return;

          deliveryMarkerCount += 1;

          const customerName = escapeHtml(getCustomerName(stop?.cust));
          const deliveryAddress = escapeHtml(stop?.deliveryAddress || '');
          const navigationUrl = escapeHtml(stop?.navigationUrl || '');
          const invoiceNumber = escapeHtml(
            stop?.number || stop?.invoiceNumber || stop?.id || ''
          );

          L.circleMarker([customer.lat, customer.lng], {
            radius: 6,
            color: '#2563eb',
            weight: 2,
            fillColor: '#3b82f6',
            fillOpacity: 1,
          })
            .bindPopup(
              `<div style="min-width:220px">
                <b>${customerName}</b>
                ${
                  deliveryAddress
                    ? `<br/><span style="display:block;margin-top:4px">${deliveryAddress}</span>`
                    : ''
                }
                ${
                  invoiceNumber
                    ? `<br/><span style="color:#2563eb">Invoice #${invoiceNumber}</span>`
                    : ''
                }
                ${
                  navigationUrl
                    ? `<br/><a href="${navigationUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;font-weight:700;color:#ffffff;background:#2563eb;padding:6px 10px;border-radius:8px;text-decoration:none">Navigate to address</a>`
                    : ''
                }
              </div>`
            )
            .addTo(featureGroup);
        });
      }

      featureGroup.addTo(map);
      markersLayerRef.current = featureGroup;

      if (polylineRef.current) {
        const routeBounds = polylineRef.current.getBounds();

        if (routeBounds.isValid()) {
          map.fitBounds(routeBounds, {
            padding: [50, 50],
            maxZoom: 14,
          });
        }
      } else if (deliveryMarkerCount > 0) {
        const markerBounds = featureGroup.getBounds();

        if (markerBounds.isValid()) {
          map.fitBounds(markerBounds, {
            padding: [50, 50],
            maxZoom: 14,
          });
        }
      } else if (headquarters) {
        map.setView([headquarters.lat, headquarters.lng], DEFAULT_MAP_ZOOM);
      } else {
        map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
      }

      resizeTimer = window.setTimeout(() => {
        map.invalidateSize();
      }, 100);
    } catch (error) {
      console.error('Failed to initialise logistics map:', error);
      setMapError(
        error instanceof Error
          ? error.message
          : 'The map could not be loaded.'
      );
    }

    return () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);

      const map = mapRef.current;

      if (map && markersLayerRef.current && map.hasLayer(markersLayerRef.current)) {
        map.removeLayer(markersLayerRef.current);
      }

      if (map && polylineRef.current && map.hasLayer(polylineRef.current)) {
        map.removeLayer(polylineRef.current);
      }

      markersLayerRef.current = null;
      polylineRef.current = null;
    };
  }, [isClient, routeMetrics, todayStops]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      markersLayerRef.current = null;
      polylineRef.current = null;
    };
  }, []);

  if (!isClient) {
    return (
      <div className="flex h-full min-h-[500px] items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
          <Navigation className="animate-pulse text-blue-600" size={20} />
          Loading logistics map...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                <Truck size={23} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Logistics Planner
                </h1>
                <p className="text-sm text-slate-500">
                  Today&apos;s deliveries and suggested regional routes
                </p>
              </div>
            </div>
          </div>

          {selectedRegion && (
            <button
              type="button"
              onClick={() => setSelectedRegion(null)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
            >
              <RotateCcw size={16} />
              Show all deliveries
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Today&apos;s invoices
              </span>
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <Truck size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900">
              {todayInvoices.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Invoices dated {todayString}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Mapped stops
              </span>
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                <MapPin size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900">
              {totalMappedInvoices}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {navigationReadyInvoices} address-based navigation link{navigationReadyInvoices === 1 ? '' : 's'} ready
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Route distance
              </span>
              <div className="rounded-xl bg-violet-50 p-2 text-violet-600">
                <Route size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900">
              {routeMetrics ? routeMetrics.totalDist.toFixed(1) : '—'}
              {routeMetrics && (
                <span className="ml-1 text-base font-bold text-slate-400">
                  km
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedRegion
                ? `${selectedRegion} round trip from HQ`
                : 'Select a region to calculate'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Estimated time
              </span>
              <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
                <Clock3 size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900">
              {routeMetrics
                ? formatDuration(routeMetrics.totalDurationMins)
                : '—'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Includes traffic and 12 min per stop
            </p>
          </div>
        </div>

        {unmappedInvoices > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="text-sm font-bold">
                {unmappedInvoices} invoice{unmappedInvoices === 1 ? '' : 's'} cannot be shown on the map
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                Add valid Singapore latitude and longitude values to place these customers on the Leaflet map.
                Where an address is available, the Navigate button still opens that customer address.
                {outsideSingaporeCoordinateCount > 0
                  ? ` ${outsideSingaporeCoordinateCount} coordinate${outsideSingaporeCoordinateCount === 1 ? ' is' : 's are'} outside Singapore and ${outsideSingaporeCoordinateCount === 1 ? 'has' : 'have'} been ignored.`
                  : ''}
              </p>
            </div>
          </div>
        )}

        <div className="grid min-h-[680px] flex-1 grid-cols-1 gap-6 lg:grid-cols-4">
          <aside className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm lg:col-span-1">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-base font-black text-slate-900">
                Delivery regions
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Select a region to create a nearest-stop delivery sequence.
              </p>
            </div>

            <div className="space-y-3 p-4">
              {REGION_OPTIONS.map((region) => {
                const count = regionalGroups[region.key]?.length || 0;
                const isSelected = selectedRegion === region.key;

                return (
                  <button
                    key={region.key}
                    type="button"
                    onClick={() =>
                      setSelectedRegion((current) =>
                        current === region.key ? null : region.key
                      )
                    }
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? region.activeClass
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-3 w-3 rounded-full ${region.dotClass}`}
                        />
                        <div>
                          <p className="text-sm font-black text-slate-900">
                            {region.label}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {count} delivery{count === 1 ? '' : 'ies'}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                        {count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 border-t border-slate-100">
              <div className="flex items-center justify-between px-5 pb-3 pt-5">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {selectedRegion ? `${selectedRegion} route` : 'Today’s stops'}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedRegion && routeMetrics
                      ? `${routeMetrics.sequence.length} ordered stops`
                      : `${todayDeliveryRecords.length} delivery records`}
                  </p>
                </div>
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto px-4 pb-5">
                {(selectedRegion && routeMetrics
                  ? routeMetrics.sequence
                  : todayDeliveryRecords
                ).map((stop, index) => {
                  const customerName = getCustomerName(stop?.cust);
                  const address = String(stop?.deliveryAddress || '').trim();
                  const navigationUrl = stop?.navigationUrl || '';
                  const invoiceNumber =
                    stop?.number || stop?.invoiceNumber || stop?.id || '';
                  const hasMapCoordinates = Boolean(stop?.mapCustomer);

                  return (
                    <div
                      key={`${stop?.id || invoiceNumber}-${index}`}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-900">
                                {customerName}
                              </p>
                              {invoiceNumber && (
                                <p className="mt-0.5 text-[11px] font-bold text-blue-600">
                                  Invoice #{String(invoiceNumber)}
                                </p>
                              )}
                            </div>

                            {!hasMapCoordinates && (
                              <span className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-amber-700">
                                No map pin
                              </span>
                            )}
                          </div>

                          {address ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">
                              {address}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs font-semibold text-red-500">
                              Delivery address missing
                            </p>
                          )}

                          {navigationUrl && (
                            <button
                              type="button"
                              onClick={() => openNavigation(navigationUrl)}
                              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-black text-white shadow-sm transition hover:bg-blue-700"
                            >
                              <Navigation size={13} />
                              Navigate to address
                              <ExternalLink size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(selectedRegion && !routeMetrics) ||
                (!selectedRegion && todayDeliveryRecords.length === 0) ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
                    <MapPin className="mx-auto text-slate-300" size={24} />
                    <p className="mt-3 text-sm font-bold text-slate-500">
                      No mapped deliveries
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      There are no valid customer coordinates for this selection.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          <section className="relative min-h-[680px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
            <div ref={mapContainerRef} className="absolute inset-0 z-0" />

            <div className="pointer-events-none absolute left-4 top-4 z-[1000] max-w-[calc(100%-2rem)] rounded-2xl border border-white/70 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                  <Navigation size={18} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {selectedRegion
                      ? `${selectedRegion} delivery route`
                      : 'All mapped deliveries'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedRegion && routeMetrics
                      ? `${routeMetrics.sequence.length} stops · ${routeMetrics.totalDist.toFixed(1)} km`
                      : `${todayStops.length} customer locations`}
                  </p>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute right-4 top-4 z-[1000] rounded-2xl border border-white/70 bg-white/95 px-4 py-3 text-xs shadow-lg backdrop-blur">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-700">
                  <span className="h-3 w-3 rounded-full bg-red-500" />
                  <Building2 size={14} className="text-slate-400" />
                  Three Leaves HQ
                </div>
                <div className="flex items-center gap-2 font-bold text-slate-700">
                  <span className="h-3 w-3 rounded-full bg-blue-500" />
                  <MapPin size={14} className="text-slate-400" />
                  Delivery stop
                </div>
              </div>
            </div>

            {mapError && (
              <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-sm">
                <div className="max-w-md rounded-3xl border border-red-200 bg-white p-6 text-center shadow-2xl">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                    <AlertCircle size={24} />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-slate-900">
                    The map could not be loaded
                  </h3>
                  <p className="mt-2 break-words text-sm leading-6 text-slate-500">
                    {mapError}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
