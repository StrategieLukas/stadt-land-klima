import type { PublicJobList } from "./contracts/jobs";

/** CMS values are authored strings: keep their currency, units and ranges intact. */
export function jobCompensation(job: Pick<PublicJobList, "type" | "salary" | "hourly_wage">) {
  if (job.type === "volunteer") return null;
  const salary = job.salary?.trim();
  const hourlyWage = job.hourly_wage?.trim();
  if (hourlyWage && (job.type === "working_student" || !salary))
    return { label: "jobs.hourly_wage" as const, value: hourlyWage };
  if (salary) return { label: "jobs.salary" as const, value: salary };
  return null;
}
