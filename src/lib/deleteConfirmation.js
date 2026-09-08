const escapeHtml = value => String(value ?? '-')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const formatDeleteDate = value => {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return value || '-';

  return new Date(year, month - 1, day).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

export const formatDeleteKg = value => `${new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number(value) || 0)} kg`;

export const createDeleteDetailsHtml = (details, warning = 'Data yang dihapus tidak dapat dikembalikan.') => `
  <div class="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-left">
    ${details.map(({ label, value }) => `
      <div class="flex items-start justify-between gap-4 border-b border-gray-200 px-4 py-2.5 last:border-b-0">
        <span class="text-sm text-gray-500">${escapeHtml(label)}</span>
        <strong class="text-right text-sm text-gray-800">${escapeHtml(value)}</strong>
      </div>
    `).join('')}
  </div>
  <p class="mt-3 text-sm text-red-600">${escapeHtml(warning)}</p>
`;
