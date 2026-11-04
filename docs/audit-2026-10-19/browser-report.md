# Kleandeck admin workflow and usability audit — 19 October 2026

Audit agent: dedicated browser QA and usability reviewer. Audit only; application source and existing test files were not edited. The current working tree, including the new uncommitted discount-code feature, was tested.

## Assessment

**Overall ease of use: 7/10.** This is an expert-review estimate, not a user-study result. Desktop navigation, plain-language guided service tabs, booking sections, live totals, setup checklist and phone layout make ordinary work approachable. Error recovery, safe editing, tablet settings density and publication safeguards need improvement. Financial and data-integrity defects are reported separately from how easy the screens are to operate.

Rubric: discoverability 25%, task effort 25%, guidance 20%, validation/recovery 20%, responsive interaction 10%. Scores are directional, with approximately ±1 point uncertainty.

| Workflow | Ease /10 | Assessment |
|---|---:|---|
| Sign-in and team accounts | 8 | Clear roles and account creation; existing tests cover staff restrictions, deactivation, self-lockout prevention. |
| Dashboard and setup | 8 | Grouped navigation and linked checklist are useful; dashboard counts need correctness fix. |
| Creating/editing services and prices | 7.5 | Guided tabs, contextual tips and exact price tester work well; improve publishing safeguards. |
| Homepage categories and photos | 8 | Clear association and preview workflow; upload is a separate step after first save. |
| Staff booking creation/editing | 7 | Five sections retain details, validation returns focus to required fields, review links help; make repricing explicit. |
| Payments and booking lifecycle | 7 | Split receipts, balance, assignments and job actions are understandable; repair financial-state defects before relying on badges. |
| Cleaners | 8 | Simple roster, search and edit; add clearer archive/undo handling. |
| Applications | 6 | Straightforward hire/status actions; missing pagination and repeat-hire protection obstruct growth. |
| Settings, FAQs and terms | 6.5 | Descriptive navigation and keyboard tabs help; tablet frequency rows are difficult to read. |
| Discount codes | 6.5 | Campaign controls and server validation are clear; failed-code recovery and booking edits need attention. |

## Verified environment and scope

- Throwaway SQLite database, media and temp directory under this audit folder. Django debug server :8019, Next dev :3019, audit-only reverse proxy :8089, fake Paystack :8099. Explicit local database, test payment key and console email overrides were used. Docker engine access was denied, so the documented Docker/PostgreSQL stack could not run.
- Browser: Chromium/Playwright; desktop 1440×900, tablet 768×900, phone 390×900 plus existing Pixel 7 project; Africa/Lagos timezone.
- No real customer records, SMTP email deliveries, WhatsApp sends or live gateway payments. Gateway checkout/redirect/verification used fake Paystack.
- Existing Django suite: 73 passed; frontend lint passed. Backend findings and their separate verification limits: [backend-findings.md](backend-findings.md).
- Existing browser suite final counts: **63 passed, 1 failed, 0 skipped (10.2 minutes)**; the one failure is an ambiguous test locator, described below; raw result: `existing-e2e.json`.
- Supplemental browser workflow checks: **6 passed, 1 observed defect** across seven scenarios after correcting audit-only selectors/fixtures. Four edge checks produced **3 confirmed undesired outcomes and 1 inconclusive check**. Results are consolidated in `browser-final.json`; the raw initial and recheck outputs are retained in `browser-all.json`, `browser-recheck.json` and `browser-edgecases.json`. These audit assertions test desired behavior, so a failure is classified from its evidence rather than automatically called an application defect.
- Responsive/retention checks: **19 passed** (18 page/width combinations with 0px horizontal overflow, plus settings draft retention). These structural checks do not mean every layout is comfortable: the tablet frequency-row defect below was visually confirmed.
- JavaScript-disabled sign-in probe: credential-in-query defect confirmed.

The existing browser suite covers authentication; owner/staff roles; dashboard/setup guidance; service rates/counters/add-ons/visibility/photos/price tester/surcharges/deposits/time-slot and lead-day overrides/duplication; category creation/photo/visibility; manual and calculated bookings, edits, assignment, part/full receipts, fake payment links, start/complete/cancel/search/filter; career and academy submission/hire; settings contact/VAT/areas/FAQs; public booking calculations/thresholds/sharing/checkouts; phone navigation. Supplemental checks target genuinely new service creation, discounts, cleaner management, account errors and risky edits. Backend probes cover additional financial, growth and configuration edge cases.

