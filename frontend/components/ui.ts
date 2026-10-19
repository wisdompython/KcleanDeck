// Button and card class strings from DESIGN.md, shared by links and buttons.
const base =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 font-display text-[15px] font-semibold shadow-card transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none";

export const btn = {
  primary: `${base} bg-primary text-white hover:bg-primary-hover`,
  accent: `${base} bg-secondary text-white hover:bg-on-secondary-container`,
  ghost: `${base} border border-surface-container-high bg-white/90 text-on-surface hover:border-outline-variant hover:bg-white`,
  whatsapp: `${base} bg-whatsapp text-white shadow-whatsapp hover:brightness-95`,
};

export const card = "rounded-3xl border border-surface-container bg-white shadow-card";
