import { useState, useEffect, useRef } from 'react';

const LOCALITY_CACHE = new Map<string, string>();

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export function extractLocalityFromAddress(
  address: Record<string, string | undefined>,
): string | null {
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    address.state;
  const country = address.country;

  if (city && country) {
    return `${city}, ${country}`;
  }
  return city || country || null;
}

function fetchReverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`;
  return fetch(url, {
    headers: {
      'Accept-Language': 'es, en;q=0.8',
      'User-Agent': 'RunningSupport/1.0',
    },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data?.address ? extractLocalityFromAddress(data.address) : null))
    .catch(() => null);
}

export function useGpsLocality(lat?: number, lng?: number): string {
  const fallback = process.env.NEXT_PUBLIC_DEFAULT_LOCALITY || 'Madrid, España';
  const [locality, setLocality] = useState<string>(fallback);
  const lastCoordsRef = useRef<string>('');

  useEffect(() => {
    if (
      lat === undefined ||
      lng === undefined ||
      !isFinite(lat) ||
      !isFinite(lng) ||
      (lat === 0 && lng === 0)
    ) {
      return;
    }

    const key = getCacheKey(lat, lng);
    if (key === lastCoordsRef.current) return;
    lastCoordsRef.current = key;

    const cached = LOCALITY_CACHE.get(key);
    if (cached) {
      setLocality(cached);
      return;
    }

    let isSubscribed = true;
    void fetchReverseGeocode(lat, lng).then((resolved) => {
      if (isSubscribed && resolved) {
        LOCALITY_CACHE.set(key, resolved);
        setLocality(resolved);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [lat, lng, fallback]);

  return locality;
}
