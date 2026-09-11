import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWasteAnswer } from '../src/lib/wasteQuestionAnswer.js';
import { normalizeAiWasteQuestion, parseWasteQuestion } from '../src/lib/wasteQuestionParser.js';

const recap = {
  facts: { openingBalanceKg: 10, totalGeneratedKg: 40, totalTransportedKg: 35, remainingKg: 15, infectiousKg: 30, sharpsKg: 5, bottleKg: 3, cytotoxicKg: 2 },
  charts: { rooms: [{ name: 'Ruang A', value: 20 }], roomDetails: [{ name: 'ICU', infectiousKg: 12, sharpsKg: 3, bottleKg: 2, cytotoxicKg: 1, totalKg: 18 }] },
  analytics: {
    performance: { averageDailyKg: 1.29, transportedCoveragePercent: 70 },
    changes: { generatedPercent: 10, transportedPercent: -5, remainingKg: 5 },
    dominantType: { name: 'limbah infeksius', current: 30 },
    types: [
      { key: 'infectiousKg', name: 'limbah infeksius', current: 30, previous: 20 },
      { key: 'sharpsKg', name: 'limbah jarum suntik', current: 5, previous: 4 },
      { key: 'bottleKg', name: 'limbah botol obat', current: 3, previous: 2 },
      { key: 'cytotoxicKg', name: 'limbah sitotoksik', current: 2, previous: 1 },
    ],
    rooms: [{ name: 'ICU', current: 18, previous: 12 }],
  },
};

test('jawaban sisa menjelaskan sumber perhitungan', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Sisa limbah Juli 2026?'), recap);
  assert.match(answer.text, /15 kg/);
  assert.match(answer.text, /Sisa awal: 10 kg/);
  assert.match(answer.text, /pengangkutan: 35 kg/);
});

test('jawaban rincian jenis menampilkan seluruh jenis dan total', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Rincian limbah berdasarkan jenis tanggal 5 September 2026'), recap);
  assert.match(answer.text, /limbah infeksius: 30 kg/);
  assert.match(answer.text, /limbah jarum suntik: 5 kg/);
  assert.match(answer.text, /limbah botol obat: 3 kg/);
  assert.match(answer.text, /limbah sitotoksik: 2 kg/);
  assert.match(answer.text, /Total: 40 kg/);
});

test('jawaban dapat menampilkan total jenis dari ruangan tertentu per tanggal', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Berapa infeksius ruangan ICU tanggal 5 September 2026?'), recap);
  assert.match(answer.text, /limbah infeksius dari ICU/);
  assert.match(answer.text, /12 kg/);
  assert.match(answer.text, /5 September 2026/);
});

test('ringkasan data limbah memuat alur dan komposisi utama', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Rincian data limbah Juli 2026'), recap);
  assert.ok(answer.text.indexOf('Sisa limbah: 15 kg') < answer.text.indexOf('Sisa awal: 10 kg'));
  assert.match(answer.text, /Sisa awal: 10 kg/);
  assert.match(answer.text, /Ditambah timbulan: 40 kg/);
  assert.match(answer.text, /Dikurangi pengangkutan: 35 kg/);
  assert.match(answer.text, /limbah infeksius: 30 kg/);
});

test('jawaban ruangan berasal dari data rekap terurut', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Ruangan terbesar Juli 2026?'), recap);
  assert.match(answer.text, /Ruang A/);
  assert.match(answer.text, /20 kg/);
});

test('jawaban timbulan tahunan menyebut cakupan tahun penuh', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Timbulan limbah tahun 2026?'), recap);
  assert.match(answer.text, /selama tahun 2026/);
  assert.match(answer.text, /40 kg/);
});

test('hasil pemahaman AI divalidasi lalu dijawab dari data rekap', () => {
  const parsed = normalizeAiWasteQuestion('Berapa yang belum sempat dibawa pada tanggal lima September?', {
    intent: 'remaining', year: 2026, month: 9, day: 5, typeKey: null, inferredYear: true,
  });
  const answer = buildWasteAnswer(parsed, recap);
  assert.equal(parsed.period.start, '2026-09-05');
  assert.equal(parsed.period.end, '2026-09-05');
  assert.equal(parsed.assistedByAi, true);
  assert.match(answer.text, /15 kg/);
});

