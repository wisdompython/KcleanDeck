"use client";

import { MoveHorizontal } from "lucide-react";
import { useId, useState } from "react";

import { Photo } from "@/components/photo";
import styles from "@/components/homepage.module.css";

export function CleaningReveal() {
  const [position, setPosition] = useState(52);
  const helpId = useId();

  return (
    <figure className={styles.comparisonFigure}>
      <div className={styles.comparison}>
        <Photo
          src="/images/services/move.jpg"
          alt="A bright office with clear glass partitions and a freshly cleaned floor"
          sizes="(min-width: 1280px) 1216px, 100vw"
        />
        <div
          className={styles.beforeScene}
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          aria-hidden="true"
        >
          <Photo src="/images/cleaning-before.webp" alt="" sizes="(min-width: 1280px) 1216px, 100vw" />
        </div>
        <span className={`${styles.sceneLabel} ${styles.beforeLabel}`} aria-hidden="true">Before the clean</span>
        <span className={`${styles.sceneLabel} ${styles.afterLabel}`} aria-hidden="true">A fresh start</span>
        <div className={styles.revealHandle} style={{ left: `${position}%` }} aria-hidden="true">
          <span><MoveHorizontal size={22} strokeWidth={1.7} /></span>
        </div>
        <input
          className={styles.revealInput}
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-label="Reveal the clean space"
          aria-describedby={helpId}
          aria-valuetext={`${100 - position}% of the clean scene revealed`}
        />
      </div>
      <figcaption className={styles.comparisonCaption} id={helpId}>
        <span><MoveHorizontal size={16} aria-hidden="true" /> Drag to see the difference. You can also use the arrow keys.</span>
        <span>AI-assisted illustration, not a client project.</span>
      </figcaption>
    </figure>
  );
}
