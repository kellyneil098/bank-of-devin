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

import type {
  CategoryConfig,
  CoverageCounts,
  FileCoverage,
  Pull,
  ReviewVerdict,
  Snapshot,
} from "./schema.ts";
import { branchRatio, lineRatio } from "./schema.ts";
import {
  COMPLIANCE_CRITICAL_ID,
  UNCATEGORIZED_ID,
  aggregateByCategory,
  categoriesForPath,
} from "./categories.ts";

/**
 * Pure derived computations (spec §7, §8.x). Nothing here touches the network
 * or mutates inputs; the frontend renders these results directly.
 */

export type Metric = "line" | "branch";
/** Synthetic id for the overall (all-files) series. */
export const OVERALL_ID = "__overall__";

export function ratio(counts: CoverageCounts, metric: Metric): number {
  return metric === "line" ? lineRatio(counts) : branchRatio(counts);
}

export function pct(counts: CoverageCounts, metric: Metric): number {
  return ratio(counts, metric) * 100;
}

/** Coverage % per series id (overall + every category + synthetic buckets). */
export function seriesValuesForSnapshot(
  snapshot: Snapshot,
  config: CategoryConfig,
  metric: Metric,
): Record<string, number> {
  const out: Record<string, number> = {
    [OVERALL_ID]: pct(snapshot.totals, metric),
  };
  for (const slice of aggregateByCategory(snapshot.files, config)) {
    out[slice.id] = pct(slice.counts, metric);
  }
  return out;
}

export interface TimePoint {
  /** ISO calendar day (daily mode) or full timestamp (merge mode). */
  key: string;
  /** YYYY-MM-DD label. */
  day: string;
  timestamp: string;
  commit_sha: string;
  pr_number: number | null;
  trigger: Snapshot["trigger"];
  /** Coverage % per series id. */
  series: Record<string, number>;
  /** Overall coverage % delta vs the previous point. */
  delta: number | null;
  /** Number of merge snapshots represented by this point. */
  prsMerged: number;
  /** PR numbers merged at/within this point. */
  prNumbers: number[];
}

function dayOf(timestamp: string): string {
  return timestamp.slice(0, 10);
}

/**
 * Build the time series for the hero chart (spec §8.3, §7).
 *
 * - "merge" mode: one point per snapshot, in timestamp order.
 * - "daily" mode: one point per calendar day = the LAST snapshot of that day;
 *   the day delta is last-of-day minus last-of-prior-day.
 */
export function buildTimeSeries(
  snapshots: Snapshot[],
  config: CategoryConfig,
  metric: Metric,
  mode: "daily" | "merge",
): TimePoint[] {
  const ordered = [...snapshots].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );

  const makePoint = (s: Snapshot, prNumbers: number[]): TimePoint => ({
    key: mode === "daily" ? dayOf(s.timestamp) : s.commit_sha,
    day: dayOf(s.timestamp),
    timestamp: s.timestamp,
    commit_sha: s.commit_sha,
    pr_number: s.pr_number,
    trigger: s.trigger,
    series: seriesValuesForSnapshot(s, config, metric),
    delta: null,
    prsMerged: prNumbers.length,
    prNumbers,
  });

  let points: TimePoint[];
  if (mode === "merge") {
    points = ordered.map((s) =>
      makePoint(s, s.pr_number !== null ? [s.pr_number] : []),
    );
  } else {
    const byDay = new Map<string, Snapshot[]>();
    for (const s of ordered) {
      const d = dayOf(s.timestamp);
      const arr = byDay.get(d) ?? [];
      arr.push(s);
      byDay.set(d, arr);
    }
    points = [...byDay.keys()]
      .sort()
      .map((d) => {
        const daySnaps = byDay.get(d)!;
        const last = daySnaps[daySnaps.length - 1];
        const prNumbers = daySnaps
          .filter((s) => s.trigger === "merge" && s.pr_number !== null)
          .map((s) => s.pr_number as number);
        return makePoint(last, prNumbers);
      });
  }

  for (let i = 0; i < points.length; i++) {
    const prev = points[i - 1];
    points[i].delta =
      prev === undefined
        ? null
        : points[i].series[OVERALL_ID] - prev.series[OVERALL_ID];
  }
  return points;
}

export interface FileDelta {
  path: string;
  language: FileCoverage["language"];
  before: CoverageCounts | null;
  after: CoverageCounts;
  lines_delta: number;
  branches_delta: number;
  categories: string[];
}

