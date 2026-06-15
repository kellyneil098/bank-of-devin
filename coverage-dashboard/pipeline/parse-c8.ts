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

import type { FileCoverage, Language } from "../src/lib/schema.ts";
import { normalizeC8Path } from "./normalize-path.ts";

/**
 * Parse a c8/nyc `coverage-final.json` (Istanbul format) into unified records
 * (spec §4.4). Per file: statementMap/`s` give statement (line) coverage;
 * branchMap/`b` give branch coverage. A file with no branches reports
 * branches_total: 0.
 *
 * Included for the polyglot case (production scenario / OTel-demo alternative).
 * The Bank of Anthos demo path exercises Java + Python only.
 */

interface IstanbulFileCoverage {
  path?: string;
  s?: Record<string, number>;
  b?: Record<string, number[]>;
}

type IstanbulReport = Record<string, IstanbulFileCoverage>;

function languageForPath(path: string): Language {
  return /\.tsx?$/.test(path) ? "typescript" : "javascript";
}

export function parseC8Json(
  json: string | IstanbulReport,
  repoRoot: string,
): FileCoverage[] {
  const doc: IstanbulReport =
    typeof json === "string" ? (JSON.parse(json) as IstanbulReport) : json;
  const out: FileCoverage[] = [];

  for (const [key, fc] of Object.entries(doc)) {
    const s = fc.s ?? {};
    const statementCounts = Object.values(s);
    const linesTotal = statementCounts.length;
    const linesCovered = statementCounts.filter((n) => n > 0).length;

    const b = fc.b ?? {};
    let branchesTotal = 0;
    let branchesCovered = 0;
    for (const paths of Object.values(b)) {
      for (const hit of paths) {
        branchesTotal += 1;
        if (hit > 0) branchesCovered += 1;
      }
    }

    const path = normalizeC8Path(fc.path ?? key, repoRoot);
    out.push({
      path,
      language: languageForPath(path),
      lines_covered: linesCovered,
      lines_total: linesTotal,
      branches_covered: branchesCovered,
      branches_total: branchesTotal,
    });
  }
  return out;
}
