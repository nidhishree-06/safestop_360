# SafeStop 360 — REST API Reference

Base URL (local development): `http://127.0.0.1:8000/api`
Interactive OpenAPI Swagger UI: `GET /api/docs/`
OpenAPI Schema JSON: `GET /api/schema/`

> **Authentication:** Protected endpoints expect `Authorization: Bearer <access_token>`. Refresh tokens rotate and are blacklisted on logout.

---

## 1. Platform Health
- `GET /api/health/` *(Public)* — Verifies API & database connectivity and returns official India emergency helpline info (`112`, `181`).

## 2. Authentication & Profile (`/api/auth/`)
- `POST /api/auth/register/` *(Public, throttled)* — Register a `WOMAN` or `PARTNER` user (`ADMIN` self-registration is blocked).
- `POST /api/auth/login/` *(Public, throttled)* — Authenticate by email & password; returns `{ user, tokens: { access, refresh } }`.
- `POST /api/auth/token/refresh/` *(Public)* — Exchange a valid refresh token for a new access/refresh pair.
- `POST /api/auth/logout/` *(Auth)* — Blacklists the refresh token and writes an `AuditLog` entry.
- `GET / PATCH /api/auth/me/` *(Auth)* — Read or update personal details, optional emergency note, and opt-in location default.
- `POST /api/auth/change-password/` *(Auth)* — Change password with Django strength validators.
- `GET /api/auth/dashboard-summary/` *(Auth)* — Real-data KPIs for the Women's Dashboard.
- `GET /api/auth/notifications/` *(Auth)* — List in-app notifications.
- `POST /api/auth/notifications/<uuid>/read/` & `read-all/` *(Auth)* — Mark notifications read.

## 3. Partners & Nearby SafePlaces (`/api/partners/`)
- `GET /api/partners/` *(Public)* — List **only** `APPROVED` partner establishments (`?category=`, `?city=`, `?search=`, `?available_only=true`).
- `GET /api/partners/nearby/` *(Public)* — Haversine proximity search (`?lat=`, `?lng=`, `?radius_km=`, `?category=`, `?available_only=`). Caller coordinates are never persisted or published.
- `GET /api/partners/<uuid>/` *(Public for approved; owner/admin for pending)* — Establishment detail.
- `POST /api/partners/register/` *(PARTNER / ADMIN)* — Submit new establishment (starts strictly `PENDING` admin approval).
- `GET /api/partners/mine/` *(PARTNER / ADMIN)* — List own establishments and verification history.
- `PATCH /api/partners/<uuid>/` *(Owner / ADMIN)* — Edit establishment details.
- `PATCH /api/partners/<uuid>/availability/` *(Owner / ADMIN)* — Set `AVAILABLE | BUSY | OFFLINE` + optional status note (approved partners only).

## 4. Assistance Confirmation Loop (`/api/requests/`)
Valid transitions: `PENDING -> ACCEPTED | DECLINED | EXPIRED | CANCELLED`, `ACCEPTED -> ARRIVED | CANCELLED | EXPIRED`, `ARRIVED -> CLOSED`.
- `GET /api/requests/` *(Auth, role-scoped)* — Woman sees own requests; Partner sees incoming requests for owned establishments; Admin sees all.
- `POST /api/requests/` *(WOMAN, throttled)* — Send request to an `APPROVED`, non-`OFFLINE` partner.
- `GET /api/requests/<uuid>/` *(Participants / ADMIN)* — Request detail.
- `POST /api/requests/<uuid>/accept/` *(Partner Owner / ADMIN)* — Accept pending request with optional `response_note`.
- `POST /api/requests/<uuid>/decline/` *(Partner Owner / ADMIN)* — Decline pending request.
- `POST /api/requests/<uuid>/arrived/` *(Requester / Partner Owner)* — Confirm safe arrival.
- `POST /api/requests/<uuid>/close/` *(Partner Owner / ADMIN)* — Mark assistance completed.
- `POST /api/requests/<uuid>/cancel/` *(Requester)* — Cancel an active `PENDING` or `ACCEPTED` request.
- `POST /api/requests/<uuid>/feedback/` *(Requester, once `CLOSED`)* — Submit optional 1–5 rating, `felt_safe`, and comment.

## 5. Private Journey Watch & Trusted Contacts (`/api/journeys/`)
Strictly private to `owner == request.user`. Never exposed on public maps.
- `GET / POST /api/journeys/contacts/` *(Auth)* — List or add Trusted Contacts.
- `PATCH / DELETE /api/journeys/contacts/<uuid>/` *(Auth)* — Edit notification preferences or remove contact.
- `GET / POST /api/journeys/` *(Auth)* — List own journeys or start a private Journey Watch (opt-in location sharing defaults to `false`).
- `GET /api/journeys/<uuid>/` *(Owner)* — Journey details & check-in log.
- `POST /api/journeys/<uuid>/checkin/` *(Owner)* — Record `SAFE` or `DELAYED` check-in (coordinates stored only if `location_sharing_enabled` is `true`).
- `POST /api/journeys/<uuid>/complete/` *(Owner)* — Confirm safe arrival & auto-disable location sharing.
- `POST /api/journeys/<uuid>/stop-sharing/` *(Owner)* — Immediately revoke location sharing, clear stored coordinates, and optionally end journey (`{ "end_journey": true }`).

## 6. Community Safety Reports & Rule-Based AI Intelligence (`/api/reports/`)
Reporter identities are never exposed in public responses.
- `GET /api/reports/` *(Public)* — List anonymized non-dismissed reports (clearly flagging `is_unreviewed`).
- `POST /api/reports/` *(Auth)* — Submit categorized safety report (starts strictly `UNREVIEWED`).
- `GET /api/reports/<uuid>/` *(Public)* — Anonymized report detail.
- `GET /api/reports/intelligence/` *(Auth)* — Explainable rule-based analysis (500m Haversine spatial clusters, repeated patterns, category breakdown, time-of-day trends, and explicit non-claim limitations).

## 7. Companion Foundation (`/api/companions/`)
- `GET /api/companions/` *(Auth)* — Lists **only** admin-`APPROVED` companions.
- `POST /api/companions/register/` *(Auth)* — Apply as a companion (starts `PENDING`).
- `GET /api/companions/me/` *(Auth)* — View own companion application status.
- `PATCH /api/companions/availability/` *(Approved Companion)* — Toggle `is_available`.
- `GET / POST /api/companions/requests/` *(Auth)* — List or send companion requests to approved, available companions.
- `POST /api/companions/requests/<uuid>/{accept|decline|complete|cancel}/` *(Auth)* — Update companion request status.

## 8. Administrator Governance (`/api/admin/` — Role: `ADMIN` Only)
- `GET /api/admin/partners/` & `POST /api/admin/partners/<uuid>/review/` — Verify (`APPROVED | REJECTED | SUSPENDED`) partners with audit logs.
- `GET /api/admin/reports/` & `PATCH /api/admin/reports/<uuid>/review/` — Moderate reports (`UNREVIEWED | UNDER_REVIEW | REVIEWED | DISMISSED`).
- `GET /api/admin/companions/` & `POST /api/admin/companions/<uuid>/review/` — Verify companion applications.
- `GET /api/admin/analytics/` — Real-data platform counts, AI safety digest, request oversight, aggregated map data, and immutable `AuditLog` entries.
