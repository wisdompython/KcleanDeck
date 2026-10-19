import { ViewTransition } from "react";

// Animations live in app/globals.css (::view-transition-* rules). Browsers
// without the View Transitions API simply skip them.

/** Wrap each page's content: fades the old page out and the new one up on navigation. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}

/** Suspense fallback that fades out when the real content arrives. */
export function SkeletonOut({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition exit="skeleton-out" default="none">
      {children}
    </ViewTransition>
  );
}

/** Suspense content that fades and rises in, replacing its skeleton. */
export function ContentIn({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="content-in" default="none">
      {children}
    </ViewTransition>
  );
}
