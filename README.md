# Kleandeck

Booking website and admin for Kleandeck, a commercial cleaning and facility-support business in Lagos.

- **Website** (Next.js): use-case homepage, five services, live price calculator, Paystack checkout, WhatsApp quote requests, pricing, FAQ, careers, training academy and terms.
- **Admin** (Next.js at `/admin`, backed by the Django API): dashboard, bookings (online and entered by staff), cleaners, applications, services and rates, settings, FAQs, terms and team accounts.
- **Backup Django admin** at `/backstage/` (superusers only) for raw data fixes. The team never needs it.

```
backend/    Django API (pricing engine, bookings, Paystack, admin API in staff/)
frontend/   Next.js website (app/(site)) and team admin (app/admin)
compose.yml Postgres + backend + frontend + Caddy
Caddyfile   routes /api, /backstage, /static → Django; everything else → Next.js
```

## How pricing works

Every price comes from one place, `backend/pricing/engine.py`, and every rate is set in the admin under **Services & rates**. Each service uses one pricing method:

| Method | Price per visit |
|---|---|
| Flat | base price |
| Per room/unit | base price + Σ (unit price × count), e.g. rooms, restrooms, kitchens |
| Per m² | base price + rate × floor area |
| Custom quote | no online price; the customer is sent to WhatsApp |

Then, in order:

1. Add-ons are added.
2. The frequency discount is taken off (**Settings → Frequencies**: discount % and how many visits one payment covers, e.g. weekly billed monthly = 4).
3. The **minimum charge** is applied.
4. The **area surcharge** is added: the service's own surcharge for that area if set on the service, otherwise the area's default (**Settings → Areas**).
5. The result is multiplied by the number of visits.
6. **VAT** (7.5%, in **Settings → Booking & VAT**) is added on top.

If a service has a **quote threshold** and the price goes above it, the customer is sent to WhatsApp instead of paying online. This is used for large post-construction jobs.

Each service can also set:

- **Deposit %**: the customer pays that share online to confirm, and the rest on completion. The booking shows as *Part paid* until the balance is recorded.
- **Arrival times offered** (from **Settings → Time slots**) and **Earliest booking** in days, overriding the site default.
- **Categories**: which homepage use cases list it. Categories (**Admin → Categories**) have their own copy, photo, order and "button opens" service.

The **price tester** on each service shows the exact customer price, including VAT and any deposit, for any rooms, frequency, area and add-ons. **Duplicate** copies a service as a hidden draft.

The seed data loads **placeholder rates**. Replace them with the real rate card before launch.

## Bookings

| Source | How it's created | Status |
|---|---|---|
| Online checkout | Customer pays at the calculated price | Awaiting payment → Confirmed when Paystack confirms |
| WhatsApp quote request | Customer sends details, then chats on WhatsApp | Quote requested |
| Entered by staff | **New booking** in the admin | Whatever staff set |

Staff bookings use five sections: **Client details**, **Service & space**, **Schedule & team**, **Site & notes**, and **Review & billing**. Use **Continue** and **Back**, or choose a section directly; entered details stay in place. The review summary links back to each section.

For deals agreed outside the website, choose **Agreed price** in **Review & billing**, then enter the amount before VAT. VAT is added automatically, or tick *VAT exempt*. On the booking page:

- **Create Paystack link**, then **Send** opens WhatsApp to the customer with the link. The booking is marked paid automatically when they pay.
- **Record transfer or cash** for money received outside Paystack (part payments are fine).
- **Assign** cleaners, then message each of them the job details on WhatsApp.
- **Start job**, **Mark completed** or **Cancel booking**.

## Admin roles

| Role | Can do |
|---|---|
| Owner | Everything, including services and rates, settings and team accounts |
| Staff | Bookings, cleaners and applications. Can view rates and settings but not change them |

Owners add people under **Team**; each new account gets a one-time password to share privately. Django superusers count as owners.

A booking is only marked paid after Paystack confirms the charge, either through the signed webhook or a server-side verify call, and the amount must match.

## Run locally

Requirements: Python 3.12+, Node 24+.

```bash
cp .env.example .env          # set DJANGO_DEBUG=1 and FRONTEND_URL=http://localhost:3000 for local work

# Backend (SQLite when DATABASE_URL is unset)
cd backend
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # macOS/Linux: .venv/bin/...
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py seed
.venv/Scripts/python manage.py createsuperuser
.venv/Scripts/python manage.py runserver 8000

# Frontend (second terminal)
cd frontend
npm install
API_PROXY_URL=http://localhost:8000 BACKEND_INTERNAL_URL=http://localhost:8000 npm run dev
```

Site: http://localhost:3000 · Admin: http://localhost:3000/admin (sign in with your superuser's email or username)

Backend tests: `cd backend && .venv/Scripts/python manage.py test` · Lint: `cd frontend && npm run lint`

## End-to-end tests

