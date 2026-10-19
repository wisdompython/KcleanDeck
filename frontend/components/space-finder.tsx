"use client";

import { ArrowDownRight, ArrowUpRight, Check, LockKeyhole, Receipt, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { WhatsAppIcon } from "@/components/icons";
import { Photo } from "@/components/photo";
import styles from "@/components/space-finder.module.css";
import { naira } from "@/lib/format";

export type SpaceOption = {
  id: string;
  name: string;
  image: string;
  imageCard?: string;
  serviceSlug: string | null;
  serviceName: string;
  price: number | null;
  priceSuffix: string;
  quoteOnly: boolean;
};

export function SpaceFinder({ options, whatsappHref }: { options: SpaceOption[]; whatsappHref: string }) {
  const [selectedId, setSelectedId] = useState(options[0].id);
  const groupId = useId();
  const selected = options.find((option) => option.id === selectedId) ?? options[0];
  const selectedIndex = options.indexOf(selected);
  const bookingHref = selected.serviceSlug ? `/book?service=${encodeURIComponent(selected.serviceSlug)}` : "/book";

  return (
    <section className={styles.opening} aria-labelledby="home-title">
      <div className={`container-page ${styles.openingGrid}`}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}><span aria-hidden="true" /> A fresh approach to cleaning</p>
          <h1 id="home-title" className={styles.title}>Clean starts <span>here.</span></h1>
          <p className={styles.description}>Pick your space. We&apos;ll take care of the clean.</p>

          <fieldset className={styles.choices}>
            <legend className="sr-only">Choose your space</legend>
            {options.map((option, index) => (
              <label key={option.id} className={styles.choice} data-selected={option.id === selected.id}>
                <input
                  className={styles.radio}
                  type="radio"
                  name={groupId}
                  value={option.id}
                  checked={option.id === selected.id}
                  onChange={() => setSelectedId(option.id)}
                />
                <span className={styles.choiceNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.choiceName}>{option.name}</span>
                <span className={styles.choiceMark} aria-hidden="true">
                  {option.id === selected.id ? <Check size={15} /> : <ArrowUpRight size={15} />}
                </span>
              </label>
            ))}
          </fieldset>

          <a href={whatsappHref} className={styles.contact}>
            <WhatsAppIcon className="size-4 text-on-secondary-container" />
            Have something else in mind? Let&apos;s talk.
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>

        <div className={styles.canvas}>
          <div className={styles.outline} aria-hidden="true" />
          <div className={styles.photoFrame}>
            <Photo
              key={selected.id}
              src={selected.image}
              card={selected.imageCard}
              alt={`Cleaning for ${selected.name.toLowerCase()}`}
              sizes="(min-width: 768px) 520px, 100vw"
              priority
              className={`${styles.scene} ${selected.image === "/images/use-cases/offices.jpg" ? styles.officeCrop : ""}`}
            />
          </div>
          <div className={styles.stamp} aria-hidden="true">
            <Sparkles size={23} strokeWidth={1.4} />
            <span>Made for<br />your space.</span>
          </div>
          <span className={styles.sceneIndex} aria-hidden="true">{String(selectedIndex + 1).padStart(2, "0")}<span> / {String(options.length).padStart(2, "0")}</span></span>

          <div className={styles.match}>
            <div className={styles.matchCopy} aria-live="polite" aria-atomic="true">
              <p className={styles.matchEyebrow}>Your fresh start</p>
              <h2>{selected.serviceName}</h2>
              <p className={styles.matchPrice}>
                {selected.quoteOnly ? "Let's tailor a quote to your space." : selected.price !== null ? <>From <strong>{naira(selected.price)}</strong> {selected.priceSuffix} + VAT</> : "Choose the details to see your price."}
              </p>
            </div>
            <Link href={bookingHref} className={styles.book} aria-label="Find your clean">
              <span className={styles.bookIcon}><ArrowUpRight size={23} aria-hidden="true" /></span>
              <span className={styles.bookLabel}>{selected.quoteOnly ? "Get quote" : "See price"}</span>
            </Link>
          </div>
        </div>
      </div>

      <div className={`container-page ${styles.foot}`}>
        <ul className={styles.benefits} aria-label="Booking benefits">
          <li><Receipt size={14} aria-hidden="true" /> Upfront prices</li>
          <li><LockKeyhole size={14} aria-hidden="true" /> Secure payments</li>
          <li><ShieldCheck size={16} aria-hidden="true" /> Vetted cleaners</li>
        </ul>
        <a href="#who-we-serve" className={styles.discover}>Care for every corner <ArrowDownRight size={16} aria-hidden="true" /></a>
      </div>
    </section>
  );
}

export function SpaceFinderSkeleton() {
  return (
    <section className={styles.opening} aria-labelledby="home-title">
      <div className={`container-page ${styles.openingGrid}`}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>A fresh approach to cleaning</p>
          <h1 className={styles.title} id="home-title">Clean starts <span>here.</span></h1>
          <p className={styles.description}>Pick your space. We&apos;ll take care of the clean.</p>
          <div className={styles.skeletonChoices} aria-label="Loading spaces" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => <div key={index} />)}
          </div>
          <Link href="/book" className={styles.contact}>Find your clean <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className={`${styles.canvas} ${styles.skeletonCanvas}`} aria-hidden="true" />
      </div>
    </section>
  );
}
