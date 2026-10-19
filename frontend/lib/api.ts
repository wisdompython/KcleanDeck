import "server-only";

import { connection } from "next/server";
import { cache } from "react";

import type { Category, Service, Site } from "@/lib/types";

const BACKEND = (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class BackendUnavailable extends Error {}

// Rates, FAQs and contact details are edited in the Django admin, so every
// read happens at request time (never baked in at build). React's cache()
// dedupes the call between the layout and the page within one request.
async function get<T>(path: string): Promise<T> {
  await connection();
  let res: Response;
  try {
    res = await fetch(`${BACKEND}${path}`, { cache: "no-store", headers: { Accept: "application/json" } });
  } catch (err) {
    throw new BackendUnavailable(`Could not reach the API at ${BACKEND}${path}: ${err}`);
  }
  if (!res.ok) throw new BackendUnavailable(`API ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

export const getSite = cache(() => get<Site>("/api/site/"));
export const getServices = cache(() => get<Service[]>("/api/services/"));
export const getCategories = cache(() => get<Category[]>("/api/categories/"));
export const getTerms = cache(() => get<{ content: string; updated_on: string | null }>("/api/terms/"));
