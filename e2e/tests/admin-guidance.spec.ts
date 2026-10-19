import { expect, type Page, test } from "@playwright/test";

import { adminApi, openBookingStep, OWNER } from "./helpers";

test.use({ storageState: OWNER.storageState });

type Service = { id: number; slug: string };

async function standardCleaning(page: Page) {
  const services = await adminApi<Service[]>(page, "GET", "services/");
  return services.find((s) => s.slug === "standard-cleaning")!;
}

test.describe("Finding your way around the admin", () => {
  test("booking sections keep entered details and reveal missing required fields", async ({ page }) => {
    await page.goto("/admin/bookings/new");
    await expect(page.getByRole("region", { name: "Client details", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Service and space", exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByLabel("Contact name")).toBeFocused();

    await page.getByLabel("Contact name").fill("Amina Bello");
    await page.getByLabel("Phone (WhatsApp)").fill("08023456789");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("region", { name: "Service and space", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByLabel("Contact name")).toHaveValue("Amina Bello");
    await expect(page.getByLabel("Phone (WhatsApp)")).toHaveValue("08023456789");

    await page.getByLabel("Contact name").clear();
    await openBookingStep(page, "Review & billing");
    await page.getByRole("button", { name: "Create booking", exact: true }).click();
    await expect(page.getByRole("region", { name: "Client details", exact: true })).toBeVisible();
    await expect(page.getByLabel("Contact name")).toBeFocused();
  });

  test("the sidebar groups pages and explains each one", async ({ page }) => {
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Admin" });
    for (const group of ["Daily work", "Your services", "Setup"]) {
      await expect(nav.getByText(group, { exact: true })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Services & prices" })).toHaveAttribute(
      "title",
      "What customers can book and how much it costs",
    );
    await nav.getByRole("link", { name: "Homepage categories" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Homepage categories" })).toBeVisible();
  });

  test("the getting-started checklist tracks setup and links to each step", async ({ page }) => {
    await adminApi(page, "POST", "setup/", { key: "prices", done: false });
    await adminApi(page, "POST", "setup/", { key: "dismissed", done: false });
    await page.goto("/admin");

    const card = page.getByRole("region", { name: "Getting started" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("progressbar", { name: "Setup progress" })).toBeVisible();
    const prices = card.getByRole("listitem").filter({ hasText: "Set your real prices" });
    await expect(prices).toContainText("(to do)");
    await prices.getByRole("button", { name: "Mark as done" }).click();
    await expect(prices).toContainText("(done)");

    const terms = card.getByRole("listitem").filter({ hasText: "Finish your terms and conditions" });
    await terms.getByRole("link", { name: "Go there" }).click();
    await expect(page).toHaveURL(/\/admin\/settings\?tab=terms$/);
    await expect(page.getByText("The terms and conditions customers agree to before paying")).toBeVisible();

    await page.goto("/admin");
    await card.getByRole("button", { name: "Hide for now" }).click();
    await expect(card).toHaveCount(0);
    await page.getByRole("button", { name: /Finish setting up \(\d+ of \d+ done\)/ }).click();
    await expect(card).toBeVisible();
  });

  test("the service editor is split into guided tabs", async ({ page }) => {
    const service = await standardCleaning(page);
    await page.goto(`/admin/services/${service.id}`);
    await expect(page.getByRole("tab", { name: /Basics/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("What customers read about this service")).toBeVisible();

    await page.getByRole("button", { name: "Next: Pricing" }).click();
    await expect(page).toHaveURL(/tab=pricing/);
    await expect(page.getByText("How this price is worked out")).toBeVisible();
    await expect(page.getByText(/Each visit costs ₦[\d,]+ to start, plus ₦[\d,]+ each for rooms \/ work areas/)).toBeVisible();

    await page.getByRole("button", { name: "Next: Booking rules" }).click();
    await expect(page.getByRole("heading", { name: "Arrival times" })).toBeVisible();
    await page.getByRole("button", { name: "Back: Pricing" }).click();
    await expect(page).toHaveURL(/tab=pricing/);
  });

  test("tips explain jargon in plain words", async ({ page }) => {
    const service = await standardCleaning(page);
    await page.goto(`/admin/services/${service.id}?tab=pricing`);
    await page.getByRole("button", { name: "About minimum charge" }).hover();
    await expect(page.getByRole("tooltip").filter({ visible: true })).toContainText("small jobs are still worth the trip");
  });

  test("unsaved changes are flagged and can be discarded", async ({ page }) => {
    const service = await standardCleaning(page);
    await page.goto(`/admin/services/${service.id}`);
    const summary = page.getByLabel("One-line summary");
    const original = await summary.inputValue();

    await expect(page.getByText("You have unsaved changes")).toHaveCount(0);
    await summary.fill("Something new");
    await expect(page.getByText("You have unsaved changes")).toBeVisible();

    // Following a link asks first; saying no keeps you on the page.
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Bookings" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/services/${service.id}`));

    await page.getByRole("button", { name: "Discard" }).click();
    await expect(summary).toHaveValue(original);
    await expect(page.getByText("You have unsaved changes")).toHaveCount(0);
  });

  test("settings tabs say what each one is for", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("tab", { name: "Areas" }).click();
    await expect(page.getByText("The parts of Lagos customers can pick, and any travel charge for each.")).toBeVisible();
    await page.getByRole("tab", { name: "Frequencies" }).click();
    await expect(page.getByText(/how many visits one payment covers/)).toBeVisible();
  });

  test("settings sections can be navigated with the keyboard", async ({ page }) => {
    await page.goto("/admin/settings");
    const tabs = page.getByRole("tablist", { name: "Settings sections" });
    await tabs.getByRole("tab", { name: "Business & contact" }).focus();
    await page.keyboard.press("ArrowDown");
    const booking = tabs.getByRole("tab", { name: "Booking & VAT" });
    await expect(booking).toBeFocused();
    await expect(booking).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/tab=booking/);
    await page.keyboard.press("End");
    await expect(tabs.getByRole("tab", { name: "FAQs" })).toBeFocused();
    await expect(page).toHaveURL(/tab=faqs/);
  });
});
