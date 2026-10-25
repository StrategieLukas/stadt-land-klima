import assert from "node:assert/strict";
import { test } from "node:test";
import { auditAnnotation, auditExitCode, auditSummary, diagnostic, parseAudit } from "./lib/dependencyAuditReport.js";

function fixture(severity: "high" | "critical" | "moderate" = "high") {
  return {
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, [severity]: 2, total: 2 } },
    vulnerabilities: {
      framework: { severity, via: ["library"] },
      library: {
        severity,
        via: [{ title: "Signature verification bypass", url: "https://github.com/advisories/GHSA-test" }],
      },
    },
  };
}

function audit(value: unknown, status = 1) {
  return parseAudit("src/frontend", { stdout: JSON.stringify(value), stderr: "", status });
}

test("audit failure explains transitive graph entries without duplicating advisories", () => {
  const value = fixture();
  value.vulnerabilities.framework.via.push("library");
  const report = audit(value);
  assert.equal(auditExitCode([report]), 1);
  assert.equal(report.high, 2);
  assert.deepEqual(report.affected, ["framework", "library"]);
  assert.equal(report.advisories.length, 1);
  const summary = auditSummary([report]);
  assert.match(summary, /Failed: high\/critical/);
  assert.match(summary, /Signature verification bypass/);
  assert.match(summary, /https:\/\/github.com\/advisories\/GHSA-test/);
  assert.match(summary, /not independent advisories/);
  assert.match(summary, /cannot recognize source backports/);
  assert.match(auditAnnotation(report), /::error file=src\/frontend\/package-lock.json/);
});

test("clean and moderate-only audits pass; critical findings fail even with npm exit zero", () => {
  const clean = {
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
    vulnerabilities: {},
  };
  assert.equal(auditExitCode([audit(clean, 0)]), 0);
  assert.equal(auditExitCode([audit(fixture("moderate"))]), 0);
  assert.equal(auditExitCode([audit(fixture("critical"), 0)]), 1);
});

test("registry errors retain actionable diagnostics and take precedence over findings", () => {
  const report = parseAudit("src/directus/cli", {
    stdout: JSON.stringify({ error: { code: "E401", summary: "Registry authentication required" } }),
    stderr: "npm error registry unavailable",
    status: 1,
  });
  assert.match(report.error!, /E401: Registry authentication required; npm error registry unavailable/);
  assert.equal(auditExitCode([audit(fixture()), report]), 2);
  assert.match(auditSummary([report]), /could not complete/);
  assert.match(auditSummary([report]), /\| \? \| \? \| Audit error/);
});

test("malformed JSON, missing metadata, inconsistent counts and unsafe URLs fail closed", () => {
  for (const value of [{}, { metadata: {} }, { ...fixture(), vulnerabilities: {} }]) {
    assert.equal(auditExitCode([audit(value)]), 2);
  }
  for (const count of [-1, null, "0", 0.5]) {
    const value = fixture();
    Object.assign(value.metadata.vulnerabilities, { high: count });
    assert.equal(auditExitCode([audit(value)]), 2);
  }
  for (const url of ["javascript:alert(1)", "https://user:password@example.com/advisory"]) {
    const value = fixture();
    value.vulnerabilities.library.via[0]!.url = url;
    assert.match(audit(value).error!, /Invalid advisory URL/);
  }
  assert.equal(
    auditExitCode([parseAudit("test", { stdout: "not json", stderr: "registry proxy returned HTML", status: 1 })]),
    2,
  );
});

test("spawn failures, timeouts and unexpected exits are distinct from vulnerability findings", () => {
  for (const details of [
    { error: new Error("spawn npm ENOENT") },
    { signal: "SIGTERM" },
    { status: null },
    { status: 42 },
  ]) {
    const report = parseAudit("test", {
      stdout: JSON.stringify(fixture()),
      stderr: "connection reset",
      status: 0,
      ...details,
    });
    assert.equal(auditExitCode([report]), 2);
    assert.match(report.error!, /connection reset/);
  }
});

test("registry diagnostics redact credentials and untrusted text cannot inject annotations or summary HTML", () => {
  const input = "https://user:secret@example.com Bearer secret _authToken=secret\n::error::injected <script>|%\r";
  const report = { ...audit(fixture()), directory: "test,dir:entry", error: diagnostic(input) };
  const annotation = auditAnnotation(report);
  assert.doesNotMatch(annotation, /secret|[\r\n]/);
  assert.match(annotation, /file=test%2Cdir%3Aentry\/package-lock.json/);
  assert.match(annotation, /%25/);
  const summary = auditSummary([report]);
  assert.doesNotMatch(summary, /secret|<script>/);
  assert.match(summary, /&#60;script&#62;&#124;/);
});