test('angka pecahan pada jawaban dibulatkan tanpa desimal', () => {
  const fractionalRecap = {
    ...recap,
    facts: { ...recap.facts, totalGeneratedKg: 40.6 },
  };
  const answer = buildWasteAnswer(parseWasteQuestion('Timbulan Juli 2026?'), fractionalRecap);
  assert.match(answer.text, /41 kg/);
  assert.doesNotMatch(answer.text, /40[,.]6/);
});

test('jawaban membandingkan dua bulan yang diminta secara langsung', () => {
  const parsed = parseWasteQuestion('Lakukan perbandingan limbah Februari dan Juli 2026');
  const february = {
    ...recap,
    facts: { ...recap.facts, totalGeneratedKg: 100, totalTransportedKg: 80, remainingKg: 30 },
  };
  const july = {
    ...recap,
    facts: { ...recap.facts, totalGeneratedKg: 125, totalTransportedKg: 100, remainingKg: 35 },
  };
  const answer = buildWasteAnswer(parsed, july, february);
  assert.match(answer.text, /Perbandingan Februari 2026 dan Juli 2026/);
  assert.match(answer.text, /Timbulan: 100 kg menjadi 125 kg, naik 25 kg \(25%\)/);
  assert.match(answer.text, /Pengangkutan: 80 kg menjadi 100 kg/);
  assert.match(answer.text, /Sisa akhir: 30 kg menjadi 35 kg/);
  assert.ok(answer.text.indexOf('Sisa akhir') < answer.text.indexOf('Timbulan'));
  assert.doesNotMatch(answer.text, /periode sebelumnya/);
});

test('jawaban tanggal pengangkutan memuat tanggal dan jumlah per hari', () => {
  const aprilRecap = {
    ...recap,
    facts: { ...recap.facts, totalTransportedKg: 1731 },
    charts: {
      ...recap.charts,
      timeline: [
        { date: '2026-04-03', generated: 50, transported: 700 },
        { date: '2026-04-10', generated: 40, transported: 1031 },
        { date: '2026-04-11', generated: 20, transported: 0 },
      ],
    },
  };
  const answer = buildWasteAnswer(parseWasteQuestion('Tgl berapa saja pengangkutan bulan April 2026'), aprilRecap);
  assert.match(answer.text, /Tercatat pada 2 tanggal/);
  assert.match(answer.text, /3 April 2026: 700 kg/);
  assert.match(answer.text, /10 April 2026: 1\.031 kg/);
  assert.match(answer.text, /Total 1\.731 kg/);
  assert.doesNotMatch(answer.text, /11 April/);
});

test('frasa singkat tanggal pengangkutan menghasilkan daftar tanggal', () => {
  const augustRecap = {
    ...recap,
    facts: { ...recap.facts, totalTransportedKg: 10800 },
    charts: {
      ...recap.charts,
      timeline: [
        { date: '2026-08-19', generated: 0, transported: 2850 },
        { date: '2026-08-26', generated: 0, transported: 7950 },
      ],
    },
  };
  const parsed = parseWasteQuestion('Tanggal pengangkutan Agustus 2026');
  const answer = buildWasteAnswer(parsed, augustRecap);
  assert.equal(parsed.intent, 'transport_dates');
  assert.match(answer.text, /19 Agustus 2026: 2\.850 kg/);
  assert.match(answer.text, /26 Agustus 2026: 7\.950 kg/);
  assert.match(answer.text, /Total 10\.800 kg/);
});

