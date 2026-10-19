import { expect, test } from "@playwright/test";

import { OWNER, signIn } from "./helpers";

test.describe("Admin sign-in", () => {
  test("signed-out visitors are sent to the login page and back afterwards", async ({ page }) => {
    await page.goto("/admin/bookings?status=quote_requested");
    await expect(page).toHaveURL(/\/admin\/login\?next=/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(OWNER.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/admin\/bookings\?status=quote_requested$/);
    await expect(page.getByRole("button", { name: "Quote requests" })).toBeVisible();
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    // (Next.js also renders an empty role="alert" route announcer, so scope to the form.)
    await expect(page.locator("form").getByRole("alert")).toHaveText("Email or password is incorrect.");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("owners can also sign in with their username", async ({ page }) => {
    await signIn(page, "owner", OWNER.password);
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
  });

  test("signing out ends the session", async ({ page }) => {
    await signIn(page, OWNER.email, OWNER.password);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("the backup Django admin is not the team admin", async ({ page }) => {
    await page.goto("/backstage/");
    await expect(page).toHaveURL(/\/backstage\/login\//);
    await expect(page.getByRole("link", { name: /Kleandeck/ }).first()).toBeVisible();
  });
});
