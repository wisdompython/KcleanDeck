import type { Metadata } from "next";
import { Suspense } from "react";

import { WhatsAppIcon } from "@/components/icons";
import { BackendError, FaqList, SectionHeading } from "@/components/sections";
import { btn } from "@/components/ui";
import { getSite } from "@/lib/api";
import { whatsappLink } from "@/lib/format";
import { ContentIn, PageTransition, SkeletonOut } from "@/components/transitions";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about Kleandeck's services, pricing, areas we cover and what we need on site.",
};

async function Faqs() {
  const site = await getSite().catch(() => null);
  if (!site) return <BackendError />;
  return (
    <>
      <FaqList faqs={site.faqs} />
      <div className="mt-10 flex flex-col items-start gap-4 rounded-3xl bg-surface-container-low p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
        <div>
          <h2 className="text-lg font-semibold">Still have a question?</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Message us and we&apos;ll get back to you.</p>
        </div>
        <a href={whatsappLink(site.whatsapp_number, "Hello Kleandeck, I have a question.")} className={btn.whatsapp}>
          <WhatsAppIcon className="size-5" /> Ask on WhatsApp
        </a>
      </div>
    </>
  );
}

export default function FaqPage() {
  return (
    <PageTransition>
      <div className="container-page max-w-4xl py-12 md:py-20">
        <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mt-10">
          <Suspense
            fallback={
              <SkeletonOut>
                <div className="h-96 animate-pulse rounded-3xl bg-surface-container-low" />
              </SkeletonOut>
            }
          >
            <ContentIn>
              <Faqs />
            </ContentIn>
          </Suspense>
        </div>
      </div>
    </PageTransition>
  );
}
