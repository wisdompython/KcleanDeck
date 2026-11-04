"use client";

import { useEffect, useState } from "react";

import type { Quote } from "@/lib/types";

export interface QuoteInputs {
  service: string;
  frequency: number | null;
  area: number | null;
  quantities: Record<string, number>;
  area_sqm: number | null;
  addon_ids: number[];
  discount_code?: string;
}

interface Result {
  key: string;
  quote: Quote | null;
  error: string;
}

/** Live price from the backend pricing engine (debounced). */
export function useQuote(inputs: QuoteInputs, enabled: boolean) {
  const key = JSON.stringify(inputs);
  // The latest response, tagged with the inputs it was for. While it doesn't
  // match the current inputs, a newer request is in flight.
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/quote/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: key,
          signal: controller.signal,
        });
        const body = await res.json();
        if (res.ok) {
          setResult({ key, quote: body, error: "" });
        } else {
          const message = body.detail ?? Object.values(body).flat().join(" ");
          setResult({ key, quote: null, error: message || "Couldn't calculate a price." });
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setResult({ key, quote: null, error: "Couldn't reach our pricing service. Check your connection and try again." });
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, enabled]);

  if (!enabled) return { quote: null, error: "", loading: false };
  // Keep showing the previous price (dimmed) while the new one loads.
  return { quote: result?.quote ?? null, error: result?.error ?? "", loading: result?.key !== key };
}
