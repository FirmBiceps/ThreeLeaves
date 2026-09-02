import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
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

const SINGAPORE_BOUNDS = {
  minLat: 1.13,
  maxLat: 1.5,
  minLng: 103.55,
  maxLng: 104.12,
};

// Public Nominatim policy requires:
// - maximum 1 request / second
// - single-threaded requests
// - caching
// - visible OpenStreetMap attribution
//
// 1.1 seconds gives a small safety margin above the stated maximum.
const NOMINATIM_REQUEST_DELAY_MS = 1100;
const NOMINATIM_ENDPOINT =
  'https://nominatim.openstreetmap.org/search';

// Results are cached in the browser so the same customer/postal code is not
// repeatedly geocoded every time Logistics opens.
const GEOCODE_CACHE_STORAGE_KEY =
  'three-leaves-logistics-nominatim-cache-v1';

// Successful locations may be reused for a long time. A changed customer
// address/postal code generates a different lookup key automatically.
const SUCCESS_CACHE_MAX_AGE_MS =
  180 * 24 * 60 * 60 * 1000;

// Failed searches are temporarily cached too, so a page refresh does not
// immediately repeat the same failed public-API request.
const FAILURE_CACHE_MAX_AGE_MS =
  24 * 60 * 60 * 1000;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

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

function normaliseCoordinateLocation(location) {
  if (!location) return null;

  const { lat, lng } = getCustomerCoordinates(location);

  if (!isWithinSingapore(lat, lng)) {
    return null;
  }

  return {
    ...location,
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
    customer?.customer_name ||
    'Unnamed customer'
  );
}

function getCustomerAddress(customer) {
  return String(
    customer?.address ||
      customer?.deliveryAddress ||
      customer?.delivery_address ||
      customer?.shippingAddress ||
      customer?.shipping_address ||
      ''
  ).trim();
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

  if (
    customerId !== null &&
    customerId !== undefined &&
    customerId !== ''
  ) {
    const matchedById = customers.find(
      (customer) =>
        String(customer?.id) === String(customerId)
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
        normaliseLookupValue(getCustomerName(customer)) ===
        invoiceCustomerName
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
  return (
    getCustomerAddress(customer) ||
    getInvoiceAddress(invoice)
  );
}

function extractSingaporePostalCode(address) {
  const text = String(address || '');

  // Singapore postal codes are six digits. If an address contains more than
  // one six-digit number, the last one is usually the postal code.
  const matches = [
    ...text.matchAll(/(?:^|\D)(\d{6})(?!\d)/g),
  ];

  if (matches.length === 0) return '';

  return String(
    matches[matches.length - 1]?.[1] || ''
  ).trim();
}

function normaliseAddressForSearch(address) {
  const clean = String(address || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return '';

  return /\bsingapore\b/i.test(clean)
    ? clean
    : `${clean}, Singapore`;
}

function buildGeocodeLookupKey(postalCode, address) {
  if (postalCode) {
    return `postal:${postalCode}`;
  }

  const normalisedAddress =
    normaliseLookupValue(address);

  return normalisedAddress
    ? `address:${normalisedAddress}`
    : '';
}

function readGeocodeCache() {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(
      GEOCODE_CACHE_STORAGE_KEY
    );

    if (!raw) return {};

    const parsed = JSON.parse(raw);

    return parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.warn(
      'Unable to read Logistics geocode cache:',
      error
    );
    return {};
  }
}

function writeGeocodeCache(cache) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      GEOCODE_CACHE_STORAGE_KEY,
      JSON.stringify(cache)
    );
  } catch (error) {
    console.warn(
      'Unable to save Logistics geocode cache:',
      error
    );
  }
}

function getFreshCachedEntry(cache, key) {
  if (!key) return null;

  const entry = cache?.[key];

  if (!entry) return null;

  const savedAt = Number(entry.savedAt) || 0;
  const age = Date.now() - savedAt;

  if (entry.success === true) {
    if (age > SUCCESS_CACHE_MAX_AGE_MS) {
      return null;
    }

    if (!isWithinSingapore(entry.lat, entry.lng)) {
      return null;
    }

    return entry;
  }

  if (entry.success === false) {
    if (age > FAILURE_CACHE_MAX_AGE_MS) {
      return null;
    }

    return entry;
  }

  return null;
}

