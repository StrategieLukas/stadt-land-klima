import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { jobCompensation } from "../../../src/frontend/shared/jobCompensation.js";
import {
  JOB_SHARE_FORMATS,
  jobShareLinks,
  jobSharePeriod,
  resolveJobShareContent,
  type JobShareFormat,
} from "../../../src/frontend/shared/jobSharing.js";
import {
  jobShareSvg,
  renderJobShareImage,
  wrapJobShareText,
} from "../../../src/frontend/server/utils/jobShareImage.js";
import { createJobImageCache } from "../../../src/frontend/server/utils/jobShareImageCache.js";
import { JobTypeSchema, type PublicJobDetail } from "../../../src/frontend/shared/contracts/jobs.js";

const font = fileURLToPath(
  new URL("../../../src/frontend/server/assets/fonts/RobotoCondensed-Regular.ttf", import.meta.url),
);
const brand = readFileSync(
  new URL("../../../src/frontend/assets/images/Stadt-Land-Klima-Logo.svg", import.meta.url),
  "utf8",
);
const organisationLogo = readFileSync(
  new URL("../../../src/frontend/public/SLK-favicon/apple-icon-120x120.png", import.meta.url),
);
const job: PublicJobDetail = {
  id: "test-role",
  slug: "climate-role",
  role_title: "Klimaschutz gemeinsam voranbringen",
  type: "full_time",
  tasks: "Climate action",
  qualifications: null,
  benefits: null,
  contact_notes: null,
  weekly_hours: "32–40h",
  salary: "4.500 € / Monat",
  hourly_wage: null,
  start_date: "2027-02-01",
  end_date: "2027-12-31",
  application_url: "https://example.org/apply",
  organisation: { id: 1, name: "Klimaorganisation", link: null, logo: null },
};
test("job share content preserves authored pay, chooses by type and shares only canonical job URLs", () => {
  assert.equal(jobCompensation({ ...job, hourly_wage: "18 €/h" })?.value, "4.500 € / Monat");
  assert.equal(jobCompensation({ ...job, type: "working_student", hourly_wage: "18 €/h" })?.value, "18 €/h");
  assert.equal(jobCompensation({ ...job, type: "volunteer" }), null);
  const content = resolveJobShareContent(job, "de-DE", "https://stadt-land-klima.de");
  assert.equal(content.url, "https://stadt-land-klima.de/jobs/climate-role");
  assert.ok(content.caption.includes("32–40h · 4.500 € / Monat"));
  assert.ok(!content.caption.includes("example.org/apply"));
  const links = jobShareLinks(content.url, content.caption);
  assert.equal(new URL(links.whatsapp).searchParams.get("text"), content.caption);
  assert.equal(new URL(links.linkedin).searchParams.get("url"), content.url);
  assert.equal(
    resolveJobShareContent({ ...job, weekly_hours: " ", salary: " " }, "en-GB", "https://stadt-land-klima.de").pay,
    "",
  );
});

test("job share periods use valid calendar dates and never invent application deadlines", () => {
  assert.equal(jobSharePeriod({ start_date: "2027-02-30", end_date: null }, "de-DE"), "");
  assert.equal(jobSharePeriod({ start_date: "2027-02-01", end_date: "2027-01-01" }, "de-DE"), "");
  assert.equal(jobSharePeriod({ start_date: null, end_date: null }, "en-GB"), "Flexible start date");
  assert.match(jobSharePeriod({ start_date: "2027-02-01", end_date: null }, "de-DE"), /^Ab /);
  assert.equal(
    jobSharePeriod({ start_date: "2027-02-01", end_date: "2027-02-01" }, "en-GB"),
    jobSharePeriod({ start_date: "2027-02-01", end_date: null }, "en-GB"),
  );
});

test("job image text wraps long words and truncates at grapheme boundaries", () => {
  const lines = wrapJobShareText("🌍".repeat(50), 10, 2, (text) => Array.from(text).length);
  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => Array.from(line).length <= 10));
  assert.ok(lines[1]?.endsWith("…"));
  assert.ok(!lines.join("").includes("�"));
});

