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

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import type { CoverageCounts, FileCoverage } from "../src/lib/schema.ts";
import { emptyCounts } from "../src/lib/schema.ts";
import { parseJacocoXml } from "./parse-jacoco.ts";
import { parseCoveragePyJson } from "./parse-coverage-py.ts";
import { parseC8Json } from "./parse-c8.ts";
import { isTestPath } from "./normalize-path.ts";

/** Directories never worth descending into when hunting for reports. */
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".m2",
  "coverage-dashboard",
]);

function walk(root: string, predicate: (abs: string) => boolean): string[] {
  const found: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const abs = join(dir, name);
      let s;
      try {
        s = statSync(abs);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        stack.push(abs);
      } else if (predicate(abs)) {
        found.push(abs);
      }
    }
  }
  return found;
}

/**
 * Discover and parse every coverage report under `repoRoot`, normalize to
 * repo-relative paths, and merge across languages into one file list (spec §4.2
 * steps 3–4). Returns the merged per-file records plus the rolled-up totals.
 */
export function discoverCoverage(repoRoot: string): {
  files: FileCoverage[];
  totals: CoverageCounts;
} {
  const byPath = new Map<string, FileCoverage>();

  const add = (records: FileCoverage[]) => {
    for (const r of records) {
      // Coverage is measured against application source, not test code.
      if (isTestPath(r.path)) continue;
      const existing = byPath.get(r.path);
      // If two tools report the same path, keep the richer record.
      if (!existing || r.lines_total > existing.lines_total) {
        byPath.set(r.path, r);
      }
    }
  };

  // Java — JaCoCo XML.
  for (const xmlPath of walk(repoRoot, (p) => p.endsWith("/jacoco.xml"))) {
    add(parseJacocoXml(readFileSync(xmlPath, "utf8")));
  }

  // Python — coverage.py JSON. The service dir is the report's parent dir,
  // made repo-relative.
  for (const jsonPath of walk(repoRoot, (p) => p.endsWith("/coverage.json"))) {
    const serviceDir = relative(repoRoot, dirname(jsonPath)) || ".";
    add(parseCoveragePyJson(readFileSync(jsonPath, "utf8"), serviceDir));
  }

  // TS/JS — c8/Istanbul. Optional; absent on the Bank of Anthos demo path.
  for (const jsonPath of walk(repoRoot, (p) =>
    p.endsWith("/coverage-final.json"),
  )) {
    add(parseC8Json(readFileSync(jsonPath, "utf8"), repoRoot));
  }

  const files = [...byPath.values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  const totals = files.reduce((acc, f) => {
    acc.lines_covered += f.lines_covered;
    acc.lines_total += f.lines_total;
    acc.branches_covered += f.branches_covered;
    acc.branches_total += f.branches_total;
    return acc;
  }, emptyCounts());

  return { files, totals };
}