## Observed browser defects

### U01 — Medium: frequency editing becomes unreadable at tablet width

**Steps:** At 768px wide, open Business settings → Frequencies.

**Actual:** The 220px navigation rail remains beside a five-column row; label and description fields shrink to roughly 40–50px, displaying only one to three letters. There is no page overflow, but comparing/editing the options is impractical.

**Expected:** Readable names and descriptions with comfortably editable fields.

**Evidence:** `frontend/components/admin/screens/settings.tsx:412` uses the multi-column frequency row from the `sm` breakpoint while `:85` also enables the rail at `md`. Screenshot: [tablet frequencies](layout-768-settings_tab_frequencies.png).

**Improvement:** Use stacked cards or a two-column row until the content area is wide enough; retain labels, discount and visits as visible context. Apply the breakpoint to available content width rather than viewport width.

### U02 — Medium: unavailable JavaScript can put sign-in passwords in URLs

**Steps:** Open `/admin/login` with JavaScript disabled, enter synthetic email/password, select Sign in.

**Actual:** Browser navigates to `/admin/login?email=…&password=…`. The password enters browser history and request logs. The earlier audit proxy's failed hydration produced the same fallback; the explicit no-JavaScript check independently confirms it.

**Expected:** Credentials must never be submitted in a GET query, even if scripts fail or have not hydrated.

**Evidence:** `frontend/components/admin/login-form.tsx:56` has no `method` attribute on its form. Repro: `browser-nojs-login.cjs`; result: `nojs-login-evidence.json`, using dummy credentials only.

**Improvement:** Provide a safe POST fallback or gate submission until the handler is available, with an accessible loading/failure state. Do not log credential-bearing URLs.

### U03 — Medium: a mistyped discount cannot be cleared from checkout

**Steps:** Open a bookable service, choose an area, apply an unknown discount code, wait for the error, then clear the discount input.

**Actual:** The page displays “We couldn't find that discount code.” Clearing the input leaves the old applied code in state. There is no Remove control, Apply code is disabled because the input is empty, and Continue remains disabled. A valid code applies/removes correctly; the broken recovery concerns invalid codes. Reloading or changing service is a workaround.

**Expected:** A customer can clear a failed code and continue at the ordinary price.

**Evidence:** `frontend/components/booking/booking-flow.tsx:523` renders Remove only for a successful code. Input edits do not clear the applied code at `:508`, while `:515` disables Apply for empty input. `invalid-code-evidence.json` records the real error and all three control states. Screenshot: [invalid code recovery](invalid-code-no-recovery.png).

**Improvement:** Keep Clear/Remove available whenever a code was submitted, including after validation failure. Restore the undiscounted quote immediately on clearing it.

### U04 — High: hiding a service can corrupt later booking edits

**Steps:** Create a Standard cleaning booking with seven rooms (rather than the three-room default), hide that service, open the booking editor, change only the contact name and save.

**Actual:** The booking drops from **₦62,350 to ₦40,850** and stored quantities become `{}`. The hidden service is missing from the editor's public catalogue. The same editor shows **₦0** and “Choose a service” for an existing hidden flat-price booking whose stored total is **₦21,500**; a flat booking can still save, but the price context is misleading.

**Expected:** Historical bookings retain their selected service, inputs and agreed total, regardless of whether new customers can book that service.

**Evidence:** `frontend/components/admin/screens/booking-editor.tsx:17` reads the active-only public catalogue; `frontend/components/admin/booking-form.tsx:192` cannot find the hidden service, `:212` disables its quote and `:238` submits empty quantities when the service is unavailable. `hidden-units-evidence.json` captures before/after totals and inputs; `hidden-service-evidence.json` captures the zero-price preview. Screenshot: [hidden-service edit](hidden-service-edit-preview.png).

**Improvement:** Load the booked service through an authorized admin endpoint, preserve its stored inputs and price, show an Archived/Hidden badge, and require an explicit decision before replacing/repricing it.

