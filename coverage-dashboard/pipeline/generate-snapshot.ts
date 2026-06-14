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

import { resolve } from "node:path";
import type { Pull, Snapshot, SnapshotTrigger } from "../src/lib/schema.ts";
import { discoverCoverage } from "./discover-reports.ts";
import { GitHubClient } from "./enrich-github.ts";
import {
  readManifest,
  upsertManifest,
  writePull,
  writeSnapshot,
} from "./snapshot-io.ts";

/**
 * Pipeline entry (spec §4.2 / §4.3). Reads coverage reports already produced by
 * the workflow, normalizes + merges them, optionally enriches PR metadata from
 * GitHub, then writes snapshot/pull JSON and upserts the manifest in DATA_DIR
 * (a checkout of the `coverage-data` branch's `data/` dir).
 *
 * Env:
 *   REPO_ROOT          repo working tree to scan for reports (default: cwd)
 *   DATA_DIR           coverage-data/data dir to write into (required)
 *   TRIGGER            "merge" | "daily" (default: "merge")
 *   COMMIT_SHA         the snapshot commit (merge commit or default HEAD)
 *   PARENT_SHA         optional; defaults to the last manifest snapshot's sha
 *   PR_NUMBER          optional; required for merge attribution
 *   GITHUB_REPOSITORY  "owner/repo" (for enrichment)
 *   GITHUB_TOKEN       token for the REST API
 */
async function main(): Promise<void> {
  const repoRoot = resolve(process.env.REPO_ROOT ?? process.cwd());
  const dataDir = process.env.DATA_DIR;
  if (!dataDir) throw new Error("DATA_DIR is required");

  const trigger = (process.env.TRIGGER ?? "merge") as SnapshotTrigger;
  const commitSha = process.env.COMMIT_SHA;
  if (!commitSha) throw new Error("COMMIT_SHA is required");

  const prNumber = process.env.PR_NUMBER
    ? Number(process.env.PR_NUMBER)
    : null;

  const manifest = readManifest(dataDir);
  const lastSnap = manifest.snapshots[manifest.snapshots.length - 1];
  const parentSha = process.env.PARENT_SHA ?? lastSnap?.commit_sha ?? null;

  console.log(`[pipeline] scanning ${repoRoot} for coverage reports…`);
  const { files, totals } = discoverCoverage(repoRoot);
  console.log(
    `[pipeline] parsed ${files.length} files; ` +
      `lines ${totals.lines_covered}/${totals.lines_total}, ` +
      `branches ${totals.branches_covered}/${totals.branches_total}`,
  );
  if (files.length === 0) {
    throw new Error(
      "No coverage reports found. Ensure JaCoCo / coverage.py / c8 ran first.",
    );
  }

  const snapshot: Snapshot = {
    commit_sha: commitSha,
    parent_sha: parentSha,
    timestamp: new Date().toISOString(),
    trigger,
    pr_number: trigger === "merge" ? prNumber : null,
    totals,
    files,
  };

  let pull: Pull | null = null;
  if (trigger === "merge" && prNumber) {
    const repoEnv = process.env.GITHUB_REPOSITORY;
    const token = process.env.GITHUB_TOKEN;
    if (repoEnv && token) {
      const [owner, repo] = repoEnv.split("/");
      console.log(`[pipeline] enriching PR #${prNumber} from GitHub…`);
      try {
        pull = await new GitHubClient({ owner, repo, token }).buildPullRecord(
          prNumber,
        );
      } catch (err) {
        console.warn(`[pipeline] PR enrichment failed: ${String(err)}`);
      }
    } else {
      console.warn(
        "[pipeline] GITHUB_REPOSITORY/GITHUB_TOKEN unset; skipping PR enrichment.",
      );
    }
  }

  const snapshotFile = writeSnapshot(dataDir, snapshot);
  const pullFile = pull ? writePull(dataDir, pull) : null;
  upsertManifest(dataDir, snapshot, snapshotFile, pull, pullFile);

  console.log(
    `[pipeline] wrote ${snapshotFile}` +
      (pullFile ? ` and ${pullFile}` : "") +
      " and updated manifest.json",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
