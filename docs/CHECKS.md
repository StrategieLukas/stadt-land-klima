# Shared local and CI checks

Run `./bin/slk check ready` for application changes before finishing work or making
an authorized push. Use the documentation-only validation below for qualifying
prose changes; read-only investigations need only the evidence relevant to the
question unless validation is requested.
The default output is a short result for each check plus the last 30 lines of
failed checks. Complete logs and incremental/final JSON reports are retained in a
unique private directory under `.reports/checks/`. The command returns nonzero if
any selected check fails, times out, cannot start, is interrupted or is blocked.
`ok` means the selected plan passed on the recorded host; it does not certify
unexecuted workflows or a different deployed revision.

## Documentation-only validation

This is a task-scoping rule for agents and operators, not automatic skipping in
the CLI. `check ready` still runs its complete plan, and the GitHub Actions gates
remain unchanged.

A change qualifies only when every changed path is a regular, non-executable
Markdown file at the repository root or under `docs/`. Review additions,
deletions and both sides of renames. Exclude symlinks, generated or runtime-served
content, and any change to application code, configuration, schema, permissions,
translations, assets, dependencies, scripts or CI workflows. Use the full
readiness path whenever classification is uncertain. Deployment and security
acceptance requests still require their applicable checks.

Before committing, review the intended staged changes and any working-tree or
untracked files involved in the task. Before pushing, compare the **entire
unpublished range** with the current destination branch tip, or the explicit base
for a new branch. A Markdown-only final commit cannot hide earlier unverified
application changes. Validate the exact document versions being committed or
pushed; use a clean worktree if unrelated edits interfere.

For a documentation-only change:

1. Review the scoped diff for accuracy and unintended changes.
2. Run `git diff --check` for pending edits and `git diff --check <base> HEAD` for
   the committed range being pushed. Include `--cached` for staged changes.
3. Run the installed formatter against the explicit changed Markdown paths, for
   example `./src/frontend/node_modules/.bin/prettier --check -- docs/COMPLIANCE_CHECKLIST.md`.
   Check existing files; review deleted paths separately.
4. Verify new or changed local file links and instruction references. Check
   anchors where relevant. Do not crawl all historical links or external sites
   unless the task needs source verification.
5. Record this as documentation-only validation. No container build, dependency
   audit, application compilation or browser fixture suite is required for these
   prose changes.

Preserve prior application verification evidence when only qualifying
documentation changes afterward. An unchanged application tree does not need
another full run solely for a documentation commit or branch transfer. Other
changes still require their own appropriate checks and one final readiness run.

## Profiles

| Command                                       | Checks                                                                                                                                                                                                                 | Environment                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `./bin/slk check ready`                       | Complete quality profile, dependency audit, production frontend build, development live suite, final format and diff checks                                                                                            | Local development CMS/frontend; rootless Podman; browsers; registries              |
| `./bin/slk check quality`                     | Strict CLI/frontend/CMS/test compilers; security/translation/logging gates; frontend/extension lint; unit tests; all locked extension builds; pinned image build/reviewed audit; disposable Caddy security; formatting | Same as quality CI; no application credentials for these gates                     |
| `./bin/slk check audit`                       | All maintained package lockfile audits                                                                                                                                                                                 | npm registry access                                                                |
| `./bin/slk check native`                      | Frontend production build, including strict prebuild checks                                                                                                                                                            | Actual host recorded; native workflow runs clean installs on macOS **and** Windows |
| `./bin/slk check release --target staging`    | Public pages, production CSP and styles against the deployed staging origin                                                                                                                                            | Browser and authorized existing deployment                                         |
| `./bin/slk check release --target production` | The same public read-only checks against the production origin                                                                                                                                                         | Explicitly selected, authorized existing deployment                                |

All profiles verify Node against `.node-version`. No profile installs dependencies,
starts/restarts the application stack, deploys, commits or pushes. Image/Caddy gates
build images and use disposable containers. The development gate creates and
cleans up CMS fixtures, just like `slk test dev`; it runs only against loopback
URLs. `SLK_TEST_BACKEND_URL`, `SLK_TEST_FRONTEND_URL` and
`SLK_PODMAN_DIRECTUS_ENV_FILE` configure that local fixture environment. Remote
writable test environments still require explicit use of the existing test CLI.

`ready` runs isolated tests and the development live suite once each, covering
`slk test dev` without repeating isolated tests. It prints native/deployed checks
as pending because local results cannot establish those environments. The native
profile records its platform and explicitly covers only that host. Release checks
do not attest which Git revision is deployed; confirm that separately.

## Selecting checks and controlling output

```bash
./bin/slk check ready --list
./bin/slk check quality --only static
./bin/slk check ready --only types.cli,unit --output brief
./bin/slk check ready --output brief
./bin/slk check quality --only types.cli --output summary --tail 12
./bin/slk check quality --only image.audit --tail 80
./bin/slk check quality --only extensions --output full
```

`--only` accepts exact check IDs or groups, comma-separated or repeated. Unknown
selectors fail before checks run. Required prerequisites are included automatically;
for example, `image.audit` includes both image builds and the Node check. A failed
prerequisite blocks its dependants while unrelated checks continue. There is no
changed-file heuristic or cached pass in the CLI: selected runs are for iteration,
and application changes still require a final full run against their final
sources. The documentation-only procedure above uses explicit scoped checks
instead. Formatting runs last in the complete quality/ready plans, after
generators and builds.

