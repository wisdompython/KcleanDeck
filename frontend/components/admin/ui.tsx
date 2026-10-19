"use client";

import { CircleHelp, LoaderCircle, X } from "lucide-react";
import { cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useRef, useState } from "react";

import { paymentMeta, statusMeta } from "@/lib/admin/labels";
import type { BookingStatus, PaymentStatus } from "@/lib/admin/types";

// --- Buttons ------------------------------------------------------------------

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-display font-semibold transition hover:-translate-y-px disabled:pointer-events-none disabled:opacity-50";

const buttonVariants = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  accent: "bg-secondary text-white hover:bg-on-secondary-container",
  ghost: "border border-surface-container-high bg-surface text-on-surface hover:bg-surface-container-low",
  subtle: "bg-surface-container text-on-surface hover:bg-surface-container-high",
  danger: "border border-error/20 bg-surface text-error hover:bg-error/5",
  whatsapp: "bg-whatsapp text-white hover:brightness-95",
};

const buttonSizes = { sm: "h-9 px-3.5 text-[13px]", md: "h-11 px-5 text-sm" };

export function buttonClass(variant: keyof typeof buttonVariants = "primary", size: keyof typeof buttonSizes = "md") {
  return `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]}`;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={`${buttonClass(variant, size)} ${className}`}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

// --- Form fields ----------------------------------------------------------------

/** A small "?" next to a label that explains a term in plain words. */
export function InfoTip({ children, label = "What's this?" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="group relative inline-flex align-middle" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="grid size-5 place-items-center rounded-full text-outline transition hover:text-primary focus-visible:text-primary"
      >
        <CircleHelp className="size-4" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-xl bg-primary px-3.5 py-2.5 text-xs leading-5 font-normal text-white shadow-pop transition ${
          open ? "visible opacity-100" : "invisible opacity-0 group-hover:visible group-hover:opacity-100"
        }`}
      >
        {children}
      </span>
    </span>
  );
}



export const inputClass =
  "h-11 w-full rounded-xl border border-outline-variant bg-surface px-3.5 text-[15px] text-on-surface transition placeholder:text-outline focus:border-primary focus:ring-[3px] focus:ring-tertiary/20 focus:outline-none disabled:bg-surface-container-low disabled:text-outline";

export function Field({
  label,
  hint,
  error,
  tip,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  /** Plain-words explanation shown behind a "?" next to the label. */
  tip?: React.ReactNode;
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const control = children(id);
  const field = isValidElement<React.HTMLAttributes<HTMLElement>>(control) && typeof control.type === "string" && ["input", "select", "textarea"].includes(control.type)
    ? cloneElement(control, {
      "aria-invalid": error ? true : control.props["aria-invalid"],
      "aria-describedby": [control.props["aria-describedby"], error || hint ? messageId : undefined].filter(Boolean).join(" ") || undefined,
    })
    : control;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center gap-1">
        <label htmlFor={id} className="block text-[13px] font-semibold text-on-surface">
          {label}
        </label>
        {tip && <InfoTip label={`About ${label.toLowerCase()}`}>{tip}</InfoTip>}
      </div>
      {field}
      {error ? (
        <p id={messageId} className="mt-1 text-xs text-error">{error}</p>
      ) : hint ? (
        <p id={messageId} className="mt-1 text-xs text-outline">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-secondary" : "bg-outline-variant"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-4" : ""}`}
        />
      </button>
      <span>
        <span className="block text-sm font-semibold text-on-surface">{label}</span>
        {description && <span className="block text-xs text-on-surface-variant">{description}</span>}
      </span>
    </label>
  );
}

// --- Display ----------------------------------------------------------------------

export function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 font-display text-[11px] font-bold tracking-[0.02em] whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusChip({ status }: { status: BookingStatus }) {
  const meta = statusMeta[status];
  return (
    <Chip className={meta.chip}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {meta.label}
    </Chip>
  );
}

export function PaymentChip({ status }: { status: PaymentStatus }) {
  const meta = paymentMeta[status];
  return <Chip className={meta.chip}>{meta.label}</Chip>;
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title?: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded-2xl border border-surface-container bg-surface shadow-card ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-surface-container px-5 py-4">
          <div>
            {title && <h2 className="font-display text-base font-semibold text-on-surface">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-on-surface-variant">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.015em] md:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-outline-variant px-6 py-12 text-center">
      <p className="font-display text-base font-semibold text-on-surface">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-on-surface-variant">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
      <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden="true" /> {label}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <p role="alert" className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">
      {message}
    </p>
  );
}

// --- Dialog -----------------------------------------------------------------------

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl bg-surface p-0 text-on-surface shadow-pop backdrop:bg-primary/40 backdrop:backdrop-blur-sm open:animate-[fade-up_0.25s_var(--ease-out-soft)_both]`}
    >
      {open && (
        <div>
          <header className="flex items-start justify-between gap-4 border-b border-surface-container px-6 py-4">
            <div>
              <h2 id={titleId} className="font-display text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-0.5 text-sm text-on-surface-variant">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-2 border-t border-surface-container px-6 py-4">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}

// --- Toasts -----------------------------------------------------------------------

type Toast = { id: number; message: string; tone: "success" | "error" };
const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-[60] flex w-[min(24rem,calc(100%-2rem))] flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-[fade-up_0.3s_var(--ease-out-soft)_both] rounded-xl px-4 py-3 text-sm font-medium shadow-pop ${
              t.tone === "success" ? "bg-primary text-white" : "bg-error text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
