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

import picomatch from "picomatch";

/**
 * Glob matching for category patterns (spec §6). Runs in both Node and the
 * browser. A path matches a pattern set if ANY pattern matches.
 *
 * We enable `dot` so patterns like `**\/*JWT*` still match dotfiles, and
 * `nocase: false` to keep matching case-sensitive (paths are normalized
 * elsewhere). Patterns are compiled once and cached.
 */
const cache = new Map<string, (path: string) => boolean>();

function compile(pattern: string): (path: string) => boolean {
  let fn = cache.get(pattern);
  if (!fn) {
    fn = picomatch(pattern, { dot: true, nocase: false });
    cache.set(pattern, fn);
  }
  return fn;
}

/** True if `path` matches `pattern`. */
export function matchPattern(path: string, pattern: string): boolean {
  return compile(pattern)(path);
}

/** True if `path` matches any pattern in `patterns`. */
export function matchAny(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (compile(pattern)(path)) return true;
  }
  return false;
}
