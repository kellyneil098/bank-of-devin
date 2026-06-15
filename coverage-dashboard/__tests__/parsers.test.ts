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
import { parseJacocoXml } from "../pipeline/parse-jacoco.ts";
import { parseCoveragePyJson } from "../pipeline/parse-coverage-py.ts";
import { parseC8Json } from "../pipeline/parse-c8.ts";
import { countTestsAddedInDiff } from "../pipeline/tests-added.ts";

const JACOCO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE report PUBLIC "-//JACOCO//DTD Report 1.1//EN" "report.dtd">
<report name="ledgerwriter">
  <package name="anthos/samples/bankofanthos/ledgerwriter">
    <sourcefile name="TransactionRepository.java">
      <counter type="LINE" missed="3" covered="17"/>
      <counter type="BRANCH" missed="1" covered="5"/>
    </sourcefile>
    <sourcefile name="Transaction.java">
      <counter type="LINE" missed="0" covered="9"/>
    </sourcefile>
  </package>
</report>`;

describe("parseJacocoXml", () => {
  it("reads LINE and BRANCH counters and normalizes paths", () => {
    const files = parseJacocoXml(JACOCO_XML);
    expect(files).toHaveLength(2);
    const repo = files.find((f) => f.path.endsWith("TransactionRepository.java"))!;
    expect(repo.path).toBe(
      "src/ledger/ledgerwriter/src/main/java/anthos/samples/bankofanthos/ledgerwriter/TransactionRepository.java",
    );
    expect(repo.language).toBe("java");
    expect(repo.lines_covered).toBe(17);
    expect(repo.lines_total).toBe(20);
    expect(repo.branches_covered).toBe(5);
    expect(repo.branches_total).toBe(6);
  });

  it("reports branches_total 0 when a sourcefile has no BRANCH counter", () => {
    const files = parseJacocoXml(JACOCO_XML);
    const model = files.find((f) => f.path.endsWith("/Transaction.java"))!;
    expect(model.lines_total).toBe(9);
    expect(model.branches_total).toBe(0);
    expect(model.branches_covered).toBe(0);
  });
});

describe("parseCoveragePyJson", () => {
  it("reads coverage.py summary fields and normalizes paths", () => {
    const report = {
      files: {
        "userservice.py": {
          summary: {
            covered_lines: 40,
            num_statements: 50,
            covered_branches: 8,
            num_branches: 12,
          },
        },
        "db.py": {
          summary: { covered_lines: 10, num_statements: 10 },
        },
      },
    };
    const files = parseCoveragePyJson(report, "src/accounts/userservice");
    const us = files.find((f) => f.path.endsWith("userservice.py"))!;
    expect(us.path).toBe("src/accounts/userservice/userservice.py");
    expect(us.language).toBe("python");
    expect(us.lines_covered).toBe(40);
    expect(us.lines_total).toBe(50);
    expect(us.branches_total).toBe(12);

    const db = files.find((f) => f.path.endsWith("db.py"))!;
    expect(db.branches_total).toBe(0);
  });
});

describe("parseC8Json", () => {
  it("derives line and branch coverage from Istanbul maps", () => {
    const report = {
      "/work/repo/src/frontend/static/app.ts": {
        path: "/work/repo/src/frontend/static/app.ts",
        s: { "0": 3, "1": 0, "2": 1 },
        b: { "0": [1, 0], "1": [2, 2] },
      },
    };
    const files = parseC8Json(report, "/work/repo");
    expect(files).toHaveLength(1);
    const f = files[0];
    expect(f.path).toBe("src/frontend/static/app.ts");
    expect(f.language).toBe("typescript");
    expect(f.lines_total).toBe(3);
    expect(f.lines_covered).toBe(2);
    expect(f.branches_total).toBe(4);
    expect(f.branches_covered).toBe(3);
  });
});

describe("countTestsAddedInDiff", () => {
  it("counts added test definitions across languages", () => {
    const diff = [
      "+++ b/FooTest.java",
      "+  @Test",
      "+  public void doesThing() {}",
      "+  @Test void other() {}",
      "-  @Test removed() {}",
      "+def test_login():",
      "+  it('works', () => {})",
    ].join("\n");
    // 2 @Test (added) + 1 def test_ + 1 it( = 4; the removed @Test is ignored.
    expect(countTestsAddedInDiff(diff)).toBe(4);
  });
});
