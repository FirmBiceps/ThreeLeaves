import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { AlertCircle } from 'lucide-react';
import { COMPANY_HQ } from '../../data/company';
import { getTodayString } from '../../utils/date';
import { getDistanceKm } from '../../utils/logistics';

export function LogisticsModule({ sys }) {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const polylineRef = useRef(null);
  const todayInvoices = sys.invoices.filter((invoice) => invoice.date === getTodayString());

  const regionalGroups = useMemo(() => {
    const groups = { North: [], West: [], East: [], Central: [] };
    todayInvoices.forEach((invoice) => {
      const customer = sys.customers.find((entry) => entry.id === invoice.customerId);
      if (customer?.region) {
        groups[customer.region].push({ ...invoice, cust: customer });
      }
    });
    return groups;
  }, [sys.customers, todayInvoices]);

  const routeMetrics = useMemo(() => {
    if (!selectedRegion || regionalGroups[selectedRegion].length === 0) {
      return null;
    }

    const stops = [...regionalGroups[selectedRegion]];
    const sequence = [];
    let currentPosition = COMPANY_HQ;
    let totalDistance = 0;

    while (stops.length > 0) {
      let nearestIndex = 0;
      let minDistance = getDistanceKm(currentPosition, stops[0].cust);

      for (let index = 1; index < stops.length; index += 1) {
        const distance = getDistanceKm(currentPosition, stops[index].cust);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      }

      totalDistance += minDistance;
      currentPosition = stops[nearestIndex].cust;
      sequence.push(stops.splice(nearestIndex, 1)[0]);
    }

    totalDistance += getDistanceKm(currentPosition, COMPANY_HQ);
    const speedKmh = 70;
    const trafficFactor = 1.35;
    const travelHours = (totalDistance / speedKmh) * trafficFactor;
    const serviceHours = (sequence.length * 12) / 60;
    const totalDurationMins = Math.round((travelHours + serviceHours) * 60);

    return { sequence, totalDist: totalDistance, totalDurationMins };
  }, [regionalGroups, selectedRegion]);

  useEffect(() => {
    const mapContainer = mapContainerRef.current;
    if (!mapContainer) {
      return undefined;
    }

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainer).setView([1.3521, 103.8198], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current);
    }

    if (markersLayerRef.current) {
      mapRef.current.removeLayer(markersLayerRef.current);
    }
    if (polylineRef.current) {
      mapRef.current.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    const layerGroup = L.layerGroup();
    L.circleMarker([COMPANY_HQ.lat, COMPANY_HQ.lng], {
      radius: 8,
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 1,
    })
      .bindPopup('<b>Three Leaves HQ</b>')
      .addTo(layerGroup);

    if (routeMetrics) {
      routeMetrics.sequence.forEach((stop) => {
        L.circleMarker([stop.cust.lat, stop.cust.lng], {
          radius: 6,
          color: '#2563eb',
          fillColor: '#2563eb',
          fillOpacity: 1,
        })
          .bindPopup(`<b>${stop.cust.name}</b>`)
          .addTo(layerGroup);
      });

      const pathCoordinates = [
        [COMPANY_HQ.lat, COMPANY_HQ.lng],
        ...routeMetrics.sequence.map((stop) => [stop.cust.lat, stop.cust.lng]),
        [COMPANY_HQ.lat, COMPANY_HQ.lng],
      ];
      polylineRef.current = L.polyline(pathCoordinates, {
        color: '#2563eb',
        weight: 4,
        dashArray: '10, 10',
      }).addTo(mapRef.current);
      mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
    } else {
      todayInvoices.forEach((invoice) => {
        const customer = sys.customers.find((entry) => entry.id === invoice.customerId);
        if (customer?.lat) {
          L.circleMarker([customer.lat, customer.lng], {
            radius: 6,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 1,
          })
            .bindPopup(`<b>${customer.name}</b>`)
            .addTo(layerGroup);
        }
      });
      if (todayInvoices.length > 0) {
        const bounds = layerGroup.getBounds();
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    }

    layerGroup.addTo(mapRef.current);
    markersLayerRef.current = layerGroup;
    const resizeTimer = setTimeout(() => mapRef.current?.invalidateSize(), 50);

    return () => clearTimeout(resizeTimer);
  }, [routeMetrics, sys.customers, todayInvoices]);

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

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="h-full overflow-y-auto pr-2 lg:col-span-1">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Routes</h3>
              {selectedRegion && (
                <button
                  className="text-[10px] font-bold text-blue-600"
                  onClick={() => setSelectedRegion(null)}
                  type="button"
                >
                  Show All
                </button>
              )}
            </div>
            <div className="space-y-3">
              {Object.entries(regionalGroups).map(([region, orders]) => (
                <button
                  className={`w-full rounded-xl border p-4 text-left transition-all ${
                    selectedRegion === region
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                      : orders.length === 0
                        ? 'cursor-not-allowed opacity-40 grayscale'
                        : 'border-gray-100 bg-gray-50 hover:border-blue-200'
                  }`}
                  disabled={orders.length === 0}
                  key={region}
                  onClick={() => setSelectedRegion(region)}
                  type="button"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-800">{region} Sector</span>
                    <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-black">
                      {orders.length} Drops
                    </span>
                  </div>
                  {orders.length === 1 && (
                    <p className="mt-2 flex items-center text-[10px] font-bold text-amber-600">
                      <AlertCircle className="mr-1" size={12} /> Inefficient Route
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {routeMetrics && (
            <div className="mt-4 rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
              <h4 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Dispatch Analysis (70km/h max)
              </h4>
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-3 font-bold">
                  <div className="text-[9px] uppercase text-slate-400">Distance</div>
                  {routeMetrics.totalDist.toFixed(1)} KM
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-3 font-bold">
                  <div className="text-[9px] uppercase text-slate-400">Est. Time</div>
                  {Math.floor(routeMetrics.totalDurationMins / 60)}h {routeMetrics.totalDurationMins % 60}m
                </div>
              </div>
              <div className="space-y-3 text-xs">
                <div className="font-bold uppercase tracking-widest text-emerald-400">Woodlands HQ</div>
                {routeMetrics.sequence.map((stop) => (
                  <div className="truncate text-slate-300" key={stop.id || stop.number}>
                    • {stop.cust.name}
                  </div>
                ))}
                <div className="font-bold uppercase tracking-widest text-blue-400">Woodlands HQ</div>
              </div>
            </div>
          )}
        </div>

        <div className="relative min-h-[600px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm lg:col-span-3">
          <div className="absolute inset-0 z-0" ref={mapContainerRef} />
          <div className="absolute right-4 top-4 z-[1000]">
            <div className="space-y-2 rounded-2xl border border-gray-100 bg-white/90 p-4 text-[10px] font-black uppercase tracking-widest shadow-xl backdrop-blur-md">
              <div className="flex items-center">
                <div className="mr-3 h-3 w-3 rounded-full bg-red-500" /> HQ
              </div>
              <div className="flex items-center">
                <div className="mr-3 h-3 w-3 rounded-full bg-blue-500" /> Sales
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

