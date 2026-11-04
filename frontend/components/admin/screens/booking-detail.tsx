"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCheck,
  Copy,
  Droplets,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PlayCircle,
  ReceiptText,
  TriangleAlert,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { WhenLine } from "@/components/admin/booking-bits";
import { BackLink } from "@/components/admin/screens/booking-editor";
import {
  Button,
  buttonClass,
  Chip,
  Dialog,
  ErrorNote,
  Field,
  inputClass,
  Panel,
  PaymentChip,
  Spinner,
  StatusChip,
  useToast,
} from "@/components/admin/ui";
import { WhatsAppIcon } from "@/components/icons";
import { api } from "@/lib/admin/api";
import { customerWhatsApp, formatDateTime, paymentMethodLabel, sourceLabel } from "@/lib/admin/labels";
import type { BookingDetail, BookingStatus, Cleaner } from "@/lib/admin/types";
import { naira } from "@/lib/format";

type QuoteLine = { label: string; amount: number };
type Breakdown = {
  lines?: QuoteLine[];
  discount_amount?: number;
  area_surcharge?: number;
  visits?: number;
  minimum_applied?: boolean;
  estimate?: Breakdown;
  subtotal?: number;
  discount_code?: string;
  code_discount_amount?: number;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="min-w-0 text-on-surface">{children}</dd>
    </div>
  );
}

