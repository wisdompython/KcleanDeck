import type { Metadata } from "next";
import { ArrowUpRight, Camera, ClipboardCheck, MessageCircleMore, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Photo } from "@/components/photo";
import { PageTransition } from "@/components/transitions";
import { btn } from "@/components/ui";

export const metadata: Metadata = {
  title: "About us",
  description: "Meet Kleandeck: an accountable commercial cleaning and facility-support partner for growing businesses.",
};

const values = [
  { icon: MessageCircleMore, title: "Communication before confusion", body: "We confirm the scope, access, site needs and timing before the team arrives—and keep you informed when something changes." },
  { icon: Camera, title: "Quality you can verify", body: "Pre- and post-service photos support our internal checks, so handover quality is reviewed before your keys are returned." },
  { icon: ClipboardCheck, title: "Details worth remembering", body: "We record your agreed preferences and practical access notes to make repeat visits more consistent." },
  { icon: ShieldCheck, title: "People you can trust in your space", body: "Our professionals complete two weeks of practical training and are vetted before they are assigned to client work." },
] as const;

export default function AboutPage() {
  return (
    <PageTransition>
      <main>
        <section className="container-page py-12 md:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-20">
            <div>
              <p className="eyebrow">About Kleandeck</p>
              <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[1.02] tracking-[-.04em] text-primary md:text-7xl">
                The practical partner behind a space that works.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-on-surface-variant">
                Kleandeck helps businesses stay clean, ready and well supported. We combine professional cleaning with clear
                communication, thoughtful quality checks and flexible facility support for teams that need operations to feel lighter.
              </p>
              <Link href="/book" className={`${btn.accent} mt-8`}>Book a service <ArrowUpRight size={18} aria-hidden="true" /></Link>
            </div>
            <div className="relative aspect-[5/4] overflow-hidden rounded-[2rem] bg-surface-container">
              <Photo src="/images/services/standard.jpg" alt="A Kleandeck professional caring for a commercial workspace" sizes="(min-width: 1024px) 52vw, 100vw" priority />
            </div>
          </div>
        </section>

        <section className="bg-primary py-16 text-white md:py-24">
          <div className="container-page grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-20">
            <div>
              <p className="eyebrow !text-secondary-container">What we stand for</p>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-[-.035em] text-white md:text-5xl">Good service is human, clear and accountable.</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/70">Our job is not only to complete a checklist. It is to make the process easier to understand and the result easier to trust.</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-3xl bg-white/15 sm:grid-cols-2">
              {values.map(({ icon: Icon, title, body }) => (
                <article key={title} className="bg-primary p-6 md:p-8">
                  <Icon className="text-secondary-container" size={24} strokeWidth={1.5} aria-hidden="true" />
                  <h3 className="mt-5 font-display text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/70">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container-page py-16 md:py-24">
          <div className="rounded-[2rem] bg-secondary-container p-8 md:flex md:items-center md:justify-between md:gap-12 md:p-12">
            <div>
              <p className="eyebrow">Cleaning and operational support</p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-[-.03em] text-primary md:text-4xl">Tell us what a well-run space looks like for your team.</h2>
            </div>
            <Link href="/book" className={`${btn.primary} mt-7 shrink-0 md:mt-0`}>Book a service <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
        </section>
      </main>
    </PageTransition>
  );
}
