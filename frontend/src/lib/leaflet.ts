import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import type { PartnerCategory } from '@/types';

// Fix default Leaflet marker icon paths under Vite bundling
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export const MYSURU_DEFAULT_CENTER = { lat: 12.2958, lng: 76.6394 } as const;
export const MYSURU_DEFAULT_ZOOM = 13;

export const MAP_TILE_URL =
  (import.meta.env.VITE_TILE_URL as string | undefined) ||
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MAP_TILE_ATTRIBUTION =
  (import.meta.env.VITE_TILE_ATTRIBUTION as string | undefined) ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const CATEGORY_GLYPH: Record<PartnerCategory, string> = {
  PHARMACY: 'M10 4h4v4h4v4h-4v4h-4v-4H6V8h4V4z',
  HOSPITAL: 'M9 3h6v5h5v6h-5v5H9v-5H4V8h5V3z',
  PETROL_STATION: 'M6 4h8v14H6V4zm8 4h2l2 2v5a1.5 1.5 0 0 1-3 0v-3h-1',
  SHOP: 'M4 8l1.5-4h13L20 8v2a2 2 0 0 1-2 2h-1v7H7v-7H6a2 2 0 0 1-2-2V8z',
  HOTEL: 'M4 18V7h10a4 4 0 0 1 4 4v7h-2v-3H6v3H4zm3-6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  COLLEGE_FACILITY: 'M12 4L2 9l10 5 10-5-10-5zm-6 7.5V16l6 3 6-3v-4.5',
  OTHER: 'M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z',
};

export function createVerifiedPartnerIcon(
  category: PartnerCategory,
  selected = false,
  pendingPulse = false,
): L.DivIcon {
  const glyph = CATEGORY_GLYPH[category] || CATEGORY_GLYPH.OTHER;
  const bg = selected ? '#1A5C47' : '#2D8A6E';
  const ring = selected ? '#A7E8D2' : '#FFFFFF';
  const size = selected ? 40 : 34;

  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
      ${
        pendingPulse
          ? `<span class="pending-partner-pulse" style="position:absolute;inset:-6px;border-radius:9999px;background:rgba(104,191,163,0.45);border:2px solid #68BFA3;"></span>`
          : ''
      }
      <span style="position:relative;z-index:2;width:${size}px;height:${size}px;border-radius:9999px;background:${bg};border:2.5px solid ${ring};box-shadow:0 6px 16px rgba(26,92,71,0.34);display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="${glyph}" />
        </svg>
      </span>
    </div>
  `;

  return L.divIcon({
    className: 'safestop-verified-marker',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export function createOsmUnverifiedIcon(category: PartnerCategory, selected = false): L.DivIcon {
  const glyph = CATEGORY_GLYPH[category] || CATEGORY_GLYPH.OTHER;
  const bg = selected ? '#4B5563' : '#7B818A';
  const size = selected ? 32 : 28;

  const html = `
    <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${bg};border:2px dashed #F7F7F3;box-shadow:0 3px 10px rgba(34,37,42,0.22);display:flex;align-items:center;justify-content:center;opacity:0.9;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="${glyph}" />
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'safestop-osm-marker',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export function createUserLocationIcon(): L.DivIcon {
  return L.divIcon({
    className: 'safestop-user-marker',
    html: `
      <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <span class="user-marker-pulse" style="position:absolute;inset:-4px;border-radius:9999px;background:rgba(59,130,246,0.35);"></span>
        <span style="position:relative;z-index:2;width:16px;height:16px;border-radius:9999px;background:#2563EB;border:3px solid #FFFFFF;box-shadow:0 2px 10px rgba(37,99,235,0.55);"></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

export function createPinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'safestop-pin-marker',
    html: `
      <div style="width:28px;height:28px;border-radius:9999px;background:#9A7BEA;border:3px solid #FFFFFF;box-shadow:0 4px 14px rgba(154,123,234,0.45);display:flex;align-items:center;justify-content:center;">
        <span style="width:8px;height:8px;border-radius:9999px;background:#FFFFFF;"></span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number, profile: 'foot' | 'driving'): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  const mode = profile === 'driving' ? 'drive' : 'walk';
  if (mins < 60) return `about ${mins} min ${mode}`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `about ${hrs} hr ${rem} min ${mode}` : `about ${hrs} hr ${mode}`;
}
