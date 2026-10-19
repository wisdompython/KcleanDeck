"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";

import type { Faq } from "@/lib/types";

function FaqItem({ faq }: { faq: Faq }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className={`transition-colors duration-300 ${open ? "bg-surface-container-low" : "bg-surface"}`}>
      <h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          className="group flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-display text-base font-semibold text-on-surface transition-colors hover:text-primary"
        >
          {faq.question}
          <span
            aria-hidden="true"
            className={`grid size-8 shrink-0 place-items-center rounded-full transition-all duration-300 ease-out-soft ${
              open
                ? "rotate-45 bg-primary text-white"
                : "bg-surface-container text-on-surface-variant group-hover:bg-tertiary/15 group-hover:text-on-tertiary-container"
            }`}
          >
            <Plus className="size-4" />
          </span>
        </button>
      </h3>
      {/* Animating grid rows from 0fr to 1fr gives a smooth height transition to the content's natural height;
          visibility flips after the close animation so collapsed answers are truly hidden. */}
      <div
        id={id}
        role="region"
        className={`grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-out-soft ${
          open ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"
        }`}
        inert={!open}
      >
        <div className="overflow-hidden">
          <p className="max-w-3xl px-6 pt-1 pb-6 text-[15px] leading-7 text-on-surface-variant">
            <span className="mb-4 block h-px bg-surface-container-high" aria-hidden="true" />
            {faq.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="divide-y divide-surface-container-high overflow-hidden rounded-3xl border border-surface-container-high bg-surface">
      {faqs.map((faq) => (
        <FaqItem key={faq.id} faq={faq} />
      ))}
    </div>
  );
}
