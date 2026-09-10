import { buildMedicalWasteAnalysis, buildMedicalWasteConclusion, buildMedicalWasteRecommendations } from './medicalWasteNarrative.js';

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

const formatNumberId = value => new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const REPORT_NARRATIVES = {
  medical_waste: {
    background: 'Pengelolaan limbah medis merupakan salah satu bagian penting dalam upaya menjaga keselamatan pasien, petugas, masyarakat, dan lingkungan rumah sakit. Limbah yang dihasilkan dari setiap unit pelayanan perlu dipilah, ditimbang, dicatat, disimpan sementara, dan diserahkan kepada pihak pengangkut sesuai dengan prosedur yang berlaku. Pencatatan secara berkala diperlukan agar jumlah timbulan dan pengangkutan dapat dipantau serta setiap selisih dapat segera ditelusuri.',
    scope: 'Laporan ini mencakup timbulan limbah infeksius, jarum suntik, botol obat, dan limbah sitotoksik, serta jumlah limbah yang telah diangkut pada periode pelaporan.',
    benefit: 'Hasil laporan dapat digunakan sebagai bahan evaluasi pelaksanaan pemilahan, kebutuhan sarana, pengaturan penyimpanan sementara, dan koordinasi pengangkutan limbah medis.',
  },
  wastewater: {
    background: 'Pengolahan air limbah rumah sakit perlu dipantau secara teratur untuk memastikan setiap tahapan pengolahan berjalan sebagaimana mestinya. Pemantauan dilakukan terhadap kondisi operasional instalasi serta hasil pemeriksaan pada titik masuk dan keluar. Hasil tersebut menjadi dasar untuk menilai kinerja pengolahan dan menentukan tindakan perbaikan apabila ditemukan ketidaksesuaian.',
    scope: 'Laporan ini memuat lokasi pemeriksaan, hasil pada inlet dan outlet, status pemenuhan parameter, kendala operasional, serta tindakan yang dilakukan selama periode pelaporan.',
    benefit: 'Laporan ini menjadi bahan evaluasi kinerja IPAL dan membantu Unit Sanitasi menetapkan prioritas pemeliharaan maupun tindak lanjut pemeriksaan.',
  },
  clean_water: {
    background: 'Ketersediaan air bersih dengan kualitas yang baik merupakan unsur penting dalam menunjang pelayanan rumah sakit. Pemeriksaan kualitas air dilakukan untuk mengetahui kondisi parameter pada titik sampling dan mengenali sedini mungkin hasil yang memerlukan perhatian atau tindakan koreksi.',
    scope: 'Laporan ini mencakup lokasi sampling, hasil parameter yang diperiksa, parameter yang bermasalah, hasil evaluasi, tindakan koreksi, dan rencana pemantauan ulang.',
    benefit: 'Informasi yang tersaji dapat digunakan untuk menelusuri penyebab masalah, menetapkan tindakan koreksi, dan memastikan hasil tindak lanjut dipantau kembali.',
  },
  lighting: {
    background: 'Pencahayaan yang memadai diperlukan untuk mendukung kenyamanan, keselamatan, dan ketelitian dalam pelaksanaan kegiatan di setiap ruangan rumah sakit. Pengukuran pencahayaan dilakukan untuk mengetahui kesesuaian tingkat pencahayaan pada titik-titik yang telah ditentukan dan mengidentifikasi lokasi yang memerlukan perbaikan.',
    scope: 'Laporan ini memuat jumlah titik yang diperiksa, jumlah titik yang memenuhi dan belum memenuhi standar, serta temuan utama selama kegiatan pengukuran.',
    benefit: 'Hasil pengukuran dapat menjadi dasar untuk menentukan kebutuhan perbaikan lampu, armatur, tata letak, maupun pemeliharaan sarana pencahayaan.',
  },
  sanitation_activity: {
    background: 'Pelaksanaan kegiatan sanitasi rumah sakit perlu didokumentasikan secara tertib agar tujuan, proses, hasil, dan tindak lanjut setiap kegiatan dapat ditelusuri. Dokumentasi yang baik juga membantu unit melakukan evaluasi dan memastikan bahwa hasil kegiatan ditindaklanjuti secara berkesinambungan.',
    scope: 'Laporan ini memuat waktu dan lokasi kegiatan, pihak yang terlibat, rangkaian pelaksanaan, hasil yang diperoleh, kendala, dan tindak lanjut yang direncanakan.',
    benefit: 'Laporan ini dapat digunakan sebagai bukti pelaksanaan kegiatan sekaligus bahan evaluasi untuk penyempurnaan kegiatan berikutnya.',
  },
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
  return errors;
}

