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

import { createHash } from "node:crypto";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  FileCoverage,
  Language,
  Pull,
  PullReview,
  ReviewVerdict,
  Snapshot,
} from "../src/lib/schema.ts";
import { emptyCounts } from "../src/lib/schema.ts";
import { writePull, writeSnapshot, upsertManifest } from "./snapshot-io.ts";

/**
 * Seed illustrative demo data for the dashboard (committed so the static build
 * has content without waiting for live merges). The narrative is real: this
 * fork's tests were stripped out, then Devin's coverage patrol drove coverage
 * back up toward a regulatory-exam bar. File paths are the repo's REAL
 * normalized paths and the anchor PRs (#1/#2/#3/#7) use real titles, authors,
 * additions and the real Devin session URL on #3.
 *
 * Output dir defaults to coverage-dashboard/public/data (bundled into the
 * static build); override with OUT_DIR to seed a coverage-data checkout.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = resolve(HERE, "../public/data");

interface FileSpec {
  path: string;
  language: Language;
  lines_total: number;
  branches_total: number;
  base: number; // baseline line-coverage ratio
}

const J = "java";
const PY = "python";

// Real, normalized repo-relative paths. `base` = coverage right after the
// test-removal that triggered the patrol.
const FILES: FileSpec[] = [
  // ledgerwriter
  jw("ledgerwriter", "LedgerWriterController.java", 120, 28, 0.16),
  jw("ledgerwriter", "TransactionValidator.java", 55, 18, 0.2),
  jw("ledgerwriter", "Transaction.java", 60, 8, 0.24),
  jw("ledgerwriter", "JWTVerifierGenerator.java", 35, 4, 0.1),
  jw("ledgerwriter", "ExceptionMessages.java", 8, 0, 0.0),
  jw("ledgerwriter", "LedgerWriterApplication.java", 14, 0, 0.0),
  jw("ledgerwriter", "TransactionRepository.java", 8, 0, 0.0),
  // balancereader
  jb("balancereader", "BalanceReaderController.java", 95, 20, 0.15),
  jb("balancereader", "BalanceCache.java", 40, 6, 0.1),
  jb("balancereader", "LedgerReader.java", 90, 22, 0.08),
  jb("balancereader", "Transaction.java", 55, 8, 0.24),
  jb("balancereader", "JWTVerifierGenerator.java", 35, 4, 0.1),
  jb("balancereader", "TransactionRepository.java", 8, 0, 0.0),
  jb("balancereader", "BalanceReaderApplication.java", 14, 0, 0.0),
  // transactionhistory
  jt("transactionhistory", "TransactionHistoryController.java", 115, 26, 0.16),
  jt("transactionhistory", "TransactionCache.java", 45, 8, 0.1),
  jt("transactionhistory", "LedgerReader.java", 88, 22, 0.08),
  jt("transactionhistory", "Transaction.java", 55, 8, 0.24),
  jt("transactionhistory", "JWTVerifierGenerator.java", 35, 4, 0.1),
  jt("transactionhistory", "TransactionRepository.java", 8, 0, 0.0),
  jt("transactionhistory", "TransactionHistoryApplication.java", 14, 0, 0.0),
  // ledgermonolith — never well tested, stays low (drags overall down)
  jm("LedgerMonolithController.java", 140, 30, 0.05),
  jm("TransactionValidator.java", 55, 18, 0.06),
  jm("LedgerReader.java", 90, 22, 0.05),
  jm("AccountInfo.java", 30, 6, 0.05),
  jm("Transaction.java", 55, 8, 0.07),
  jm("JWTVerifierGenerator.java", 35, 4, 0.05),
  // python — userservice
  py("src/accounts/userservice", "userservice.py", 130, 22, 0.18),
  py("src/accounts/userservice", "db.py", 45, 8, 0.18),
  // python — contacts
  py("src/accounts/contacts", "contacts.py", 110, 20, 0.16),
  py("src/accounts/contacts", "db.py", 38, 6, 0.16),
  // python — frontend
  py("src/frontend", "frontend.py", 330, 60, 0.12),
  py("src/frontend", "api_call.py", 22, 4, 0.12),
];

function jw(_m: string, file: string, lt: number, bt: number, base: number): FileSpec {
  return javaSpec("src/ledger/ledgerwriter", "ledgerwriter", file, lt, bt, base);
}
function jb(_m: string, file: string, lt: number, bt: number, base: number): FileSpec {
  return javaSpec("src/ledger/balancereader", "balancereader", file, lt, bt, base);
}
function jt(_m: string, file: string, lt: number, bt: number, base: number): FileSpec {
  return javaSpec(
    "src/ledger/transactionhistory",
    "transactionhistory",
    file,
    lt,
    bt,
    base,
  );
}
function jm(file: string, lt: number, bt: number, base: number): FileSpec {
  return javaSpec("src/ledgermonolith", "ledgermonolith", file, lt, bt, base);
}
function javaSpec(
  moduleDir: string,
  pkgLeaf: string,
  file: string,
  lt: number,
  bt: number,
  base: number,
): FileSpec {
  return {
    path: `${moduleDir}/src/main/java/anthos/samples/bankofanthos/${pkgLeaf}/${file}`,
    language: J,
    lines_total: lt,
    branches_total: bt,
    base,
  };
}
function py(
  dir: string,
  file: string,
  lt: number,
  bt: number,
  base: number,
): FileSpec {
  return { path: `${dir}/${file}`, language: PY, lines_total: lt, branches_total: bt, base };
}

/** A scripted merge event in the patrol narrative. */
interface MergeEvent {
  day: string; // YYYY-MM-DD
  hour: number;
  pr: Omit<
    Pull,
    "merge_commit_sha" | "files_changed" | "review_verdict"
  > & { files_changed: string[]; review_verdict: ReviewVerdict };
  /** path → new line-coverage ratio after this merge. */
  targets: Record<string, number>;
  /** paths excluded from measurement after this merge (JaCoCo scoping). */
  exclude?: string[];
}

