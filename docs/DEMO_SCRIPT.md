# SafeStop 360 — Live Ideathon Demo Script

This script walks through the complete end-to-end SafeStop 360 flow verified by `backend/tests/test_safestop_v2.py` and `frontend/e2e/gps.spec.ts`.

## Prerequisites
- Backend running on `http://127.0.0.1:8000` with `python manage.py seed_demo` applied.
- Frontend running on `http://localhost:5173`.

## Step-by-Step Walkthrough (~5 Minutes)

1. **Landing & Emergency Clarity (`/`)**
   - Showcase the warm-white & mint editorial hero with rising silhouettes, parallax scroll, night-street problem section, pulsing halftone megaphone, and click-to-zoom safety poster lightbox.
   - Point out one-tap **112** and **181** helpline access and the **Demo** badges on seeded Mysuru partners.

2. **Partner Registration → Admin Approval → Map Visibility**
   - Sign in as `partner@safestop.demo` / `Partner@12345` → open **My Establishment** → register a new Mysuru SafePlace (starts `PENDING`, cannot receive requests).
   - Sign in as `admin@safestop.demo` / `Admin@12345` → open **Partner Approvals** → click **Approve** (creates `PartnerVerification` and immutable `AuditLog`).
   - Open `/find-help` → confirm the newly approved partner now appears on the verified map.

3. **GPS-First Discovery, OSM Layer Separation & Directions (`/find-help`)**
   - Click **"Use my current location"** → blue pulsing GPS dot + accuracy badge (`within X m`) appear.
   - Filter by **Pharmacy** and adjust radius (`1 / 2 / 5 / 10 km`).
   - Toggle **"OSM places (unverified)"** → point out grey markers labelled *"OpenStreetMap listing, not verified by SafeStop"* (directions only, no help requests).
   - Click **"Get Directions"** on a verified partner → show Walk/Drive toggle, animated route polyline, distance/ETA, and Google Maps / OSM deep links.

4. **Closed-Loop Assistance with Opt-In Live Location (`/app/requests` & `/partner`)**
   - Sign in as `woman@safestop.demo` / `Woman@12345`.
   - Click **"Request Help"** on a verified partner, enable *"Share my live location with this place until the request closes"*, and submit (`PENDING` with pulsing ring).
   - In another browser window signed in as `partner@safestop.demo`, note that requester coordinates are hidden while `PENDING` → click **Accept** → requester's approximate position now appears on the partner's map.
   - On the woman's screen, view the animated confirmation transition + walking route → click **"I Have Arrived Safely"** (`ARRIVED`).
   - On the partner's screen, click **"Close Request Safely"** (`CLOSED`) → all temporary `LocationPing` rows are automatically deleted.
   - Woman saves 5-star post-completion feedback.

5. **Journey Watch & Privacy Controls (`/app/journey` & `/profile`)**
   - Start a Journey Watch session to a pinned Mysuru destination with live sharing enabled → copy the private expiring contact link (`/journey-status/:token`) and open it in an incognito tab.
   - Tap **"Arrived Safely"** → refresh the incognito tab to demonstrate it immediately returns **Expired (410)**.
   - Open **Profile & Privacy** → point out **"Delete my location data"**.

6. **Community Reports & Explainable Analysis (`/app/reports` & `/admin`)**
   - Inspect 300 m grouped observations using rounded coordinates and non-claim phrasing (*"2 unverified reports in this area in the last 30 days"*).
   - Open **Admin Overview** to show KPIs, network map, and the immutable audit log.
