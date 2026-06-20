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

import { describe, expect, it } from "vitest";
import type {
  CategoryConfig,
  FileCoverage,
  Pull,
  Snapshot,
} from "../src/lib/schema.ts";
import {
  aggregateStats,
  attributeSnapshot,
  buildTimeSeries,
  linearFit,
  projectCompliance,
} from "../src/lib/derive.ts";

const config: CategoryConfig = {
  uncovered_bucket_label: "Uncategorized",
  categories: [
    {
      id: "auth",
      label: "Auth",
      description: "",
      patterns: ["**/userservice/**"],
      compliance_critical: true,
    },
  ],
};

function file(
  path: string,
  lines_covered: number,
  lines_total: number,
): FileCoverage {
  return {
    path,
    language: path.endsWith(".py") ? "python" : "java",
    lines_covered,
    lines_total,
    branches_covered: 0,
    branches_total: 0,
  };
}

function snapshot(
  commit_sha: string,
  parent_sha: string | null,
  timestamp: string,
  files: FileCoverage[],
  pr_number: number | null,
): Snapshot {
  const totals = files.reduce(
    (acc, f) => ({
      lines_covered: acc.lines_covered + f.lines_covered,
      lines_total: acc.lines_total + f.lines_total,
      branches_covered: 0,
      branches_total: 0,
    }),
    { lines_covered: 0, lines_total: 0, branches_covered: 0, branches_total: 0 },
  );
  return {
    commit_sha,
    parent_sha,
    timestamp,
    trigger: pr_number === null ? "daily" : "merge",
    pr_number,
    totals,
    files,
  };
}

const AUTH = "src/accounts/userservice/userservice.py";

describe("attributeSnapshot", () => {
  it("computes exact per-merge deltas joined on path", () => {
    const parent = snapshot("p", null, "2026-06-01T00:00:00Z", [file(AUTH, 5, 10)], null);
    const child = snapshot(
      "c",
      "p",
      "2026-06-02T00:00:00Z",
      [file(AUTH, 9, 10), file("src/accounts/userservice/db.py", 4, 4)],
      9,
    );
    const attr = attributeSnapshot(child, parent, config);
    expect(attr.lines_delta).toBe(8); // (9-5) + (4-0)
    expect(attr.pct_delta_overall).toBeCloseTo((13 / 14) * 100 - 50, 5);

    const authDelta = attr.files.find((f) => f.path === AUTH)!;
    expect(authDelta.lines_delta).toBe(4);
    expect(authDelta.before).not.toBeNull();
    expect(authDelta.categories).toContain("auth");

    const newFile = attr.files.find((f) => f.path.endsWith("db.py"))!;
    expect(newFile.before).toBeNull();
    expect(newFile.lines_delta).toBe(4);
  });

  it("treats the first snapshot as a baseline (no parent)", () => {
    const first = snapshot("p", null, "2026-06-01T00:00:00Z", [file(AUTH, 5, 10)], null);
    const attr = attributeSnapshot(first, null, config);
    expect(attr.lines_delta).toBe(5);
    expect(attr.pct_delta_overall).toBeCloseTo(50, 5);
  });
});

describe("buildTimeSeries", () => {
  const s0 = snapshot("a", null, "2026-06-01T09:00:00Z", [file(AUTH, 5, 10)], null);
  const s1 = snapshot("b", "a", "2026-06-02T09:00:00Z", [file(AUTH, 7, 10)], 9);

  it("daily mode yields a point per day with day-over-day delta", () => {
    const pts = buildTimeSeries([s0, s1], config, "line", "daily");
    expect(pts).toHaveLength(2);
    expect(pts[0].delta).toBeNull();
    expect(pts[1].delta).toBeCloseTo(20, 5); // 70% - 50%
    expect(pts[1].prsMerged).toBe(1);
  });

  it("merge mode yields only PR-associated snapshots", () => {
    const pts = buildTimeSeries([s0, s1], config, "line", "merge");
    expect(pts.map((p) => p.commit_sha)).toEqual(["b"]);
    expect(pts[0].pr_number).toBe(9);
    expect(pts[0].delta).toBeNull();
  });
});

describe("aggregateStats", () => {
  function pull(partial: Partial<Pull> & { number: number }): Pull {
    return {
      title: `PR ${partial.number}`,
      branch: "b",
      created_at: "2026-06-01T00:00:00Z",
      merged_at: null,
      merge_commit_sha: null,
      author: "devin-ai-integration[bot]",
      additions: 0,
      deletions: 0,
      files_changed: [],
      tests_added_estimate: 0,
      session_url: null,
      reviews: [],
      review_verdict: "none",
      human_rework: false,
      mutation_score: null,
      ...partial,
    };
  }

  it("aggregates merge rate, tests, rework and review outcomes", () => {
    const pulls: Pull[] = [
      pull({
        number: 1,
        merged_at: "2026-06-01T02:00:00Z",
        review_verdict: "approved",
        tests_added_estimate: 5,
        additions: 100,
      }),
      pull({
        number: 2,
        merged_at: "2026-06-01T04:00:00Z",
        review_verdict: "changes_requested",
        tests_added_estimate: 3,
        additions: 50,
        deletions: 10,
        human_rework: true,
      }),
      pull({ number: 3 }), // unmerged
    ];
    const stats = aggregateStats(pulls);
    expect(stats.prsOpened).toBe(3);
    expect(stats.prsMerged).toBe(2);
    expect(stats.mergeRate).toBeCloseTo(2 / 3, 5);
    expect(stats.testsAddedTotal).toBe(8);
    expect(stats.linesAdded).toBe(150);
    expect(stats.linesDeleted).toBe(10);
    expect(stats.humanReworkRate).toBeCloseTo(0.5, 5);
    expect(stats.medianCycleTimeHours).toBeCloseTo(3, 5); // (2h + 4h) / 2
    expect(stats.reviewOutcomes.approved).toBe(1);
    expect(stats.reviewOutcomes.changes_requested).toBe(1);
    expect(stats.reviewOutcomes.none).toBe(1);
  });
});

describe("linearFit & projectCompliance", () => {
  it("fits a straight line", () => {
    const fit = linearFit([
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 2, y: 4 },
    ])!;
    expect(fit.slope).toBeCloseTo(2, 5);
    expect(fit.intercept).toBeCloseTo(0, 5);
  });

  it("projects compliance coverage to the deadline and target", () => {
    const s0 = snapshot("a", null, "2026-06-01T00:00:00Z", [file(AUTH, 5, 10)], null);
    const s1 = snapshot("b", "a", "2026-06-02T00:00:00Z", [file(AUTH, 6, 10)], 9);
    const proj = projectCompliance(
      [s0, s1],
      config,
      "line",
      "2026-06-05T00:00:00Z",
      90,
    );
    // slope 10 pts/day, intercept 50 → reaches 90% on day 4 (2026-06-05).
    expect(proj.fit!.slope).toBeCloseTo(10, 5);
    expect(proj.projectedAtDeadline).toBeCloseTo(90, 5);
    expect(proj.etaToTarget).toBe("2026-06-05");
  });
});
