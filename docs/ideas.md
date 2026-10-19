# Kleandeck — product ideas

Grounded in what's already built (online calculator + Paystack checkout + deposits, WhatsApp quote
requests, manual bookings, Paystack payment links, cleaner assignment, editable services/prices/
categories/time slots/areas/FAQs/terms, photo uploads, owner/staff roles) and in a look at
[getshaare.com](https://www.getshaare.com/) and general cleaning-booking apps. Best idea first in
each group.

## Win more business

### 1. Shareable, indexable use-case landing pages
- **Problem it solves / who benefits**: Right now the four use cases (offices, shortlets, real
  estate, interior decor) are sections on one homepage. There's no single link to drop into a
  WhatsApp broadcast, a Google Business post or a Meta ad that speaks only to, say, shortlet
  operators. Owner and marketing benefit from something to point ads at; shortlet/real-estate
  customers land on copy that matches their situation instead of scrolling past the others.
- **Why now**: `Admin → Categories` already stores per-category copy, photo and "button opens
  service" — the content model is there, it's just rendered as homepage sections
  (`frontend/components/sections.tsx`, category data) rather than its own page/URL.
- **Effort**: M — mostly a new route per category reusing existing category/service data and
  components; no new pricing logic.
- **Where it would live**: `frontend/app/(site)/` (new `[category]/page.tsx` or similar),
  `frontend/components/sections.tsx`, existing category API in `backend/`.

### 2. A simple referral incentive at booking
- **Problem it solves / who benefits**: Office managers and shortlet operators are exactly the
  people who manage other properties or know other managers; there's currently no reason for them
  to tell a peer. A small, honestly-labelled "mention who referred you" field with a modest % off
  (tracked manually by staff, not an automated wallet system) gives the owner a free growth channel
  that costs nothing to run.
- **Why now**: The booking form (`booking-flow.tsx`) already collects contact details and the admin
  already supports discounts via frequency; a referral note is a small, low-risk addition rather
  than a new claim or review system (avoids the "unverifiable marketing" trap).
- **Effort**: S — one optional text field plus a manual admin note; no automated payout logic.
- **Where it would live**: `frontend/components/booking/booking-flow.tsx` (details step),
  `frontend/components/admin/screens/booking-editor.tsx` / `booking-detail.tsx` for staff to see it.

## Easier booking and payment

### 3. A forwardable quote link
- **Problem it solves / who benefits**: A facility manager rarely has sign-off authority alone —
  they need to forward the price to a boss or finance. Today the calculator result lives only in
  the current browser session; there's no link to paste into an email or WhatsApp to the actual
  decision-maker. This helps the customer get approval faster and reduces repeat typing into the
  calculator.
- **Why now**: `use-quote.ts` already recomputes a quote from URL-shaped inputs on every change —
  the state (service, frequency, quantities, area) is already serialisable; it just isn't persisted
  behind a shareable reference the way a quote-request already gets one (`quoteRef` in
  `booking-flow.tsx`).
- **Effort**: S — encode the existing inputs into the booking URL's query string and read them back
  on load; no new backend model needed if it's just query params.
- **Where it would live**: `frontend/components/booking/booking-flow.tsx`,
  `frontend/components/booking/use-quote.ts`, `frontend/app/(site)/book/`.

### 4. Multi-site batch requests for portfolio customers
- **Problem it solves / who benefits**: Real-estate agents and shortlet operators in the PRD's own
  use cases often manage several units at once (pre-handover of five flats, turnover of three
  shortlets). The booking flow is built for one address at a time, so these customers either do five
  separate bookings or drop to WhatsApp early. A simple "add another address" step before checkout
  reduces friction for the customers v1 is explicitly targeting.
- **Why now**: `booking-flow.tsx`'s "About the space" step already handles repeatable line items
  (room/unit steppers); the same pattern could repeat per address, or route straight to WhatsApp
  with all addresses pre-filled when the service is quote-only.
- **Effort**: M — UI for repeating an address block, and either multiple booking rows or a single
  quote-request with a list of addresses.
- **Where it would live**: `frontend/components/booking/booking-flow.tsx`,
  `backend/bookings/` (if creating several bookings in one submit).

## Running jobs (admin)

### 5. Auto-schedule the next visit for recurring jobs
- **Problem it solves / who benefits**: The pricing engine already bills recurring frequencies as
  one payment covering several visits (e.g. weekly billed monthly = 4 visits), but nothing in
  `backend/pricing/engine.py` or the booking model seems to turn that into the next calendar
  job automatically — staff would have to remember to create the next booking by hand. Staff save
  the most repetitive admin work, and the owner avoids the "we forgot the client's recurring clean"
  failure mode.
- **Why now**: The dashboard already surfaces "Jobs today" and "Next 7 days" counts
  (`frontend/components/admin/screens/dashboard.tsx`), so the data model for scheduled jobs exists;
  it's the generation step for repeat visits that's missing.
- **Effort**: L — needs a scheduling job/cron, decisions about how far ahead to generate, and
  handling edits/cancellations of a recurring series.
- **Where it would live**: `backend/bookings/` (new recurrence logic), a scheduled task (management
  command or Celery-less cron via Docker), `frontend/components/admin/screens/dashboard.tsx` for a
  "recurring job due" prompt.

### 6. A cleaner's-eye view before assigning
- **Problem it solves / who benefits**: `cleaners.tsx` shows upcoming/completed job *counts* per
  cleaner, but assigning from a booking doesn't show whether that cleaner is already booked at the
  same time elsewhere. A quick "busy that day" flag when picking a cleaner prevents double-booking
  and gives staff confidence they're not overloading one person.
- **Why now**: The counts already exist per cleaner (`upcoming_jobs`), and bookings already carry
  `scheduled_date` and `time_slot` — the pieces to cross-check are already in the API responses used
  by `booking-detail.tsx` and `cleaners.tsx`.
- **Effort**: S/M — mostly a read-only check at assignment time, no new data model.
- **Where it would live**: `frontend/components/admin/screens/booking-detail.tsx` (assign panel),
  `frontend/components/admin/booking-bits.tsx`, cleaner endpoint in `backend/staff/`.

## Trust and quality

### 7. Automatic WhatsApp status updates to the customer
- **Problem it solves / who benefits**: Staff already message cleaners and customers manually over
  WhatsApp at each step ("Create Paystack link, then Send", "Assign cleaners, then message each of
  them"). When a job is started or completed, the customer isn't told unless someone remembers to
  tap out a message — a facility manager waiting on a post-construction clean wants to know work has
  begun. A one-tap "notify customer" button next to **Start job** / **Mark completed** removes a
  manual step that's easy to skip during a busy day.
- **Why now**: `booking-bits.tsx` already has a `WhatsAppCustomer` component used elsewhere in the
  admin (e.g. for quote requests on the dashboard); the same click-to-chat pattern just needs a
  status-specific pre-filled message at the start/complete actions.
- **Effort**: S — reuse the existing WhatsApp click-to-chat helper with a new message template per
  status.
- **Where it would live**: `frontend/components/admin/booking-bits.tsx`,
  `frontend/components/admin/screens/booking-detail.tsx`.

### 8. Completion photos and a short sign-off checklist
- **Problem it solves / who benefits**: Shaaré's own site has no before/after gallery either, but
  it's a known gap across the category (and a real trust signal, unlike a stat or a star rating
  Kleandeck can't yet back up). A short checklist (e.g. "floors done", "restrooms done", "waste
  cleared") plus one or two photos attached when a job is marked completed gives the owner real
  completed-job evidence to reuse in future marketing, and gives the customer proof without needing
  invented testimonials.
- **Why now**: Photo upload and resizing already exists for services/categories
  (`photo-uploader.tsx`, backend WebP resizing in the README); the same upload path can attach to a
  booking instead of a service.
- **Effort**: M — reuses the existing upload pipeline; adds a small checklist UI and a
  booking-photos relation.
- **Where it would live**: `frontend/components/admin/screens/booking-detail.tsx`,
  `frontend/components/admin/photo-uploader.tsx`, `backend/bookings/` (model + serializer),
  `backend/media` storage already configured.

---

**Sources of inspiration**: `README.md`, `Kleandeck_PRD_draft.docx`, `pricing/engine.py`,
`frontend/components/booking/booking-flow.tsx`, `frontend/components/admin/screens/dashboard.tsx`,
`frontend/components/admin/screens/cleaners.tsx`, `frontend/components/admin/screens/applications.tsx`,
and https://www.getshaare.com/ (use-case/service pages, testimonials-as-trust-signal, and its own
lack of a before/after gallery or cleaner workload view).
