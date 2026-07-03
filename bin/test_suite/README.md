# How the automatic test suite works

## Developing new tests
1. Create a new subdirectory of test_suite and add a Markdown file that gives step-by-step instructions of what to test
2. An Agent turns this into test code in that directory and adds the new script to run_tests.sh, taking backend/frontend and env-file links from there
3. The code is written in typescript, should share logic for classes across different tests and be compiled appropriately.

## Running the test suite
1. Can be run with `test_dev.sh` or `test_staging.sh`, testing on prod is not recommended.
2. Will create test accounts and run through the relevant flows, perform actions and then clean up after, so the directus state (other than logs) should not be changed afterwards
3. Will present a list of errors found (if any)
4. For email tasks, will ensure all emails use the domain @stadt-land-klima.de. At the end, the user will be prompted to check what emails are expected to have arrived for whom and with what content, and which links to check.

## Import Info on testing

- Always ensure the fields that you need to enter in Directus are visible to the user and not 'hidden'. It does not help if a feature is only available programmatically but not to the user.
- ALWAYS Delete/Revert all resources created by this test, so that includes at least the municipality, localteam, ratings and associated wahlchecks, but potentially more.
  Delete in a sensible order that doesn't break foreign key constraints (will be stopped by directus)
- Combine "Ask user" segments from all run tests into one combined box at the end of run_tests.sh to give clear instructions

### Relevant pages
Rankings page: It lives under /municipalities in the frontend and takes the name of the measure_catalog as parameter, i.e. ?v=beta. It should default to the currentFrontend if an invalid version is supplied or none given.
Overall Wahlcheck page: /elections/wahlcheck
Municipality Wahlcheck page: /elections/wahlcheck/{slug}
