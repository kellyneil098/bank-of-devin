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
  Manifest,
  Pull,
  Snapshot,
} from "./schema.ts";

/**
 * Data loading (spec §8.1). Fetches the manifest, then every snapshot + pull it
 * references, plus the category config. Everything is held in memory; nothing
 * is written to localStorage. The same loader powers both the initial bundled
 * load and the manual refresh against the raw `coverage-data` URL (§8.6) — only
 * the base URL differs.
 */

export interface Dataset {
  manifest: Manifest;
  snapshots: Snapshot[];
  pulls: Pull[];
  categories: CategoryConfig;
  baseUrl: string;
  loadedAt: string;
}

/** Ensure exactly one trailing slash so `base + relative` always joins. */
function withTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : url + "/";
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/**
 * Load the full dataset from `baseUrl` — the directory that contains the
 * `data/` folder. For the bundled build that is the site root
 * (import.meta.env.BASE_URL); for a manual refresh it is the raw
 * coverage-data branch URL.
 */
export async function loadDataset(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<Dataset> {
  const base = withTrailingSlash(baseUrl);

  const [manifest, categories] = await Promise.all([
    fetchJson<Manifest>(`${base}data/manifest.json`, signal),
    fetchJson<CategoryConfig>(`${base}data/categories.json`, signal),
  ]);

  const [snapshots, pulls] = await Promise.all([
    Promise.all(
      manifest.snapshots.map((s) =>
        fetchJson<Snapshot>(`${base}${s.file}`, signal),
      ),
    ),
    Promise.all(
      manifest.pulls.map((p) => fetchJson<Pull>(`${base}${p.file}`, signal)),
    ),
  ]);

  snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  pulls.sort((a, b) => a.number - b.number);

  return {
    manifest,
    snapshots,
    pulls,
    categories,
    baseUrl: base,
    loadedAt: new Date().toISOString(),
  };
}