const BOT = "devin-ai-integration[bot]";
const HUMAN = "kellyneil098";

function devinReview(): PullReview {
  return {
    author: BOT,
    state: "COMMENTED",
    is_devin_review: true,
    submitted_at: null,
    body: "Devin review: automated checks passed.",
  };
}
function humanApproval(): PullReview {
  return { author: HUMAN, state: "APPROVED", is_devin_review: false, submitted_at: null };
}
function humanChangesRequested(): PullReview {
  return {
    author: HUMAN,
    state: "CHANGES_REQUESTED",
    is_devin_review: false,
    submitted_at: null,
  };
}

function p(path: string): string {
  return path;
}

const LW = "src/ledger/ledgerwriter/src/main/java/anthos/samples/bankofanthos/ledgerwriter";
const BR = "src/ledger/balancereader/src/main/java/anthos/samples/bankofanthos/balancereader";
const TH =
  "src/ledger/transactionhistory/src/main/java/anthos/samples/bankofanthos/transactionhistory";

const EVENTS: MergeEvent[] = [
  {
    day: "2026-06-03",
    hour: 14,
    targets: { [`${LW}/Transaction.java`]: 0.93 },
    pr: {
      number: 1,
      title: "Add unit tests for Transaction model in ledgerwriter",
      branch: "devin/1780870320-transaction-unit-tests",
      created_at: "2026-06-03T11:20:00Z",
      merged_at: "2026-06-03T14:00:00Z",
      author: BOT,
      additions: 165,
      deletions: 0,
      tests_added_estimate: 6,
      session_url: "https://app.devin.ai/sessions/9b2c1f704a8d4e2db1c0a7e3f5d6c801",
      reviews: [devinReview(), humanApproval()],
      review_verdict: "approved",
      human_rework: false,
      mutation_score: null,
      files_changed: [
        p(`${LW}/Transaction.java`),
        "src/ledger/ledgerwriter/src/test/java/anthos/samples/bankofanthos/ledgerwriter/TransactionTest.java",
      ],
    },
  },
  {
    day: "2026-06-04",
    hour: 15,
    targets: { [`${BR}/BalanceCache.java`]: 0.86 },
    pr: {
      number: 2,
      title: "Add unit tests for BalanceCache class",
      branch: "devin/1780870305-balancecache-unit-tests",
      created_at: "2026-06-04T12:05:00Z",
      merged_at: "2026-06-04T15:00:00Z",
      author: BOT,
      additions: 110,
      deletions: 0,
      tests_added_estimate: 3,
      session_url: "https://app.devin.ai/sessions/2f7a9c14b8e34d11a6c5e0f3927b4d56",
      reviews: [devinReview(), humanApproval()],
      review_verdict: "approved",
      human_rework: false,
      mutation_score: null,
      files_changed: [p(`${BR}/BalanceCache.java`)],
    },
  },
  {
    day: "2026-06-06",
    hour: 16,
    targets: {
      [`${LW}/TransactionValidator.java`]: 0.95,
      [`${LW}/LedgerWriterController.java`]: 0.68,
    },
    pr: {
      number: 8,
      title: "Add unit tests for TransactionValidator and LedgerWriterController",
      branch: "devin/1780980011-ledgerwriter-validator-tests",
      created_at: "2026-06-06T12:40:00Z",
      merged_at: "2026-06-06T16:00:00Z",
      author: BOT,
      additions: 248,
      deletions: 0,
      tests_added_estimate: 8,
      session_url: "https://app.devin.ai/sessions/5d3e8b026c1a4f93b7e21d4a8f60c9a2",
      reviews: [devinReview(), humanApproval()],
      review_verdict: "approved",
      human_rework: false,
      mutation_score: null,
      files_changed: [
        p(`${LW}/TransactionValidator.java`),
        p(`${LW}/LedgerWriterController.java`),
      ],
    },
  },
  {
    day: "2026-06-07",
    hour: 22,
    targets: { [`${TH}/TransactionCache.java`]: 0.9 },
    pr: {
      number: 3,
      title: "Add unit tests for TransactionCache class",
      branch: "devin/1780870294-transaction-cache-tests",
      created_at: "2026-06-07T19:30:00Z",
      merged_at: "2026-06-07T22:14:00Z",
      author: BOT,
      additions: 214,
      deletions: 0,
      tests_added_estimate: 7,
      session_url: "https://app.devin.ai/sessions/ebbaaa70facd4f7db009d91137ad6225",
      reviews: [devinReview(), humanApproval()],
      review_verdict: "approved",
      human_rework: false,
      mutation_score: null,
      files_changed: [p(`${TH}/TransactionCache.java`)],
    },
  },
  {
    day: "2026-06-08",
    hour: 17,
    targets: {
      "src/accounts/userservice/userservice.py": 0.8,
      "src/accounts/userservice/db.py": 0.78,
    },
    pr: {
      number: 9,
      title: "Add pytest coverage for userservice authentication and token issuance",
      branch: "devin/1781001220-userservice-auth-tests",
      created_at: "2026-06-08T09:10:00Z",
      merged_at: "2026-06-08T17:00:00Z",
      author: BOT,
      additions: 286,
      deletions: 4,
      tests_added_estimate: 9,
      session_url: "https://app.devin.ai/sessions/7c41a9e2d05b4c8fa3e16b7290d4f5e8",
      reviews: [devinReview(), humanChangesRequested(), humanApproval()],
      review_verdict: "approved",
      human_rework: true,
      mutation_score: null,
      files_changed: [
        "src/accounts/userservice/userservice.py",
        "src/accounts/userservice/db.py",
      ],
    },
  },
  {
    day: "2026-06-10",
    hour: 13,
    targets: {
      [`${LW}/JWTVerifierGenerator.java`]: 0.9,
      [`${BR}/JWTVerifierGenerator.java`]: 0.9,
      [`${TH}/JWTVerifierGenerator.java`]: 0.9,
    },
    pr: {
      number: 10,
      title: "Add unit tests for JWTVerifierGenerator across ledger services",
      branch: "devin/1781120044-jwt-verifier-tests",
      created_at: "2026-06-10T10:00:00Z",
      merged_at: "2026-06-10T13:00:00Z",
      author: BOT,
      additions: 192,
      deletions: 0,
      tests_added_estimate: 5,
      session_url: "https://app.devin.ai/sessions/a18d6f3920c74e5bb0d2f81e4c6a7039",
      reviews: [devinReview(), humanApproval()],
      review_verdict: "approved",
      human_rework: false,
      mutation_score: null,
      files_changed: [
        p(`${LW}/JWTVerifierGenerator.java`),
        p(`${BR}/JWTVerifierGenerator.java`),
        p(`${TH}/JWTVerifierGenerator.java`),
      ],
    },
  },
  {
    day: "2026-06-11",
    hour: 18,
    targets: {
      "src/accounts/contacts/contacts.py": 0.83,
      "src/accounts/contacts/db.py": 0.8,
    },
    pr: {
      number: 11,
      title: "Add pytest coverage for contacts PII persistence and validation",
      branch: "devin/1781200310-contacts-pii-tests",
      created_at: "2026-06-11T14:25:00Z",
      merged_at: "2026-06-11T18:00:00Z",
      author: BOT,
      additions: 224,
      deletions: 0,
      tests_added_estimate: 7,
      session_url: "https://app.devin.ai/sessions/c0b7e4a1582d4f63a9e8d1740b3c6f25",
      reviews: [devinReview(), humanApproval()],
      review_verdict: "approved",
      human_rework: false,
      mutation_score: null,
      files_changed: [
        "src/accounts/contacts/contacts.py",
        "src/accounts/contacts/db.py",
      ],
    },
  },
  {
    day: "2026-06-12",
    hour: 16,
    targets: {
      [`${BR}/BalanceReaderController.java`]: 0.74,
      [`${BR}/LedgerReader.java`]: 0.56,
      [`${TH}/LedgerReader.java`]: 0.56,
    },
    pr: {
      number: 12,
      title: "Add tests for BalanceReaderController and LedgerReader streaming",
      branch: "devin/1781290120-balancereader-ledgerreader-tests",
      created_at: "2026-06-12T11:50:00Z",
      merged_at: "2026-06-12T16:00:00Z",
      author: BOT,
      additions: 318,
      deletions: 6,
      tests_added_estimate: 10,
      session_url: "https://app.devin.ai/sessions/d4f1907a36e84b25c1a0e7f582b9d6c3",
      reviews: [devinReview(), humanApproval()],
      review_verdict: "approved",
      human_rework: false,
      mutation_score: null,
      files_changed: [
        p(`${BR}/BalanceReaderController.java`),
        p(`${BR}/LedgerReader.java`),
        p(`${TH}/LedgerReader.java`),
      ],
    },
  },
  {
    day: "2026-06-13",
    hour: 15,
    targets: {
      "src/frontend/api_call.py": 0.86,
      "src/frontend/frontend.py": 0.36,
    },
    pr: {
      number: 13,
      title: "Add tests for frontend api_call audit logging and request tracing",
      branch: "devin/1781380255-frontend-audit-tests",
      created_at: "2026-06-13T10:30:00Z",
      merged_at: "2026-06-13T15:00:00Z",
      author: BOT,
      additions: 201,
      deletions: 0,
      tests_added_estimate: 6,
      session_url: "https://app.devin.ai/sessions/e93b2c5081a74d6fb2c4e10937f6a8d1",
      reviews: [devinReview(), humanApproval()],
      review_verdict: "approved",
      human_rework: false,
      mutation_score: 0.74,
      files_changed: ["src/frontend/api_call.py", "src/frontend/frontend.py"],
    },
  },
  {
    day: "2026-06-14",
    hour: 20,
    targets: {},
    exclude: [
      `${LW}/ExceptionMessages.java`,
      `${LW}/LedgerWriterApplication.java`,
      `${LW}/TransactionRepository.java`,
      `${BR}/TransactionRepository.java`,
      `${BR}/BalanceReaderApplication.java`,
      `${TH}/TransactionRepository.java`,
      `${TH}/TransactionHistoryApplication.java`,
    ],
    pr: {
      number: 7,
      title: "Scope JaCoCo coverage reports to controller/validator classes only",
      branch: "devin/1781467071-jacoco-scope-coverage",
      created_at: "2026-06-14T17:40:00Z",
      merged_at: "2026-06-14T20:00:00Z",
      author: BOT,
      additions: 26,
      deletions: 0,
      tests_added_estimate: 0,
      session_url: "https://app.devin.ai/sessions/f1029384a5b6c7d8e9f0a1b2c3d4e5f6",
      reviews: [devinReview(), humanApproval()],
      review_verdict: "approved",
      human_rework: false,
      mutation_score: null,
      files_changed: [
        "src/ledger/ledgerwriter/pom.xml",
        "src/ledger/balancereader/pom.xml",
        "src/ledger/transactionhistory/pom.xml",
      ],
    },
  },
];

