import { getLocalDateString } from '../../../lib/localDate';
export const STORAGE_KEY = 'insan_j_ai_report_draft';

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
    return saved?.form
      ? {
          ...emptyState,
          ...saved.form,
          period: { ...initialPeriod(), ...saved.form.period }
        }
      : emptyState;
  } catch {
    return emptyState;
  }
}

