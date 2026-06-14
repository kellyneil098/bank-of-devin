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

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryConfig, Snapshot } from "../lib/schema.ts";
import {
  COMPLIANCE_CRITICAL_ID,
  OVERALL_ID,
  UNCATEGORIZED_ID,
  type Metric,
  type TimePoint,
  buildTimeSeries,
  projectCompliance,
} from "../lib/derive.ts";
import { labelForCategory } from "../lib/categories.ts";
import { type Palette, seriesStyle } from "../lib/theme.ts";
import { fmtDate, fmtDateFull, fmtPct, fmtSignedPts } from "../lib/format.ts";
import { SectionHead, SegToggle } from "./primitives.tsx";
import { COVERAGE_TARGET_PCT, EXAM_DATE } from "../config.ts";

interface SeriesMeta {
  id: string;
  label: string;
  categoryIndex: number;
}

type ChartRow = Record<string, number | string | null | TimePoint>;

export function Zone1Hero({
  snapshots,
  config,
  palette,
  metric,
  onSelectPoint,
  selectedSha,
}: {
  snapshots: Snapshot[];
  config: CategoryConfig;
  palette: Palette;
  metric: Metric;
  onSelectPoint: (commitSha: string) => void;
  selectedSha: string | null;
}) {
  const [mode, setMode] = useState<"daily" | "merge">("daily");
  const [showProjection, setShowProjection] = useState(true);

  const allSeries: SeriesMeta[] = useMemo(() => {
    const out: SeriesMeta[] = [
      { id: OVERALL_ID, label: "Overall", categoryIndex: -1 },
      {
        id: COMPLIANCE_CRITICAL_ID,
        label: "Compliance-critical",
        categoryIndex: -1,
      },
    ];
    config.categories.forEach((c, i) =>
      out.push({ id: c.id, label: c.label, categoryIndex: i }),
    );
    return out;
  }, [config]);

  const [visible, setVisible] = useState<Set<string>>(
    () => new Set([OVERALL_ID, COMPLIANCE_CRITICAL_ID]),
  );

  const points = useMemo(
    () => buildTimeSeries(snapshots, config, metric, mode),
    [snapshots, config, metric, mode],
  );

  const projection = useMemo(
    () =>
      projectCompliance(
        snapshots,
        config,
        metric,
        EXAM_DATE,
        COVERAGE_TARGET_PCT,
      ),
    [snapshots, config, metric],
  );

  const deadlineMs = Date.parse(EXAM_DATE);

  const data: ChartRow[] = useMemo(() => {
    const rows: ChartRow[] = points.map((pt) => {
      const row: ChartRow = {
        t: Date.parse(pt.timestamp),
        day: pt.day,
        __point: pt,
      };
      for (const s of allSeries) row[s.id] = pt.series[s.id] ?? null;
      return row;
    });
    if (showProjection && projection.projectedAtDeadline !== null && rows.length) {
      const last = points[points.length - 1];
      const lastVal = last.series[COMPLIANCE_CRITICAL_ID];
      (rows[rows.length - 1] as ChartRow).__projection = lastVal;
      rows.push({
        t: deadlineMs,
        day: fmtDate(EXAM_DATE),
        __projection: Math.min(100, projection.projectedAtDeadline),
        __point: last,
      });
    }
    return rows;
  }, [points, allSeries, showProjection, projection, deadlineMs]);

  const toggleSeries = (id: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const labelFor = (id: string) => {
    if (id === OVERALL_ID) return "Overall";
    return labelForCategory(id, config);
  };

  return (
    <section className="section" id="zone-hero">
      <SectionHead
        eyebrow="Coverage over time"
        title="Test coverage is climbing toward the exam bar"
      >
        Each point is a measured snapshot. Click any point to see exactly which
        merge moved the line and by how much.
      </SectionHead>

      <div className="controls" style={{ marginBottom: "var(--s-5)" }}>
        <div className="row">
          <span className="field-label">X axis</span>
          <SegToggle
            ariaLabel="X axis rollup"
            options={[
              { value: "daily", label: "Daily" },
              { value: "merge", label: "Per merge" },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>
        <div className="row">
          <span className="field-label">Projection</span>
          <SegToggle
            ariaLabel="Projection"
            options={[
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
            value={showProjection ? "on" : "off"}
            onChange={(v) => setShowProjection(v === "on")}
          />
        </div>
      </div>

      <div className="chips" style={{ marginBottom: "var(--s-4)" }}>
        <span className="field-label">Series</span>
        {allSeries.map((s) => {
          const style = seriesStyle(s.id, Math.max(0, s.categoryIndex), palette);
          const on = visible.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className="chip"
              aria-pressed={on}
              onClick={() => toggleSeries(s.id)}
            >
              <span
                className="chip__swatch"
                style={{ background: on ? style.stroke : "var(--ink-4)" }}
              />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 24, bottom: 8, left: 0 }}
              onClick={(state) => {
                const payload = state?.activePayload?.[0]?.payload as
                  | ChartRow
                  | undefined;
                const pt = payload?.__point as TimePoint | undefined;
                if (pt && pt.pr_number !== null) onSelectPoint(pt.commit_sha);
              }}
            >
              <CartesianGrid stroke={palette.ruleSoft} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", deadlineMs]}
                tickFormatter={(t: number) => fmtDate(new Date(t).toISOString())}
                stroke={palette.ink3}
                tick={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fill: palette.ink3,
                }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                stroke={palette.ink3}
                tick={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fill: palette.ink3,
                }}
                tickLine={false}
                width={48}
              />
              <Tooltip
                content={(p) => (
                  <HeroTooltip
                    active={p.active}
                    payload={
                      p.payload as unknown as { payload: ChartRow }[] | undefined
                    }
                    visible={visible}
                    labelFor={labelFor}
                  />
                )}
              />

              <ReferenceLine
                y={COVERAGE_TARGET_PCT}
                stroke={palette.ink4}
                strokeDasharray="4 4"
                label={{
                  value: `Exam bar ${COVERAGE_TARGET_PCT}%`,
                  position: "insideTopRight",
                  fill: palette.ink3,
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                }}
              />
              <ReferenceLine
                x={deadlineMs}
                stroke={palette.signal0}
                strokeDasharray="3 3"
                label={{
                  value: `Exam ${fmtDateFull(EXAM_DATE)}`,
                  position: "insideTopLeft",
                  fill: palette.signal0,
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                }}
              />

              {allSeries
                .filter((s) => visible.has(s.id))
                .map((s) => {
                  const style = seriesStyle(
                    s.id,
                    Math.max(0, s.categoryIndex),
                    palette,
                  );
                  return (
                    <Line
                      key={s.id}
                      type="monotone"
                      dataKey={s.id}
                      stroke={style.stroke}
                      strokeWidth={style.strokeWidth}
                      strokeDasharray={style.strokeDasharray}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  );
                })}

              {showProjection && (
                <Line
                  type="linear"
                  dataKey="__projection"
                  stroke={palette.accent1}
                  strokeWidth={1.5}
                  strokeDasharray="2 4"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ProjectionReadout projection={projection} />
        {selectedSha ? null : (
          <p className="t-small muted" style={{ marginTop: "var(--s-3)" }}>
            ■ Tip: click a merge point to open its attribution below.
          </p>
        )}
      </div>
    </section>
  );
}

function ProjectionReadout({
  projection,
}: {
  projection: ReturnType<typeof projectCompliance>;
}) {
  if (!projection.fit) return null;
  const ratePerDay = projection.fit.slope;
  const eta = projection.etaToTarget;
  const onTrack =
    eta !== null && Date.parse(eta) <= Date.parse(EXAM_DATE) && ratePerDay > 0;
  return (
    <div className="legend">
      <span className="t-small muted">
        Compliance-critical trajectory:{" "}
        <span className="num">{fmtSignedPts(ratePerDay)}</span> / day.
      </span>
      <span className="t-small muted">
        Projected at exam:{" "}
        <span className="num">
          {projection.projectedAtDeadline === null
            ? "—"
            : fmtPct(Math.min(100, projection.projectedAtDeadline))}
        </span>
      </span>
      <span className="t-small">
        {eta ? (
          <span className={onTrack ? "delta-pos num" : "delta-neg num"}>
            {onTrack ? "On track — " : "At risk — "}
            reaches {projection.targetPct}% by {fmtDateFull(eta)}
          </span>
        ) : (
          <span className="delta-neg">Not on track to reach target</span>
        )}
      </span>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  visible: Set<string>;
  labelFor: (id: string) => string;
}

function HeroTooltip({ active, payload, visible, labelFor }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const pt = row.__point as TimePoint | undefined;
  if (!pt) return null;
  const ids = [OVERALL_ID, COMPLIANCE_CRITICAL_ID, UNCATEGORIZED_ID].concat(
    Object.keys(pt.series),
  );
  const seen = new Set<string>();
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__title">{fmtDateFull(pt.timestamp)}</div>
      {ids
        .filter((id) => visible.has(id) && !seen.has(id) && seen.add(id))
        .map((id) => (
          <div className="chart-tooltip__row" key={id}>
            <span className="muted">{labelFor(id)}</span>
            <span className="num">{fmtPct(pt.series[id] ?? 0)}</span>
          </div>
        ))}
      <div className="chart-tooltip__row">
        <span className="muted">Overall Δ</span>
        <span
          className={
            (pt.delta ?? 0) >= 0 ? "num delta-pos" : "num delta-neg"
          }
        >
          {pt.delta === null ? "—" : fmtSignedPts(pt.delta)}
        </span>
      </div>
      <div className="chart-tooltip__row">
        <span className="muted">PRs merged</span>
        <span className="num">{pt.prsMerged}</span>
      </div>
    </div>
  );
}
