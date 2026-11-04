# Admin data-integrity audit — 19 October 2026

This supplements the browser-agent report. All probes use a freshly migrated in-memory SQLite database and synthetic records. No existing database, real payment gateway, or SMTP server is used. Application code is unchanged.

## Verification

- Existing Django suite: **73 tests passed**, 15.017 seconds. See `backend-tests.log`.
- First attempt had two sandbox temporary-directory permission errors during image tests. Moving TEMP/TMP into this audit folder resolved both; they are environment failures, not application defects.
- Frontend ESLint: **passed**, exit code 0. See `frontend-lint.log`.
- `backend-probes.py` executes 11 edge-case scenarios and records results in `backend-probe-results.json`. The malformed-input scenario correctly returns HTTP 400. Nine defect groups below cover the other ten scenarios (frequency and slot fallback share one cause).
- These probes are evidence-gathering scripts, not passing regression tests. Fixes should add regression coverage asserting the desired behavior.

## Reproduced defects and supported findings

### B01 — High: paid badge survives a price increase with an unpaid balance

**Steps:** Create a manual booking for ₦10,000, record full cash payment, then PATCH its subtotal to ₦20,000.

**Actual:** HTTP 200; `total=20000`, `amount_paid=10000`, `balance_due=10000`, `payment_status="paid"`.

**Expected:** Payment status should become part paid when money is still due. Lowering a part-paid booking below its received amount should likewise reconcile the badge and balance.

**Evidence:** `backend/staff/serializers.py:142` reapplies price without reconciling payment status. `backend/bookings/models.py:252` updates the status only when recording a payment.

**Impact / improvement:** Staff can trust a paid badge and miss collections. Reconcile money-derived state whenever the total changes and visibly review price changes on already paid jobs.

### B02 — High: ordinary full-form edits silently remove a booked discount

**Steps:** Create a calculated ₦10,000 flat booking with code AUDIT10 (10% off); total becomes ₦9,000. PATCH a changed contact name plus the same price inputs, matching the admin form's submission shape.

**Actual:** HTTP 200; total rises to ₦10,000, `discount_amount=0`, while `discount_code="AUDIT10"` remains attached.

**Expected:** A contact edit should preserve the agreed price and applied discount. Explicit repricing should show a price difference and consistently retain, recalculate, or remove the code.

**Evidence:** `frontend/components/admin/booking-form.tsx:227` submits price fields for every save. `backend/staff/serializers.py:105` and `:144` interpret their presence as a price change. `bookings/pricing.py:21` recalculates without applying the stored discount. `bookings/models.py:207` replaces the discount amount but not the code relation.

**Impact / improvement:** This can increase the customer's bill and leave campaign reporting inconsistent. Compare changed values rather than field presence; preserve the stored quote for non-price edits and make repricing explicit. The same flow can pick up newly changed rate-card/VAT values during unrelated edits.

**Browser corroboration:** A real full-form contact edit changed a discounted total from ₦19,350 to ₦21,500 (`contact-edit-evidence.json`). A related hidden-service edit dropped non-default unit quantities from the request: total fell from ₦62,350 to ₦40,850 and stored quantities became `{}` (`hidden-units-evidence.json`). The admin editor loads only the public, active catalogue, so it loses the hidden service's schema and builds an incomplete pricing payload. The browser report documents the price-preview and quantity-loss finding separately.

### B03 — High concurrency risk reproduced by interleaving: offline receipts and balance can diverge

**Method:** Read the same ₦10,000 booking twice, as two staff requests can do. From the first copy record ₦4,000 and save; from the second stale copy record ₦6,000 and save.

**Actual:** Both successful receipt rows exist, totalling ₦10,000. The booking stores only ₦6,000 received and shows ₦4,000 still due.

**Expected:** Received amount must agree with the ledger after simultaneous writes.

**Evidence:** `backend/staff/views.py:258` reads and writes the booking without an atomic locked transaction. `backend/bookings/models.py:249` increments an in-memory value. The Paystack path already locks the booking, but the offline path does not use that same protection.

**Limit:** This is a deterministic model-level simulation of the request interleaving; a simultaneous PostgreSQL HTTP load test was not performed.

**Improvement:** Lock and refresh the booking within one transaction containing receipt creation and balance reconciliation; coordinate offline and gateway writes through that same path. Add idempotency for retried receipt submissions.

### B04 — Medium: an applicant can be hired twice

**Steps:** Hire one job applicant, change application status back to Contacted (a UI-supported action), then hire again.

**Actual:** Both hire requests return HTTP 200 and create two cleaner records with the same applicant name and phone.

**Expected:** Hiring should return the already linked cleaner or reject a duplicate conversion, independently of display status.

**Evidence:** `backend/staff/views.py:317` unconditionally creates a cleaner. `frontend/components/admin/screens/applications.tsx:90` only gates the button on current status.

**Improvement:** Persist an applicant-to-cleaner link and make hire atomic and idempotent.

### B05 — Medium: applications after the first 100 have no browsing control

**Steps:** Insert 106 applications and request the same `page_size=100` used by the screen.

**Actual:** API returns count 106, 100 results, and a non-empty next URL. The screen maps only `results`; it has no next/previous or load-more control.

**Expected:** Staff should be able to browse the complete result set and see result counts. Filters/search can retrieve older matches but do not replace complete browsing.

**Evidence:** API reproduction in JSON results; `frontend/components/admin/screens/applications.tsx:143` requests page one and `:185` renders it without pagination. API cap is `backend/staff/views.py:43`.

