import { getLocalDateString } from '../../../lib/localDate';
export const STORAGE_KEY = 'insan_j_ai_report_draft';
const ACTIVE_REPORT_TYPES = new Set(['medical_waste', 'wastewater', 'clean_water']);

export function initialPeriod() {
  const today = getLocalDateString();
  return { start: `${today.slice(0, 7)}-01`, end: today };
}

export const emptyState = {
  reportType: 'medical_waste',
  period: initialPeriod(),
  facts: {},
  analytics: null,
  constraints: '',
  actions: '',
  additionalNotes: '',
};

export function loadSavedState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (saved?.form) {
      const savedReportType = ACTIVE_REPORT_TYPES.has(saved.form.reportType)
        ? saved.form.reportType
        : emptyState.reportType;
      return {
          ...emptyState,
          ...saved.form,
          reportType: savedReportType,
          facts: savedReportType === saved.form.reportType ? (saved.form.facts || {}) : {},
          analytics: savedReportType === saved.form.reportType ? (saved.form.analytics || null) : null,
          period: { ...initialPeriod(), ...saved.form.period }
        };
    }
    return emptyState;
  } catch {
    return emptyState;
  }
}

