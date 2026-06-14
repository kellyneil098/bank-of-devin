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
 * Heuristic — tests added (spec §4.6).
 *
 * Counts added test definitions in a unified diff, per language:
 *   Java    @Test
 *   Python  def test_
 *   TS/JS   it( / test(
 * Only ADDED lines (prefixed `+`, excluding the `+++` file header) are counted.
 */

const PATTERNS: RegExp[] = [
  /@Test\b/, // Java / JUnit
  /\bdef\s+test_\w*/, // Python / pytest
  /\b(?:it|test)\s*\(/, // TS / JS (jest, vitest, mocha)
];

/** Count added test definitions across a unified diff string. */
export function countTestsAddedInDiff(diff: string): number {
  let count = 0;
  for (const line of diff.split("\n")) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    const added = line.slice(1);
    for (const re of PATTERNS) {
      const matches = added.match(new RegExp(re, "g"));
      if (matches) count += matches.length;
    }
  }
  return count;
}

/** Count test definitions present in a single file's full text (any language). */
export function countTestsInSource(source: string): number {
  let count = 0;
  for (const re of PATTERNS) {
    const matches = source.match(new RegExp(re, "g"));
    if (matches) count += matches.length;
  }
  return count;
}
