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
 * Path normalization (spec §4.5).
 *
 * Every coverage tool reports paths against its own build/source root. To make
 * category glob-matching (§6) and the files_changed↔coverage join (§7) work,
 * we must reduce every path to be repo-relative from the repo root, e.g.
 *   src/ledger/ledgerwriter/src/main/java/anthos/.../JWTVerifierGenerator.java
 *
 * This is the single most common failure mode, so it is implemented as a pure,
 * heavily-tested function.
 */

/** Java package root for this repo's modules; coverage tools report from here. */
const JAVA_PACKAGE_ROOT = "anthos/samples/bankofanthos/";

/**
 * Maps the leaf Java module (the directory immediately under the package root's
 * service segment) to its repo-relative module directory. JaCoCo `<sourcefile>`
 * entries are reported relative to `src/main/java`, so we cannot recover the
 * module from the path alone — we use the package's service segment.
 */
const JAVA_MODULE_DIRS: Record<string, string> = {
  ledgerwriter: "src/ledger/ledgerwriter",
  balancereader: "src/ledger/balancereader",
  transactionhistory: "src/ledger/transactionhistory",
  ledgermonolith: "src/ledgermonolith",
};

function stripLeading(path: string): string {
  let p = path.replace(/\\/g, "/").trim();
  // Strip a leading scheme/absolute marker and collapse `./`.
  p = p.replace(/^\.\//, "");
  p = p.replace(/^\/+/, "");
  return p;
}

/** If `path` already contains `src/`, return the substring from the LAST repo root. */
function fromExistingRepoRoot(path: string): string | null {
  // Prefer the last occurrence so build dirs like `target/.../src/...` resolve
  // to the genuine source path rather than an interior build copy.
  const idx = path.lastIndexOf("src/");
  if (idx === -1) return null;
  return path.slice(idx);
}

/**
 * Normalize a JaCoCo source path. JaCoCo XML reports a package `name`
 * (`anthos/samples/bankofanthos/ledgerwriter`) plus a `<sourcefile name>`.
 * We pass the joined `<package>/<sourcefile>` here. The service segment after
 * the package root tells us which Maven module the file belongs to.
 */
export function normalizeJavaPath(packagedSourcePath: string): string {
  const p = stripLeading(packagedSourcePath);

  // If the caller already handed us a repo-relative path, trust it.
  const existing = fromExistingRepoRoot(p);
  if (existing && existing.includes("/src/main/java/")) return existing;

  const rootIdx = p.indexOf(JAVA_PACKAGE_ROOT);
  if (rootIdx === -1) {
    // Unknown layout — return best-effort repo-relative form.
    return existing ?? p;
  }
  const afterRoot = p.slice(rootIdx + JAVA_PACKAGE_ROOT.length);
  const serviceSegment = afterRoot.split("/")[0];
  const moduleDir = JAVA_MODULE_DIRS[serviceSegment];
  const packagePath = JAVA_PACKAGE_ROOT + afterRoot;
  if (!moduleDir) {
    return `src/.../src/main/java/${packagePath}`;
  }
  return `${moduleDir}/src/main/java/${packagePath}`;
}

/**
 * Normalize a coverage.py path. coverage.json keys are relative to where pytest
 * ran (typically the service dir, e.g. `userservice.py` or `db.py`), but may be
 * absolute or contain the service dir. We resolve them against a known
 * `serviceDir` (repo-relative, e.g. `src/accounts/userservice`).
 */
export function normalizePythonPath(rawPath: string, serviceDir: string): string {
  const p = stripLeading(rawPath);
  const existing = fromExistingRepoRoot(p);
  if (existing) return existing;
  const dir = stripLeading(serviceDir).replace(/\/$/, "");
  // Avoid doubling the service dir if the tool already included it.
  if (p === dir || p.startsWith(dir + "/")) return p;
  return `${dir}/${p}`;
}

/**
 * Whether a repo-relative path is test code rather than application code.
 *
 * Coverage of an application is measured against its production source, not its
 * tests. JaCoCo already scopes Java reports to main classes, but coverage.py run
 * with `--cov=.` reports the test modules themselves (e.g. `tests/test_db.py`,
 * `tests/constants.py`) as covered code, which inflates the numbers. We exclude
 * test files uniformly across languages at discovery time so every snapshot
 * reflects true application coverage.
 */
export function isTestPath(path: string): boolean {
  const p = path.replace(/\\/g, "/");
  const base = p.split("/").pop() ?? p;
  // Anything living in a conventional test directory.
  if (/(^|\/)(tests?|__tests__)\//.test(p)) return true;
  if (/(^|\/)src\/test\//.test(p)) return true;
  // Python test modules and pytest fixtures.
  if (/^test_.*\.py$/.test(base)) return true;
  if (/_test\.py$/.test(base)) return true;
  if (base === "conftest.py") return true;
  // JS/TS test and spec files.
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(base)) return true;
  // Java test classes.
  if (/Tests?\.java$/.test(base)) return true;
  return false;
}

/**
 * Normalize a c8/Istanbul path (absolute filesystem path) to repo-relative.
 * Istanbul emits absolute paths; we strip everything up to and including the
 * provided absolute `repoRoot`.
 */
export function normalizeC8Path(absolutePath: string, repoRoot: string): string {
  const p = absolutePath.replace(/\\/g, "/");
  const root = repoRoot.replace(/\\/g, "/").replace(/\/$/, "");
  if (root && p.startsWith(root + "/")) return p.slice(root.length + 1);
  const existing = fromExistingRepoRoot(p);
  if (existing) return existing;
  return stripLeading(p);
}