| Option                  | Behavior                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `--list`                | Show the plan without running it or creating a report directory                       |
| `--output brief`        | At completion, show counts, failed/blocked checks, log paths and pending verification |
| `--output summary`      | Default: compact results and bounded failure tails                                    |
| `--output json`         | One JSON object on stdout; progress remains on stderr                                 |
| `--output full`         | Stream complete child stdout/stderr, then the summary                                 |
| `--tail 80`             | Keep up to 80 trailing lines per failure in the report and summary output (1–200)     |
| `--timeout-seconds 900` | Override each selected check's deadline; accepts 1–7200                               |

Use `--output brief` when you plan to read the result after completion. It saves
complete logs and the same incremental JSON report as the other modes. Use
`--output summary --tail 12` when you need inline failure excerpts. For
programmatic consumers, extract the needed fields from JSON before displaying it.
For other verbose commands, redirect stdout and stderr to a log file and capture
the command's exit status. Read the relevant part of the saved log for diagnosis.

Check local prerequisites before expensive builds. Run affected gates during
iteration and batch fixes before the final full application readiness run. Wait
for completion before dependent analysis, checking progress when it can inform
an action. If a check fails twice for the same reason, investigate the cause and
address it before retrying. Reproduce failed live flows with their required
disposable fixtures and real application routes and assertions before repeating
the full run. Reuse successful application verification after qualifying
documentation-only edits.

Excerpts are bounded to 12,000 characters per failure, reading at most the final
32 KiB of a log. ANSI/control sequences are stripped from excerpts. Logs retain the
original bytes, including successful check output; inspect the reported log when
the tail lacks context. Filtering never uses error-message wording, grep or an
assumed tool output layout to decide whether a command passed. A tool can print
"error" and exit successfully, or fail silently; its exit status still wins.
If an output consumer closes its pipe early (for example `head`), checks continue
and full private logs are retained; closing the pipe never converts a failure
into a successful result.

Default per-check deadlines are ten minutes, twenty for builds/Caddy and fifteen
for live development tests. Cancellation and timeout terminate the process group
on POSIX, or use `taskkill /T /F` on Windows; remaining checks are blocked after
interruption. Reports record timestamps, revision, worktree dirty state, platform,
Node version, selectors, durations, exit codes/signals, reasons and log paths.
Raw diagnostics can contain private application information. Logs/reports are
ignored by Git, created with private permissions, and must not be published
without review. CI retains its check artifacts for 14 days.

## Setup

Use the Node version from `.node-version`, Go 1.27.4+ for native launcher tests,
working rootless Podman (CI installs `podman`, `uidmap` and `crun`), OpenSSL and
Playwright Chromium/system libraries. On a clean checkout or after dependency
changes, reproduce the locked quality installs:

```bash
set -euo pipefail
npm ci --prefix bin
npm ci --prefix src/frontend
npm ci --prefix src/directus/cli
npm ci --prefix bin/test_suite
npm ci --prefix podman/directus/security-patches --ignore-scripts
for package in src/directus/extensions/*/package-lock.json; do
  npm ci --prefix "$(dirname "$package")" --ignore-scripts
done
npm --prefix bin/test_suite exec -- playwright install --with-deps chromium
```

The Quadlet regression uses the system generator by default. If that generator
predates the maintained units, set `SLK_TEST_QUADLET_GENERATOR` to a compatible
generator executable. An explicitly selected generator must run successfully;
missing or incompatible selected tools fail the test rather than skipping it.

Installing browser system dependencies may require host privileges. Use a
disposable checkout if clean installs or production builds would interfere with a
running development stack. Do not omit optional native dependencies. The audit job
installs CLI/test tooling with lifecycle scripts disabled. The native job installs
CLI tooling and the frontend with optional bindings on each matrix host. The
release job installs CLI/test tooling without lifecycle scripts, plus Chromium.
See the workflow setup steps for the exact host installation behavior.

## Maintaining parity

`bin/cli/check-plan.ts` defines commands; `check-runner.ts` executes them and
`check-command.ts` integrates output/validation with `slk`. All four workflows call
this runner after locked tool installation, using `--output full` for CI logs.
Every workflow uploads `.reports/checks/`, including raw image/dependency audit
reports. Host setup and artifact upload remain workflow responsibilities.

Add or change gates in the shared plan, update workflow selectors if necessary,
and run `node --test bin/cli/checks.test.ts` (also in the normal unit gate). The
parity test refuses unregistered workflows and checks that quality workflow steps
cover the complete shared quality plan. It also checks runner invocations in the
audit, native and release jobs. No workflow YAML or arbitrary shell text is
evaluated by the CLI. Child processes receive argument arrays without a shell;
Windows npm runs through its JavaScript entry point.

Fix check failures without weakening the gate, suppressing advisories, extending
image-review expiry without reassessment or raising the Directus 11.17.4 cap.
Report passed, failed, blocked and unavailable native/deployed verification
accurately. These commands do not grant deployment or push authorization.

## Unresolvable dependency findings and authorized pushes

Always run and inspect the complete readiness plan before pushing. An authorized
push may proceed if its only remaining failures are investigated dependency
advisories with no currently supported fix or mitigation within project constraints.
Check current upstream advisories and releases, and document package/advisory IDs,
the reason the finding remains unresolvable, and the report location in the PR
description and final response. A documented exception can be reused after
confirming the finding is unchanged and still has no supported resolution.

This is a decision about proceeding with an authorized push, not a passing check:
audits keep their nonzero statuses and complete findings, and CI may remain red.
The exception does not permit suppressing advisories, weakening checks, raising
the Directus cap, introducing avoidable vulnerable dependencies, or overlooking
registry/network errors or functional failures. Native/deployed verification still
needs its own environment, and this policy does not authorize deployment.
