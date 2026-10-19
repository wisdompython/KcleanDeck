import { expect, test } from "@playwright/test";

import { OWNER, unique } from "./helpers";

test.describe("Careers and academy", () => {
  test("a job applicant is hired onto the cleaner roster", async ({ page, browser }) => {
    const applicant = unique("Chika Applicant");
    await page.goto("/careers");
    await page.getByLabel("Full name").fill(applicant);
    await page.getByLabel("Phone (WhatsApp)").fill("08066667777");
    await page.getByLabel("Where in Lagos do you live?").fill("Yaba");
    await page.getByLabel("Role").selectOption("Cleaner");
    await page.getByLabel("Cleaning experience").selectOption("1–3 years");
    await page.getByRole("button", { name: "Send application" }).click();
    await expect(page.getByRole("heading", { name: /we've received it/ })).toBeVisible();

    const admin = await browser.newPage({ storageState: OWNER.storageState });
    await admin.goto("/admin/applications?kind=job&status=new");
    const card = admin.locator("article", { hasText: applicant });
    await expect(card).toContainText("Cleaner · Yaba · 1–3 years");
    await card.getByRole("button", { name: "Add to cleaners" }).click();
    await expect(admin.getByText(`${applicant} added to cleaners`)).toBeVisible();

    await admin.goto("/admin/cleaners");
    await expect(admin.locator("article", { hasText: applicant })).toBeVisible();
    await admin.close();
  });

  test("an academy enquiry reaches the admin", async ({ page, browser }) => {
    const name = unique("Academy Hopeful");
    await page.goto("/academy");
    await expect(page.getByLabel("Role")).toHaveCount(0); // academy form has no role
    await page.getByLabel("Full name").fill(name);
    await page.getByLabel("Phone (WhatsApp)").fill("08090901010");
    await page.getByLabel(/What would you like to know/).fill("When does the next class start?");
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByRole("heading", { name: /we've received it/ })).toBeVisible();

    const admin = await browser.newPage({ storageState: OWNER.storageState });
    await admin.goto("/admin/applications?kind=academy");
    const card = admin.locator("article", { hasText: name });
    await expect(card).toContainText("Academy");
    await expect(card).toContainText("When does the next class start?");
    await card.getByLabel("Status").selectOption("contacted");
    await expect(admin.getByText("Application updated")).toBeVisible();
    await admin.close();
  });

  test("application form requires a name and phone", async ({ page }) => {
    await page.goto("/careers");
    await page.getByRole("button", { name: "Send application" }).click();
    expect(await page.getByLabel("Full name").evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
    await expect(page.getByRole("heading", { name: /we've received it/ })).toHaveCount(0);
  });
});
