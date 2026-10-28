/* ------------------------------------------------------------------------
 * Input-type detection. Scored rules over the raw text; Java is finally
 * classified per class during analysis (a paste may mix tests and sources).
 * --------------------------------------------------------------------- */

const TEST_ANNOTATIONS = new Set(['Test', 'ParameterizedTest', 'RepeatedTest', 'TestFactory', 'TestTemplate']);

function detectType(text) {
  const s = unwrapExcelCell(normalizeNewlines(text));
  const t = s.trim();
  if (!t) return { type: null, label: 'Empty', reason: 'Nothing pasted yet.' };
  const head = t.slice(0, 4000);

  if (/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?</.test(t)) {
    if (/-\/\/JACOCO\/\/DTD/i.test(head) || (/<report[\s>]/.test(head) && /<counter\s/.test(t)) || (/<package\s+name=/.test(head) && /<counter\s+type=/.test(t))) {
      return { type: 'jacoco', format: 'xml', label: 'JaCoCo XML report', reason: 'XML with a JaCoCo <report>/<counter> structure.' };
    }
    if (/<testsuites?[\s>]/.test(head) || /<testcase[\s>]/.test(head)) {
      return { type: 'results', format: 'xml', label: 'JUnit XML results', reason: 'XML with <testsuite>/<testcase> elements.' };
    }
  }
  if (/^\s*"?GROUP"?\s*[,\t]\s*"?PACKAGE"?\s*[,\t]\s*"?CLASS"?/im.test(head) || /INSTRUCTION_MISSED/.test(head)) {
    return { type: 'jacoco', format: 'csv', label: 'JaCoCo CSV report', reason: 'Header row with JaCoCo counter columns.' };
  }
  if (/^diff --git /m.test(head) || /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m.test(t) || (/^--- /m.test(head) && /^\+\+\+ /m.test(head))) {
    return { type: 'scope', format: 'diff', label: 'Git diff', reason: 'Unified diff headers or hunks.' };
  }
  if (/Tests run:\s*\d+,\s*Failures:\s*\d+/i.test(t) || /^\s*[\w.$]+\s+>\s+.+\s+(PASSED|FAILED|SKIPPED)\s*$/m.test(t)) {
    return { type: 'results', format: 'text', label: 'Test run console output', reason: 'Surefire/Gradle test summary lines.' };
  }
  if (/Missed\s+Instructions/i.test(head) && /Cov\./.test(head)) {
    return { type: 'summary', format: 'jacoco-html-copy', label: 'Coverage table (copied text)', reason: 'Text copied from a JaCoCo HTML report table.' };
  }

  const javaScore = scoreJava(t);
  if (javaScore >= 3) {
    // Judge from tokens, not raw text, so "@Test" inside a comment or string does not count.
    const T = tokenizeJava(t).tokens;
    let testish = false;
    for (let k = 0; k < T.length && !testish; k++) {
      if (isOp(T[k], '@') && isIdent(T[k + 1])) {
        let j = k + 1;
        let last = T[j].v;
        while (isOp(T[j + 1], '.') && isIdent(T[j + 2])) { j += 2; last = T[j].v; }
        if (TEST_ANNOTATIONS.has(last)) testish = true;
      } else if (isIdent(T[k], 'import')) {
        const j = isIdent(T[k + 1], 'static') ? k + 2 : k + 1;
        if (isIdent(T[j], 'org') && isOp(T[j + 1], '.') && isIdent(T[j + 2]) && /^(junit|mockito|assertj|hamcrest)$/.test(T[j + 2].v)) testish = true;
      }
    }
    return testish
      ? { type: 'test', format: 'java', label: 'JUnit test code', reason: 'Java with JUnit test annotations or test-library imports.' }
      : { type: 'source', format: 'java', label: 'Production Java source', reason: 'Java declarations without test annotations.' };
  }

  const lines = t.split('\n').filter((l) => l.trim());
  const pct = lines.filter((l) => /\d\s*%/.test(l) && metricFromLabel(l)).length;
  if (pct && pct >= Math.ceil(lines.length / 3)) {
    return { type: 'summary', format: 'text', label: 'Coverage summary (declared)', reason: 'Lines with coverage percentages.' };
  }
  const scopeLike = lines.filter((l) => {
    const s = l.trim().replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '');
    return /^[AMDRCTU]\d{0,3}\s+\S/.test(s) || /[\w-]+\/[\w./-]+\.\w+/.test(s) || /\.java\b/.test(s) || RE_FQCN.test(s.split(/[\s,;\t]+/)[0] || '') ||
      s.split(/[\s,;]+/).every((p) => RE_SIMPLE_CLASS.test(p) || RE_FQCN.test(p));
  }).length;
  if (scopeLike && scopeLike >= Math.ceil(lines.length * 0.6)) {
    return { type: 'scope', format: 'list', label: 'Changed files / classes list', reason: 'Lines that look like file paths or class names.' };
  }
  if (pct) return { type: 'summary', format: 'text', label: 'Coverage summary (declared)', reason: 'Contains coverage percentages.' };
  return { type: null, label: 'Not recognised', reason: 'Choose the input type manually.' };
}

function scoreJava(t) {
  let score = 0;
  if (/^\s*package\s+[\w.]+\s*;/m.test(t)) score += 3;
  if (/^\s*import\s+(?:static\s+)?[\w.]+(?:\.\*)?\s*;/m.test(t)) score += 2;
  if (/\b(?:class|interface|enum|record)\s+[A-Z]\w*/.test(t)) score += 2;
  if (/\b(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?[\w<>\[\], ?]+\s+\w+\s*\([^)]*\)\s*(?:throws [\w., ]+)?\{/.test(t)) score += 2;
  if (/@\w+/.test(t) && /[;{}]/.test(t)) score += 1;
  if (/\bvoid\s+\w+\s*\(/.test(t)) score += 1;
  if (/;\s*$/m.test(t) && /[{}]/.test(t)) score += 1;
  return score;
}
