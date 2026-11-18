import { useCallback, useEffect, useRef, useState } from 'react';

export type GeolocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'insecure-context';

export interface GeoCoords {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

const SESSION_KEY = 'safestop_last_location';
const WATCH_THROTTLE_MS = 3000;

export function saveSessionLocation(loc: { lat: number; lng: number; label?: string }) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(loc));
  } catch {
    // Ignore storage quota errors
  }
}

export function readSessionLocation(): { lat: number; lng: number; label?: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: number; lng?: number; label?: string };
    if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
      return { lat: parsed.lat, lng: parsed.lng, label: parsed.label };
    }
    return null;
  } catch {
    return null;
  }
}

export function useGeolocation() {
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [permissionState, setPermissionState] = useState<PermissionState | 'unknown'>('unknown');
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastWatchEmitRef = useRef<number>(0);

  // Observe Permissions API state (read-only; NEVER triggers geolocation on mount)
  useEffect(() => {
    let active = true;
    let permStatus: PermissionStatus | null = null;

    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((res) => {
          if (!active) return;
          permStatus = res;
          setPermissionState(res.state);
          res.onchange = () => {
            if (!active) return;
            setPermissionState(res.state);
            if (res.state === 'denied') {
              setStatus('denied');
            }
          };
        })
        .catch(() => {
          // Permissions API unsupported in this browser
        });
    }

    return () => {
      active = false;
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  // Always clear watch on unmount
  useEffect(() => stop, [stop]);

  const mapGeoError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setStatus('denied');
      setPermissionState('denied');
      setError(
        'Location permission was denied. To re-enable it, click the lock/site-info icon in your browser address bar and allow Location, or use the manual area search or tap the map below.',
      );
      return;
    }
    if (err.code === err.POSITION_UNAVAILABLE) {
      setStatus('unavailable');
      setError(
        'Your device could not determine a GPS fix right now. Try moving near a window or search/pin your location manually.',
      );
      return;
    }
    setStatus('timeout');
    setError(
      'Location request timed out. You can retry or search/pin your location manually on the map.',
    );
  }, []);

  const applyPosition = useCallback((position: GeolocationPosition) => {
    const next: GeoCoords = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: Math.round(position.coords.accuracy || 0),
      timestamp: position.timestamp || Date.now(),
    };
    setCoords(next);
    setStatus('granted');
    setPermissionState('granted');
    setError(null);
    saveSessionLocation({ lat: next.lat, lng: next.lng, label: 'Current GPS location' });
    return next;
  }, []);

  const requestLocation = useCallback((): Promise<GeoCoords | null> => {
    if (typeof window === 'undefined' || !window.isSecureContext) {
      setStatus('insecure-context');
      setError(
        'Location needs HTTPS or localhost. Open this site over HTTPS (or localhost) to use GPS, or pick your location manually below.',
      );
      return Promise.resolve(null);
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      setError(
        'This browser does not support GPS geolocation. Use the manual search or tap on the map.',
      );
      return Promise.resolve(null);
    }

    setStatus('requesting');
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(applyPosition(pos)),
        (err) => {
          // High-accuracy timeout -> retry once with enableHighAccuracy: false
          if (err.code === err.TIMEOUT) {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve(applyPosition(pos)),
              (fallbackErr) => {
                mapGeoError(fallbackErr);
                resolve(null);
              },
              { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 },
            );
            return;
          }
          mapGeoError(err);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    });
  }, [applyPosition, mapGeoError]);

  const startWatching = useCallback(() => {
    if (typeof window === 'undefined' || !window.isSecureContext) {
      setStatus('insecure-context');
      setError('Location needs HTTPS or localhost.');
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      setError('Geolocation is unavailable on this device.');
      return;
    }

    stop();
    setStatus('requesting');
    setError(null);
    setIsWatching(true);
    lastWatchEmitRef.current = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastWatchEmitRef.current < WATCH_THROTTLE_MS) {
          return;
        }
        lastWatchEmitRef.current = now;
        applyPosition(pos);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          stop();
        }
        mapGeoError(err);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  }, [applyPosition, mapGeoError, stop]);

  const retry = useCallback(() => {
    if (isWatching) {
      startWatching();
    } else {
      void requestLocation();
    }
  }, [isWatching, requestLocation, startWatching]);

  return {
    status,
    permissionState,
    coords,
    error,
    isWatching,
    accuracyWarning: Boolean(coords && coords.accuracy > 200),
    requestLocation,
    startWatching,
    stop,
    retry,
  };
}