export function BookingDetailScreen() {
  const { reference } = useParams<{ reference: string }>();
  const client = useQueryClient();
  const toast = useToast();
  const key = ["booking", reference];

  const { data: b, error, isPending } = useQuery({
    queryKey: key,
    queryFn: () => api<BookingDetail>(`bookings/${reference}/`),
  });
  const { data: cleaners } = useQuery({
    queryKey: ["cleaners", "active"],
    queryFn: () => api<Cleaner[]>("cleaners/", { query: { active: "1" } }),
  });

  const [teamOpen, setTeamOpen] = useState(false);
  const [team, setTeam] = useState<number[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payAmount, setPayAmount] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);

  function onSaved(updated: BookingDetail, message: string) {
    client.setQueryData(key, updated);
    client.invalidateQueries({ queryKey: ["bookings"] });
    client.invalidateQueries({ queryKey: ["dashboard"] });
    toast(message);
  }

  const patch = useMutation({
    mutationFn: (body: Partial<Record<string, unknown>>) =>
      api<BookingDetail>(`bookings/${reference}/`, { method: "PATCH", body }),
  });
  const recordPayment = useMutation({
    mutationFn: () =>
      api<BookingDetail>(`bookings/${reference}/record-payment/`, {
        method: "POST",
        body: { method: payMethod, amount: Number(payAmount) || undefined },
      }),
    onSuccess: (updated) => {
      onSaved(updated, "Payment recorded");
      setPayOpen(false);
      setPayAmount("");
    },
  });
  function setStatus(status: BookingStatus, message: string) {
    patch.mutate({ status }, { onSuccess: (u) => onSaved(u, message), onError: (e) => toast(e.message, "error") });
  }

  if (isPending) return <Spinner />;
  if (error || !b) return <ErrorNote error={error ?? new Error("Booking not found.")} />;

  const breakdown = (b.price_breakdown as Breakdown) ?? {};
  const shown = breakdown.estimate ?? breakdown;
  const activeLink = b.payment_link;
  const whatsappPayText = activeLink
    ? `Hello ${b.contact_name.split(" ")[0]}, here is your secure Paystack link for Kleandeck booking ${b.reference} (${naira(b.balance_due)}): ${activeLink}`
    : "";
  const assigned = new Set(b.cleaners.map((c) => c.id));

  return (
    <div className="animate-fade-up">
      <BackLink href="/admin/bookings" label="Bookings" />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={b.status} />
            {b.status !== "quote_requested" && <PaymentChip status={b.payment_status} />}
            <Chip className="bg-surface-container text-on-surface-variant">{sourceLabel[b.source]}</Chip>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.015em] md:text-[28px]">{b.customer_name}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {b.reference} · {b.service_name}
            {b.frequency_label ? ` · ${b.frequency_label}` : ""} · created {formatDateTime(b.created_at)}
            {b.created_by_name ? ` by ${b.created_by_name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {customerWhatsApp(b.phone) && (
            <a href={customerWhatsApp(b.phone, `Hello ${b.contact_name.split(" ")[0]}, this is Kleandeck about booking ${b.reference}.`)!} target="_blank" rel="noopener" className={buttonClass("whatsapp")}>
              <WhatsAppIcon className="size-4" /> WhatsApp
            </a>
          )}
          <Link href={`/admin/bookings/${b.reference}/edit`} className={buttonClass("ghost")}>
            <Pencil className="size-4" /> Edit
          </Link>
          {b.status === "confirmed" && (
            <Button loading={patch.isPending} onClick={() => setStatus("in_progress", "Job started")}>
              <PlayCircle className="size-4" /> Start job
            </Button>
          )}
          {(b.status === "confirmed" || b.status === "in_progress") && (
            <Button variant="accent" loading={patch.isPending} onClick={() => setStatus("completed", "Job completed")}>
              <CheckCheck className="size-4" /> Mark completed
            </Button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Job">
            <dl className="divide-y divide-surface-container">
              <Row label="When">
                {b.scheduled_date ? <WhenLine booking={b} /> : <span className="text-outline">Not scheduled</span>}
              </Row>
              <Row label="Service">
                {b.service_name}
                {b.frequency_label ? ` · ${b.frequency_label}` : ""}
              </Row>
              <Row label="Where">
                <span className="inline-flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-outline" />
                  <span>{[b.address, b.area_name].filter(Boolean).join(", ") || "—"}</span>
                </span>
              </Row>
              {b.site_notes && <Row label="Access notes">{b.site_notes}</Row>}
              <Row label="Site needs">
                <span className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Droplets className="size-3.5 text-tertiary" /> Water
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Zap className="size-3.5 text-warning" /> Power
                  </span>
                  {b.site_requirements_confirmed ? (
                    <Chip className="bg-secondary/10 text-on-secondary-container">Confirmed by customer</Chip>
                  ) : (
                    <Chip className="bg-warning/12 text-on-warning-container">
                      <TriangleAlert className="size-3" /> Not confirmed
                    </Chip>
                  )}
                </span>
              </Row>
              {b.terms_accepted_at && <Row label="Terms">Accepted {formatDateTime(b.terms_accepted_at)}</Row>}
            </dl>
          </Panel>

          <Panel
            title="Team"
            description={b.cleaners.length ? undefined : "No one assigned yet"}
            action={
              <Button
                size="sm"
                variant="subtle"
                onClick={() => {
                  setTeam(b.cleaners.map((c) => c.id));
                  setTeamOpen(true);
                }}
              >
                {b.cleaners.length ? "Change" : "Assign"}
              </Button>
            }
          >
            {b.cleaners.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {b.cleaners.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3">
                    <span>
                      <span className="block text-sm font-semibold">{c.full_name}</span>
                      <span className="block text-xs text-on-surface-variant">{c.role}</span>
                    </span>
                    {customerWhatsApp(c.phone) && (
                      <a
                        href={customerWhatsApp(c.phone, `Kleandeck job ${b.reference}: ${b.service_name}, ${b.scheduled_date ?? "date TBC"}, ${[b.address, b.area_name].filter(Boolean).join(", ")}.`)!}
                        target="_blank"
                        rel="noopener"
                        aria-label={`WhatsApp ${c.full_name}`}
                        className="grid size-9 place-items-center rounded-lg bg-whatsapp/12 text-on-secondary-container"
                      >
                        <WhatsAppIcon className="size-4" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-on-warning-container">
                <TriangleAlert className="size-4" /> Assign cleaners so they get the job details.
              </p>
            )}
          </Panel>

          <Panel title="Customer">
            <dl className="divide-y divide-surface-container">
              {b.company_name && <Row label="Company">{b.company_name}</Row>}
              <Row label="Contact">{b.contact_name}</Row>
              <Row label="Phone">
                <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                  <Phone className="size-3.5 text-outline" /> {b.phone}
                </a>
              </Row>
              <Row label="Email">
                {b.email ? (
                  <a href={`mailto:${b.email}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                    <Mail className="size-3.5 text-outline" /> {b.email}
                  </a>
                ) : (
                  <span className="text-outline">Not given</span>
                )}
              </Row>
            </dl>
          </Panel>

          <Panel title="Internal notes" description="Only the team sees these">
            <textarea
              rows={4}
              value={notes ?? b.internal_notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputClass} h-auto py-2.5`}
              placeholder="Anything the team should know…"
            />
            {notes !== null && notes !== b.internal_notes && (
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setNotes(null)}>
                  Discard
                </Button>
                <Button
                  size="sm"
                  loading={patch.isPending}
                  onClick={() =>
                    patch.mutate(
                      { internal_notes: notes },
                      { onSuccess: (u) => (onSaved(u, "Notes saved"), setNotes(null)), onError: (e) => toast(e.message, "error") },
                    )
                  }
                >
                  Save notes
                </Button>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-primary p-5 text-white shadow-pop">
            <div className="flex items-center justify-between">
              <p className="font-display text-[11px] font-bold tracking-[0.08em] text-tertiary uppercase">Payment</p>
              <span className="text-xs text-white/60">{b.pricing_mode === "manual" ? "Agreed price" : "Rate card"}</span>
            </div>
            {b.total ? (
              <>
                <div className="mt-3 space-y-1.5 text-sm text-white/80">
                  {shown.lines?.map((l) => (
                    <div key={l.label} className="flex justify-between gap-3">
                      <span>{l.label}</span>
                      <span className="tabular">{naira(l.amount)}</span>
                    </div>
                  ))}
                  {!!shown.discount_amount && (
                    <div className="flex justify-between">
                      <span>Frequency discount</span>
                      <span className="tabular">−{naira(shown.discount_amount)}</span>
                    </div>
                  )}
                  {!!b.discount_amount && (
                    <div className="flex justify-between text-tertiary">
                      <span>Code {b.discount_code}</span>
                      <span className="tabular">−{naira(b.discount_amount)}</span>
                    </div>
                  )}
                  {!!shown.area_surcharge && (
                    <div className="flex justify-between">
                      <span>Area surcharge</span>
                      <span className="tabular">{naira(shown.area_surcharge)}</span>
                    </div>
                  )}
                  {(shown.visits ?? 1) > 1 && (
                    <div className="flex justify-between">
                      <span>× {shown.visits} visits</span>
                      <span />
                    </div>
                  )}
                  <div className="flex justify-between border-t border-white/10 pt-1.5">
                    <span>Subtotal</span>
                    <span className="tabular">{naira(b.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT {b.vat_exempt ? "(exempt)" : `(${Number(b.vat_rate)}%)`}</span>
                    <span className="tabular">{naira(b.vat_amount)}</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/10 p-3">
                    <p className="text-[11px] font-bold tracking-[0.06em] text-white/60 uppercase">Total</p>
                    <p className="tabular mt-0.5 font-display text-xl font-bold">{naira(b.total)}</p>
                  </div>
                  <div className={`rounded-xl p-3 ${b.balance_due ? "bg-warning/20" : "bg-secondary/25"}`}>
                    <p className="text-[11px] font-bold tracking-[0.06em] text-white/60 uppercase">
                      {b.balance_due ? "Balance due" : "Fully paid"}
                    </p>
                    <p className="tabular mt-0.5 font-display text-xl font-bold">{naira(b.balance_due || b.amount_paid)}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-3 text-sm text-white/75">
                {shown.subtotal ? (
                  <p>
                    Customer&apos;s calculator estimate:{" "}
                    <strong className="text-white">{naira(shown.subtotal)} + VAT</strong>
                  </p>
                ) : null}
                <p className="mt-2">No price set yet. Agree the price on WhatsApp, then edit the booking to enter it.</p>
                <Link href={`/admin/bookings/${b.reference}/edit`} className={`${buttonClass("accent", "sm")} mt-4`}>
                  Set agreed price
                </Link>
              </div>
            )}

            {b.total > 0 && b.balance_due > 0 && b.status !== "cancelled" && (
              <div className="mt-4 space-y-2">
                <Button
                  className="w-full !bg-white/10 hover:!bg-white/20"
                  onClick={() => {
                    setPayAmount("");
                    setPayOpen(true);
                  }}
                >
                  <ReceiptText className="size-4" /> Record transfer or cash
                </Button>
                <p className="text-xs text-white/60">Agree payment directly with the customer on WhatsApp.</p>
              </div>
            )}

            {activeLink && b.balance_due > 0 && (
              <div className="mt-4 rounded-xl bg-white/10 p-3">
                <p className="truncate text-xs text-white/70">{activeLink}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 !bg-white !text-primary"
                    onClick={() => navigator.clipboard.writeText(activeLink).then(() => toast("Link copied"))}
                  >
                    <Copy className="size-3.5" /> Copy
                  </Button>
                  {customerWhatsApp(b.phone) && (
                    <a
                      href={customerWhatsApp(b.phone, whatsappPayText)!}
                      target="_blank"
                      rel="noopener"
                      className={`${buttonClass("whatsapp", "sm")} flex-1`}
                    >
                      <WhatsAppIcon className="size-3.5" /> Send
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <Panel title="Payment history" bodyClassName="divide-y divide-surface-container">
            {b.payments.length ? (
              b.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {paymentMethodLabel[p.channel] ?? (p.channel || "Paystack")}
                      <span className="ml-2 font-normal text-on-surface-variant">{formatDateTime(p.paid_at ?? p.created_at)}</span>
                    </p>
                    <p className="truncate text-xs text-outline">{p.reference}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular font-semibold">{naira(p.amount)}</p>
                    <p
                      className={`text-xs font-semibold ${
                        p.status === "success" ? "text-on-secondary-container" : p.status === "pending" ? "text-on-warning-container" : "text-error"
                      }`}
                    >
                      {p.status === "success" ? "Received" : p.status === "pending" ? "Link sent" : p.status}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-5 py-5 text-sm text-on-surface-variant">No payments yet.</p>
            )}
          </Panel>

          {b.status !== "cancelled" && b.status !== "completed" && (
            <Button variant="danger" className="w-full" onClick={() => setCancelOpen(true)}>
              <Ban className="size-4" /> Cancel booking
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={teamOpen}
        onClose={() => setTeamOpen(false)}
        title="Assign team"
        description={`${b.service_name} · ${b.scheduled_date ?? "date TBC"}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTeamOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={patch.isPending}
              onClick={() =>
                patch.mutate(
                  { cleaners: team },
                  {
                    onSuccess: (u) => {
                      onSaved(u, "Team updated");
                      setTeamOpen(false);
                    },
                    onError: (e) => toast(e.message, "error"),
                  },
                )
              }
            >
              Save team
            </Button>
          </>
        }
      >
        {cleaners?.length ? (
          <ul className="space-y-2">
            {cleaners.map((c) => {
              const on = team.includes(c.id);
              return (
                <li key={c.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                      on ? "border-primary bg-primary-fixed/40" : "border-surface-container-high"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setTeam(on ? team.filter((i) => i !== c.id) : [...team, c.id])}
                      className="size-5 accent-secondary"
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{c.full_name}</span>
                      <span className="block text-xs text-on-surface-variant">
                        {c.role} · {c.upcoming_jobs} upcoming job{c.upcoming_jobs === 1 ? "" : "s"}
                        {assigned.has(c.id) ? " (incl. this one)" : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">
            No active cleaners. <Link href="/admin/cleaners" className="font-semibold text-primary">Add cleaners</Link> first.
          </p>
        )}
      </Dialog>

      <Dialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record a payment"
        description="For money received outside Paystack. Paystack payments are recorded automatically."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button variant="accent" loading={recordPayment.isPending} onClick={() => recordPayment.mutate()}>
              Record payment
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Method">
            {(id) => (
              <select id={id} value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={inputClass}>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            )}
          </Field>
          <Field label="Amount (₦)" hint={`Balance due: ${naira(b.balance_due)}`}>
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                value={payAmount}
                placeholder={String(b.balance_due)}
                onChange={(e) => setPayAmount(e.target.value)}
                className={`${inputClass} tabular`}
              />
            )}
          </Field>
        </div>
        <div className="mt-4">
          <ErrorNote error={recordPayment.error} />
        </div>
      </Dialog>

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this booking?"
        description={b.amount_paid ? `The customer has paid ${naira(b.amount_paid)}. Arrange any refund separately in Paystack or by transfer.` : "The customer won't be notified automatically."}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep booking
            </Button>
            <Button
              variant="danger"
              loading={patch.isPending}
              onClick={() => {
                setStatus("cancelled", "Booking cancelled");
                setCancelOpen(false);
              }}
            >
              Cancel booking
            </Button>
          </>
        }
      >
        <p className="text-sm text-on-surface-variant">
          {b.reference} · {b.customer_name} · {b.service_name}
        </p>
      </Dialog>
    </div>
  );
}
