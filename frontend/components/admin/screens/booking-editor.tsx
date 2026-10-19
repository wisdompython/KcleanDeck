"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { BookingForm } from "@/components/admin/booking-form";
import { ErrorNote, PageHeader, Spinner } from "@/components/admin/ui";
import { api } from "@/lib/admin/api";
import type { BookingDetail } from "@/lib/admin/types";
import type { Service, Site } from "@/lib/types";

function usePublicCatalogue() {
  const services = useQuery({
    queryKey: ["public-services"],
    queryFn: () => fetch("/api/services/").then((r) => r.json() as Promise<Service[]>),
  });
  const site = useQuery({
    queryKey: ["public-site"],
    queryFn: () => fetch("/api/site/").then((r) => r.json() as Promise<Site>),
  });
  return { services: services.data, site: site.data, error: services.error || site.error };
}

export function NewBookingScreen() {
  const { services, site, error } = usePublicCatalogue();
  return (
    <div className="animate-fade-up">
      <BackLink href="/admin/bookings" label="Bookings" />
      <PageHeader
        eyebrow="Manual booking"
        title="New booking"
        description="For jobs agreed on WhatsApp, by phone or in person. Price it from the rate card or enter the agreed amount."
      />
      <ErrorNote error={error} />
      {services && site ? <BookingForm services={services} site={site} /> : <Spinner />}
    </div>
  );
}

export function EditBookingScreen() {
  const { reference } = useParams<{ reference: string }>();
  const { services, site, error } = usePublicCatalogue();
  const booking = useQuery({
    queryKey: ["booking", reference],
    queryFn: () => api<BookingDetail>(`bookings/${reference}/`),
  });
  return (
    <div className="animate-fade-up">
      <BackLink href={`/admin/bookings/${reference}`} label={reference} />
      <PageHeader eyebrow="Edit booking" title={booking.data?.customer_name ?? reference} />
      <ErrorNote error={error || booking.error} />
      {services && site && booking.data ? (
        <BookingForm services={services} site={site} existing={booking.data} />
      ) : (
        <Spinner />
      )}
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant transition hover:text-primary"
    >
      <ArrowLeft className="size-4" /> {label}
    </Link>
  );
}
