import { expect, type Page, test } from "@playwright/test";

import { adminApi, FAKE_PAYSTACK, nairaValue, OWNER, unique, visible } from "./helpers";

async function total(page: Page) {
  const el = visible(page, '[data-testid="summary-total"]');
  await expect(el).toHaveText(/₦[\d,]+/);
  return nairaValue(await el.textContent());
}

/** Waits until the live price has stopped changing (the calculator is debounced). */
async function settledTotal(page: Page) {
  let last = -1;
  await expect
    .poll(async () => {
      const now = await total(page);
      const stable = now === last;
      last = now;
      return stable;
    }, { intervals: [600, 600, 600, 1000] })
    .toBe(true);
  return last;
}

/** Waits until the live price settles on a new value. */
async function totalChangesFrom(page: Page, before: number) {
  await expect.poll(() => total(page)).not.toBe(before);
  return total(page);
}

async function chooseArea(page: Page, area = "Victoria Island") {
  await page.getByLabel("Area in Lagos").selectOption({ label: area });
}

async function fillCustomerDetails(page: Page, name: string) {
  await page.getByLabel("Contact name").fill(name);
  await page.getByLabel("Company (optional)").fill(`${name} Ltd`);
  await page.getByLabel("Phone (WhatsApp)").fill("08031234567");
  await page.getByLabel("Email for your receipt").fill("customer@e2e.kleandeck.test");
  await page.getByLabel("Address of the space").fill("12 Adeola Odeku Street, 3rd floor");
}

