export const REPORT_TYPES = {
  medical_waste: {
    label: 'Pengelolaan Limbah Medis',
    shortLabel: 'Limbah Medis',
    icon: 'fas fa-biohazard',
    supportsRecap: true,
    fields: [
      { key: 'totalGeneratedKg', label: 'Total timbulan (kg)', type: 'number', required: true },
      { key: 'totalTransportedKg', label: 'Total diangkut (kg)', type: 'number', required: true },
      { key: 'remainingKg', label: 'Selisih timbulan dan pengangkutan (kg)', type: 'number', required: true, allowNegative: true },
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
    if (field.type === 'number' && value !== '' && value !== undefined && (!Number.isFinite(Number(value)) || (!field.allowNegative && Number(value) < 0))) {
      errors[field.key] = `${field.label} harus berupa angka ${field.allowNegative ? 'yang valid' : 'nol atau lebih'}.`;
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
  const analysis = buildAutomaticAnalysis(payload);

  return `LAPORAN ${config.label.toUpperCase()}\nRSUD PROF. DR. W.Z. JOHANNES KUPANG\nPeriode: ${period}\n\nBAB I\nPENDAHULUAN\n\n1.1 Latar Belakang\nKegiatan ${config.label.toLowerCase()} merupakan bagian penting dari penyelenggaraan kesehatan lingkungan rumah sakit. Pemantauan yang teratur diperlukan untuk memastikan kegiatan tercatat, kendala dapat dikenali, dan tindak lanjut dapat dilaksanakan secara terukur. Laporan ini disusun berdasarkan data yang tersedia pada periode ${period} sebagai bahan evaluasi Unit Sanitasi.\n\n1.2 Tujuan\n1. Mendokumentasikan pelaksanaan dan hasil kegiatan ${config.label.toLowerCase()}.\n2. Mengidentifikasi capaian, kecenderungan, dan kendala pada periode pelaporan.\n3. Menjadi dasar penyusunan tindak lanjut dan pemantauan berikutnya.\n\n1.3 Manfaat\nLaporan ini diharapkan memberikan informasi yang ringkas, konsisten, dan dapat ditelusuri untuk mendukung evaluasi kegiatan serta pengambilan keputusan oleh unit terkait.\n\nBAB II\nHASIL DAN PEMBAHASAN\n\n2.1 Waktu dan Ruang Lingkup\nPemantauan dilaksanakan untuk periode ${period}. Data yang digunakan berasal dari isian petugas dan/atau rekap INSAN-J yang telah dipilih sesuai periode.\n\n2.2 Rekapitulasi Hasil\n${detailLines}\n\n2.3 Analisis Otomatis\n${analysis}\n\n2.4 Kendala dan Temuan\n${constraints}\n\n2.5 Tindakan yang Telah Dilakukan dan Rekomendasi\n${actions}\n\n2.6 Catatan Tambahan\n${notes}\n\n2.7 Tabel dan Grafik\nTabel serta grafik yang menyertai laporan merupakan visualisasi data sumber pada periode yang dipilih. Grafik harus dibaca bersama angka rekapitulasi dan diverifikasi sebelum laporan ditetapkan.\n\nBAB III\nPENUTUP\n\n3.1 Kesimpulan\nPelaksanaan ${config.label.toLowerCase()} pada periode ${period} telah didokumentasikan melalui data dan uraian yang tersedia. ${analysis.split('\n')[0]} Kesimpulan akhir tetap memerlukan verifikasi petugas Unit Sanitasi.\n\n3.2 Saran\n1. Lakukan verifikasi kesesuaian angka dengan sumber data sebelum laporan digunakan.\n2. Lengkapi bagian yang masih bertanda [PERLU DILENGKAPI].\n3. Dokumentasikan pelaksanaan tindak lanjut dan evaluasi kembali pada periode berikutnya.\n\nCATATAN: Dokumen ini merupakan draft dan wajib diperiksa sebelum digunakan.`;
}

export function buildAutomaticAnalysis(payload = {}) {
  const facts = payload.facts || {};
  if (payload.reportType === 'medical_waste') {
    const generated = Number(facts.totalGeneratedKg) || 0;
    const transported = Number(facts.totalTransportedKg) || 0;
    const difference = Number(facts.remainingKg) || 0;
    const types = [
      ['limbah infeksius', Number(facts.infectiousKg) || 0],
      ['limbah jarum suntik', Number(facts.sharpsKg) || 0],
      ['limbah botol obat', Number(facts.bottleKg) || 0],
      ['limbah sitotoksik', Number(facts.cytotoxicKg) || 0],
    ];
    const [dominantName, dominantValue] = types.sort((a, b) => b[1] - a[1])[0];
    const dominantPercent = generated > 0 ? (dominantValue / generated) * 100 : 0;
    const transportedPercent = generated > 0 ? (transported / generated) * 100 : 0;
    const balanceText = difference > 0
      ? `Timbulan lebih besar daripada pengangkutan, sehingga terdapat selisih positif sebesar ${difference} kg pada periode ini.`
      : difference < 0
        ? `Pengangkutan lebih besar daripada timbulan periode ini sebesar ${Math.abs(difference)} kg. Kondisi ini dapat terjadi apabila pengangkutan turut mencakup sisa periode sebelumnya dan perlu dikonfirmasi pada catatan TPS.`
        : 'Jumlah timbulan dan pengangkutan pada periode ini seimbang.';
    return `Total timbulan tercatat ${generated} kg dan jumlah yang diangkut ${transported} kg atau sekitar ${transportedPercent.toFixed(2)}% dari timbulan periode. ${balanceText}\nKomposisi terbesar adalah ${dominantName} sebanyak ${dominantValue} kg atau sekitar ${dominantPercent.toFixed(2)}% dari total timbulan. Komposisi ini perlu menjadi perhatian dalam perencanaan wadah, pengangkutan, dan pemantauan kepatuhan pemilahan.\nAnalisis ini dihitung otomatis dari angka yang dimasukkan dan tidak menggantikan pemeriksaan kondisi lapangan.`;
  }
  if (payload.reportType === 'lighting') {
    const total = Number(facts.totalPoints) || 0;
    const compliant = Number(facts.compliantPoints) || 0;
    const nonCompliant = Number(facts.nonCompliantPoints) || 0;
    const percent = total > 0 ? (compliant / total) * 100 : 0;
    return `Dari ${total} titik yang diperiksa, ${compliant} titik memenuhi standar dan ${nonCompliant} titik tidak memenuhi standar. Tingkat kesesuaian tercatat sekitar ${percent.toFixed(2)}%. Titik yang belum memenuhi standar perlu diprioritaskan untuk verifikasi kondisi lampu, armatur, kebersihan, dan kebutuhan pencahayaan ruang.`;
  }
  return `Data menunjukkan hasil pelaksanaan ${REPORT_TYPES[payload.reportType]?.label.toLowerCase() || 'kegiatan'} pada periode yang dipilih. Penilaian memenuhi atau tidak memenuhi syarat hanya dapat ditetapkan berdasarkan nilai standar dan bukti pemeriksaan yang dicantumkan. Temuan, kendala, dan tindakan perlu ditinjau keterkaitannya agar rekomendasi dapat dipantau pada periode berikutnya.`;
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
