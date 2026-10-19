// Calculator choices <-> the /book link, so a customer can forward the exact
// price to whoever approves it. The link carries choices, never prices: the
// price is always recalculated live, so a forwarded link can't show a stale
// or edited amount.
//
//   /book?service=deep-cleaning&freq=4&area=2&rooms=7-4.8-1&extras=3
//
// rooms  = <unit id>-<count> pairs joined by "."   (per room/unit services)
// sqm    = floor area                               (per m² services)
// extras = add-on ids joined by "."

import { naira } from "@/lib/format";
import type { Quote, Service, Site } from "@/lib/types";

export interface Choices {
  frequencyId: number | null;
  areaId: number | null;
  quantities: Record<string, number>;
  areaSqm: string;
  addonIds: number[];
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const toInt = (v: string) => (/^\d+$/.test(v) ? Number(v) : null);

export function defaultChoices(service: Service): Choices {
  return {
    frequencyId: service.frequencies[0]?.id ?? null,
    areaId: null,
    quantities: Object.fromEntries(service.units.map((u) => [String(u.id), u.default_qty])),
    areaSqm: String(service.min_area_sqm * 5),
    addonIds: [],
  };
}

/** Rebuild choices from a shared link, ignoring anything that's no longer valid for this service. */
export function choicesFromParams(service: Service, site: Site, params: RawParams): Choices {
  const choices = defaultChoices(service);

  const freq = toInt(first(params.freq));
  if (freq !== null && service.frequencies.some((f) => f.id === freq)) choices.frequencyId = freq;

  const area = toInt(first(params.area));
  if (area !== null && site.areas.some((a) => a.id === area)) choices.areaId = area;

  for (const pair of first(params.rooms).split(".")) {
    const [id, count] = pair.split("-").map(toInt);
    const unit = service.units.find((u) => u.id === id);
    if (unit && count !== null) choices.quantities[String(unit.id)] = Math.min(unit.max_qty, Math.max(unit.min_qty, count));
  }

  const sqm = toInt(first(params.sqm));
  if (sqm !== null) choices.areaSqm = String(Math.min(service.max_area_sqm, Math.max(service.min_area_sqm, sqm)));

  const addonIds = new Set(service.addons.map((a) => a.id));
  choices.addonIds = first(params.extras)
    .split(".")
    .map(toInt)
    .filter((id): id is number => id !== null && addonIds.has(id));

  return choices;
}

/** The query string for the current choices (only what differs from a fresh calculator). */
export function choicesToQuery(service: Service, c: Choices): string {
  const q = new URLSearchParams({ service: service.slug });
  if (service.pricing_method === "quote") return q.toString();
  if (c.frequencyId !== null && c.frequencyId !== service.frequencies[0]?.id) q.set("freq", String(c.frequencyId));
  if (c.areaId !== null) q.set("area", String(c.areaId));
  if (service.pricing_method === "per_unit") {
    const rooms = service.units
      .filter((u) => (c.quantities[String(u.id)] ?? u.default_qty) !== u.default_qty)
      .map((u) => `${u.id}-${c.quantities[String(u.id)]}`);
    if (rooms.length) q.set("rooms", rooms.join("."));
  }
  if (service.pricing_method === "per_sqm" && c.areaSqm) q.set("sqm", c.areaSqm);
  if (c.addonIds.length) q.set("extras", [...c.addonIds].sort((a, b) => a - b).join("."));
  return q.toString();
}

/** Plain-words message to send with the link. */
export function shareMessage(service: Service, site: Site, c: Choices, quote: Quote, url: string): string {
  const details: string[] = [];
  if (service.pricing_method === "per_unit") {
    for (const u of service.units) {
      const n = c.quantities[String(u.id)] ?? u.default_qty;
      if (n) details.push(`${u.label} × ${n}`);
    }
  }
  if (service.pricing_method === "per_sqm") details.push(`${c.areaSqm} m²`);
  for (const a of service.addons) if (c.addonIds.includes(a.id)) details.push(a.label);
  const frequency = service.frequencies.find((f) => f.id === c.frequencyId);
  if (frequency) details.push(frequency.label);
  const area = site.areas.find((a) => a.id === c.areaId);
  if (area) details.push(area.name);

  const covers = quote.visits > 1 ? ` (covers ${quote.visits} visits)` : "";
  return [
    `Kleandeck price for ${service.name}: ${naira(quote.total)} including VAT${covers}.`,
    details.length ? details.join(" · ") : "",
    `See the breakdown or book: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");
}