test('daftar pengangkutan lintas bulan dikelompokkan dan diberi subtotal', () => {
  const yearlyRecap = {
    ...recap,
    facts: { ...recap.facts, totalTransportedKg: 6000 },
    charts: {
      ...recap.charts,
      timeline: [
        { date: '2026-02-12', transported: 2000 },
        { date: '2026-02-19', transported: 1000 },
        { date: '2026-07-02', transported: 3000 },
      ],
    },
  };
  const answer = buildWasteAnswer(parseWasteQuestion('Tgl berapa saja pengangkutan tahun 2026'), yearlyRecap);
  assert.match(answer.text, /Februari 2026 — 3\.000 kg/);
  assert.match(answer.text, /Juli 2026 — 3\.000 kg/);
  assert.match(answer.text, /\n\nJuli 2026/);
});

test('jawaban menampilkan daftar ruangan untuk jenis limbah tertentu', () => {
  const roomRecap = {
    ...recap,
    charts: {
      ...recap.charts,
      roomDetails: [
        { name: 'Kemoterapi', cytotoxicKg: 25 },
        { name: 'Farmasi', cytotoxicKg: 10 },
        { name: 'ICU', cytotoxicKg: 0 },
      ],
    },
  };
  const answer = buildWasteAnswer(parseWasteQuestion('Ruangan yg ada limbah sitotoksik nya bulan Agustus 2026'), roomRecap);
  assert.match(answer.text, /1\. Kemoterapi: 25 kg/);
  assert.match(answer.text, /2\. Farmasi: 10 kg/);
  assert.match(answer.text, /Total: 35 kg dari 2 ruangan/);
  assert.doesNotMatch(answer.text, /ICU/);
});

test('jawaban menampilkan tanggal untuk jenis limbah tertentu', () => {
  const typeRecap = {
    ...recap,
    charts: {
      ...recap.charts,
      timeline: [
        { date: '2026-08-04', cytotoxicKg: 12 },
        { date: '2026-08-09', cytotoxicKg: 8 },
        { date: '2026-08-10', cytotoxicKg: 0 },
      ],
    },
  };
  const answer = buildWasteAnswer(parseWasteQuestion('Tgl berapa saja adanya limbah sitotoksik bulan Agustus 2026'), typeRecap);
  assert.match(answer.text, /Tercatat pada 2 tanggal • Total 20 kg/);
  assert.match(answer.text, /4 Agustus 2026: 12 kg/);
  assert.match(answer.text, /9 Agustus 2026: 8 kg/);
  assert.doesNotMatch(answer.text, /10 Agustus/);
});

test('jawaban tanggal jenis limbah memfilter ruangan tertentu', () => {
  const roomTypeRecap = {
    ...recap,
    charts: {
      ...recap.charts,
      roomTypeTimeline: [
        { roomName: 'Bugenvil 2', date: '2026-09-01', cytotoxicKg: 4 },
        { roomName: 'Bugenvil 2', date: '2026-09-03', cytotoxicKg: 6 },
        { roomName: 'Bugenvil 1', date: '2026-09-03', cytotoxicKg: 50 },
      ],
    },
  };
  const answer = buildWasteAnswer(parseWasteQuestion('Tanggal berapa limbah sitotoksik pada ruangan Bugenvil 2 September 2026'), roomTypeRecap);
  assert.match(answer.text, /limbah sitotoksik pada Bugenvil 2/);
  assert.match(answer.text, /1 September 2026: 4 kg/);
  assert.match(answer.text, /3 September 2026: 6 kg/);
  assert.match(answer.text, /Total 10 kg/);
  assert.doesNotMatch(answer.text, /50 kg/);
});

test('jawaban analisis menyediakan kartu, grafik, sumber, dan pertanyaan lanjutan', () => {
  const answer = buildWasteAnswer(parseWasteQuestion('Analisis data limbah Juli 2026'), recap);
  assert.match(answer.text, /Analisis data limbah selama Juli 2026/);
  assert.equal(answer.cards.length, 3);
  assert.equal(answer.cards[0].label, 'Sisa Akhir');
  assert.ok(answer.text.indexOf('Sisa akhir') < answer.text.indexOf('Timbulan'));
  assert.equal(answer.visualization.title, 'Tren timbulan');
  assert.match(answer.source, /data server INSAN-J/);
  assert.equal(answer.understanding.intent, 'Analisis limbah');
  assert.match(answer.sourceLink.to, /^\/rekap-limbah\?/);
  assert.ok(answer.followUps.length >= 3);
  assert.equal(answer.reportPayload.period.start, '2026-07-01');
});

