import { isRecordConflictError } from '../recordVersion';

export const resetRetryState = (item) => ({
  ...item,
  syncAttempts: 0,
  lastSyncError: null,
  syncErrorType: null,
  lastSyncAttemptAt: null,
  nextRetryAt: null,
  requiresManualRetry: false,
  syncConflict: false,
});

export const getSyncErrorMessage = (error) => {
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Sinkronisasi gagal karena kesalahan yang tidak diketahui.';
};

export const classifySyncError = (error) => {
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || '').toLowerCase();
  const message = getSyncErrorMessage(error).toLowerCase();
  if (!navigator.onLine || /failed to fetch|network|load failed|fetch/.test(message)) return 'network';
  if ([401].includes(status) || /jwt|session|refresh.token|authsession/.test(`${code} ${message}`)) return 'session';
  if ([403].includes(status) || code === '42501' || /permission|row.level security|rls|not allowed/.test(message)) return 'permission';
  if (isRecordConflictError(error)) return 'conflict';
  if ([400, 409, 422].includes(status) || /^22|^23/.test(code) || /invalid|validation|required|constraint|duplicate/.test(message)) return 'validation';
  return 'server';
};
