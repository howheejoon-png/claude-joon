# JUnit Review — Paste-Only Edition

An offline JUnit code-coverage and test-quality review tool for restricted environments. Everything is pasted in as text; nothing is uploaded, installed, stored or sent anywhere.

**To use it, open `junit-review.html` in Microsoft Edge, Google Chrome or Firefox.** Double-click the file or drag it onto a browser window. It is one self-contained file of about 430 KB. It works from a local disk or a network share, with no internet connection.

---

## How a review works

1. **Enhancement.** Enter the CR reference, application name, optional module, a scope description and the coverage threshold. The threshold defaults to **100%, which is strict: a pass needs zero missed elements**. You can also choose which JaCoCo metrics are assessed against it.
2. **Paste evidence.** Paste one item at a time and choose **Add to review**. Repeat this for every class and report in the enhancement. *Auto Detect* recognises each input. You can also pick the type yourself.

   | Input type | What to paste | Where it usually comes from |
   |---|---|---|
   | JUnit Test Code | One or more test classes, or single test methods | `src/test/java/...` |
   | Production Source Code | The changed production classes | `src/main/java/...` |
   | JaCoCo Coverage Report | `jacoco.xml` (preferred) or `jacoco.csv` / the same table copied from Excel | `target/site/jacoco/` or `build/reports/jacoco/` |
   | JUnit Execution Results | Surefire/Gradle XML (`TEST-*.xml`), or the console summary | `target/surefire-reports/`, build log |
   | Enhancement Change Scope | `git diff`, `git diff --name-status`, a changed-file list, an affected-class list, or rows copied from Excel | the change request / merge request |
   | Declared Coverage Summary | Coverage figures typed by a vendor or from a summary sheet | vendor reports, Excel |

   Every snippet can be viewed, edited, replaced, re-typed or removed, and removal can be undone. The header keeps a running count of test classes and test methods.
3. **Review dashboard.** The dashboard has eight sections: Enhancement Summary, JUnit Test Inventory, Test Quality Analysis, Source-to-Test Traceability, Actual Coverage Metrics, Uncovered Code Findings, Evidence Completeness and Final Review Conclusion. Each section carries one of five statuses: **Verified Pass**, **Verified Fail**, **Requires Review**, **Insufficient Evidence** or **Not Applicable**. Every evidence reference opens the pasted snippet at the exact line.
4. **Report.** Choose **Copy formatted report** to get plain text for email or a document. Choose **Copy all tables for Excel** to get tab-separated tables: select cell A1 and paste. Single tables can be copied separately. **Print** is also available. Nothing is downloaded.

## What each part means

**Findings.** Every finding lists these fields:

- Source class
- Test class and test method
- Observation
- Explanation
- Risk / impact
- Recommended action
- Evidence reference (snippet number and line)

Each finding also states whether it is:
- **Definite**: directly visible in the evidence. Examples: a test with no assertions, a disabled test, a JaCoCo line that was never executed.
- **Possible**: a heuristic that a reviewer should confirm. Examples: a production method with no apparent test, or a boundary such as `qty > 100` where no test uses 100 or 101.

**Scenarios** (positive, negative, exception, boundary, null/empty, security) are judged from code evidence: assertions, expected status codes, stubbed failures and input values. A scenario is never reported missing because of a test's *name*. Name-only hints are shown separately, marked "?".

**Traceability** is static and *apparent*. It is always labelled that way and is never presented as execution coverage. Each production method shows:

- which tests appear to call it, and how the link was found (typed call, API endpoint match, name match, mock only);
- its conditions (if / else / switch / ternary / loops / catch);
- any potential gaps.

Where JaCoCo data exists it is shown alongside the static mapping, and it takes precedence.

**Measured coverage** comes only from JaCoCo:

- Percentages are calculated from covered and missed counts and rounded *down*, so 9 999 of 10 000 shows **99.99%** and nothing short of zero missed shows 100%.
- A metric with nothing to measure (for example, a class with no branches) shows **N/A**, never 0% or 100%.
- With only test code supplied, the dashboard shows: *Actual Code Coverage: NOT VERIFIED — JaCoCo execution evidence required.*