Browser tests (Playwright) in `e2e/` drive the real site and admin against a throwaway Docker stack on http://localhost:8089, with its own database and a fake Paystack on :8099. Your dev stack and data are untouched.

```bash
cd e2e
npm install && npx playwright install chromium   # first time only
npm run e2e          # fresh stack + full run (about 3 minutes)
npm test             # re-run against the stack that's already up
npm run test:ui      # pick and watch tests in Playwright's UI
npm run stack:down   # remove the e2e stack and its data
```

| Spec | Covers |
|---|---|
| `public-site` | Homepage use cases and live prices, FAQ accordion, navigation, pricing, terms, 404, admin hidden from search |
| `booking` | Calculator (rooms, add-ons, frequency discounts, area required), large jobs routed to WhatsApp, Paystack checkout paid and cancelled, prefilled WhatsApp quote |
| `careers-applications` | Job application → hired onto the cleaner roster; academy enquiry; required fields |
| `admin-auth` | Login redirect and return, wrong password, username login, sign-out, hidden Django admin |
| `admin-bookings` | Agreed-price booking with VAT, team assignment, part + full payments, start/complete; rate-card pricing; Paystack link paid by the customer; edit, VAT exempt, cancel, search and filters; dashboard unassigned-job card |
| `admin-pricing-settings` | Rate changes show on the website, new room types and add-ons, hiding a service, WhatsApp number and VAT switch, new areas with surcharges, new FAQs |
| `admin-service-setup` | New category with uploaded photo on the homepage, service photo upload, price tester, per-service area surcharge, deposit checkout, per-service time slots and earliest date, duplicate |
| `admin-team` | Owner adds staff with a one-time password; staff can book but not change rates, settings or team; deactivation ends their session; owners can't lock themselves out |
| `mobile` | Phone menu, inline price summary, no sideways scrolling, admin drawer |

The fake Paystack (`e2e/fake-paystack/server.py`) implements initialize and verify and serves a checkout page with **Pay** and **Cancel**, so the full redirect-and-verify flow runs without real money.

## Deploy with Docker (VPS)

```bash
cp .env.example .env    # set DJANGO_SECRET_KEY, POSTGRES_PASSWORD, PAYSTACK_SECRET_KEY,
                        # SITE_ADDRESS=yourdomain.com, FRONTEND_URL=https://yourdomain.com,
                        # DJANGO_ALLOWED_HOSTS=yourdomain.com,backend,
                        # DJANGO_CSRF_TRUSTED_ORIGINS=https://yourdomain.com, DJANGO_SECURE_COOKIES=1
docker compose up -d --build
docker compose exec backend python manage.py createsuperuser
```

Point the domain's DNS at the server first. Caddy gets the HTTPS certificate automatically. On start-up the backend runs migrations and fills in any missing seed data. It never overwrites rates already set in the admin.

To try the stack locally, set `SITE_ADDRESS=:80` (and `HTTP_PORT=8080` if port 80 is taken) and open http://localhost.

Back up the `db_data` and `media` (uploaded photos) volumes regularly, e.g. `docker compose exec db pg_dump -U kleandeck kleandeck > backup.sql`.

Uploaded photos are resized by the backend into WebP (2000px and 960px versions) and served by Caddy from the `media` volume.

### Render instead of a VPS

Create a Postgres database and two web services:

- **backend**: Docker, root `backend/`. Set the env vars above plus `DATABASE_URL` from Render. Attach a **persistent disk** at `/app/media` and set `SERVE_MEDIA=1`, or uploaded photos are lost on every deploy.
- **frontend**: Docker, root `frontend/`. Set `BACKEND_INTERNAL_URL` to the backend's URL, and the build arg / env `API_PROXY_URL` to the same URL so Next.js forwards `/api`, `/media` and `/backstage`.

Set `FRONTEND_URL` on the backend to the frontend's public URL. On the free tier, services sleep when idle (which slows the first checkout after a quiet period), and persistent disks need a paid plan.

## Paystack

1. Put the secret key in `PAYSTACK_SECRET_KEY` (`sk_test_…` until launch).
2. In the Paystack dashboard, set the webhook URL to `https://<your domain>/api/paystack/webhook/`.
3. The callback URL is set automatically per payment (`<FRONTEND_URL>/booking/confirmation`).

## Before launch

- [ ] Real rates for every service, frequency and area (Admin → Services & rates, Settings)
- [ ] Final terms and conditions (Admin → Settings → Terms), replacing the draft
- [ ] Review FAQ answers (Admin → Settings → FAQs), especially supplies/equipment and cancellations
- [ ] WhatsApp number, phone, email and team notification emails (Admin → Settings → Business & contact)
- [ ] Team accounts for owners and staff (Admin → Team)
- [ ] Real photos in `frontend/public/images/` (current ones are AI placeholders from the Stitch drafts)
- [ ] Academy programme outline (`frontend/app/academy/page.tsx`)
- [ ] SMTP settings so confirmation and team emails are sent
- [ ] Paystack live key and webhook