function buildNavigationUrl(address, mapLocation) {
  const cleanAddress = String(address || '').trim();

  const singaporeAddress = cleanAddress
    ? /\bsingapore\b/i.test(cleanAddress)
      ? cleanAddress
      : `${cleanAddress}, Singapore`
    : '';

  const destination = singaporeAddress
    ? singaporeAddress
    : isWithinSingapore(
          mapLocation?.lat,
          mapLocation?.lng
        )
      ? `${Number(mapLocation.lat)},${Number(
          mapLocation.lng
        )}`
      : '';

  if (!destination) return '';

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    destination
  )}&travelmode=driving`;
}

function openNavigation(url) {
  if (!url || typeof window === 'undefined') return;

  window.open(
    url,
    '_blank',
    'noopener,noreferrer'
  );
}

function formatDuration(totalMinutes) {
  const minutes = Math.max(
    0,
    Number(totalMinutes) || 0
  );
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

function getLocationSourceLabel(source, postalCode) {
  if (source === 'saved_coordinates') {
    return 'Saved coordinates';
  }

  if (
    source === 'nominatim_postal' ||
    source === 'cache_postal'
  ) {
    return postalCode
      ? `Postal ${postalCode}`
      : 'Postal code';
  }

  if (
    source === 'nominatim_address' ||
    source === 'cache_address'
  ) {
    return 'Address match';
  }

  return 'Mapped';
}

function buildNominatimBaseParams() {
  const params = new URLSearchParams();

  params.set('format', 'jsonv2');
  params.set('addressdetails', '1');
  params.set('limit', '5');
  params.set('countrycodes', 'sg');

  // Hard-limit results to a Singapore-sized bounding box as an additional
  // safety measure.
  params.set(
    'viewbox',
    `${SINGAPORE_BOUNDS.minLng},${SINGAPORE_BOUNDS.maxLat},${SINGAPORE_BOUNDS.maxLng},${SINGAPORE_BOUNDS.minLat}`
  );
  params.set('bounded', '1');

  return params;
}

function pickBestNominatimResult(results, postalCode = '') {
  const safeResults = Array.isArray(results)
    ? results.filter((result) =>
        isWithinSingapore(
          result?.lat,
          result?.lon
        )
      )
    : [];

  if (safeResults.length === 0) {
    return null;
  }

  if (postalCode) {
    const exactPostal = safeResults.find(
      (result) =>
        String(
          result?.address?.postcode || ''
        )
          .replace(/\s+/g, '')
          .trim() === postalCode
    );

    if (exactPostal) return exactPostal;
  }

  return safeResults[0];
}

async function fetchNominatim(params) {
  const response = await fetch(
    `${NOMINATIM_ENDPOINT}?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
      cache: 'no-store',
    }
  );

  if (response.status === 429) {
    throw new Error(
      'OpenStreetMap geocoding is temporarily rate-limited. Please wait before retrying.'
    );
  }

  if (!response.ok) {
    throw new Error(
      `OpenStreetMap geocoding returned HTTP ${response.status}.`
    );
  }

  const payload = await response.json();

  return Array.isArray(payload) ? payload : [];
}

async function geocodeWithNominatim({
  postalCode,
  address,
}) {
  if (postalCode) {
    const postalParams =
      buildNominatimBaseParams();

    postalParams.set(
      'postalcode',
      postalCode
    );
    postalParams.set('country', 'Singapore');

    const postalResults =
      await fetchNominatim(postalParams);

    const postalMatch =
      pickBestNominatimResult(
        postalResults,
        postalCode
      );

    if (postalMatch) {
      return {
        success: true,
        lat: Number(postalMatch.lat),
        lng: Number(postalMatch.lon),
        formattedAddress: String(
          postalMatch.display_name || ''
        ),
        postalCode:
          String(
            postalMatch?.address?.postcode ||
              postalCode
          )
            .replace(/\s+/g, '')
            .trim() || postalCode,
        source: 'nominatim_postal',
      };
    }

    // We have just made one public request. Wait before the fallback request.
    await wait(NOMINATIM_REQUEST_DELAY_MS);
  }

  const fullAddress =
    normaliseAddressForSearch(address);

  if (fullAddress) {
    const addressParams =
      buildNominatimBaseParams();

    addressParams.set('q', fullAddress);

    const addressResults =
      await fetchNominatim(addressParams);

    const addressMatch =
      pickBestNominatimResult(
        addressResults,
        postalCode
      );

    if (addressMatch) {
      return {
        success: true,
        lat: Number(addressMatch.lat),
        lng: Number(addressMatch.lon),
        formattedAddress: String(
          addressMatch.display_name || ''
        ),
        postalCode:
          String(
            addressMatch?.address?.postcode ||
              postalCode ||
              ''
          )
            .replace(/\s+/g, '')
            .trim(),
        source: 'nominatim_address',
      };
    }
  }

  return {
    success: false,
    error:
      'OpenStreetMap could not resolve this Singapore postal code or address.',
  };
}

