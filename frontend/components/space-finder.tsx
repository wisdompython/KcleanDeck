import { ArrowDownRight, ArrowUpRight, Camera, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Photo } from "@/components/photo";
import styles from "@/components/space-finder.module.css";
import { btn } from "@/components/ui";

export function SpaceFinder() {
  return (
    <section className={styles.opening} aria-labelledby="home-title">
      <div className={`container-page ${styles.openingGrid}`}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}><span aria-hidden="true" /> Commercial cleaning &amp; operational support</p>
          <h1 id="home-title" className={styles.title}>
            Reliable cleaning and facility support for <span>growing businesses.</span>
          </h1>
          <p className={styles.description}>
            From weekend deep cleans to everyday office support, Kleandeck gives your team a vetted crew,
            clear communication and an accountable handover.
          </p>
          <div className={styles.actions}>
            <Link href="/book" className={btn.accent}>Book a service <ArrowUpRight size={18} aria-hidden="true" /></Link>
            <Link href="#services" className={styles.secondaryAction}>Explore services <ArrowDownRight size={17} aria-hidden="true" /></Link>
          </div>
          <ul className={styles.proof} aria-label="Kleandeck service assurances">
            <li><ShieldCheck size={16} aria-hidden="true" /> Vetted team</li>
            <li><Camera size={16} aria-hidden="true" /> Photo-verified handover</li>
            <li><CheckCircle2 size={16} aria-hidden="true" /> Clear core-service pricing</li>
          </ul>
        </div>

        <div className={styles.visual}>
          <div className={styles.photoFrame}>
            <Photo
              src="/images/hero.jpg"
              alt="A Kleandeck professional preparing a bright commercial workspace"
              sizes="(min-width: 1280px) 610px, (min-width: 768px) 50vw, 100vw"
              priority
            />
          </div>
          <div className={styles.verificationCard}>
            <span className={styles.verificationIcon}><Camera size={20} aria-hidden="true" /></span>
            <span><strong>Verified before handover</strong>Pre- and post-service photos are checked before your keys are returned.</span>
          </div>
          <span className={styles.visualAccent} aria-hidden="true">Clean. Checked. Ready.</span>
        </div>
      </div>
      <div className={`container-page ${styles.foot}`}>
        <p>Built for offices, gyms, interior projects and lean operating teams.</p>
        <a href="#who-we-serve">See who we support <ArrowDownRight size={16} aria-hidden="true" /></a>
      </div>
    </section>
  );
}

export function SpaceFinderSkeleton() {
  return <div className={styles.skeleton} aria-label="Loading homepage" aria-busy="true" />;
}
