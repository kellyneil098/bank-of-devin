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
 * Data contracts for the Devin Coverage Dashboard (spec §5).
 *
 * This module is the single source of truth for the on-disk JSON schema.
 * It is imported by BOTH the pipeline (writer) and the frontend (reader) so
 * the two can never drift. There is no runtime code here — types only — so it
 * is safe to import from Node scripts and the browser bundle alike.
 */

export type Language = "java" | "python" | "typescript" | "javascript";

export type SnapshotTrigger = "merge" | "daily";

export type ReviewState =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "COMMENTED"
  | "DISMISSED"
  | "PENDING";

export type ReviewVerdict =
  | "approved"
  | "changes_requested"
  | "commented"
  | "none";

/** Coverage counters shared by totals and per-file records. */
export interface CoverageCounts {
  lines_covered: number;
  lines_total: number;
  branches_covered: number;
  branches_total: number;
}

/** Unified per-file coverage record (spec §5.2). Paths are repo-relative. */
export interface FileCoverage extends CoverageCounts {
  path: string;
  language: Language;
}

/** A coverage snapshot at a single commit (spec §5.1). */
export interface Snapshot {
  commit_sha: string;
  parent_sha: string | null;
  timestamp: string;
  trigger: SnapshotTrigger;
  pr_number: number | null;
  totals: CoverageCounts;
  files: FileCoverage[];
}

/** A single review on a pull request (spec §5.3). */
export interface PullReview {
  author: string;
  state: ReviewState;
  is_devin_review: boolean;
  submitted_at?: string | null;
  body?: string | null;
}

/** A pull request record (spec §5.3). */
export interface Pull {
  number: number;
  title: string;
  branch: string;
  created_at: string;
  merged_at: string | null;
  merge_commit_sha: string | null;
  author: string;
  additions: number;
  deletions: number;
  files_changed: string[];
  tests_added_estimate: number;
  session_url: string | null;
  reviews: PullReview[];
  review_verdict: ReviewVerdict;
  human_rework: boolean;
  /** Optional mutation-testing kill-rate in [0,1] (spec §8.6). Null when absent. */
  mutation_score: number | null;
}

/** Lightweight manifest index entry for a snapshot (spec §5.4). */
export interface ManifestSnapshot {
  commit_sha: string;
  parent_sha: string | null;
  timestamp: string;
  trigger: SnapshotTrigger;
  pr_number: number | null;
  file: string;
}

/** Lightweight manifest index entry for a pull (spec §5.4). */
export interface ManifestPull {
  number: number;
  file: string;
}

/** The manifest — the only index the frontend fetches first (spec §5.4). */
export interface Manifest {
  generated_at: string;
  /** Ordered by timestamp ascending. */
  snapshots: ManifestSnapshot[];
  pulls: ManifestPull[];
}

/** A single category definition (spec §5.5). */
export interface CategoryDef {
  id: string;
  label: string;
  description: string;
  /** Glob patterns matched against normalized, repo-relative paths. */
  patterns: string[];
  compliance_critical: boolean;
}

/** Category configuration applied at read time (spec §5.5 / §6). */
export interface CategoryConfig {
  uncovered_bucket_label: string;
  categories: CategoryDef[];
}

/** Zero-initialized coverage counts helper. */
export function emptyCounts(): CoverageCounts {
  return {
    lines_covered: 0,
    lines_total: 0,
    branches_covered: 0,
    branches_total: 0,
  };
}

/** Add `b` into `a` in place and return `a`. */
export function addCounts(a: CoverageCounts, b: CoverageCounts): CoverageCounts {
  a.lines_covered += b.lines_covered;
  a.lines_total += b.lines_total;
  a.branches_covered += b.branches_covered;
  a.branches_total += b.branches_total;
  return a;
}

/** Line coverage ratio in [0,1]; 0 when there are no lines. */
export function lineRatio(c: CoverageCounts): number {
  return c.lines_total === 0 ? 0 : c.lines_covered / c.lines_total;
}

/** Branch coverage ratio in [0,1]; 0 when there are no branches. */
export function branchRatio(c: CoverageCounts): number {
  return c.branches_total === 0 ? 0 : c.branches_covered / c.branches_total;
}