test("all job types and locales retain image safe areas with sparse and overflowing content", () => {
  for (const type of JobTypeSchema.options) {
    for (const locale of ["de-DE", "en-GB", "it-IT"] as const) {
      for (const format of Object.keys(JOB_SHARE_FORMATS) as JobShareFormat[]) {
        const dense = {
          ...job,
          type,
          role_title: "Sehr langer Klimaschutzjob mit vielfältigen Aufgaben und Verantwortung ".repeat(5),
          organisation: {
            ...job.organisation!,
            name: "Gemeinnützige Klimaschutzorganisation mit einem sehr langen Namen ".repeat(3),
          },
          weekly_hours: "32–40 Stunden, flexibel nach gemeinsamer Absprache",
          hourly_wage: "18–22 € pro Stunde nach Vereinbarung",
        };
        const content = resolveJobShareContent(
          dense,
          locale,
          "https://stadt-land-klima.de",
          "Unterstütze unser Team beim kommunalen Klimaschutz und bringe deine Ideen in abwechslungsreiche Projekte ein. ".repeat(
            3,
          ),
        );
        const config = JOB_SHARE_FORMATS[format];
        const layout = jobShareSvg(content, format, font, brand, organisationLogo);
        assert.doesNotThrow(() => jobShareSvg(content, format, font, brand));
        assert.ok(
          layout.boxes.every((box) => box.y >= config.top && box.y + box.height <= config.height - config.bottom),
        );
        assert.ok(
          layout.boxes.every((box) => box.x >= config.left && box.x + box.width <= config.width - config.right),
        );
        if (type !== "volunteer")
          assert.ok(
            layout.boxes.some((box) => box.text.includes(type === "working_student" ? "18–22" : "4.500")),
            "Pay survives before optional excerpts",
          );
        const sparse = resolveJobShareContent(
          {
            ...job,
            type,
            organisation: null,
            weekly_hours: null,
            salary: null,
            hourly_wage: null,
            start_date: null,
            end_date: null,
          },
          locale,
          "https://stadt-land-klima.de",
        );
        assert.doesNotThrow(() => jobShareSvg(sparse, format, font, brand));
      }
    }
  }
});

test("job images export exact PNG dimensions and escape authored SVG-like text", async () => {
  const content = resolveJobShareContent(
    { ...job, role_title: 'Climate & nature <script>alert("x")</script>' },
    "de-DE",
    "https://stadt-land-klima.de",
  );
  for (const format of Object.keys(JOB_SHARE_FORMATS) as JobShareFormat[]) {
    const layout = jobShareSvg(content, format, font, brand);
    assert.ok(!layout.svg.includes("<script>"));
    assert.ok(layout.svg.includes("&amp;"));
    const png = await renderJobShareImage(content, format, font, brand, organisationLogo);
    assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(png.readUInt32BE(16), JOB_SHARE_FORMATS[format].width);
    assert.equal(png.readUInt32BE(20), JOB_SHARE_FORMATS[format].height);
  }
});

test("job image cache coalesces identical work, rejects excess concurrent work and does not cache failures", async () => {
  const cached = createJobImageCache();
  let calls = 0;
  let finish!: (png: Buffer) => void;
  const render = () => {
    calls++;
    return new Promise<Buffer>((resolve) => {
      finish = resolve;
    });
  };
  const one = cached("one", render);
  const same = cached("one", render);
  let finishTwo!: (png: Buffer) => void;
  const two = cached(
    "two",
    () =>
      new Promise<Buffer>((resolve) => {
        finishTwo = resolve;
      }),
  );
  await assert.rejects(
    cached("three", async () => Buffer.from("not started")),
    /busy/,
  );
  finish(Buffer.from("one"));
  finishTwo(Buffer.from("two"));
  assert.equal((await one).toString(), "one");
  assert.equal((await same).toString(), "one");
  await two;
  assert.equal(calls, 1);
  assert.equal(
    (
      await cached("one", async () => {
        throw Error("cached work must not run");
      })
    ).toString(),
    "one",
  );
  await assert.rejects(
    cached("failed", async () => {
      throw Error("render failed");
    }),
    /render failed/,
  );
  assert.equal((await cached("failed", async () => Buffer.from("recovered"))).toString(), "recovered");
});