**Scope.** The dashboard keeps three levels apart:

- **Changed-code coverage**: diff line numbers × JaCoCo line data.
- **Affected-class coverage**: the classes in the scope, including inner classes.
- **Affected-module coverage**: only when the report itself carries a module or group total.

Whole-project coverage is never inferred from a subset. In-scope classes that are missing from the report are flagged, as is a missing scope.

**Declared figures** are pasted or typed summaries. They are always labelled *user-entered* or *vendor-declared — not independently verified*. They never produce a pass, and any conflict with JaCoCo is reported.

**Final conclusion.** The overall status is the worst of these components:

- measured coverage
- changed-code coverage / scope
- test execution
- test quality (static)
- traceability (static)
- evidence integrity

The order from worst is Fail, then Insufficient Evidence, then Requires Review, then Pass. Each component's status comes with a plain-language reason, a list of actions and the limitations of the review.

## Handling of pasted code

- **No network.** The page's Content-Security-Policy sets `default-src 'none'` and `connect-src 'none'`, and pins its two scripts by SHA-256 hash. The browser itself blocks any connection, and no other script can run. The page loads no fonts, images or scripts from anywhere.
- **No storage.** It uses no localStorage, sessionStorage, IndexedDB or cookies. Closing the tab discards the session, and the page warns before you close a tab with work in it.
  - *Copy backup* puts the whole workspace, including pasted code, on the clipboard as text, but only when you press it. *Restore* reads backup text that you paste back in.
- **Never executed, never rendered as HTML.** Pasted Java and XML are only tokenised and read as text, and they reach the page only as text nodes. XML entity definitions are never expanded and external references are never fetched.
- **Clipboard.** The page writes to the clipboard only when you press a copy button, and never reads it.
- **Spreadsheet safety.** Excel output neutralises cells that start with `=`, `+`, `-` or `@`, so pasted text cannot become a formula.
- **No spell-check services.** Spell-check, autocorrect and grammar extensions are switched off on every text box, so browser services do not see the code.

## Limitations

- The analysis is static and reads text; it does not compile the code. Unusual syntax, generated code (for example Lombok) and inherited behaviour may not be visible. The tool says so where it can tell.
- It cannot confirm that business requirements are fully tested. It reports evidence and gaps, not intent.
- Line-level views need the complete source file, from the same commit as the JaCoCo run. When the line numbers do not line up, the tool says so instead of guessing.

---

## For maintainers

The shipped file is built from readable sources. It needs Node.js 18 or later and has no npm dependencies.

```
junit-review/
  junit-review.html     ← the application (generated; do not edit by hand)
  src/shell.html        page skeleton
  src/styles.css        styles (system fonts only)
  src/engine/*.js       analysis engine: pure functions, no DOM (tokeniser, Java/XML parsers, evidence
                        readers, test & source analysis, traceability, coverage, rules, reports)
  src/ui/*.js           rendering and interaction (DOM built with textContent only)
  tools/build.mjs       concatenates the sources and writes the CSP script hashes
  tests/                node:test suites, synthetic fixture projects, browser end-to-end check
```

```bash
cd junit-review
npm run build       # rebuild junit-review.html after any change in src/
npm test            # engine, static/security and fixture tests (Node only)
npm run check       # fails if junit-review.html is out of date
npm run e2e         # browser end-to-end check (needs the playwright package + Chromium)
```

`tests/fixtures/` holds synthetic projects covering the following scenarios:

- controller-only, model-only and service-heavy enhancements
- several classes under one CR
- different package conventions
- partial snippets
- duplicate pastes
- JUnit without JaCoCo
- JaCoCo at 100%
- JaCoCo incomplete
- missing source and scope
- console test output

Each fixture has an `expected.json`, written independently of the parser, that the tests check against.
