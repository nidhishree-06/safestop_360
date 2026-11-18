# SafeStop 360 — GPS & Real-Phone Testing Guide

## 1. Why Real Phones Require HTTPS for Geolocation

Modern mobile browsers (iOS Safari, Android Chrome) enforce the **Secure Contexts** specification:
- `http://localhost:5173` **is** a secure context on your laptop.
- `http://192.168.x.x:5173` on a phone over LAN is **NOT** a secure context — `navigator.geolocation` will immediately fail or be blocked.

SafeStop 360 explicitly checks `window.isSecureContext` and displays `"Location needs HTTPS or localhost"` rather than failing silently.

---

## 2. Testing on a Real Phone Browser

### Option A — Local HTTPS via Vite (`@vitejs/plugin-basic-ssl`)
1. In `frontend/.env`, set:
   ```env
   VITE_HTTPS=true
   VITE_API_URL=http://<YOUR_LAPTOP_LAN_IP>:8000/api
   ```
2. Add your laptop LAN IP to `backend/.env`:
   ```env
   DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,<YOUR_LAPTOP_LAN_IP>
   CORS_ALLOWED_ORIGINS=http://localhost:5173,https://<YOUR_LAPTOP_LAN_IP>:5173
   ```
3. Start the backend bound to LAN:
   ```powershell
   cd backend
   python manage.py runserver 0.0.0.0:8000
   ```
4. Start the frontend in HTTPS mode:
   ```powershell
   cd frontend
   npm run dev:https
   ```
5. Open `https://<YOUR_LAPTOP_LAN_IP>:5173/find-help` on your phone, accept the local self-signed certificate warning, and tap **"Use my current location"**.

### Option B — HTTPS Tunnel (Recommended for iOS Safari & Mixed-Content Free Testing)
Use Cloudflare Quick Tunnels or ngrok to expose both ports over trusted HTTPS:
```powershell
cloudflared tunnel --url http://127.0.0.1:8000
cloudflared tunnel --url http://127.0.0.1:5173
```
Set `VITE_API_URL` to the backend tunnel URL + `/api` and add the frontend tunnel URL to `CORS_ALLOWED_ORIGINS`.

---

## 3. Simulating GPS in Desktop Chrome DevTools

1. Open `http://localhost:5173/find-help` in Chrome.
2. Open **DevTools** (`F12`) → press `Ctrl+Shift+P` → type **Show Sensors**.
3. Under **Location**, select **Custom location** and enter Mysuru coordinates:
   - Latitude: `12.2958`
   - Longitude: `76.6394`
4. Click **"Use my current location"** on the map.
5. Verify the blue pulsing GPS marker, accuracy badge, and distance-sorted Mysuru demo partners appear.
6. Test **Location Unavailable / Denied**: in Sensors set Location to **Location unavailable**, or block location in site settings → click **"Use my current location"** → verify the error banner and manual search / tap-on-map pin fallback work seamlessly.

---

## 4. Automated Playwright GPS E2E Tests

Run the Playwright suite (`frontend/e2e/gps.spec.ts`) while backend (`8000`) and frontend (`5173`) are running:
```powershell
cd frontend
npm run test:e2e
```
Tests verify:
- Zero console errors across `360px`, `768px`, and `1280px` viewports.
- Granted geolocation (`12.2958, 76.6394`): blue marker appears, Mysuru verified partners load, category filter works, directions draw a polyline with Google Maps / OSM links.
- Denied geolocation: friendly permission-denied guidance appears and manual search sets the active location.

---

## 5. Production Note: Routing & Tile Providers

- The public OSRM server (`https://router.project-osrm.org`) and public Overpass servers are **for demos and low-volume prototypes only**.
- For production traffic:
  - Set `OSRM_BASE_URL` in `backend/.env` to a self-hosted OSRM instance or swap `geo/services.py` to OpenRouteService / Mapbox Directions.
  - Set `VITE_TILE_URL` in `frontend/.env` to a commercial tile provider (e.g., MapTiler or Stadia Maps) with your API key.
