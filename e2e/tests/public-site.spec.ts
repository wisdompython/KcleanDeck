import { expect, test } from "@playwright/test";

test.describe("Public site", () => {
  test("homepage leads with the B2B promise, audiences, services and FAQs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Reliable cleaning and facility support for growing businesses." })).toBeVisible();

    for (const audience of ["Interior design partners", "Gyms and active facilities", "Offices needing a reset", "Startups and small businesses"]) {
      await expect(page.getByRole("heading", { name: audience })).toBeVisible();
    }

    await expect(page.getByRole("heading", { name: "The service ends with a clearer record." })).toBeVisible();
    await expect(page.getByText("Quality check included")).toBeVisible();
    await expect(page.locator("ol").filter({ hasText: "Choose & price" }).getByRole("listitem")).toHaveCount(3);

    const services = page.locator("#services article");
    await expect(services).toHaveCount(5);
    await expect(services.filter({ hasText: "Standard cleaning" })).toContainText(/From ₦[\d,]+ per visit \+ VAT/);
    await expect(services.filter({ hasText: "Facility support" })).toContainText("Custom quote");
    await expect(page.getByRole("link", { name: "See your price" })).toHaveCount(4);
    await expect(page.getByRole("link", { name: "Request a quote" })).toHaveCount(1);
    await expect(page.locator("#faq").getByRole("button").first()).toBeVisible();
  });

  test("header keeps booking primary and WhatsApp as a floating icon", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Book a service" })).toBeVisible();
    await expect(header.getByRole("link", { name: /WhatsApp/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Chat with Kleandeck on WhatsApp" })).toBeVisible();
  });

  test("homepage cleaning comparison works with a keyboard and identifies the areas", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Office & restroom areas")).toBeVisible();
    const comparison = page.getByRole("slider", { name: "Reveal the cleaned office and restroom areas" });
    await comparison.focus();
    await comparison.press("Home");
    await expect(comparison).toHaveValue("0");
    await expect(comparison).toHaveAttribute("aria-valuetext", "100% of the clean scene revealed");
    await comparison.press("End");
    await expect(comparison).toHaveValue("100");
    await expect(comparison).toHaveAttribute("aria-valuetext", "0% of the clean scene revealed");
    await expect(page.getByText("AI-assisted illustration, not a client project.")).toBeVisible();
  });

  test("FAQ answers are on the homepage and the legacy route redirects", async ({ page }) => {
    await page.goto("/faq");
    await expect(page).toHaveURL(/\/#faq$/);
    const question = page.getByRole("button", { name: "What do I need to provide on site?" });
    const answer = page.getByText("Running water and electricity (mains or generator) for the whole job");

    await expect(question).toHaveAttribute("aria-expanded", "false");
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "true");
    await expect(answer).toBeVisible();
  });

  test("header navigation reaches the core public pages", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });

    await nav.getByRole("link", { name: "Pricing" }).click();
    await expect(page.getByRole("heading", { name: "Clear starting prices for core cleaning services" })).toBeVisible();

    await page.goto("/");
    await nav.getByRole("link", { name: "About us" }).click();
    await expect(page.getByRole("heading", { name: "The practical partner behind a space that works." })).toBeVisible();

    await page.goto("/");
    await nav.getByText("Join Kleandeck").click();
    await nav.getByRole("link", { name: "Careers" }).click();
    await expect(page.getByRole("heading", { name: "Work with Kleandeck" })).toBeVisible();

    await page.goto("/");
    await nav.getByText("Join Kleandeck").click();
    await nav.getByRole("link", { name: "Academy" }).click();
    await expect(page.getByRole("heading", { name: "Screened, trained and ready for professional work" })).toBeVisible();
  });

  test("pricing page lists every service and explains estimate scope", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("article")).toHaveCount(5);
    const table = page.getByRole("table");
    await expect(table.getByRole("row", { name: /Weekly/ })).toContainText("10% off");
    await expect(page.getByText(/7\.5% VAT/)).toBeVisible();
    await expect(page.getByText("What the calculator covers:")).toBeVisible();
    await expect(page.getByText(/water tanker/)).toBeVisible();
  });

  test("terms explain site requirements and the confirmed no-show exception", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms and conditions", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "3. Site requirements" })).toBeVisible();
    await expect(page.getByText(/running water and electricity/i).first()).toBeVisible();
    await expect(page.getByText(/non-refundable once a booking is confirmed/i)).toBeVisible();
    await expect(page.getByText(/does not attend at the agreed date and time/i)).toBeVisible();
  });

  test("unknown pages show a friendly 404", async ({ page }) => {
    const res = await page.goto("/does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
    await page.getByRole("link", { name: "Book a service" }).last().click();
    await expect(page).toHaveURL(/\/book$/);
  });

  test("admin pages are hidden from search engines", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
