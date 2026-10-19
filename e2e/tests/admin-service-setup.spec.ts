import path from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { adminApi, FAKE_PAYSTACK, OWNER, unique, visible } from "./helpers";

test.use({ storageState: OWNER.storageState });

const PHOTO = path.join(__dirname, "..", "fixtures", "photo-1408.jpg");

type Service = { id: number; slug: string; deposit_percent: number; min_lead_days: number | null; time_slots: number[] };

async function serviceBySlug(page: Page, slug: string) {
  const services = await adminApi<Service[]>(page, "GET", "services/");
  return services.find((s) => s.slug === slug)!;
}

const shown = (locator: import("@playwright/test").Locator) => locator.filter({ visible: true }).first();

test.describe("Setting up services", () => {
  test("a new category with an uploaded photo appears on the homepage", async ({ page, browser }) => {
    const name = unique("Schools");
    await page.goto("/admin/categories/new");
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Who it's for").fill("School bursars");
    await page.getByLabel("Description").fill("End-of-term deep cleans for classrooms and halls.");
    await page.getByLabel("Button text").fill("Price a school clean");
    await page.getByRole("checkbox", { name: "Deep cleaning" }).check();
    await page.getByRole("checkbox", { name: "Standard cleaning" }).check();
    await page.getByLabel("The card's button opens").selectOption({ label: "Deep cleaning" });
    await expect(page.getByText("Save first, then you can upload a photo.")).toBeVisible();
    await page.getByRole("button", { name: "Save category" }).first().click();
    await expect(page.getByText("Category created")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/categories\/\d+$/);
    await page.reload(); // drop the hidden "new category" page Next.js keeps mounted

    // Upload a photo; 1408px is below the "sharp" threshold so we get a warning.
    await page.getByLabel("Photo file").setInputFiles(PHOTO);
    await expect(page.getByText("Photo uploaded")).toBeVisible();
    await expect(shown(page.getByText(/1408px wide and may look soft/))).toBeVisible();

    const visitor = await browser.newPage();
    await visitor.goto("/");
    const card = visitor.getByRole("link", { name: new RegExp(name) });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/book?service=deep-cleaning");
    await expect(card.locator("img")).toHaveAttribute("src", /^\/media\/uploads\/categories\/.+\.webp$/);
    // The browser picks a version from the srcset and it loads.
    const loaded = await card.locator("img").evaluate((el: HTMLImageElement) => el.decode().then(() => el.currentSrc));
    expect(loaded).toMatch(/\/media\/uploads\/categories\/[0-9a-f]+(-card)?\.webp$/);

    // Hiding it takes it off the homepage.
    await page.getByRole("switch", { name: "Show on the homepage" }).click();
    await page.getByRole("button", { name: "Save category" }).first().click();
    await expect(page.getByText("Category saved")).toBeVisible();
    await visitor.reload();
    await expect(visitor.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
    await visitor.close();
  });

  test("an uploaded service photo replaces the starter photo on the website", async ({ page, browser }) => {
    const move = await serviceBySlug(page, "move-in-move-out");
    try {
      await page.goto(`/admin/services/${move.id}`);
      await expect(page.getByText("Showing the starter photo")).toBeVisible();
      await page.getByLabel("Photo file").setInputFiles(PHOTO);
      await expect(page.getByText("Photo uploaded")).toBeVisible();

      const visitor = await browser.newPage();
      await visitor.goto("/pricing");
      const card = visitor.locator("article", { hasText: "Move-in / move-out cleaning" });
      await expect(card.locator("img")).toHaveAttribute("srcset", /-card\.webp 960w, .+\.webp 2000w/);
      await visitor.close();
    } finally {
      await page.request.fetch(`/api/admin/services/${move.id}/photo/`, {
        method: "DELETE",
        headers: { "X-CSRFToken": (await page.context().cookies()).find((c) => c.name === "csrftoken")!.value },
      });
    }
  });

  test("the price tester shows the customer's exact price", async ({ page }) => {
    const standard = await serviceBySlug(page, "standard-cleaning");
    await page.goto(`/admin/services/${standard.id}`);
    const result = page.getByTestId("price-test-result");
    // Placeholder rates: 15,000 + 3 rooms × 5,000 + 4,000 + 4,000 = 38,000 + 7.5% VAT
    await expect(result).toContainText("Customer pays₦40,850");
    await page.getByRole("button", { name: "Test more Rooms / work areas" }).click();
    await expect(result).toContainText("Customer pays₦46,225");
    await page.getByLabel("Test frequency").selectOption({ label: "Weekly" });
    await expect(result).toContainText("× 4 visits");
    await expect(result).toContainText("Frequency discount");
  });

  test("a service-specific area surcharge shows in the tester and the booking calculator", async ({ page, browser }) => {
    const standard = await serviceBySlug(page, "standard-cleaning");
    try {
      await page.goto(`/admin/services/${standard.id}?tab=booking`);
      await page.getByLabel("Surcharge for Ajah").fill("7000");
      await page.getByRole("button", { name: "Save service" }).first().click();
      await expect(page.getByText("Service saved")).toBeVisible();
      await page.getByLabel("Test area").selectOption({ label: "Ajah" });
      await expect(page.getByTestId("price-test-result")).toContainText("Area surcharge₦7,000");

      const visitor = await browser.newPage();
      await visitor.goto("/book?service=standard-cleaning");
      await visitor.getByLabel("Area in Lagos").selectOption({ label: "Ajah" });
      await expect(visible(visitor, "aside")).toContainText("Travel (Ajah)₦7,000");
      await visitor.close();
    } finally {
      await adminApi(page, "PATCH", `services/${standard.id}/`, { area_prices: [] });
    }
  });

  test("a deposit lets customers pay part now and the rest on completion", async ({ page, browser }) => {
    const deep = await serviceBySlug(page, "deep-cleaning");
    try {
      await page.goto(`/admin/services/${deep.id}?tab=booking`);
      await page.getByLabel("Deposit to confirm (%)", { exact: true }).fill("30");
      await page.getByRole("button", { name: "Save service" }).first().click();
      await expect(page.getByText("Service saved")).toBeVisible();
      await expect(page.getByText("30% deposit online, rest on completion")).toBeVisible();

      const customer = await browser.newPage();
      await customer.goto("/book?service=deep-cleaning");
      await customer.getByLabel("Area in Lagos").selectOption({ label: "Ikoyi" });
      const split = customer.getByTestId("deposit-split").filter({ visible: true });
      await expect(split).toContainText("Pay now (30% deposit)");
      const depositText = (await split.locator("span.tabular").first().textContent())!;
      await customer.getByRole("button", { name: "Continue" }).click();
      await customer.getByLabel("Contact name").fill(unique("Deposit Payer"));
      await customer.getByLabel("Phone (WhatsApp)").fill("08030000000");
      await customer.getByLabel("Email for your receipt").fill("deposit@e2e.kleandeck.test");
      await customer.getByLabel("Address of the space").fill("1 Bourdillon Road");
      await customer.getByRole("checkbox", { name: /Running water and electricity/ }).check();
      await customer.getByRole("checkbox", { name: /I agree to Kleandeck/ }).check();
      await customer.getByRole("button", { name: `Pay ${depositText} deposit with Paystack` }).click();

      await expect(customer).toHaveURL(new RegExp(`^${FAKE_PAYSTACK}/checkout/`));
      await expect(customer.getByTestId("amount")).toHaveText(depositText);
      await customer.locator("#pay").click();
      await expect(customer.getByRole("heading", { name: /You're booked/ })).toBeVisible();
      await expect(customer.getByText(`We've received your ${depositText} deposit.`, { exact: false })).toBeVisible();
      await expect(customer.getByText(/The balance of ₦[\d,]+ is due on completion/)).toBeVisible();
      await customer.close();
    } finally {
      await adminApi(page, "PATCH", `services/${deep.id}/`, { deposit_percent: 0 });
    }
  });

  test("time slots and earliest booking can be set per service", async ({ page, browser }) => {
    const deep = await serviceBySlug(page, "deep-cleaning");
    const slotName = unique("Early bird");
    try {
      await page.goto("/admin/settings?tab=time-slots");
      await page.getByPlaceholder("New time slot, e.g. Early morning").fill(slotName);
      await page.getByLabel("Hours").last().fill("6am – 8am");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Time slot added")).toBeVisible();

      await page.goto(`/admin/services/${deep.id}?tab=booking`);
      const booking = page.locator("section", { hasText: "Arrival times" });
      await booking.getByText(slotName).click();
      await page.getByLabel("Earliest booking", { exact: true }).fill("5");
      await page.getByRole("button", { name: "Save service" }).first().click();
      await expect(page.getByText("Service saved")).toBeVisible();

      const customer = await browser.newPage();
      await customer.goto("/book?service=deep-cleaning");
      await customer.getByLabel("Area in Lagos").selectOption({ label: "Ikoyi" });
      await customer.getByRole("button", { name: "Continue" }).click();
      const radios = customer.getByRole("radio");
      await expect(radios).toHaveCount(1);
      await expect(customer.getByText(slotName)).toBeVisible();
      const min = await customer.getByLabel("Date").getAttribute("min");
      const days = Math.round((Date.parse(min!) - Date.parse(new Date().toISOString().slice(0, 10))) / 86_400_000);
      expect(days).toBeGreaterThanOrEqual(5);
      await customer.close();
    } finally {
      await adminApi(page, "PATCH", `services/${deep.id}/`, { time_slots: [], min_lead_days: null });
    }
  });

  test("duplicating a service creates a hidden draft to edit", async ({ page }) => {
    const standard = await serviceBySlug(page, "standard-cleaning");
    await page.goto(`/admin/services/${standard.id}`);
    await page.getByRole("button", { name: "Duplicate" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Standard cleaning \(copy\)/ })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Show on the website" })).toHaveAttribute("aria-checked", "false");
    await page.getByRole("tab", { name: /Pricing/ }).click();
    await expect(page.getByLabel("Label", { exact: true }).filter({ visible: true })).toHaveCount(3);

    // Clean up the draft.
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/admin\/services$/);
  });
});
