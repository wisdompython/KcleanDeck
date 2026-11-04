import type { Metadata } from "next";

import { ApplicationForm } from "@/components/application-form";
import { SectionHeading } from "@/components/sections";
import { PageTransition } from "@/components/transitions";

export const metadata: Metadata = {
  title: "Training academy",
  description: "Kleandeck Academy screening and practical training for professional cleaning and facility support.",
};

const modules = [
  { week: "Step 1", title: "Screening", body: "Applicants provide the required identity and background information for review before placement." },
  { week: "Step 2", title: "Cleaning foundations", body: "Safe product use, equipment basics, workplace conduct and standards for commercial spaces." },
  { week: "Step 3", title: "Practical readiness", body: "Supervised practice for cleaning, handover routines and the basics of professional facility support." },
];

export default function AcademyPage() {
  return (
    <PageTransition>
      <div className="container-page py-12 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <SectionHeading
              eyebrow="Kleandeck Academy"
              title="Screened, trained and ready for professional work"
              body="Our two-week programme prepares cleaners and facilities assistants for commercial spaces. Send an enquiry and we'll share the current dates, costs and requirements."
            />
            <ol className="mt-10 space-y-4">
              {modules.map((m) => (
                <li key={m.week} className="rounded-2xl border border-surface-container-high p-5">
                  <p className="eyebrow">{m.week}</p>
                  <h2 className="mt-1.5 font-display text-lg font-semibold">{m.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-on-surface-variant">{m.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <ApplicationForm kind="academy" />
        </div>
      </div>
    </PageTransition>
  );
}