export interface Attribution {
  commit_sha: string;
  parent_sha: string | null;
  pr_number: number | null;
  lines_delta: number;
  branches_delta: number;
  pct_delta_overall: number;
  files: FileDelta[];
}

/**
 * Exact per-merge attribution (spec §7): contribution = snapshot.totals minus
 * the parent snapshot's totals, with a per-file delta join on path. The parent
 * is looked up by commit_sha === snapshot.parent_sha. A first/baseline snapshot
 * (no parent found) attributes its full coverage as the delta.
 */
export function attributeSnapshot(
  snapshot: Snapshot,
  parent: Snapshot | null,
  config: CategoryConfig,
  metric: Metric = "line",
): Attribution {
  const parentFiles = new Map<string, FileCoverage>();
  if (parent) for (const f of parent.files) parentFiles.set(f.path, f);

  const seen = new Set<string>();
  const files: FileDelta[] = [];

  for (const after of snapshot.files) {
    seen.add(after.path);
    const before = parentFiles.get(after.path) ?? null;
    const lines_delta =
      after.lines_covered - (before ? before.lines_covered : 0);
    const branches_delta =
      after.branches_covered - (before ? before.branches_covered : 0);
    if (lines_delta !== 0 || branches_delta !== 0 || before === null) {
      files.push({
        path: after.path,
        language: after.language,
        before: before
          ? {
              lines_covered: before.lines_covered,
              lines_total: before.lines_total,
              branches_covered: before.branches_covered,
              branches_total: before.branches_total,
            }
          : null,
        after: {
          lines_covered: after.lines_covered,
          lines_total: after.lines_total,
          branches_covered: after.branches_covered,
          branches_total: after.branches_total,
        },
        lines_delta,
        branches_delta,
        categories: categoriesForPath(after.path, config),
      });
    }
  }

  // Deleted files (present in parent, absent now) → coverage drops to 0.
  if (parent) {
    for (const before of parent.files) {
      if (seen.has(before.path)) continue;
      files.push({
        path: before.path,
        language: before.language,
        before: {
          lines_covered: before.lines_covered,
          lines_total: before.lines_total,
          branches_covered: before.branches_covered,
          branches_total: before.branches_total,
        },
        after: {
          lines_covered: 0,
          lines_total: 0,
          branches_covered: 0,
          branches_total: 0,
        },
        lines_delta: -before.lines_covered,
        branches_delta: -before.branches_covered,
        categories: categoriesForPath(before.path, config),
      });
    }
  }

  files.sort((a, b) => Math.abs(b.lines_delta) - Math.abs(a.lines_delta));

  const parentTotals = parent ? parent.totals : null;
  const pctNow = pct(snapshot.totals, metric);
  const pctBefore = parentTotals ? pct(parentTotals, metric) : 0;

  return {
    commit_sha: snapshot.commit_sha,
    parent_sha: snapshot.parent_sha,
    pr_number: snapshot.pr_number,
    lines_delta:
      snapshot.totals.lines_covered - (parentTotals?.lines_covered ?? 0),
    branches_delta:
      snapshot.totals.branches_covered - (parentTotals?.branches_covered ?? 0),
    pct_delta_overall: pctNow - pctBefore,
    files,
  };
}

/** Index snapshots by commit_sha for parent lookups. */
export function indexSnapshots(snapshots: Snapshot[]): Map<string, Snapshot> {
  const m = new Map<string, Snapshot>();
  for (const s of snapshots) m.set(s.commit_sha, s);
  return m;
}

