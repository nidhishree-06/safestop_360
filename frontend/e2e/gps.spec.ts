import { expect, test } from '@playwright/test';

const MYSURU = { latitude: 12.2958, longitude: 76.6394 };

test.describe('SafeStop 360 — GPS, Maps, Directions & Quality Gates', () => {
  test('landing page loads with zero console errors across 360, 768, 1280 viewports', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    for (const width of [1280, 768, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Find');
      await expect(page.locator('img[src*="silhouettes"]')).toBeVisible();
    }

    expect(errors).toEqual([]);
  });

  test('GPS granted: blue user marker, Mysuru verified partners, filtering & directions polyline', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: MYSURU,
    });
    const page = await context.newPage();

    // Stub OSRM route proxy response deterministically for CI/offline stability
    await page.route('**/api/geo/route/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: 'foot',
          fallback: false,
          fallback_reason: '',
          distance_m: 850,
          duration_s: 660,
          geometry: {
            type: 'LineString',
            coordinates: [
              [76.6394, 12.2958],
              [76.637, 12.299],
              [76.6347, 12.3016],
            ],
          },
          google_maps_url: 'https://www.google.com/maps/dir/?api=1&origin=12.2958,76.6394&destination=12.3016,76.6347',
          osm_url: 'https://www.openstreetmap.org/directions?route=12.2958%2C76.6394%3B12.3016%2C76.6347',
        }),
      });
    });

    await page.goto('/find-help', { waitUntil: 'networkidle' });

    // Click "Use my current location" (never auto-triggered on page load)
    await page.getByTestId('use-location-btn').click();

    // Blue GPS marker appears on Leaflet map
    await expect(page.locator('.safestop-user-marker')).toBeVisible({ timeout: 10_000 });

    // Verified Mysuru demo partners render in list
    const list = page.getByTestId('verified-partners-list');
    await expect(list).toBeVisible();
    await expect(list).toContainText('Verified');
    await expect(list).toContainText('Demo');

    // Category filter works (Pharmacy)
    await page.getByRole('button', { name: 'Pharmacy', exact: true }).click();
    await expect(list).toContainText('Pharmacy');

    // Click "Get Directions" -> route panel + polyline render
    await list.getByRole('button', { name: /Get Directions/i }).first().click();
    const panel = page.getByTestId('directions-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('850 m');
    await expect(panel).toContainText('Open in Google Maps');
    await expect(page.locator('path.leaflet-interactive').first()).toBeVisible();

    await context.close();
  });

  test('GPS denied: shows friendly error message and working manual search fallback', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      permissions: [],
    });
    const page = await context.newPage();

    // Force geolocation denial cleanly in browser API
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_ok: PositionCallback, err?: PositionErrorCallback) => {
            err?.({
              code: 1,
              message: 'User denied Geolocation',
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
          },
          watchPosition: () => 1,
          clearWatch: () => {},
        },
      });
    });

    // Mock /api/geo/search/ so manual fallback test works offline too
    await page.route('**/api/geo/search/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'Kuvempunagar',
          count: 1,
          unavailable: false,
          results: [
            {
              display_name: 'Kuvempunagar, Mysuru, Karnataka, India',
              lat: 12.2889,
              lng: 76.6288,
              type: 'suburb',
            },
          ],
        }),
      });
    });

    await page.goto('/find-help', { waitUntil: 'networkidle' });
    await page.getByTestId('use-location-btn').click();

    // Friendly permission denied message appears
    const banner = page.getByTestId('geolocation-error-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/permission was denied/i);

    // Manual search fallback sets location and loads nearby partners
    const searchInput = page.getByTestId('manual-location-input');
    await searchInput.fill('Kuvempunagar');
    const suggestion = page.getByRole('button', { name: /Kuvempunagar, Mysuru/i });
    await expect(suggestion).toBeVisible({ timeout: 5_000 });
    await suggestion.click();

    await expect(page.getByText(/Active center:/i)).toContainText('Kuvempunagar');
    await expect(page.getByTestId('verified-partners-list')).toBeVisible();

    await context.close();
  });
});