test.describe("Booking calculator", () => {
  test("price responds to rooms, frequency and add-ons", async ({ page }) => {
    await page.goto("/book?service=deep-cleaning");
    await expect(page.getByRole("button", { name: /Deep cleaning/ })).toHaveAttribute("aria-pressed", "true");

    const start = await total(page);
    await page.getByRole("button", { name: "More Rooms / work areas" }).click();
    const moreRooms = await totalChangesFrom(page, start);
    expect(moreRooms).toBeGreaterThan(start);

    await page.getByRole("checkbox", { name: /Interior windows/ }).check();
    const withAddon = await totalChangesFrom(page, moreRooms);
    expect(withAddon).toBeGreaterThan(moreRooms);

    await page.getByRole("button", { name: /^Monthly/ }).click();
    await expect(visible(page, "aside")).toContainText("Monthly");
  });

  test("weekly cleaning shows the discount and bills four visits", async ({ page }) => {
    await page.goto("/book?service=standard-cleaning");
    await page.getByRole("button", { name: /^Weekly/ }).click();
    const summary = visible(page, "aside");
    await expect(summary).toContainText("Weekly discount");
    await expect(summary).toContainText(/per visit × 4 visits/);
    await expect(summary).toContainText("Covers 4 visits");
  });

  test("continue is blocked until an area is chosen", async ({ page }) => {
    await page.goto("/book?service=standard-cleaning");
    const next = page.getByRole("button", { name: "Continue" });
    await expect(next).toBeDisabled();
    await expect(page.getByText("Choose your area to continue.")).toBeVisible();
    await chooseArea(page);
    await expect(next).toBeEnabled();
  });

  test("large post-construction jobs are sent to WhatsApp instead of checkout", async ({ page }) => {
    await page.goto("/book?service=post-construction-cleaning");
    await page.getByLabel("Floor area (m²)").fill("900");
    await expect(visible(page, "aside")).toContainText("Estimated total");
    await expect(visible(page, "aside")).toContainText("we'll confirm the price with you on WhatsApp");
    await expect(page.getByRole("button", { name: "Continue to a WhatsApp quote" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toHaveCount(0);
  });
});

test.describe("Sharing a price", () => {
  test("a forwarded link reopens the exact calculation", async ({ page, browser }) => {
    await page.goto("/book?service=deep-cleaning");
    await page.getByRole("button", { name: "More Rooms / work areas" }).click();
    await page.getByRole("checkbox", { name: /Interior windows/ }).check();
    await page.getByRole("button", { name: /^Monthly/ }).click();
    await chooseArea(page, "Ikoyi");
    await expect(page).toHaveURL(/freq=\d+/);
    await expect(page).toHaveURL(/area=\d+/);
    await expect(page).toHaveURL(/rooms=\d+-4/);
    await expect(page).toHaveURL(/extras=\d+/);
    const expected = await settledTotal(page);
    const link = page.url();

    // Someone else opens the forwarded link: same choices, same live price.
    const boss = await browser.newPage();
    await boss.goto(link);
    await expect(boss.getByRole("button", { name: /^Monthly/ })).toHaveAttribute("aria-pressed", "true");
    await expect(boss.getByRole("checkbox", { name: /Interior windows/ })).toBeChecked();
    await expect(boss.getByLabel("Area in Lagos")).toHaveValue(/\d+/);
    await expect(visible(boss, '[data-testid="summary-total"]')).toHaveText(`₦${expected.toLocaleString("en-NG")}`);
    await boss.close();
  });

  test("Share on WhatsApp sends the price and the link", async ({ page, context }) => {
    let shared = "";
    await context.route("https://wa.me/**", (route) => {
      shared = route.request().url();
      return route.fulfill({ body: "WhatsApp" });
    });
    await page.goto("/book?service=standard-cleaning");
    await chooseArea(page, "Yaba");
    const expected = await settledTotal(page);
    const popup = page.waitForEvent("popup");
    await visible(page, "aside").getByRole("button", { name: "Share on WhatsApp" }).click();
    await (await popup).close();

    const text = new URL(shared).searchParams.get("text") ?? "";
    expect(text).toContain(`Kleandeck price for Standard cleaning: ₦${expected.toLocaleString("en-NG")} including VAT`);
    expect(text).toContain("Yaba");
    expect(text).toMatch(/See the breakdown or book: http:\/\/localhost:8089\/book\?service=standard-cleaning&area=\d+/);
  });

  test("bad or out-of-date links still open a working calculator", async ({ page }) => {
    await page.goto("/book?service=deep-cleaning&freq=999&area=abc&rooms=999-3.x-y&extras=999&sqm=-5");
    await expect(page.getByRole("button", { name: /Deep cleaning/ })).toHaveAttribute("aria-pressed", "true");
    await expect(visible(page, '[data-testid="summary-total"]')).toHaveText(/₦[\d,]+/);
    await expect(page.getByLabel("Area in Lagos")).toHaveValue("");
  });
});

test.describe("Checkout with Paystack", () => {
  test("customer pays online and the booking is confirmed", async ({ page, browser }) => {
    const name = unique("Ada Checkout");
    await page.goto("/book?service=standard-cleaning");
    await chooseArea(page);
    const expected = await total(page);
    await page.getByRole("button", { name: "Continue" }).click();

    await fillCustomerDetails(page, name);
    // Pick the time the way a customer does: by clicking the visible card.
    await page.getByText("Afternoon", { exact: true }).click();
    await expect(page.getByRole("radio", { name: /Afternoon/ })).toBeChecked();

    // Terms and site requirements are both required.
    const pay = page.getByRole("button", { name: /^Pay ₦[\d,]+ with Paystack$/ });
    await expect(pay).toContainText(`₦${expected.toLocaleString("en-NG")}`);
    await pay.click();
    await expect(page).toHaveURL(/\/book/);
    await page.getByRole("checkbox", { name: /Running water and electricity/ }).check();
    await page.getByRole("checkbox", { name: /I agree to Kleandeck/ }).check();
    await pay.click();

    // Fake Paystack checkout shows the amount the backend calculated.
    await expect(page).toHaveURL(new RegExp(`^${FAKE_PAYSTACK}/checkout/KD-`));
    await expect(page.getByTestId("amount")).toHaveText(`₦${expected.toLocaleString("en-NG")}`);
    await expect(page.getByTestId("email")).toHaveText("customer@e2e.kleandeck.test");
    await page.locator("#pay").click();

    // Back on Kleandeck: verified server-side and confirmed.
    await expect(page).toHaveURL(/\/booking\/confirmation\?/);
    await expect(page.getByRole("heading", { name: /You're booked/ })).toBeVisible();
    await expect(page.getByText(`We've received ₦${expected.toLocaleString("en-NG")}`)).toBeVisible();
    const reference = (await page.locator("dt", { hasText: "Reference" }).locator("+ dd").textContent())!.trim();
    expect(reference).toMatch(/^KD-[A-Z0-9]{7}$/);

    // The team sees it as paid and confirmed.
    const admin = await browser.newPage({ storageState: OWNER.storageState });
    const booking = await adminApi<{ status: string; payment_status: string; total: number; time_slot: string }>(
      admin,
      "GET",
      `bookings/${reference}/`,
    );
    expect(booking).toMatchObject({ status: "confirmed", payment_status: "paid", total: expected, time_slot: "afternoon" });
    await admin.close();
  });

  test("cancelling on Paystack leaves the booking unpaid", async ({ page }) => {
    await page.goto("/book?service=deep-cleaning");
    await chooseArea(page, "Ikeja");
    await page.getByRole("button", { name: "Continue" }).click();
    await fillCustomerDetails(page, unique("Cancel Test"));
    await page.getByRole("checkbox", { name: /Running water and electricity/ }).check();
    await page.getByRole("checkbox", { name: /I agree to Kleandeck/ }).check();
    await page.getByRole("button", { name: /with Paystack/ }).click();

    await expect(page).toHaveURL(new RegExp(`^${FAKE_PAYSTACK}/checkout/`));
    await page.locator("#cancel").click();

    await expect(page.getByRole("heading", { name: "Payment not completed" })).toBeVisible();
    await page.getByRole("link", { name: "Try again" }).click();
    await expect(page).toHaveURL(/\/book$/);
  });

  test("a broken confirmation link is handled", async ({ page }) => {
    await page.goto("/booking/confirmation?reference=KD-NOPE-123");
    await expect(page.getByRole("heading", { name: "We couldn't confirm this payment" })).toBeVisible();
    await expect(page.getByText("Payment not found.")).toBeVisible();
  });
});

test.describe("WhatsApp quote requests", () => {
  test("custom-quote service saves the request and opens WhatsApp prefilled", async ({ page, browser }) => {
    const admin = await browser.newPage({ storageState: OWNER.storageState });
    await adminApi(admin, "PATCH", "settings/", { whatsapp_number: "2348099990000" });

    let whatsappUrl = "";
    await page.route("https://wa.me/**", (route) => {
      whatsappUrl = route.request().url();
      return route.fulfill({ body: "WhatsApp" });
    });

    const name = unique("Quote Seeker");
    await page.goto("/book?service=facility-support");
    await expect(visible(page, "aside")).toContainText("priced per job");
    await page.getByLabel("Area in Lagos").selectOption({ label: "Lekki Phase 1" });
    await page.getByRole("button", { name: "Continue to a WhatsApp quote" }).click();

    await page.getByLabel("Contact name").fill(name);
    await page.getByLabel("Phone (WhatsApp)").fill("08055554444");
    await page.getByLabel("What do you need?").fill("Two office assistants, Monday to Friday");
    await page.getByRole("checkbox", { name: /I agree to Kleandeck/ }).check();
    await page.getByRole("button", { name: "Send on WhatsApp" }).click();

    await expect.poll(() => whatsappUrl).toContain("https://wa.me/2348099990000?text=");
    const text = decodeURIComponent(new URL(whatsappUrl).searchParams.get("text") ?? "");
    expect(text).toContain("Facility support");
    expect(text).toContain(name);
    expect(text).toContain("Two office assistants");
    const reference = text.match(/Ref: (KD-[A-Z0-9]+)/)?.[1];
    expect(reference).toBeTruthy();

    const booking = await adminApi<{ status: string; source: string }>(admin, "GET", `bookings/${reference}/`);
    expect(booking).toMatchObject({ status: "quote_requested", source: "quote" });
    await admin.close();
  });
});
