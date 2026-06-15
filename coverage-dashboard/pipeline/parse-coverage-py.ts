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

import type { FileCoverage } from "../src/lib/schema.ts";
import { normalizePythonPath } from "./normalize-path.ts";

/**
 * Parse a coverage.py `coverage.json` report (produced by
 * `pytest --cov=<pkg> --cov-branch --cov-report=json`) into unified records
 * (spec §4.4). Each `files[path].summary` carries covered_lines,
 * num_statements, covered_branches and num_branches. Reports run without
 * `--cov-branch` omit branch fields → branches_total: 0.
 */

interface CoveragePySummary {
  covered_lines?: number;
  num_statements?: number;
  covered_branches?: number;
  num_branches?: number;
}

interface CoveragePyReport {
  files?: Record<string, { summary?: CoveragePySummary }>;
}

export function parseCoveragePyJson(
  json: string | CoveragePyReport,
  serviceDir: string,
): FileCoverage[] {
  const doc: CoveragePyReport =
    typeof json === "string" ? (JSON.parse(json) as CoveragePyReport) : json;
  const out: FileCoverage[] = [];

  for (const [rawPath, entry] of Object.entries(doc.files ?? {})) {
    const summary = entry.summary ?? {};
    out.push({
      path: normalizePythonPath(rawPath, serviceDir),
      language: "python",
      lines_covered: summary.covered_lines ?? 0,
      lines_total: summary.num_statements ?? 0,
      branches_covered: summary.covered_branches ?? 0,
      branches_total: summary.num_branches ?? 0,
    });
  }
  return out;
}
