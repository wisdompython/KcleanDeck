# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-guidance.spec.ts >> Finding your way around the admin >> settings tabs say what each one is for
- Location: tests\admin-guidance.spec.ts:120:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/how many visits one payment covers/)
Expected: visible
Error: strict mode violation: getByText(/how many visits one payment covers/) resolved to 2 elements:
    1) <p class="mb-5 max-w-3xl text-sm leading-6 text-on-surface-variant">How often customers can book (one-off, weekly…), …</p> aka getByText('How often customers can book')
    2) <p class="mt-0.5 text-[13px] text-on-surface-variant">Discount is taken off each visit. Visits per paym…</p> aka getByText('Discount is taken off each')

Call log:
  - Expect "toBeVisible" getByText(/how many visits one payment covers/) with timeout 10000ms
  - waiting for getByText(/how many visits one payment covers/)

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - img "Kleandeck" [ref=e6]
          - generic [ref=e7]:
            - paragraph [ref=e8]: Operations
            - paragraph [ref=e9]: Lagos
        - link "New booking" [ref=e11] [cursor=pointer]:
          - /url: /admin/bookings/new
        - navigation "Admin" [ref=e13]:
          - generic [ref=e14]:
            - paragraph [ref=e15]: Daily work
            - generic [ref=e16]:
              - link "Dashboard" [ref=e17] [cursor=pointer]:
                - /url: /admin
              - link "Bookings" [ref=e24] [cursor=pointer]:
                - /url: /admin/bookings
              - link "Cleaners" [ref=e31] [cursor=pointer]:
                - /url: /admin/cleaners
              - link "Job applications" [ref=e38] [cursor=pointer]:
                - /url: /admin/applications
          - generic [ref=e43]:
            - paragraph [ref=e44]: Your services
            - generic [ref=e45]:
              - link "Services & prices" [ref=e46] [cursor=pointer]:
                - /url: /admin/services
              - link "Discount codes" [ref=e52] [cursor=pointer]:
                - /url: /admin/discounts
              - link "Homepage categories" [ref=e57] [cursor=pointer]:
                - /url: /admin/categories
          - generic [ref=e64]:
            - paragraph [ref=e65]: Setup
            - generic [ref=e66]:
              - link "Business settings" [ref=e67] [cursor=pointer]:
                - /url: /admin/settings
              - link "Team accounts" [ref=e72] [cursor=pointer]:
                - /url: /admin/team
        - generic [ref=e77]:
          - link "View website" [ref=e78] [cursor=pointer]:
            - /url: /
          - link "owner owner" [ref=e83] [cursor=pointer]:
            - /url: /admin/account
            - generic [ref=e88]:
              - generic [ref=e89]: owner
              - generic [ref=e90]: owner
          - button "Sign out" [ref=e91]
    - main [ref=e95]:
      - generic [ref=e97]:
        - generic [ref=e99]:
          - paragraph [ref=e100]: Setup
          - heading "Business settings" [level=1] [ref=e101]
          - paragraph [ref=e102]: Manage the details and booking options used across your website. Choose a section to get started.
        - generic [ref=e103]:
          - tablist "Settings sections" [ref=e105]:
            - tab "Business & contact" [ref=e106]
            - tab "Booking & VAT" [ref=e110]
            - tab "Terms" [ref=e114]
            - tab "Frequencies" [active] [selected] [ref=e118]
            - tab "Time slots" [ref=e122]
            - tab "Areas" [ref=e126]
            - tab "FAQs" [ref=e130]
          - tabpanel "Frequencies" [ref=e134]:
            - paragraph [ref=e135]: How often customers can book (one-off, weekly…), the discount for each, and how many visits one payment covers.
            - group [ref=e136]:
              - generic [ref=e137]:
                - generic [ref=e139]:
                  - heading "Frequencies" [level=2] [ref=e140]
                  - paragraph [ref=e141]: Discount is taken off each visit. Visits per payment sets how many visits one payment covers (weekly billed monthly = 4).
                - generic [ref=e142]:
                  - generic [ref=e143]:
                    - generic [ref=e145]:
                      - textbox "Label" [ref=e146]: One-off
                      - textbox "Description" [ref=e147]:
                        - /placeholder: e.g. Billed monthly for 4 visits
                        - text: A single visit
                      - generic [ref=e148]:
                        - generic [ref=e149]: Discount percent
                        - spinbutton "Discount percent % off" [ref=e150]: "0.00"
                        - generic: "% off"
                      - generic [ref=e151]:
                        - generic [ref=e152]: Visits per payment
                        - spinbutton "Visits per payment visits" [ref=e153]: "1"
                        - generic: visits
                      - generic [ref=e154] [cursor=pointer]:
                        - switch "On" [checked] [ref=e155]
                        - generic [ref=e157]: "On"
                    - button "Delete" [ref=e160]
                  - generic [ref=e164]:
                    - generic [ref=e166]:
                      - textbox "Label" [ref=e167]: Weekly
                      - textbox "Description" [ref=e168]:
                        - /placeholder: e.g. Billed monthly for 4 visits
                        - text: Billed monthly for 4 visits
                      - generic [ref=e169]:
                        - generic [ref=e170]: Discount percent
                        - spinbutton "Discount percent % off" [ref=e171]: "10.00"
                        - generic: "% off"
                      - generic [ref=e172]:
                        - generic [ref=e173]: Visits per payment
                        - spinbutton "Visits per payment visits" [ref=e174]: "4"
                        - generic: visits
                      - generic [ref=e175] [cursor=pointer]:
                        - switch "On" [checked] [ref=e176]
                        - generic [ref=e178]: "On"
                    - button "Delete" [ref=e181]
                  - generic [ref=e185]:
                    - generic [ref=e187]:
                      - textbox "Label" [ref=e188]: Every two weeks
                      - textbox "Description" [ref=e189]:
                        - /placeholder: e.g. Billed monthly for 4 visits
                        - text: Billed monthly for 2 visits
                      - generic [ref=e190]:
                        - generic [ref=e191]: Discount percent
                        - spinbutton "Discount percent % off" [ref=e192]: "5.00"
                        - generic: "% off"
                      - generic [ref=e193]:
                        - generic [ref=e194]: Visits per payment
                        - spinbutton "Visits per payment visits" [ref=e195]: "2"
                        - generic: visits
                      - generic [ref=e196] [cursor=pointer]:
                        - switch "On" [checked] [ref=e197]
                        - generic [ref=e199]: "On"
                    - button "Delete" [ref=e202]
                  - generic [ref=e206]:
                    - generic [ref=e208]:
                      - textbox "Label" [ref=e209]: Monthly
                      - textbox "Description" [ref=e210]:
                        - /placeholder: e.g. Billed monthly for 4 visits
                        - text: One visit a month
                      - generic [ref=e211]:
                        - generic [ref=e212]: Discount percent
                        - spinbutton "Discount percent % off" [ref=e213]: "0.00"
                        - generic: "% off"
                      - generic [ref=e214]:
                        - generic [ref=e215]: Visits per payment
                        - spinbutton "Visits per payment visits" [ref=e216]: "1"
                        - generic: visits
                      - generic [ref=e217] [cursor=pointer]:
                        - switch "On" [checked] [ref=e218]
                        - generic [ref=e220]: "On"
                    - button "Delete" [ref=e223]
                  - generic [ref=e229]:
                    - textbox "Label" [ref=e230]:
                      - /placeholder: New frequency, e.g. Fortnightly
                    - textbox "Description" [ref=e231]:
                      - /placeholder: e.g. Billed monthly for 4 visits
                    - generic [ref=e232]:
                      - generic [ref=e233]: Discount percent
                      - spinbutton "Discount percent % off" [ref=e234]: "0"
                      - generic: "% off"
                    - generic [ref=e235]:
                      - generic [ref=e236]: Visits per payment
                      - spinbutton "Visits per payment visits" [ref=e237]: "1"
                      - generic: visits
                    - generic [ref=e238] [cursor=pointer]:
                      - switch "On" [checked] [ref=e239]
                      - generic [ref=e241]: "On"
  - generic [ref=e247] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e248]
    - generic [ref=e252]:
      - button "Open issues overlay" [ref=e253]:
        - generic [ref=e254]:
          - generic [aria-hidden] [ref=e255]: "0"
          - generic [ref=e256]: "1"
        - generic [ref=e257]: Insight
      - button "Collapse issues badge" [ref=e258]
  - alert [ref=e261]: Business settings
