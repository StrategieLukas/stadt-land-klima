import { IMAGE_ADVISORY_REVIEW, IMAGE_REVIEW_EXPIRES } from "./lib/imageAdvisoryReview.js";
import { assertReleasePolicy } from "./lib/releasePolicy.js";
import { readFileSync } from "node:fs";
/** Audit actual image package copies, rather than treating extension lockfiles as the host. */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
const { satisfies } = require("semver") as { satisfies: (version: string, range: string) => boolean };
const image = process.env.SLK_SECURITY_IMAGE || "stadt-land-klima-directus";
if (!/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$/.test(image)) throw Error("Invalid image reference");
const reviewed = process.argv.includes("--reviewed");
const output = resolve(process.argv.slice(2).find((arg) => arg !== "--reviewed") || ".reports/directus-image-audit");
mkdirSync(output, { recursive: true, mode: 0o700 });
const collector = String.raw`const{readdirSync,readFileSync,realpathSync,existsSync}=require('node:fs');const base='/directus/node_modules/.pnpm';const packages={};const seen=new Set();const add=d=>{if(typeof d.name==='string'&&/^\d+\.\d+\.\d+/.test(d.version)){(packages[d.name]??=new Set()).add(d.version)}};const visit=modules=>{if(!existsSync(modules))return;for(const name of readdirSync(modules)){if(name.startsWith('.'))continue;const paths=name.startsWith('@')?readdirSync(modules+'/'+name).map(n=>name+'/'+n):[name];for(const p of paths){try{const full=realpathSync(modules+'/'+p);if(seen.has(full))continue;seen.add(full);add(JSON.parse(readFileSync(full+'/package.json')));visit(full+'/node_modules')}catch{}}}};add(JSON.parse(readFileSync('/directus/package.json')));for(const dir of readdirSync(base)){try{visit(base+'/'+dir+'/node_modules')}catch{}}visit('/opt/slk-directus-runtime-security/node_modules');console.log(JSON.stringify(Object.fromEntries(Object.entries(packages).map(([n,v])=>[n,[...v]]))));`;
const packages = JSON.parse(
  execFileSync("docker", ["run", "--rm", "--network=none", "--entrypoint=node", image, "-e", collector], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 60_000,
  }),
) as Record<string, string[]>;
const response = await fetch("https://registry.npmjs.org/-/npm/v1/security/advisories/bulk", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(packages),
  signal: AbortSignal.timeout(60_000),
});
if (!response.ok) throw Error(`Image advisory registry returned ${response.status}`);
const advisories = (await response.json()) as Record<
  string,
  { severity: string; title: string; url: string; vulnerable_versions: string }[]
>;
const findings = Object.entries(advisories).flatMap(([name, entries]) =>
  entries.flatMap((entry) =>
    (packages[name] || [])
      .filter((version) => satisfies(version, entry.vulnerable_versions))
      .map((version) => ({ name, version, ...entry })),
  ),
);
writeFileSync(resolve(output, "packages.json"), JSON.stringify(packages, null, 2) + "\n", { mode: 0o600 });
writeFileSync(resolve(output, "advisories.json"), JSON.stringify(findings, null, 2) + "\n", { mode: 0o600 });
console.info(
  `Image ${image}: ${Object.keys(packages).length} package names, ${findings.length} version-based advisory findings`,
);
for (const finding of findings)
  console.info(`${finding.severity} ${finding.name}@${finding.version}: ${finding.title} ${finding.url}`);
// Raw output/report above never hides locally mitigated vendor versions.
if (reviewed) {
  if (new Date().toISOString().slice(0, 10) > IMAGE_REVIEW_EXPIRES)
    throw Error("Pinned-image advisory review expired; reassess before release");
  const { parse } = require("yaml") as { parse: (source: string) => Record<string, any> };
  assertReleasePolicy(
    parse(readFileSync(new URL("../../../docker-compose.yaml", import.meta.url), "utf8")),
    parse(readFileSync(new URL("../../../docker-compose.prod.yaml", import.meta.url), "utf8")),
  );
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "--network=none",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--entrypoint=node",
      image,
      "/opt/slk-directus-runtime-security/test-runtime.ts",
    ],
    { stdio: "inherit", timeout: 120_000 },
  );
  const unknown = findings.filter(
    (finding) =>
      !IMAGE_ADVISORY_REVIEW.some(
        (review) =>
          review.name === finding.name && review.version === finding.version && finding.url.endsWith("/" + review.id),
      ),
  );
  if (unknown.length) throw Error(`${unknown.length} image advisories lack an exact current disposition`);
  console.info(
    `All ${findings.length} raw findings have verified controls or scoped reachability dispositions; review expires ${IMAGE_REVIEW_EXPIRES}.`,
  );
} else if (findings.some((finding) => ["high", "critical"].includes(finding.severity))) process.exitCode = 1;
