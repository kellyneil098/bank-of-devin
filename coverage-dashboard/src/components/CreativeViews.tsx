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
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryConfig, Pull, Snapshot } from "../lib/schema.ts";
import { complianceBurndown } from "../lib/derive.ts";
import { fmtDate, fmtDateFull, fmtInt, fmtPct } from "../lib/format.ts";
import { type Palette } from "../lib/theme.ts";
import { Card, SectionHead } from "./primitives.tsx";

export function CreativeViews({
  snapshots,
  pulls,
  config,
  palette,
}: {
  snapshots: Snapshot[];
  pulls: Pull[];
  config: CategoryConfig;
  palette: Palette;
}) {
  const singleDay = useMemo(
    () => new Set(snapshots.map((s) => s.timestamp.slice(0, 10))).size < 2,
    [snapshots],
  );
  const burndown = useMemo(
    () => complianceBurndown(snapshots, config, singleDay ? "merge" : "daily"),
    [snapshots, config, singleDay],
  );
  const burndownData = burndown.map((b) => ({
    t: Date.parse(b.timestamp),
    remaining: b.remaining,
  }));
  const startRemaining = burndown.length ? burndown[0].remaining : 0;
  const nowRemaining = burndown.length
    ? burndown[burndown.length - 1].remaining
    : 0;
  const burnedDown = startRemaining - nowRemaining;

  const mutated = useMemo(
    () => pulls.filter((p) => p.mutation_score !== null),
    [pulls],
  );

  return (
    <>
      <section className="section" id="zone-burndown">
        <SectionHead
          eyebrow="Coverage debt"
          title="Uncovered compliance-critical lines"
          signal
        >
          Compliance-critical lines with no covering test. Lower is safer.
        </SectionHead>
        <Card>
          <div className="chart-wrap" style={{ height: "280px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={burndownData}
                margin={{ top: 8, right: 24, bottom: 8, left: 0 }}
              >
                <CartesianGrid stroke={palette.ruleSoft} vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t: number) =>
                    fmtDate(new Date(t).toISOString())
                  }
                  stroke={palette.ink3}
                  tick={{ fontFamily: "var(--font-mono)", fontSize: 12, fill: palette.ink3 }}
                  tickLine={false}
                />
                <YAxis
                  stroke={palette.ink3}
                  tick={{ fontFamily: "var(--font-mono)", fontSize: 12, fill: palette.ink3 }}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v: number) => fmtInt(v)}
                />
                <Tooltip
                  formatter={(v: number) => [fmtInt(v), "uncovered lines"]}
                  labelFormatter={(t: number) =>
                    fmtDateFull(new Date(t).toISOString())
                  }
                  contentStyle={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "13px",
                    border: "1px solid var(--rule-soft)",
                    borderRadius: "var(--r-2)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="remaining"
                  stroke={palette.signal0}
                  strokeWidth={2}
                  fill={palette.signal1}
                  fillOpacity={0.16}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="t-small muted" style={{ marginTop: "var(--s-3)" }}>
            {burnedDown >= 0 ? (
              <>
                ■ Burned down{" "}
                <span className="num delta-pos">{fmtInt(burnedDown)}</span>{" "}
                uncovered lines since first merge
              </>
            ) : (
              <>
                ■ Added{" "}
                <span className="num delta-neg">{fmtInt(-burnedDown)}</span>{" "}
                uncovered lines since first merge
              </>
            )}{" "}
            · <span className="num">{fmtInt(nowRemaining)}</span> still uncovered.
          </p>
        </Card>
      </section>

      {mutated.length > 0 ? (
        <section className="section" id="zone-mutation">
          <SectionHead eyebrow="Mutation testing" title="Mutation score">
            Shown only for PRs that recorded a score.
          </SectionHead>
          <div className="grid grid--3">
            {mutated.map((p) => (
              <Card key={p.number}>
                <p className="stat__label">PR #{p.number}</p>
                <div className="stat__value num">
                  {fmtPct((p.mutation_score ?? 0) * 100, 0)}
                </div>
                <p className="t-small muted" style={{ marginTop: "var(--s-2)" }}>
                  {p.title}
                </p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
