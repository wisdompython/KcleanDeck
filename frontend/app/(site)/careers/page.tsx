import { BriefcaseBusiness, GraduationCap, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ApplicationForm } from "@/components/application-form";
import { SectionHeading } from "@/components/sections";
import { PageTransition } from "@/components/transitions";

export const metadata: Metadata = {
  title: "Careers",
  description: "Apply to work with Kleandeck as a cleaner, office assistant or event assistant in Lagos.",
};

const roles = [
  {
    icon: Users,
    title: "Cleaners",
    body: "Standard, deep, move-in/out and post-construction cleaning for offices, shortlets and properties.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Office & event assistants",
    body: "Front-of-house, pantry and general support for offices, and extra hands for events.",
  },
  {
    icon: GraduationCap,
    title: "New to cleaning?",
    body: "Apply anyway. New starters can train with us through the two-week Kleandeck Academy.",
  },
];

export default function CareersPage() {
  return (
    <PageTransition>
      <div className="container-page py-12 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <SectionHeading
              eyebrow="Careers"
              title="Work with Kleandeck"
              body="We're building a team of reliable cleaners and assistants across Lagos. Tell us about yourself and we'll be in touch."
            />
            <ul className="mt-10 space-y-4">
              {roles.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4 rounded-2xl bg-surface-container-low p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-secondary shadow-card">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-display text-base font-semibold">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-on-surface-variant">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-on-surface-variant">
              Want training first?{" "}
              <Link href="/academy" className="font-semibold text-primary underline underline-offset-4">
                Learn about the academy
              </Link>
            </p>
          </div>
          <ApplicationForm kind="job" />
        </div>
      </div>
    </PageTransition>
  );
}
