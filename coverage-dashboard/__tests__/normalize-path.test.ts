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
  isTestPath,
  normalizeC8Path,
  normalizeJavaPath,
  normalizePythonPath,
} from "../pipeline/normalize-path.ts";

describe("normalizeJavaPath", () => {
  it("maps a JaCoCo package+sourcefile to a repo-relative module path", () => {
    expect(
      normalizeJavaPath(
        "anthos/samples/bankofanthos/ledgerwriter/TransactionRepository.java",
      ),
    ).toBe(
      "src/ledger/ledgerwriter/src/main/java/anthos/samples/bankofanthos/ledgerwriter/TransactionRepository.java",
    );
  });

  it("resolves the monolith module", () => {
    expect(
      normalizeJavaPath(
        "anthos/samples/bankofanthos/ledgermonolith/LedgerReader.java",
      ),
    ).toBe(
      "src/ledgermonolith/src/main/java/anthos/samples/bankofanthos/ledgermonolith/LedgerReader.java",
    );
  });

  it("trusts an already repo-relative source path", () => {
    const p =
      "src/ledger/balancereader/src/main/java/anthos/samples/bankofanthos/balancereader/BalanceReaderController.java";
    expect(normalizeJavaPath(p)).toBe(p);
  });
});

describe("normalizePythonPath", () => {
  it("prefixes a bare module with its service dir", () => {
    expect(normalizePythonPath("userservice.py", "src/accounts/userservice")).toBe(
      "src/accounts/userservice/userservice.py",
    );
  });

  it("does not double the service dir", () => {
    expect(
      normalizePythonPath(
        "src/accounts/userservice/db.py",
        "src/accounts/userservice",
      ),
    ).toBe("src/accounts/userservice/db.py");
  });

  it("recovers a repo-relative path from an absolute one", () => {
    expect(
      normalizePythonPath(
        "/builder/home/src/frontend/frontend.py",
        "src/frontend",
      ),
    ).toBe("src/frontend/frontend.py");
  });
});

describe("isTestPath", () => {
  it("flags Python test modules, fixtures, and tests/ dirs", () => {
    expect(isTestPath("src/accounts/userservice/tests/test_users.py")).toBe(true);
    expect(isTestPath("src/accounts/contacts/test_contacts.py")).toBe(true);
    expect(isTestPath("src/accounts/userservice/tests/constants.py")).toBe(true);
    expect(isTestPath("src/accounts/userservice/conftest.py")).toBe(true);
    expect(isTestPath("src/accounts/contacts/db_test.py")).toBe(true);
  });

  it("flags Java test classes and src/test sources", () => {
    expect(
      isTestPath(
        "src/ledger/ledgerwriter/src/test/java/anthos/LedgerWriterControllerTest.java",
      ),
    ).toBe(true);
    expect(isTestPath("src/ledger/balancereader/.../BalanceReaderTests.java")).toBe(
      true,
    );
  });

  it("flags JS/TS test and spec files", () => {
    expect(isTestPath("src/frontend/static/app.test.ts")).toBe(true);
    expect(isTestPath("src/frontend/static/app.spec.tsx")).toBe(true);
    expect(isTestPath("src/frontend/__tests__/util.ts")).toBe(true);
  });

  it("treats application source as non-test", () => {
    expect(isTestPath("src/accounts/userservice/userservice.py")).toBe(false);
    expect(isTestPath("src/accounts/contacts/db.py")).toBe(false);
    expect(
      isTestPath(
        "src/ledger/balancereader/src/main/java/anthos/samples/bankofanthos/balancereader/BalanceReaderController.java",
      ),
    ).toBe(false);
    // "latest/" must not be mistaken for a "test/" directory.
    expect(isTestPath("src/latest/service.py")).toBe(false);
  });
});

describe("normalizeC8Path", () => {
  it("strips the absolute repo root", () => {
    expect(
      normalizeC8Path("/work/bank-of-devin/src/frontend/static/app.ts", "/work/bank-of-devin"),
    ).toBe("src/frontend/static/app.ts");
  });

  it("falls back to the last src/ root", () => {
    expect(
      normalizeC8Path("/tmp/build/src/frontend/static/app.ts", "/elsewhere"),
    ).toBe("src/frontend/static/app.ts");
  });
});