```

# Test source

```ts
  25  |     await expect(page.getByRole("region", { name: "Service and space", exact: true })).toBeVisible();
  26  |     await page.getByRole("button", { name: "Back", exact: true }).click();
  27  |     await expect(page.getByLabel("Contact name")).toHaveValue("Amina Bello");
  28  |     await expect(page.getByLabel("Phone (WhatsApp)")).toHaveValue("08023456789");
  29  | 
  30  |     await page.getByLabel("Contact name").clear();
  31  |     await openBookingStep(page, "Review & billing");
  32  |     await page.getByRole("button", { name: "Create booking", exact: true }).click();
  33  |     await expect(page.getByRole("region", { name: "Client details", exact: true })).toBeVisible();
  34  |     await expect(page.getByLabel("Contact name")).toBeFocused();
  35  |   });
  36  | 
  37  |   test("the sidebar groups pages and explains each one", async ({ page }) => {
  38  |     await page.goto("/admin");
  39  |     const nav = page.getByRole("navigation", { name: "Admin" });
  40  |     for (const group of ["Daily work", "Your services", "Setup"]) {
  41  |       await expect(nav.getByText(group, { exact: true })).toBeVisible();
  42  |     }
  43  |     await expect(nav.getByRole("link", { name: "Services & prices" })).toHaveAttribute(
  44  |       "title",
  45  |       "What customers can book and how much it costs",
  46  |     );
  47  |     await nav.getByRole("link", { name: "Homepage categories" }).click();
  48  |     await expect(page.getByRole("heading", { level: 1, name: "Homepage categories" })).toBeVisible();
  49  |   });
  50  | 
  51  |   test("the getting-started checklist tracks setup and links to each step", async ({ page }) => {
  52  |     await adminApi(page, "POST", "setup/", { key: "prices", done: false });
  53  |     await adminApi(page, "POST", "setup/", { key: "dismissed", done: false });
  54  |     await page.goto("/admin");
  55  | 
  56  |     const card = page.getByRole("region", { name: "Getting started" });
  57  |     await expect(card).toBeVisible();
  58  |     await expect(card.getByRole("progressbar", { name: "Setup progress" })).toBeVisible();
  59  |     const prices = card.getByRole("listitem").filter({ hasText: "Set your real prices" });
  60  |     await expect(prices).toContainText("(to do)");
  61  |     await prices.getByRole("button", { name: "Mark as done" }).click();
  62  |     await expect(prices).toContainText("(done)");
  63  | 
  64  |     const terms = card.getByRole("listitem").filter({ hasText: "Finish your terms and conditions" });
  65  |     await terms.getByRole("link", { name: "Go there" }).click();
  66  |     await expect(page).toHaveURL(/\/admin\/settings\?tab=terms$/);
  67  |     await expect(page.getByText("The terms and conditions customers agree to before paying")).toBeVisible();
  68  | 
  69  |     await page.goto("/admin");
  70  |     await card.getByRole("button", { name: "Hide for now" }).click();
  71  |     await expect(card).toHaveCount(0);
  72  |     await page.getByRole("button", { name: /Finish setting up \(\d+ of \d+ done\)/ }).click();
  73  |     await expect(card).toBeVisible();
  74  |   });
  75  | 
  76  |   test("the service editor is split into guided tabs", async ({ page }) => {
  77  |     const service = await standardCleaning(page);
  78  |     await page.goto(`/admin/services/${service.id}`);
  79  |     await expect(page.getByRole("tab", { name: /Basics/ })).toHaveAttribute("aria-selected", "true");
  80  |     await expect(page.getByText("What customers read about this service")).toBeVisible();
  81  | 
  82  |     await page.getByRole("button", { name: "Next: Pricing" }).click();
  83  |     await expect(page).toHaveURL(/tab=pricing/);
  84  |     await expect(page.getByText("How this price is worked out")).toBeVisible();
  85  |     await expect(page.getByText(/Each visit costs ₦[\d,]+ to start, plus ₦[\d,]+ each for rooms \/ work areas/)).toBeVisible();
  86  | 
  87  |     await page.getByRole("button", { name: "Next: Booking rules" }).click();
  88  |     await expect(page.getByRole("heading", { name: "Arrival times" })).toBeVisible();
  89  |     await page.getByRole("button", { name: "Back: Pricing" }).click();
  90  |     await expect(page).toHaveURL(/tab=pricing/);
  91  |   });
  92  | 
  93  |   test("tips explain jargon in plain words", async ({ page }) => {
  94  |     const service = await standardCleaning(page);
  95  |     await page.goto(`/admin/services/${service.id}?tab=pricing`);
  96  |     await page.getByRole("button", { name: "About minimum charge" }).hover();
  97  |     await expect(page.getByRole("tooltip").filter({ visible: true })).toContainText("small jobs are still worth the trip");
  98  |   });
  99  | 
  100 |   test("unsaved changes are flagged and can be discarded", async ({ page }) => {
  101 |     const service = await standardCleaning(page);
  102 |     await page.goto(`/admin/services/${service.id}`);
  103 |     const summary = page.getByLabel("One-line summary");
  104 |     const original = await summary.inputValue();
  105 | 
  106 |     await expect(page.getByText("You have unsaved changes")).toHaveCount(0);
  107 |     await summary.fill("Something new");
  108 |     await expect(page.getByText("You have unsaved changes")).toBeVisible();
  109 | 
  110 |     // Following a link asks first; saying no keeps you on the page.
  111 |     page.once("dialog", (dialog) => dialog.dismiss());
  112 |     await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Bookings" }).click();
  113 |     await expect(page).toHaveURL(new RegExp(`/admin/services/${service.id}`));
  114 | 
  115 |     await page.getByRole("button", { name: "Discard" }).click();
  116 |     await expect(summary).toHaveValue(original);
  117 |     await expect(page.getByText("You have unsaved changes")).toHaveCount(0);
  118 |   });
  119 | 
  120 |   test("settings tabs say what each one is for", async ({ page }) => {
  121 |     await page.goto("/admin/settings");
  122 |     await page.getByRole("tab", { name: "Areas" }).click();
  123 |     await expect(page.getByText("The parts of Lagos customers can pick, and any travel charge for each.")).toBeVisible();
  124 |     await page.getByRole("tab", { name: "Frequencies" }).click();
> 125 |     await expect(page.getByText(/how many visits one payment covers/)).toBeVisible();
      |                                                                        ^ Error: expect(locator).toBeVisible() failed
  126 |   });
  127 | 
  128 |   test("settings sections can be navigated with the keyboard", async ({ page }) => {
  129 |     await page.goto("/admin/settings");
  130 |     const tabs = page.getByRole("tablist", { name: "Settings sections" });
  131 |     await tabs.getByRole("tab", { name: "Business & contact" }).focus();
  132 |     await page.keyboard.press("ArrowDown");
  133 |     const booking = tabs.getByRole("tab", { name: "Booking & VAT" });
  134 |     await expect(booking).toBeFocused();
  135 |     await expect(booking).toHaveAttribute("aria-selected", "true");
  136 |     await expect(page).toHaveURL(/tab=booking/);
  137 |     await page.keyboard.press("End");
  138 |     await expect(tabs.getByRole("tab", { name: "FAQs" })).toBeFocused();
  139 |     await expect(page).toHaveURL(/tab=faqs/);
  140 |   });
  141 | });
  142 | 
```