"use client";

import { CircleAlert, CircleCheck, Clock, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { WhatsAppIcon } from "@/components/icons";
import { btn } from "@/components/ui";
import { naira, whatsappLink } from "@/lib/format";
import type { PublicBooking } from "@/lib/types";

type Result =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "done"; paymentStatus: string; booking: PublicBooking };

function formatDate(iso: string | null): string {
  if (!iso) return "To be agreed";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function Confirmation({ reference, whatsappNumber }: { reference: string; whatsappNumber: string }) {
  const [fetched, setFetched] = useState<Result>({ state: "loading" });
  const result: Result = reference
    ? fetched
    : { state: "error", message: "We couldn't find a payment reference in this link." };
  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;

    async function check() {
      try {
        const res = await fetch(`/api/payments/verify/?reference=${encodeURIComponent(reference)}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.detail ?? "We couldn't check this payment.");
        if (cancelled) return;
        setFetched({ state: "done", paymentStatus: body.payment_status, booking: body.booking });
        // Bank transfers can take a moment to confirm: re-check a few times.
        if (body.payment_status === "pending" && retries++ < 5) timer = setTimeout(check, 5000);
      } catch (err) {
        if (cancelled) return;
        setFetched({ state: "error", message: err instanceof Error ? err.message : "We couldn't check this payment." });
      }
    }

    void check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reference]);

  const help = (text: string) => (
    <a href={whatsappLink(whatsappNumber, text)} className={btn.whatsapp}>
      <WhatsAppIcon className="size-5" /> Message us on WhatsApp
    </a>
  );

  if (result.state === "loading") {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-card">
        <LoaderCircle className="mx-auto size-10 animate-spin text-primary" aria-hidden="true" />
        <p className="mt-4 font-display text-lg font-semibold">Confirming your payment…</p>
      </div>
    );
  }

  if (result.state === "error") {
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-card md:p-10">
        <CircleAlert className="mx-auto size-12 text-warning" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">We couldn&apos;t confirm this payment</h1>
        <p className="mt-2 text-on-surface-variant">{result.message}</p>
        <p className="mt-1 text-sm text-outline">If you were charged, message us with reference {reference || "—"}.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {help(`Hello Kleandeck, I need help with payment ${reference}.`)}
          <Link href="/book" className={btn.ghost}>
            Back to booking
          </Link>
        </div>
      </div>
    );
  }

  const { booking, paymentStatus } = result;
  const paid = booking.payment_status === "paid" || booking.payment_status === "part_paid";

  if (!paid) {
    const pending = paymentStatus === "pending";
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-card md:p-10">
        {pending ? (
          <Clock className="mx-auto size-12 text-warning" aria-hidden="true" />
        ) : (
          <CircleAlert className="mx-auto size-12 text-error" aria-hidden="true" />
        )}
        <h1 className="mt-4 text-2xl font-bold">{pending ? "Payment still processing" : "Payment not completed"}</h1>
        <p className="mt-2 text-on-surface-variant">
          {pending
            ? "Paystack hasn't confirmed this payment yet. This page will update automatically, and we'll email you once it's through."
            : "Your booking isn't confirmed because the payment didn't go through. You haven't been charged for it."}
        </p>
        <p className="mt-1 text-sm text-outline">Booking reference: {booking.reference}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {!pending && (
            <Link href="/book" className={btn.accent}>
              Try again
            </Link>
          )}
          {help(`Hello Kleandeck, I need help with booking ${booking.reference}.`)}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-card">
      <div className="bg-primary p-8 text-center text-white md:p-10">
        <CircleCheck className="mx-auto size-12 text-secondary" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold text-white md:text-3xl">
          Thank you, {booking.contact_first_name}. You&apos;re booked.
        </h1>
        <p className="mt-2 text-white/70">
          {booking.balance_due > 0
            ? `We've received your ${naira(booking.amount_paid)} deposit. The balance of ${naira(booking.balance_due)} is due on completion.`
            : `We've received ${naira(booking.amount_paid)}. A receipt is on its way to your email.`}
        </p>
      </div>
      <dl className="grid gap-4 p-6 text-sm sm:grid-cols-2 md:p-8">
        <div>
          <dt className="text-outline">Reference</dt>
          <dd className="font-display text-base font-semibold">{booking.reference}</dd>
        </div>
        <div>
          <dt className="text-outline">Service</dt>
          <dd className="font-display text-base font-semibold">
            {booking.service}
            {booking.frequency ? ` · ${booking.frequency}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-outline">Date</dt>
          <dd className="font-display text-base font-semibold">{formatDate(booking.scheduled_date)}</dd>
        </div>
        <div>
          <dt className="text-outline">Time</dt>
          <dd className="font-display text-base font-semibold">{booking.time_slot || "To be agreed"}</dd>
        </div>
      </dl>
      <div className="border-t border-surface-container p-6 md:p-8">
        <h2 className="font-display text-base font-semibold">What happens next</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-on-surface-variant">
          <li>We assign your cleaning team.</li>
          <li>We message you on WhatsApp to confirm who&apos;s coming and when.</li>
          <li>On the day, please make sure running water and electricity are available.</li>
        </ol>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {help(`Hello Kleandeck, about my booking ${booking.reference}.`)}
          <Link href="/" className={btn.ghost}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
