import { formatDate, formatNumber as format } from '../formatters/wasteAnswerFormatters.js';

export function buildOperationalAnswer(parsed, recap) {
  const d = recap.diagnostics || {}, period = parsed.period.label;
  const normalize = value => String(value || '').trim().toLocaleLowerCase('id-ID');
  const match = name => !parsed.roomName || normalize(name) === normalize(parsed.roomName);
  const lines = rows => rows.length ? rows.map(row => `• ${formatDate(row.date)} — ${row.roomName || 'catatan manual'}${row.count ? `: ${row.count} catatan` : ''}`).join('\n') : 'Tidak ditemukan catatan sesuai pemeriksaan pada periode ini.';
  const inputs = d.roomInputs || [];
  const timeline = recap.charts.timeline || [];
  const collections = {
    exact_duplicates: ['Kemungkinan catatan identik', d.exactDuplicates],
    negative_records: ['Catatan bernilai negatif', d.negativeRows],
    zero_rooms: ['Catatan ruangan dengan semua jenis bernilai nol', d.zeroRooms],
    missing_officers: ['Catatan ruangan tanpa nama petugas', d.missingOfficers],
    future_records: ['Catatan bertanggal setelah hari ini', d.futureRows],
  };
  if (collections[parsed.intent]) {
    const [title, rows = []] = collections[parsed.intent];
    return `${title} — ${period}\n\n${lines(rows.filter(row => match(row.roomName)))}\n\nTemuan perlu dikonfirmasi; jangan langsung dianggap salah atau dihapus.`;
  }
  switch (parsed.intent) {
    case 'transport_vs_generated':
    case 'transport_vs_available': {
      const available = parsed.intent === 'transport_vs_available';
      const base = recap.facts.totalGeneratedKg + (available ? recap.facts.openingBalanceKg : 0);
      const delta = recap.facts.totalTransportedKg - base;
      return `Perbandingan pengangkutan — ${period}\n\n• Diangkut: ${format(recap.facts.totalTransportedKg)} kg.\n• ${available ? 'Sisa awal + timbulan' : 'Timbulan'}: ${format(base)} kg.\n• Pengangkutan ${delta > 0 ? `lebih besar ${format(delta)} kg` : delta === 0 ? 'sama besar' : `lebih kecil ${format(-delta)} kg`}.\n\n${available ? 'Jika melebihi limbah tersedia, periksa kelengkapan data.' : 'Pengangkutan dapat berasal dari sisa periode sebelumnya; melebihi timbulan periode ini belum tentu salah.'}`;
    }
    case 'day_extremes': {
      const days = timeline.filter(row => row.generated > 0).sort((a, b) => a.generated - b.generated);
      return days.length ? `Timbulan harian — ${period}\n\n• Terendah: ${formatDate(days[0].date)}, ${format(days[0].generated)} kg.\n• Tertinggi: ${formatDate(days.at(-1).date)}, ${format(days.at(-1).generated)} kg.\n\nTanggal tanpa input dan nilai nol tidak disertakan.` : 'Belum ada timbulan positif tercatat.';
    }
    case 'input_officers': return `Petugas input ruangan${parsed.roomName ? ` — ${parsed.roomName}` : ''} — ${period}\n\n${[...new Set((d.officerRecords || []).filter(row => match(row.roomName)).map(row => `• ${formatDate(row.date)} — ${row.roomName || '(nama ruangan kosong)'}: ${row.officer || 'nama petugas tidak tercatat'}`))].join('\n') || 'Belum ada catatan ruangan.'}`;
    case 'room_input_history': return `Jumlah ruangan unik per hari — ${period}\n\n${inputs.map(row => `• ${formatDate(row.date)}: ${row.count} ruangan`).join('\n') || 'Tidak ada tanggal yang dapat diperiksa.'}`;
    case 'fewest_room_inputs': {
      const minimum = Math.min(...inputs.map(row => row.count));
      return inputs.length ? `Jumlah input paling sedikit — ${period}\n\n${inputs.filter(row => row.count === minimum).map(row => `• ${formatDate(row.date)}: ${row.count} ruangan`).join('\n')}\n\nNol berarti tidak ada nama ruangan tercatat, bukan berat limbah nol.` : 'Tidak ada tanggal yang dapat diperiksa.';
    }
    case 'room_record_days': {
      const days = inputs.filter(row => parsed.roomName ? row.names.some(match) : row.count > 0);
      return `${parsed.roomName || 'Ruangan'} memiliki catatan pada ${days.length} hari selama ${period}. Catatan dengan berat nol tetap dihitung.\n\n${days.map(row => `• ${formatDate(row.date)}`).join('\n')}`;
    }
    case 'unknown_rooms': return d.unknownRooms === null ? 'Daftar ruangan resmi belum tersedia sehingga nama ruangan belum dapat diverifikasi.' : `Nama di luar daftar ruangan resmi — ${period}\n\n${d.unknownRooms?.length ? d.unknownRooms.map(name => `• ${name}`).join('\n') : 'Tidak ditemukan.'}`;
    case 'room_outliers': {
      if (!(d.roomPatternNames || []).some(match)) return `Belum cukup data untuk memeriksa pola ruangan selama ${period}. Diperlukan minimal 6 hari tercatat per ruangan.`;
      const rows = (d.roomOutliers || []).filter(row => match(row.roomName));
      return `Pemeriksaan pola ruangan — ${period}\n\n${rows.length ? rows.map(row => `• ${formatDate(row.date)} — ${row.roomName}: ${format(row.amount)} kg; median hari pembanding ${format(row.median)} kg.`).join('\n') : 'Tidak ditemukan lonjakan dengan kriteria ini pada ruangan yang memiliki data cukup.'}\n\nIndikator: lebih dari 3 kali median minimal 5 hari tercatat lainnya dalam periode yang sama. Hari tanpa input tidak dianggap nol. Ini bukan bukti data salah.`;
    }
    case 'negative_balance_dates': return `Tanggal sisa akhir harian negatif — ${period}\n\n${timeline.filter(row => row.balance < 0).map(row => `• ${formatDate(row.date)}: ${format(row.balance)} kg`).join('\n') || 'Tidak ditemukan pada tanggal dengan transaksi dalam periode ini.'}`;
    case 'recorded_day_average': return `Rata-rata timbulan per hari tercatat — ${period}\n\n${d.recordedWasteDays ? `${format(recap.facts.totalGeneratedKg / d.recordedWasteDays)} kg dari ${d.recordedWasteDays} hari. Hari dengan input nol tetap dihitung; tanggal tanpa input tidak dihitung.` : 'Belum ada input timbulan.'}`;
    case 'since_transport': {
      const last = timeline.filter(row => row.transported > 0).at(-1);
      return last ? `Timbulan setelah tanggal pengangkutan terakhir dalam ${period}\n\n• Pengangkutan: ${formatDate(last.date)}.\n• Timbulan setelah tanggal tersebut sampai akhir periode: ${format(timeline.filter(row => row.date > last.date).reduce((sum, row) => sum + row.generated, 0))} kg.\n\nTimbulan pada hari pengangkutan tidak dimasukkan karena urutan waktu input dan pengangkutan tidak diketahui.` : `Tidak ditemukan pengangkutan dalam ${period}. Pilih periode lebih panjang untuk mencari pengangkutan sebelumnya.`;
    }
    case 'transport_balance': {
      const last = timeline.filter(row => row.transported > 0).at(-1);
      return last ? `Perhitungan pada tanggal pengangkutan terakhir dalam ${period}\n\n• ${formatDate(last.date)}: sisa akhir hari ${format(last.balance)} kg.\n• Pengangkutan hari itu: ${format(last.transported)} kg.\n• Sisa sebelum pengurangan pengangkutan, setelah seluruh timbulan hari itu dihitung: ${format(last.balance + last.transported)} kg.\n\nIni perhitungan harian, bukan stok tepat sesaat sebelum dan sesudah truk datang; urutan waktunya tidak tersedia.` : `Tidak ada pengangkutan tercatat selama ${period}.`;
    }
    case 'daily_details': {
      const transport = /transport/.test(parsed.detailIntent || '');
      const rows = parsed.roomName ? (recap.charts.roomTypeTimeline || []).filter(row => match(row.roomName)) : timeline;
      const total = row => parsed.type ? Number(row[parsed.type.key]) || 0 : transport ? row.transported : parsed.roomName ? ['infectiousKg', 'sharpsKg', 'bottleKg', 'cytotoxicKg'].reduce((sum, key) => sum + (Number(row[key]) || 0), 0) : row.generated;
      return `Rincian ${transport ? 'pengangkutan' : parsed.type?.label || 'timbulan'}${parsed.roomName ? ` — ${parsed.roomName}` : ''} — ${period}\n\n${rows.map(row => `• ${formatDate(row.date)}: ${format(total(row))} kg`).join('\n') || 'Belum ada catatan.'}`;
    }
    default: return null;
  }
}