// Pull requests that were opened but never merged (the test-removal PRs that
// triggered the crisis). They make merge-rate < 100% and populate the feed.
const UNMERGED_PULLS: Pull[] = [
  unmerged(
    4,
    "Remove ledgerwriter unit tests",
    "devin/1781142001-remove-ledgerwriter-tests",
    "2026-06-02T09:00:00Z",
  ),
  unmerged(
    5,
    "Remove LedgerReader integration tests",
    "devin/1781142003-remove-ledgerreader-tests",
    "2026-06-02T09:05:00Z",
  ),
  unmerged(
    6,
    "Remove python accounts tests",
    "devin/1781142004-remove-python-accounts-tests",
    "2026-06-02T09:10:00Z",
  ),
];

function unmerged(
  number: number,
  title: string,
  branch: string,
  created_at: string,
): Pull {
  return {
    number,
    title,
    branch,
    created_at,
    merged_at: null,
    merge_commit_sha: null,
    author: BOT,
    additions: 0,
    deletions: 120,
    files_changed: [],
    tests_added_estimate: 0,
    session_url: null,
    reviews: [humanChangesRequested()],
    review_verdict: "changes_requested",
    human_rework: false,
    mutation_score: null,
  };
}

// Days with only a daily-backstop snapshot (no merge) — flat coverage.
const DAILY_ONLY = ["2026-06-01", "2026-06-02", "2026-06-05", "2026-06-09"];

