/*
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Display formatting. Per the design system: always write the unit on a
 * number, use a real minus sign, mono for all numerals (applied via CSS).
 */

const MINUS = "\u2212"; // proper minus sign

export function fmtPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** Percentage-point delta, e.g. "+2.0 pts" / "−1.3 pts". */
export function fmtSignedPts(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? MINUS : "";
  return `${sign}${Math.abs(value).toFixed(digits)} pts`;
}

export function fmtInt(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function fmtSigned(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? MINUS : "";
  return `${sign}${fmtInt(Math.abs(value))}`;
}

/** Hours → "4h 12m", "2d 3h", or "12m". */
export function fmtDurationHours(hours: number): string {
  if (!Number.isFinite(hours)) return "—";
  const totalMin = Math.round(hours * 60);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** ISO → "Jun 14". */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** ISO → "Jun 14, 2026". */
export function fmtDateFull(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Short commit sha. */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

/** Extract a short session id from a Devin session URL. */
export function shortSession(url: string | null): string {
  if (!url) return "—";
  const m = url.match(/sessions\/([0-9a-f]+)/i);
  return m ? m[1].slice(0, 8) : url;
}