export function buildLocalReport(payload = {}) {
  const config = REPORT_TYPES[payload.reportType] || REPORT_TYPES.medical_waste;
  const period = formatReportPeriod(payload.period);
  const facts = payload.facts || {};
  const detailLines = config.fields
    .map(field => `- ${field.label}: ${field.type === 'number' && String(facts[field.key] ?? '').trim() !== '' ? formatNumberId(facts[field.key]) : valueOrPlaceholder(facts[field.key])}${field.type === 'number' && String(field.label).includes('(kg)') ? ' kg' : ''}`)
    .join('\n');
  const constraints = valueOrPlaceholder(payload.constraints);
  const actions = valueOrPlaceholder(payload.actions);
  const notes = valueOrPlaceholder(payload.additionalNotes);
  const analysis = buildAutomaticAnalysis(payload);
  const narrative = REPORT_NARRATIVES[payload.reportType] || REPORT_NARRATIVES.sanitation_activity;
  const conclusion = buildReportConclusion(payload);
  const automaticRecommendations = payload.reportType === 'medical_waste' ? buildMedicalWasteRecommendations(facts, payload.analytics) : '';
  const recommendationSection = payload.reportType === 'medical_waste'
    ? `Rekomendasi otomatis berdasarkan hasil perhitungan:\n${automaticRecommendations}\n\nTindakan atau rekomendasi tambahan yang dicatat petugas:\n${actions}`
    : `Berdasarkan hasil evaluasi dan kondisi yang ditemukan, tindakan maupun rekomendasi yang perlu diperhatikan adalah sebagai berikut:\n${actions}`;

  return `LAPORAN ${config.label.toUpperCase()}\nRSUD PROF. DR. W.Z. JOHANNES KUPANG\nPeriode: ${period}\n\nBAB I\nPENDAHULUAN\n\n1.1 Latar Belakang\n${narrative.background}\n\nLaporan ${config.label.toLowerCase()} ini disusun berdasarkan kegiatan dan data yang tersedia pada periode ${period}. Penyusunan laporan dimaksudkan untuk memberikan gambaran mengenai hasil pelaksanaan kegiatan sekaligus menjadi bahan evaluasi bagi Unit Sanitasi.\n\n1.2 Tujuan\n1. Mendokumentasikan pelaksanaan dan hasil ${config.label.toLowerCase()} selama periode pelaporan.\n2. Mengetahui capaian serta mengidentifikasi kondisi yang masih memerlukan perhatian.\n3. Menjadi dasar dalam menentukan tindakan perbaikan dan pemantauan selanjutnya.\n\n1.3 Manfaat\n${narrative.benefit}\n\nBAB II\nHASIL DAN PEMBAHASAN\n\n2.1 Waktu dan Ruang Lingkup\nKegiatan yang dilaporkan berlangsung pada periode ${period}. ${narrative.scope} Data bersumber dari catatan petugas dan rekap INSAN-J sesuai dengan periode yang dipilih.\n\n2.2 Hasil Kegiatan\nBerdasarkan pencatatan yang telah dilakukan, diperoleh hasil sebagai berikut:\n\n${detailLines}\n\n2.3 Analisis dan Evaluasi\n${analysis}\n\n2.4 Kendala dan Temuan\nDalam pelaksanaan kegiatan, kendala atau temuan yang dicatat adalah sebagai berikut:\n${constraints}\n\n2.5 Tindak Lanjut dan Rekomendasi\n${recommendationSection}\n\n2.6 Catatan Tambahan\n${notes}\n\n2.7 Penyajian Tabel dan Grafik\nData pada laporan ini juga disajikan dalam bentuk tabel dan grafik untuk memudahkan pembacaan pola, perbandingan, dan komposisi hasil. Angka pada tabel dan grafik tetap perlu dicocokkan kembali dengan sumber data sebelum laporan ditetapkan.\n\nBAB III\nPENUTUP\n\n3.1 Kesimpulan\n${conclusion}\n\n3.2 Saran\n1. Data dan uraian dalam laporan perlu diperiksa kembali sebelum disahkan atau digunakan sebagai dokumen resmi.\n2. Informasi yang masih bertanda [PERLU DILENGKAPI] agar dilengkapi berdasarkan catatan atau bukti pelaksanaan yang tersedia.\n3. Tindak lanjut yang telah ditetapkan perlu didokumentasikan dan dievaluasi kembali pada periode berikutnya.\n\nCatatan: Dokumen ini masih berupa draf dan harus diperiksa oleh petugas Unit Sanitasi sebelum digunakan.`;
}

