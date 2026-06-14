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

import type { Metric } from "./lib/derive.ts";

/**
 * Deployment-specific configuration (spec §8.7). Everything an operator might
 * tune lives here — no magic constants scattered through the UI.
 */

/** GitHub repo under coverage patrol. */
export const REPO_OWNER = "kellyneil098";
export const REPO_NAME = "bank-of-devin";

/**
 * Regulatory exam deadline the coverage patrol is racing toward. Drives the
 * deadline marker on the hero chart and the projection readout (§8.3, §8.6).
 */
export const EXAM_DATE = "2026-07-10T00:00:00Z";

/** Compliance-critical coverage bar the exam requires (%). */
export const COVERAGE_TARGET_PCT = 90;

/** Analyst-minutes saved per test Devin writes — drives the ROI counter (§8.6). */
export const MINUTES_SAVED_PER_TEST = 25;

/** Default coverage metric shown on load. */
export const DEFAULT_METRIC: Metric = "line";

/**
 * Raw base URL of the `coverage-data` branch. The manual "Refresh" button
 * (§8.6) re-fetches live data from here at runtime. The loader appends
 * `data/manifest.json`, etc.
 */
export const RAW_DATA_BASE_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/coverage-data/`;

/** Build a GitHub PR URL. */
export function prUrl(n: number): string {
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/pull/${n}`;
}

/**
 * Map a repo-relative path to a human service name, for the activity-feed
 * service filter (§8.5). First matching prefix wins; unmatched → "Other".
 */
export const SERVICE_MAP: { prefix: string; label: string }[] = [
  { prefix: "src/ledger/ledgerwriter", label: "Ledger writer" },
  { prefix: "src/ledger/balancereader", label: "Balance reader" },
  { prefix: "src/ledger/transactionhistory", label: "Transaction history" },
  { prefix: "src/ledgermonolith", label: "Ledger monolith" },
  { prefix: "src/accounts/userservice", label: "User service" },
  { prefix: "src/accounts/contacts", label: "Contacts" },
  { prefix: "src/frontend", label: "Frontend" },
];

export function serviceForPath(path: string): string {
  for (const { prefix, label } of SERVICE_MAP) {
    if (path.startsWith(prefix)) return label;
  }
  return "Other";
}
