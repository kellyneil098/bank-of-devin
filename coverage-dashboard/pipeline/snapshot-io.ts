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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Manifest,
  ManifestPull,
  ManifestSnapshot,
  Pull,
  Snapshot,
} from "../src/lib/schema.ts";

/**
 * Read/write the JSON "database" that lives on the `coverage-data` branch
 * (spec §5). `dataDir` is the directory holding `manifest.json`, `snapshots/`
 * and `pulls/` (a checkout of the coverage-data branch's `data/` dir).
 */

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function readManifest(dataDir: string): Manifest {
  const path = join(dataDir, "manifest.json");
  if (!existsSync(path)) {
    return { generated_at: new Date().toISOString(), snapshots: [], pulls: [] };
  }
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

export function writeSnapshot(dataDir: string, snapshot: Snapshot): string {
  const dir = join(dataDir, "snapshots");
  ensureDir(dir);
  const rel = `data/snapshots/${snapshot.commit_sha}.json`;
  writeJson(join(dir, `${snapshot.commit_sha}.json`), snapshot);
  return rel;
}

export function writePull(dataDir: string, pull: Pull): string {
  const dir = join(dataDir, "pulls");
  ensureDir(dir);
  const rel = `data/pulls/${pull.number}.json`;
  writeJson(join(dir, `${pull.number}.json`), pull);
  return rel;
}

/** Upsert snapshot + pull index entries into the manifest, then persist it. */
export function upsertManifest(
  dataDir: string,
  snapshot: Snapshot,
  snapshotFile: string,
  pull: Pull | null,
  pullFile: string | null,
): Manifest {
  const manifest = readManifest(dataDir);

  const snapEntry: ManifestSnapshot = {
    commit_sha: snapshot.commit_sha,
    parent_sha: snapshot.parent_sha,
    timestamp: snapshot.timestamp,
    trigger: snapshot.trigger,
    pr_number: snapshot.pr_number,
    file: snapshotFile,
  };
  const sIdx = manifest.snapshots.findIndex(
    (s) => s.commit_sha === snapshot.commit_sha,
  );
  if (sIdx === -1) manifest.snapshots.push(snapEntry);
  else manifest.snapshots[sIdx] = snapEntry;

  // Keep snapshots ordered by timestamp ascending (spec §5.4).
  manifest.snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (pull && pullFile) {
    const pullEntry: ManifestPull = { number: pull.number, file: pullFile };
    const pIdx = manifest.pulls.findIndex((p) => p.number === pull.number);
    if (pIdx === -1) manifest.pulls.push(pullEntry);
    else manifest.pulls[pIdx] = pullEntry;
    manifest.pulls.sort((a, b) => a.number - b.number);
  }

  manifest.generated_at = new Date().toISOString();
  ensureDir(dataDir);
  writeJson(join(dataDir, "manifest.json"), manifest);
  return manifest;
}
