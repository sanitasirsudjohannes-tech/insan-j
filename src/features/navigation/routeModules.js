// These loaders fetch code only. They never read or mutate application data.
export const loadAdminPage = () => import('../../pages/KelolaAdmin');
export const loadRekapPage = () => import('../../pages/RekapLimbah');
const loaders = { '/kelola-admin': loadAdminPage, '/rekap-limbah': loadRekapPage };
const pending = new Map();
export function prefetchRoute(path) {
  if (typeof navigator !== 'undefined' && (!navigator.onLine || navigator.connection?.saveData)) return;
  const load = loaders[path];
  if (!load || pending.has(path)) return;
  const request = load().catch(() => { pending.delete(path); });
  pending.set(path, request);
}
