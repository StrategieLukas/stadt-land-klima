type AuditCommand = {
  stdout: string;
  stderr: string;
  status: number | null;
  signal?: string | null;
  error?: Error;
};

export type AuditReport = {
  directory: string;
  high: number;
  critical: number;
  affected: string[];
  advisories: string[];
  error?: string;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an audit JSON object");
  }
  return value as Record<string, unknown>;
}

// Registry errors can contain credentials. Keep diagnostics on one line and
// prevent metadata/stderr from introducing GitHub workflow commands.
export function diagnostic(value: string): string {
  return value
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[redacted]@")
    .replace(/\b(Bearer\s+|_authToken[=:]\s*)[^\s]+/gi, "$1[redacted]")
    .replace(/[\r\n\u0000-\u001f\u007f]/g, " ")
    .slice(0, 2000);
}

export function parseAudit(directory: string, command: AuditCommand): AuditReport {
  const report: AuditReport = { directory, high: 0, critical: 0, affected: [], advisories: [] };
  try {
    if (command.error) throw command.error;
    if (command.signal) throw new Error(`npm audit terminated by ${command.signal}`);
    const parsed = record(JSON.parse(command.stdout));
    if (parsed.error) {
      const error = record(parsed.error);
      throw new Error([error.code, error.summary, error.detail].filter(Boolean).join(": "));
    }
    if (command.status !== 0 && command.status !== 1) {
      throw new Error(`npm audit exited with status ${command.status}`);
    }
    const counts = record(record(parsed.metadata).vulnerabilities);
    for (const severity of ["info", "low", "moderate", "high", "critical", "total"]) {
      if (typeof counts[severity] !== "number" || !Number.isSafeInteger(counts[severity]) || counts[severity] < 0) {
        throw new Error(`Missing or invalid vulnerability count: ${severity}`);
      }
    }
    report.high = counts.high as number;
    report.critical = counts.critical as number;
    const advisories = new Set<string>();
    const entries = Object.entries(record(parsed.vulnerabilities));
    for (const [name, value] of entries) {
      const entry = record(value);
      if (entry.severity !== "high" && entry.severity !== "critical") continue;
      report.affected.push(diagnostic(name));
      if (!Array.isArray(entry.via) || !entry.via.length) throw new Error(`Missing advisory details for ${name}`);
      for (const via of entry.via) {
        if (typeof via === "string") continue;
        const advisory = record(via);
        if (typeof advisory.title !== "string" || typeof advisory.url !== "string") {
          throw new Error(`Invalid advisory details for ${name}`);
        }
        const url = new URL(advisory.url);
        if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid advisory URL");
        advisories.add(`${diagnostic(advisory.title)} — ${url.href}`);
      }
    }
    report.advisories = [...advisories];
    if (report.affected.length !== report.high + report.critical || (report.affected.length && !advisories.size)) {
      throw new Error("Audit counts and advisory details disagree");
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    report.error = diagnostic([reason, command.stderr.trim()].filter(Boolean).join("; "));
  }
  return report;
}

export function auditExitCode(reports: AuditReport[]): number {
  if (reports.some((report) => report.error)) return 2;
  return reports.some((report) => report.high || report.critical) ? 1 : 0;
}

function markdown(value: string): string {
  return diagnostic(value).replace(/[&<>|`*_[\]\\]/g, (character) => `&#${character.charCodeAt(0)};`);
}

export function auditSummary(reports: AuditReport[]): string {
  const status = auditExitCode(reports);
  const lines = [
    "## Dependency audit",
    "",
    status === 2
      ? "**Audit could not complete.** Fix the command/registry errors below; this is not a clean audit."
      : status === 1
        ? "**Failed: high/critical findings.** Counts include affected dependency graph entries, not independent advisories."
        : "**Passed: no high/critical findings.**",
    "",
    "| Lockfile directory | Critical | High | Result |",
    "| --- | ---: | ---: | --- |",
    ...reports.map(
      (report) =>
        `| ${markdown(report.directory)} | ${report.error ? "?" : report.critical} | ${report.error ? "?" : report.high} | ${report.error ? "Audit error" : report.high || report.critical ? "Findings" : "Pass"} |`,
    ),
    "",
  ];
  for (const report of reports) {
    if (!report.error && !report.high && !report.critical) continue;
    lines.push(`### ${markdown(report.directory)}`, "");
    if (report.error) lines.push(`Audit error: ${markdown(report.error)}`, "");
    else
      lines.push(
        `Affected packages: ${report.affected.map(markdown).join(", ")}.`,
        "",
        ...report.advisories.map((advisory) => `- ${markdown(advisory)}`),
        "",
      );
  }
  lines.push(
    "Raw JSON reports and this summary are in the `dependency-audit` artifact (14-day retention in CI).",
    "",
    "This lockfile audit cannot recognize source backports. See SECURITY_HARDENING.md for the separately verified node-forge mitigation. Findings remain failing; no advisory is suppressed.",
    "",
  );
  return lines.join("\n");
}

export function auditAnnotation(report: AuditReport): string {
  const message = report.error
    ? `Audit command failed: ${report.error}`
    : `${report.critical} critical, ${report.high} high graph entries. ${report.advisories.join("; ")} See the job summary and dependency-audit artifact.`;
  const escape = (value: string) => value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
  return `::error file=${escape(report.directory).replaceAll(",", "%2C").replaceAll(":", "%3A")}/package-lock.json,title=Dependency audit::${escape(diagnostic(message))}`;
}
