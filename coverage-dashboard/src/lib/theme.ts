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

import { COMPLIANCE_CRITICAL_ID, OVERALL_ID } from "./derive.ts";

/**
 * Chart theming. Color values are read at runtime from the design-system CSS
 * custom properties (never hard-coded), so the palette has a single source of
 * truth and the source stays free of raw hex literals.
 */

export interface Palette {
  ink0: string;
  ink1: string;
  ink2: string;
  ink3: string;
  ink4: string;
  paper0: string;
  paper1: string;
  accent0: string;
  accent1: string;
  accent2: string;
  accent3: string;
  signal0: string;
  signal1: string;
  good0: string;
  ruleSoft: string;
}

function cssVar(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function readPalette(): Palette {
  return {
    ink0: cssVar("--ink-0"),
    ink1: cssVar("--ink-1"),
    ink2: cssVar("--ink-2"),
    ink3: cssVar("--ink-3"),
    ink4: cssVar("--ink-4"),
    paper0: cssVar("--paper-0"),
    paper1: cssVar("--paper-1"),
    accent0: cssVar("--accent-0"),
    accent1: cssVar("--accent-1"),
    accent2: cssVar("--accent-2"),
    accent3: cssVar("--accent-3"),
    signal0: cssVar("--signal-0"),
    signal1: cssVar("--signal-1"),
    good0: cssVar("--good-0"),
    ruleSoft: cssVar("--rule-soft"),
  };
}

export interface SeriesStyle {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

// Monochrome-blue set for the toggleable per-category lines. Rust/green are
// intentionally excluded here — rust is reserved for risk (burndown / failures)
// and green for positive deltas.
function categoryCycle(p: Palette): SeriesStyle[] {
  return [
    { stroke: p.accent1, strokeWidth: 1.5 },
    { stroke: p.ink2, strokeWidth: 1.5, strokeDasharray: "5 3" },
    { stroke: p.accent0, strokeWidth: 1.5, strokeDasharray: "2 3" },
    { stroke: p.ink3, strokeWidth: 1.5, strokeDasharray: "6 3 2 3" },
    { stroke: p.ink1, strokeWidth: 1.5, strokeDasharray: "1 3" },
  ];
}

/**
 * Resolve the line style for a given series id. The two headline series get
 * the emphasis treatment; categories cycle through the monochrome set.
 */
export function seriesStyle(
  id: string,
  categoryIndex: number,
  p: Palette,
): SeriesStyle {
  if (id === OVERALL_ID) return { stroke: p.ink0, strokeWidth: 2.5 };
  if (id === COMPLIANCE_CRITICAL_ID)
    return { stroke: p.accent0, strokeWidth: 2.5 };
  const cycle = categoryCycle(p);
  return cycle[categoryIndex % cycle.length];
}
