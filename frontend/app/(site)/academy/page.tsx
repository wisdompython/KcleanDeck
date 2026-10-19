import type { Metadata } from "next";

import { ApplicationForm } from "@/components/application-form";
import { SectionHeading } from "@/components/sections";
import { PageTransition } from "@/components/transitions";

export const metadata: Metadata = {
  title: "Training academy",
  description: "Kleandeck Academy: a two-week programme in professional commercial cleaning in Lagos.",
};

// Programme outline — confirm with Kleandeck before launch.
const modules = [
  { week: "Week 1", title: "Foundations", body: "Cleaning methods, safe use of products and equipment, and standards for offices and homes." },
  { week: "Week 2", title: "On the job", body: "Deep, move-in/out and post-construction cleaning, customer conduct, and supervised practice." },
];

export default function AcademyPage() {
  return (
    <PageTransition>
      <div className="container-page py-12 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <SectionHeading
              eyebrow="Kleandeck Academy"
              title="Two weeks to professional cleaning"
              body="Our training programme prepares new cleaners and assistants for commercial work. Send an enquiry and we'll share dates, costs and requirements."
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
