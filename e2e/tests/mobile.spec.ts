import { expect, test } from "@playwright/test";

import { openBookingStep, OWNER } from "./helpers";

// Runs in the "mobile" project (Pixel 7 viewport).

test("mobile menu navigates the public site", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Pricing" }).click();
  await expect(page.getByRole("heading", { name: "Clear prices for Lagos workspaces" })).toBeVisible();
});

test("mobile booking shows the price summary inline", async ({ page }) => {
  await page.goto("/book?service=standard-cleaning");
  await page.getByLabel("Area in Lagos").selectOption({ label: "Yaba" });
  await expect(page.getByTestId("summary-total").filter({ visible: true })).toHaveText(/₦[\d,]+/);
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
});

test("the page never scrolls sideways on a phone", async ({ page }) => {
  for (const path of ["/", "/pricing", "/book", "/careers"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test.describe("admin on a phone", () => {
  test.use({ storageState: OWNER.storageState });

  test("booking sections and settings fit the phone screen", async ({ page }) => {
    await page.goto("/admin/bookings/new");
    await page.getByLabel("Contact name").fill("Amina Bello");
    await page.getByLabel("Phone (WhatsApp)").fill("08023456789");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("region", { name: "Service and space", exact: true })).toBeVisible();
    await openBookingStep(page, "Client details");
    await expect(page.getByLabel("Contact name")).toHaveValue("Amina Bello");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    page.once("dialog", (dialog) => dialog.accept());
    await page.goto("/admin/settings");
    await page.getByRole("combobox", { name: "Settings sections", exact: true }).selectOption("areas");
    await expect(page).toHaveURL(/tab=areas/);
    await expect(page.getByText("The parts of Lagos customers can pick, and any travel charge for each.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test("drawer navigation works", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: "Open menu" }).click();
    // The desktop sidebar is in the page too (hidden), so use the visible drawer.
    await page.getByRole("navigation", { name: "Admin" }).filter({ visible: true }).getByRole("link", { name: "Cleaners" }).click();
    await expect(page.getByRole("heading", { name: "Cleaners" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin" }).filter({ visible: true })).toHaveCount(0);
  });
});
