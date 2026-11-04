import { expect, test } from "@playwright/test";

import { adminApi, OWNER, unique } from "./helpers";

test.use({ storageState: OWNER.storageState });

type Service = { id: number; slug: string; base_price: number; minimum_charge: number };

test.describe("Services, rates and settings", () => {
  test("changing a rate updates the website price straight away", async ({ page, browser }) => {
    const services = await adminApi<Service[]>(page, "GET", "services/");
    const deep = services.find((s) => s.slug === "deep-cleaning")!;
    try {
      await page.goto(`/admin/services/${deep.id}?tab=pricing`);
      await page.getByLabel("Starting price", { exact: true }).fill("100000");
      await page.getByLabel("Minimum charge", { exact: true }).fill("0");
      // Base 100,000 + 1 room × 12,000 (placeholder rate)
      await expect(page.locator("aside", { hasText: "Customers see" })).toContainText("₦112,000");
      await page.getByRole("button", { name: "Save service" }).first().click();
      await expect(page.getByText("Service saved")).toBeVisible();

      const visitor = await browser.newPage();
      await visitor.goto("/pricing");
      await expect(visitor.locator("article", { hasText: "Deep cleaning" })).toContainText("₦112,000");
      await visitor.close();
    } finally {
      await adminApi(page, "PATCH", `services/${deep.id}/`, { base_price: deep.base_price, minimum_charge: deep.minimum_charge });
    }
  });

  test("owners can add a room type and an add-on", async ({ page }) => {
    const services = await adminApi<Service[]>(page, "GET", "services/");
    const move = services.find((s) => s.slug === "move-in-move-out")!;
    const before = await adminApi<{ units: unknown[]; addons: unknown[] }>(page, "GET", `services/${move.id}/`);
    try {
      await page.goto(`/admin/services/${move.id}?tab=pricing`);
      const units = page.locator("section", { hasText: "What customers count" });
      await units.getByRole("button", { name: "Add a counter" }).click();
      await units.getByLabel("Label", { exact: true }).last().fill("Balconies");
      await units.getByLabel("Price each", { exact: true }).last().fill("3000");
      const addons = page.locator("section", { hasText: "Optional extras" });
      await addons.getByRole("button", { name: "Add an extra" }).click();
      await addons.getByLabel("Add-on", { exact: true }).last().fill("Fridge clean");
      await addons.getByLabel("Price", { exact: true }).last().fill("6000");
      await page.getByRole("button", { name: "Save service" }).first().click();
      await expect(page.getByText("Service saved")).toBeVisible();

      await page.goto("/book?service=move-in-move-out");
      await expect(page.getByRole("button", { name: "More Balconies" })).toBeVisible();
      await expect(page.getByRole("checkbox", { name: /Fridge clean/ })).toBeVisible();
    } finally {
      await adminApi(page, "PATCH", `services/${move.id}/`, { units: before.units, addons: before.addons });
    }
  });

  test("hiding a service removes it from the website", async ({ page, browser }) => {
    const services = await adminApi<Service[]>(page, "GET", "services/");
    const post = services.find((s) => s.slug === "post-construction-cleaning")!;
    try {
      await page.goto(`/admin/services/${post.id}`);
      await page.getByRole("switch", { name: "Show on the website" }).click();
      await page.getByRole("button", { name: "Save service" }).first().click();
      await expect(page.getByText("Service saved")).toBeVisible();

      const visitor = await browser.newPage();
      await visitor.goto("/");
      await expect(visitor.locator("#services article")).toHaveCount(4);
      await visitor.close();
    } finally {
      await adminApi(page, "PATCH", `services/${post.id}/`, { is_active: true });
    }
  });

  test("WhatsApp number and VAT settings drive the website", async ({ page, browser }) => {
    await page.goto("/admin/settings");
    await page.getByLabel("WhatsApp number").fill("234 801 234 5678");
    await page.getByRole("button", { name: "Save changes" }).first().click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    await expect(page.getByLabel("WhatsApp number")).toHaveValue("2348012345678");

    const visitor = await browser.newPage();
    await visitor.goto("/");
    await expect(visitor.getByRole("link", { name: "Chat with Kleandeck on WhatsApp" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/2348012345678\?text=/,
    );

    try {
      await page.getByRole("tab", { name: "Booking & VAT" }).click();
      await page.getByRole("switch", { name: "Charge VAT" }).click();
      await page.getByRole("button", { name: "Save changes" }).first().click();
      await expect(page.getByText("Settings saved")).toBeVisible();

      await visitor.goto("/book?service=standard-cleaning");
      await expect(visitor.locator("aside").filter({ visible: true }).first()).toContainText(/VAT \(0%\)\s*₦0/);
    } finally {
      await adminApi(page, "PATCH", "settings/", { vat_enabled: true });
      await visitor.close();
    }
  });

  test("a new service area with a surcharge is offered to customers", async ({ page }) => {
    const area = unique("Ikorodu");
    await page.goto("/admin/settings?tab=areas");
    await page.getByPlaceholder("New area, e.g. Ikorodu").fill(area);
    await page.getByLabel("Surcharge").last().fill("5000");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Area added")).toBeVisible();

    await page.goto("/book?service=standard-cleaning");
    await page.getByLabel("Area in Lagos").selectOption({ label: area });
    await expect(page.locator("aside").filter({ visible: true }).first()).toContainText(`Travel (${area})`);
  });

  test("FAQs added in the admin appear on the homepage", async ({ page }) => {
    const question = unique("Do you clean server rooms?");
    const answer = unique("Yes, with anti-static equipment on request. Ref");
    await page.goto("/admin/settings?tab=faqs");
    await page.getByPlaceholder("New question").fill(question);
    await page.getByPlaceholder("Answer").last().fill(answer);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("FAQ added")).toBeVisible();

    await page.goto("/#faq");
    await page.getByRole("button", { name: question }).click();
    await expect(page.getByText(answer)).toBeVisible();
  });
});
