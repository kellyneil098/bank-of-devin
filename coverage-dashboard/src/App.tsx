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
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="app app--plain">
        <p className="status-banner">Loading coverage data…</p>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="app app--plain">
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

  const meetsBar = compliancePct >= COVERAGE_TARGET_PCT;

  // ----- Slide-deck navigation -----
  const deckRef = useRef<HTMLDivElement>(null);
  const [slides, setSlides] = useState<{ id: string; label: string }[]>([]);
  const [current, setCurrent] = useState(0);

  const getSections = useCallback(
    () =>
      Array.from(deckRef.current?.querySelectorAll<HTMLElement>(".section") ?? []),
    [],
  );

  const indexFromScroll = useCallback(() => {
    const deck = deckRef.current;
    if (!deck) return 0;
    const sections = getSections();
    const top = deck.scrollTop;
    let best = 0;
    let bestDist = Infinity;
    sections.forEach((el, i) => {
      const dist = Math.abs(el.offsetTop - top);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }, [getSections]);

  const goTo = useCallback(
    (i: number) => {
      const deck = deckRef.current;
      if (!deck) return;
      const sections = getSections();
      if (sections.length === 0) return;
      const idx = Math.max(0, Math.min(sections.length - 1, i));
      deck.scrollTo({ top: sections[idx].offsetTop, behavior: "smooth" });
      setCurrent(idx);
    },
    [getSections],
  );

  const go = useCallback(
    (dir: number) => goTo(indexFromScroll() + dir),
    [goTo, indexFromScroll],
  );

  // Build the slide list (and labels for the dots) from the rendered sections.
  useEffect(() => {
    const sections = getSections();
    setSlides(
      sections.map((el) => ({
        id: el.id,
        label:
          el.querySelector(".eyebrow")?.textContent?.trim() ||
          el.querySelector(".t-h2")?.textContent?.trim() ||
          el.id,
      })),
    );
    setCurrent(indexFromScroll());
  }, [getSections, indexFromScroll, dataset]);

  // Keep the active slide in sync as the deck scrolls.
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setCurrent(indexFromScroll()));
    };
    deck.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      deck.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [indexFromScroll]);

  // ← / → (and PageUp/PageDown/Home/End) move between slides. Up/Down are left
  // alone for natural scrolling, and key events over form fields are ignored.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          go(1);
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          go(-1);
          break;
        case "Home":
          e.preventDefault();
          goTo(0);
          break;
        case "End":
          e.preventDefault();
          goTo(getSections().length - 1);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, goTo, getSections]);

  // Selecting a merge (chart point or feed row) jumps to the attribution slide.
  useEffect(() => {
    if (!selectedSha) return;
    const el = document.getElementById("zone-drill");
    const deck = deckRef.current;
    if (el && deck) {
      requestAnimationFrame(() =>
        deck.scrollTo({ top: el.offsetTop, behavior: "smooth" }),
      );
    }
  }, [selectedSha]);

  return (
    <div className="app" ref={deckRef}>
      <div className="deck-head">
        <span className="deck-head__brand">
          Devin · coverage · {REPO_OWNER}/{REPO_NAME}
        </span>
        <div className="deck-head__tools">
          <SegToggle
            ariaLabel="Coverage metric"
            options={[
              { value: "line", label: "Line" },
              { value: "branch", label: "Branch" },
            ]}
            value={metric}
            onChange={setMetric}
          />
          <span className="status-banner">
            {source === "live" ? "Live" : "Bundled"} ·{" "}
            {latest ? fmtDateFull(latest.timestamp) : "—"}
          </span>
          <Button
            onClick={refresh}
            disabled={refreshing}
            title="Re-fetch from the coverage-data branch"
          >
            {refreshing ? "Refreshing…" : "Refresh live"}
          </Button>
        </div>
      </div>

      <section className="section" id="zone-overview">
        <header className="title-block">
          <p className="eyebrow">Coverage dashboard</p>
          <h1 className="t-display">Compliance-critical test coverage</h1>
          <p className="lede">
            Coverage measured per merge on{" "}
            <span className="mono">
              {REPO_OWNER}/{REPO_NAME}
            </span>
            .
          </p>
        </header>

        <div className="grid grid--3">
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
            <Stat
              label="Overall coverage"
              value={fmtPct(overallPct)}
              sub="all measured files"
            />
          </div>
          <div className="card">
            <Stat
              label="Lines covered"
              value={latest ? fmtInt(latest.totals.lines_covered) : "—"}
              sub={latest ? `of ${fmtInt(latest.totals.lines_total)} measured` : ""}
            />
          </div>
        </div>
      </section>

      <Zone1Hero
        snapshots={snapshots}
        config={categories}
        palette={palette}
        metric={metric}
        onSelectPoint={selectPoint}
      />

      <Zone2DrillDown
        snapshots={snapshots}
        pulls={pulls}
        config={categories}
        selectedSha={selectedSha}
        metric={metric}
        onClear={clearSelection}
      />

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

      <nav className="deck-nav" aria-label="Slides">
        <button
          type="button"
          className="deck-nav__arrow"
          onClick={() => go(-1)}
          disabled={current <= 0}
          aria-label="Previous slide"
        >
          ←
        </button>
        <div className="deck-nav__dots">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className="deck-nav__dot"
              aria-current={i === current}
              aria-label={s.label}
              title={s.label}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <span className="deck-nav__counter num">
          {slides.length ? current + 1 : 0} / {slides.length}
        </span>
        <button
          type="button"
          className="deck-nav__arrow"
          onClick={() => go(1)}
          disabled={current >= slides.length - 1}
          aria-label="Next slide"
        >
          →
        </button>
      </nav>
    </div>
  );
}
