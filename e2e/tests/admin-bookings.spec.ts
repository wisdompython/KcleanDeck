import { expect, type Page, test } from "@playwright/test";

import { adminApi, FAKE_PAYSTACK, openBookingStep, OWNER, unique } from "./helpers";

// Admin pages navigate client-side, and Next.js keeps the previous page mounted
// but hidden. Role queries skip hidden elements; text/label queries use `shown`.
const shown = (locator: import("@playwright/test").Locator) => locator.filter({ visible: true }).first();

test.use({ storageState: OWNER.storageState });

const dialog = (page: Page) => page.getByRole("dialog");

async function newAgreedPriceBooking(page: Page, customer: string, price: string, { email = "" } = {}) {
  await page.goto("/admin/bookings/new");
  await page.getByLabel("Company (optional)").fill(customer);
  await page.getByLabel("Contact name").fill("Tunde Adeleke");
  await page.getByLabel("Phone (WhatsApp)").fill("08023456789");
  if (email) await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Area", { exact: true }).selectOption({ label: "Victoria Island" });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: /Facility support/ }).click();
  await openBookingStep(page, "Review & billing");
  await page.getByLabel("Agreed price before VAT (₦)").fill(price);
}

test.describe("Admin bookings", () => {
  test("a deal agreed on WhatsApp is entered with VAT, paid in parts and completed", async ({ page }) => {
    const cleaner = unique("Bisi Cleaner");
    await adminApi(page, "POST", "cleaners/", { full_name: cleaner, phone: "08031112222", role: "Supervisor" });
    const customer = unique("Agreed Deal Co");

    await newAgreedPriceBooking(page, customer, "200000");
    // 200,000 + 7.5% VAT
    await expect(page.getByText("₦215,000")).toBeVisible();
    await page.getByRole("button", { name: "Create booking" }).click();

    await expect(page).toHaveURL(/\/admin\/bookings\/KD-[A-Z0-9]+$/);
    await expect(page.getByRole("heading", { level: 1, name: customer })).toBeVisible();
    await expect(page.getByText("Entered by staff")).toBeVisible();
    await expect(page.getByText("Balance due")).toBeVisible();

    // Assign the team.
    await page.getByRole("button", { name: "Assign" }).click();
    await dialog(page).getByRole("checkbox", { name: new RegExp(cleaner) }).check();
    await dialog(page).getByRole("button", { name: "Save team" }).click();
    await expect(page.getByText("Team updated")).toBeVisible();
    await expect(shown(page.getByText(cleaner, { exact: true }))).toBeVisible();

    // Part payment by transfer, then the rest in cash.
    await page.getByRole("button", { name: "Record transfer or cash" }).click();
    await dialog(page).getByLabel("Amount (₦)").fill("100000");
    await dialog(page).getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("Payment recorded")).toBeVisible();
    await expect(shown(page.getByText("₦115,000"))).toBeVisible(); // balance due

    await page.getByRole("button", { name: "Record transfer or cash" }).click();
    await dialog(page).getByLabel("Method").selectOption("cash");
    await dialog(page).getByRole("button", { name: "Record payment" }).click();
    await expect(shown(page.getByText("Fully paid"))).toBeVisible();
    await expect(shown(page.getByText("Confirmed", { exact: true }))).toBeVisible();
    await expect(page.getByText("Received", { exact: true }).filter({ visible: true })).toHaveCount(2);

    // Run the job.
    await page.getByRole("button", { name: "Start job" }).click();
    await expect(shown(page.getByText("In progress", { exact: true }))).toBeVisible();
    await page.getByRole("button", { name: "Mark completed" }).click();
    await expect(shown(page.getByText("Completed", { exact: true }))).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel booking" })).toHaveCount(0);
  });

  test("rate-card pricing matches the website calculator", async ({ page }) => {
    await page.goto("/admin/bookings/new");
    await page.getByLabel("Contact name").fill(unique("Rate Card"));
    await page.getByLabel("Phone (WhatsApp)").fill("08000000001");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: /Post-construction cleaning/ }).click();
    await page.getByLabel("Floor area (m²)").fill("100");
    await openBookingStep(page, "Review & billing");
    // Placeholder rates: (20,000 + 100 m² × 1,500) = 170,000 + 7.5% VAT = 182,750
    await expect(page.getByText("₦182,750")).toBeVisible();
    await page.getByRole("button", { name: "Create booking" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(shown(page.getByText("Rate card", { exact: true }))).toBeVisible();
    await expect(shown(page.getByText("₦182,750"))).toBeVisible();
  });

  test("a Paystack link from the admin is paid by the customer", async ({ page, browser }) => {
    const customer = unique("Link Payer");
    await newAgreedPriceBooking(page, customer, "50000", { email: "payer@e2e.kleandeck.test" });
    await page.getByRole("button", { name: "Create booking" }).click();
    await expect(page.getByRole("heading", { level: 1, name: customer })).toBeVisible();

    await page.getByRole("button", { name: "Create Paystack link" }).click();
    await expect(page.getByText("Paystack link created")).toBeVisible();
    const link = await shown(page.getByText(new RegExp(`^${FAKE_PAYSTACK}/checkout/KD-`))).textContent();
    const send = page.getByRole("link", { name: "Send" });
    await expect(send).toHaveAttribute("href", /^https:\/\/wa\.me\/2348023456789\?text=/);

    // Customer opens the link on their phone and pays.
    const customerPage = await browser.newPage();
    await customerPage.goto(link!);
    await expect(customerPage.getByTestId("amount")).toHaveText("₦53,750");
    await customerPage.locator("#pay").click();
    await expect(customerPage.getByRole("heading", { name: /You're booked/ })).toBeVisible();
    await customerPage.close();

    await page.reload();
    await expect(shown(page.getByText("Fully paid"))).toBeVisible();
    await expect(shown(page.getByText("Paid", { exact: true }))).toBeVisible();
  });

  test("a payment link needs the customer's email", async ({ page }) => {
    await newAgreedPriceBooking(page, unique("No Email"), "10000");
    await page.getByRole("button", { name: "Create booking" }).click();
    await expect(shown(page.getByText("Add the customer's email to create a Paystack link."))).toBeVisible();
    await page.getByRole("button", { name: "Create Paystack link" }).click();
    await expect(page.getByText(/needs the customer's email/)).toBeVisible();
  });

  test("bookings can be edited, cancelled, and found with search and filters", async ({ page }) => {
    const customer = unique("Findable Ltd");
    await newAgreedPriceBooking(page, customer, "80000");
    await page.getByRole("button", { name: "Create booking" }).click();
    await expect(page.getByRole("heading", { level: 1, name: customer })).toBeVisible();
    const reference = page.url().split("/").pop()!;

    // Edit the agreed price and make it VAT exempt.
    await page.getByRole("link", { name: "Edit" }).click();
    await openBookingStep(page, "Review & billing");
    await shown(page.getByLabel("Agreed price before VAT (₦)")).fill("90000");
    await page.getByRole("checkbox", { name: "VAT exempt" }).check();
    await page.getByRole("button", { name: "Save changes" }).first().click();
    await expect(page.getByText("Booking updated")).toBeVisible();
    await expect(shown(page.getByText("VAT (exempt)"))).toBeVisible();
    await expect(shown(page.getByText("₦90,000"))).toBeVisible();

    // Cancel it.
    await page.getByRole("button", { name: "Cancel booking" }).click();
    await dialog(page).getByRole("button", { name: "Cancel booking" }).click();
    await expect(page.getByText("Booking cancelled")).toBeVisible();

    // Search and the Cancelled tab both find it.
    await page.goto("/admin/bookings");
    await page.getByPlaceholder(/Search name, phone, reference/).fill(reference);
    await expect(page).toHaveURL(new RegExp(`q=${reference}`));
    const row = page.getByRole("row", { name: new RegExp(customer) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Cancelled");

    await page.goto("/admin/bookings?status=cancelled");
    await expect(page.getByRole("row", { name: new RegExp(customer) })).toBeVisible();
    await page.goto("/admin/bookings?status=quote_requested");
    await expect(page.getByRole("row", { name: new RegExp(customer) })).toHaveCount(0);
  });

  test("dashboard flags upcoming jobs with no team", async ({ page }) => {
    const customer = unique("Unassigned Job");
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await adminApi(page, "POST", "bookings/", {
      service: "facility-support",
      company_name: customer,
      contact_name: "Ngozi",
      phone: "08077778888",
      pricing_mode: "manual",
      subtotal: 40000,
      status: "confirmed",
      scheduled_date: tomorrow,
      time_slot: "morning",
    });
    await page.goto("/admin");
    const card = page.locator("article", { hasText: customer });
    await expect(card).toBeVisible();
    await expect(card).toContainText("No team assigned");
    await expect(card).toContainText("Tomorrow");
    await expect(card.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /wa\.me\/2348077778888/);
    await card.getByRole("link", { name: "Assign team" }).click();
    await expect(page.getByRole("heading", { level: 1, name: customer })).toBeVisible();
  });
});
