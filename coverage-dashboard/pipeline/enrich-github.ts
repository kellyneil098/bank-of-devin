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
  Pull,
  PullReview,
  ReviewState,
  ReviewVerdict,
} from "../src/lib/schema.ts";
import { countTestsAddedInDiff } from "./tests-added.ts";

/**
 * Enrichment from the GitHub REST API (spec §4.2 step 5). Uses the global
 * fetch (Node 18+) with a bearer token. Pure helpers (regex/reduction) are
 * exported separately so they can be unit-tested without the network.
 */

/** Logins treated as "Devin" for review/rework attribution. */
const DEVIN_LOGINS = new Set([
  "devin-ai-integration[bot]",
  "devin-ai-integration",
  "devin-ai",
  "devin",
]);

/** Parse the Devin session URL from a PR body (spec §4.2 step 5). Nullable. */
export function parseSessionUrl(body: string | null | undefined): string | null {
  if (!body) return null;
  const m = body.match(/https?:\/\/(?:app\.)?devin\.ai\/\S+/i);
  if (!m) return null;
  // Trim common trailing punctuation/markdown that the regex may grab.
  return m[0].replace(/[)\].,>"']+$/, "");
}

/** True if a login belongs to the Devin bot. */
export function isDevinLogin(login: string | null | undefined): boolean {
  return !!login && DEVIN_LOGINS.has(login.toLowerCase());
}

/**
 * Reduce a set of reviews to a single verdict (spec §5.3). Precedence:
 * changes_requested > approved > commented > none. Only the latest review per
 * author counts toward APPROVED/CHANGES_REQUESTED (GitHub semantics).
 */
export function reduceReviewVerdict(reviews: PullReview[]): ReviewVerdict {
  if (reviews.length === 0) return "none";
  let hasChangesRequested = false;
  let hasApproved = false;
  let hasCommented = false;
  for (const r of reviews) {
    if (r.state === "CHANGES_REQUESTED") hasChangesRequested = true;
    else if (r.state === "APPROVED") hasApproved = true;
    else if (r.state === "COMMENTED") hasCommented = true;
  }
  if (hasChangesRequested) return "changes_requested";
  if (hasApproved) return "approved";
  if (hasCommented) return "commented";
  return "none";
}

interface GitHubClientOptions {
  owner: string;
  repo: string;
  token: string;
  apiBase?: string;
}

interface RawReview {
  user?: { login?: string } | null;
  state?: string;
  submitted_at?: string | null;
  body?: string | null;
}

interface RawCommit {
  author?: { login?: string } | null;
  commit?: { author?: { name?: string; email?: string } | null } | null;
}

interface RawPull {
  number: number;
  title: string;
  body: string | null;
  head: { ref: string };
  created_at: string;
  merged_at: string | null;
  merge_commit_sha: string | null;
  user: { login: string } | null;
  additions: number;
  deletions: number;
}

interface RawFile {
  filename: string;
}

export class GitHubClient {
  private owner: string;
  private repo: string;
  private token: string;
  private apiBase: string;

  constructor(opts: GitHubClientOptions) {
    this.owner = opts.owner;
    this.repo = opts.repo;
    this.token = opts.token;
    this.apiBase = opts.apiBase ?? "https://api.github.com";
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.apiBase}${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "coverage-dashboard-pipeline",
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub ${path} → ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  private async getDiff(path: string): Promise<string> {
    const res = await fetch(`${this.apiBase}${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3.diff",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "coverage-dashboard-pipeline",
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub diff ${path} → ${res.status} ${res.statusText}`);
    }
    return await res.text();
  }

  private repoPath(suffix: string): string {
    return `/repos/${this.owner}/${this.repo}${suffix}`;
  }

  /** Build the full enriched Pull record for PR `n`. */
  async buildPullRecord(n: number): Promise<Pull> {
    const pr = await this.get<RawPull>(this.repoPath(`/pulls/${n}`));
    const rawFiles = await this.get<RawFile[]>(
      this.repoPath(`/pulls/${n}/files?per_page=100`),
    );
    const rawReviews = await this.get<RawReview[]>(
      this.repoPath(`/pulls/${n}/reviews?per_page=100`),
    );
    const rawCommits = await this.get<RawCommit[]>(
      this.repoPath(`/pulls/${n}/commits?per_page=250`),
    );

    let testsAdded = 0;
    try {
      const diff = await this.getDiff(this.repoPath(`/pulls/${n}`));
      testsAdded = countTestsAddedInDiff(diff);
    } catch {
      testsAdded = 0;
    }

    const reviews: PullReview[] = rawReviews.map((r) => ({
      author: r.user?.login ?? "unknown",
      state: (r.state as ReviewState) ?? "COMMENTED",
      is_devin_review: isDevinLogin(r.user?.login),
      submitted_at: r.submitted_at ?? null,
      body: r.body ?? null,
    }));

    const humanRework = rawCommits.some((c) => {
      const login = c.author?.login;
      if (login) return !isDevinLogin(login);
      // Fall back to git author name/email when there's no GitHub user.
      const name = c.commit?.author?.name ?? "";
      const email = c.commit?.author?.email ?? "";
      return !isDevinLogin(name) && !/devin/i.test(email);
    });

    return {
      number: pr.number,
      title: pr.title,
      branch: pr.head.ref,
      created_at: pr.created_at,
      merged_at: pr.merged_at,
      merge_commit_sha: pr.merge_commit_sha,
      author: pr.user?.login ?? "unknown",
      additions: pr.additions,
      deletions: pr.deletions,
      files_changed: rawFiles.map((f) => f.filename),
      tests_added_estimate: testsAdded,
      session_url: parseSessionUrl(pr.body),
      reviews,
      review_verdict: reduceReviewVerdict(reviews),
      human_rework: humanRework,
      mutation_score: null,
    };
  }
}
