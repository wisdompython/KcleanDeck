import { expect, test as setup } from "@playwright/test";

import { FAKE_PAYSTACK, OWNER, signIn } from "./helpers";

setup("stack is up", async ({ request }) => {
  await expect
    .poll(async () => (await request.get("/healthz").catch(() => null))?.status(), {
      message: "Start the e2e stack first: npm run stack:up",
      timeout: 60_000,
    })
    .toBe(200);
  expect((await request.get(`${FAKE_PAYSTACK}/health`)).ok()).toBeTruthy();
});

setup("sign in as owner", async ({ page }) => {
  await signIn(page, OWNER.email, OWNER.password);
  await page.context().storageState({ path: OWNER.storageState });
});
