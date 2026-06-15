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

import type {
  CategoryConfig,
  CategoryDef,
  CoverageCounts,
  FileCoverage,
} from "./schema.ts";
import { addCounts, emptyCounts } from "./schema.ts";
import { matchAny } from "./glob.ts";

/**
 * Category logic applied at READ time (spec §6). Categories are data, never
 * hard-coded: the frontend only ever references ids that come from the config.
 * Membership is multi: a file can belong to many categories.
 */

/** Synthetic id for the union of all compliance-critical categories (§6). */
export const COMPLIANCE_CRITICAL_ID = "__compliance_critical__";
/** Synthetic id for files matching no category (§6 uncovered bucket). */
export const UNCATEGORIZED_ID = "__uncategorized__";

/** Category ids whose patterns match `path`. */
export function categoriesForPath(
  path: string,
  config: CategoryConfig,
): string[] {
  const ids: string[] = [];
  for (const cat of config.categories) {
    if (matchAny(path, cat.patterns)) ids.push(cat.id);
  }
  return ids;
}

/** True if `path` belongs to any compliance-critical category. */
export function isComplianceCritical(
  path: string,
  config: CategoryConfig,
): boolean {
  for (const cat of config.categories) {
    if (cat.compliance_critical && matchAny(path, cat.patterns)) return true;
  }
  return false;
}

export interface CategorySlice {
  id: string;
  label: string;
  compliance_critical: boolean;
  counts: CoverageCounts;
}

/**
 * Aggregate per-file coverage into per-category counts plus the two synthetic
 * buckets: the compliance-critical superset and the uncategorized bucket.
 * Per-category coverage = Σ covered / Σ total over member files (§6).
 */
export function aggregateByCategory(
  files: FileCoverage[],
  config: CategoryConfig,
): CategorySlice[] {
  const byId = new Map<string, CoverageCounts>();
  for (const cat of config.categories) byId.set(cat.id, emptyCounts());
  const compliance = emptyCounts();
  const uncategorized = emptyCounts();

  for (const f of files) {
    let matchedAny = false;
    let matchedCompliance = false;
    for (const cat of config.categories) {
      if (matchAny(f.path, cat.patterns)) {
        addCounts(byId.get(cat.id)!, f);
        matchedAny = true;
        if (cat.compliance_critical) matchedCompliance = true;
      }
    }
    if (matchedCompliance) addCounts(compliance, f);
    if (!matchedAny) addCounts(uncategorized, f);
  }

  const slices: CategorySlice[] = config.categories.map((cat: CategoryDef) => ({
    id: cat.id,
    label: cat.label,
    compliance_critical: cat.compliance_critical,
    counts: byId.get(cat.id)!,
  }));

  slices.push({
    id: COMPLIANCE_CRITICAL_ID,
    label: "Compliance-critical",
    compliance_critical: true,
    counts: compliance,
  });
  slices.push({
    id: UNCATEGORIZED_ID,
    label: config.uncovered_bucket_label,
    compliance_critical: false,
    counts: uncategorized,
  });
  return slices;
}

/** Look up a human label for any id, including the synthetic buckets. */
export function labelForCategory(
  id: string,
  config: CategoryConfig,
): string {
  if (id === COMPLIANCE_CRITICAL_ID) return "Compliance-critical";
  if (id === UNCATEGORIZED_ID) return config.uncovered_bucket_label;
  return config.categories.find((c) => c.id === id)?.label ?? id;
}
