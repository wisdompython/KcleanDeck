import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Dumbbell,
  FileCheck2,
  KeyRound,
  Paintbrush,
  Receipt,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { CleaningReveal } from "@/components/cleaning-reveal";
import styles from "@/components/homepage.module.css";
import { WhatsAppIcon } from "@/components/icons";
import { Photo } from "@/components/photo";
import { BackendError, FaqList, PriceTag, ServiceGridSkeleton } from "@/components/sections";
import { ContentIn, PageTransition, SkeletonOut } from "@/components/transitions";
import { SpaceFinder } from "@/components/space-finder";
import { btn } from "@/components/ui";
import { getServices, getSite } from "@/lib/api";
import { steps } from "@/lib/content";

const audiences = [
  {
    icon: Paintbrush,
    title: "Interior design partners",
    body: "A dependable post-construction and handover clean after installation, so the finished space is ready to reveal.",
    link: "/book?service=post-construction-cleaning",
    cta: "Plan a project clean",
    image: "/images/use-cases/interior-decor.jpg",
  },
  {
    icon: Dumbbell,
    title: "Gyms and active facilities",
    body: "Consistent cleaning and facility support for high-traffic spaces, with routines shaped around operating hours.",
    link: "/book",
    cta: "Discuss your schedule",
    image: "/images/services/deep.jpg",
  },
  {
    icon: Building2,
    title: "Offices needing a reset",
    body: "Standard cleaning or a deeper weekend reset that gets meeting rooms, work areas and restrooms ready for Monday.",
    link: "/book?service=deep-cleaning",
    cta: "Discuss an office clean",
    image: "/images/use-cases/offices.jpg",
  },
  {
    icon: BriefcaseBusiness,
    title: "Startups and small businesses",
    body: "One capable facilities assistant for cleaning, pantry care and practical office support—without building a large operations team.",
    link: "/book?service=facility-support",
    cta: "Explore office support",
    image: "/images/services/facility.jpg",
  },
] as const;

const handoverChecks = [
  "Arrival and access details noted",
  "Required areas checked after service",
  "After-service photos reviewed",
  "Preferences saved for the next visit",
] as const;

const reasons = [
  { icon: Receipt, title: "Clear core-service pricing.", body: "See a starting estimate for the clean you choose. We confirm any extras or unusual site needs before work begins." },
  { icon: UserRoundCheck, title: "Vetted and professionally trained.", body: "Every team member completes two weeks of training and is vetted to help protect your space and belongings." },
  { icon: Camera, title: "Photo-verified handover.", body: "Pre- and post-service photos are reviewed before keys are returned, so quality control is part of the job—not an add-on." },
  { icon: ClipboardCheck, title: "Your preferences stay on record.", body: "We document access notes and service preferences to make repeat visits clearer and more consistent." },
];

