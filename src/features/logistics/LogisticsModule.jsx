import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle,
  Building2,
  Clock3,
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

function normaliseCustomer(customer) {
  if (!customer || !isValidCoordinatePair(customer.lat, customer.lng)) {
    return null;
  }

  return {
    ...customer,
    lat: Number(customer.lat),
    lng: Number(customer.lng),
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
    ''
  );
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

  const todayStops = useMemo(() => {
    return todayInvoices
      .map((invoice) => {
        const customerId = invoice?.customerId ?? invoice?.customer_id;
        const rawCustomer = safeCustomers.find(
          (customer) => String(customer?.id) === String(customerId)
        );
        const customer = normaliseCustomer(rawCustomer);

        if (!customer) return null;

        return {
          ...invoice,
          cust: customer,
        };
      })
      .filter(Boolean);
  }, [safeCustomers, todayInvoices]);

  const regionalGroups = useMemo(() => {
    const groups = {
      North: [],
      West: [],
      East: [],
      Central: [],
    };

    todayStops.forEach((stop) => {
      const region = String(stop?.cust?.region || '').trim();

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
        remainingStops[0].cust
      );

      for (let index = 1; index < remainingStops.length; index += 1) {
        const distance = getDistanceKm(
          currentPosition,
          remainingStops[index].cust
        );

        if (distance < minimumDistance) {
          minimumDistance = distance;
          nearestIndex = index;
        }
      }

      totalDistance += Number(minimumDistance) || 0;
      currentPosition = remainingStops[nearestIndex].cust;
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
          const customer = normaliseCustomer(stop?.cust);

          if (!customer) return;

          deliveryMarkerCount += 1;

          const customerName = escapeHtml(getCustomerName(customer));
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
              `<b>${index + 1}. ${customerName}</b>${
                invoiceNumber
                  ? `<br/><span>Invoice #${invoiceNumber}</span>`
                  : ''
              }`
            )
            .addTo(featureGroup);
        });

        const routeCoordinates = [
          [headquarters.lat, headquarters.lng],
          ...routeMetrics.sequence
            .map((stop) => normaliseCustomer(stop?.cust))
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
          const customer = normaliseCustomer(stop?.cust);

          if (!customer) return;

          deliveryMarkerCount += 1;

          const customerName = escapeHtml(getCustomerName(customer));
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
              `<b>${customerName}</b>${
                invoiceNumber
                  ? `<br/><span>Invoice #${invoiceNumber}</span>`
                  : ''
              }`
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
              Customers with valid coordinates
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
                Add valid latitude and longitude values to the related customer records.
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
                      : `${todayStops.length} mapped customers`}
                  </p>
                </div>
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto px-4 pb-5">
                {(selectedRegion && routeMetrics
                  ? routeMetrics.sequence
                  : todayStops
                ).map((stop, index) => {
                  const customerName = getCustomerName(stop?.cust);
                  const address = getCustomerAddress(stop?.cust);
                  const invoiceNumber =
                    stop?.number || stop?.invoiceNumber || stop?.id || '';

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
                          <p className="truncate text-sm font-black text-slate-900">
                            {customerName}
                          </p>
                          {invoiceNumber && (
                            <p className="mt-0.5 text-[11px] font-bold text-blue-600">
                              Invoice #{String(invoiceNumber)}
                            </p>
                          )}
                          {address && (
                            <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">
                              {address}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(selectedRegion && !routeMetrics) ||
                (!selectedRegion && todayStops.length === 0) ? (
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
