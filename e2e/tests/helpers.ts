import { expect, type Page } from "@playwright/test";

export const OWNER = {
  email: "owner@e2e.kleandeck.test",
  password: "E2e-owner-pass-1",
  storageState: ".auth/owner.json",
};

export const FAKE_PAYSTACK = process.env.E2E_FAKE_PAYSTACK_URL ?? "http://localhost:8099";

/** A short unique suffix so tests never collide with data from earlier runs. */
export function unique(prefix: string) {
  return `${prefix} ${Date.now().toString(36).slice(-5)}`;
}

/** Parse "₦12,345" into 12345. */
export function nairaValue(text: string | null): number {
  return Number((text ?? "").replace(/[^\d]/g, ""));
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
}

export async function openBookingStep(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Booking steps" }).getByRole("button", { name }).click();
}

/**
 * Call the admin API with the page's signed-in session (for test setup and
 * assertions; the behaviour under test always goes through the UI).
 */
export async function adminApi<T = unknown>(page: Page, method: string, path: string, data?: unknown): Promise<T> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === "csrftoken")?.value ?? "";
  const res = await page.request.fetch(`/api/admin/${path.replace(/^\//, "")}`, {
    method,
    data,
    headers: { "X-CSRFToken": csrf, Referer: page.url() || "http://localhost" },
  });
  expect(res.ok(), `${method} ${path} -> ${res.status()} ${await res.text()}`).toBeTruthy();
  return (res.status() === 204 ? undefined : await res.json()) as T;
}

/**
 * The visible copy of something that exists more than once in the DOM: the
 * booking summary is rendered for mobile and desktop, and Next.js keeps pages
 * you navigated away from mounted but hidden (so "back" is instant).
 */
export function visible(page: Page, selector: string) {
  return page.locator(selector).filter({ visible: true }).first();
}
