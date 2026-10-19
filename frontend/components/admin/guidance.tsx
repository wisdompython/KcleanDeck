"use client";

import { ChevronRight, Save, Undo2 } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/admin/ui";

export { InfoTip } from "@/components/admin/ui";

export type TabItem<T extends string> = {
  id: T;
  label: string;
  description: string;
  /** Show a warning dot, e.g. when the tab has a field with an error. */
  alert?: boolean;
};

/** Tabs that say what each one is for, so people know where to look. */
export function GuidedTabs<T extends string>({
  tabs,
  value,
  onChange,
  numbered = false,
  layout = "tabs",
  label = "Form sections",
  id,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  numbered?: boolean;
  layout?: "tabs" | "rail";
  label?: string;
  id?: string;
}) {
  const generatedId = useId();
  const navigationId = id ?? generatedId;
  const list = useRef<HTMLDivElement>(null);
  const active = tabs.find((t) => t.id === value) ?? tabs[0];
  return (
    <div className={layout === "rail" ? "min-w-0 md:sticky md:top-6 md:self-start" : "mb-6 min-w-0"}>
      {layout === "rail" && (
        <div className="mb-4 md:hidden">
          <label htmlFor={`${navigationId}-select`} className="mb-2 block text-[13px] font-semibold">{label}</label>
          <select id={`${navigationId}-select`} value={active.id} onChange={(event) => onChange(event.target.value as T)} className="field">
            {tabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
          </select>
        </div>
      )}
      <div
        ref={list}
        role="tablist"
        aria-label={label}
        aria-orientation={layout === "rail" ? "vertical" : "horizontal"}
        onKeyDown={(event) => {
          const index = tabs.findIndex((tab) => tab.id === active.id);
          let next: number;
          if (event.key === "Home") next = 0;
          else if (event.key === "End") next = tabs.length - 1;
          else if (event.key === (layout === "rail" ? "ArrowDown" : "ArrowRight")) next = (index + 1) % tabs.length;
          else if (event.key === (layout === "rail" ? "ArrowUp" : "ArrowLeft")) next = (index - 1 + tabs.length) % tabs.length;
          else return;
          event.preventDefault();
          onChange(tabs[next].id);
          list.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
        }}
        className={layout === "rail"
          ? "hidden space-y-1 rounded-2xl border border-surface-container-high bg-surface p-2 md:block"
          : "flex gap-1 overflow-x-auto rounded-2xl border border-surface-container-high bg-surface-container p-1.5"}
      >
        {tabs.map((t, i) => {
          const selected = t.id === active.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${navigationId}-tab-${t.id}`}
              aria-controls={`${navigationId}-panel`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.id)}
              className={`relative flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition ${layout === "rail" ? "w-full" : "flex-1"} ${
                selected ? "bg-primary text-white shadow-card" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              }`}
            >
              {numbered && (
                <span
                  className={`grid size-5 place-items-center rounded-full text-[11px] font-bold ${
                    selected ? "bg-white/15 text-white" : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {i + 1}
                </span>
              )}
              <span className="flex-1 whitespace-nowrap">{t.label}</span>
              {t.alert && <span className="size-2 rounded-full bg-error" aria-label="has a problem" />}
              {layout === "rail" && <ChevronRight className={`size-4 ${selected ? "text-tertiary" : "text-outline"}`} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {layout === "tabs" && <p className="mt-3 px-1 text-sm leading-6 text-on-surface-variant">{active.description}</p>}
    </div>
  );
}

/** Warn before closing the tab or following a link while there are unsaved changes. */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm("You have unsaved changes. Leave this page without saving them?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}

/** Sticky bar at the bottom of the screen while there are unsaved changes. */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  saveLabel = "Save changes",
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
}) {
  useUnsavedChangesWarning(dirty);
  if (!dirty) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 animate-[fade-up_0.25s_var(--ease-out-soft)_both] border-t border-surface-container-high bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur lg:left-64">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
        <p className="flex items-center gap-2 text-sm font-semibold text-on-surface">
          <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
          You have unsaved changes
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDiscard}>
            <Undo2 className="size-4" /> Discard
          </Button>
          <Button variant="accent" size="sm" loading={saving} onClick={onSave}>
            <Save className="size-4" /> {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
