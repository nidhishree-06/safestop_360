# SafeStop 360 — Production Deployment Guide

## 1. Backend Deployment (Render + Managed PostgreSQL)

1. Provision a Managed PostgreSQL database (Render PostgreSQL, Neon, or Supabase) and copy its `DATABASE_URL`.
2. Deploy `backend/` as a Web Service on Render (or use the root `render.yaml`):
   - **Build Command**: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
   - **Start Command**: `gunicorn safestop.wsgi:application --bind 0.0.0.0:$PORT --workers 2`
3. Configure Backend Environment Variables:
   ```env
   DJANGO_DEBUG=False
   DJANGO_SECRET_KEY=<generate-50-char-random-secret>
   DJANGO_ALLOWED_HOSTS=your-api.onrender.com
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
   CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
   CSRF_TRUSTED_ORIGINS=https://your-frontend.vercel.app
   DJANGO_SECURE_SSL_REDIRECT=True
   NOMINATIM_USER_AGENT=SafeStop360/2.0 (production; your-contact@domain.com)
   OSRM_BASE_URL=<your-self-hosted-osrm-or-ors-url>
   ```
4. Static files for Django Admin and Swagger UI are served via **WhiteNoise** (`CompressedManifestStaticFilesStorage`).
5. Verify health after deploy: `GET https://your-api.onrender.com/api/health/`.

---

## 2. Frontend Deployment (Vercel or Netlify)

1. Connect the repository with root directory `frontend/`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
2. Configure Frontend Environment Variables:
   ```env
   VITE_API_URL=https://your-api.onrender.com/api
   VITE_TILE_URL=https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=<YOUR_KEY>
   VITE_HTTPS=false
   ```
3. SPA fallback routing is pre-configured in `frontend/vercel.json` (Vercel) and `frontend/public/_redirects` (Netlify).
4. Both Vercel and Netlify serve over **HTTPS** by default, ensuring mobile browser GPS (`navigator.geolocation`) works cleanly on Android and iOS devices.
