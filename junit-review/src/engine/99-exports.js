/* Public surface used by the UI and the test suite. */
return {
  version: '1.0.0',
  STATUS, INPUT_TYPES, METRICS, METRIC_LABEL, TRACE, RULE_TITLES, SCENARIO_LABEL,
  analyze, detectType, defaultReview, sanitiseReview,
  tokenizeJava, parseJava, parseXml, parseJacocoXml, parseJacocoCsv, parseJunitXml, parseResultsText, parseScope, parseSummary,
  pctText, pctNumber, meetsThreshold, metricRow, contentKey, normalizeNewlines, unwrapExcelCell, frameworkLabel, plural, fmtInt, truncate,
  buildTextReport, buildTsvReport, tsvCell,
};
