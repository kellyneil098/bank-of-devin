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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dataset } from "./lib/dataLoader.ts";
import { loadDataset } from "./lib/dataLoader.ts";
import { COMPLIANCE_CRITICAL_ID, type Metric, pct } from "./lib/derive.ts";
import { aggregateByCategory } from "./lib/categories.ts";
import { readPalette } from "./lib/theme.ts";
import {
  COVERAGE_TARGET_PCT,
  DEFAULT_METRIC,
  EXAM_DATE,
  RAW_DATA_BASE_URL,
  REPO_NAME,
  REPO_OWNER,
} from "./config.ts";
import {
  fmtDateFull,
  fmtInt,
  fmtPct,
} from "./lib/format.ts";
import { Badge, Button, SegToggle, Stat } from "./components/primitives.tsx";
import { Zone1Hero } from "./components/Zone1Hero.tsx";
import { Zone2DrillDown } from "./components/Zone2DrillDown.tsx";
import { Zone3Aggregate } from "./components/Zone3Aggregate.tsx";
import { ActivityFeed } from "./components/ActivityFeed.tsx";
import { CreativeViews } from "./components/CreativeViews.tsx";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; dataset: Dataset };

export default function App() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [metric, setMetric] = useState<Metric>(DEFAULT_METRIC);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [source, setSource] = useState<"bundled" | "live">("bundled");
  const [refreshing, setRefreshing] = useState(false);
  const [palette, setPalette] = useState(() => readPalette());
  const drillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPalette(readPalette());
    const ctrl = new AbortController();
    loadDataset(import.meta.env.BASE_URL, ctrl.signal)
      .then((dataset) => setState({ kind: "ready", dataset }))
      .catch((err: unknown) =>
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    return () => ctrl.abort();
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const dataset = await loadDataset(RAW_DATA_BASE_URL);
      setState({ kind: "ready", dataset });
      setSource("live");
    } catch (err) {
      // Keep showing the current dataset; surface the failure inline.
      setState((prev) =>
        prev.kind === "ready"
          ? prev
          : {
              kind: "error",
              message: err instanceof Error ? err.message : String(err),
            },
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  const selectPoint = useCallback((commitSha: string) => {
    setSelectedSha(commitSha);
    requestAnimationFrame(() =>
      drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="app">
        <p className="status-banner">Loading coverage data…</p>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="app">
        <p className="status-banner error">
          Failed to load coverage data: {state.message}
        </p>
      </div>
    );
  }

  return (
    <Dashboard
      dataset={state.dataset}
      metric={metric}
      setMetric={setMetric}
      selectedSha={selectedSha}
      selectPoint={selectPoint}
      clearSelection={() => setSelectedSha(null)}
      palette={palette}
      refresh={refresh}
      refreshing={refreshing}
      source={source}
      drillRef={drillRef}
    />
  );
}

function Dashboard({
  dataset,
  metric,
  setMetric,
  selectedSha,
  selectPoint,
  clearSelection,
  palette,
  refresh,
  refreshing,
  source,
  drillRef,
}: {
  dataset: Dataset;
  metric: Metric;
  setMetric: (m: Metric) => void;
  selectedSha: string | null;
  selectPoint: (sha: string) => void;
  clearSelection: () => void;
  palette: ReturnType<typeof readPalette>;
  refresh: () => void;
  refreshing: boolean;
  source: "bundled" | "live";
  drillRef: React.RefObject<HTMLDivElement>;
}) {
  const { snapshots, pulls, categories } = dataset;
  const latest = snapshots[snapshots.length - 1];

  const overallPct = latest ? pct(latest.totals, metric) : 0;
  const compliancePct = useMemo(() => {
    if (!latest) return 0;
    const slice = aggregateByCategory(latest.files, categories).find(
      (s) => s.id === COMPLIANCE_CRITICAL_ID,
    );
    return slice ? pct(slice.counts, metric) : 0;
  }, [latest, categories, metric]);

  const prToSha = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of snapshots) {
      if (s.pr_number !== null) m.set(s.pr_number, s.commit_sha);
    }
    return m;
  }, [snapshots]);

  const daysToExam = Math.max(
    0,
    Math.ceil(
      (Date.parse(EXAM_DATE) - (latest ? Date.parse(latest.timestamp) : Date.now())) /
        86_400_000,
    ),
  );
  const meetsBar = compliancePct >= COVERAGE_TARGET_PCT;

  return (
    <div className="app">
      <div className="chrome-top">
        <span>Devin · Coverage patrol</span>
        <span>
          {REPO_OWNER}/{REPO_NAME}
        </span>
      </div>
      <div className="chrome-rule" />

      <header className="title-block">
        <p className="eyebrow">Devin coverage dashboard</p>
        <h1 className="t-display">
          Driving test coverage to the compliance bar, one merge at a time
        </h1>
        <p className="lede">
          Devin runs a continuous coverage patrol on{" "}
          <span className="mono">
            {REPO_OWNER}/{REPO_NAME}
          </span>
          . Every merged PR is measured, attributed, and tracked against the{" "}
          <span className="num">{COVERAGE_TARGET_PCT}%</span> compliance-critical
          bar due {fmtDateFull(EXAM_DATE)}.
        </p>
      </header>

      <div className="controls" style={{ marginBottom: "var(--s-6)" }}>
        <div className="row">
          <span className="field-label">Metric</span>
          <SegToggle
            ariaLabel="Coverage metric"
            options={[
              { value: "line", label: "Line" },
              { value: "branch", label: "Branch" },
            ]}
            value={metric}
            onChange={setMetric}
          />
        </div>
        <div className="spacer" />
        <span className="status-banner">
          {source === "live" ? "Live data" : "Bundled snapshot"} · as of{" "}
          {latest ? fmtDateFull(latest.timestamp) : "—"}
        </span>
        <Button onClick={refresh} disabled={refreshing} title="Re-fetch from the coverage-data branch">
          {refreshing ? "Refreshing…" : "Refresh live"}
        </Button>
      </div>

      <div className="grid grid--4">
        <div className="card">
          <Stat
            label="Compliance-critical coverage"
            value={fmtPct(compliancePct)}
            tone={meetsBar ? "pos" : undefined}
            sub={
              meetsBar ? (
                <Badge tone="good">meets {COVERAGE_TARGET_PCT}% bar</Badge>
              ) : (
                <Badge tone="signal">
                  {fmtPct(COVERAGE_TARGET_PCT - compliancePct)} to bar
                </Badge>
              )
            }
          />
        </div>
        <div className="card">
          <Stat label="Overall coverage" value={fmtPct(overallPct)} sub="all measured files" />
        </div>
        <div className="card">
          <Stat
            label="Lines covered"
            value={latest ? fmtInt(latest.totals.lines_covered) : "—"}
            sub={latest ? `of ${fmtInt(latest.totals.lines_total)} measured` : ""}
          />
        </div>
        <div className="card">
          <Stat
            label="Days to exam"
            value={fmtInt(daysToExam)}
            unit="d"
            sub={fmtDateFull(EXAM_DATE)}
          />
        </div>
      </div>

      <Zone1Hero
        snapshots={snapshots}
        config={categories}
        palette={palette}
        metric={metric}
        onSelectPoint={selectPoint}
        selectedSha={selectedSha}
      />

      <div ref={drillRef}>
        <Zone2DrillDown
          snapshots={snapshots}
          pulls={pulls}
          config={categories}
          selectedSha={selectedSha}
          metric={metric}
          onClear={clearSelection}
        />
      </div>

      <Zone3Aggregate pulls={pulls} />

      <ActivityFeed
        pulls={pulls}
        config={categories}
        prToSha={prToSha}
        onSelectPull={selectPoint}
      />

      <CreativeViews
        snapshots={snapshots}
        pulls={pulls}
        config={categories}
        palette={palette}
      />

      <footer
        className="chrome-top"
        style={{ marginTop: "var(--s-9)", borderTop: "1px solid var(--rule-soft)", paddingTop: "var(--s-4)" }}
      >
        <span>Generated by Devin · no always-on backend</span>
        <span>Data: git branch coverage-data</span>
      </footer>
    </div>
  );
}