export function LogisticsModule({ sys }) {
  const [selectedRegion, setSelectedRegion] =
    useState(null);
  const [isClient, setIsClient] =
    useState(false);
  const [mapError, setMapError] =
    useState('');

  const [
    geocodeLocations,
    setGeocodeLocations,
  ] = useState({});
  const [
    geocodeFailures,
    setGeocodeFailures,
  ] = useState({});
  const [
    geocodeStatus,
    setGeocodeStatus,
  ] = useState({
    isLoading: false,
    cacheHits: 0,
    freshMatches: 0,
    failedCount: 0,
    error: '',
  });
  const [
    retryUnmappedNonce,
    setRetryUnmappedNonce,
  ] = useState(0);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const polylineRef = useRef(null);
  const geocodeRunRef = useRef(0);

  const safeInvoices = useMemo(
    () =>
      Array.isArray(sys?.invoices)
        ? sys.invoices
        : [],
    [sys?.invoices]
  );

  const safeCustomers = useMemo(
    () =>
      Array.isArray(sys?.customers)
        ? sys.customers
        : [],
    [sys?.customers]
  );

  const todayString = getTodayString();

  const todayInvoices = useMemo(
    () =>
      safeInvoices.filter(
        (invoice) =>
          String(invoice?.date || '') ===
          String(todayString)
      ),
    [safeInvoices, todayString]
  );

  const baseDeliveryRecords = useMemo(() => {
    return todayInvoices.map((invoice) => {
      const rawCustomer =
        findCustomerForInvoice(
          invoice,
          safeCustomers
        );

      const deliveryAddress =
        getDeliveryAddress(
          invoice,
          rawCustomer
        );

      const postalCode =
        extractSingaporePostalCode(
          deliveryAddress
        );

      // If a customer happens to have valid coordinates already, keep using
      // them. Invalid / foreign / placeholder values are ignored and the
      // address is geocoded instead.
      const directLocation =
        normaliseCoordinateLocation(
          rawCustomer
        );

      const customerFallback = {
        name:
          getInvoiceCustomerName(invoice) ||
          'Unknown customer',
        region: invoice?.region || '',
      };

      const customerForDisplay =
        rawCustomer || customerFallback;

      const geocodeKey =
        buildGeocodeLookupKey(
          postalCode,
          deliveryAddress
        );

      return {
        ...invoice,
        cust: customerForDisplay,
        rawCustomer,
        deliveryAddress,
        postalCode,
        directLocation,
        geocodeKey,
      };
    });
  }, [safeCustomers, todayInvoices]);

  const geocodeSignature = useMemo(
    () =>
      baseDeliveryRecords
        .filter(
          (record) =>
            !record.directLocation &&
            Boolean(record.geocodeKey)
        )
        .map(
          (record) =>
            `${record.geocodeKey}|${record.postalCode}|${record.deliveryAddress}`
        )
        .sort()
        .join('||'),
    [baseDeliveryRecords]
  );

  useEffect(() => {
    if (!isClient) return undefined;

    let cancelled = false;

    const runId =
      geocodeRunRef.current + 1;
    geocodeRunRef.current = runId;

    const uniqueRecords = Array.from(
      new Map(
        baseDeliveryRecords
          .filter(
            (record) =>
              !record.directLocation &&
              Boolean(record.geocodeKey)
          )
          .map((record) => [
            record.geocodeKey,
            record,
          ])
      ).values()
    );

    const recordsWithoutAnyAddress =
      baseDeliveryRecords.filter(
        (record) =>
          !record.directLocation &&
          !record.geocodeKey
      );

    if (
      uniqueRecords.length === 0 &&
      recordsWithoutAnyAddress.length === 0
    ) {
      setGeocodeLocations({});
      setGeocodeFailures({});
      setGeocodeStatus({
        isLoading: false,
        cacheHits: 0,
        freshMatches: 0,
        failedCount: 0,
        error: '',
      });
      return undefined;
    }

    const resolveLocations = async () => {
      const cache = readGeocodeCache();
      const nextLocations = {};
      const nextFailures = {};

      let cacheHits = 0;
      let freshMatches = 0;

      recordsWithoutAnyAddress.forEach(
        (record) => {
          const recordKey = String(
            record?.id ||
              record?.number ||
              getInvoiceCustomerName(record) ||
              Math.random()
          );

          nextFailures[
            `invoice:${recordKey}`
          ] =
            'Customer delivery address is missing.';
        }
      );

      const recordsToGeocode = [];

      uniqueRecords.forEach((record) => {
        const cached =
          getFreshCachedEntry(
            cache,
            record.geocodeKey
          );

        if (
          cached?.success === true &&
          isWithinSingapore(
            cached.lat,
            cached.lng
          )
        ) {
          nextLocations[
            record.geocodeKey
          ] = {
            lat: Number(cached.lat),
            lng: Number(cached.lng),
            formattedAddress: String(
              cached.formattedAddress || ''
            ),
            postalCode: String(
              cached.postalCode ||
                record.postalCode ||
                ''
            ),
            source:
              cached.source ===
              'nominatim_postal'
                ? 'cache_postal'
                : 'cache_address',
          };

          cacheHits += 1;
          return;
        }

        if (
          cached?.success === false &&
          retryUnmappedNonce === 0
        ) {
          nextFailures[
            record.geocodeKey
          ] =
            cached.error ||
            'Location was not found recently.';
          return;
        }

        recordsToGeocode.push(record);
      });

      setGeocodeLocations({
        ...nextLocations,
      });
      setGeocodeFailures({
        ...nextFailures,
      });

      if (recordsToGeocode.length === 0) {
        if (
          cancelled ||
          geocodeRunRef.current !== runId
        ) {
          return;
        }

        setGeocodeStatus({
          isLoading: false,
          cacheHits,
          freshMatches,
          failedCount:
            Object.keys(nextFailures)
              .length,
          error: '',
        });
        return;
      }

      setGeocodeStatus({
        isLoading: true,
        cacheHits,
        freshMatches,
        failedCount:
          Object.keys(nextFailures).length,
        error: '',
      });

      let lastPublicRequestAt = 0;

      try {
        // Deliberately sequential: public Nominatim requires a single thread
        // and no more than one request per second.
        for (
          let index = 0;
          index < recordsToGeocode.length;
          index += 1
        ) {
          if (
            cancelled ||
            geocodeRunRef.current !== runId
          ) {
            return;
          }

          const record =
            recordsToGeocode[index];

          const elapsed =
            Date.now() -
            lastPublicRequestAt;

          if (
            lastPublicRequestAt > 0 &&
            elapsed <
              NOMINATIM_REQUEST_DELAY_MS
          ) {
            await wait(
              NOMINATIM_REQUEST_DELAY_MS -
                elapsed
            );
          }

          lastPublicRequestAt = Date.now();

          try {
            const result =
              await geocodeWithNominatim({
                postalCode:
                  record.postalCode,
                address:
                  record.deliveryAddress,
              });

            if (
              result.success &&
              isWithinSingapore(
                result.lat,
                result.lng
              )
            ) {
              nextLocations[
                record.geocodeKey
              ] = {
                lat: Number(result.lat),
                lng: Number(result.lng),
                formattedAddress: String(
                  result.formattedAddress ||
                    ''
                ),
                postalCode: String(
                  result.postalCode ||
                    record.postalCode ||
                    ''
                ),
                source: result.source,
              };

              delete nextFailures[
                record.geocodeKey
              ];

              cache[
                record.geocodeKey
              ] = {
                success: true,
                lat: Number(result.lat),
                lng: Number(result.lng),
                formattedAddress: String(
                  result.formattedAddress ||
                    ''
                ),
                postalCode: String(
                  result.postalCode ||
                    record.postalCode ||
                    ''
                ),
                source: result.source,
                savedAt: Date.now(),
              };

              freshMatches += 1;
            } else {
              const errorMessage =
                result.error ||
                'Location not found.';

              nextFailures[
                record.geocodeKey
              ] = errorMessage;

              cache[
                record.geocodeKey
              ] = {
                success: false,
                error: errorMessage,
                savedAt: Date.now(),
              };
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : 'Unable to geocode this address.';

            nextFailures[
              record.geocodeKey
            ] = errorMessage;

            // Rate-limit/network errors are not cached as long-lived failures,
            // because the customer address itself may be perfectly valid.
            if (
              !/rate-limit|HTTP 429/i.test(
                errorMessage
              )
            ) {
              cache[
                record.geocodeKey
              ] = {
                success: false,
                error: errorMessage,
                savedAt: Date.now(),
              };
            }
          }

          writeGeocodeCache(cache);

          if (
            cancelled ||
            geocodeRunRef.current !== runId
          ) {
            return;
          }

          setGeocodeLocations({
            ...nextLocations,
          });
          setGeocodeFailures({
            ...nextFailures,
          });
          setGeocodeStatus({
            isLoading:
              index <
              recordsToGeocode.length - 1,
            cacheHits,
            freshMatches,
            failedCount:
              Object.keys(nextFailures)
                .length,
            error: '',
          });
        }

        if (
          cancelled ||
          geocodeRunRef.current !== runId
        ) {
          return;
        }

        setGeocodeStatus({
          isLoading: false,
          cacheHits,
          freshMatches,
          failedCount:
            Object.keys(nextFailures)
              .length,
          error: '',
        });
      } catch (error) {
        if (
          cancelled ||
          geocodeRunRef.current !== runId
        ) {
          return;
        }

        console.error(
          'Failed to resolve delivery locations:',
          error
        );

        setGeocodeStatus({
          isLoading: false,
          cacheHits,
          freshMatches,
          failedCount:
            Object.keys(nextFailures)
              .length,
          error:
            error instanceof Error
              ? error.message
              : 'Unable to resolve delivery locations.',
        });
      }
    };

    void resolveLocations();

    return () => {
      cancelled = true;
    };
  }, [
    isClient,
    geocodeSignature,
    retryUnmappedNonce,
    baseDeliveryRecords,
  ]);

  const todayDeliveryRecords = useMemo(
    () =>
      baseDeliveryRecords.map(
        (record) => {
          const geocoded =
            record.geocodeKey
              ? geocodeLocations[
                  record.geocodeKey
                ] || null
              : null;

          const mapLocation =
            record.directLocation
              ? {
                  ...record.directLocation,
                  source:
                    'saved_coordinates',
                  postalCode:
                    record.postalCode,
                  formattedAddress:
                    record.deliveryAddress,
                }
              : geocoded;

          const navigationUrl =
            buildNavigationUrl(
              record.deliveryAddress,
              mapLocation
            );

          const locationSource =
            mapLocation
              ? getLocationSourceLabel(
                  mapLocation.source,
                  mapLocation.postalCode ||
                    record.postalCode
                )
              : '';

          return {
            ...record,
            mapCustomer: mapLocation
              ? {
                  ...record.cust,
                  lat: Number(
                    mapLocation.lat
                  ),
                  lng: Number(
                    mapLocation.lng
                  ),
                }
              : null,
            locationSource,
            resolvedAddress:
              mapLocation?.formattedAddress ||
              record.deliveryAddress ||
              '',
            navigationUrl,
            locationError: mapLocation
              ? ''
              : record.geocodeKey
                ? geocodeFailures[
                    record.geocodeKey
                  ] ||
                  (geocodeStatus.isLoading
                    ? 'Resolving location…'
                    : 'Location not resolved')
                : 'Customer delivery address is missing.',
          };
        }
      ),
    [
      baseDeliveryRecords,
      geocodeLocations,
      geocodeFailures,
      geocodeStatus.isLoading,
    ]
  );

  const todayStops = useMemo(
    () =>
      todayDeliveryRecords.filter(
        (stop) =>
          Boolean(stop?.mapCustomer)
      ),
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
      const region = String(
        stop?.cust?.region ||
          stop?.region ||
          ''
      ).trim();

      if (!region) return;

      if (!groups[region]) {
        groups[region] = [];
      }

      groups[region].push(stop);
    });

    return groups;
  }, [todayStops]);

  const routeMetrics = useMemo(() => {
    if (!selectedRegion) return null;

    const selectedStops =
      regionalGroups[selectedRegion];

    if (
      !Array.isArray(selectedStops) ||
      selectedStops.length === 0
    ) {
      return null;
    }

    const headquarters =
      normaliseCoordinateLocation(
        COMPANY_HQ
      );

    if (!headquarters) return null;

    const remainingStops = [
      ...selectedStops,
    ];
    const sequence = [];
    let currentPosition = headquarters;
    let totalDistance = 0;

    while (remainingStops.length > 0) {
      let nearestIndex = 0;
      let minimumDistance =
        getDistanceKm(
          currentPosition,
          remainingStops[0].mapCustomer
        );

      for (
        let index = 1;
        index < remainingStops.length;
        index += 1
      ) {
        const distance = getDistanceKm(
          currentPosition,
          remainingStops[index]
            .mapCustomer
        );

        if (
          distance < minimumDistance
        ) {
          minimumDistance = distance;
          nearestIndex = index;
        }
      }

      totalDistance +=
        Number(minimumDistance) || 0;

      currentPosition =
        remainingStops[
          nearestIndex
        ].mapCustomer;

      sequence.push(
        remainingStops.splice(
          nearestIndex,
          1
        )[0]
      );
    }

    totalDistance +=
      Number(
        getDistanceKm(
          currentPosition,
          headquarters
        )
      ) || 0;

    const averageSpeedKmh = 70;
    const trafficFactor = 1.35;
    const serviceMinutesPerStop = 12;

    const travelHours =
      (totalDistance /
        averageSpeedKmh) *
      trafficFactor;

    const serviceHours =
      (sequence.length *
        serviceMinutesPerStop) /
      60;

    const totalDurationMins =
      Math.round(
        (travelHours +
          serviceHours) *
          60
      );

    return {
      sequence,
      totalDist: totalDistance,
      totalDurationMins,
    };
  }, [
    regionalGroups,
    selectedRegion,
  ]);

  const totalMappedInvoices =
    todayStops.length;

  const navigationReadyInvoices =
    todayDeliveryRecords.filter(
      (stop) =>
        Boolean(stop?.navigationUrl)
    ).length;

  const unmappedInvoices = Math.max(
    todayInvoices.length -
      totalMappedInvoices,
    0
  );

  const geocodedInvoiceCount =
    todayDeliveryRecords.filter(
      (stop) =>
        stop?.mapCustomer &&
        stop?.locationSource !==
          'Saved coordinates'
    ).length;

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (
      !isClient ||
      !mapContainerRef.current
    ) {
      return undefined;
    }

    let resizeTimer;

    const mapContainer =
      mapContainerRef.current;

    try {
      setMapError('');

      if (!mapRef.current) {
        mapRef.current = L.map(
          mapContainer,
          {
            zoomControl: true,
            attributionControl: true,
          }
        ).setView(
          DEFAULT_MAP_CENTER,
          DEFAULT_MAP_ZOOM
        );

        L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            attribution:
              '&copy; OpenStreetMap contributors',
            maxZoom: 19,
          }
        ).addTo(mapRef.current);
      }

      const map = mapRef.current;

      if (
        markersLayerRef.current &&
        map.hasLayer(
          markersLayerRef.current
        )
      ) {
        map.removeLayer(
          markersLayerRef.current
        );
      }

      if (
        polylineRef.current &&
        map.hasLayer(
          polylineRef.current
        )
      ) {
        map.removeLayer(
          polylineRef.current
        );
      }

      markersLayerRef.current = null;
      polylineRef.current = null;

      const featureGroup =
        L.featureGroup();

      const headquarters =
        normaliseCoordinateLocation(
          COMPANY_HQ
        );

      let deliveryMarkerCount = 0;

      if (headquarters) {
        L.circleMarker(
          [
            headquarters.lat,
            headquarters.lng,
          ],
          {
            radius: 8,
            color: '#dc2626',
            weight: 2,
            fillColor: '#ef4444',
            fillOpacity: 1,
          }
        )
          .bindPopup(
            '<b>Three Leaves HQ</b>'
          )
          .addTo(featureGroup);
      }

      const addDeliveryMarker = (
        stop,
        index = null
      ) => {
        const customer =
          normaliseCoordinateLocation(
            stop?.mapCustomer
          );

        if (!customer) return;

        deliveryMarkerCount += 1;

        const customerName =
          escapeHtml(
            getCustomerName(stop?.cust)
          );

        const deliveryAddress =
          escapeHtml(
            stop?.deliveryAddress || ''
          );

        const resolvedAddress =
          escapeHtml(
            stop?.resolvedAddress || ''
          );

        const navigationUrl =
          escapeHtml(
            stop?.navigationUrl || ''
          );

        const invoiceNumber =
          escapeHtml(
            stop?.number ||
              stop?.invoiceNumber ||
              stop?.id ||
              ''
          );

        const sourceLabel =
          escapeHtml(
            stop?.locationSource || ''
          );

        L.circleMarker(
          [customer.lat, customer.lng],
          {
            radius:
              index === null ? 6 : 7,
            color: '#1d4ed8',
            weight: 2,
            fillColor: '#3b82f6',
            fillOpacity: 1,
          }
        )
          .bindPopup(
            `<div style="min-width:230px">
              <b>${
                index === null
                  ? ''
                  : `${index + 1}. `
              }${customerName}</b>

              ${
                deliveryAddress
                  ? `<br/><span style="display:block;margin-top:4px">${deliveryAddress}</span>`
                  : ''
              }

              ${
                resolvedAddress &&
                resolvedAddress !==
                  deliveryAddress
                  ? `<br/><span style="display:block;margin-top:5px;color:#64748b;font-size:11px">OSM match: ${resolvedAddress}</span>`
                  : ''
              }

              ${
                sourceLabel
                  ? `<br/><span style="display:inline-block;margin-top:7px;color:#166534;background:#dcfce7;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700">${sourceLabel}</span>`
                  : ''
              }

              ${
                invoiceNumber
                  ? `<br/><span style="display:block;margin-top:7px;color:#2563eb">Invoice #${invoiceNumber}</span>`
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
      };

      if (
        routeMetrics?.sequence?.length &&
        headquarters
      ) {
        routeMetrics.sequence.forEach(
          (stop, index) => {
            addDeliveryMarker(
              stop,
              index
            );
          }
        );

        const routeCoordinates = [
          [
            headquarters.lat,
            headquarters.lng,
          ],
          ...routeMetrics.sequence
            .map((stop) =>
              normaliseCoordinateLocation(
                stop?.mapCustomer
              )
            )
            .filter(Boolean)
            .map((customer) => [
              customer.lat,
              customer.lng,
            ]),
          [
            headquarters.lat,
            headquarters.lng,
          ],
        ];

        if (
          routeCoordinates.length >= 3
        ) {
          polylineRef.current =
            L.polyline(
              routeCoordinates,
              {
                color: '#2563eb',
                weight: 4,
                opacity: 0.9,
                dashArray: '10, 10',
              }
            ).addTo(map);
        }
      } else {
        todayStops.forEach((stop) => {
          addDeliveryMarker(stop);
        });
      }

      featureGroup.addTo(map);
      markersLayerRef.current =
        featureGroup;

      if (polylineRef.current) {
        const routeBounds =
          polylineRef.current.getBounds();

        if (routeBounds.isValid()) {
          map.fitBounds(routeBounds, {
            padding: [50, 50],
            maxZoom: 14,
          });
        }
      } else if (
        deliveryMarkerCount > 0
      ) {
        const markerBounds =
          featureGroup.getBounds();

        if (markerBounds.isValid()) {
          map.fitBounds(markerBounds, {
            padding: [50, 50],
            maxZoom: 14,
          });
        }
      } else if (headquarters) {
        map.setView(
          [
            headquarters.lat,
            headquarters.lng,
          ],
          DEFAULT_MAP_ZOOM
        );
      } else {
        map.setView(
          DEFAULT_MAP_CENTER,
          DEFAULT_MAP_ZOOM
        );
      }

      resizeTimer =
        window.setTimeout(() => {
          map.invalidateSize();
        }, 100);
    } catch (error) {
      console.error(
        'Failed to initialise logistics map:',
        error
      );

      setMapError(
        error instanceof Error
          ? error.message
          : 'The map could not be loaded.'
      );
    }

    return () => {
      if (resizeTimer) {
        window.clearTimeout(
          resizeTimer
        );
      }

      const map = mapRef.current;

      if (
        map &&
        markersLayerRef.current &&
        map.hasLayer(
          markersLayerRef.current
        )
      ) {
        map.removeLayer(
          markersLayerRef.current
        );
      }

      if (
        map &&
        polylineRef.current &&
        map.hasLayer(
          polylineRef.current
        )
      ) {
        map.removeLayer(
          polylineRef.current
        );
      }

      markersLayerRef.current = null;
      polylineRef.current = null;
    };
  }, [
    isClient,
    routeMetrics,
    todayStops,
  ]);

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
          <Navigation
            className="animate-pulse text-blue-600"
            size={20}
          />
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
                  Today&apos;s deliveries automatically mapped from Singapore postal codes and customer addresses
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {unmappedInvoices > 0 &&
              !geocodeStatus.isLoading && (
                <button
                  type="button"
                  onClick={() =>
                    setRetryUnmappedNonce(
                      (value) => value + 1
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                >
                  <RefreshCw size={16} />
                  Retry unmapped
                </button>
              )}

            {selectedRegion && (
              <button
                type="button"
                onClick={() =>
                  setSelectedRegion(null)
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
              >
                <RotateCcw size={16} />
                Show all deliveries
              </button>
            )}
          </div>
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
              {geocodedInvoiceCount} resolved automatically
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
              {routeMetrics
                ? routeMetrics.totalDist.toFixed(
                    1
                  )
                : '—'}

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
                ? formatDuration(
                    routeMetrics.totalDurationMins
                  )
                : '—'}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Includes traffic and 12 min per stop
            </p>
          </div>
        </div>

        {geocodeStatus.isLoading && (
          <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900">
            <Loader2
              className="mt-0.5 shrink-0 animate-spin"
              size={18}
            />

            <div>
              <p className="text-sm font-bold">
                Resolving delivery locations…
              </p>

              <p className="mt-0.5 text-xs leading-5 text-blue-700">
                Postal code is tried first, followed by the full Singapore address. New OpenStreetMap searches are deliberately processed one at a time at no more than one request per second.
              </p>
            </div>
          </div>
        )}

        {!geocodeStatus.isLoading &&
          (geocodeStatus.cacheHits > 0 ||
            geocodeStatus.freshMatches >
              0) && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
              <CheckCircle
                className="mt-0.5 shrink-0"
                size={18}
              />

              <div>
                <p className="text-sm font-bold">
                  Address-based mapping is active
                </p>

                <p className="mt-0.5 text-xs text-emerald-700">
                  {geocodeStatus.cacheHits}{' '}
                  location
                  {geocodeStatus.cacheHits ===
                  1
                    ? ''
                    : 's'}{' '}
                  loaded from the browser cache and{' '}
                  {geocodeStatus.freshMatches}{' '}
                  new location
                  {geocodeStatus.freshMatches ===
                  1
                    ? ''
                    : 's'}{' '}
                  resolved from OpenStreetMap.
                </p>
              </div>
            </div>
          )}

        {(unmappedInvoices > 0 ||
          geocodeStatus.error) && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            <AlertCircle
              className="mt-0.5 shrink-0"
              size={18}
            />

            <div>
              <p className="text-sm font-bold">
                {unmappedInvoices} invoice
                {unmappedInvoices === 1
                  ? ''
                  : 's'}{' '}
                cannot currently be shown on the map
              </p>

              <p className="mt-0.5 text-xs leading-5 text-amber-700">
                Check the customer address or six-digit Singapore postal code in the affected records below. The Navigate button can still use the written address.
                {geocodeStatus.error
                  ? ` ${geocodeStatus.error}`
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
              {REGION_OPTIONS.map(
                (region) => {
                  const count =
                    regionalGroups[
                      region.key
                    ]?.length || 0;

                  const isSelected =
                    selectedRegion ===
                    region.key;

                  return (
                    <button
                      key={region.key}
                      type="button"
                      onClick={() =>
                        setSelectedRegion(
                          (current) =>
                            current ===
                            region.key
                              ? null
                              : region.key
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
                              {
                                region.label
                              }
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {count}{' '}
                              delivery
                              {count === 1
                                ? ''
                                : 'ies'}
                            </p>
                          </div>
                        </div>

                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                          {count}
                        </span>
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            <div className="min-h-0 flex-1 border-t border-slate-100">
              <div className="flex items-center justify-between px-5 pb-3 pt-5">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {selectedRegion
                      ? `${selectedRegion} route`
                      : 'Today’s stops'}
                  </h3>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedRegion &&
                    routeMetrics
                      ? `${routeMetrics.sequence.length} ordered stops`
                      : `${todayDeliveryRecords.length} delivery records`}
                  </p>
                </div>
              </div>

              <div className="max-h-[440px] space-y-2 overflow-y-auto px-4 pb-5">
                {(selectedRegion &&
                routeMetrics
                  ? routeMetrics.sequence
                  : todayDeliveryRecords
                ).map((stop, index) => {
                  const customerName =
                    getCustomerName(
                      stop?.cust
                    );

                  const address =
                    String(
                      stop?.deliveryAddress ||
                        ''
                    ).trim();

                  const navigationUrl =
                    stop?.navigationUrl || '';

                  const invoiceNumber =
                    stop?.number ||
                    stop?.invoiceNumber ||
                    stop?.id ||
                    '';

                  const hasMapCoordinates =
                    Boolean(
                      stop?.mapCustomer
                    );

                  return (
                    <div
                      key={`${
                        stop?.id ||
                        invoiceNumber
                      }-${index}`}
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
                                {
                                  customerName
                                }
                              </p>

                              {invoiceNumber && (
                                <p className="mt-0.5 text-[11px] font-bold text-blue-600">
                                  Invoice #
                                  {String(
                                    invoiceNumber
                                  )}
                                </p>
                              )}
                            </div>

                            {hasMapCoordinates ? (
                              <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-700">
                                {stop.locationSource ||
                                  'Mapped'}
                              </span>
                            ) : geocodeStatus.isLoading &&
                              stop.geocodeKey &&
                              !stop.locationError ? (
                              <span className="inline-flex shrink-0 items-center rounded-md bg-blue-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-blue-700">
                                <Loader2
                                  size={10}
                                  className="mr-1 animate-spin"
                                />
                                Mapping
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-amber-700">
                                Not mapped
                              </span>
                            )}
                          </div>

                          {address ? (
                            <>
                              <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">
                                {address}
                              </p>

                              {stop.postalCode && (
                                <p className="mt-1 text-[10px] font-bold text-slate-400">
                                  Postal{' '}
                                  {
                                    stop.postalCode
                                  }
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="mt-1 text-xs font-semibold text-red-500">
                              Delivery address missing
                            </p>
                          )}

                          {!hasMapCoordinates &&
                            stop.locationError &&
                            stop.locationError !==
                              'Resolving location…' && (
                              <p className="mt-2 rounded-lg bg-amber-100/70 px-2.5 py-2 text-[10px] font-semibold leading-4 text-amber-700">
                                {
                                  stop.locationError
                                }
                              </p>
                            )}

                          {navigationUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                openNavigation(
                                  navigationUrl
                                )
                              }
                              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-black text-white shadow-sm transition hover:bg-blue-700"
                            >
                              <Navigation
                                size={13}
                              />
                              Navigate to address
                              <ExternalLink
                                size={12}
                              />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(selectedRegion &&
                  !routeMetrics) ||
                (!selectedRegion &&
                  todayDeliveryRecords.length ===
                    0) ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
                    <MapPin
                      className="mx-auto text-slate-300"
                      size={24}
                    />

                    <p className="mt-3 text-sm font-bold text-slate-500">
                      No deliveries
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      There are no delivery records for this selection.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          <section className="relative min-h-[680px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
            <div
              ref={mapContainerRef}
              className="absolute inset-0 z-0"
            />

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
                    {selectedRegion &&
                    routeMetrics
                      ? `${routeMetrics.sequence.length} stops · ${routeMetrics.totalDist.toFixed(
                          1
                        )} km`
                      : `${todayStops.length} customer locations`}
                  </p>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute right-4 top-4 z-[1000] rounded-2xl border border-white/70 bg-white/95 px-4 py-3 text-xs shadow-lg backdrop-blur">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-700">
                  <span className="h-3 w-3 rounded-full bg-red-500" />

                  <Building2
                    size={14}
                    className="text-slate-400"
                  />

                  Three Leaves HQ
                </div>

                <div className="flex items-center gap-2 font-bold text-slate-700">
                  <span className="h-3 w-3 rounded-full bg-blue-500" />

                  <MapPin
                    size={14}
                    className="text-slate-400"
                  />

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

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500 shadow-sm">
          <span className="font-black text-slate-700">
            Mapping:
          </span>{' '}
          customer coordinates are not required. The system extracts a six-digit Singapore postal code and uses OpenStreetMap Nominatim to resolve it; the full customer address is the fallback. Successful results are cached in this browser to avoid repeat geocoding.
          <span className="ml-1 font-semibold">
            {navigationReadyInvoices}{' '}
            navigation link
            {navigationReadyInvoices === 1
              ? ''
              : 's'}{' '}
            ready.
          </span>

          <span className="ml-1">
            Geocoding and map data © OpenStreetMap contributors.
          </span>
        </div>
      </div>
    </div>
  );
}
