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
import {
  isDevinLogin,
  parseSessionUrl,
  reduceReviewVerdict,
} from "../pipeline/enrich-github.ts";
import type { PullReview, ReviewState } from "../src/lib/schema.ts";

function review(author: string, state: ReviewState): PullReview {
  return { author, state, is_devin_review: author.startsWith("devin") };
}

describe("reduceReviewVerdict", () => {
  it("returns none for no reviews", () => {
    expect(reduceReviewVerdict([])).toBe("none");
  });

  it("collapses an author's changes-requested then approval to approved", () => {
    const verdict = reduceReviewVerdict([
      review("devin-ai-integration[bot]", "COMMENTED"),
      review("alice", "CHANGES_REQUESTED"),
      review("alice", "APPROVED"),
    ]);
    expect(verdict).toBe("approved");
  });

  it("keeps changes_requested when an author's latest review still requests changes", () => {
    const verdict = reduceReviewVerdict([
      review("alice", "APPROVED"),
      review("alice", "CHANGES_REQUESTED"),
    ]);
    expect(verdict).toBe("changes_requested");
  });

  it("blocks on a second author's outstanding changes request", () => {
    const verdict = reduceReviewVerdict([
      review("alice", "APPROVED"),
      review("bob", "CHANGES_REQUESTED"),
    ]);
    expect(verdict).toBe("changes_requested");
  });

  it("does not let a later COMMENTED review override an approval", () => {
    const verdict = reduceReviewVerdict([
      review("alice", "APPROVED"),
      review("alice", "COMMENTED"),
    ]);
    expect(verdict).toBe("approved");
  });

  it("reports commented when that is the only effective state", () => {
    expect(reduceReviewVerdict([review("alice", "COMMENTED")])).toBe(
      "commented",
    );
  });
});

describe("parseSessionUrl", () => {
  it("extracts a devin session url from a PR body", () => {
    const body = "Work done by Devin.\nLink: https://app.devin.ai/sessions/abc123\nThanks";
    expect(parseSessionUrl(body)).toBe("https://app.devin.ai/sessions/abc123");
  });

  it("trims trailing markdown punctuation", () => {
    expect(parseSessionUrl("see (https://devin.ai/sessions/x9).")).toBe(
      "https://devin.ai/sessions/x9",
    );
  });

  it("returns null when no url is present", () => {
    expect(parseSessionUrl("no link here")).toBeNull();
    expect(parseSessionUrl(null)).toBeNull();
  });
});

describe("isDevinLogin", () => {
  it("recognizes the devin bot logins case-insensitively", () => {
    expect(isDevinLogin("devin-ai-integration[bot]")).toBe(true);
    expect(isDevinLogin("Devin")).toBe(true);
    expect(isDevinLogin("kellyneil098")).toBe(false);
    expect(isDevinLogin(null)).toBe(false);
  });
});
