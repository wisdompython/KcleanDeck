import type { Metadata } from "next";
import { Suspense } from "react";

import { WhatsAppIcon } from "@/components/icons";
import { BackendError, SectionHeading, ServiceCard, ServiceGridSkeleton } from "@/components/sections";
import { btn } from "@/components/ui";
import { getServices, getSite } from "@/lib/api";
import { vatLabel, whatsappLink } from "@/lib/format";
import type { Frequency } from "@/lib/types";
import { ContentIn, PageTransition, SkeletonOut } from "@/components/transitions";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Starting prices and quote guidance for Kleandeck commercial cleaning and facility support.",
};

async function PricingGrid() {
  const [services, site] = await Promise.all([getServices(), getSite()]).catch(() => [null, null] as const);
  if (!services || !site) return <BackendError />;

  // Frequencies offered on any bookable service, for the discount table.
  const frequencies = new Map<string, Frequency>();
  services
    .filter((s) => s.pricing_method !== "quote")
    .forEach((s) => s.frequencies.forEach((f) => frequencies.set(f.slug, f)));

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} detailed />
        ))}
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-surface-container-high bg-white p-6 md:p-8">
          <h2 className="text-xl font-semibold">Regular cleaning costs less</h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">Discounts apply to each visit on a schedule.</p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-outline">
                <tr className="border-b border-surface-container-high">
                  <th className="py-2 font-medium">Frequency</th>
                  <th className="py-2 font-medium">Discount</th>
                  <th className="py-2 font-medium">Schedule</th>
                </tr>
              </thead>
              <tbody>
                {[...frequencies.values()].map((f) => (
                  <tr key={f.slug} className="border-b border-surface-container last:border-0">
                    <td className="py-3 font-medium text-on-surface">{f.label}</td>
                    <td className="tabular py-3 text-on-secondary-container">
                      {Number(f.discount_percent) ? `${Number(f.discount_percent)}% off` : "—"}
                    </td>
                    <td className="py-3 text-on-surface-variant">
                      {f.visits_per_payment > 1 ? `${f.visits_per_payment} visits per cycle` : "Per visit"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-3xl border border-surface-container-high bg-white p-6 md:p-8">
          <h2 className="text-xl font-semibold">What affects your price</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-on-surface-variant">
            <li>
              <strong className="text-on-surface">Size of the space:</strong> the number of rooms, restrooms and kitchens, or
              the floor area for post-construction work.
            </li>
            <li>
              <strong className="text-on-surface">Extras:</strong> add-ons like upholstery or interior windows.
            </li>
            <li>
              <strong className="text-on-surface">Site readiness:</strong> unusual access or utilities that we must provide,
              such as a water tanker, are confirmed separately before the job.
            </li>
            <li>
              <strong className="text-on-surface">Location:</strong> any applicable travel charge is confirmed before you schedule.
            </li>
            <li>
              <strong className="text-on-surface">VAT:</strong> {site.vat_enabled ? `${vatLabel(site.vat_rate)} VAT` : "VAT"}{" "}
              is added to every booking and shown separately in the confirmed price.
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

async function QuoteBanner() {
  const site = await getSite().catch(() => null);
  return (
    <a
      href={whatsappLink(site?.whatsapp_number, "Hello Kleandeck, I'd like a custom quote.")}
      className={`${btn.whatsapp} shrink-0`}
    >
      <WhatsAppIcon className="size-5" /> Get a custom quote
    </a>
  );
}

export default function PricingPage() {
  return (
    <PageTransition>
      <div className="container-page py-12 md:py-20">
        <SectionHeading
          eyebrow="Pricing"
          title="Clear starting prices for core cleaning services"
          body="Review the starting prices for our core services, then continue on WhatsApp so we can confirm your scope, availability and final price before work begins."
        />
        <div className="mt-8 rounded-2xl border border-secondary bg-secondary-container/50 p-5 text-sm leading-6 text-on-surface-variant">
          <strong className="text-on-surface">What the starting price covers:</strong> the selected standard, deep or
          post-construction cleaning service. Add-ons and site-specific requirements are scoped separately on WhatsApp so you
          can approve the final amount before the team is assigned.
        </div>
        <div className="mt-10">
          <Suspense
            fallback={
              <SkeletonOut>
                <ServiceGridSkeleton />
              </SkeletonOut>
            }
          >
            <ContentIn>
              <PricingGrid />
            </ContentIn>
          </Suspense>
        </div>
        <div className="mt-12 flex flex-col gap-6 rounded-[2rem] bg-primary p-8 text-white md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-white">Large site or something different?</h2>
            <p className="mt-2 text-white/70">
              Large post-construction jobs, facility staffing and anything outside the core service scope are discussed and
              quoted directly on WhatsApp.
            </p>
          </div>
          <Suspense fallback={null}>
            <QuoteBanner />
          </Suspense>
        </div>
      </div>
    </PageTransition>
  );
}
