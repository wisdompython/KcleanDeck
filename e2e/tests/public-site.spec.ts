import { expect, test } from "@playwright/test";

test.describe("Public site", () => {
  test("homepage shows use cases, five services with live prices, and the FAQ", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Clean starts here." })).toBeVisible();

    for (const useCase of ["Corporate offices", "Shortlets & hospitality", "Real estate", "Interior decor"]) {
      await expect(page.getByRole("heading", { name: useCase })).toBeVisible();
    }

    const services = page.locator("#services article");
    await expect(services).toHaveCount(5);
    await expect(services.filter({ hasText: "Standard cleaning" })).toContainText(/From ₦[\d,]+ per visit \+ VAT/);
    await expect(services.filter({ hasText: "Facility support" })).toContainText("Custom quote");
    await expect(page.getByRole("link", { name: "See your price" })).toHaveCount(4);
    await expect(page.getByRole("link", { name: "Request a quote" })).toHaveCount(1);
  });

  test("homepage cleaning comparison works with a keyboard and points customers to booking", async ({ page }) => {
    await page.goto("/");
    const comparison = page.getByRole("slider", { name: "Reveal the clean space" });
    await comparison.focus();
    await comparison.press("Home");
    await expect(comparison).toHaveValue("0");
    await expect(comparison).toHaveAttribute("aria-valuetext", "100% of the clean scene revealed");
    await comparison.press("End");
    await expect(comparison).toHaveValue("100");
    await expect(comparison).toHaveAttribute("aria-valuetext", "0% of the clean scene revealed");
    await expect(page.getByText("AI-assisted illustration, not a client project.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Find your clean" })).toHaveAttribute("href", /^\/book(?:\?service=.+)?$/);
  });

  test("homepage space finder changes its booking link and photo with the selected space", async ({ page }) => {
    const response = await page.request.get("/api/categories/");
    expect(response.ok()).toBeTruthy();
    const categories: { name: string; service: string | null }[] = await response.json();
    await page.goto("/");

    for (const category of categories) {
      const choice = page.getByRole("radio", { name: category.name });
      await choice.check();
      await expect(choice).toBeChecked();
      const href = category.service ? `/book?service=${encodeURIComponent(category.service)}` : "/book";
      await expect(page.getByRole("link", { name: "Find your clean" })).toHaveAttribute("href", href);
      await expect(page.getByRole("img", { name: `Cleaning for ${category.name.toLowerCase()}` })).toBeVisible();
    }
    await page.getByRole("radio").first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio").nth(1)).toBeChecked();
  });

  test("FAQ answers open and close", async ({ page }) => {
    await page.goto("/faq");
    const question = page.getByRole("button", { name: "What do I need to provide on site?" });
    const answer = page.getByText("Running water and electricity (mains or generator) for the whole job");

    await expect(question).toHaveAttribute("aria-expanded", "false");
    await expect(answer).toBeHidden();
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "true");
    await expect(answer).toBeVisible();
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "false");
    await expect(answer).toBeHidden();
  });

  test("header navigation reaches every public page", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    const pages: [string, RegExp | string][] = [
      ["Pricing", "Clear prices for Lagos workspaces"],
      ["FAQ", "Frequently asked questions"],
      ["Careers", "Work with Kleandeck"],
      ["Academy", "Two weeks to professional cleaning"],
    ];
    for (const [link, heading] of pages) {
      await nav.getByRole("link", { name: link }).click();
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("pricing page lists every service and the frequency discounts", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("article")).toHaveCount(5);
    const table = page.getByRole("table");
    await expect(table.getByRole("row", { name: /Weekly/ })).toContainText("10% off");
    await expect(table.getByRole("row", { name: /Weekly/ })).toContainText("4 visits per payment");
    await expect(page.getByText(/7\.5% VAT/)).toBeVisible();
  });

  test("terms page explains the water and electricity requirement", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms and conditions", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "3. Site requirements" })).toBeVisible();
    await expect(page.getByText(/running water and electricity/i).first()).toBeVisible();
  });

  test("unknown pages show a friendly 404", async ({ page }) => {
    const res = await page.goto("/does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
    await page.getByRole("link", { name: "Book a clean" }).last().click();
    await expect(page).toHaveURL(/\/book$/);
  });

  test("admin pages are hidden from search engines", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
