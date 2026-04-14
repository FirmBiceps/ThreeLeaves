import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // <-- Add CSS import
import { AlertCircle } from 'lucide-react';
import { COMPANY_HQ } from '../../data/company';
import { getTodayString } from '../../utils/date';
import { getDistanceKm } from '../../utils/logistics';

export function LogisticsModule({ sys }) {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const polylineRef = useRef(null);

  // 1. SAFEGUARD: Ensure data exists before filtering
  const todayInvoices = (sys?.invoices || []).filter(
    (invoice) => invoice.date === getTodayString()
  );

  const regionalGroups = useMemo(() => {
    const groups = { North: [], West: [], East: [], Central: [] };
    todayInvoices.forEach((invoice) => {
      const customer = (sys?.customers || []).find((entry) => entry.id === invoice.customerId);
      if (customer && customer.region && customer.lat && customer.lng) {
        if (!groups[customer.region]) groups[customer.region] = [];
        groups[customer.region].push({ ...invoice, cust: customer });
      }
    });
    return groups;
  }, [sys?.customers, todayInvoices]);

  const routeMetrics = useMemo(() => {
    if (!selectedRegion || !regionalGroups[selectedRegion] || regionalGroups[selectedRegion].length === 0) {
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

  // Set client‑side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize map only on client
  useEffect(() => {
    if (!isClient || !mapContainerRef.current) return;

    // Create map once
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([1.3521, 103.8198], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Clean previous layers
    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current);
    }
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    const layerGroup = L.layerGroup();

    // HQ marker
    if (COMPANY_HQ?.lat && COMPANY_HQ?.lng) {
      L.circleMarker([COMPANY_HQ.lat, COMPANY_HQ.lng], {
        radius: 8,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 1,
      })
        .bindPopup('<b>Three Leaves HQ</b>')
        .addTo(layerGroup);
    }

    if (routeMetrics && routeMetrics.sequence.length > 0) {
      // Draw selected route
      routeMetrics.sequence.forEach((stop) => {
        if (stop.cust.lat && stop.cust.lng) {
          L.circleMarker([stop.cust.lat, stop.cust.lng], {
            radius: 6,
            color: '#2563eb',
            fillColor: '#2563eb',
            fillOpacity: 1,
          })
            .bindPopup(`<b>${stop.cust.name}</b>`)
            .addTo(layerGroup);
        }
      });

      const pathCoordinates = [
        [COMPANY_HQ.lat, COMPANY_HQ.lng],
        ...routeMetrics.sequence
          .filter((stop) => stop.cust.lat && stop.cust.lng)
          .map((stop) => [stop.cust.lat, stop.cust.lng]),
        [COMPANY_HQ.lat, COMPANY_HQ.lng],
      ];

      polylineRef.current = L.polyline(pathCoordinates, {
        color: '#2563eb',
        weight: 4,
        dashArray: '10, 10',
      }).addTo(map);

      map.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
    } else {
      // Draw all available points for today
      todayInvoices.forEach((invoice) => {
        const customer = (sys?.customers || []).find((entry) => entry.id === invoice.customerId);
        if (customer?.lat && customer?.lng) {
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

      const bounds = layerGroup.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }

    layerGroup.addTo(map);
    markersLayerRef.current = layerGroup;

    // Handle resize
    const resizeTimer = setTimeout(() => map.invalidateSize(), 50);

    // Cleanup when dependencies change (but keep the map instance)
    return () => {
      clearTimeout(resizeTimer);
      if (markersLayerRef.current) {
        map.removeLayer(markersLayerRef.current);
        markersLayerRef.current = null;
      }
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
    };
  }, [isClient, routeMetrics, sys?.customers, todayInvoices]);

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Render nothing on server to avoid Leaflet errors
  if (!isClient) {
    return <div className="flex h-full items-center justify-center">Loading map...</div>;
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      {/* ... rest of JSX unchanged ... */}
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left panel */}
        <div className="h-full overflow-y-auto pr-2 lg:col-span-1">
          {/* ... region buttons ... */}
        </div>

        {/* Map container */}
        <div className="relative min-h-[600px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm lg:col-span-3">
          <div className="absolute inset-0 z-0" ref={mapContainerRef} />
          <div className="absolute right-4 top-4 z-[1000]">
            {/* ... legend ... */}
          </div>
        </div>
      </div>
    </div>
  );
}
