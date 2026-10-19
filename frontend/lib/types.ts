// Shapes returned by the Django API (backend/*/api.py).

export type PricingMethod = "flat" | "per_unit" | "per_sqm" | "quote";

export interface Frequency {
  id: number;
  label: string;
  slug: string;
  description: string;
  discount_percent: string;
  visits_per_payment: number;
}

export interface Area {
  id: number;
  name: string;
  surcharge: number;
}

export interface PricingUnit {
  id: number;
  label: string;
  help_text: string;
  price: number;
  min_qty: number;
  max_qty: number;
  default_qty: number;
}

export interface AddOn {
  id: number;
  label: string;
  price: number;
}

export interface TimeSlot {
  key: string;
  label: string;
  hint: string;
}

export interface Service {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  includes: string[];
  badge: string;
  /** Large photo; uploaded photos live under /media/. */
  image: string;
  /** Smaller version of the photo for cards and phones. */
  image_card: string;
  /** Percent paid online to confirm; 0 = full amount upfront. */
  deposit_percent: number;
  /** Earliest booking in days from today; null = site default. */
  min_lead_days: number | null;
  time_slots: TimeSlot[];
  pricing_method: PricingMethod;
  base_price: number;
  rate_per_sqm: number;
  min_area_sqm: number;
  max_area_sqm: number;
  minimum_charge: number;
  quote_threshold: number | null;
  price_suffix: string;
  starting_price: number | null;
  units: PricingUnit[];
  addons: AddOn[];
  frequencies: Frequency[];
}

export interface Faq {
  id: number;
  question: string;
  answer: string;
  homepage: boolean;
}

export interface Site {
  business_name: string;
  whatsapp_number: string;
  phone_number: string;
  email: string;
  address: string;
  coverage_text: string;
  vat_enabled: boolean;
  vat_rate: string;
  min_booking_lead_days: number;
  /** Today's date in Lagos (YYYY-MM-DD). */
  today: string;
  time_slots: TimeSlot[];
  areas: Area[];
  faqs: Faq[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  buyer: string;
  description: string;
  cta_label: string;
  image: string;
  image_card: string;
  /** Slug of the service the card's button opens. */
  service: string | null;
  services: string[];
}

export interface Quote {
  lines: { label: string; amount: number }[];
  service_amount: number;
  discount_amount: number;
  minimum_applied: boolean;
  area_surcharge: number;
  per_visit: number;
  visits: number;
  subtotal: number;
  vat_rate: string;
  vat_amount: number;
  total: number;
  requires_quote: boolean;
  quote_reason: string;
}

export interface PublicBooking {
  reference: string;
  service: string;
  frequency: string | null;
  scheduled_date: string | null;
  time_slot: string;
  contact_first_name: string;
  total: number;
  amount_paid: number;
  balance_due: number;
  deposit_amount: number;
  payment_status: "unpaid" | "part_paid" | "paid" | "refunded";
  status: string;
}
