import type { Metadata } from "next";
import { Suspense } from "react";

import { BookingFlow } from "@/components/booking/booking-flow";
import { BackendError } from "@/components/sections";
import { getServices, getSite } from "@/lib/api";
import { ContentIn, PageTransition, SkeletonOut } from "@/components/transitions";

export const metadata: Metadata = {
  title: "Book a clean",
  description: "Get an instant price for commercial cleaning in Lagos and pay securely with Paystack.",
};

async function Flow({ searchParams }: { searchParams: PageProps<"/book">["searchParams"] }) {
  const [params, data] = await Promise.all([
    searchParams,
    Promise.all([getServices(), getSite()]).catch(() => null),
  ]);
  if (!data) return <BackendError />;
  const [services, site] = data;
  const initial = services.find((s) => s.slug === params.service)?.slug ?? services[0]?.slug;

  return (
    <BookingFlow
      key={initial}
      services={services}
      site={site}
      initialService={initial}
      sharedParams={params.service === initial ? params : {}}
    />
  );
}

export default function BookPage(props: PageProps<"/book">) {
  return (
    <PageTransition>
      <div className="bg-surface-container-low">
        <div className="container-page py-10 md:py-14">
          <p className="eyebrow">Instant price</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em] md:text-[40px] md:leading-[48px]">
            Book a commercial clean
          </h1>
          <p className="mt-3 max-w-2xl text-on-surface-variant">
            Tell us about your space to see the full price, including VAT. Pay online to confirm, or send us the details
            on WhatsApp for a custom quote.
          </p>
          <div className="mt-8">
            <Suspense
              fallback={
                <SkeletonOut>
                  <div className="h-[640px] animate-pulse rounded-3xl bg-white" />
                </SkeletonOut>
              }
            >
              <ContentIn>
                <Flow searchParams={props.searchParams} />
              </ContentIn>
            </Suspense>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