async function Services() {
  const services = await getServices().catch(() => null);
  if (!services) return <BackendError />;

  return (
    <div className={styles.serviceGrid}>
      {services.map((service, index) => (
        <article key={service.id} className={`${styles.service} ${index === 0 ? styles.serviceFeatured : ""}`}>
          <div className={styles.servicePhoto}>
            {service.image ? <Photo src={service.image} card={service.image_card} alt="" sizes={index === 0 ? "(min-width: 1280px) 560px, (min-width: 768px) 465px, 445px" : "(min-width: 768px) 210px, 190px"} /> : <Sparkles className={styles.emptyPhoto} aria-hidden="true" />}
            {index === 0 && <span className={styles.serviceBadge}>{service.badge || "A clean that fits your routine"}</span>}
          </div>
          <div className={styles.serviceContent}>
            {index > 0 && service.badge && <p className={styles.serviceInlineBadge}>{service.badge}</p>}
            <h3 className={styles.serviceName}>{service.name}</h3>
            <p className={styles.serviceTagline}>{service.tagline}</p>
            <div className={styles.serviceBottom}>
              <PriceTag service={service} />
              <Link href={`/book?service=${service.slug}`} className={styles.serviceCta}>
                <WhatsAppIcon className="size-4" aria-hidden="true" />
                {service.pricing_method === "quote" ? "Request on WhatsApp" : "Discuss on WhatsApp"}
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

async function HomeFaqs() {
  const site = await getSite().catch(() => null);
  if (!site) return <BackendError />;
  return <FaqList faqs={site.faqs} />;
}

export default function HomePage() {
  return (
    <PageTransition>
      <div className={styles.home}>
        <SpaceFinder />

        <section id="who-we-serve" className={styles.section} aria-labelledby="audiences-title">
          <div className="container-page">
            <div className={styles.sectionIntro}>
              <div><p className={styles.kicker}>Who we support</p><h2 className={styles.sectionTitle} id="audiences-title">Built around the way<br /><em>your business actually works.</em></h2></div>
              <p className={styles.sectionCopy}>One-time projects, weekend resets and ongoing operational support—shaped around your space, schedule and handover needs.</p>
            </div>
            <div className={styles.audiences}>
              {audiences.map(({ icon: Icon, title, body, link, cta, image }) => (
                <article key={title} className={styles.audienceCard}>
                  <Photo src={image} alt="" sizes="(min-width: 1100px) 50vw, (min-width: 768px) 50vw, 100vw" />
                  <div className={styles.audienceContent}>
                    <span className={styles.audienceIcon}><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>
                    <h3>{title}</h3>
                    <p>{body}</p>
                    <Link href={link}>{cta} <ArrowUpRight size={16} aria-hidden="true" /></Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.officeSupport} aria-labelledby="office-support-title">
          <div className={`container-page ${styles.officeSupportGrid}`}>
            <div>
              <p className={styles.kicker}>More than a cleaner</p>
              <h2 className={styles.sectionTitle} id="office-support-title">A facilities assistant for the practical work that keeps your office moving.</h2>
            </div>
            <div className={styles.officeSupportBody}>
              <p>For small businesses and startups, one trained professional can combine cleaning with pantry care, meeting-room resets and agreed day-to-day office support.</p>
              <ul>
                <li><FileCheck2 size={17} aria-hidden="true" /> A clear, agreed scope for every placement</li>
                <li><ShieldCheck size={17} aria-hidden="true" /> Screened, trained and supported by Kleandeck</li>
                <li><CreditCard size={17} aria-hidden="true" /> A practical alternative to building a large operations team</li>
              </ul>
              <Link href="/book?service=facility-support" className={btn.accent}>Ask about facility support <ArrowUpRight size={17} aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

        <section id="the-difference" className={`${styles.section} ${styles.difference}`} aria-labelledby="difference-title">
          <div className="container-page">
            <div className={styles.sectionIntro}>
              <div><p className={styles.kicker}>Before and after</p><h2 className={styles.sectionTitle} id="difference-title">The result should be<br /><em>easy to see.</em></h2></div>
              <p className={styles.sectionCopy}>Compare the work across office and restroom areas. On real jobs, our quality team checks the service photos before handover.</p>
            </div>
            <CleaningReveal />
          </div>
        </section>

        <section className={`${styles.section} ${styles.proofSection}`} aria-labelledby="proof-title">
          <div className={`container-page ${styles.proofGrid}`}>
            <div className={styles.proofCopy}>
              <p className={styles.kicker}>Proof of clean</p>
              <h2 className={styles.sectionTitle} id="proof-title">The service ends with<br /><em>a clearer record.</em></h2>
              <p>Quality control is part of the service. We note the space before work, review completed areas and keep the practical details that make the next visit more consistent.</p>
              <Link href="/book" className={btn.primary}>Book a service <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
            <div className={styles.handoverCard} aria-label="Example of the details captured in a Kleandeck handover record">
              <div className={styles.handoverHeader}>
                <div><span>Example handover view</span><h3>Your service record</h3></div>
                <span className={styles.handoverStatus}><CheckCircle2 size={15} aria-hidden="true" /> Quality check included</span>
              </div>
              <div className={styles.handoverPhotos}>
                <figure className={styles.handoverPhoto}>
                  <Photo src="/images/cleaning-before.webp" alt="" sizes="(min-width: 768px) 300px, 45vw" />
                  <figcaption>Arrival context</figcaption>
                </figure>
                <figure className={styles.handoverPhoto}>
                  <Photo src="/images/use-cases/real-estate.jpg" alt="" sizes="(min-width: 768px) 300px, 45vw" />
                  <figcaption>Completed areas</figcaption>
                </figure>
              </div>
              <div className={styles.handoverChecklist}>
                {handoverChecks.map((item) => <div key={item}><CheckCircle2 size={16} aria-hidden="true" /><span>{item}</span></div>)}
              </div>
              <div className={styles.handoverFooter}><KeyRound size={18} aria-hidden="true" /><div><strong>Handover details recorded</strong><span>Access notes and agreed preferences stay with the service history.</span></div></div>
            </div>
          </div>
        </section>

        <section id="services" className={`${styles.section} ${styles.serviceSection}`} aria-labelledby="services-title">
          <div className="container-page">
            <div className={styles.sectionIntro}>
              <div><p className={styles.kicker}>Core cleaning services</p><h2 className={styles.sectionTitle} id="services-title">Standard, deep and<br /><em>post-construction cleaning.</em></h2></div>
              <Link href="/pricing" className={styles.sectionLink}>See starting prices <ArrowUpRight size={17} aria-hidden="true" /></Link>
            </div>
            <Suspense fallback={<SkeletonOut><ServiceGridSkeleton /></SkeletonOut>}><ContentIn><Services /></ContentIn></Suspense>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="steps-title">
          <div className="container-page">
            <div className={styles.sectionIntro}>
              <div><p className={styles.kicker}>From booking to handover</p><h2 className={styles.sectionTitle} id="steps-title">A clear journey.<br /><em>No hidden steps.</em></h2></div>
              <p className={styles.sectionCopy}>Three clear stages take you from the first WhatsApp conversation to a quality-checked handover.</p>
            </div>
            <ol className={styles.steps}>{steps.map((step, index) => <li key={step.title} className={styles.step}><span className={styles.stepNumber} aria-hidden="true">0{index + 1}</span><h3 className={styles.stepTitle}>{step.title}</h3><p className={styles.stepBody}>{step.body}</p></li>)}</ol>
          </div>
        </section>

        <section className={`${styles.section} ${styles.promise}`} aria-labelledby="promise-title">
          <div className={`container-page ${styles.promiseGrid}`}>
            <div className={styles.promisePhoto}>
              <Photo src="/images/services/facility.jpg" alt="A Kleandeck facilities assistant caring for a shared office kitchen" sizes="(min-width: 1280px) 900px, (min-width: 768px) 70vw, 150vw" />
              <div className={styles.photoNote}><span>2</span><p>weeks of professional training.<br />Vetted for greater peace of mind.</p></div>
            </div>
            <div>
              <p className={styles.kicker}>The Kleandeck process</p>
              <h2 className={styles.sectionTitle} id="promise-title">A trained team.<br />An accountable handover.</h2>
              <div className={styles.promiseList}>{reasons.map(({ icon: Icon, title, body }) => <div key={title} className={styles.promiseItem}><Icon size={21} strokeWidth={1.5} aria-hidden="true" /><div><h3>{title}</h3><p>{body}</p></div></div>)}</div>
              <Link href="/book" className={`${btn.accent} ${styles.promiseCta}`}>Book a service <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

        <section id="faq" className={styles.section} aria-labelledby="faq-title">
          <div className={`container-page ${styles.faqGrid}`}>
            <div><p className={styles.kicker}>Before you book</p><h2 className={styles.sectionTitle} id="faq-title">Good questions.<br /><em>Clear answers.</em></h2><p className={styles.faqIntro}>Pricing, site requirements, service scope and what happens on the day—all in one place.</p></div>
            <Suspense fallback={<SkeletonOut><div className="h-80 animate-pulse rounded-3xl bg-surface-container-low" /></SkeletonOut>}><ContentIn><HomeFaqs /></ContentIn></Suspense>
          </div>
        </section>

        <section className={styles.careers} aria-labelledby="career-title">
          <div className="container-page"><div className={styles.careerPanel}>
            <div><p className={styles.kicker}>Careers &amp; Kleandeck Academy</p><h2 className={styles.careerTitle} id="career-title">Build a career in professional cleaning<br />and facility support.</h2><p className={styles.careerBody}>Applicants are screened before placement, while the Academy builds practical cleaning, workplace conduct and facility-support basics.</p></div>
            <div className={styles.careerActions}><Link href="/careers" className={btn.primary}>Explore opportunities <ArrowUpRight size={17} aria-hidden="true" /></Link><Link href="/academy" className={styles.sectionLink}>View the Academy <ArrowRight size={16} aria-hidden="true" /></Link></div>
          </div></div>
        </section>
      </div>
    </PageTransition>
  );
}
