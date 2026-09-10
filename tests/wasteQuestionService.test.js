import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWasteAnswer } from '../src/lib/wasteQuestionAnswer.js';
import { normalizeAiWasteQuestion, parseWasteQuestion } from '../src/lib/wasteQuestionParser.js';

const recap = {
  facts: { openingBalanceKg: 10, totalGeneratedKg: 40, totalTransportedKg: 35, remainingKg: 15, infectiousKg: 30, sharpsKg: 5, bottleKg: 3, cytotoxicKg: 2 },
  charts: { rooms: [{ name: 'Ruang A', value: 20 }], roomDetails: [{ name: 'ICU', infectiousKg: 12, sharpsKg: 3, bottleKg: 2, cytotoxicKg: 1, totalKg: 18 }] },
  analytics: { performance: { averageDailyKg: 1.29, transportedCoveragePercent: 70 }, changes: { generatedPercent: 10, transportedPercent: -5, remainingKg: 5 }, dominantType: { name: 'limbah infeksius', current: 30 } },
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
  assert.match(answer.text, /Sisa awal: 10 kg/);
  assert.match(answer.text, /Timbulan: 40 kg/);
  assert.match(answer.text, /Diangkut: 35 kg/);
  assert.match(answer.text, /Sisa akhir: 15 kg/);
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
  assert.equal(answer.visualization.title, 'Tren timbulan');
  assert.match(answer.source, /data INSAN-J yang telah tersinkron/);
  assert.ok(answer.followUps.length >= 3);
  assert.equal(answer.reportPayload.period.start, '2026-07-01');
});