### Browser confirmation of backend B02 — High: contact edits remove discounts

An online booking created through the local API with AUDIT10 had total **₦19,350**, code discount **₦2,000**. Editing only its contact name through the admin UI changed the total to **₦21,500**, set the discount to **₦0**, and kept the code attached. See `contact-edit-evidence.json` and [discount after contact edit](discount-after-contact-edit.png). This confirms backend B02 through the real full-form browser workflow; it is the same defect, not an additional count.

## Supplemental workflow outcomes

- Created a genuinely new flat-price service via the three-tab UI, set **₦20,000**, associated homepage category ID 1, and confirmed it appears in the public catalogue. Public calculator and a new staff booking both charged **₦21,500** including VAT. Synthetic booking: `KD-R46AYKX`.
- Created AUDIT10 through the discount UI after checking that 100% is rejected with the 90%-maximum message. Applying/removing the valid 10% code changed **₦21,500 → ₦19,350 → ₦21,500** correctly. Invalid-code recovery failed as U03 describes.
- Added a cleaner, edited notes, deactivated them, confirmed they disappear from the active roster and reappear using Show inactive plus search.
- Account password-mismatch and wrong-current-password errors were shown correctly; no real account password was changed.
- Hidden flat-service contact edits can save; their misleading preview and hidden per-unit input loss are U04, rather than a blanket claim that all hidden-service saves fail.
- A zero-price new-service publication check timed out waiting for the creation toast and is **inconclusive**. Defaults/source permit zero prices and active publication, while payment initialization rejects amounts ≤0, so publish-readiness remains a supported validation concern rather than a claimed completed browser reproduction. Do not count this check as an observed publication defect.

## Reliability findings

The separate backend report reproduces paid badges surviving price increases; discounts disappearing during ordinary full-form edits; concurrent offline receipts losing updates; repeat hiring creating duplicate cleaners; applications beyond the first 100 lacking UI pagination; selected arrival/frequency restrictions falling back to unrelated defaults; deleting used time slots breaking later edits; partial nested pricing edits producing HTTP 500; and dashboard counts multiplying when a job has multiple cleaners. Prioritize the financial cases first. See [backend-findings.md](backend-findings.md) for exact inputs, output, severity, code references and the concurrency-simulation limit.

## Test-suite maintenance and controls

- `admin-guidance.spec.ts:125` currently uses a text locator that matches both the frequency intro and panel explanation; Playwright strict mode rejects the ambiguous selector. Both pieces of help text are visible. This is a test defect, not a broken product workflow.
- Initial failed startup runs were harness issues: sandbox socket restrictions, missing `/healthz` edge routing, then missing Next dev websocket forwarding. They were resolved before the final suite run and are excluded from product-defect counts.
- Settings Business → Booking & VAT → Business preserved an unsaved business-name edit on the current Next navigation behavior. The static tab-remount data-loss hypothesis did **not** reproduce and is excluded from defects.

## Prioritized improvements

1. Preserve the booked price for contact/notes/schedule changes. Offer an explicit Reprice action with old/new total and discount treatment. Reconcile paid/part-paid state atomically whenever money changes.
2. Create new services as drafts; add a publish-readiness check for a positive calculable rate or quote-only method, valid schedule and clear customer-facing content. Show what remains before publication.
3. Provide reliable recovery for failed validation and failed discount codes. Keep the previous valid quote visible and allow clearing an invalid code.
4. Stack tablet settings rows and make row-level Saving/Saved/Unsaved state obvious. Keep the existing guided tabs and plain-language tips.
5. Archive used settings and cleaners, warn about dependencies, and make hiring idempotent. Add application pagination, totals and persistent filters.
6. Add regression scenarios for price-preserving edits, offline-payment interleavings, campaign edits, draft publication, invalid-code removal and tablet usable field widths.

## Limits

No production build/browser run, real Paystack/webhook delivery, real SMTP, simultaneous PostgreSQL HTTP load, screen-reader session or comprehensive contrast audit was performed. Screenshot review is representative, not exhaustive across every device/browser. Exhaustive combinations of all rates, units, campaign schedules/limits, time zones, and long data sets remain outside this finite pass; the attached feature inventory and raw outputs show what was exercised. No implementation fixes were made.

