/**
 * Google Maps 3D satellite view capture using Playwright
 */

import { chromium, type Browser, type Page } from 'playwright';

/**
 * Capture a 3D satellite view of a location from Google Maps
 */
export async function capture3DView(
  lat: number,
  lng: number,
  googleMapsApiKey: string,
  headless: boolean = true
): Promise<Buffer> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({ headless });
    page = await browser.newPage();

    // Set viewport to a reasonable size
    await page.setViewportSize({ width: 1024, height: 1024 });

    // Create HTML page with embedded Google Maps
    const html = `
<!DOCTYPE html>
<html>
  <head>
    <style>
      body { margin: 0; padding: 0; }
      #map { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&v=beta"></script>
    <script>
      function initMap() {
        const map = new google.maps.Map(document.getElementById('map'), {
          center: { lat: ${lat}, lng: ${lng} },
          zoom: 20,
          mapTypeId: 'satellite',
          tilt: 30,
          heading: 45,
          disableDefaultUI: true,
          gestureHandling: 'none',
          keyboardShortcuts: false,
        });
      }

      // Wait for Google Maps API to load
      if (window.google && window.google.maps) {
        initMap();
      } else {
        window.addEventListener('load', initMap);
      }
    </script>
  </body>
</html>
`;

    await page.setContent(html);

    // Wait for the map to load and tiles to render
    // We wait a bit longer to ensure 3D tiles are loaded
    await page.waitForTimeout(8000);

    // Capture screenshot
    const screenshot = await page.screenshot({ type: 'png' });

    return screenshot;
  } finally {
    // Cleanup
    if (page) await page.close();
    if (browser) await browser.close();
  }
}
