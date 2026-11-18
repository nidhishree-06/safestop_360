# SafeStop 360 — Find Help. Reach Safety. Stay Connected.

SafeStop 360 (v2, GPS-First) is a full-stack women's safety and local assistance platform built with **React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, Leaflet 1.9 + react-leaflet v4, Django, and Django REST Framework**.

> **Important Emergency Disclaimer (India):** SafeStop 360 is an independent local assistance network and **does NOT replace official emergency services**. In immediate physical danger, call **112** (National Emergency) or **181** (Women Helpline) first.

---

## Quick Start (Under 10 Commands)

### Backend (Django + SQLite locally)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy ..\.env.example .env
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

### Frontend (React 18 + Vite)
```powershell
cd frontend
npm install
npm run dev
```

- Web App: `http://localhost:5173` (Design System Preview: `http://localhost:5173/design-system`)
- API Health: `http://127.0.0.1:8000/api/health/`
- API OpenAPI Docs: `http://127.0.0.1:8000/api/docs/`

---

## Seeded Demo Accounts (`python manage.py seed_demo`)

All seeded partners, reports, and companions around **Mysuru, Karnataka (`12.2958, 76.6394`)** carry an explicit **`Demo`** badge.

| Role | Email | Password |
| :--- | :--- | :--- |
| **Woman** | `woman@safestop.demo` | `Woman@12345` |
| **Partner** | `partner@safestop.demo` | `Partner@12345` |
| **Admin** | `admin@safestop.demo` | `Admin@12345` |

Seeded dataset: **10 approved Mysuru demo partners**, **2 pending partners**, **8 demo safety reports**, **2 demo companions** (1 approved, 1 pending), and **2 trusted contacts**.

---

## Environment Variables (`.env.example`)

| Variable | Scope | Purpose |
| :--- | :--- | :--- |
| `DJANGO_SECRET_KEY` | Backend | Secret key (required when `DJANGO_DEBUG=False`) |
| `DJANGO_DEBUG` | Backend | `True` locally, `False` in production |
| `DJANGO_ALLOWED_HOSTS` | Backend | Comma-separated allowed hostnames |
| `DATABASE_URL` | Backend | Optional PostgreSQL URL (defaults to SQLite locally) |
| `CORS_ALLOWED_ORIGINS` | Backend | Comma-separated allowed frontend origins |
| `NOMINATIM_BASE_URL` / `NOMINATIM_USER_AGENT` | Backend | Nominatim geocode/reverse proxy settings |
| `OVERPASS_URLS` | Backend | Comma-separated Overpass mirrors (with automatic failover) |
| `OSRM_BASE_URL` | Backend | Routing server URL (default public demo OSRM; swap for production) |
| `VITE_API_URL` | Frontend | Backend API base URL (e.g. `http://127.0.0.1:8000/api`) |
| `VITE_TILE_URL` | Frontend | Leaflet map tile URL (default OSM; swap for MapTiler/Stadia in prod) |
| `VITE_HTTPS` | Frontend | Set `true` to run Vite over HTTPS for real phone GPS testing |

---

## Folder Map

```text
├── frontend/
│   ├── public/assets/           # Brand & awareness images + WebP copies + UI references/
│   ├── e2e/gps.spec.ts          # Playwright GPS granted/denied + directions + responsive tests
│   └── src/
│       ├── components/ui/       # Matte, soft-neumorphic & liquid-glass UI primitives
│       ├── components/map/      # SafeStopMap (GPS, manual search, OSM layer, OSRM routing)
│       ├── components/layout/   # Floating glass navbar, dashboard shell, mobile bottom bar
│       ├── hooks/               # useGeolocation (secure-context, Permissions API, watch throttle)
│       ├── lib/                 # motion.ts, leaflet.ts (Vite icon fix, SVG category markers)
│       ├── pages/               # Landing, DesignSystem, Auth, Woman, Partner, Admin, SharedJourney
│       ├── services/            # Env-driven REST API client (VITE_API_URL + JWT refresh)
│       └── styles/              # tokens.css, surfaces.css, index.css
├── backend/
│   ├── safestop/                # Settings, URLs, {"detail","code"} exception handler, permissions
│   ├── accounts/                # User (WOMAN/PARTNER/ADMIN), Profile, Notifications, AuditLog, seed_demo
│   ├── partners/                # Partner, PartnerVerification, Availability, bbox + Haversine nearby
│   ├── assistance/              # HelpRequest, Feedback, canonical state-machine service + ping cleanup
│   ├── journeys/                # Journey, JourneyCheckIn, TrustedContact, LocationPing, expiring link
│   ├── reports/                 # Anonymized SafetyReports (rounded 3-decimal public coords)
│   ├── analysis/                # Pure-Python 300 m spatial grouping, keyword themes, time trends
│   ├── companions/              # Admin-verified Companions & CompanionRequests
│   ├── geo/                     # Nominatim, Overpass (with mirror fallback), OSRM (with fallback)
│   └── tests/                   # pytest suite (auth, permissions, state machine, geo mocks, analysis)
└── docs/
    ├── ARCHITECTURE.md
    ├── GPS_TESTING.md
    ├── DEMO_SCRIPT.md
    └── DEPLOYMENT.md
```

---

## API Overview

- **Auth & Privacy**: `/api/auth/register/`, `/login/`, `/logout/`, `/refresh/`, `/me/`, `DELETE /me/location-data/`
- **Partners**: `/api/partners/`, `/api/partners/nearby/?lat&lng&radius_km&category`, `/api/partners/register/`, `/api/partners/{id}/availability/`
- **Assistance Loop**: `/api/requests/`, `/{id}/accept/`, `/decline/`, `/arrived/`, `/close/`, `/cancel/`, `/location/`, `/stop-sharing/`, `/feedback/`
- **Journey Watch & Contacts**: `/api/journeys/`, `/{id}/checkin/`, `/location/`, `/complete/`, `/cancel/`, `/stop-sharing/`, `GET /api/journeys/shared/{token}/`, `/api/trusted-contacts/`
- **Geo Proxies**: `/api/geo/search/`, `/api/geo/reverse/`, `/api/geo/places/`, `/api/geo/route/`
- **Reports & Analysis**: `/api/reports/`, `/api/reports/intelligence/`
- **Admin**: `/api/admin/partners/`, `/reports/`, `/companions/`, `/analytics/`, `/audit-logs/`
- **System**: `/api/health/`, `/api/docs/`

---

## Known Limitations (Honest Scope)

1. **Foreground Browser Tracking Only**: Web browsers suspend JavaScript geolocation when a tab is closed or a phone screen locks. Journey Watch clearly advises keeping the tab open; continuous background tracking requires a native mobile app with push/SMS delivery.
2. **Public Routing & Overpass Demo Limits**: Default `router.project-osrm.org` and public Overpass servers are suitable for demos only. SafeStop 360 includes automatic straight-line + Google Maps/OSM deep-link fallbacks and env configuration to swap in self-hosted OSRM or OpenRouteService.
3. **Missing Reference Graphic Fallback**: `safety-issues.jpg` ("7 Critical Women Safety Issues in India") was not included in the uploaded asset set; SafeStop 360 renders an accessible local structured awareness card fallback with lightbox support.
4. **Demo Data**: All pre-seeded Mysuru partners, reports, and companions are synthetic prototype records clearly marked `Demo`.