function sha(seed: string): string {
  return createHash("sha1").update(seed).digest("hex");
}

function clampRatio(r: number): number {
  return Math.max(0, Math.min(1, r));
}

function buildFiles(
  ratios: Map<string, number>,
  excluded: Set<string>,
): FileCoverage[] {
  const out: FileCoverage[] = [];
  for (const f of FILES) {
    if (excluded.has(f.path)) continue;
    const r = clampRatio(ratios.get(f.path) ?? f.base);
    const branchR = clampRatio(r * 0.85);
    out.push({
      path: f.path,
      language: f.language,
      lines_covered: Math.round(f.lines_total * r),
      lines_total: f.lines_total,
      branches_covered: Math.round(f.branches_total * branchR),
      branches_total: f.branches_total,
    });
  }
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

function totalsOf(files: FileCoverage[]) {
  return files.reduce((acc, f) => {
    acc.lines_covered += f.lines_covered;
    acc.lines_total += f.lines_total;
    acc.branches_covered += f.branches_covered;
    acc.branches_total += f.branches_total;
    return acc;
  }, emptyCounts());
}

function main(): void {
  const outDir = resolve(process.env.OUT_DIR ?? DEFAULT_OUT);

  // Build a unified, time-ordered list of snapshot "moments".
  interface Moment {
    timestamp: string;
    trigger: "merge" | "daily";
    pr_number: number | null;
    event?: MergeEvent;
  }
  const moments: Moment[] = [];
  for (const d of DAILY_ONLY) {
    moments.push({
      timestamp: `${d}T23:50:00Z`,
      trigger: "daily",
      pr_number: null,
    });
  }
  for (const e of EVENTS) {
    const hh = String(e.hour).padStart(2, "0");
    moments.push({
      timestamp: `${e.day}T${hh}:00:00Z`,
      trigger: "merge",
      pr_number: e.pr.number,
      event: e,
    });
  }
  moments.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const ratios = new Map<string, number>();
  for (const f of FILES) ratios.set(f.path, f.base);
  const excluded = new Set<string>();

  const snapshots: Snapshot[] = [];
  const pulls: Pull[] = [];
  let prevSha: string | null = null;

  moments.forEach((m, i) => {
    if (m.event) {
      for (const [path, r] of Object.entries(m.event.targets)) {
        ratios.set(path, r);
      }
      for (const ex of m.event.exclude ?? []) excluded.add(ex);
    }
    const files = buildFiles(ratios, excluded);
    const totals = totalsOf(files);
    const commit_sha = sha(`snapshot-${i}-${m.timestamp}`);
    const snapshot: Snapshot = {
      commit_sha,
      parent_sha: prevSha,
      timestamp: m.timestamp,
      trigger: m.trigger,
      pr_number: m.pr_number,
      totals,
      files,
    };
    snapshots.push(snapshot);

    if (m.event) {
      pulls.push({
        ...m.event.pr,
        merge_commit_sha: commit_sha,
      });
    }
    prevSha = commit_sha;
  });

  pulls.push(...UNMERGED_PULLS);
  pulls.sort((a, b) => a.number - b.number);

  // Write everything, rebuilding the manifest from scratch.
  for (const s of snapshots) {
    const snapFile = writeSnapshot(outDir, s);
    const pull = pulls.find((pp) => pp.merge_commit_sha === s.commit_sha) ?? null;
    const pullFile = pull ? `data/pulls/${pull.number}.json` : null;
    upsertManifest(outDir, s, snapFile, pull, pullFile);
  }
  for (const pull of pulls) writePull(outDir, pull);
  // Ensure all pulls (including unmerged) are in the manifest.
  const anySnapshot = snapshots[snapshots.length - 1];
  for (const pull of UNMERGED_PULLS) {
    upsertManifest(
      outDir,
      anySnapshot,
      `data/snapshots/${anySnapshot.commit_sha}.json`,
      pull,
      `data/pulls/${pull.number}.json`,
    );
  }

  // Ensure categories.json is present alongside the data.
  const canonicalCategories = resolve(DEFAULT_OUT, "categories.json");
  const targetCategories = join(outDir, "categories.json");
  if (canonicalCategories !== targetCategories && existsSync(canonicalCategories)) {
    copyFileSync(canonicalCategories, targetCategories);
  }

  console.log(
    `[seed] wrote ${snapshots.length} snapshots and ${pulls.length} pulls to ${outDir}`,
  );
}

main();