export function buildAutomaticAnalysis(payload = {}) {
  const facts = payload.facts || {};
  if (payload.reportType === 'medical_waste') {
    if (payload.analytics) return buildMedicalWasteAnalysis(facts, payload.analytics);
    const generated = Number(facts.totalGeneratedKg) || 0;
    const transported = Number(facts.totalTransportedKg) || 0;
    const opening = Number(facts.openingBalanceKg) || 0;
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
      ? `Setelah memperhitungkan sisa limbah awal periode sebesar ${formatNumberId(opening)} kg, masih terdapat limbah tersimpan sebanyak ${formatNumberId(difference)} kg pada akhir periode.`
      : difference < 0
        ? `Perhitungan menunjukkan ketidaksesuaian sebesar ${formatNumberId(Math.abs(difference))} kg karena pengangkutan melebihi sisa awal ditambah timbulan periode berjalan. Data perlu dicocokkan kembali dengan catatan TPS.`
        : `Setelah sisa limbah awal periode sebesar ${formatNumberId(opening)} kg diperhitungkan, jumlah limbah yang dikelola dan jumlah yang diangkut berada dalam keadaan seimbang.`;
    return `Selama periode pelaporan, timbulan limbah medis tercatat sebanyak ${formatNumberId(generated)} kg. Dari jumlah tersebut, limbah yang telah diangkut mencapai ${formatNumberId(transported)} kg atau sekitar ${formatNumberId(transportedPercent)}% dari total timbulan. ${balanceText}\n\nDitinjau dari jenisnya, ${dominantName} merupakan komponen terbesar, yaitu ${formatNumberId(dominantValue)} kg atau sekitar ${formatNumberId(dominantPercent)}% dari keseluruhan timbulan. Besarnya proporsi tersebut perlu diperhatikan dalam penyediaan wadah, pengaturan ruang penyimpanan sementara, serta pelaksanaan pengangkutan. Pemilahan di setiap ruangan juga perlu terus dipantau agar limbah ditempatkan sesuai dengan jenisnya.\n\nSecara umum, data tersebut memberikan gambaran mengenai hubungan antara timbulan dan pengangkutan selama periode berjalan. Apabila terdapat selisih, petugas perlu mencocokkannya dengan catatan stok di TPS limbah medis dan dokumen pengangkutan.`;
  }
  if (payload.reportType === 'lighting') {
    const total = Number(facts.totalPoints) || 0;
    const compliant = Number(facts.compliantPoints) || 0;
    const nonCompliant = Number(facts.nonCompliantPoints) || 0;
    const percent = total > 0 ? (compliant / total) * 100 : 0;
    return `Pengukuran dilakukan pada ${formatNumberId(total)} titik. Hasilnya menunjukkan bahwa ${formatNumberId(compliant)} titik telah memenuhi standar, sedangkan ${formatNumberId(nonCompliant)} titik lainnya masih belum memenuhi standar. Dengan demikian, tingkat kesesuaian pencahayaan pada periode ini mencapai sekitar ${formatNumberId(percent)}%.\n\nTitik yang belum memenuhi standar perlu ditinjau satu per satu dengan memperhatikan kondisi lampu dan armatur, kebersihan penutup lampu, tata letak sumber cahaya, serta kebutuhan pencahayaan sesuai fungsi ruangan. Hasil peninjauan tersebut selanjutnya digunakan untuk menentukan tindakan perbaikan yang paling sesuai.`;
  }
  return `Berdasarkan hasil yang dicatat, pelaksanaan ${REPORT_TYPES[payload.reportType]?.label.toLowerCase() || 'kegiatan'} telah memberikan informasi mengenai kondisi pada periode pelaporan. Setiap hasil perlu dibaca bersama lokasi, waktu pemeriksaan, metode yang digunakan, dan kondisi lapangan saat kegiatan berlangsung.\n\nPenetapan status memenuhi atau tidak memenuhi syarat harus didasarkan pada hasil pemeriksaan serta nilai standar yang digunakan. Temuan yang belum sesuai perlu ditelusuri penyebabnya, kemudian dihubungkan dengan tindakan yang telah dilakukan agar efektivitas tindak lanjut dapat dinilai pada pemantauan berikutnya.`;
}

