// 709110ca74ccfa3ea248183b9d17b8dc3bf9c394
"use strict";

var _nodePath = _interopRequireDefault(require("node:path"));
var _test = require("@playwright/test");
var _helpers = require("./helpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
_test.test.use({
  storageState: _helpers.OWNER.storageState
});
const PHOTO = _nodePath.default.join(__dirname, "..", "fixtures", "photo-1408.jpg");
async function serviceBySlug(page, slug) {
  const services = await (0, _helpers.adminApi)(page, "GET", "services/");
  return services.find(s => s.slug === slug);
}
const shown = locator => locator.filter({
  visible: true
}).first();
_test.test.describe("Setting up services", () => {
  (0, _test.test)("a new category with an uploaded photo appears on the homepage", async ({
    page,
    browser
  }) => {
    const name = (0, _helpers.unique)("Schools");
    await page.goto("/admin/categories/new");
    await page.getByLabel("Name", {
      exact: true
    }).fill(name);
    await page.getByLabel("Who it's for").fill("School bursars");
    await page.getByLabel("Description").fill("End-of-term deep cleans for classrooms and halls.");
    await page.getByLabel("Button text").fill("Price a school clean");
    await page.getByRole("checkbox", {
      name: "Deep cleaning"
    }).check();
    await page.getByRole("checkbox", {
      name: "Standard cleaning"
    }).check();
    await page.getByLabel("The card's button opens").selectOption({
      label: "Deep cleaning"
    });
    await (0, _test.expect)(page.getByText("Save first, then you can upload a photo.")).toBeVisible();
    await page.getByRole("button", {
      name: "Save category"
    }).first().click();
    await (0, _test.expect)(page.getByText("Category created")).toBeVisible();
    await (0, _test.expect)(page).toHaveURL(/\/admin\/categories\/\d+$/);
    await page.reload(); // drop the hidden "new category" page Next.js keeps mounted

    // Upload a photo; 1408px is below the "sharp" threshold so we get a warning.
    await page.getByLabel("Photo file").setInputFiles(PHOTO);
    await (0, _test.expect)(page.getByText("Photo uploaded")).toBeVisible();
    await (0, _test.expect)(shown(page.getByText(/1408px wide and may look soft/))).toBeVisible();
    const visitor = await browser.newPage();
    await visitor.goto("/");
    const card = visitor.getByRole("link", {
      name: new RegExp(name)
    });
    await (0, _test.expect)(card).toBeVisible();
    await (0, _test.expect)(card).toHaveAttribute("href", "/book?service=deep-cleaning");
    await (0, _test.expect)(card.locator("img")).toHaveAttribute("src", /^\/media\/uploads\/categories\/.+\.webp$/);
    // The browser picks a version from the srcset and it loads.
    const loaded = await card.locator("img").evaluate(el => el.decode().then(() => el.currentSrc));
    (0, _test.expect)(loaded).toMatch(/\/media\/uploads\/categories\/[0-9a-f]+(-card)?\.webp$/);

    // Hiding it takes it off the homepage.
    await page.getByRole("switch", {
      name: "Show on the homepage"
    }).click();
    await page.getByRole("button", {
      name: "Save category"
    }).first().click();
    await (0, _test.expect)(page.getByText("Category saved")).toBeVisible();
    await visitor.reload();
    await (0, _test.expect)(visitor.getByRole("link", {
      name: new RegExp(name)
    })).toHaveCount(0);
    await visitor.close();
  });
  (0, _test.test)("an uploaded service photo replaces the starter photo on the website", async ({
    page,
    browser
  }) => {
    const move = await serviceBySlug(page, "move-in-move-out");
    try {
      await page.goto(`/admin/services/${move.id}`);
      await (0, _test.expect)(page.getByText("Showing the starter photo")).toBeVisible();
      await page.getByLabel("Photo file").setInputFiles(PHOTO);
      await (0, _test.expect)(page.getByText("Photo uploaded")).toBeVisible();
      const visitor = await browser.newPage();
      await visitor.goto("/pricing");
      const card = visitor.locator("article", {
        hasText: "Move-in / move-out cleaning"
      });
      await (0, _test.expect)(card.locator("img")).toHaveAttribute("srcset", /-card\.webp 960w, .+\.webp 2000w/);
      await visitor.close();
    } finally {
      await page.request.fetch(`/api/admin/services/${move.id}/photo/`, {
        method: "DELETE",
        headers: {
          "X-CSRFToken": (await page.context().cookies()).find(c => c.name === "csrftoken").value
        }
      });
    }
  });
  (0, _test.test)("the price tester shows the customer's exact price", async ({
    page
  }) => {
    const standard = await serviceBySlug(page, "standard-cleaning");
    await page.goto(`/admin/services/${standard.id}`);
    const result = page.getByTestId("price-test-result");
    // Placeholder rates: 15,000 + 3 rooms × 5,000 + 4,000 + 4,000 = 38,000 + 7.5% VAT
    await (0, _test.expect)(result).toContainText("Customer pays₦40,850");
    await page.getByRole("button", {
      name: "Test more Rooms / work areas"
    }).click();
    await (0, _test.expect)(result).toContainText("Customer pays₦46,225");
    await page.getByLabel("Test frequency").selectOption({
      label: "Weekly"
    });
    await (0, _test.expect)(result).toContainText("× 4 visits");
    await (0, _test.expect)(result).toContainText("Frequency discount");
  });
  (0, _test.test)("a service-specific area surcharge shows in the tester and the booking calculator", async ({
    page,
    browser
  }) => {
    const standard = await serviceBySlug(page, "standard-cleaning");
    try {
      await page.goto(`/admin/services/${standard.id}?tab=booking`);
      await page.getByLabel("Surcharge for Ajah").fill("7000");
      await page.getByRole("button", {
        name: "Save service"
      }).first().click();
      await (0, _test.expect)(page.getByText("Service saved")).toBeVisible();
      await page.getByLabel("Test area").selectOption({
        label: "Ajah"
      });
      await (0, _test.expect)(page.getByTestId("price-test-result")).toContainText("Area surcharge₦7,000");
      const visitor = await browser.newPage();
      await visitor.goto("/book?service=standard-cleaning");
      await visitor.getByLabel("Area in Lagos").selectOption({
        label: "Ajah"
      });
      await (0, _test.expect)((0, _helpers.visible)(visitor, "aside")).toContainText("Travel (Ajah)₦7,000");
      await visitor.close();
    } finally {
      await (0, _helpers.adminApi)(page, "PATCH", `services/${standard.id}/`, {
        area_prices: []
      });
    }
  });
  (0, _test.test)("a deposit lets customers pay part now and the rest on completion", async ({
    page,
    browser
  }) => {
    const deep = await serviceBySlug(page, "deep-cleaning");
    try {
      await page.goto(`/admin/services/${deep.id}?tab=booking`);
      await page.getByLabel("Deposit to confirm (%)", {
        exact: true
      }).fill("30");
      await page.getByRole("button", {
        name: "Save service"
      }).first().click();
      await (0, _test.expect)(page.getByText("Service saved")).toBeVisible();
      await (0, _test.expect)(page.getByText("30% deposit online, rest on completion")).toBeVisible();
      const customer = await browser.newPage();
      await customer.goto("/book?service=deep-cleaning");
      await customer.getByLabel("Area in Lagos").selectOption({
        label: "Ikoyi"
      });
      const split = customer.getByTestId("deposit-split").filter({
        visible: true
      });
      await (0, _test.expect)(split).toContainText("Pay now (30% deposit)");
      const depositText = await split.locator("span.tabular").first().textContent();
      await customer.getByRole("button", {
        name: "Continue"
      }).click();
      await customer.getByLabel("Contact name").fill((0, _helpers.unique)("Deposit Payer"));
      await customer.getByLabel("Phone (WhatsApp)").fill("08030000000");
      await customer.getByLabel("Email for your receipt").fill("deposit@e2e.kleandeck.test");
      await customer.getByLabel("Address of the space").fill("1 Bourdillon Road");
      await customer.getByRole("checkbox", {
        name: /Running water and electricity/
      }).check();
      await customer.getByRole("checkbox", {
        name: /I agree to Kleandeck/
      }).check();
      await customer.getByRole("button", {
        name: `Pay ${depositText} deposit with Paystack`
      }).click();
      await (0, _test.expect)(customer).toHaveURL(new RegExp(`^${_helpers.FAKE_PAYSTACK}/checkout/`));
      await (0, _test.expect)(customer.getByTestId("amount")).toHaveText(depositText);
      await customer.locator("#pay").click();
      await (0, _test.expect)(customer.getByRole("heading", {
        name: /You're booked/
      })).toBeVisible();
      await (0, _test.expect)(customer.getByText(`We've received your ${depositText} deposit.`, {
        exact: false
      })).toBeVisible();
      await (0, _test.expect)(customer.getByText(/The balance of ₦[\d,]+ is due on completion/)).toBeVisible();
      await customer.close();
    } finally {
      await (0, _helpers.adminApi)(page, "PATCH", `services/${deep.id}/`, {
        deposit_percent: 0
      });
    }
  });
  (0, _test.test)("time slots and earliest booking can be set per service", async ({
    page,
    browser
  }) => {
    const deep = await serviceBySlug(page, "deep-cleaning");
    const slotName = (0, _helpers.unique)("Early bird");
    try {
      await page.goto("/admin/settings?tab=time-slots");
      await page.getByPlaceholder("New time slot, e.g. Early morning").fill(slotName);
      await page.getByLabel("Hours").last().fill("6am – 8am");
      await page.getByRole("button", {
        name: "Save"
      }).click();
      await (0, _test.expect)(page.getByText("Time slot added")).toBeVisible();
      await page.goto(`/admin/services/${deep.id}?tab=booking`);
      const booking = page.locator("section", {
        hasText: "Arrival times"
      });
      await booking.getByText(slotName).click();
      await page.getByLabel("Earliest booking", {
        exact: true
      }).fill("5");
      await page.getByRole("button", {
        name: "Save service"
      }).first().click();
      await (0, _test.expect)(page.getByText("Service saved")).toBeVisible();
      const customer = await browser.newPage();
      await customer.goto("/book?service=deep-cleaning");
      await customer.getByLabel("Area in Lagos").selectOption({
        label: "Ikoyi"
      });
      await customer.getByRole("button", {
        name: "Continue"
      }).click();
      const radios = customer.getByRole("radio");
      await (0, _test.expect)(radios).toHaveCount(1);
      await (0, _test.expect)(customer.getByText(slotName)).toBeVisible();
      const min = await customer.getByLabel("Date").getAttribute("min");
      const days = Math.round((Date.parse(min) - Date.parse(new Date().toISOString().slice(0, 10))) / 86400000);
      (0, _test.expect)(days).toBeGreaterThanOrEqual(5);
      await customer.close();
    } finally {
      await (0, _helpers.adminApi)(page, "PATCH", `services/${deep.id}/`, {
        time_slots: [],
        min_lead_days: null
      });
    }
  });
  (0, _test.test)("duplicating a service creates a hidden draft to edit", async ({
    page
  }) => {
    const standard = await serviceBySlug(page, "standard-cleaning");
    await page.goto(`/admin/services/${standard.id}`);
    await page.getByRole("button", {
      name: "Duplicate"
    }).click();
    await (0, _test.expect)(page.getByRole("heading", {
      level: 1,
      name: /Standard cleaning \(copy\)/
    })).toBeVisible();
    await (0, _test.expect)(page.getByRole("switch", {
      name: "Show on the website"
    })).toHaveAttribute("aria-checked", "false");
    await page.getByRole("tab", {
      name: /Pricing/
    }).click();
    await (0, _test.expect)(page.getByLabel("Label", {
      exact: true
    }).filter({
      visible: true
    })).toHaveCount(3);

    // Clean up the draft.
    await page.getByRole("button", {
      name: "Delete"
    }).click();
    await (0, _test.expect)(page).toHaveURL(/\/admin\/services$/);
  });
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbm9kZVBhdGgiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwicmVxdWlyZSIsIl90ZXN0IiwiX2hlbHBlcnMiLCJlIiwiX19lc01vZHVsZSIsImRlZmF1bHQiLCJ0ZXN0IiwidXNlIiwic3RvcmFnZVN0YXRlIiwiT1dORVIiLCJQSE9UTyIsInBhdGgiLCJqb2luIiwiX19kaXJuYW1lIiwic2VydmljZUJ5U2x1ZyIsInBhZ2UiLCJzbHVnIiwic2VydmljZXMiLCJhZG1pbkFwaSIsImZpbmQiLCJzIiwic2hvd24iLCJsb2NhdG9yIiwiZmlsdGVyIiwidmlzaWJsZSIsImZpcnN0IiwiZGVzY3JpYmUiLCJicm93c2VyIiwibmFtZSIsInVuaXF1ZSIsImdvdG8iLCJnZXRCeUxhYmVsIiwiZXhhY3QiLCJmaWxsIiwiZ2V0QnlSb2xlIiwiY2hlY2siLCJzZWxlY3RPcHRpb24iLCJsYWJlbCIsImV4cGVjdCIsImdldEJ5VGV4dCIsInRvQmVWaXNpYmxlIiwiY2xpY2siLCJ0b0hhdmVVUkwiLCJyZWxvYWQiLCJzZXRJbnB1dEZpbGVzIiwidmlzaXRvciIsIm5ld1BhZ2UiLCJjYXJkIiwiUmVnRXhwIiwidG9IYXZlQXR0cmlidXRlIiwibG9hZGVkIiwiZXZhbHVhdGUiLCJlbCIsImRlY29kZSIsInRoZW4iLCJjdXJyZW50U3JjIiwidG9NYXRjaCIsInRvSGF2ZUNvdW50IiwiY2xvc2UiLCJtb3ZlIiwiaWQiLCJoYXNUZXh0IiwicmVxdWVzdCIsImZldGNoIiwibWV0aG9kIiwiaGVhZGVycyIsImNvbnRleHQiLCJjb29raWVzIiwiYyIsInZhbHVlIiwic3RhbmRhcmQiLCJyZXN1bHQiLCJnZXRCeVRlc3RJZCIsInRvQ29udGFpblRleHQiLCJhcmVhX3ByaWNlcyIsImRlZXAiLCJjdXN0b21lciIsInNwbGl0IiwiZGVwb3NpdFRleHQiLCJ0ZXh0Q29udGVudCIsIkZBS0VfUEFZU1RBQ0siLCJ0b0hhdmVUZXh0IiwiZGVwb3NpdF9wZXJjZW50Iiwic2xvdE5hbWUiLCJnZXRCeVBsYWNlaG9sZGVyIiwibGFzdCIsImJvb2tpbmciLCJyYWRpb3MiLCJtaW4iLCJnZXRBdHRyaWJ1dGUiLCJkYXlzIiwiTWF0aCIsInJvdW5kIiwiRGF0ZSIsInBhcnNlIiwidG9JU09TdHJpbmciLCJzbGljZSIsInRvQmVHcmVhdGVyVGhhbk9yRXF1YWwiLCJ0aW1lX3Nsb3RzIiwibWluX2xlYWRfZGF5cyIsImxldmVsIl0sInNvdXJjZXMiOlsiYWRtaW4tc2VydmljZS1zZXR1cC5zcGVjLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gXCJub2RlOnBhdGhcIjtcclxuXHJcbmltcG9ydCB7IGV4cGVjdCwgdHlwZSBQYWdlLCB0ZXN0IH0gZnJvbSBcIkBwbGF5d3JpZ2h0L3Rlc3RcIjtcclxuXHJcbmltcG9ydCB7IGFkbWluQXBpLCBGQUtFX1BBWVNUQUNLLCBPV05FUiwgdW5pcXVlLCB2aXNpYmxlIH0gZnJvbSBcIi4vaGVscGVyc1wiO1xyXG5cclxudGVzdC51c2UoeyBzdG9yYWdlU3RhdGU6IE9XTkVSLnN0b3JhZ2VTdGF0ZSB9KTtcclxuXHJcbmNvbnN0IFBIT1RPID0gcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLlwiLCBcImZpeHR1cmVzXCIsIFwicGhvdG8tMTQwOC5qcGdcIik7XHJcblxyXG50eXBlIFNlcnZpY2UgPSB7IGlkOiBudW1iZXI7IHNsdWc6IHN0cmluZzsgZGVwb3NpdF9wZXJjZW50OiBudW1iZXI7IG1pbl9sZWFkX2RheXM6IG51bWJlciB8IG51bGw7IHRpbWVfc2xvdHM6IG51bWJlcltdIH07XHJcblxyXG5hc3luYyBmdW5jdGlvbiBzZXJ2aWNlQnlTbHVnKHBhZ2U6IFBhZ2UsIHNsdWc6IHN0cmluZykge1xyXG4gIGNvbnN0IHNlcnZpY2VzID0gYXdhaXQgYWRtaW5BcGk8U2VydmljZVtdPihwYWdlLCBcIkdFVFwiLCBcInNlcnZpY2VzL1wiKTtcclxuICByZXR1cm4gc2VydmljZXMuZmluZCgocykgPT4gcy5zbHVnID09PSBzbHVnKSE7XHJcbn1cclxuXHJcbmNvbnN0IHNob3duID0gKGxvY2F0b3I6IGltcG9ydChcIkBwbGF5d3JpZ2h0L3Rlc3RcIikuTG9jYXRvcikgPT4gbG9jYXRvci5maWx0ZXIoeyB2aXNpYmxlOiB0cnVlIH0pLmZpcnN0KCk7XHJcblxyXG50ZXN0LmRlc2NyaWJlKFwiU2V0dGluZyB1cCBzZXJ2aWNlc1wiLCAoKSA9PiB7XHJcbiAgdGVzdChcImEgbmV3IGNhdGVnb3J5IHdpdGggYW4gdXBsb2FkZWQgcGhvdG8gYXBwZWFycyBvbiB0aGUgaG9tZXBhZ2VcIiwgYXN5bmMgKHsgcGFnZSwgYnJvd3NlciB9KSA9PiB7XHJcbiAgICBjb25zdCBuYW1lID0gdW5pcXVlKFwiU2Nob29sc1wiKTtcclxuICAgIGF3YWl0IHBhZ2UuZ290byhcIi9hZG1pbi9jYXRlZ29yaWVzL25ld1wiKTtcclxuICAgIGF3YWl0IHBhZ2UuZ2V0QnlMYWJlbChcIk5hbWVcIiwgeyBleGFjdDogdHJ1ZSB9KS5maWxsKG5hbWUpO1xyXG4gICAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKFwiV2hvIGl0J3MgZm9yXCIpLmZpbGwoXCJTY2hvb2wgYnVyc2Fyc1wiKTtcclxuICAgIGF3YWl0IHBhZ2UuZ2V0QnlMYWJlbChcIkRlc2NyaXB0aW9uXCIpLmZpbGwoXCJFbmQtb2YtdGVybSBkZWVwIGNsZWFucyBmb3IgY2xhc3Nyb29tcyBhbmQgaGFsbHMuXCIpO1xyXG4gICAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKFwiQnV0dG9uIHRleHRcIikuZmlsbChcIlByaWNlIGEgc2Nob29sIGNsZWFuXCIpO1xyXG4gICAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoXCJjaGVja2JveFwiLCB7IG5hbWU6IFwiRGVlcCBjbGVhbmluZ1wiIH0pLmNoZWNrKCk7XHJcbiAgICBhd2FpdCBwYWdlLmdldEJ5Um9sZShcImNoZWNrYm94XCIsIHsgbmFtZTogXCJTdGFuZGFyZCBjbGVhbmluZ1wiIH0pLmNoZWNrKCk7XHJcbiAgICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoXCJUaGUgY2FyZCdzIGJ1dHRvbiBvcGVuc1wiKS5zZWxlY3RPcHRpb24oeyBsYWJlbDogXCJEZWVwIGNsZWFuaW5nXCIgfSk7XHJcbiAgICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVRleHQoXCJTYXZlIGZpcnN0LCB0aGVuIHlvdSBjYW4gdXBsb2FkIGEgcGhvdG8uXCIpKS50b0JlVmlzaWJsZSgpO1xyXG4gICAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoXCJidXR0b25cIiwgeyBuYW1lOiBcIlNhdmUgY2F0ZWdvcnlcIiB9KS5maXJzdCgpLmNsaWNrKCk7XHJcbiAgICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVRleHQoXCJDYXRlZ29yeSBjcmVhdGVkXCIpKS50b0JlVmlzaWJsZSgpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UpLnRvSGF2ZVVSTCgvXFwvYWRtaW5cXC9jYXRlZ29yaWVzXFwvXFxkKyQvKTtcclxuICAgIGF3YWl0IHBhZ2UucmVsb2FkKCk7IC8vIGRyb3AgdGhlIGhpZGRlbiBcIm5ldyBjYXRlZ29yeVwiIHBhZ2UgTmV4dC5qcyBrZWVwcyBtb3VudGVkXHJcblxyXG4gICAgLy8gVXBsb2FkIGEgcGhvdG87IDE0MDhweCBpcyBiZWxvdyB0aGUgXCJzaGFycFwiIHRocmVzaG9sZCBzbyB3ZSBnZXQgYSB3YXJuaW5nLlxyXG4gICAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKFwiUGhvdG8gZmlsZVwiKS5zZXRJbnB1dEZpbGVzKFBIT1RPKTtcclxuICAgIGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5VGV4dChcIlBob3RvIHVwbG9hZGVkXCIpKS50b0JlVmlzaWJsZSgpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHNob3duKHBhZ2UuZ2V0QnlUZXh0KC8xNDA4cHggd2lkZSBhbmQgbWF5IGxvb2sgc29mdC8pKSkudG9CZVZpc2libGUoKTtcclxuXHJcbiAgICBjb25zdCB2aXNpdG9yID0gYXdhaXQgYnJvd3Nlci5uZXdQYWdlKCk7XHJcbiAgICBhd2FpdCB2aXNpdG9yLmdvdG8oXCIvXCIpO1xyXG4gICAgY29uc3QgY2FyZCA9IHZpc2l0b3IuZ2V0QnlSb2xlKFwibGlua1wiLCB7IG5hbWU6IG5ldyBSZWdFeHAobmFtZSkgfSk7XHJcbiAgICBhd2FpdCBleHBlY3QoY2FyZCkudG9CZVZpc2libGUoKTtcclxuICAgIGF3YWl0IGV4cGVjdChjYXJkKS50b0hhdmVBdHRyaWJ1dGUoXCJocmVmXCIsIFwiL2Jvb2s/c2VydmljZT1kZWVwLWNsZWFuaW5nXCIpO1xyXG4gICAgYXdhaXQgZXhwZWN0KGNhcmQubG9jYXRvcihcImltZ1wiKSkudG9IYXZlQXR0cmlidXRlKFwic3JjXCIsIC9eXFwvbWVkaWFcXC91cGxvYWRzXFwvY2F0ZWdvcmllc1xcLy4rXFwud2VicCQvKTtcclxuICAgIC8vIFRoZSBicm93c2VyIHBpY2tzIGEgdmVyc2lvbiBmcm9tIHRoZSBzcmNzZXQgYW5kIGl0IGxvYWRzLlxyXG4gICAgY29uc3QgbG9hZGVkID0gYXdhaXQgY2FyZC5sb2NhdG9yKFwiaW1nXCIpLmV2YWx1YXRlKChlbDogSFRNTEltYWdlRWxlbWVudCkgPT4gZWwuZGVjb2RlKCkudGhlbigoKSA9PiBlbC5jdXJyZW50U3JjKSk7XHJcbiAgICBleHBlY3QobG9hZGVkKS50b01hdGNoKC9cXC9tZWRpYVxcL3VwbG9hZHNcXC9jYXRlZ29yaWVzXFwvWzAtOWEtZl0rKC1jYXJkKT9cXC53ZWJwJC8pO1xyXG5cclxuICAgIC8vIEhpZGluZyBpdCB0YWtlcyBpdCBvZmYgdGhlIGhvbWVwYWdlLlxyXG4gICAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoXCJzd2l0Y2hcIiwgeyBuYW1lOiBcIlNob3cgb24gdGhlIGhvbWVwYWdlXCIgfSkuY2xpY2soKTtcclxuICAgIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKFwiYnV0dG9uXCIsIHsgbmFtZTogXCJTYXZlIGNhdGVnb3J5XCIgfSkuZmlyc3QoKS5jbGljaygpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlUZXh0KFwiQ2F0ZWdvcnkgc2F2ZWRcIikpLnRvQmVWaXNpYmxlKCk7XHJcbiAgICBhd2FpdCB2aXNpdG9yLnJlbG9hZCgpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHZpc2l0b3IuZ2V0QnlSb2xlKFwibGlua1wiLCB7IG5hbWU6IG5ldyBSZWdFeHAobmFtZSkgfSkpLnRvSGF2ZUNvdW50KDApO1xyXG4gICAgYXdhaXQgdmlzaXRvci5jbG9zZSgpO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiYW4gdXBsb2FkZWQgc2VydmljZSBwaG90byByZXBsYWNlcyB0aGUgc3RhcnRlciBwaG90byBvbiB0aGUgd2Vic2l0ZVwiLCBhc3luYyAoeyBwYWdlLCBicm93c2VyIH0pID0+IHtcclxuICAgIGNvbnN0IG1vdmUgPSBhd2FpdCBzZXJ2aWNlQnlTbHVnKHBhZ2UsIFwibW92ZS1pbi1tb3ZlLW91dFwiKTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IHBhZ2UuZ290byhgL2FkbWluL3NlcnZpY2VzLyR7bW92ZS5pZH1gKTtcclxuICAgICAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlUZXh0KFwiU2hvd2luZyB0aGUgc3RhcnRlciBwaG90b1wiKSkudG9CZVZpc2libGUoKTtcclxuICAgICAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKFwiUGhvdG8gZmlsZVwiKS5zZXRJbnB1dEZpbGVzKFBIT1RPKTtcclxuICAgICAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlUZXh0KFwiUGhvdG8gdXBsb2FkZWRcIikpLnRvQmVWaXNpYmxlKCk7XHJcblxyXG4gICAgICBjb25zdCB2aXNpdG9yID0gYXdhaXQgYnJvd3Nlci5uZXdQYWdlKCk7XHJcbiAgICAgIGF3YWl0IHZpc2l0b3IuZ290byhcIi9wcmljaW5nXCIpO1xyXG4gICAgICBjb25zdCBjYXJkID0gdmlzaXRvci5sb2NhdG9yKFwiYXJ0aWNsZVwiLCB7IGhhc1RleHQ6IFwiTW92ZS1pbiAvIG1vdmUtb3V0IGNsZWFuaW5nXCIgfSk7XHJcbiAgICAgIGF3YWl0IGV4cGVjdChjYXJkLmxvY2F0b3IoXCJpbWdcIikpLnRvSGF2ZUF0dHJpYnV0ZShcInNyY3NldFwiLCAvLWNhcmRcXC53ZWJwIDk2MHcsIC4rXFwud2VicCAyMDAwdy8pO1xyXG4gICAgICBhd2FpdCB2aXNpdG9yLmNsb3NlKCk7XHJcbiAgICB9IGZpbmFsbHkge1xyXG4gICAgICBhd2FpdCBwYWdlLnJlcXVlc3QuZmV0Y2goYC9hcGkvYWRtaW4vc2VydmljZXMvJHttb3ZlLmlkfS9waG90by9gLCB7XHJcbiAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiLFxyXG4gICAgICAgIGhlYWRlcnM6IHsgXCJYLUNTUkZUb2tlblwiOiAoYXdhaXQgcGFnZS5jb250ZXh0KCkuY29va2llcygpKS5maW5kKChjKSA9PiBjLm5hbWUgPT09IFwiY3NyZnRva2VuXCIpIS52YWx1ZSB9LFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgdGVzdChcInRoZSBwcmljZSB0ZXN0ZXIgc2hvd3MgdGhlIGN1c3RvbWVyJ3MgZXhhY3QgcHJpY2VcIiwgYXN5bmMgKHsgcGFnZSB9KSA9PiB7XHJcbiAgICBjb25zdCBzdGFuZGFyZCA9IGF3YWl0IHNlcnZpY2VCeVNsdWcocGFnZSwgXCJzdGFuZGFyZC1jbGVhbmluZ1wiKTtcclxuICAgIGF3YWl0IHBhZ2UuZ290byhgL2FkbWluL3NlcnZpY2VzLyR7c3RhbmRhcmQuaWR9YCk7XHJcbiAgICBjb25zdCByZXN1bHQgPSBwYWdlLmdldEJ5VGVzdElkKFwicHJpY2UtdGVzdC1yZXN1bHRcIik7XHJcbiAgICAvLyBQbGFjZWhvbGRlciByYXRlczogMTUsMDAwICsgMyByb29tcyDDlyA1LDAwMCArIDQsMDAwICsgNCwwMDAgPSAzOCwwMDAgKyA3LjUlIFZBVFxyXG4gICAgYXdhaXQgZXhwZWN0KHJlc3VsdCkudG9Db250YWluVGV4dChcIkN1c3RvbWVyIHBheXPigqY0MCw4NTBcIik7XHJcbiAgICBhd2FpdCBwYWdlLmdldEJ5Um9sZShcImJ1dHRvblwiLCB7IG5hbWU6IFwiVGVzdCBtb3JlIFJvb21zIC8gd29yayBhcmVhc1wiIH0pLmNsaWNrKCk7XHJcbiAgICBhd2FpdCBleHBlY3QocmVzdWx0KS50b0NvbnRhaW5UZXh0KFwiQ3VzdG9tZXIgcGF5c+KCpjQ2LDIyNVwiKTtcclxuICAgIGF3YWl0IHBhZ2UuZ2V0QnlMYWJlbChcIlRlc3QgZnJlcXVlbmN5XCIpLnNlbGVjdE9wdGlvbih7IGxhYmVsOiBcIldlZWtseVwiIH0pO1xyXG4gICAgYXdhaXQgZXhwZWN0KHJlc3VsdCkudG9Db250YWluVGV4dChcIsOXIDQgdmlzaXRzXCIpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHJlc3VsdCkudG9Db250YWluVGV4dChcIkZyZXF1ZW5jeSBkaXNjb3VudFwiKTtcclxuICB9KTtcclxuXHJcbiAgdGVzdChcImEgc2VydmljZS1zcGVjaWZpYyBhcmVhIHN1cmNoYXJnZSBzaG93cyBpbiB0aGUgdGVzdGVyIGFuZCB0aGUgYm9va2luZyBjYWxjdWxhdG9yXCIsIGFzeW5jICh7IHBhZ2UsIGJyb3dzZXIgfSkgPT4ge1xyXG4gICAgY29uc3Qgc3RhbmRhcmQgPSBhd2FpdCBzZXJ2aWNlQnlTbHVnKHBhZ2UsIFwic3RhbmRhcmQtY2xlYW5pbmdcIik7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBwYWdlLmdvdG8oYC9hZG1pbi9zZXJ2aWNlcy8ke3N0YW5kYXJkLmlkfT90YWI9Ym9va2luZ2ApO1xyXG4gICAgICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoXCJTdXJjaGFyZ2UgZm9yIEFqYWhcIikuZmlsbChcIjcwMDBcIik7XHJcbiAgICAgIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKFwiYnV0dG9uXCIsIHsgbmFtZTogXCJTYXZlIHNlcnZpY2VcIiB9KS5maXJzdCgpLmNsaWNrKCk7XHJcbiAgICAgIGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5VGV4dChcIlNlcnZpY2Ugc2F2ZWRcIikpLnRvQmVWaXNpYmxlKCk7XHJcbiAgICAgIGF3YWl0IHBhZ2UuZ2V0QnlMYWJlbChcIlRlc3QgYXJlYVwiKS5zZWxlY3RPcHRpb24oeyBsYWJlbDogXCJBamFoXCIgfSk7XHJcbiAgICAgIGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5VGVzdElkKFwicHJpY2UtdGVzdC1yZXN1bHRcIikpLnRvQ29udGFpblRleHQoXCJBcmVhIHN1cmNoYXJnZeKCpjcsMDAwXCIpO1xyXG5cclxuICAgICAgY29uc3QgdmlzaXRvciA9IGF3YWl0IGJyb3dzZXIubmV3UGFnZSgpO1xyXG4gICAgICBhd2FpdCB2aXNpdG9yLmdvdG8oXCIvYm9vaz9zZXJ2aWNlPXN0YW5kYXJkLWNsZWFuaW5nXCIpO1xyXG4gICAgICBhd2FpdCB2aXNpdG9yLmdldEJ5TGFiZWwoXCJBcmVhIGluIExhZ29zXCIpLnNlbGVjdE9wdGlvbih7IGxhYmVsOiBcIkFqYWhcIiB9KTtcclxuICAgICAgYXdhaXQgZXhwZWN0KHZpc2libGUodmlzaXRvciwgXCJhc2lkZVwiKSkudG9Db250YWluVGV4dChcIlRyYXZlbCAoQWphaCnigqY3LDAwMFwiKTtcclxuICAgICAgYXdhaXQgdmlzaXRvci5jbG9zZSgpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgYXdhaXQgYWRtaW5BcGkocGFnZSwgXCJQQVRDSFwiLCBgc2VydmljZXMvJHtzdGFuZGFyZC5pZH0vYCwgeyBhcmVhX3ByaWNlczogW10gfSk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJhIGRlcG9zaXQgbGV0cyBjdXN0b21lcnMgcGF5IHBhcnQgbm93IGFuZCB0aGUgcmVzdCBvbiBjb21wbGV0aW9uXCIsIGFzeW5jICh7IHBhZ2UsIGJyb3dzZXIgfSkgPT4ge1xyXG4gICAgY29uc3QgZGVlcCA9IGF3YWl0IHNlcnZpY2VCeVNsdWcocGFnZSwgXCJkZWVwLWNsZWFuaW5nXCIpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgYXdhaXQgcGFnZS5nb3RvKGAvYWRtaW4vc2VydmljZXMvJHtkZWVwLmlkfT90YWI9Ym9va2luZ2ApO1xyXG4gICAgICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoXCJEZXBvc2l0IHRvIGNvbmZpcm0gKCUpXCIsIHsgZXhhY3Q6IHRydWUgfSkuZmlsbChcIjMwXCIpO1xyXG4gICAgICBhd2FpdCBwYWdlLmdldEJ5Um9sZShcImJ1dHRvblwiLCB7IG5hbWU6IFwiU2F2ZSBzZXJ2aWNlXCIgfSkuZmlyc3QoKS5jbGljaygpO1xyXG4gICAgICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVRleHQoXCJTZXJ2aWNlIHNhdmVkXCIpKS50b0JlVmlzaWJsZSgpO1xyXG4gICAgICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVRleHQoXCIzMCUgZGVwb3NpdCBvbmxpbmUsIHJlc3Qgb24gY29tcGxldGlvblwiKSkudG9CZVZpc2libGUoKTtcclxuXHJcbiAgICAgIGNvbnN0IGN1c3RvbWVyID0gYXdhaXQgYnJvd3Nlci5uZXdQYWdlKCk7XHJcbiAgICAgIGF3YWl0IGN1c3RvbWVyLmdvdG8oXCIvYm9vaz9zZXJ2aWNlPWRlZXAtY2xlYW5pbmdcIik7XHJcbiAgICAgIGF3YWl0IGN1c3RvbWVyLmdldEJ5TGFiZWwoXCJBcmVhIGluIExhZ29zXCIpLnNlbGVjdE9wdGlvbih7IGxhYmVsOiBcIklrb3lpXCIgfSk7XHJcbiAgICAgIGNvbnN0IHNwbGl0ID0gY3VzdG9tZXIuZ2V0QnlUZXN0SWQoXCJkZXBvc2l0LXNwbGl0XCIpLmZpbHRlcih7IHZpc2libGU6IHRydWUgfSk7XHJcbiAgICAgIGF3YWl0IGV4cGVjdChzcGxpdCkudG9Db250YWluVGV4dChcIlBheSBub3cgKDMwJSBkZXBvc2l0KVwiKTtcclxuICAgICAgY29uc3QgZGVwb3NpdFRleHQgPSAoYXdhaXQgc3BsaXQubG9jYXRvcihcInNwYW4udGFidWxhclwiKS5maXJzdCgpLnRleHRDb250ZW50KCkpITtcclxuICAgICAgYXdhaXQgY3VzdG9tZXIuZ2V0QnlSb2xlKFwiYnV0dG9uXCIsIHsgbmFtZTogXCJDb250aW51ZVwiIH0pLmNsaWNrKCk7XHJcbiAgICAgIGF3YWl0IGN1c3RvbWVyLmdldEJ5TGFiZWwoXCJDb250YWN0IG5hbWVcIikuZmlsbCh1bmlxdWUoXCJEZXBvc2l0IFBheWVyXCIpKTtcclxuICAgICAgYXdhaXQgY3VzdG9tZXIuZ2V0QnlMYWJlbChcIlBob25lIChXaGF0c0FwcClcIikuZmlsbChcIjA4MDMwMDAwMDAwXCIpO1xyXG4gICAgICBhd2FpdCBjdXN0b21lci5nZXRCeUxhYmVsKFwiRW1haWwgZm9yIHlvdXIgcmVjZWlwdFwiKS5maWxsKFwiZGVwb3NpdEBlMmUua2xlYW5kZWNrLnRlc3RcIik7XHJcbiAgICAgIGF3YWl0IGN1c3RvbWVyLmdldEJ5TGFiZWwoXCJBZGRyZXNzIG9mIHRoZSBzcGFjZVwiKS5maWxsKFwiMSBCb3VyZGlsbG9uIFJvYWRcIik7XHJcbiAgICAgIGF3YWl0IGN1c3RvbWVyLmdldEJ5Um9sZShcImNoZWNrYm94XCIsIHsgbmFtZTogL1J1bm5pbmcgd2F0ZXIgYW5kIGVsZWN0cmljaXR5LyB9KS5jaGVjaygpO1xyXG4gICAgICBhd2FpdCBjdXN0b21lci5nZXRCeVJvbGUoXCJjaGVja2JveFwiLCB7IG5hbWU6IC9JIGFncmVlIHRvIEtsZWFuZGVjay8gfSkuY2hlY2soKTtcclxuICAgICAgYXdhaXQgY3VzdG9tZXIuZ2V0QnlSb2xlKFwiYnV0dG9uXCIsIHsgbmFtZTogYFBheSAke2RlcG9zaXRUZXh0fSBkZXBvc2l0IHdpdGggUGF5c3RhY2tgIH0pLmNsaWNrKCk7XHJcblxyXG4gICAgICBhd2FpdCBleHBlY3QoY3VzdG9tZXIpLnRvSGF2ZVVSTChuZXcgUmVnRXhwKGBeJHtGQUtFX1BBWVNUQUNLfS9jaGVja291dC9gKSk7XHJcbiAgICAgIGF3YWl0IGV4cGVjdChjdXN0b21lci5nZXRCeVRlc3RJZChcImFtb3VudFwiKSkudG9IYXZlVGV4dChkZXBvc2l0VGV4dCk7XHJcbiAgICAgIGF3YWl0IGN1c3RvbWVyLmxvY2F0b3IoXCIjcGF5XCIpLmNsaWNrKCk7XHJcbiAgICAgIGF3YWl0IGV4cGVjdChjdXN0b21lci5nZXRCeVJvbGUoXCJoZWFkaW5nXCIsIHsgbmFtZTogL1lvdSdyZSBib29rZWQvIH0pKS50b0JlVmlzaWJsZSgpO1xyXG4gICAgICBhd2FpdCBleHBlY3QoY3VzdG9tZXIuZ2V0QnlUZXh0KGBXZSd2ZSByZWNlaXZlZCB5b3VyICR7ZGVwb3NpdFRleHR9IGRlcG9zaXQuYCwgeyBleGFjdDogZmFsc2UgfSkpLnRvQmVWaXNpYmxlKCk7XHJcbiAgICAgIGF3YWl0IGV4cGVjdChjdXN0b21lci5nZXRCeVRleHQoL1RoZSBiYWxhbmNlIG9mIOKCpltcXGQsXSsgaXMgZHVlIG9uIGNvbXBsZXRpb24vKSkudG9CZVZpc2libGUoKTtcclxuICAgICAgYXdhaXQgY3VzdG9tZXIuY2xvc2UoKTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIGF3YWl0IGFkbWluQXBpKHBhZ2UsIFwiUEFUQ0hcIiwgYHNlcnZpY2VzLyR7ZGVlcC5pZH0vYCwgeyBkZXBvc2l0X3BlcmNlbnQ6IDAgfSk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJ0aW1lIHNsb3RzIGFuZCBlYXJsaWVzdCBib29raW5nIGNhbiBiZSBzZXQgcGVyIHNlcnZpY2VcIiwgYXN5bmMgKHsgcGFnZSwgYnJvd3NlciB9KSA9PiB7XHJcbiAgICBjb25zdCBkZWVwID0gYXdhaXQgc2VydmljZUJ5U2x1ZyhwYWdlLCBcImRlZXAtY2xlYW5pbmdcIik7XHJcbiAgICBjb25zdCBzbG90TmFtZSA9IHVuaXF1ZShcIkVhcmx5IGJpcmRcIik7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBwYWdlLmdvdG8oXCIvYWRtaW4vc2V0dGluZ3M/dGFiPXRpbWUtc2xvdHNcIik7XHJcbiAgICAgIGF3YWl0IHBhZ2UuZ2V0QnlQbGFjZWhvbGRlcihcIk5ldyB0aW1lIHNsb3QsIGUuZy4gRWFybHkgbW9ybmluZ1wiKS5maWxsKHNsb3ROYW1lKTtcclxuICAgICAgYXdhaXQgcGFnZS5nZXRCeUxhYmVsKFwiSG91cnNcIikubGFzdCgpLmZpbGwoXCI2YW0g4oCTIDhhbVwiKTtcclxuICAgICAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoXCJidXR0b25cIiwgeyBuYW1lOiBcIlNhdmVcIiB9KS5jbGljaygpO1xyXG4gICAgICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVRleHQoXCJUaW1lIHNsb3QgYWRkZWRcIikpLnRvQmVWaXNpYmxlKCk7XHJcblxyXG4gICAgICBhd2FpdCBwYWdlLmdvdG8oYC9hZG1pbi9zZXJ2aWNlcy8ke2RlZXAuaWR9P3RhYj1ib29raW5nYCk7XHJcbiAgICAgIGNvbnN0IGJvb2tpbmcgPSBwYWdlLmxvY2F0b3IoXCJzZWN0aW9uXCIsIHsgaGFzVGV4dDogXCJBcnJpdmFsIHRpbWVzXCIgfSk7XHJcbiAgICAgIGF3YWl0IGJvb2tpbmcuZ2V0QnlUZXh0KHNsb3ROYW1lKS5jbGljaygpO1xyXG4gICAgICBhd2FpdCBwYWdlLmdldEJ5TGFiZWwoXCJFYXJsaWVzdCBib29raW5nXCIsIHsgZXhhY3Q6IHRydWUgfSkuZmlsbChcIjVcIik7XHJcbiAgICAgIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKFwiYnV0dG9uXCIsIHsgbmFtZTogXCJTYXZlIHNlcnZpY2VcIiB9KS5maXJzdCgpLmNsaWNrKCk7XHJcbiAgICAgIGF3YWl0IGV4cGVjdChwYWdlLmdldEJ5VGV4dChcIlNlcnZpY2Ugc2F2ZWRcIikpLnRvQmVWaXNpYmxlKCk7XHJcblxyXG4gICAgICBjb25zdCBjdXN0b21lciA9IGF3YWl0IGJyb3dzZXIubmV3UGFnZSgpO1xyXG4gICAgICBhd2FpdCBjdXN0b21lci5nb3RvKFwiL2Jvb2s/c2VydmljZT1kZWVwLWNsZWFuaW5nXCIpO1xyXG4gICAgICBhd2FpdCBjdXN0b21lci5nZXRCeUxhYmVsKFwiQXJlYSBpbiBMYWdvc1wiKS5zZWxlY3RPcHRpb24oeyBsYWJlbDogXCJJa295aVwiIH0pO1xyXG4gICAgICBhd2FpdCBjdXN0b21lci5nZXRCeVJvbGUoXCJidXR0b25cIiwgeyBuYW1lOiBcIkNvbnRpbnVlXCIgfSkuY2xpY2soKTtcclxuICAgICAgY29uc3QgcmFkaW9zID0gY3VzdG9tZXIuZ2V0QnlSb2xlKFwicmFkaW9cIik7XHJcbiAgICAgIGF3YWl0IGV4cGVjdChyYWRpb3MpLnRvSGF2ZUNvdW50KDEpO1xyXG4gICAgICBhd2FpdCBleHBlY3QoY3VzdG9tZXIuZ2V0QnlUZXh0KHNsb3ROYW1lKSkudG9CZVZpc2libGUoKTtcclxuICAgICAgY29uc3QgbWluID0gYXdhaXQgY3VzdG9tZXIuZ2V0QnlMYWJlbChcIkRhdGVcIikuZ2V0QXR0cmlidXRlKFwibWluXCIpO1xyXG4gICAgICBjb25zdCBkYXlzID0gTWF0aC5yb3VuZCgoRGF0ZS5wYXJzZShtaW4hKSAtIERhdGUucGFyc2UobmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKSkpIC8gODZfNDAwXzAwMCk7XHJcbiAgICAgIGV4cGVjdChkYXlzKS50b0JlR3JlYXRlclRoYW5PckVxdWFsKDUpO1xyXG4gICAgICBhd2FpdCBjdXN0b21lci5jbG9zZSgpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgYXdhaXQgYWRtaW5BcGkocGFnZSwgXCJQQVRDSFwiLCBgc2VydmljZXMvJHtkZWVwLmlkfS9gLCB7IHRpbWVfc2xvdHM6IFtdLCBtaW5fbGVhZF9kYXlzOiBudWxsIH0pO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiZHVwbGljYXRpbmcgYSBzZXJ2aWNlIGNyZWF0ZXMgYSBoaWRkZW4gZHJhZnQgdG8gZWRpdFwiLCBhc3luYyAoeyBwYWdlIH0pID0+IHtcclxuICAgIGNvbnN0IHN0YW5kYXJkID0gYXdhaXQgc2VydmljZUJ5U2x1ZyhwYWdlLCBcInN0YW5kYXJkLWNsZWFuaW5nXCIpO1xyXG4gICAgYXdhaXQgcGFnZS5nb3RvKGAvYWRtaW4vc2VydmljZXMvJHtzdGFuZGFyZC5pZH1gKTtcclxuICAgIGF3YWl0IHBhZ2UuZ2V0QnlSb2xlKFwiYnV0dG9uXCIsIHsgbmFtZTogXCJEdXBsaWNhdGVcIiB9KS5jbGljaygpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlSb2xlKFwiaGVhZGluZ1wiLCB7IGxldmVsOiAxLCBuYW1lOiAvU3RhbmRhcmQgY2xlYW5pbmcgXFwoY29weVxcKS8gfSkpLnRvQmVWaXNpYmxlKCk7XHJcbiAgICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVJvbGUoXCJzd2l0Y2hcIiwgeyBuYW1lOiBcIlNob3cgb24gdGhlIHdlYnNpdGVcIiB9KSkudG9IYXZlQXR0cmlidXRlKFwiYXJpYS1jaGVja2VkXCIsIFwiZmFsc2VcIik7XHJcbiAgICBhd2FpdCBwYWdlLmdldEJ5Um9sZShcInRhYlwiLCB7IG5hbWU6IC9QcmljaW5nLyB9KS5jbGljaygpO1xyXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UuZ2V0QnlMYWJlbChcIkxhYmVsXCIsIHsgZXhhY3Q6IHRydWUgfSkuZmlsdGVyKHsgdmlzaWJsZTogdHJ1ZSB9KSkudG9IYXZlQ291bnQoMyk7XHJcblxyXG4gICAgLy8gQ2xlYW4gdXAgdGhlIGRyYWZ0LlxyXG4gICAgYXdhaXQgcGFnZS5nZXRCeVJvbGUoXCJidXR0b25cIiwgeyBuYW1lOiBcIkRlbGV0ZVwiIH0pLmNsaWNrKCk7XHJcbiAgICBhd2FpdCBleHBlY3QocGFnZSkudG9IYXZlVVJMKC9cXC9hZG1pblxcL3NlcnZpY2VzJC8pO1xyXG4gIH0pO1xyXG59KTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBLElBQUFBLFNBQUEsR0FBQUMsc0JBQUEsQ0FBQUMsT0FBQTtBQUVBLElBQUFDLEtBQUEsR0FBQUQsT0FBQTtBQUVBLElBQUFFLFFBQUEsR0FBQUYsT0FBQTtBQUE0RSxTQUFBRCx1QkFBQUksQ0FBQSxXQUFBQSxDQUFBLElBQUFBLENBQUEsQ0FBQUMsVUFBQSxHQUFBRCxDQUFBLEtBQUFFLE9BQUEsRUFBQUYsQ0FBQTtBQUU1RUcsVUFBSSxDQUFDQyxHQUFHLENBQUM7RUFBRUMsWUFBWSxFQUFFQyxjQUFLLENBQUNEO0FBQWEsQ0FBQyxDQUFDO0FBRTlDLE1BQU1FLEtBQUssR0FBR0MsaUJBQUksQ0FBQ0MsSUFBSSxDQUFDQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxnQkFBZ0IsQ0FBQztBQUl0RSxlQUFlQyxhQUFhQSxDQUFDQyxJQUFVLEVBQUVDLElBQVksRUFBRTtFQUNyRCxNQUFNQyxRQUFRLEdBQUcsTUFBTSxJQUFBQyxpQkFBUSxFQUFZSCxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsQ0FBQztFQUNwRSxPQUFPRSxRQUFRLENBQUNFLElBQUksQ0FBRUMsQ0FBQyxJQUFLQSxDQUFDLENBQUNKLElBQUksS0FBS0EsSUFBSSxDQUFDO0FBQzlDO0FBRUEsTUFBTUssS0FBSyxHQUFJQyxPQUEyQyxJQUFLQSxPQUFPLENBQUNDLE1BQU0sQ0FBQztFQUFFQyxPQUFPLEVBQUU7QUFBSyxDQUFDLENBQUMsQ0FBQ0MsS0FBSyxDQUFDLENBQUM7QUFFeEduQixVQUFJLENBQUNvQixRQUFRLENBQUMscUJBQXFCLEVBQUUsTUFBTTtFQUN6QyxJQUFBcEIsVUFBSSxFQUFDLCtEQUErRCxFQUFFLE9BQU87SUFBRVMsSUFBSTtJQUFFWTtFQUFRLENBQUMsS0FBSztJQUNqRyxNQUFNQyxJQUFJLEdBQUcsSUFBQUMsZUFBTSxFQUFDLFNBQVMsQ0FBQztJQUM5QixNQUFNZCxJQUFJLENBQUNlLElBQUksQ0FBQyx1QkFBdUIsQ0FBQztJQUN4QyxNQUFNZixJQUFJLENBQUNnQixVQUFVLENBQUMsTUFBTSxFQUFFO01BQUVDLEtBQUssRUFBRTtJQUFLLENBQUMsQ0FBQyxDQUFDQyxJQUFJLENBQUNMLElBQUksQ0FBQztJQUN6RCxNQUFNYixJQUFJLENBQUNnQixVQUFVLENBQUMsY0FBYyxDQUFDLENBQUNFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztJQUM1RCxNQUFNbEIsSUFBSSxDQUFDZ0IsVUFBVSxDQUFDLGFBQWEsQ0FBQyxDQUFDRSxJQUFJLENBQUMsbURBQW1ELENBQUM7SUFDOUYsTUFBTWxCLElBQUksQ0FBQ2dCLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQ0UsSUFBSSxDQUFDLHNCQUFzQixDQUFDO0lBQ2pFLE1BQU1sQixJQUFJLENBQUNtQixTQUFTLENBQUMsVUFBVSxFQUFFO01BQUVOLElBQUksRUFBRTtJQUFnQixDQUFDLENBQUMsQ0FBQ08sS0FBSyxDQUFDLENBQUM7SUFDbkUsTUFBTXBCLElBQUksQ0FBQ21CLFNBQVMsQ0FBQyxVQUFVLEVBQUU7TUFBRU4sSUFBSSxFQUFFO0lBQW9CLENBQUMsQ0FBQyxDQUFDTyxLQUFLLENBQUMsQ0FBQztJQUN2RSxNQUFNcEIsSUFBSSxDQUFDZ0IsVUFBVSxDQUFDLHlCQUF5QixDQUFDLENBQUNLLFlBQVksQ0FBQztNQUFFQyxLQUFLLEVBQUU7SUFBZ0IsQ0FBQyxDQUFDO0lBQ3pGLE1BQU0sSUFBQUMsWUFBTSxFQUFDdkIsSUFBSSxDQUFDd0IsU0FBUyxDQUFDLDBDQUEwQyxDQUFDLENBQUMsQ0FBQ0MsV0FBVyxDQUFDLENBQUM7SUFDdEYsTUFBTXpCLElBQUksQ0FBQ21CLFNBQVMsQ0FBQyxRQUFRLEVBQUU7TUFBRU4sSUFBSSxFQUFFO0lBQWdCLENBQUMsQ0FBQyxDQUFDSCxLQUFLLENBQUMsQ0FBQyxDQUFDZ0IsS0FBSyxDQUFDLENBQUM7SUFDekUsTUFBTSxJQUFBSCxZQUFNLEVBQUN2QixJQUFJLENBQUN3QixTQUFTLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDQyxXQUFXLENBQUMsQ0FBQztJQUM5RCxNQUFNLElBQUFGLFlBQU0sRUFBQ3ZCLElBQUksQ0FBQyxDQUFDMkIsU0FBUyxDQUFDLDJCQUEyQixDQUFDO0lBQ3pELE1BQU0zQixJQUFJLENBQUM0QixNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7O0lBRXJCO0lBQ0EsTUFBTTVCLElBQUksQ0FBQ2dCLFVBQVUsQ0FBQyxZQUFZLENBQUMsQ0FBQ2EsYUFBYSxDQUFDbEMsS0FBSyxDQUFDO0lBQ3hELE1BQU0sSUFBQTRCLFlBQU0sRUFBQ3ZCLElBQUksQ0FBQ3dCLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUNDLFdBQVcsQ0FBQyxDQUFDO0lBQzVELE1BQU0sSUFBQUYsWUFBTSxFQUFDakIsS0FBSyxDQUFDTixJQUFJLENBQUN3QixTQUFTLENBQUMsK0JBQStCLENBQUMsQ0FBQyxDQUFDLENBQUNDLFdBQVcsQ0FBQyxDQUFDO0lBRWxGLE1BQU1LLE9BQU8sR0FBRyxNQUFNbEIsT0FBTyxDQUFDbUIsT0FBTyxDQUFDLENBQUM7SUFDdkMsTUFBTUQsT0FBTyxDQUFDZixJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ3ZCLE1BQU1pQixJQUFJLEdBQUdGLE9BQU8sQ0FBQ1gsU0FBUyxDQUFDLE1BQU0sRUFBRTtNQUFFTixJQUFJLEVBQUUsSUFBSW9CLE1BQU0sQ0FBQ3BCLElBQUk7SUFBRSxDQUFDLENBQUM7SUFDbEUsTUFBTSxJQUFBVSxZQUFNLEVBQUNTLElBQUksQ0FBQyxDQUFDUCxXQUFXLENBQUMsQ0FBQztJQUNoQyxNQUFNLElBQUFGLFlBQU0sRUFBQ1MsSUFBSSxDQUFDLENBQUNFLGVBQWUsQ0FBQyxNQUFNLEVBQUUsNkJBQTZCLENBQUM7SUFDekUsTUFBTSxJQUFBWCxZQUFNLEVBQUNTLElBQUksQ0FBQ3pCLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDMkIsZUFBZSxDQUFDLEtBQUssRUFBRSwwQ0FBMEMsQ0FBQztJQUNwRztJQUNBLE1BQU1DLE1BQU0sR0FBRyxNQUFNSCxJQUFJLENBQUN6QixPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM2QixRQUFRLENBQUVDLEVBQW9CLElBQUtBLEVBQUUsQ0FBQ0MsTUFBTSxDQUFDLENBQUMsQ0FBQ0MsSUFBSSxDQUFDLE1BQU1GLEVBQUUsQ0FBQ0csVUFBVSxDQUFDLENBQUM7SUFDbEgsSUFBQWpCLFlBQU0sRUFBQ1ksTUFBTSxDQUFDLENBQUNNLE9BQU8sQ0FBQyx3REFBd0QsQ0FBQzs7SUFFaEY7SUFDQSxNQUFNekMsSUFBSSxDQUFDbUIsU0FBUyxDQUFDLFFBQVEsRUFBRTtNQUFFTixJQUFJLEVBQUU7SUFBdUIsQ0FBQyxDQUFDLENBQUNhLEtBQUssQ0FBQyxDQUFDO0lBQ3hFLE1BQU0xQixJQUFJLENBQUNtQixTQUFTLENBQUMsUUFBUSxFQUFFO01BQUVOLElBQUksRUFBRTtJQUFnQixDQUFDLENBQUMsQ0FBQ0gsS0FBSyxDQUFDLENBQUMsQ0FBQ2dCLEtBQUssQ0FBQyxDQUFDO0lBQ3pFLE1BQU0sSUFBQUgsWUFBTSxFQUFDdkIsSUFBSSxDQUFDd0IsU0FBUyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQ0MsV0FBVyxDQUFDLENBQUM7SUFDNUQsTUFBTUssT0FBTyxDQUFDRixNQUFNLENBQUMsQ0FBQztJQUN0QixNQUFNLElBQUFMLFlBQU0sRUFBQ08sT0FBTyxDQUFDWCxTQUFTLENBQUMsTUFBTSxFQUFFO01BQUVOLElBQUksRUFBRSxJQUFJb0IsTUFBTSxDQUFDcEIsSUFBSTtJQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM2QixXQUFXLENBQUMsQ0FBQyxDQUFDO0lBQ2xGLE1BQU1aLE9BQU8sQ0FBQ2EsS0FBSyxDQUFDLENBQUM7RUFDdkIsQ0FBQyxDQUFDO0VBRUYsSUFBQXBELFVBQUksRUFBQyxxRUFBcUUsRUFBRSxPQUFPO0lBQUVTLElBQUk7SUFBRVk7RUFBUSxDQUFDLEtBQUs7SUFDdkcsTUFBTWdDLElBQUksR0FBRyxNQUFNN0MsYUFBYSxDQUFDQyxJQUFJLEVBQUUsa0JBQWtCLENBQUM7SUFDMUQsSUFBSTtNQUNGLE1BQU1BLElBQUksQ0FBQ2UsSUFBSSxDQUFDLG1CQUFtQjZCLElBQUksQ0FBQ0MsRUFBRSxFQUFFLENBQUM7TUFDN0MsTUFBTSxJQUFBdEIsWUFBTSxFQUFDdkIsSUFBSSxDQUFDd0IsU0FBUyxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQ0MsV0FBVyxDQUFDLENBQUM7TUFDdkUsTUFBTXpCLElBQUksQ0FBQ2dCLFVBQVUsQ0FBQyxZQUFZLENBQUMsQ0FBQ2EsYUFBYSxDQUFDbEMsS0FBSyxDQUFDO01BQ3hELE1BQU0sSUFBQTRCLFlBQU0sRUFBQ3ZCLElBQUksQ0FBQ3dCLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUNDLFdBQVcsQ0FBQyxDQUFDO01BRTVELE1BQU1LLE9BQU8sR0FBRyxNQUFNbEIsT0FBTyxDQUFDbUIsT0FBTyxDQUFDLENBQUM7TUFDdkMsTUFBTUQsT0FBTyxDQUFDZixJQUFJLENBQUMsVUFBVSxDQUFDO01BQzlCLE1BQU1pQixJQUFJLEdBQUdGLE9BQU8sQ0FBQ3ZCLE9BQU8sQ0FBQyxTQUFTLEVBQUU7UUFBRXVDLE9BQU8sRUFBRTtNQUE4QixDQUFDLENBQUM7TUFDbkYsTUFBTSxJQUFBdkIsWUFBTSxFQUFDUyxJQUFJLENBQUN6QixPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQzJCLGVBQWUsQ0FBQyxRQUFRLEVBQUUsa0NBQWtDLENBQUM7TUFDL0YsTUFBTUosT0FBTyxDQUFDYSxLQUFLLENBQUMsQ0FBQztJQUN2QixDQUFDLFNBQVM7TUFDUixNQUFNM0MsSUFBSSxDQUFDK0MsT0FBTyxDQUFDQyxLQUFLLENBQUMsdUJBQXVCSixJQUFJLENBQUNDLEVBQUUsU0FBUyxFQUFFO1FBQ2hFSSxNQUFNLEVBQUUsUUFBUTtRQUNoQkMsT0FBTyxFQUFFO1VBQUUsYUFBYSxFQUFFLENBQUMsTUFBTWxELElBQUksQ0FBQ21ELE9BQU8sQ0FBQyxDQUFDLENBQUNDLE9BQU8sQ0FBQyxDQUFDLEVBQUVoRCxJQUFJLENBQUVpRCxDQUFDLElBQUtBLENBQUMsQ0FBQ3hDLElBQUksS0FBSyxXQUFXLENBQUMsQ0FBRXlDO1FBQU07TUFDeEcsQ0FBQyxDQUFDO0lBQ0o7RUFDRixDQUFDLENBQUM7RUFFRixJQUFBL0QsVUFBSSxFQUFDLG1EQUFtRCxFQUFFLE9BQU87SUFBRVM7RUFBSyxDQUFDLEtBQUs7SUFDNUUsTUFBTXVELFFBQVEsR0FBRyxNQUFNeEQsYUFBYSxDQUFDQyxJQUFJLEVBQUUsbUJBQW1CLENBQUM7SUFDL0QsTUFBTUEsSUFBSSxDQUFDZSxJQUFJLENBQUMsbUJBQW1Cd0MsUUFBUSxDQUFDVixFQUFFLEVBQUUsQ0FBQztJQUNqRCxNQUFNVyxNQUFNLEdBQUd4RCxJQUFJLENBQUN5RCxXQUFXLENBQUMsbUJBQW1CLENBQUM7SUFDcEQ7SUFDQSxNQUFNLElBQUFsQyxZQUFNLEVBQUNpQyxNQUFNLENBQUMsQ0FBQ0UsYUFBYSxDQUFDLHNCQUFzQixDQUFDO0lBQzFELE1BQU0xRCxJQUFJLENBQUNtQixTQUFTLENBQUMsUUFBUSxFQUFFO01BQUVOLElBQUksRUFBRTtJQUErQixDQUFDLENBQUMsQ0FBQ2EsS0FBSyxDQUFDLENBQUM7SUFDaEYsTUFBTSxJQUFBSCxZQUFNLEVBQUNpQyxNQUFNLENBQUMsQ0FBQ0UsYUFBYSxDQUFDLHNCQUFzQixDQUFDO0lBQzFELE1BQU0xRCxJQUFJLENBQUNnQixVQUFVLENBQUMsZ0JBQWdCLENBQUMsQ0FBQ0ssWUFBWSxDQUFDO01BQUVDLEtBQUssRUFBRTtJQUFTLENBQUMsQ0FBQztJQUN6RSxNQUFNLElBQUFDLFlBQU0sRUFBQ2lDLE1BQU0sQ0FBQyxDQUFDRSxhQUFhLENBQUMsWUFBWSxDQUFDO0lBQ2hELE1BQU0sSUFBQW5DLFlBQU0sRUFBQ2lDLE1BQU0sQ0FBQyxDQUFDRSxhQUFhLENBQUMsb0JBQW9CLENBQUM7RUFDMUQsQ0FBQyxDQUFDO0VBRUYsSUFBQW5FLFVBQUksRUFBQyxrRkFBa0YsRUFBRSxPQUFPO0lBQUVTLElBQUk7SUFBRVk7RUFBUSxDQUFDLEtBQUs7SUFDcEgsTUFBTTJDLFFBQVEsR0FBRyxNQUFNeEQsYUFBYSxDQUFDQyxJQUFJLEVBQUUsbUJBQW1CLENBQUM7SUFDL0QsSUFBSTtNQUNGLE1BQU1BLElBQUksQ0FBQ2UsSUFBSSxDQUFDLG1CQUFtQndDLFFBQVEsQ0FBQ1YsRUFBRSxjQUFjLENBQUM7TUFDN0QsTUFBTTdDLElBQUksQ0FBQ2dCLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDRSxJQUFJLENBQUMsTUFBTSxDQUFDO01BQ3hELE1BQU1sQixJQUFJLENBQUNtQixTQUFTLENBQUMsUUFBUSxFQUFFO1FBQUVOLElBQUksRUFBRTtNQUFlLENBQUMsQ0FBQyxDQUFDSCxLQUFLLENBQUMsQ0FBQyxDQUFDZ0IsS0FBSyxDQUFDLENBQUM7TUFDeEUsTUFBTSxJQUFBSCxZQUFNLEVBQUN2QixJQUFJLENBQUN3QixTQUFTLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQ0MsV0FBVyxDQUFDLENBQUM7TUFDM0QsTUFBTXpCLElBQUksQ0FBQ2dCLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQ0ssWUFBWSxDQUFDO1FBQUVDLEtBQUssRUFBRTtNQUFPLENBQUMsQ0FBQztNQUNsRSxNQUFNLElBQUFDLFlBQU0sRUFBQ3ZCLElBQUksQ0FBQ3lELFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUNDLGFBQWEsQ0FBQyxzQkFBc0IsQ0FBQztNQUV6RixNQUFNNUIsT0FBTyxHQUFHLE1BQU1sQixPQUFPLENBQUNtQixPQUFPLENBQUMsQ0FBQztNQUN2QyxNQUFNRCxPQUFPLENBQUNmLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQztNQUNyRCxNQUFNZSxPQUFPLENBQUNkLFVBQVUsQ0FBQyxlQUFlLENBQUMsQ0FBQ0ssWUFBWSxDQUFDO1FBQUVDLEtBQUssRUFBRTtNQUFPLENBQUMsQ0FBQztNQUN6RSxNQUFNLElBQUFDLFlBQU0sRUFBQyxJQUFBZCxnQkFBTyxFQUFDcUIsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM0QixhQUFhLENBQUMscUJBQXFCLENBQUM7TUFDNUUsTUFBTTVCLE9BQU8sQ0FBQ2EsS0FBSyxDQUFDLENBQUM7SUFDdkIsQ0FBQyxTQUFTO01BQ1IsTUFBTSxJQUFBeEMsaUJBQVEsRUFBQ0gsSUFBSSxFQUFFLE9BQU8sRUFBRSxZQUFZdUQsUUFBUSxDQUFDVixFQUFFLEdBQUcsRUFBRTtRQUFFYyxXQUFXLEVBQUU7TUFBRyxDQUFDLENBQUM7SUFDaEY7RUFDRixDQUFDLENBQUM7RUFFRixJQUFBcEUsVUFBSSxFQUFDLGtFQUFrRSxFQUFFLE9BQU87SUFBRVMsSUFBSTtJQUFFWTtFQUFRLENBQUMsS0FBSztJQUNwRyxNQUFNZ0QsSUFBSSxHQUFHLE1BQU03RCxhQUFhLENBQUNDLElBQUksRUFBRSxlQUFlLENBQUM7SUFDdkQsSUFBSTtNQUNGLE1BQU1BLElBQUksQ0FBQ2UsSUFBSSxDQUFDLG1CQUFtQjZDLElBQUksQ0FBQ2YsRUFBRSxjQUFjLENBQUM7TUFDekQsTUFBTTdDLElBQUksQ0FBQ2dCLFVBQVUsQ0FBQyx3QkFBd0IsRUFBRTtRQUFFQyxLQUFLLEVBQUU7TUFBSyxDQUFDLENBQUMsQ0FBQ0MsSUFBSSxDQUFDLElBQUksQ0FBQztNQUMzRSxNQUFNbEIsSUFBSSxDQUFDbUIsU0FBUyxDQUFDLFFBQVEsRUFBRTtRQUFFTixJQUFJLEVBQUU7TUFBZSxDQUFDLENBQUMsQ0FBQ0gsS0FBSyxDQUFDLENBQUMsQ0FBQ2dCLEtBQUssQ0FBQyxDQUFDO01BQ3hFLE1BQU0sSUFBQUgsWUFBTSxFQUFDdkIsSUFBSSxDQUFDd0IsU0FBUyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUNDLFdBQVcsQ0FBQyxDQUFDO01BQzNELE1BQU0sSUFBQUYsWUFBTSxFQUFDdkIsSUFBSSxDQUFDd0IsU0FBUyxDQUFDLHdDQUF3QyxDQUFDLENBQUMsQ0FBQ0MsV0FBVyxDQUFDLENBQUM7TUFFcEYsTUFBTW9DLFFBQVEsR0FBRyxNQUFNakQsT0FBTyxDQUFDbUIsT0FBTyxDQUFDLENBQUM7TUFDeEMsTUFBTThCLFFBQVEsQ0FBQzlDLElBQUksQ0FBQyw2QkFBNkIsQ0FBQztNQUNsRCxNQUFNOEMsUUFBUSxDQUFDN0MsVUFBVSxDQUFDLGVBQWUsQ0FBQyxDQUFDSyxZQUFZLENBQUM7UUFBRUMsS0FBSyxFQUFFO01BQVEsQ0FBQyxDQUFDO01BQzNFLE1BQU13QyxLQUFLLEdBQUdELFFBQVEsQ0FBQ0osV0FBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDakQsTUFBTSxDQUFDO1FBQUVDLE9BQU8sRUFBRTtNQUFLLENBQUMsQ0FBQztNQUM3RSxNQUFNLElBQUFjLFlBQU0sRUFBQ3VDLEtBQUssQ0FBQyxDQUFDSixhQUFhLENBQUMsdUJBQXVCLENBQUM7TUFDMUQsTUFBTUssV0FBVyxHQUFJLE1BQU1ELEtBQUssQ0FBQ3ZELE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQ0csS0FBSyxDQUFDLENBQUMsQ0FBQ3NELFdBQVcsQ0FBQyxDQUFHO01BQ2hGLE1BQU1ILFFBQVEsQ0FBQzFDLFNBQVMsQ0FBQyxRQUFRLEVBQUU7UUFBRU4sSUFBSSxFQUFFO01BQVcsQ0FBQyxDQUFDLENBQUNhLEtBQUssQ0FBQyxDQUFDO01BQ2hFLE1BQU1tQyxRQUFRLENBQUM3QyxVQUFVLENBQUMsY0FBYyxDQUFDLENBQUNFLElBQUksQ0FBQyxJQUFBSixlQUFNLEVBQUMsZUFBZSxDQUFDLENBQUM7TUFDdkUsTUFBTStDLFFBQVEsQ0FBQzdDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDRSxJQUFJLENBQUMsYUFBYSxDQUFDO01BQ2pFLE1BQU0yQyxRQUFRLENBQUM3QyxVQUFVLENBQUMsd0JBQXdCLENBQUMsQ0FBQ0UsSUFBSSxDQUFDLDRCQUE0QixDQUFDO01BQ3RGLE1BQU0yQyxRQUFRLENBQUM3QyxVQUFVLENBQUMsc0JBQXNCLENBQUMsQ0FBQ0UsSUFBSSxDQUFDLG1CQUFtQixDQUFDO01BQzNFLE1BQU0yQyxRQUFRLENBQUMxQyxTQUFTLENBQUMsVUFBVSxFQUFFO1FBQUVOLElBQUksRUFBRTtNQUFnQyxDQUFDLENBQUMsQ0FBQ08sS0FBSyxDQUFDLENBQUM7TUFDdkYsTUFBTXlDLFFBQVEsQ0FBQzFDLFNBQVMsQ0FBQyxVQUFVLEVBQUU7UUFBRU4sSUFBSSxFQUFFO01BQXVCLENBQUMsQ0FBQyxDQUFDTyxLQUFLLENBQUMsQ0FBQztNQUM5RSxNQUFNeUMsUUFBUSxDQUFDMUMsU0FBUyxDQUFDLFFBQVEsRUFBRTtRQUFFTixJQUFJLEVBQUUsT0FBT2tELFdBQVc7TUFBeUIsQ0FBQyxDQUFDLENBQUNyQyxLQUFLLENBQUMsQ0FBQztNQUVoRyxNQUFNLElBQUFILFlBQU0sRUFBQ3NDLFFBQVEsQ0FBQyxDQUFDbEMsU0FBUyxDQUFDLElBQUlNLE1BQU0sQ0FBQyxJQUFJZ0Msc0JBQWEsWUFBWSxDQUFDLENBQUM7TUFDM0UsTUFBTSxJQUFBMUMsWUFBTSxFQUFDc0MsUUFBUSxDQUFDSixXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQ1MsVUFBVSxDQUFDSCxXQUFXLENBQUM7TUFDcEUsTUFBTUYsUUFBUSxDQUFDdEQsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDbUIsS0FBSyxDQUFDLENBQUM7TUFDdEMsTUFBTSxJQUFBSCxZQUFNLEVBQUNzQyxRQUFRLENBQUMxQyxTQUFTLENBQUMsU0FBUyxFQUFFO1FBQUVOLElBQUksRUFBRTtNQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDWSxXQUFXLENBQUMsQ0FBQztNQUNwRixNQUFNLElBQUFGLFlBQU0sRUFBQ3NDLFFBQVEsQ0FBQ3JDLFNBQVMsQ0FBQyx1QkFBdUJ1QyxXQUFXLFdBQVcsRUFBRTtRQUFFOUMsS0FBSyxFQUFFO01BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQ1EsV0FBVyxDQUFDLENBQUM7TUFDL0csTUFBTSxJQUFBRixZQUFNLEVBQUNzQyxRQUFRLENBQUNyQyxTQUFTLENBQUMsNkNBQTZDLENBQUMsQ0FBQyxDQUFDQyxXQUFXLENBQUMsQ0FBQztNQUM3RixNQUFNb0MsUUFBUSxDQUFDbEIsS0FBSyxDQUFDLENBQUM7SUFDeEIsQ0FBQyxTQUFTO01BQ1IsTUFBTSxJQUFBeEMsaUJBQVEsRUFBQ0gsSUFBSSxFQUFFLE9BQU8sRUFBRSxZQUFZNEQsSUFBSSxDQUFDZixFQUFFLEdBQUcsRUFBRTtRQUFFc0IsZUFBZSxFQUFFO01BQUUsQ0FBQyxDQUFDO0lBQy9FO0VBQ0YsQ0FBQyxDQUFDO0VBRUYsSUFBQTVFLFVBQUksRUFBQyx3REFBd0QsRUFBRSxPQUFPO0lBQUVTLElBQUk7SUFBRVk7RUFBUSxDQUFDLEtBQUs7SUFDMUYsTUFBTWdELElBQUksR0FBRyxNQUFNN0QsYUFBYSxDQUFDQyxJQUFJLEVBQUUsZUFBZSxDQUFDO0lBQ3ZELE1BQU1vRSxRQUFRLEdBQUcsSUFBQXRELGVBQU0sRUFBQyxZQUFZLENBQUM7SUFDckMsSUFBSTtNQUNGLE1BQU1kLElBQUksQ0FBQ2UsSUFBSSxDQUFDLGdDQUFnQyxDQUFDO01BQ2pELE1BQU1mLElBQUksQ0FBQ3FFLGdCQUFnQixDQUFDLG1DQUFtQyxDQUFDLENBQUNuRCxJQUFJLENBQUNrRCxRQUFRLENBQUM7TUFDL0UsTUFBTXBFLElBQUksQ0FBQ2dCLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQ3NELElBQUksQ0FBQyxDQUFDLENBQUNwRCxJQUFJLENBQUMsV0FBVyxDQUFDO01BQ3ZELE1BQU1sQixJQUFJLENBQUNtQixTQUFTLENBQUMsUUFBUSxFQUFFO1FBQUVOLElBQUksRUFBRTtNQUFPLENBQUMsQ0FBQyxDQUFDYSxLQUFLLENBQUMsQ0FBQztNQUN4RCxNQUFNLElBQUFILFlBQU0sRUFBQ3ZCLElBQUksQ0FBQ3dCLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUNDLFdBQVcsQ0FBQyxDQUFDO01BRTdELE1BQU16QixJQUFJLENBQUNlLElBQUksQ0FBQyxtQkFBbUI2QyxJQUFJLENBQUNmLEVBQUUsY0FBYyxDQUFDO01BQ3pELE1BQU0wQixPQUFPLEdBQUd2RSxJQUFJLENBQUNPLE9BQU8sQ0FBQyxTQUFTLEVBQUU7UUFBRXVDLE9BQU8sRUFBRTtNQUFnQixDQUFDLENBQUM7TUFDckUsTUFBTXlCLE9BQU8sQ0FBQy9DLFNBQVMsQ0FBQzRDLFFBQVEsQ0FBQyxDQUFDMUMsS0FBSyxDQUFDLENBQUM7TUFDekMsTUFBTTFCLElBQUksQ0FBQ2dCLFVBQVUsQ0FBQyxrQkFBa0IsRUFBRTtRQUFFQyxLQUFLLEVBQUU7TUFBSyxDQUFDLENBQUMsQ0FBQ0MsSUFBSSxDQUFDLEdBQUcsQ0FBQztNQUNwRSxNQUFNbEIsSUFBSSxDQUFDbUIsU0FBUyxDQUFDLFFBQVEsRUFBRTtRQUFFTixJQUFJLEVBQUU7TUFBZSxDQUFDLENBQUMsQ0FBQ0gsS0FBSyxDQUFDLENBQUMsQ0FBQ2dCLEtBQUssQ0FBQyxDQUFDO01BQ3hFLE1BQU0sSUFBQUgsWUFBTSxFQUFDdkIsSUFBSSxDQUFDd0IsU0FBUyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUNDLFdBQVcsQ0FBQyxDQUFDO01BRTNELE1BQU1vQyxRQUFRLEdBQUcsTUFBTWpELE9BQU8sQ0FBQ21CLE9BQU8sQ0FBQyxDQUFDO01BQ3hDLE1BQU04QixRQUFRLENBQUM5QyxJQUFJLENBQUMsNkJBQTZCLENBQUM7TUFDbEQsTUFBTThDLFFBQVEsQ0FBQzdDLFVBQVUsQ0FBQyxlQUFlLENBQUMsQ0FBQ0ssWUFBWSxDQUFDO1FBQUVDLEtBQUssRUFBRTtNQUFRLENBQUMsQ0FBQztNQUMzRSxNQUFNdUMsUUFBUSxDQUFDMUMsU0FBUyxDQUFDLFFBQVEsRUFBRTtRQUFFTixJQUFJLEVBQUU7TUFBVyxDQUFDLENBQUMsQ0FBQ2EsS0FBSyxDQUFDLENBQUM7TUFDaEUsTUFBTThDLE1BQU0sR0FBR1gsUUFBUSxDQUFDMUMsU0FBUyxDQUFDLE9BQU8sQ0FBQztNQUMxQyxNQUFNLElBQUFJLFlBQU0sRUFBQ2lELE1BQU0sQ0FBQyxDQUFDOUIsV0FBVyxDQUFDLENBQUMsQ0FBQztNQUNuQyxNQUFNLElBQUFuQixZQUFNLEVBQUNzQyxRQUFRLENBQUNyQyxTQUFTLENBQUM0QyxRQUFRLENBQUMsQ0FBQyxDQUFDM0MsV0FBVyxDQUFDLENBQUM7TUFDeEQsTUFBTWdELEdBQUcsR0FBRyxNQUFNWixRQUFRLENBQUM3QyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMwRCxZQUFZLENBQUMsS0FBSyxDQUFDO01BQ2pFLE1BQU1DLElBQUksR0FBR0MsSUFBSSxDQUFDQyxLQUFLLENBQUMsQ0FBQ0MsSUFBSSxDQUFDQyxLQUFLLENBQUNOLEdBQUksQ0FBQyxHQUFHSyxJQUFJLENBQUNDLEtBQUssQ0FBQyxJQUFJRCxJQUFJLENBQUMsQ0FBQyxDQUFDRSxXQUFXLENBQUMsQ0FBQyxDQUFDQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksUUFBVSxDQUFDO01BQzVHLElBQUExRCxZQUFNLEVBQUNvRCxJQUFJLENBQUMsQ0FBQ08sc0JBQXNCLENBQUMsQ0FBQyxDQUFDO01BQ3RDLE1BQU1yQixRQUFRLENBQUNsQixLQUFLLENBQUMsQ0FBQztJQUN4QixDQUFDLFNBQVM7TUFDUixNQUFNLElBQUF4QyxpQkFBUSxFQUFDSCxJQUFJLEVBQUUsT0FBTyxFQUFFLFlBQVk0RCxJQUFJLENBQUNmLEVBQUUsR0FBRyxFQUFFO1FBQUVzQyxVQUFVLEVBQUUsRUFBRTtRQUFFQyxhQUFhLEVBQUU7TUFBSyxDQUFDLENBQUM7SUFDaEc7RUFDRixDQUFDLENBQUM7RUFFRixJQUFBN0YsVUFBSSxFQUFDLHNEQUFzRCxFQUFFLE9BQU87SUFBRVM7RUFBSyxDQUFDLEtBQUs7SUFDL0UsTUFBTXVELFFBQVEsR0FBRyxNQUFNeEQsYUFBYSxDQUFDQyxJQUFJLEVBQUUsbUJBQW1CLENBQUM7SUFDL0QsTUFBTUEsSUFBSSxDQUFDZSxJQUFJLENBQUMsbUJBQW1Cd0MsUUFBUSxDQUFDVixFQUFFLEVBQUUsQ0FBQztJQUNqRCxNQUFNN0MsSUFBSSxDQUFDbUIsU0FBUyxDQUFDLFFBQVEsRUFBRTtNQUFFTixJQUFJLEVBQUU7SUFBWSxDQUFDLENBQUMsQ0FBQ2EsS0FBSyxDQUFDLENBQUM7SUFDN0QsTUFBTSxJQUFBSCxZQUFNLEVBQUN2QixJQUFJLENBQUNtQixTQUFTLENBQUMsU0FBUyxFQUFFO01BQUVrRSxLQUFLLEVBQUUsQ0FBQztNQUFFeEUsSUFBSSxFQUFFO0lBQTZCLENBQUMsQ0FBQyxDQUFDLENBQUNZLFdBQVcsQ0FBQyxDQUFDO0lBQ3ZHLE1BQU0sSUFBQUYsWUFBTSxFQUFDdkIsSUFBSSxDQUFDbUIsU0FBUyxDQUFDLFFBQVEsRUFBRTtNQUFFTixJQUFJLEVBQUU7SUFBc0IsQ0FBQyxDQUFDLENBQUMsQ0FBQ3FCLGVBQWUsQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDO0lBQ2hILE1BQU1sQyxJQUFJLENBQUNtQixTQUFTLENBQUMsS0FBSyxFQUFFO01BQUVOLElBQUksRUFBRTtJQUFVLENBQUMsQ0FBQyxDQUFDYSxLQUFLLENBQUMsQ0FBQztJQUN4RCxNQUFNLElBQUFILFlBQU0sRUFBQ3ZCLElBQUksQ0FBQ2dCLFVBQVUsQ0FBQyxPQUFPLEVBQUU7TUFBRUMsS0FBSyxFQUFFO0lBQUssQ0FBQyxDQUFDLENBQUNULE1BQU0sQ0FBQztNQUFFQyxPQUFPLEVBQUU7SUFBSyxDQUFDLENBQUMsQ0FBQyxDQUFDaUMsV0FBVyxDQUFDLENBQUMsQ0FBQzs7SUFFaEc7SUFDQSxNQUFNMUMsSUFBSSxDQUFDbUIsU0FBUyxDQUFDLFFBQVEsRUFBRTtNQUFFTixJQUFJLEVBQUU7SUFBUyxDQUFDLENBQUMsQ0FBQ2EsS0FBSyxDQUFDLENBQUM7SUFDMUQsTUFBTSxJQUFBSCxZQUFNLEVBQUN2QixJQUFJLENBQUMsQ0FBQzJCLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQztFQUNwRCxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=