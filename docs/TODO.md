# Kleandeck to-do

From [ideas.md](ideas.md). Ordered quickest-win first. Tick items off as they ship.

## Next up (small)

### 1. Forwardable quote link ✅
Let a customer send the exact calculated price to their boss or finance team.
- [x] Keep the calculator choices (service, frequency, rooms or floor area, extras, area) in the `/book` link as you change them
- [x] Opening that link restores the same choices and price (recalculated live; invalid or out-of-date choices are dropped)
- [x] "Copy link" and "Share on WhatsApp" buttons under the price summary
- [x] Browser tests: reopened link shows the same total; WhatsApp message has price and link; broken links still work

### 2. "Is this cleaner free?" when assigning a team
Avoid double-booking a cleaner on the same day and time.
- [ ] Assign-team dialog shows, per cleaner, other jobs on the same date (and time slot)
- [ ] Clear warning when choosing someone already booked at that time (still allowed)
- [ ] Backend: cleaner list can include jobs for a given date
- [ ] Tests: API returns clashes; browser test sees the warning

### 3. One-tap WhatsApp updates to the customer
Tell the customer when the job starts and finishes, without typing the message.
- [ ] After **Start job** and **Mark completed**, offer "Tell the customer on WhatsApp" with a ready-made message (team, time, reference)
- [ ] Message wording editable in Business settings (with sensible defaults)
- [ ] Browser test: the link opens WhatsApp with the right number and text

### 4. Referral field at booking
Find out who sends you customers.
- [ ] Optional "Who referred you?" on the booking form and quote request
- [ ] Shown on the booking page in the admin, and searchable
- [ ] Decide with Onaopemipo whether there's a reward (handled by staff, not automatic)

## Then (medium)

### 5. Completion photos and sign-off checklist
Real proof of work on finished jobs.
- [ ] When marking a job completed: tick a short checklist and add up to a few photos
- [ ] Checklist items set per service (e.g. floors, restrooms, waste cleared)
- [ ] Photos stored with the booking (reuse the existing upload and resize code)
- [ ] Shown on the booking page; option to share with the customer on WhatsApp
- [ ] Ask customers' permission before using any photo in marketing

### 6. Several addresses in one request
For property managers and shortlet operators with many units.
- [ ] "Add another address" in the booking flow, each with its own rooms/area
- [ ] Decide: one booking per address with one combined payment, or a single WhatsApp quote listing all addresses
- [ ] Admin shows the linked bookings together

## Later (large)

### 7. Next visit created automatically for regular customers
Weekly or monthly customers shouldn't depend on staff remembering.
- [ ] Decide how far ahead to create visits (e.g. the visits one payment covers)
- [ ] Daily scheduled task creates the upcoming visits and flags payments due
- [ ] Changing or cancelling one visit vs. the whole series
- [ ] Dashboard shows "renewal payment due" for regular customers

## Parked

- Separate web pages for each use case (offices, shortlets, real estate, interior decor), for sharing and ads.