export function buildReportConclusion(payload = {}) {
  const facts = payload.facts || {};
  if (payload.reportType === 'medical_waste') {
    if (payload.analytics) return buildMedicalWasteConclusion(facts, payload.analytics);
    const difference = Number(facts.remainingKg) || 0;
    const opening = Number(facts.openingBalanceKg) || 0;
    const condition = difference > 0
      ? `Masih terdapat selisih timbulan yang belum terangkut sebesar ${formatNumberId(difference)} kg pada periode pelaporan.`
      : difference < 0
        ? `Jumlah yang diangkut lebih besar ${formatNumberId(Math.abs(difference))} kg dibandingkan timbulan periode berjalan, yang mengindikasikan adanya pengangkutan sisa dari periode sebelumnya.`
        : 'Jumlah timbulan dan pengangkutan pada periode pelaporan berada dalam keadaan seimbang.';
    return `Dengan memperhitungkan sisa limbah awal periode sebesar ${formatNumberId(opening)} kg, pengelolaan limbah medis selama periode yang dilaporkan mencatat timbulan sebanyak ${formatNumberId(facts.totalGeneratedKg)} kg dan pengangkutan sebanyak ${formatNumberId(facts.totalTransportedKg)} kg. ${condition} Hasil ini perlu dicocokkan dengan kondisi penyimpanan di TPS limbah medis dan catatan pengangkutan sebelum laporan ditetapkan.`;
  }
  if (payload.reportType === 'lighting') {
    return `Pemeriksaan pencahayaan telah dilakukan pada ${formatNumberId(facts.totalPoints)} titik. Sebanyak ${formatNumberId(facts.compliantPoints)} titik memenuhi standar dan ${formatNumberId(facts.nonCompliantPoints)} titik masih memerlukan tindak lanjut. Perbaikan perlu diprioritaskan pada lokasi yang belum memenuhi standar dan hasilnya dipantau kembali.`;
  }
  return `Pelaksanaan ${REPORT_TYPES[payload.reportType]?.label.toLowerCase() || 'kegiatan'} pada periode yang dilaporkan telah didokumentasikan berdasarkan data dan keterangan yang tersedia. Hasil pemeriksaan, temuan, serta tindak lanjut perlu ditelaah secara bersama-sama agar kesimpulan akhir sesuai dengan kondisi lapangan.`;
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
  const report = String(draft || '');
  return Object.values(facts)
    .filter(value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)))
    .every(value => report.includes(String(Number(value))) || report.includes(formatNumberId(value)));
}