test('parser mengenali pertanyaan operasional pemeriksaan data', () => {
  assert.equal(parseWasteQuestion('Apakah ada tanggal yang belum diinput bulan Agustus 2026?').intent, 'data_completeness');
  assert.equal(parseWasteQuestion('Ruangan mana yang belum input tanggal 8 Agustus 2026?').intent, 'missing_rooms');
  assert.equal(parseWasteQuestion('Apakah ada data ganda bulan Agustus 2026?').intent, 'duplicate_data');
  assert.equal(parseWasteQuestion('Apakah ada data yang tidak wajar bulan Agustus 2026?').intent, 'data_anomalies');
  assert.equal(parseWasteQuestion('Kapan pengangkutan terakhir bulan Agustus 2026?').intent, 'last_transport');
  assert.equal(parseWasteQuestion('Berapa hari jeda pengangkutan bulan Agustus 2026?').intent, 'transport_gap');
});

test('parser tidak menukar pertanyaan statistik yang serupa', () => {
  const rooms = ['ICU', 'IGD', 'Bugenvil 2'];
  const cases = [
    ['Tanggal berapa timbulan paling tinggi?', 'peak_day'],
    ['Tanggal berapa timbulan paling rendah?', 'trough_day'],
    ['Berapa kali pengangkutan bulan ini?', 'transport_count'],
    ['Berapa rata-rata jumlah limbah setiap pengangkutan?', 'average_transport'],
    ['Jenis limbah apa yang paling sedikit?', 'least_type'],
    ['Berapa persentase masing-masing jenis limbah?', 'type_percentages'],
    ['Berapa kontribusi Bugenvil 2 terhadap total timbulan?', 'room_contribution'],
    ['Apakah ada ruangan yang tidak pernah mencatat sitotoksik?', 'never_type_rooms'],
    ['Bulan mana yang paling banyak pengangkutannya?', 'peak_month'],
    ['Pada bulan apa limbah jarum suntik paling tinggi?', 'peak_month'],
    ['Minggu mana yang menghasilkan limbah paling banyak?', 'peak_week'],
  ];
  cases.forEach(([question, expected]) => assert.equal(parseWasteQuestion(question, null, rooms).intent, expected, question));
});

test('peringkat periode menjawab bulan atau minggu yang ditanyakan', () => {
  const rankingRecap = {
    ...recap,
    charts: {
      ...recap.charts,
      timeline: [
        { date: '2026-07-02', generated: 100, transported: 50, sharpsKg: 10 },
        { date: '2026-08-02', generated: 150, transported: 80, sharpsKg: 20 },
        { date: '2026-08-09', generated: 200, transported: 120, sharpsKg: 30 },
      ],
    },
  };
  const monthParsed = parseWasteQuestion('Bulan mana yang paling banyak pengangkutannya tahun 2026?');
  assert.equal(monthParsed.period.scope, 'year');
  assert.match(buildWasteAnswer(monthParsed, rankingRecap).text, /Agustus 2026 sebanyak 200 kg/);
  const weekAnswer = buildWasteAnswer(parseWasteQuestion('Minggu mana yang menghasilkan limbah paling banyak Agustus 2026?'), rankingRecap);
  assert.match(weekAnswer.text, /minggu ke-2/);
  assert.match(weekAnswer.text, /200 kg/);
});

test('jawaban rata-rata pengangkutan tidak memakai rata-rata timbulan harian', () => {
  const diagnosticRecap = {
    ...recap,
    facts: { ...recap.facts, totalTransportedKg: 1200 },
    diagnostics: { transport: { recordCount: 3 } },
  };
  const answer = buildWasteAnswer(parseWasteQuestion('Berapa rata-rata setiap pengangkutan Agustus 2026?'), diagnosticRecap);
  assert.match(answer.text, /400 kg/);
  assert.match(answer.text, /3 catatan pengangkutan/);
  assert.doesNotMatch(answer.text, /per hari/);
});

