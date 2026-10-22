import { expect, test } from "@playwright/test";
import { disableMotion } from "./utils/stabilize";

/**
 * Static, fully public marketing/info routes. No backend calls, no
 * dynamic data — these pages render the same output for every visitor,
 * so a single "default" state per route is representative.
 *
 * Ownership: components/common/production-ui.tsx (MarketingHero,
 * FeatureGrid, MetricGrid, DataPanel, StatusBadge) and
 * components/layout/public-shell.tsx, public-nav.tsx, public-footer.tsx
 * back every route below — a diff on more than one route at once usually
 * means one of those shared components changed.
 */
const routes: { name: string; path: string; owner: string }[] = [
  { name: "home", path: "/", owner: "app/page.tsx" },
  { name: "how-it-works", path: "/how-it-works", owner: "app/how-it-works/page.tsx" },
  { name: "developers", path: "/developers", owner: "app/developers/page.tsx" },
  { name: "issuers", path: "/issuers", owner: "app/issuers/page.tsx (DataPanel)" },
  { name: "faq", path: "/faq", owner: "app/faq/page.tsx" },
  { name: "privacy", path: "/privacy", owner: "app/privacy/page.tsx" },
  { name: "terms", path: "/terms", owner: "app/terms/page.tsx" },
  { name: "status", path: "/status", owner: "app/status/page.tsx (DataPanel/MetricGrid)" },
];

for (const route of routes) {
  test(`public page: ${route.name}`, async ({ page }) => {
    await page.goto(route.path);
    await disableMotion(page);
    await expect(page).toHaveScreenshot(`public-${route.name}.png`, {
      fullPage: true,
    });
  });
}