**Evidence level:** API behavior reproduced; missing UI controls confirmed by source inspection, with browser verification delegated to the QA agent.

### B06 — Medium: disabling an allowed option unexpectedly enables unrelated options

**Steps:** Restrict a service to Morning only, then deactivate Morning while Afternoon remains active. Repeat with a service restricted to One-off while Weekly remains active.

**Actual:** Service starts offering Afternoon and Weekly respectively, despite those options never being selected for it.

**Expected:** Only an explicitly empty restriction should mean "all". An explicit restriction with no active members should return none or flag a configuration problem.

**Evidence:** `backend/pricing/models.py:164` and `:170` fall back based on the filtered active queryset, rather than whether restrictions were configured.

**Improvement:** Distinguish inherited defaults from explicit selections and warn before disabling the last usable option. Unexpected frequencies also change visits and amounts collected.

### B07 — Medium: deleting a used arrival slot strands old bookings

**Steps:** Create a booking using audit-retired, delete that time slot from Settings, then save an edit that includes its unchanged time-slot key.

**Actual:** Slot deletion returns HTTP 204. Booking save then returns HTTP 400: "Choose one of the time slots in Settings."

**Expected:** Historical bookings remain editable with their historical slot, or deletion is blocked with a clear archive alternative.

**Evidence:** `backend/bookings/models.py:161` stores a raw text key; `backend/staff/serializers.py:96` rejects keys that no longer exist. General deletion protection in `backend/staff/views.py:341` cannot protect this text reference.

**Improvement:** Archive used slots, preserve a display snapshot, or explicitly allow unchanged historical values. Apply this review to key renames as well.

### B08 — Low: a partial nested pricing-unit update returns HTTP 500

**Steps:** PATCH a service with `{"units":[{"id":existing_id,"label":"Bedrooms"}]}`.

**Actual:** HTTP 500. The nested validator dereferences absent `min_qty`, `default_qty`, and `max_qty`.

**Expected:** A supported partial update or a useful HTTP 400 explaining that complete unit rows are required.

**Evidence:** `backend/staff/serializers.py:246`.

**Limit:** The current editor sends full rows, so this is an API robustness defect rather than a reproduced normal-editor failure.

### B09 — Medium: dashboard job counts multiply by assigned crew size

**Steps:** Create exactly one confirmed booking for today and assign two cleaners. Open the dashboard endpoint.

**Actual:** `counts.today=2` while the database contains one confirmed booking today. The upcoming list still contains one booking.

**Expected:** Job counts represent distinct bookings, independently of the crew size.

**Evidence:** `backend/staff/views.py:125` aggregates `Count("id")` for today and upcoming jobs in the same query as an unassigned-cleaner condition. That condition adds a many-to-many join, duplicating bookings with several cleaners. The unassigned counter already uses `distinct=True`, but the other job counters do not.

**Impact / improvement:** Operations see an inflated workload after assigning crews. Count distinct booking IDs for each booking aggregate or compute the unassigned aggregate separately.

## Potential issues and product limitations

- **Cleaner availability:** There is no clash warning or capacity check. Two bookings can assign the same cleaner for the same slot. This is also recorded as unfinished work in `docs/TODO.md`; treat it as a known operational gap.
- **Recurring work:** Frequency pricing can charge several visits, but automatic creation/scheduling of future visits remains unfinished in `docs/TODO.md`. Clearly show paid-for visits versus scheduled visits and give staff a follow-up list.
- **Abandoned discount reservations:** Redemption count includes every non-cancelled booking, including awaiting-payment bookings (`backend/bookings/models.py:49`). Limited codes can stay exhausted after abandoned checkouts. Decide and document a reservation expiry/release policy.
- **Create + receive-money retry:** Admin new-booking save and optional payment recording are separate HTTP requests (`frontend/components/admin/booking-form.tsx:252`). If the booking succeeds but recording money fails or its response is lost, retrying the form may create another booking. Preserve the created reference and retry only the failed step, or expose one idempotent compound endpoint. This failure mode is source-derived, not reproduced with network fault injection.
- **Previously created payment links after repricing:** Price edits do not clear `booking.payment_link`, while each initialized `Payment` retains its original amount. The detail screen presents the active link beside the current balance and includes that balance in prepared WhatsApp copy (`frontend/components/admin/screens/booking-detail.tsx:134`). A link created before a price or balance change can therefore request a different amount from the copy. Review/invalidate or accurately label old links when money changes. This is a source-derived risk; the audit did not execute a gateway payment against an old link after repricing.
- **Settings tab switching (hypothesis rejected):** Despite remount-looking source code, the current browser run preserved unsaved Business settings through Business → Booking & VAT → Business. No data-loss defect was reproduced for that journey.
- **Concurrency / durability:** SQLite tests cannot certify PostgreSQL locking, multi-worker deployment, gateway timing, email delivery, refunds, backups, or restore behavior. None of those should be inferred from the passing functional suite.

## Recommended order

1. Preserve booked prices/discounts for non-price edits and reconcile paid state on price changes.
2. Make receipt writes transactional, locked, and idempotent.
3. Make destructive configuration changes safe for existing bookings and preserve explicit service restrictions.
4. Correct dashboard counts; add cleaner clash visibility, idempotent hiring, and application pagination.
5. Add regressions for these edge cases; the passing baseline suite currently misses them.