test('perbandingan ruangan dan jenis memakai lingkup yang ditanyakan', () => {
  const scopedRecap = {
    ...recap,
    charts: {
      ...recap.charts,
      roomDetails: [
        { name: 'ICU', infectiousKg: 12, totalKg: 18 },
        { name: 'IGD', infectiousKg: 8, totalKg: 14 },
      ],
    },
  };
  const rooms = ['ICU', 'IGD'];
  const roomAnswer = buildWasteAnswer(parseWasteQuestion('Bandingkan limbah infeksius ICU dan IGD bulan ini', null, rooms), scopedRecap);
  assert.match(roomAnswer.text, /ICU: 12 kg/);
  assert.match(roomAnswer.text, /IGD: 8 kg/);
  const typeAnswer = buildWasteAnswer(parseWasteQuestion('Bandingkan limbah infeksius dan jarum bulan ini'), scopedRecap);
  assert.match(typeAnswer.text, /limbah infeksius: 30 kg/);
  assert.match(typeAnswer.text, /limbah jarum suntik: 5 kg/);
});

test('jawaban kelengkapan membedakan tanggal tanpa input dan seluruh nilai nol', () => {
  const diagnosticRecap = {
    ...recap,
    diagnostics: {
      checkedThrough: '2026-08-03', missingDates: ['2026-08-02'], zeroOnlyDates: ['2026-08-03'],
      missingRoomDays: [{ date: '2026-08-02', rooms: ['ICU'] }], roomMissingCounts: [{ name: 'ICU', days: 1 }],
      duplicateRoomDates: [], negativeRows: [], transport: { dates: [], lastDate: null, daysSinceLast: null, longestGap: null },
    },
  };
  const answer = buildWasteAnswer(parseWasteQuestion('Apakah ada tanggal yang belum diinput bulan Agustus 2026?'), diagnosticRecap);
  assert.match(answer.text, /2 Agustus 2026/);
  assert.match(answer.text, /3 Agustus 2026/);
  assert.match(answer.text, /belum tentu merupakan kesalahan/);
});

test('jawaban pengangkutan terakhir menyebut tanggal, jumlah, dan jeda', () => {
  const diagnosticRecap = {
    ...recap,
    charts: { ...recap.charts, timeline: [{ date: '2026-08-20', transported: 2000 }] },
    diagnostics: { transport: { lastDate: '2026-08-20', daysSinceLast: 11, longestGap: null } },
  };
  const answer = buildWasteAnswer(parseWasteQuestion('Kapan pengangkutan terakhir bulan Agustus 2026?'), diagnosticRecap);
  assert.match(answer.text, /20 Agustus 2026/);
  assert.match(answer.text, /2\.000 kg/);
  assert.match(answer.text, /11 hari/);
});


test('jawaban dapat membandingkan tiga bulan secara ringkas', () => {
  const parsed = parseWasteQuestion('Bandingkan Januari, Februari dan Maret 2026');
  const recaps = [100, 125, 90].map(total => ({
    ...recap,
    facts: { ...recap.facts, totalGeneratedKg: total, totalTransportedKg: total - 20, remainingKg: 30 },
  }));
  const answer = buildWasteAnswer(parsed, recaps[2], recaps[0], recaps);
  assert.match(answer.text, /Perbandingan pengelolaan limbah selama 3 bulan/);
  assert.match(answer.text, /Januari 2026: timbulan 100 kg/);
  assert.match(answer.text, /Februari 2026: timbulan 125 kg/);
  assert.match(answer.text, /Maret 2026: timbulan 90 kg/);
  assert.match(answer.text, /Timbulan tertinggi: Februari 2026/);
  assert.equal(answer.visualization.items.length, 3);
});
