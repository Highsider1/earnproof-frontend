import { expect, test } from "@playwright/test";
import { runAxeScan } from "./fixtures/axe";
import { mockEarnProofApi, mockVerifyApi } from "./fixtures/mock-api";
import { mockFreighterWallet } from "./fixtures/mock-freighter";
import { scannedRoutes } from "./routes";

/**
 * Static/initial-render axe scans for every real, currently-shipped route.
 * "Payments" and "history/detail" pages do not exist yet in this app (see
 * docs/accessibility-testing.md) so they are intentionally not listed in
 * routes.ts; adding them there is all a future PR needs to do once those
 * pages ship.
 */
for (const route of scannedRoutes) {
  test(`${route.name} has no critical/serious axe violations`, async ({ page }, testInfo) => {
    // Verify + verify-credential routes hit the API on submit only, but
    // proofs fires an unauthenticated /auth flow lazily; mock both
    // up front so an initial-render scan never depends on a live backend.
    await mockEarnProofApi(page);
    await mockVerifyApi(page);
    await mockFreighterWallet(page);

    const response = await page.goto(route.path);
    expect(response?.status(), `expected ${route.path} to load`).toBeLessThan(500);

    await page.waitForLoadState("networkidle");

    await runAxeScan(page, testInfo, { routeName: route.name });
  });
}

test("open mobile navigation has no critical/serious axe violations", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle main navigation" }).click();

  await runAxeScan(page, testInfo, {
    routeName: "mobile-navigation-open",
    include: ['[role="dialog"]'],
  });
});
