# SafeStop 360

### Find Help. Reach Safety. Stay Connected.

SafeStop 360 is a full-stack women's safety and local assistance web application built with **React, Vite, TypeScript, Tailwind CSS, Framer Motion, Leaflet/OpenStreetMap, Django, and Django REST Framework**.

> **Official Emergency Notice (India):** SafeStop 360 is an independent local assistance platform and does **not** replace official emergency services. In immediate danger, dial **112** (National Emergency Response) or **181** (Women Helpline) first.

---

## Core Capabilities

1. **Public Experience & Awareness Hub**: Responsive floating liquid-glass navigation, 11-section editorial landing page, safety resources directory, and publicly browsable verified SafePlaces map.
2. **Role-Based Authentication (`WOMAN`, `PARTNER`, `ADMIN`)**: JWT access + rotating blacklisted refresh tokens, strong password validation, protected routes, profile & privacy settings, and immutable `AuditLog`.
3. **Nearby Verified SafePlaces Map (Leaflet + OpenStreetMap)**: Opt-in geolocation + manual Bengaluru area presets, category filters, live availability status (`AVAILABLE`, `BUSY`, `OFFLINE`), Haversine distance sorting, and OpenStreetMap walking directions.
4. **Assistance Confirmation Loop**: Closed-loop state machine (`PENDING → ACCEPTED → ARRIVED → CLOSED`, plus `DECLINED`, `EXPIRED`, `CANCELLED`) with 5-second live polling, partner confirmation notes, arrival confirmation, and optional post-completion feedback.
5. **Private Journey Watch & Trusted Contacts**: Opt-in travel check-ins, missed check-in reminders, Trusted Contact CRUD with per-contact notification preferences, and visible one-tap **Stop Location Sharing** control. Private journey data is never exposed publicly.
6. **Community Safety Reports & Explainable Rule-Based AI Intelligence**: Anonymous safety reporting with clear `UNREVIEWED` / `REVIEWED` labelling, aggregated cluster map, and deterministic Python rule-based spatial clustering (500m radius), theme tagging, and time-of-day trend summaries—with explicit non-claim boundaries.
7. **Companion Foundation**: Companion applications strictly gated behind administrator verification before appearing publicly.
8. **Partner & Administrator Dashboards**: Operational partner console (live availability toggle + incoming request queue) and administrator governance console (partner/companion approvals, report moderation, AI digest, network overview map, and audit history).

---

## Project Structure

```text
├── frontend/                  # React 19 + Vite + TypeScript + Tailwind + Framer Motion + Leaflet
│   ├── public/assets/         # Preserved local editorial & branding artwork
│   ├── public/_redirects      # Netlify SPA routing config
│   ├── vercel.json            # Vercel SPA routing & security headers
│   └── src/
│       ├── components/        # UI primitives (matte/glass/neumorphic), Navbar, Footer, Map, Auth guard
│       ├── context/           # AuthContext & Liquid Glass ToastContext
│       ├── pages/             # Landing, Auth, User, Partner, and Admin workspaces
│       ├── services/          # Environment-driven REST API client with JWT refresh
│       └── styles/            # CSS design tokens & matte/glass/neumorphic surface system
├── backend/                   # Django 5 + DRF + SimpleJWT + drf-spectacular
│   ├── safestop/              # Settings, URLs, role permissions, health check, core tests
│   ├── accounts/              # Custom email User, UserProfile, Notifications, AuditLog, Admin analytics
│   ├── partners/              # Partner establishments, verification history, Haversine search, availability
│   ├── assistance/            # HelpRequest state machine & HelpRequestFeedback
│   ├── journeys/              # Private Journey Watch, JourneyCheckIn, TrustedContacts
│   ├── reports/               # Anonymized SafetyReports & explainable intelligence.py
│   ├── companions/            # Admin-verified Companions & CompanionRequests
│   ├── build.sh               # Render build & migration script
│   └── requirements.txt
├── docs/
│   ├── API.md                 # Full REST API documentation
│   └── DEPLOYMENT.md          # Render + PostgreSQL + Vercel/Netlify deployment guide
├── render.yaml                # Render Blueprint for API + Managed PostgreSQL
├── .env.example               # Environment variable template
└── .gitignore
```

---

## Local Development Setup

### 1. Backend (Django + SQLite for local dev)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy ..\.env.example .env
python manage.py migrate
python manage.py seed_demo_data
python manage.py runserver
```

- Health Check: `http://127.0.0.1:8000/api/health/`
- OpenAPI Swagger UI: `http://127.0.0.1:8000/api/docs/`

### 2. Frontend (React + Vite)

```powershell
cd frontend
npm install
npm run dev
```

- Web App: `http://localhost:5173`

### Local Demo Accounts (Seeded by `seed_demo_data`)

All pre-loaded establishments, companions, and sample reports are clearly labelled **`[DEMO]`** for local testing:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Woman** | `ananya@demo.safestop360.local` | `DemoWoman@2026!` |
| **Partner** | `partner@demo.safestop360.local` | `DemoPartner@2026!` |
| **Admin** | `admin@demo.safestop360.local` | `DemoAdmin@2026!` |

---

## Running Tests & Production Build

```powershell
# Backend checks & automated test suite (18 tests)
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test

# Frontend TypeScript check & production bundle
cd ..\frontend
npm run build
```

---

## Documentation
- [API Reference](docs/API.md)
- [Deployment Guide (Render + Vercel / Netlify + PostgreSQL)](docs/DEPLOYMENT.md)
