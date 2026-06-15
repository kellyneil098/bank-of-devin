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

import { XMLParser } from "fast-xml-parser";
import type { FileCoverage } from "../src/lib/schema.ts";
import { normalizeJavaPath } from "./normalize-path.ts";

/**
 * Parse a JaCoCo `jacoco.xml` report into unified per-file records (spec §4.4).
 *
 * Structure: <report><package name="a/b/c"><sourcefile name="X.java">
 *   <counter type="LINE" covered=".." missed=".."/>
 *   <counter type="BRANCH" covered=".." missed=".."/> ...
 * A sourcefile with no BRANCH counter reports branches_total: 0.
 */

interface JacocoCounter {
  "@_type": string;
  "@_missed": string;
  "@_covered": string;
}

interface JacocoSourceFile {
  "@_name": string;
  counter?: JacocoCounter | JacocoCounter[];
}

interface JacocoPackage {
  "@_name": string;
  sourcefile?: JacocoSourceFile | JacocoSourceFile[];
}

interface JacocoReport {
  report?: { package?: JacocoPackage | JacocoPackage[] };
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function counterByType(
  counters: JacocoCounter | JacocoCounter[] | undefined,
  type: string,
): { covered: number; missed: number } {
  for (const c of asArray(counters)) {
    if (c["@_type"] === type) {
      return {
        covered: Number(c["@_covered"] ?? 0),
        missed: Number(c["@_missed"] ?? 0),
      };
    }
  }
  return { covered: 0, missed: 0 };
}

export function parseJacocoXml(xml: string): FileCoverage[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // JaCoCo reports declare a DOCTYPE; tolerate it.
    processEntities: true,
  });
  const doc = parser.parse(xml) as JacocoReport;
  const out: FileCoverage[] = [];

  for (const pkg of asArray(doc.report?.package)) {
    const pkgName = pkg["@_name"];
    for (const sf of asArray(pkg.sourcefile)) {
      const line = counterByType(sf.counter, "LINE");
      const branch = counterByType(sf.counter, "BRANCH");
      const packagedSourcePath = `${pkgName}/${sf["@_name"]}`;
      out.push({
        path: normalizeJavaPath(packagedSourcePath),
        language: "java",
        lines_covered: line.covered,
        lines_total: line.covered + line.missed,
        branches_covered: branch.covered,
        branches_total: branch.covered + branch.missed,
      });
    }
  }
  return out;
}
