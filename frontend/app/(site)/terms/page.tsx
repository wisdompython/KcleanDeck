import type { Metadata } from "next";
import { Suspense } from "react";
import Markdown from "react-markdown";

import { BackendError, SectionHeading } from "@/components/sections";
import { getTerms } from "@/lib/api";
import { ContentIn, PageTransition, SkeletonOut } from "@/components/transitions";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: "Kleandeck's terms for bookings, payment, site requirements and cancellations.",
};

async function Terms() {
  const terms = await getTerms().catch(() => null);
  if (!terms) return <BackendError />;
  return (
    <>
      {terms.updated_on && (
        <p className="mt-4 text-sm text-outline">
          Last updated{" "}
          {new Date(terms.updated_on).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}
      <div className="mt-10 space-y-4 text-[15px] leading-7 text-on-surface-variant [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-on-surface [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-on-surface">
        <Markdown>{terms.content}</Markdown>
      </div>
    </>
  );
}

export default function TermsPage() {
  return (
    <PageTransition>
      <div className="container-page max-w-3xl py-12 md:py-20">
        <SectionHeading eyebrow="Legal" title="Terms and conditions" />
        <Suspense
          fallback={
            <SkeletonOut>
              <div className="mt-10 h-96 animate-pulse rounded-3xl bg-surface-container-low" />
            </SkeletonOut>
          }
        >
          <ContentIn>
            <Terms />
          </ContentIn>
        </Suspense>
      </div>
    </PageTransition>
  );
}
