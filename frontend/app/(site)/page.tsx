import { ArrowRight, ArrowUpRight, CreditCard, FileCheck2, Receipt, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { CleaningReveal } from "@/components/cleaning-reveal";
import styles from "@/components/homepage.module.css";
import { Photo } from "@/components/photo";
import { BackendError, FaqList, PriceTag, ServiceGridSkeleton } from "@/components/sections";
import { ContentIn, PageTransition, SkeletonOut } from "@/components/transitions";
import { SpaceFinder, SpaceFinderSkeleton, type SpaceOption } from "@/components/space-finder";
import { btn, card } from "@/components/ui";
import { getCategories, getServices, getSite } from "@/lib/api";
import { steps } from "@/lib/content";
import { whatsappLink } from "@/lib/format";

const reasons = [
  { icon: Receipt, title: "Clear prices. No guesswork.", body: "See your full price, VAT included, before you book. No back-and-forth to get a number." },
  { icon: CreditCard, title: "A simple, secure checkout.", body: "Pay through Paystack by card, bank transfer or USSD, with a receipt for your records." },
  { icon: ShieldCheck, title: "Vetted for your peace of mind.", body: "Every cleaner completes two weeks of professional training and is carefully vetted to help keep your space and belongings safe." },
  { icon: FileCheck2, title: "Everything clear from the start.", body: "Know what's included and what we need on site, like running water and power, before we arrive." },
];

async function Services() {
  const services = await getServices().catch(() => null);
  if (!services) return <BackendError />;

  return (
    <div className={styles.serviceGrid}>
      {services.map((service, index) => (
        <article key={service.id} className={`${styles.service} ${index === 0 ? styles.serviceFeatured : ""}`}>
            <div className={styles.servicePhoto}>
              {service.image ? <Photo src={service.image} card={service.image_card} alt="" sizes={index === 0 ? "(min-width: 768px) 560px, 100vw" : "100px"} /> : <Sparkles className={styles.emptyPhoto} aria-hidden="true" />}
              {index === 0 && <span className={styles.serviceBadge}>{service.badge || "A clean that fits your routine"}</span>}
            </div>
          <div className={styles.serviceContent}>
            {index > 0 && service.badge && <p className={styles.serviceInlineBadge}>{service.badge}</p>}
            <h3 className={styles.serviceName}>{service.name}</h3>
            <p className={styles.serviceTagline}>{service.tagline}</p>
            <div className={styles.serviceBottom}>
              <PriceTag service={service} />
              <Link href={`/book?service=${service.slug}`} className={styles.serviceCta}>
                {service.pricing_method === "quote" ? "Request a quote" : "See your price"}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

async function UseCases() {
  const categories = await getCategories().catch(() => null);
  if (!categories) return <BackendError />;

  return (
    <div className={styles.spaces}>
      {categories.map((category, index) => (
        <Link
          key={category.slug}
          href={category.service ? `/book?service=${encodeURIComponent(category.service)}` : "/book"}
          className={styles.spaceCard}
        >
          {category.image && <Photo src={category.image} card={category.image_card} alt="" sizes="(min-width: 768px) 650px, 100vw" className={category.image === "/images/use-cases/offices.jpg" ? styles.officePlaceholder : ""} />}
          <div className={styles.spaceMeta}>
            {category.buyer ? <span className={styles.spaceBuyer}>{category.buyer}</span> : <span />}
            <span className={styles.spaceNumber} aria-hidden="true">0{index + 1}</span>
          </div>
          <h3 className={styles.spaceTitle}>{category.name}</h3>
          <p className={styles.spaceDescription}>{category.description}</p>
          <span className={styles.spaceArrow} aria-hidden="true"><ArrowUpRight size={21} /></span>
          <span className="sr-only">{category.cta_label || "See prices"}</span>
        </Link>
      ))}
    </div>
  );
}

function UseCasesSkeleton() {
  return (
    <div className={styles.spaces}>
      {Array.from({ length: 4 }, (_, index) => <div key={index} className={`${card} h-[340px] animate-pulse bg-surface-container-low`} />)}
    </div>
  );
}

async function HomeFaqs() {
  const site = await getSite().catch(() => null);
  if (!site) return <BackendError />;
  return <FaqList faqs={site.faqs.filter((faq) => faq.homepage)} />;
}

async function HomeOpening() {
  const [categories, services, site] = await Promise.all([
    getCategories().catch(() => []),
    getServices().catch(() => []),
    getSite().catch(() => null),
  ]);
  const options: SpaceOption[] = categories.map((category) => {
    const service = services.find((item) => item.slug === category.service);
    return {
      id: category.slug,
      name: category.name,
      image: category.image || service?.image || "/images/hero.jpg",
      imageCard: category.image ? category.image_card : service?.image_card,
      serviceSlug: category.service,
      serviceName: service?.name ?? "Let's find your perfect clean",
      price: service?.starting_price ?? null,
      priceSuffix: service?.price_suffix ?? "",
      quoteOnly: service?.pricing_method === "quote",
    };
  });

  if (!options.length) {
    options.push({
      id: "all-spaces",
      name: "Your workspace",
      image: "/images/hero.jpg",
      serviceSlug: null,
      serviceName: "A clean that fits your space",
      price: null,
      priceSuffix: "",
      quoteOnly: false,
    });
  }

  return (
    <SpaceFinder
      options={options}
      whatsappHref={whatsappLink(site?.whatsapp_number, "Hello Kleandeck, I'd like a quote for a cleaning job.")}
    />
  );
}

export default function HomePage() {
  return (
    <PageTransition>
      <div className={styles.home}>
        <Suspense fallback={<SpaceFinderSkeleton />}><HomeOpening /></Suspense>

        <section id="who-we-serve" className={styles.section} aria-labelledby="spaces-title">
          <div className="container-page">
            <div className={styles.sectionIntro}>
              <div><p className={styles.kicker}>Spaces we care for</p><h2 className={styles.sectionTitle} id="spaces-title">Different spaces.<br /><em>The same attention to detail.</em></h2></div>
              <p className={styles.sectionCopy}>From the Monday morning meeting to the next guest&apos;s arrival. A clean that works around your world.</p>
            </div>
            <Suspense fallback={<SkeletonOut><UseCasesSkeleton /></SkeletonOut>}><ContentIn><UseCases /></ContentIn></Suspense>
          </div>
        </section>

        <section id="the-difference" className={`${styles.section} ${styles.difference}`} aria-labelledby="difference-title">
          <div className="container-page">
            <div className={styles.sectionIntro}>
              <div><p className={styles.kicker}>A change you can feel</p><h2 className={styles.sectionTitle} id="difference-title">A little care.<br /><em>A whole new feeling.</em></h2></div>
              <p className={styles.sectionCopy}>Clear glass. Fresh floors. Room to breathe. Go on, move the slider and picture your next fresh start.</p>
            </div>
            <CleaningReveal />
          </div>
        </section>

        <section id="services" className={`${styles.section} ${styles.serviceSection}`} aria-labelledby="services-title">
          <div className="container-page">
            <div className={styles.sectionIntro}>
              <div><p className={styles.kicker}>The right clean for you</p><h2 className={styles.sectionTitle} id="services-title">Standard, deep and<br /><em>post-construction cleaning.</em></h2></div>
              <Link href="/pricing" className={styles.sectionLink}>Explore our pricing <ArrowUpRight size={17} aria-hidden="true" /></Link>
            </div>
            <Suspense fallback={<SkeletonOut><ServiceGridSkeleton /></SkeletonOut>}><ContentIn><Services /></ContentIn></Suspense>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="steps-title">
          <div className="container-page">
            <div className={styles.sectionIntro}>
              <div><p className={styles.kicker}>Simple from the start</p><h2 className={styles.sectionTitle} id="steps-title">Goodbye, back-and-forth.<br /><em>Hello, clean.</em></h2></div>
              <p className={styles.sectionCopy}>Four straightforward steps. A clear price. A team ready to take care of the details.</p>
            </div>
            <ol className={styles.steps}>{steps.map((step, index) => <li key={step.title} className={styles.step}><span className={styles.stepNumber} aria-hidden="true">0{index + 1}</span><h3 className={styles.stepTitle}>{step.title}</h3><p className={styles.stepBody}>{step.body}</p></li>)}</ol>
          </div>
        </section>

        <section className={`${styles.section} ${styles.promise}`} aria-labelledby="promise-title">
          <div className={`container-page ${styles.promiseGrid}`}>
            <div className={styles.promisePhoto}>
              <Photo
                src="/images/services/standard.jpg"
                alt="A Kleandeck team carefully cleaning a meeting room"
                sizes="(min-width: 1280px) 900px, (min-width: 768px) 70vw, 150vw"
              />
              <div className={styles.photoNote}><span>2</span><p>weeks of professional training.<br />Care in every detail.</p></div>
            </div>
            <div>
              <p className={styles.kicker}>The Kleandeck way</p>
              <h2 className={styles.sectionTitle} id="promise-title">We take cleaning seriously.<br />So you don&apos;t have to.</h2>
              <div className={styles.promiseList}>{reasons.map(({ icon: Icon, title, body }) => <div key={title} className={styles.promiseItem}><Icon size={21} strokeWidth={1.5} aria-hidden="true" /><div><h3>{title}</h3><p>{body}</p></div></div>)}</div>
              <Link href="/book" className={`${btn.accent} ${styles.promiseCta}`}>Let&apos;s make room for better <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="faq-title">
          <div className={`container-page ${styles.faqGrid}`}>
            <div><p className={styles.kicker}>A few things you might ask</p><h2 className={styles.sectionTitle} id="faq-title">Good questions.<br /><em>Clear answers.</em></h2><Link href="/faq" className={`${styles.sectionLink} ${styles.faqLink}`}>See all questions <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
            <Suspense fallback={<SkeletonOut><div className="h-80 animate-pulse rounded-3xl bg-surface-container-low" /></SkeletonOut>}><ContentIn><HomeFaqs /></ContentIn></Suspense>
          </div>
        </section>

        <section className={styles.careers} aria-labelledby="career-title">
          <div className="container-page"><div className={styles.careerPanel}>
            <div><p className={styles.kicker}>Good work starts with good people</p><h2 className={styles.careerTitle} id="career-title">Build a career in professional cleaning<br />and facility support.</h2><p className={styles.careerBody}>Train with the Kleandeck Academy and build practical skills for professional cleaning, office assistance and facility support.</p></div>
            <div className={styles.careerActions}><Link href="/careers" className={btn.primary}>Explore opportunities <ArrowUpRight size={17} aria-hidden="true" /></Link><Link href="/academy" className={styles.sectionLink}>Meet the Kleandeck Academy <ArrowRight size={16} aria-hidden="true" /></Link></div>
          </div></div>
        </section>
      </div>
    </PageTransition>
  );
}
