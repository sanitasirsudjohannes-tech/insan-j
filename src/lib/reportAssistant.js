export const REPORT_TYPES = {
  medical_waste: {
    label: 'Pengelolaan Limbah Medis',
    shortLabel: 'Limbah Medis',
    icon: 'fas fa-biohazard',
    supportsRecap: true,
    fields: [
      { key: 'totalGeneratedKg', label: 'Total timbulan (kg)', type: 'number', required: true },
      { key: 'totalTransportedKg', label: 'Total diangkut (kg)', type: 'number', required: true },
      { key: 'remainingKg', label: 'Sisa limbah (kg)', type: 'number', required: true },
      { key: 'infectiousKg', label: 'Infeksius (kg)', type: 'number' },
      { key: 'sharpsKg', label: 'Jarum suntik (kg)', type: 'number' },
      { key: 'bottleKg', label: 'Botol obat (kg)', type: 'number' },
      { key: 'cytotoxicKg', label: 'Sitotoksik (kg)', type: 'number' },
    ],
  },
  wastewater: {
    label: 'Pemeriksaan IPAL',
    shortLabel: 'IPAL',
    icon: 'fas fa-water',
    fields: [
      { key: 'samplingLocation', label: 'Lokasi/titik pemeriksaan', required: true },
      { key: 'inletResult', label: 'Hasil inlet', multiline: true, required: true },
      { key: 'outletResult', label: 'Hasil outlet', multiline: true, required: true },
      { key: 'compliance', label: 'Parameter memenuhi/tidak memenuhi syarat', multiline: true, required: true },
      { key: 'operationalIssue', label: 'Kendala operasional', multiline: true },
    ],
  },
  clean_water: {
    label: 'Kualitas Air Bersih',
    shortLabel: 'Air Bersih',
    icon: 'fas fa-droplet',
    fields: [
      { key: 'samplingLocation', label: 'Lokasi sampling', required: true },
      { key: 'parameterResults', label: 'Hasil parameter', multiline: true, required: true },
      { key: 'problemParameters', label: 'Parameter bermasalah', multiline: true },
      { key: 'evaluation', label: 'Evaluasi', multiline: true, required: true },
      { key: 'remonitoring', label: 'Rencana pemantauan ulang', multiline: true },
    ],
  },
  lighting: {
    label: 'Pemeriksaan Pencahayaan',
    shortLabel: 'Pencahayaan',
    icon: 'fas fa-lightbulb',
    fields: [
      { key: 'totalPoints', label: 'Jumlah titik diperiksa', type: 'number', required: true },
      { key: 'compliantPoints', label: 'Jumlah memenuhi standar', type: 'number', required: true },
      { key: 'nonCompliantPoints', label: 'Jumlah tidak memenuhi standar', type: 'number', required: true },
      { key: 'mainFindings', label: 'Temuan utama', multiline: true, required: true },
    ],
  },
  sanitation_activity: {
    label: 'Kegiatan Sanitasi',
    shortLabel: 'Kegiatan',
    icon: 'fas fa-clipboard-check',
    fields: [
      { key: 'activityName', label: 'Nama kegiatan', required: true },
      { key: 'location', label: 'Lokasi kegiatan', required: true },
      { key: 'implementers', label: 'Pelaksana dan sasaran', multiline: true, required: true },
      { key: 'activities', label: 'Rangkaian kegiatan', multiline: true, required: true },
      { key: 'results', label: 'Hasil kegiatan', multiline: true, required: true },
    ],
  },
};

const LABELS = Object.fromEntries(
  Object.values(REPORT_TYPES).flatMap(type => type.fields.map(field => [field.key, field.label]))
);

const valueOrPlaceholder = value => {
  if (value === 0 || value === '0') return '0';
  return String(value || '').trim() || '[PERLU DILENGKAPI]';
};

export function formatReportPeriod(period = {}) {
  const format = value => {
    if (!value) return '[PERLU DILENGKAPI]';
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' })
      .format(new Date(Date.UTC(year, month - 1, day)));
  };
  if (period.start === period.end) return format(period.start);
  return `${format(period.start)} sampai ${format(period.end)}`;
}

