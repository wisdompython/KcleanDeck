// Shapes returned by the Django admin API (backend/staff/).

export type Role = "owner" | "staff";

export interface Me {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export type BookingStatus =
  | "quote_requested"
  | "awaiting_payment"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";
export type PaymentStatus = "unpaid" | "part_paid" | "paid" | "refunded";
export type BookingSource = "online" | "quote" | "manual";
/** Key of a time slot from Settings → Time slots ("" = to be agreed). */
export type TimeSlot = string;
export type PricingMode = "calculated" | "manual";

export interface CleanerRef {
  id: number;
  full_name: string;
  phone: string;
  role: string;
}

export interface BookingSummary {
  reference: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  source: BookingSource;
  customer_name: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  service_name: string;
  frequency_label: string | null;
  area_name: string | null;
  scheduled_date: string | null;
  time_slot: TimeSlot;
  time_slot_label: string;
  total: number;
  amount_paid: number;
  balance_due: number;
  deposit_amount: number;
  cleaners: CleanerRef[];
  site_requirements_confirmed: boolean;
  created_at: string;
}

export interface PaymentRecord {
  id: number;
  reference: string;
  amount: number;
  status: "pending" | "success" | "failed" | "abandoned";
  channel: string;
  paid_at: string | null;
  created_at: string;
  authorization_url: string;
}

export interface BookingInputs {
  quantities?: Record<string, number>;
  area_sqm?: number | null;
  addon_ids?: number[];
}

export interface BookingDetail extends BookingSummary {
  service: string;
  service_pricing_method: string;
  frequency: number | null;
  area: number | null;
  inputs: BookingInputs;
  pricing_mode: PricingMode;
  price_breakdown: Record<string, unknown>;
  subtotal: number;
  discount_code: string | null;
  discount_amount: number;
  vat_exempt: boolean;
  vat_rate: string;
  vat_amount: number;
  address: string;
  site_notes: string;
  terms_accepted_at: string | null;
  payment_method: string;
  paid_at: string | null;
  payment_link: string;
  internal_notes: string;
  payments: PaymentRecord[];
  created_by_name: string | null;
  updated_at: string;
}

export interface DiscountCode {
  id: number;
  code: string;
  name: string;
  kind: "percentage" | "fixed";
  value: number;
  minimum_subtotal: number;
  maximum_discount: number | null;
  usage_limit: number | null;
  services: number[];
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  redemption_count: number;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Dashboard {
  today: string;
  counts: {
    today: number;
    next_7_days: number;
    unassigned: number;
    awaiting_payment: number;
    quote_requests: number;
    paid_this_month: number;
  };
  upcoming: BookingSummary[];
  quote_requests: BookingSummary[];
  awaiting_payment: BookingSummary[];
  new_applications: number;
  active_cleaners: number;
}

export interface Cleaner {
  id: number;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
  notes: string;
  joined_on: string | null;
  upcoming_jobs: number;
  completed_jobs: number;
}

export interface Application {
  id: number;
  kind: "job" | "academy";
  status: "new" | "contacted" | "accepted" | "declined";
  full_name: string;
  phone: string;
  email: string;
  role: string;
  location: string;
  experience: string;
  message: string;
  internal_notes: string;
  created_at: string;
}

export interface AdminUnit {
  id?: number;
  label: string;
  help_text: string;
  price: number;
  min_qty: number;
  max_qty: number;
  default_qty: number;
  sort_order?: number;
}

export interface AdminAddOn {
  id?: number;
  label: string;
  price: number;
  is_active: boolean;
  sort_order?: number;
}

export interface AdminService {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  includes: string;
  badge: string;
  image: string;
  pricing_method: "flat" | "per_unit" | "per_sqm" | "quote";
  base_price: number;
  rate_per_sqm: number;
  min_area_sqm: number;
  max_area_sqm: number;
  minimum_charge: number;
  quote_threshold: number | null;
  price_suffix: string;
  frequencies: number[];
  sort_order: number;
  is_active: boolean;
  units: AdminUnit[];
  addons: AdminAddOn[];
  starting_price: number | null;
  booking_count: number;
  time_slots: number[];
  min_lead_days: number | null;
  deposit_percent: number;
  categories: number[];
  area_prices: { area: number; surcharge: number }[];
  photo_url: string;
  photo_card_url: string;
  photo_width: number;
  has_photo: boolean;
}

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  buyer: string;
  description: string;
  cta_label: string;
  services: number[];
  primary_service: number | null;
  image: string;
  sort_order: number;
  is_active: boolean;
  photo_url: string;
  photo_card_url: string;
  photo_width: number;
  has_photo: boolean;
}

export interface AdminTimeSlot {
  id: number;
  key: string;
  label: string;
  hint: string;
  sort_order: number;
  is_active: boolean;
}

export interface AdminQuote {
  lines: { label: string; amount: number }[];
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
  due_now: number;
  due_later: number;
}

export interface AdminFrequency {
  id: number;
  label: string;
  slug: string;
  description: string;
  discount_percent: string;
  visits_per_payment: number;
  sort_order: number;
  is_active: boolean;
}

export interface AdminArea {
  id: number;
  name: string;
  surcharge: number;
  sort_order: number;
  is_active: boolean;
}

export interface AdminFaq {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  show_on_homepage: boolean;
}

export interface SiteSettings {
  business_name: string;
  whatsapp_number: string;
  phone_number: string;
  email: string;
  notification_emails: string;
  address: string;
  coverage_text: string;
  vat_enabled: boolean;
  vat_rate: string;
  min_booking_lead_days: number;
  terms_content: string;
  terms_updated_on: string | null;
}

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  last_login: string | null;
  temp_password?: string | null;
}
