# SafeStop 360 — System Architecture

## 1. High-Level Overview

SafeStop 360 separates public discovery, privacy-preserving geospatial proxies, role-scoped assistance workflows, and administrative governance across a React 18 SPA frontend and a Django REST Framework backend.

```text
[React 18 + Vite + Leaflet 1.9]
   │  (JWT Bearer via VITE_API_URL)
   ▼
[Django + DRF API]
   ├── accounts/    (Custom email User: WOMAN/PARTNER/ADMIN, Profile, Notifications, AuditLog)
   ├── partners/    (Partner, PartnerVerification, Availability, bbox + Haversine nearby <= 25 km)
   ├── assistance/  (HelpRequest, Feedback, single transition_help_request() service -> 409 on conflict)
   ├── journeys/    (Journey, JourneyCheckIn, TrustedContact, LocationPing, expiring share_token)
   ├── reports/     (SafetyReport with 3-decimal rounded public coordinates)
   ├── analysis/    (Pure-Python 300 m Haversine clusterer, keyword classifier, time-of-day trends)
   ├── companions/  (Admin-verified Companion & CompanionRequest)
   └── geo/         (Cached & throttled proxies for Nominatim, Overpass + mirror, OSRM + fallback)
```

---

## 2. Assistance Confirmation State Machine

All transitions execute through one atomic service function (`backend/assistance/services.py:transition_help_request`):

```text
PENDING (auto-expires after 10 min)
  ├── ACCEPTED  (assigned partner only)
  │     ├── ARRIVED   (requester owner only)
  │     │     └── CLOSED (assigned partner only)  ──► deletes all LocationPing rows
  │     └── CANCELLED (requester owner only)      ──► deletes all LocationPing rows
  ├── DECLINED  (assigned partner only)           ──► deletes all LocationPing rows
  ├── CANCELLED (requester owner only)            ──► deletes all LocationPing rows
  └── EXPIRED   (automatic after 10 min)          ──► deletes all LocationPing rows
```

- Invalid transitions always return **HTTP 409 Conflict** with `{"detail": "...", "code": "invalid_transition"}`.
- Requests to unapproved or non-`AVAILABLE` partners are rejected at creation time.

---

## 3. Location Privacy Architecture

1. **Opt-in Only**: `useGeolocation.ts` never invokes `navigator.geolocation` on page mount — only on explicit user click.
2. **Short-Lived `LocationPing` Rows**: Scoped via database `CheckConstraint` to either an active `Journey` or an active `HelpRequest`. Automatically deleted on terminal state (`CLOSED`, `CANCELLED`, `DECLINED`, `EXPIRED`, `COMPLETED`) or when the user taps **Stop sharing**.
3. **Strict Visibility Boundaries**:
   - Partner sees requester's approximate position **only after `ACCEPTED`**, and only while `share_live_location=True`.
   - Public community safety maps expose only **3-decimal rounded coordinates (~110 m)** and clusters meeting a minimum count (`>= 2`).
   - Trusted contacts receive an unguessable `secrets.token_urlsafe(32)` link (`/journey-status/:token`) that returns `410 Gone` as soon as the journey ends or is revoked.
   - Users can permanently purge all stored pings and coordinates at any time via `DELETE /api/auth/me/location-data/`.
   - Raw coordinates are never written to `AuditLog` or application logs.

---

## 4. Geo Proxy Resilience & Caching

- **Nominatim (`/api/geo/search/`, `/reverse/`)**: Proper `User-Agent`, `countrycodes=in`, 24-hour cache, 1 req/s politeness throttle, graceful `unavailable: true` payload if offline.
- **Overpass (`/api/geo/places/`)**: 10-minute cache keyed by rounded 3-decimal coordinates, 8 s query timeout, automatic failover across `OVERPASS_URLS` mirrors, strictly labelled `OSM_UNVERIFIED`.
- **OSRM (`/api/geo/route/`)**: Walking (`foot`) and driving (`driving`) profiles with 5-minute cache. On timeout or failure, automatically returns a straight-line dashed GeoJSON LineString, Haversine distance, conservative ETA, and Google Maps + OpenStreetMap deep links.