export interface AggregateStats {
  prsOpened: number;
  prsMerged: number;
  mergeRate: number;
  testsAddedTotal: number;
  linesAdded: number;
  linesDeleted: number;
  medianCycleTimeHours: number | null;
  humanReworkRate: number;
  reviewOutcomes: Record<ReviewVerdict, number>;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Aggregate header metrics over the pull set (spec §8.5). */
export function aggregateStats(pulls: Pull[]): AggregateStats {
  const merged = pulls.filter((p) => p.merged_at !== null);
  const reviewOutcomes: Record<ReviewVerdict, number> = {
    approved: 0,
    changes_requested: 0,
    commented: 0,
    none: 0,
  };
  for (const p of pulls) reviewOutcomes[p.review_verdict] += 1;

  const cycleTimes: number[] = [];
  for (const p of merged) {
    if (p.merged_at) {
      const hrs =
        (Date.parse(p.merged_at) - Date.parse(p.created_at)) / 3_600_000;
      if (Number.isFinite(hrs) && hrs >= 0) cycleTimes.push(hrs);
    }
  }

  return {
    prsOpened: pulls.length,
    prsMerged: merged.length,
    mergeRate: pulls.length === 0 ? 0 : merged.length / pulls.length,
    testsAddedTotal: merged.reduce((n, p) => n + p.tests_added_estimate, 0),
    linesAdded: merged.reduce((n, p) => n + p.additions, 0),
    linesDeleted: merged.reduce((n, p) => n + p.deletions, 0),
    medianCycleTimeHours: median(cycleTimes),
    humanReworkRate:
      merged.length === 0
        ? 0
        : merged.filter((p) => p.human_rework).length / merged.length,
    reviewOutcomes,
  };
}

export interface BurndownPoint {
  day: string;
  timestamp: string;
  remaining: number;
}

/**
 * Burndown of remaining uncovered compliance-critical lines over time
 * (spec §8.6). "daily" rolls up to the last snapshot of each calendar day;
 * "merge" keeps one point per snapshot (used when every merge lands on a
 * single day, where a daily rollup would collapse to one point).
 */
export function complianceBurndown(
  snapshots: Snapshot[],
  config: CategoryConfig,
  mode: "daily" | "merge" = "daily",
): BurndownPoint[] {
  const ordered = [...snapshots].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  const remainingFor = (s: Snapshot): number => {
    const slice = aggregateByCategory(s.files, config).find(
      (x) => x.id === COMPLIANCE_CRITICAL_ID,
    )!;
    return slice.counts.lines_total - slice.counts.lines_covered;
  };
  if (mode === "merge") {
    return ordered.map((s) => ({
      day: dayOf(s.timestamp),
      timestamp: s.timestamp,
      remaining: remainingFor(s),
    }));
  }
  const byDay = new Map<string, Snapshot>();
  for (const s of ordered) byDay.set(dayOf(s.timestamp), s); // last wins
  return [...byDay.keys()].sort().map((day) => {
    const s = byDay.get(day)!;
    return { day, timestamp: s.timestamp, remaining: remainingFor(s) };
  });
}

export interface LinearFit {
  slope: number;
  intercept: number;
}

/** Ordinary least-squares fit of y over x (spec §8.6 trajectory). */
export function linearFit(points: { x: number; y: number }[]): LinearFit | null {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

export interface Projection {
  fit: LinearFit | null;
  /** Coverage % per day going forward, keyed by day, until the deadline. */
  projectedAtDeadline: number | null;
  /** Day (YYYY-MM-DD) the series is projected to reach `targetPct`, or null. */
  etaToTarget: string | null;
  targetPct: number;
}

const DAY_MS = 86_400_000;

/**
 * Linear-fit projection of compliance-critical coverage toward the exam
 * deadline (spec §8.6). x is measured in days since the first snapshot.
 */
export function projectCompliance(
  snapshots: Snapshot[],
  config: CategoryConfig,
  metric: Metric,
  deadlineIso: string,
  targetPct: number,
): Projection {
  const ordered = [...snapshots].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  if (ordered.length === 0) {
    return { fit: null, projectedAtDeadline: null, etaToTarget: null, targetPct };
  }
  const t0 = Date.parse(ordered[0].timestamp);
  const byDay = new Map<string, Snapshot>();
  for (const s of ordered) byDay.set(dayOf(s.timestamp), s);
  const pts = [...byDay.values()].map((s) => {
    const slice = aggregateByCategory(s.files, config).find(
      (x) => x.id === COMPLIANCE_CRITICAL_ID,
    )!;
    return {
      x: (Date.parse(s.timestamp) - t0) / DAY_MS,
      y: pct(slice.counts, metric),
    };
  });

  const fit = linearFit(pts);
  if (!fit) {
    return { fit, projectedAtDeadline: null, etaToTarget: null, targetPct };
  }
  const deadlineX = (Date.parse(deadlineIso) - t0) / DAY_MS;
  const projectedAtDeadline = fit.slope * deadlineX + fit.intercept;
  let etaToTarget: string | null = null;
  if (fit.slope > 0) {
    const xTarget = (targetPct - fit.intercept) / fit.slope;
    etaToTarget = new Date(t0 + xTarget * DAY_MS).toISOString().slice(0, 10);
  }
  return { fit, projectedAtDeadline, etaToTarget, targetPct };
}

export { COMPLIANCE_CRITICAL_ID, UNCATEGORIZED_ID };
