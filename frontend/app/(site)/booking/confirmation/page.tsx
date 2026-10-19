import type { Metadata } from "next";
import { Suspense } from "react";

import { Confirmation } from "@/components/booking/confirmation";
import { getSite } from "@/lib/api";
import { PageTransition } from "@/components/transitions";

export const metadata: Metadata = {
  title: "Booking confirmation",
  robots: { index: false },
};

async function Content({ searchParams }: { searchParams: PageProps<"/booking/confirmation">["searchParams"] }) {
  const [params, site] = await Promise.all([searchParams, getSite().catch(() => null)]);
  // Paystack appends ?reference=…&trxref=… to the callback URL.
  const raw = params.reference ?? params.trxref;
  const reference = Array.isArray(raw) ? raw[0] : raw;
  return <Confirmation reference={reference ?? ""} whatsappNumber={site?.whatsapp_number ?? ""} />;
}

export default function ConfirmationPage(props: PageProps<"/booking/confirmation">) {
  return (
    <PageTransition>
      <div className="bg-surface-container-low py-12 md:py-20">
        <div className="container-page max-w-2xl">
          <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}>
            <Content searchParams={props.searchParams} />
          </Suspense>
        </div>
      </div>
    </PageTransition>
  );
}