export function validateReportPayload(payload = {}) {
  const errors = {};
  const config = REPORT_TYPES[payload.reportType];
  if (!config) errors.reportType = 'Pilih jenis laporan yang valid.';
  if (!payload.period?.start) errors.periodStart = 'Tanggal awal wajib diisi.';
  if (!payload.period?.end) errors.periodEnd = 'Tanggal akhir wajib diisi.';
  if (payload.period?.start && payload.period?.end && payload.period.start > payload.period.end) {
    errors.periodEnd = 'Tanggal akhir tidak boleh sebelum tanggal awal.';
  }
  config?.fields.forEach(field => {
    const value = payload.facts?.[field.key];
    if (field.required && String(value ?? '').trim() === '') errors[field.key] = `${field.label} wajib diisi.`;
    if (field.type === 'number' && value !== '' && value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      errors[field.key] = `${field.label} harus berupa angka nol atau lebih.`;
    }
  });
  if (!payload.privacyConfirmed) errors.privacyConfirmed = 'Konfirmasi keamanan data wajib dicentang.';
  return errors;
}

export function buildLocalReport(payload = {}) {
  const config = REPORT_TYPES[payload.reportType] || REPORT_TYPES.medical_waste;
  const period = formatReportPeriod(payload.period);
  const facts = payload.facts || {};
  const detailLines = config.fields
    .map(field => `- ${field.label}: ${valueOrPlaceholder(facts[field.key])}${field.type === 'number' && String(field.label).includes('(kg)') ? ' kg' : ''}`)
    .join('\n');
  const constraints = valueOrPlaceholder(payload.constraints);
  const actions = valueOrPlaceholder(payload.actions);
  const notes = valueOrPlaceholder(payload.additionalNotes);

  return `LAPORAN ${config.label.toUpperCase()}\nRSUD PROF. DR. W.Z. JOHANNES KUPANG\nPeriode: ${period}\n\nBAB I\nPENDAHULUAN\n\n1.1 Latar Belakang\nKegiatan ${config.label.toLowerCase()} merupakan bagian dari upaya pemantauan dan pengelolaan kesehatan lingkungan rumah sakit. Laporan ini disusun berdasarkan data yang tersedia pada periode ${period}.\n\n1.2 Tujuan\nLaporan ini bertujuan mendokumentasikan pelaksanaan, hasil, kendala, dan tindak lanjut kegiatan ${config.label.toLowerCase()} pada periode pelaporan.\n\nBAB II\nHASIL DAN PEMBAHASAN\n\n2.1 Hasil\n${detailLines}\n\n2.2 Analisis\nBerdasarkan data tersebut, hasil perlu ditelaah dengan membandingkan catatan pelaksanaan, kondisi lapangan, dan standar yang berlaku. Informasi yang belum tersedia ditandai untuk dilengkapi oleh petugas.\n\n2.3 Kendala\n${constraints}\n\n2.4 Tindak Lanjut dan Rekomendasi\n${actions}\n\n2.5 Catatan Tambahan\n${notes}\n\nBAB III\nPENUTUP\n\n3.1 Kesimpulan\nPelaksanaan ${config.label.toLowerCase()} pada periode ${period} telah didokumentasikan berdasarkan data yang tersedia. Kesimpulan akhir ditetapkan setelah seluruh data diverifikasi oleh petugas Unit Sanitasi.\n\n3.2 Saran\nLakukan verifikasi data, lengkapi informasi yang masih kosong, dan pantau tindak lanjut secara berkala.\n\nCATATAN: Dokumen ini merupakan draft dan wajib diperiksa sebelum digunakan.`;
}

export function serializePayload(payload) {
  return JSON.stringify(payload).slice(0, 12000);
}

export function detectSensitiveData(payload) {
  const text = serializePayload(payload);
  const patterns = [
    /\bNIK\b\s*[:=-]?\s*\d{12,16}/i,
    /\b(no\.?\s*)?(rekam\s*medis|RM)\b\s*[:=-]?\s*[a-z0-9-]{4,}/i,
    /\b(diagnosis|nama\s+pasien|nomor\s+telepon|no\.?\s*hp)\b\s*[:=-]\s*\S+/i,
  ];
  return patterns.some(pattern => pattern.test(text));
}

export function reportFactsToText(payload) {
  const config = REPORT_TYPES[payload.reportType];
  return [
    `Jenis laporan: ${config?.label || payload.reportType}`,
    `Periode: ${formatReportPeriod(payload.period)}`,
    ...Object.entries(payload.facts || {}).map(([key, value]) => `${LABELS[key] || key}: ${valueOrPlaceholder(value)}`),
    `Kendala: ${valueOrPlaceholder(payload.constraints)}`,
    `Tindakan: ${valueOrPlaceholder(payload.actions)}`,
    `Catatan tambahan: ${valueOrPlaceholder(payload.additionalNotes)}`,
  ].join('\n');
}

export function preservesNumericFacts(draft, facts = {}) {
  const normalizedDraft = String(draft || '').replace(/,/g, '.');
  return Object.values(facts)
    .filter(value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)))
    .every(value => normalizedDraft.includes(String(Number(value))));
}
