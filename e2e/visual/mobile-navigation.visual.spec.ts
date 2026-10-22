import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "Mobile navigation only renders below md");
  await page.goto("/");
  await page.locator("nextjs-portal").evaluateAll((nodes) => {
    nodes.forEach((node) => node.remove());
  });
});

test("mobile navigation closed", async ({ page }) => {
  await expect(page).toHaveScreenshot("mobile-navigation-closed.png", {
    clip: { x: 0, y: 0, width: 390, height: 430 },
  });
});

test("mobile navigation open", async ({ page }) => {
  await page.getByRole("button", { name: "Toggle main navigation" }).click();
  await expect(page.getByRole("dialog", { name: "Main navigation" })).toBeVisible();
  await expect(page).toHaveScreenshot("mobile-navigation-open.png", {
    clip: { x: 0, y: 0, width: 390, height: 430 },
  });
});
