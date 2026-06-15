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
import type { Pull, ReviewVerdict } from "../lib/schema.ts";
import { aggregateStats } from "../lib/derive.ts";
import {
  fmtDurationHours,
  fmtInt,
  fmtPct,
  fmtSigned,
} from "../lib/format.ts";
import { MINUTES_SAVED_PER_TEST } from "../config.ts";
import { Card, SectionHead, Stat } from "./primitives.tsx";

const VERDICT_LABEL: Record<ReviewVerdict, string> = {
  approved: "Approved",
  changes_requested: "Changes requested",
  commented: "Commented",
  none: "No review",
};

const VERDICT_COLOR: Record<ReviewVerdict, string> = {
  approved: "var(--good-0)",
  changes_requested: "var(--signal-0)",
  commented: "var(--ink-3)",
  none: "var(--ink-4)",
};

export function Zone3Aggregate({ pulls }: { pulls: Pull[] }) {
  const stats = useMemo(() => aggregateStats(pulls), [pulls]);
  const minutesSaved = stats.testsAddedTotal * MINUTES_SAVED_PER_TEST;
  const verdictTotal =
    Object.values(stats.reviewOutcomes).reduce((a, b) => a + b, 0) || 1;

  return (
    <section className="section" id="zone-aggregate">
      <SectionHead eyebrow="Program health" title="Aggregate outcomes">
        All PRs opened in this window.
      </SectionHead>

      <div className="grid grid--4">
        <Card>
          <Stat
            label="PRs merged"
            value={fmtInt(stats.prsMerged)}
            sub={`${fmtInt(stats.prsOpened)} opened · ${fmtPct(
              stats.mergeRate * 100,
              0,
            )} merge rate`}
          />
        </Card>
        <Card>
          <Stat
            label="Tests added"
            value={fmtInt(stats.testsAddedTotal)}
            sub="estimated across merged PRs"
          />
        </Card>
        <Card>
          <Stat
            label="Median cycle time"
            value={
              stats.medianCycleTimeHours === null
                ? "—"
                : fmtDurationHours(stats.medianCycleTimeHours)
            }
            sub="open → merge"
          />
        </Card>
        <Card>
          <Stat
            label="Human rework rate"
            value={fmtPct(stats.humanReworkRate * 100, 0)}
            tone={stats.humanReworkRate > 0.25 ? "neg" : undefined}
            sub="merged PRs needing human commits"
          />
        </Card>
      </div>

      <div className="grid grid--3" style={{ marginTop: "var(--gutter)" }}>
        <Card>
          <Stat
            label="Lines of code"
            value={fmtSigned(stats.linesAdded)}
            sub={`${fmtSigned(-stats.linesDeleted)} removed`}
          />
        </Card>
        <Card>
          <Stat
            label="Analyst time saved"
            value={fmtDurationHours(minutesSaved / 60)}
            sub={`${fmtInt(stats.testsAddedTotal)} tests × ${MINUTES_SAVED_PER_TEST}m each`}
          />
        </Card>
        <Card>
          <p className="stat__label">Review outcomes</p>
          <div className="stack" style={{ marginTop: "var(--s-3)" }}>
            {(Object.keys(stats.reviewOutcomes) as ReviewVerdict[]).map((v) => {
              const n = stats.reviewOutcomes[v];
              const widthPct = (n / verdictTotal) * 100;
              return (
                <div key={v}>
                  <div className="row row--between">
                    <span className="t-small">{VERDICT_LABEL[v]}</span>
                    <span className="num t-small">{fmtInt(n)}</span>
                  </div>
                  <div
                    style={{
                      height: "6px",
                      background: "var(--paper-2)",
                      borderRadius: "var(--r-1)",
                      marginTop: "var(--s-1)",
                    }}
                  >
                    <div
                      style={{
                        width: `${widthPct}%`,
                        height: "100%",
                        background: VERDICT_COLOR[v],
                        borderRadius: "var(--r-1)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </section>
  );
}
