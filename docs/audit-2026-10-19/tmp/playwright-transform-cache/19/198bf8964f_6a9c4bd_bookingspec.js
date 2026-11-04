// 30573ae335545174f0124584da795c3889ed165e
"use strict";

var _test = require("@playwright/test");
var _helpers = require("./helpers");
async function total(page) {
  const el = (0, _helpers.visible)(page, '[data-testid="summary-total"]');
  await (0, _test.expect)(el).toHaveText(/₦[\d,]+/);
  return (0, _helpers.nairaValue)(await el.textContent());
}

/** Waits until the live price has stopped changing (the calculator is debounced). */
async function settledTotal(page) {
  let last = -1;
  await _test.expect.poll(async () => {
    const now = await total(page);
    const stable = now === last;
    last = now;
    return stable;
  }, {
    intervals: [600, 600, 600, 1000]
  }).toBe(true);
  return last;
}

/** Waits until the live price settles on a new value. */
async function totalChangesFrom(page, before) {
  await _test.expect.poll(() => total(page)).not.toBe(before);
  return total(page);
}
async function chooseArea(page, area = "Victoria Island") {
  await page.getByLabel("Area in Lagos").selectOption({
    label: area
  });
}
async function fillCustomerDetails(page, name) {
  await page.getByLabel("Contact name").fill(name);
  await page.getByLabel("Company (optional)").fill(`${name} Ltd`);
  await page.getByLabel("Phone (WhatsApp)").fill("08031234567");
  await page.getByLabel("Email for your receipt").fill("customer@e2e.kleandeck.test");
  await page.getByLabel("Address of the space").fill("12 Adeola Odeku Street, 3rd floor");
}
_test.test.describe("Booking calculator", () => {
  (0, _test.test)("price responds to rooms, frequency and add-ons", async ({
    page
  }) => {
    await page.goto("/book?service=deep-cleaning");
    await (0, _test.expect)(page.getByRole("button", {
      name: /Deep cleaning/
    })).toHaveAttribute("aria-pressed", "true");
    const start = await total(page);
    await page.getByRole("button", {
      name: "More Rooms / work areas"
    }).click();
    const moreRooms = await totalChangesFrom(page, start);
    (0, _test.expect)(moreRooms).toBeGreaterThan(start);
    await page.getByRole("checkbox", {
      name: /Interior windows/
    }).check();
    const withAddon = await totalChangesFrom(page, moreRooms);
    (0, _test.expect)(withAddon).toBeGreaterThan(moreRooms);
    await page.getByRole("button", {
      name: /^Monthly/
    }).click();
    await (0, _test.expect)((0, _helpers.visible)(page, "aside")).toContainText("Monthly");
  });
  (0, _test.test)("weekly cleaning shows the discount and bills four visits", async ({
    page
  }) => {
    await page.goto("/book?service=standard-cleaning");
    await page.getByRole("button", {
      name: /^Weekly/
    }).click();
    const summary = (0, _helpers.visible)(page, "aside");
    await (0, _test.expect)(summary).toContainText("Weekly discount");
    await (0, _test.expect)(summary).toContainText(/per visit × 4 visits/);
    await (0, _test.expect)(summary).toContainText("Covers 4 visits");
  });
  (0, _test.test)("continue is blocked until an area is chosen", async ({
    page
  }) => {
    await page.goto("/book?service=standard-cleaning");
    const next = page.getByRole("button", {
      name: "Continue"
    });
    await (0, _test.expect)(next).toBeDisabled();
    await (0, _test.expect)(page.getByText("Choose your area to continue.")).toBeVisible();
    await chooseArea(page);
    await (0, _test.expect)(next).toBeEnabled();
  });
  (0, _test.test)("large post-construction jobs are sent to WhatsApp instead of checkout", async ({
    page
  }) => {
    await page.goto("/book?service=post-construction-cleaning");
    await page.getByLabel("Floor area (m²)").fill("900");
    await (0, _test.expect)((0, _helpers.visible)(page, "aside")).toContainText("Estimated total");
    await (0, _test.expect)((0, _helpers.visible)(page, "aside")).toContainText("we'll confirm the price with you on WhatsApp");
    await (0, _test.expect)(page.getByRole("button", {
      name: "Continue to a WhatsApp quote"
    })).toBeVisible();
    await (0, _test.expect)(page.getByRole("button", {
      name: "Continue",
      exact: true
    })).toHaveCount(0);
  });
});
_test.test.describe("Sharing a price", () => {
  (0, _test.test)("a forwarded link reopens the exact calculation", async ({
    page,
    browser
  }) => {
    await page.goto("/book?service=deep-cleaning");
    await page.getByRole("button", {
      name: "More Rooms / work areas"
    }).click();
    await page.getByRole("checkbox", {
      name: /Interior windows/
    }).check();
    await page.getByRole("button", {
      name: /^Monthly/
    }).click();
    await chooseArea(page, "Ikoyi");
    await (0, _test.expect)(page).toHaveURL(/freq=\d+/);
    await (0, _test.expect)(page).toHaveURL(/area=\d+/);
    await (0, _test.expect)(page).toHaveURL(/rooms=\d+-4/);
    await (0, _test.expect)(page).toHaveURL(/extras=\d+/);
    const expected = await settledTotal(page);
    const link = page.url();

    // Someone else opens the forwarded link: same choices, same live price.
    const boss = await browser.newPage();
    await boss.goto(link);
    await (0, _test.expect)(boss.getByRole("button", {
      name: /^Monthly/
    })).toHaveAttribute("aria-pressed", "true");
    await (0, _test.expect)(boss.getByRole("checkbox", {
      name: /Interior windows/
    })).toBeChecked();
    await (0, _test.expect)(boss.getByLabel("Area in Lagos")).toHaveValue(/\d+/);
    await (0, _test.expect)((0, _helpers.visible)(boss, '[data-testid="summary-total"]')).toHaveText(`₦${expected.toLocaleString("en-NG")}`);
    await boss.close();
  });
  (0, _test.test)("Share on WhatsApp sends the price and the link", async ({
    page,
    context
  }) => {
    var _URL$searchParams$get;
    let shared = "";
    await context.route("https://wa.me/**", route => {
      shared = route.request().url();
      return route.fulfill({
        body: "WhatsApp"
      });
    });
    await page.goto("/book?service=standard-cleaning");
    await chooseArea(page, "Yaba");
    const expected = await settledTotal(page);
    const popup = page.waitForEvent("popup");
    await (0, _helpers.visible)(page, "aside").getByRole("button", {
      name: "Share on WhatsApp"
    }).click();
    await (await popup).close();
    const text = (_URL$searchParams$get = new URL(shared).searchParams.get("text")) !== null && _URL$searchParams$get !== void 0 ? _URL$searchParams$get : "";
    (0, _test.expect)(text).toContain(`Kleandeck price for Standard cleaning: ₦${expected.toLocaleString("en-NG")} including VAT`);
    (0, _test.expect)(text).toContain("Yaba");
    (0, _test.expect)(text).toMatch(/See the breakdown or book: http:\/\/localhost:8089\/book\?service=standard-cleaning&area=\d+/);
  });
  (0, _test.test)("bad or out-of-date links still open a working calculator", async ({
    page
  }) => {
    await page.goto("/book?service=deep-cleaning&freq=999&area=abc&rooms=999-3.x-y&extras=999&sqm=-5");
    await (0, _test.expect)(page.getByRole("button", {
      name: /Deep cleaning/
    })).toHaveAttribute("aria-pressed", "true");
    await (0, _test.expect)((0, _helpers.visible)(page, '[data-testid="summary-total"]')).toHaveText(/₦[\d,]+/);
    await (0, _test.expect)(page.getByLabel("Area in Lagos")).toHaveValue("");
  });
});
_test.test.describe("Checkout with Paystack", () => {
  (0, _test.test)("customer pays online and the booking is confirmed", async ({
    page,
    browser
  }) => {
    const name = (0, _helpers.unique)("Ada Checkout");
    await page.goto("/book?service=standard-cleaning");
    await chooseArea(page);
    const expected = await total(page);
    await page.getByRole("button", {
      name: "Continue"
    }).click();
    await fillCustomerDetails(page, name);
    // Pick the time the way a customer does: by clicking the visible card.
    await page.getByText("Afternoon", {
      exact: true
    }).click();
    await (0, _test.expect)(page.getByRole("radio", {
      name: /Afternoon/
    })).toBeChecked();

    // Terms and site requirements are both required.
    const pay = page.getByRole("button", {
      name: /^Pay ₦[\d,]+ with Paystack$/
    });
    await (0, _test.expect)(pay).toContainText(`₦${expected.toLocaleString("en-NG")}`);
    await pay.click();
    await (0, _test.expect)(page).toHaveURL(/\/book/);
    await page.getByRole("checkbox", {
      name: /Running water and electricity/
    }).check();
    await page.getByRole("checkbox", {
      name: /I agree to Kleandeck/
    }).check();
    await pay.click();

    // Fake Paystack checkout shows the amount the backend calculated.
    await (0, _test.expect)(page).toHaveURL(new RegExp(`^${_helpers.FAKE_PAYSTACK}/checkout/KD-`));
    await (0, _test.expect)(page.getByTestId("amount")).toHaveText(`₦${expected.toLocaleString("en-NG")}`);
    await (0, _test.expect)(page.getByTestId("email")).toHaveText("customer@e2e.kleandeck.test");
    await page.locator("#pay").click();

    // Back on Kleandeck: verified server-side and confirmed.
    await (0, _test.expect)(page).toHaveURL(/\/booking\/confirmation\?/);
    await (0, _test.expect)(page.getByRole("heading", {
      name: /You're booked/
    })).toBeVisible();
    await (0, _test.expect)(page.getByText(`We've received ₦${expected.toLocaleString("en-NG")}`)).toBeVisible();
    const reference = (await page.locator("dt", {
      hasText: "Reference"
    }).locator("+ dd").textContent()).trim();
    (0, _test.expect)(reference).toMatch(/^KD-[A-Z0-9]{7}$/);

    // The team sees it as paid and confirmed.
    const admin = await browser.newPage({
      storageState: _helpers.OWNER.storageState
    });
    const booking = await (0, _helpers.adminApi)(admin, "GET", `bookings/${reference}/`);
    (0, _test.expect)(booking).toMatchObject({
      status: "confirmed",
      payment_status: "paid",
      total: expected,
      time_slot: "afternoon"
    });
    await admin.close();
  });
  (0, _test.test)("cancelling on Paystack leaves the booking unpaid", async ({
    page
  }) => {
    await page.goto("/book?service=deep-cleaning");
    await chooseArea(page, "Ikeja");
    await page.getByRole("button", {
      name: "Continue"
    }).click();
    await fillCustomerDetails(page, (0, _helpers.unique)("Cancel Test"));
    await page.getByRole("checkbox", {
      name: /Running water and electricity/
    }).check();
    await page.getByRole("checkbox", {
      name: /I agree to Kleandeck/
    }).check();
    await page.getByRole("button", {
      name: /with Paystack/
    }).click();
    await (0, _test.expect)(page).toHaveURL(new RegExp(`^${_helpers.FAKE_PAYSTACK}/checkout/`));
    await page.locator("#cancel").click();
    await (0, _test.expect)(page.getByRole("heading", {
      name: "Payment not completed"
    })).toBeVisible();
    await page.getByRole("link", {
      name: "Try again"
    }).click();
    await (0, _test.expect)(page).toHaveURL(/\/book$/);
  });
  (0, _test.test)("a broken confirmation link is handled", async ({
    page
  }) => {
    await page.goto("/booking/confirmation?reference=KD-NOPE-123");
    await (0, _test.expect)(page.getByRole("heading", {
      name: "We couldn't confirm this payment"
    })).toBeVisible();
    await (0, _test.expect)(page.getByText("Payment not found.")).toBeVisible();
  });
});
_test.test.describe("WhatsApp quote requests", () => {
  (0, _test.test)("custom-quote service saves the request and opens WhatsApp prefilled", async ({
    page,
    browser
  }) => {
    var _URL$searchParams$get2, _text$match;
    const admin = await browser.newPage({
      storageState: _helpers.OWNER.storageState
    });
    await (0, _helpers.adminApi)(admin, "PATCH", "settings/", {
      whatsapp_number: "2348099990000"
    });
    let whatsappUrl = "";
    await page.route("https://wa.me/**", route => {
      whatsappUrl = route.request().url();
      return route.fulfill({
        body: "WhatsApp"
      });
    });
    const name = (0, _helpers.unique)("Quote Seeker");
    await page.goto("/book?service=facility-support");
    await (0, _test.expect)((0, _helpers.visible)(page, "aside")).toContainText("priced per job");
    await page.getByLabel("Area in Lagos").selectOption({
      label: "Lekki Phase 1"
    });
    await page.getByRole("button", {
      name: "Continue to a WhatsApp quote"
    }).click();
    await page.getByLabel("Contact name").fill(name);
    await page.getByLabel("Phone (WhatsApp)").fill("08055554444");
    await page.getByLabel("What do you need?").fill("Two office assistants, Monday to Friday");
    await page.getByRole("checkbox", {
      name: /I agree to Kleandeck/
    }).check();
    await page.getByRole("button", {
      name: "Send on WhatsApp"
    }).click();
    await _test.expect.poll(() => whatsappUrl).toContain("https://wa.me/2348099990000?text=");
    const text = decodeURIComponent((_URL$searchParams$get2 = new URL(whatsappUrl).searchParams.get("text")) !== null && _URL$searchParams$get2 !== void 0 ? _URL$searchParams$get2 : "");
    (0, _test.expect)(text).toContain("Facility support");
    (0, _test.expect)(text).toContain(name);
    (0, _test.expect)(text).toContain("Two office assistants");
    const reference = (_text$match = text.match(/Ref: (KD-[A-Z0-9]+)/)) === null || _text$match === void 0 ? void 0 : _text$match[1];
    (0, _test.expect)(reference).toBeTruthy();
    const booking = await (0, _helpers.adminApi)(admin, "GET", `bookings/${reference}/`);
    (0, _test.expect)(booking).toMatchObject({
      status: "quote_requested",
      source: "quote"
    });
    await admin.close();
  });
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfdGVzdCIsInJlcXVpcmUiLCJfaGVscGVycyIsInRvdGFsIiwicGFnZSIsImVsIiwidmlzaWJsZSIsImV4cGVjdCIsInRvSGF2ZVRleHQiLCJuYWlyYVZhbHVlIiwidGV4dENvbnRlbnQiLCJzZXR0bGVkVG90YWwiLCJsYXN0IiwicG9sbCIsIm5vdyIsInN0YWJsZSIsImludGVydmFscyIsInRvQmUiLCJ0b3RhbENoYW5nZXNGcm9tIiwiYmVmb3JlIiwibm90IiwiY2hvb3NlQXJlYSIsImFyZWEiLCJnZXRCeUxhYmVsIiwic2VsZWN0T3B0aW9uIiwibGFiZWwiLCJmaWxsQ3VzdG9tZXJEZXRhaWxzIiwibmFtZSIsImZpbGwiLCJ0ZXN0IiwiZGVzY3JpYmUiLCJnb3RvIiwiZ2V0QnlSb2xlIiwidG9IYXZlQXR0cmlidXRlIiwic3RhcnQiLCJjbGljayIsIm1vcmVSb29tcyIsInRvQmVHcmVhdGVyVGhhbiIsImNoZWNrIiwid2l0aEFkZG9uIiwidG9Db250YWluVGV4dCIsInN1bW1hcnkiLCJuZXh0IiwidG9CZURpc2FibGVkIiwiZ2V0QnlUZXh0IiwidG9CZVZpc2libGUiLCJ0b0JlRW5hYmxlZCIsImV4YWN0IiwidG9IYXZlQ291bnQiLCJicm93c2VyIiwidG9IYXZlVVJMIiwiZXhwZWN0ZWQiLCJsaW5rIiwidXJsIiwiYm9zcyIsIm5ld1BhZ2UiLCJ0b0JlQ2hlY2tlZCIsInRvSGF2ZVZhbHVlIiwidG9Mb2NhbGVTdHJpbmciLCJjbG9zZSIsImNvbnRleHQiLCJfVVJMJHNlYXJjaFBhcmFtcyRnZXQiLCJzaGFyZWQiLCJyb3V0ZSIsInJlcXVlc3QiLCJmdWxmaWxsIiwiYm9keSIsInBvcHVwIiwid2FpdEZvckV2ZW50IiwidGV4dCIsIlVSTCIsInNlYXJjaFBhcmFtcyIsImdldCIsInRvQ29udGFpbiIsInRvTWF0Y2giLCJ1bmlxdWUiLCJwYXkiLCJSZWdFeHAiLCJGQUtFX1BBWVNUQUNLIiwiZ2V0QnlUZXN0SWQiLCJsb2NhdG9yIiwicmVmZXJlbmNlIiwiaGFzVGV4dCIsInRyaW0iLCJhZG1pbiIsInN0b3JhZ2VTdGF0ZSIsIk9XTkVSIiwiYm9va2luZyIsImFkbWluQXBpIiwidG9NYXRjaE9iamVjdCIsInN0YXR1cyIsInBheW1lbnRfc3RhdHVzIiwidGltZV9zbG90IiwiX1VSTCRzZWFyY2hQYXJhbXMkZ2V0MiIsIl90ZXh0JG1hdGNoIiwid2hhdHNhcHBfbnVtYmVyIiwid2hhdHNhcHBVcmwiLCJkZWNvZGVVUklDb21wb25lbnQiLCJtYXRjaCIsInRvQmVUcnV0aHkiLCJzb3VyY2UiXSwic291cmNlcyI6WyJib29raW5nLnNwZWMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZXhwZWN0LCB0eXBlIFBhZ2UsIHRlc3QgfSBmcm9tIFwiQHBsYXl3cmlnaHQvdGVzdFwiO1xyXG5cclxuaW1wb3J0IHsgYWRtaW5BcGksIEZBS0VfUEFZU1RBQ0ssIG5haXJhVmFsdWUsIE9XTkVSLCB1bmlxdWUsIHZpc2libGUgfSBmcm9tIFwiLi9oZWxwZXJzXCI7XHJcblxyXG5hc3luYyBmdW5jdGlvbiB0b3RhbChwYWdlOiBQYWdlKSB7XHJcbiAgY29uc3QgZWwgPSB2aXNpYmxlKHBhZ2UsICdbZGF0YS10ZXN0aWQ9XCJzdW1tYXJ5LXRvdGFsXCJdJyk7XHJcbiAgYXdhaXQgZXhwZWN0KGVsKS50b0hhdmVUZXh0KC/igqZbXFxkLF0rLyk7XHJcbiAgcmV0dXJuIG5haXJhVmFsdWUoYXdhaXQgZWwudGV4dENvbnRlbnQoKSk7XHJcbn1cclxuXHJcbi8qKiBXYWl0cyB1bnRpbCB0aGUgbGl2ZSBwcmljZSBoYXMgc3RvcHBlZCBjaGFuZ2luZyAodGhlIGNhbGN1bGF0b3IgaXMgZGVib3VuY2VkKS4gKi9cclxuYXN5bmMgZnVuY3Rpb24gc2V0dGxlZFRvdGFsKHBhZ2U6IFBhZ2UpIHtcclxuICBsZXQgbGFzdCA9IC0xO1xyXG4gIGF3YWl0IGV4cGVjdFxyXG4gICAgLnBvbGwoYXN5bmMgKCkgPT4ge1xyXG4gICAgICBjb25zdCBub3cgPSBhd2FpdCB0b3RhbChwYWdlKTtcclxuICAgICAgY29uc3Qgc3RhYmxlID0gbm93ID09PSBsYXN0O1xyXG4gICAgICBsYXN0ID0gbm93O1xyXG4gICAgICByZXR1cm4gc3RhYmxlO1xyXG4gICAgfSwgeyBpbnRlcnZhbHM6IFs2MDAsIDYwMCwgNjAwLCAxMDAwXSB9KVxyXG4gICAgLnRvQmUodHJ1ZSk7XHJcbiAgcmV0dXJuIGxhc3Q7XHJcbn1cclxuXHJcbi8qKiBXYWl0cyB1bnRpbCB0aGUgbGl2ZSBwcmljZSBzZXR0bGVzIG9uIGEgbmV3IHZhbHVlLiAqL1xyXG5hc3luYyBmdW5jdGlvbiB0b3RhbENoYW5nZXNGcm9tKHBhZ2U6IFBhZ2UsIGJlZm9yZTogbnVtYmVyKSB7XHJcbiAgYXdhaXQgZXhwZWN0LnBvbGwoKCkgPT4gdG90YWwocGFnZSkpLm5vdC50b0JlKGJlZm9yZSk7XHJcbiAgcmV0dXJuIHRvdGFsKHBhZ2UpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBjaG9vc2VBcmVhKHBhZ2U6IFBhZ2UsIGFyZWEgPSBcIlZpY3RvcmlhIElzbGFuZFwiKSB7XHJcbiAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKFwiQXJlYSBpbiBMYWdvc1wiKS5zZWxlY3RPcHRpb24oeyBsYWJlbDogYXJlYSB9KTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZmlsbEN1c3RvbWVyRGV0YWlscyhwYWdlOiBQYWdlLCBuYW1lOiBzdHJpbmcpIHtcclxuICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoXCJDb250YWN0IG5hbWVcIikuZmlsbChuYW1lKTtcclxuICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoXCJDb21wYW55IChvcHRpb25hbClcIikuZmlsbChgJHtuYW1lfSBMdGRgKTtcclxuICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoXCJQaG9uZSAoV2hhdHNBcHApXCIpLmZpbGwoXCIwODAzMTIzNDU2N1wiKTtcclxuICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoXCJFbWFpbCBmb3IgeW91ciByZWNlaXB0XCIpLmZpbGwoXCJjdXN0b21lckBlMmUua2xlYW5kZWNrLnRlc3RcIik7XHJcbiAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKFwiQWRkcmVzcyBvZiB0aGUgc3BhY2VcIikuZmlsbChcIjEyIEFkZW9sYSBPZGVrdSBTdHJlZXQsIDNyZCBmbG9vclwiKTtcclxufVxyXG5cclxudGVzdC5kZXNjcmliZShcIkJvb2tpbmcgY2FsY3VsYXRvclwiLCAoKSA9PiB7XHJcbiAgdGVzdChcInByaWNlIHJlc3BvbmRzIHRvIHJvb21zLCBmcmVxdWVuY3kgYW5kIGFkZC1vbnNcIiwgYXN5bmMgKHsgcGFnZSB9KSA9PiB7XHJcbiAgICBhd2FpdCBwYWdlLmdvdG8oXCIvYm9vaz9zZXJ2aWNlPWRlZXAtY2xlYW5pbmdcIik7XHJcbiAgICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVJvbGUoXCJidXR0b25cIiwgeyBuYW1lOiAvRGVlcCBjbGVhbmluZy8gfSkpLnRvSGF2ZUF0dHJpYnV0ZShcImFyaWEtcHJlc3NlZFwiLCBcInRydWVcIik7XHJcblxyXG4gICAgY29uc3Qgc3RhcnQgPSBhd2FpdCB0b3RhbChwYWdlKTtcclxuICAgIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKFwiYnV0dG9uXCIsIHsgbmFtZTogXCJNb3JlIFJvb21zIC8gd29yayBhcmVhc1wiIH0pLmNsaWNrKCk7XHJcbiAgICBjb25zdCBtb3JlUm9vbXMgPSBhd2FpdCB0b3RhbENoYW5nZXNGcm9tKHBhZ2UsIHN0YXJ0KTtcclxuICAgIGV4cGVjdChtb3JlUm9vbXMpLnRvQmVHcmVhdGVyVGhhbihzdGFydCk7XHJcblxyXG4gICAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoXCJjaGVja2JveFwiLCB7IG5hbWU6IC9JbnRlcmlvciB3aW5kb3dzLyB9KS5jaGVjaygpO1xyXG4gICAgY29uc3Qgd2l0aEFkZG9uID0gYXdhaXQgdG90YWxDaGFuZ2VzRnJvbShwYWdlLCBtb3JlUm9vbXMpO1xyXG4gICAgZXhwZWN0KHdpdGhBZGRvbikudG9CZUdyZWF0ZXJUaGFuKG1vcmVSb29tcyk7XHJcblxyXG4gICAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoXCJidXR0b25cIiwgeyBuYW1lOiAvXk1vbnRobHkvIH0pLmNsaWNrKCk7XHJcbiAgICBhd2FpdCBleHBlY3QodmlzaWJsZShwYWdlLCBcImFzaWRlXCIpKS50b0NvbnRhaW5UZXh0KFwiTW9udGhseVwiKTtcclxuICB9KTtcclxuXHJcbiAgdGVzdChcIndlZWtseSBjbGVhbmluZyBzaG93cyB0aGUgZGlzY291bnQgYW5kIGJpbGxzIGZvdXIgdmlzaXRzXCIsIGFzeW5jICh7IHBhZ2UgfSkgPT4ge1xyXG4gICAgYXdhaXQgcGFnZS5nb3RvKFwiL2Jvb2s/c2VydmljZT1zdGFuZGFyZC1jbGVhbmluZ1wiKTtcclxuICAgIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKFwiYnV0dG9uXCIsIHsgbmFtZTogL15XZWVrbHkvIH0pLmNsaWNrKCk7XHJcbiAgICBjb25zdCBzdW1tYXJ5ID0gdmlzaWJsZShwYWdlLCBcImFzaWRlXCIpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHN1bW1hcnkpLnRvQ29udGFpblRleHQoXCJXZWVrbHkgZGlzY291bnRcIik7XHJcbiAgICBhd2FpdCBleHBlY3Qoc3VtbWFyeSkudG9Db250YWluVGV4dCgvcGVyIHZpc2l0IMOXIDQgdmlzaXRzLyk7XHJcbiAgICBhd2FpdCBleHBlY3Qoc3VtbWFyeSkudG9Db250YWluVGV4dChcIkNvdmVycyA0IHZpc2l0c1wiKTtcclxuICB9KTtcclxuXHJcbiAgdGVzdChcImNvbnRpbnVlIGlzIGJsb2NrZWQgdW50aWwgYW4gYXJlYSBpcyBjaG9zZW5cIiwgYXN5bmMgKHsgcGFnZSB9KSA9PiB7XHJcbiAgICBhd2FpdCBwYWdlLmdvdG8oXCIvYm9vaz9zZXJ2aWNlPXN0YW5kYXJkLWNsZWFuaW5nXCIpO1xyXG4gICAgY29uc3QgbmV4dCA9IHBhZ2UuZ2V0QnlSb2xlKFwiYnV0dG9uXCIsIHsgbmFtZTogXCJDb250aW51ZVwiIH0pO1xyXG4gICAgYXdhaXQgZXhwZWN0KG5leHQpLnRvQmVEaXNhYmxlZCgpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlUZXh0KFwiQ2hvb3NlIHlvdXIgYXJlYSB0byBjb250aW51ZS5cIikpLnRvQmVWaXNpYmxlKCk7XHJcbiAgICBhd2FpdCBjaG9vc2VBcmVhKHBhZ2UpO1xyXG4gICAgYXdhaXQgZXhwZWN0KG5leHQpLnRvQmVFbmFibGVkKCk7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJsYXJnZSBwb3N0LWNvbnN0cnVjdGlvbiBqb2JzIGFyZSBzZW50IHRvIFdoYXRzQXBwIGluc3RlYWQgb2YgY2hlY2tvdXRcIiwgYXN5bmMgKHsgcGFnZSB9KSA9PiB7XHJcbiAgICBhd2FpdCBwYWdlLmdvdG8oXCIvYm9vaz9zZXJ2aWNlPXBvc3QtY29uc3RydWN0aW9uLWNsZWFuaW5nXCIpO1xyXG4gICAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKFwiRmxvb3IgYXJlYSAobcKyKVwiKS5maWxsKFwiOTAwXCIpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHZpc2libGUocGFnZSwgXCJhc2lkZVwiKSkudG9Db250YWluVGV4dChcIkVzdGltYXRlZCB0b3RhbFwiKTtcclxuICAgIGF3YWl0IGV4cGVjdCh2aXNpYmxlKHBhZ2UsIFwiYXNpZGVcIikpLnRvQ29udGFpblRleHQoXCJ3ZSdsbCBjb25maXJtIHRoZSBwcmljZSB3aXRoIHlvdSBvbiBXaGF0c0FwcFwiKTtcclxuICAgIGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5Um9sZShcImJ1dHRvblwiLCB7IG5hbWU6IFwiQ29udGludWUgdG8gYSBXaGF0c0FwcCBxdW90ZVwiIH0pKS50b0JlVmlzaWJsZSgpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlSb2xlKFwiYnV0dG9uXCIsIHsgbmFtZTogXCJDb250aW51ZVwiLCBleGFjdDogdHJ1ZSB9KSkudG9IYXZlQ291bnQoMCk7XHJcbiAgfSk7XHJcbn0pO1xyXG5cclxudGVzdC5kZXNjcmliZShcIlNoYXJpbmcgYSBwcmljZVwiLCAoKSA9PiB7XHJcbiAgdGVzdChcImEgZm9yd2FyZGVkIGxpbmsgcmVvcGVucyB0aGUgZXhhY3QgY2FsY3VsYXRpb25cIiwgYXN5bmMgKHsgcGFnZSwgYnJvd3NlciB9KSA9PiB7XHJcbiAgICBhd2FpdCBwYWdlLmdvdG8oXCIvYm9vaz9zZXJ2aWNlPWRlZXAtY2xlYW5pbmdcIik7XHJcbiAgICBhd2FpdCBwYWdlLmdldEJ5Um9sZShcImJ1dHRvblwiLCB7IG5hbWU6IFwiTW9yZSBSb29tcyAvIHdvcmsgYXJlYXNcIiB9KS5jbGljaygpO1xyXG4gICAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoXCJjaGVja2JveFwiLCB7IG5hbWU6IC9JbnRlcmlvciB3aW5kb3dzLyB9KS5jaGVjaygpO1xyXG4gICAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoXCJidXR0b25cIiwgeyBuYW1lOiAvXk1vbnRobHkvIH0pLmNsaWNrKCk7XHJcbiAgICBhd2FpdCBjaG9vc2VBcmVhKHBhZ2UsIFwiSWtveWlcIik7XHJcbiAgICBhd2FpdCBleHBlY3QocGFnZSkudG9IYXZlVVJMKC9mcmVxPVxcZCsvKTtcclxuICAgIGF3YWl0IGV4cGVjdChwYWdlKS50b0hhdmVVUkwoL2FyZWE9XFxkKy8pO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UpLnRvSGF2ZVVSTCgvcm9vbXM9XFxkKy00Lyk7XHJcbiAgICBhd2FpdCBleHBlY3QocGFnZSkudG9IYXZlVVJMKC9leHRyYXM9XFxkKy8pO1xyXG4gICAgY29uc3QgZXhwZWN0ZWQgPSBhd2FpdCBzZXR0bGVkVG90YWwocGFnZSk7XHJcbiAgICBjb25zdCBsaW5rID0gcGFnZS51cmwoKTtcclxuXHJcbiAgICAvLyBTb21lb25lIGVsc2Ugb3BlbnMgdGhlIGZvcndhcmRlZCBsaW5rOiBzYW1lIGNob2ljZXMsIHNhbWUgbGl2ZSBwcmljZS5cclxuICAgIGNvbnN0IGJvc3MgPSBhd2FpdCBicm93c2VyLm5ld1BhZ2UoKTtcclxuICAgIGF3YWl0IGJvc3MuZ290byhsaW5rKTtcclxuICAgIGF3YWl0IGV4cGVjdChib3NzLmdldEJ5Um9sZShcImJ1dHRvblwiLCB7IG5hbWU6IC9eTW9udGhseS8gfSkpLnRvSGF2ZUF0dHJpYnV0ZShcImFyaWEtcHJlc3NlZFwiLCBcInRydWVcIik7XHJcbiAgICBhd2FpdCBleHBlY3QoYm9zcy5nZXRCeVJvbGUoXCJjaGVja2JveFwiLCB7IG5hbWU6IC9JbnRlcmlvciB3aW5kb3dzLyB9KSkudG9CZUNoZWNrZWQoKTtcclxuICAgIGF3YWl0IGV4cGVjdChib3NzLmdldEJ5TGFiZWwoXCJBcmVhIGluIExhZ29zXCIpKS50b0hhdmVWYWx1ZSgvXFxkKy8pO1xyXG4gICAgYXdhaXQgZXhwZWN0KHZpc2libGUoYm9zcywgJ1tkYXRhLXRlc3RpZD1cInN1bW1hcnktdG90YWxcIl0nKSkudG9IYXZlVGV4dChg4oKmJHtleHBlY3RlZC50b0xvY2FsZVN0cmluZyhcImVuLU5HXCIpfWApO1xyXG4gICAgYXdhaXQgYm9zcy5jbG9zZSgpO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiU2hhcmUgb24gV2hhdHNBcHAgc2VuZHMgdGhlIHByaWNlIGFuZCB0aGUgbGlua1wiLCBhc3luYyAoeyBwYWdlLCBjb250ZXh0IH0pID0+IHtcclxuICAgIGxldCBzaGFyZWQgPSBcIlwiO1xyXG4gICAgYXdhaXQgY29udGV4dC5yb3V0ZShcImh0dHBzOi8vd2EubWUvKipcIiwgKHJvdXRlKSA9PiB7XHJcbiAgICAgIHNoYXJlZCA9IHJvdXRlLnJlcXVlc3QoKS51cmwoKTtcclxuICAgICAgcmV0dXJuIHJvdXRlLmZ1bGZpbGwoeyBib2R5OiBcIldoYXRzQXBwXCIgfSk7XHJcbiAgICB9KTtcclxuICAgIGF3YWl0IHBhZ2UuZ290byhcIi9ib29rP3NlcnZpY2U9c3RhbmRhcmQtY2xlYW5pbmdcIik7XHJcbiAgICBhd2FpdCBjaG9vc2VBcmVhKHBhZ2UsIFwiWWFiYVwiKTtcclxuICAgIGNvbnN0IGV4cGVjdGVkID0gYXdhaXQgc2V0dGxlZFRvdGFsKHBhZ2UpO1xyXG4gICAgY29uc3QgcG9wdXAgPSBwYWdlLndhaXRGb3JFdmVudChcInBvcHVwXCIpO1xyXG4gICAgYXdhaXQgdmlzaWJsZShwYWdlLCBcImFzaWRlXCIpLmdldEJ5Um9sZShcImJ1dHRvblwiLCB7IG5hbWU6IFwiU2hhcmUgb24gV2hhdHNBcHBcIiB9KS5jbGljaygpO1xyXG4gICAgYXdhaXQgKGF3YWl0IHBvcHVwKS5jbG9zZSgpO1xyXG5cclxuICAgIGNvbnN0IHRleHQgPSBuZXcgVVJMKHNoYXJlZCkuc2VhcmNoUGFyYW1zLmdldChcInRleHRcIikgPz8gXCJcIjtcclxuICAgIGV4cGVjdCh0ZXh0KS50b0NvbnRhaW4oYEtsZWFuZGVjayBwcmljZSBmb3IgU3RhbmRhcmQgY2xlYW5pbmc6IOKCpiR7ZXhwZWN0ZWQudG9Mb2NhbGVTdHJpbmcoXCJlbi1OR1wiKX0gaW5jbHVkaW5nIFZBVGApO1xyXG4gICAgZXhwZWN0KHRleHQpLnRvQ29udGFpbihcIllhYmFcIik7XHJcbiAgICBleHBlY3QodGV4dCkudG9NYXRjaCgvU2VlIHRoZSBicmVha2Rvd24gb3IgYm9vazogaHR0cDpcXC9cXC9sb2NhbGhvc3Q6ODA4OVxcL2Jvb2tcXD9zZXJ2aWNlPXN0YW5kYXJkLWNsZWFuaW5nJmFyZWE9XFxkKy8pO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiYmFkIG9yIG91dC1vZi1kYXRlIGxpbmtzIHN0aWxsIG9wZW4gYSB3b3JraW5nIGNhbGN1bGF0b3JcIiwgYXN5bmMgKHsgcGFnZSB9KSA9PiB7XHJcbiAgICBhd2FpdCBwYWdlLmdvdG8oXCIvYm9vaz9zZXJ2aWNlPWRlZXAtY2xlYW5pbmcmZnJlcT05OTkmYXJlYT1hYmMmcm9vbXM9OTk5LTMueC15JmV4dHJhcz05OTkmc3FtPS01XCIpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlSb2xlKFwiYnV0dG9uXCIsIHsgbmFtZTogL0RlZXAgY2xlYW5pbmcvIH0pKS50b0hhdmVBdHRyaWJ1dGUoXCJhcmlhLXByZXNzZWRcIiwgXCJ0cnVlXCIpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHZpc2libGUocGFnZSwgJ1tkYXRhLXRlc3RpZD1cInN1bW1hcnktdG90YWxcIl0nKSkudG9IYXZlVGV4dCgv4oKmW1xcZCxdKy8pO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlMYWJlbChcIkFyZWEgaW4gTGFnb3NcIikpLnRvSGF2ZVZhbHVlKFwiXCIpO1xyXG4gIH0pO1xyXG59KTtcclxuXHJcbnRlc3QuZGVzY3JpYmUoXCJDaGVja291dCB3aXRoIFBheXN0YWNrXCIsICgpID0+IHtcclxuICB0ZXN0KFwiY3VzdG9tZXIgcGF5cyBvbmxpbmUgYW5kIHRoZSBib29raW5nIGlzIGNvbmZpcm1lZFwiLCBhc3luYyAoeyBwYWdlLCBicm93c2VyIH0pID0+IHtcclxuICAgIGNvbnN0IG5hbWUgPSB1bmlxdWUoXCJBZGEgQ2hlY2tvdXRcIik7XHJcbiAgICBhd2FpdCBwYWdlLmdvdG8oXCIvYm9vaz9zZXJ2aWNlPXN0YW5kYXJkLWNsZWFuaW5nXCIpO1xyXG4gICAgYXdhaXQgY2hvb3NlQXJlYShwYWdlKTtcclxuICAgIGNvbnN0IGV4cGVjdGVkID0gYXdhaXQgdG90YWwocGFnZSk7XHJcbiAgICBhd2FpdCBwYWdlLmdldEJ5Um9sZShcImJ1dHRvblwiLCB7IG5hbWU6IFwiQ29udGludWVcIiB9KS5jbGljaygpO1xyXG5cclxuICAgIGF3YWl0IGZpbGxDdXN0b21lckRldGFpbHMocGFnZSwgbmFtZSk7XHJcbiAgICAvLyBQaWNrIHRoZSB0aW1lIHRoZSB3YXkgYSBjdXN0b21lciBkb2VzOiBieSBjbGlja2luZyB0aGUgdmlzaWJsZSBjYXJkLlxyXG4gICAgYXdhaXQgcGFnZS5nZXRCeVRleHQoXCJBZnRlcm5vb25cIiwgeyBleGFjdDogdHJ1ZSB9KS5jbGljaygpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlSb2xlKFwicmFkaW9cIiwgeyBuYW1lOiAvQWZ0ZXJub29uLyB9KSkudG9CZUNoZWNrZWQoKTtcclxuXHJcbiAgICAvLyBUZXJtcyBhbmQgc2l0ZSByZXF1aXJlbWVudHMgYXJlIGJvdGggcmVxdWlyZWQuXHJcbiAgICBjb25zdCBwYXkgPSBwYWdlLmdldEJ5Um9sZShcImJ1dHRvblwiLCB7IG5hbWU6IC9eUGF5IOKCpltcXGQsXSsgd2l0aCBQYXlzdGFjayQvIH0pO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBheSkudG9Db250YWluVGV4dChg4oKmJHtleHBlY3RlZC50b0xvY2FsZVN0cmluZyhcImVuLU5HXCIpfWApO1xyXG4gICAgYXdhaXQgcGF5LmNsaWNrKCk7XHJcbiAgICBhd2FpdCBleHBlY3QocGFnZSkudG9IYXZlVVJMKC9cXC9ib29rLyk7XHJcbiAgICBhd2FpdCBwYWdlLmdldEJ5Um9sZShcImNoZWNrYm94XCIsIHsgbmFtZTogL1J1bm5pbmcgd2F0ZXIgYW5kIGVsZWN0cmljaXR5LyB9KS5jaGVjaygpO1xyXG4gICAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoXCJjaGVja2JveFwiLCB7IG5hbWU6IC9JIGFncmVlIHRvIEtsZWFuZGVjay8gfSkuY2hlY2soKTtcclxuICAgIGF3YWl0IHBheS5jbGljaygpO1xyXG5cclxuICAgIC8vIEZha2UgUGF5c3RhY2sgY2hlY2tvdXQgc2hvd3MgdGhlIGFtb3VudCB0aGUgYmFja2VuZCBjYWxjdWxhdGVkLlxyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UpLnRvSGF2ZVVSTChuZXcgUmVnRXhwKGBeJHtGQUtFX1BBWVNUQUNLfS9jaGVja291dC9LRC1gKSk7XHJcbiAgICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVRlc3RJZChcImFtb3VudFwiKSkudG9IYXZlVGV4dChg4oKmJHtleHBlY3RlZC50b0xvY2FsZVN0cmluZyhcImVuLU5HXCIpfWApO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlUZXN0SWQoXCJlbWFpbFwiKSkudG9IYXZlVGV4dChcImN1c3RvbWVyQGUyZS5rbGVhbmRlY2sudGVzdFwiKTtcclxuICAgIGF3YWl0IHBhZ2UubG9jYXRvcihcIiNwYXlcIikuY2xpY2soKTtcclxuXHJcbiAgICAvLyBCYWNrIG9uIEtsZWFuZGVjazogdmVyaWZpZWQgc2VydmVyLXNpZGUgYW5kIGNvbmZpcm1lZC5cclxuICAgIGF3YWl0IGV4cGVjdChwYWdlKS50b0hhdmVVUkwoL1xcL2Jvb2tpbmdcXC9jb25maXJtYXRpb25cXD8vKTtcclxuICAgIGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5Um9sZShcImhlYWRpbmdcIiwgeyBuYW1lOiAvWW91J3JlIGJvb2tlZC8gfSkpLnRvQmVWaXNpYmxlKCk7XHJcbiAgICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVRleHQoYFdlJ3ZlIHJlY2VpdmVkIOKCpiR7ZXhwZWN0ZWQudG9Mb2NhbGVTdHJpbmcoXCJlbi1OR1wiKX1gKSkudG9CZVZpc2libGUoKTtcclxuICAgIGNvbnN0IHJlZmVyZW5jZSA9IChhd2FpdCBwYWdlLmxvY2F0b3IoXCJkdFwiLCB7IGhhc1RleHQ6IFwiUmVmZXJlbmNlXCIgfSkubG9jYXRvcihcIisgZGRcIikudGV4dENvbnRlbnQoKSkhLnRyaW0oKTtcclxuICAgIGV4cGVjdChyZWZlcmVuY2UpLnRvTWF0Y2goL15LRC1bQS1aMC05XXs3fSQvKTtcclxuXHJcbiAgICAvLyBUaGUgdGVhbSBzZWVzIGl0IGFzIHBhaWQgYW5kIGNvbmZpcm1lZC5cclxuICAgIGNvbnN0IGFkbWluID0gYXdhaXQgYnJvd3Nlci5uZXdQYWdlKHsgc3RvcmFnZVN0YXRlOiBPV05FUi5zdG9yYWdlU3RhdGUgfSk7XHJcbiAgICBjb25zdCBib29raW5nID0gYXdhaXQgYWRtaW5BcGk8eyBzdGF0dXM6IHN0cmluZzsgcGF5bWVudF9zdGF0dXM6IHN0cmluZzsgdG90YWw6IG51bWJlcjsgdGltZV9zbG90OiBzdHJpbmcgfT4oXHJcbiAgICAgIGFkbWluLFxyXG4gICAgICBcIkdFVFwiLFxyXG4gICAgICBgYm9va2luZ3MvJHtyZWZlcmVuY2V9L2AsXHJcbiAgICApO1xyXG4gICAgZXhwZWN0KGJvb2tpbmcpLnRvTWF0Y2hPYmplY3QoeyBzdGF0dXM6IFwiY29uZmlybWVkXCIsIHBheW1lbnRfc3RhdHVzOiBcInBhaWRcIiwgdG90YWw6IGV4cGVjdGVkLCB0aW1lX3Nsb3Q6IFwiYWZ0ZXJub29uXCIgfSk7XHJcbiAgICBhd2FpdCBhZG1pbi5jbG9zZSgpO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiY2FuY2VsbGluZyBvbiBQYXlzdGFjayBsZWF2ZXMgdGhlIGJvb2tpbmcgdW5wYWlkXCIsIGFzeW5jICh7IHBhZ2UgfSkgPT4ge1xyXG4gICAgYXdhaXQgcGFnZS5nb3RvKFwiL2Jvb2s/c2VydmljZT1kZWVwLWNsZWFuaW5nXCIpO1xyXG4gICAgYXdhaXQgY2hvb3NlQXJlYShwYWdlLCBcIklrZWphXCIpO1xyXG4gICAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoXCJidXR0b25cIiwgeyBuYW1lOiBcIkNvbnRpbnVlXCIgfSkuY2xpY2soKTtcclxuICAgIGF3YWl0IGZpbGxDdXN0b21lckRldGFpbHMocGFnZSwgdW5pcXVlKFwiQ2FuY2VsIFRlc3RcIikpO1xyXG4gICAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoXCJjaGVja2JveFwiLCB7IG5hbWU6IC9SdW5uaW5nIHdhdGVyIGFuZCBlbGVjdHJpY2l0eS8gfSkuY2hlY2soKTtcclxuICAgIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKFwiY2hlY2tib3hcIiwgeyBuYW1lOiAvSSBhZ3JlZSB0byBLbGVhbmRlY2svIH0pLmNoZWNrKCk7XHJcbiAgICBhd2FpdCBwYWdlLmdldEJ5Um9sZShcImJ1dHRvblwiLCB7IG5hbWU6IC93aXRoIFBheXN0YWNrLyB9KS5jbGljaygpO1xyXG5cclxuICAgIGF3YWl0IGV4cGVjdChwYWdlKS50b0hhdmVVUkwobmV3IFJlZ0V4cChgXiR7RkFLRV9QQVlTVEFDS30vY2hlY2tvdXQvYCkpO1xyXG4gICAgYXdhaXQgcGFnZS5sb2NhdG9yKFwiI2NhbmNlbFwiKS5jbGljaygpO1xyXG5cclxuICAgIGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5Um9sZShcImhlYWRpbmdcIiwgeyBuYW1lOiBcIlBheW1lbnQgbm90IGNvbXBsZXRlZFwiIH0pKS50b0JlVmlzaWJsZSgpO1xyXG4gICAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoXCJsaW5rXCIsIHsgbmFtZTogXCJUcnkgYWdhaW5cIiB9KS5jbGljaygpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UpLnRvSGF2ZVVSTCgvXFwvYm9vayQvKTtcclxuICB9KTtcclxuXHJcbiAgdGVzdChcImEgYnJva2VuIGNvbmZpcm1hdGlvbiBsaW5rIGlzIGhhbmRsZWRcIiwgYXN5bmMgKHsgcGFnZSB9KSA9PiB7XHJcbiAgICBhd2FpdCBwYWdlLmdvdG8oXCIvYm9va2luZy9jb25maXJtYXRpb24/cmVmZXJlbmNlPUtELU5PUEUtMTIzXCIpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlSb2xlKFwiaGVhZGluZ1wiLCB7IG5hbWU6IFwiV2UgY291bGRuJ3QgY29uZmlybSB0aGlzIHBheW1lbnRcIiB9KSkudG9CZVZpc2libGUoKTtcclxuICAgIGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5VGV4dChcIlBheW1lbnQgbm90IGZvdW5kLlwiKSkudG9CZVZpc2libGUoKTtcclxuICB9KTtcclxufSk7XHJcblxyXG50ZXN0LmRlc2NyaWJlKFwiV2hhdHNBcHAgcXVvdGUgcmVxdWVzdHNcIiwgKCkgPT4ge1xyXG4gIHRlc3QoXCJjdXN0b20tcXVvdGUgc2VydmljZSBzYXZlcyB0aGUgcmVxdWVzdCBhbmQgb3BlbnMgV2hhdHNBcHAgcHJlZmlsbGVkXCIsIGFzeW5jICh7IHBhZ2UsIGJyb3dzZXIgfSkgPT4ge1xyXG4gICAgY29uc3QgYWRtaW4gPSBhd2FpdCBicm93c2VyLm5ld1BhZ2UoeyBzdG9yYWdlU3RhdGU6IE9XTkVSLnN0b3JhZ2VTdGF0ZSB9KTtcclxuICAgIGF3YWl0IGFkbWluQXBpKGFkbWluLCBcIlBBVENIXCIsIFwic2V0dGluZ3MvXCIsIHsgd2hhdHNhcHBfbnVtYmVyOiBcIjIzNDgwOTk5OTAwMDBcIiB9KTtcclxuXHJcbiAgICBsZXQgd2hhdHNhcHBVcmwgPSBcIlwiO1xyXG4gICAgYXdhaXQgcGFnZS5yb3V0ZShcImh0dHBzOi8vd2EubWUvKipcIiwgKHJvdXRlKSA9PiB7XHJcbiAgICAgIHdoYXRzYXBwVXJsID0gcm91dGUucmVxdWVzdCgpLnVybCgpO1xyXG4gICAgICByZXR1cm4gcm91dGUuZnVsZmlsbCh7IGJvZHk6IFwiV2hhdHNBcHBcIiB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IG5hbWUgPSB1bmlxdWUoXCJRdW90ZSBTZWVrZXJcIik7XHJcbiAgICBhd2FpdCBwYWdlLmdvdG8oXCIvYm9vaz9zZXJ2aWNlPWZhY2lsaXR5LXN1cHBvcnRcIik7XHJcbiAgICBhd2FpdCBleHBlY3QodmlzaWJsZShwYWdlLCBcImFzaWRlXCIpKS50b0NvbnRhaW5UZXh0KFwicHJpY2VkIHBlciBqb2JcIik7XHJcbiAgICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoXCJBcmVhIGluIExhZ29zXCIpLnNlbGVjdE9wdGlvbih7IGxhYmVsOiBcIkxla2tpIFBoYXNlIDFcIiB9KTtcclxuICAgIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKFwiYnV0dG9uXCIsIHsgbmFtZTogXCJDb250aW51ZSB0byBhIFdoYXRzQXBwIHF1b3RlXCIgfSkuY2xpY2soKTtcclxuXHJcbiAgICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoXCJDb250YWN0IG5hbWVcIikuZmlsbChuYW1lKTtcclxuICAgIGF3YWl0IHBhZ2UuZ2V0QnlMYWJlbChcIlBob25lIChXaGF0c0FwcClcIikuZmlsbChcIjA4MDU1NTU0NDQ0XCIpO1xyXG4gICAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKFwiV2hhdCBkbyB5b3UgbmVlZD9cIikuZmlsbChcIlR3byBvZmZpY2UgYXNzaXN0YW50cywgTW9uZGF5IHRvIEZyaWRheVwiKTtcclxuICAgIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKFwiY2hlY2tib3hcIiwgeyBuYW1lOiAvSSBhZ3JlZSB0byBLbGVhbmRlY2svIH0pLmNoZWNrKCk7XHJcbiAgICBhd2FpdCBwYWdlLmdldEJ5Um9sZShcImJ1dHRvblwiLCB7IG5hbWU6IFwiU2VuZCBvbiBXaGF0c0FwcFwiIH0pLmNsaWNrKCk7XHJcblxyXG4gICAgYXdhaXQgZXhwZWN0LnBvbGwoKCkgPT4gd2hhdHNhcHBVcmwpLnRvQ29udGFpbihcImh0dHBzOi8vd2EubWUvMjM0ODA5OTk5MDAwMD90ZXh0PVwiKTtcclxuICAgIGNvbnN0IHRleHQgPSBkZWNvZGVVUklDb21wb25lbnQobmV3IFVSTCh3aGF0c2FwcFVybCkuc2VhcmNoUGFyYW1zLmdldChcInRleHRcIikgPz8gXCJcIik7XHJcbiAgICBleHBlY3QodGV4dCkudG9Db250YWluKFwiRmFjaWxpdHkgc3VwcG9ydFwiKTtcclxuICAgIGV4cGVjdCh0ZXh0KS50b0NvbnRhaW4obmFtZSk7XHJcbiAgICBleHBlY3QodGV4dCkudG9Db250YWluKFwiVHdvIG9mZmljZSBhc3Npc3RhbnRzXCIpO1xyXG4gICAgY29uc3QgcmVmZXJlbmNlID0gdGV4dC5tYXRjaCgvUmVmOiAoS0QtW0EtWjAtOV0rKS8pPy5bMV07XHJcbiAgICBleHBlY3QocmVmZXJlbmNlKS50b0JlVHJ1dGh5KCk7XHJcblxyXG4gICAgY29uc3QgYm9va2luZyA9IGF3YWl0IGFkbWluQXBpPHsgc3RhdHVzOiBzdHJpbmc7IHNvdXJjZTogc3RyaW5nIH0+KGFkbWluLCBcIkdFVFwiLCBgYm9va2luZ3MvJHtyZWZlcmVuY2V9L2ApO1xyXG4gICAgZXhwZWN0KGJvb2tpbmcpLnRvTWF0Y2hPYmplY3QoeyBzdGF0dXM6IFwicXVvdGVfcmVxdWVzdGVkXCIsIHNvdXJjZTogXCJxdW90ZVwiIH0pO1xyXG4gICAgYXdhaXQgYWRtaW4uY2xvc2UoKTtcclxuICB9KTtcclxufSk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxJQUFBQSxLQUFBLEdBQUFDLE9BQUE7QUFFQSxJQUFBQyxRQUFBLEdBQUFELE9BQUE7QUFFQSxlQUFlRSxLQUFLQSxDQUFDQyxJQUFVLEVBQUU7RUFDL0IsTUFBTUMsRUFBRSxHQUFHLElBQUFDLGdCQUFPLEVBQUNGLElBQUksRUFBRSwrQkFBK0IsQ0FBQztFQUN6RCxNQUFNLElBQUFHLFlBQU0sRUFBQ0Ys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