// Stable public API: implementation lives in the report-assistant feature.
export { REPORT_TYPES } from '../features/report-assistant/constants/reportTypes.js';
export { validateReportPayload } from '../features/report-assistant/domain/reportValidation.js';
export { serializePayload, detectSensitiveData } from '../features/report-assistant/domain/reportPrivacy.js';
export { formatReportPeriod, buildLocalReport, buildAutomaticAnalysis, buildReportConclusion, reportFactsToText, preservesNumericFacts } from '../features/report-assistant/domain/reportBuilder.js';
