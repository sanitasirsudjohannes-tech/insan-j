export const REPORT_TYPES = {
  medical_waste: {
    label: 'Pengelolaan Limbah Medis',
    shortLabel: 'Limbah Medis',
    icon: 'fas fa-biohazard',
    supportsRecap: true,
    fields: [
      { key: 'openingBalanceKg', label: 'Sisa limbah awal periode (kg)', type: 'number', required: true, allowNegative: true },
      { key: 'totalGeneratedKg', label: 'Total timbulan (kg)', type: 'number', required: true },
      { key: 'totalTransportedKg', label: 'Total diangkut (kg)', type: 'number', required: true },
      { key: 'remainingKg', label: 'Sisa limbah akhir periode (kg)', type: 'number', required: true, allowNegative: true },
      { key: 'infectiousKg', label: 'Infeksius (kg)', type: 'number' },
      { key: 'sharpsKg', label: 'Jarum suntik (kg)', type: 'number' },
      { key: 'bottleKg', label: 'Botol obat (kg)', type: 'number' },
      { key: 'cytotoxicKg', label: 'Sitotoksik (kg)', type: 'number' },
    ],
  },
  wastewater: {
    label: 'Pemeriksaan IPAL',
    supportsRecap: true,
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
    supportsRecap: true,
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

