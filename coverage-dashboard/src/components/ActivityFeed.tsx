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
import type { CategoryConfig, Language, Pull } from "../lib/schema.ts";
import { categoriesForPath, labelForCategory } from "../lib/categories.ts";
import { SERVICE_MAP, prUrl, serviceForPath } from "../config.ts";
import { fmtDate, fmtInt, shortSession } from "../lib/format.ts";
import { Badge, SectionHead } from "./primitives.tsx";

function languageOf(path: string): Language | null {
  if (path.endsWith(".java")) return "java";
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  return null;
}

interface PullMeta {
  pull: Pull;
  languages: Set<string>;
  services: Set<string>;
  categories: Set<string>;
}

const VERDICT_TONE: Record<string, "good" | "signal" | "neutral"> = {
  approved: "good",
  changes_requested: "signal",
  commented: "neutral",
  none: "neutral",
};

export function ActivityFeed({
  pulls,
  config,
  prToSha,
  onSelectPull,
}: {
  pulls: Pull[];
  config: CategoryConfig;
  prToSha: Map<number, string>;
  onSelectPull: (commitSha: string) => void;
}) {
  const [category, setCategory] = useState("all");
  const [service, setService] = useState("all");
  const [language, setLanguage] = useState("all");
  const [status, setStatus] = useState("all");

  const meta: PullMeta[] = useMemo(
    () =>
      pulls.map((pull) => {
        const languages = new Set<string>();
        const services = new Set<string>();
        const categories = new Set<string>();
        for (const f of pull.files_changed) {
          const lang = languageOf(f);
          if (lang) languages.add(lang);
          services.add(serviceForPath(f));
          for (const c of categoriesForPath(f, config)) categories.add(c);
        }
        return { pull, languages, services, categories };
      }),
    [pulls, config],
  );

  const filtered = useMemo(
    () =>
      meta
        .filter((m) => category === "all" || m.categories.has(category))
        .filter((m) => service === "all" || m.services.has(service))
        .filter((m) => language === "all" || m.languages.has(language))
        .filter((m) => {
          if (status === "all") return true;
          const merged = m.pull.merged_at !== null;
          return status === "merged" ? merged : !merged;
        })
        .sort((a, b) => {
          const ax = a.pull.merged_at ?? a.pull.created_at;
          const bx = b.pull.merged_at ?? b.pull.created_at;
          return bx.localeCompare(ax);
        }),
    [meta, category, service, language, status],
  );

  return (
    <section className="section" id="zone-feed">
      <SectionHead eyebrow="Activity" title="Pull requests">
        Filter by category, service, language, status. Click a merged PR for
        attribution.
      </SectionHead>

      <div className="controls" style={{ marginBottom: "var(--s-5)" }}>
        <label className="row">
          <span className="field-label">Category</span>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All</option>
            {config.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="row">
          <span className="field-label">Service</span>
          <select
            className="input"
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            <option value="all">All</option>
            {SERVICE_MAP.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
            <option value="Other">Other</option>
          </select>
        </label>
        <label className="row">
          <span className="field-label">Language</span>
          <select
            className="input"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="all">All</option>
            <option value="java">Java</option>
            <option value="python">Python</option>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
          </select>
        </label>
        <label className="row">
          <span className="field-label">Status</span>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="merged">Merged</option>
            <option value="unmerged">Unmerged</option>
          </select>
        </label>
      </div>

      <div className="card card--flush">
        <table className="table">
          <thead>
            <tr>
              <th>PR</th>
              <th>Title</th>
              <th>Categories</th>
              <th>Review</th>
              <th style={{ textAlign: "right" }}>Tests</th>
              <th style={{ textAlign: "right" }}>When</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No PRs match these filters.
                </td>
              </tr>
            ) : (
              filtered.map(({ pull, categories }) => {
                const sha = prToSha.get(pull.number);
                const clickable = sha !== undefined;
                return (
                  <tr
                    key={pull.number}
                    className={clickable ? "clickable" : ""}
                    onClick={() => clickable && onSelectPull(sha!)}
                  >
                    <td className="num">
                      <a
                        href={prUrl(pull.number)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        #{pull.number}
                      </a>
                    </td>
                    <td>
                      <div>{pull.title}</div>
                      <div className="t-small muted">
                        {pull.merged_at ? "merged" : "open"}
                        {pull.session_url
                          ? ` · session ${shortSession(pull.session_url)}`
                          : ""}
                        {pull.human_rework ? " · human rework" : ""}
                      </div>
                    </td>
                    <td>
                      <div className="chips">
                        {[...categories].length === 0 ? (
                          <span className="muted t-small">—</span>
                        ) : (
                          [...categories].map((c) => (
                            <Badge key={c} tone="accent">
                              {labelForCategory(c, config)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td>
                      <Badge tone={VERDICT_TONE[pull.review_verdict]}>
                        {pull.review_verdict.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="num" style={{ textAlign: "right" }}>
                      {fmtInt(pull.tests_added_estimate)}
                    </td>
                    <td
                      className="num muted"
                      style={{ textAlign: "right" }}
                    >
                      {fmtDate(pull.merged_at ?? pull.created_at)}
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
