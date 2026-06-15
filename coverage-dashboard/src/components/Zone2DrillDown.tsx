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

import { useMemo } from "react";
import type { CategoryConfig, Pull, Snapshot } from "../lib/schema.ts";
import {
  type Metric,
  attributeSnapshot,
  indexSnapshots,
} from "../lib/derive.ts";
import { labelForCategory } from "../lib/categories.ts";
import {
  fmtDateFull,
  fmtDurationHours,
  fmtPct,
  fmtSigned,
  fmtSignedPts,
  shortSession,
  shortSha,
} from "../lib/format.ts";
import { prUrl } from "../config.ts";
import { Badge, Button, Card, SectionHead, Stat } from "./primitives.tsx";

const VERDICT_TONE: Record<string, "good" | "signal" | "neutral"> = {
  approved: "good",
  changes_requested: "signal",
  commented: "neutral",
  none: "neutral",
};

export function Zone2DrillDown({
  snapshots,
  pulls,
  config,
  selectedSha,
  metric,
  onClear,
}: {
  snapshots: Snapshot[];
  pulls: Pull[];
  config: CategoryConfig;
  selectedSha: string | null;
  metric: Metric;
  onClear: () => void;
}) {
  const byId = useMemo(() => indexSnapshots(snapshots), [snapshots]);

  const snapshot = selectedSha ? byId.get(selectedSha) ?? null : null;
  const parent =
    snapshot && snapshot.parent_sha ? byId.get(snapshot.parent_sha) ?? null : null;
  const attribution = useMemo(
    () =>
      snapshot ? attributeSnapshot(snapshot, parent, config, metric) : null,
    [snapshot, parent, config, metric],
  );
  const pull =
    snapshot && snapshot.pr_number !== null
      ? pulls.find((p) => p.number === snapshot.pr_number) ?? null
      : null;

  if (!snapshot || !attribution) {
    return (
      <section className="section" id="zone-drill">
        <SectionHead eyebrow="Attribution" title="Select a merge">
          Per-file coverage delta for a merge, with PR and session links.
        </SectionHead>
        <Card>
          <p className="t-body muted">No merge selected.</p>
        </Card>
      </section>
    );
  }

  const cycleHours = pull?.merged_at
    ? (Date.parse(pull.merged_at) - Date.parse(pull.created_at)) / 3_600_000
    : null;

  return (
    <section className="section" id="zone-drill">
      <SectionHead
        eyebrow="Attribution"
        title={pull ? pull.title : `Merge ${shortSha(snapshot.commit_sha)}`}
      />

      <Card>
        <div className="row row--between row--wrap" style={{ gap: "var(--s-5)" }}>
          <div className="chips">
            {pull ? (
              <a className="badge badge--accent" href={prUrl(pull.number)} target="_blank" rel="noreferrer">
                PR #{pull.number}
              </a>
            ) : null}
            {pull?.session_url ? (
              <a className="badge" href={pull.session_url} target="_blank" rel="noreferrer">
                Devin session {shortSession(pull.session_url)}
              </a>
            ) : null}
            {pull ? (
              <Badge tone={VERDICT_TONE[pull.review_verdict]}>
                {pull.review_verdict.replace("_", " ")}
              </Badge>
            ) : null}
            {pull?.human_rework ? <Badge tone="signal">human rework</Badge> : null}
            {pull && pull.mutation_score !== null ? (
              <Badge tone="accent">
                mutation {fmtPct(pull.mutation_score * 100, 0)}
              </Badge>
            ) : null}
          </div>
          <Button onClick={onClear}>Clear selection</Button>
        </div>

        <div
          className="grid grid--4"
          style={{ marginTop: "var(--s-6)", marginBottom: "var(--s-2)" }}
        >
          <Stat
            label="Overall Δ"
            value={fmtSignedPts(attribution.pct_delta_overall)}
            tone={attribution.pct_delta_overall >= 0 ? "pos" : "neg"}
            sub={`${fmtSigned(attribution.lines_delta)} lines covered`}
          />
          <Stat
            label="Tests added"
            value={pull ? pull.tests_added_estimate : "—"}
            sub="estimated from diff"
          />
          <Stat
            label="Cycle time"
            value={cycleHours === null ? "—" : fmtDurationHours(cycleHours)}
            sub={pull ? `merged ${fmtDateFull(pull.merged_at ?? "")}` : ""}
          />
          <Stat
            label="Diff"
            value={pull ? `${fmtSigned(pull.additions)}` : "—"}
            sub={pull ? `${fmtSigned(-pull.deletions)} lines` : ""}
          />
        </div>
      </Card>

      <div className="card card--flush" style={{ marginTop: "var(--gutter)" }}>
        <table className="table">
          <thead>
            <tr>
              <th>File</th>
              <th>Categories</th>
              <th style={{ textAlign: "right" }}>Lines Δ</th>
              <th style={{ textAlign: "right" }}>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {attribution.files.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No per-file coverage change in this merge.
                </td>
              </tr>
            ) : (
              attribution.files.slice(0, 40).map((f) => {
                const beforePct =
                  f.before && f.before.lines_total > 0
                    ? (f.before.lines_covered / f.before.lines_total) * 100
                    : null;
                const afterPct =
                  f.after.lines_total > 0
                    ? (f.after.lines_covered / f.after.lines_total) * 100
                    : null;
                return (
                  <tr key={f.path}>
                    <td>
                      <span className="path">{f.path}</span>
                    </td>
                    <td>
                      <div className="chips">
                        {f.categories.length === 0 ? (
                          <span className="muted t-small">—</span>
                        ) : (
                          f.categories.map((c) => (
                            <Badge key={c} tone="accent">
                              {labelForCategory(c, config)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td
                      style={{ textAlign: "right" }}
                      className={
                        f.lines_delta >= 0 ? "num delta-pos" : "num delta-neg"
                      }
                    >
                      {fmtSigned(f.lines_delta)}
                    </td>
                    <td style={{ textAlign: "right" }} className="num">
                      {beforePct === null ? "new" : fmtPct(beforePct, 0)} →{" "}
                      {afterPct === null ? "—" : fmtPct(afterPct, 0)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
