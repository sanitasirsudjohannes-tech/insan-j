import { formatNumber as format } from '../formatters/wasteAnswerFormatters.js';

export function calculationExplanation(parsed, recap) {
  const { facts, charts } = recap;
  const scope = `Perhitungan untuk ${parsed.period.label}${parsed.roomName ? `, ruangan ${parsed.roomName}` : ''}${parsed.type ? `, ${parsed.type.label}` : ''}.`;
  if (['remaining', 'waste_summary', 'opening_balance'].includes(parsed.intent)) return `${scope}\n\nSisa awal ${format(facts.openingBalanceKg)} kg + timbulan ${format(facts.totalGeneratedKg)} kg − pengangkutan ${format(facts.totalTransportedKg)} kg = sisa akhir ${format(facts.remainingKg)} kg.\n\nSisa awal berasal dari akumulasi sebelum periode. Perhitungan menggunakan angka asli; tampilan dibulatkan.`;
  if (parsed.roomName) {
    const row = (charts.roomDetails || []).find(item => item.name.toLocaleLowerCase('id-ID') === parsed.roomName.toLocaleLowerCase('id-ID'));
    if (['room_total', 'room_type_total'].includes(parsed.intent)) return `${scope}\n\nMenjumlahkan ${parsed.type?.label || 'empat jenis limbah'} dari seluruh catatan ruangan tersebut pada periode ini: ${format(row?.[parsed.type?.key || 'totalKg'] || 0)} kg. Catatan manual tidak dimasukkan. Angka tampilan dibulatkan.`;
  }
  if (parsed.intent === 'room_input_count') return `${scope}\n\nNama ruangan dihitung unik per tanggal. Beberapa catatan ruangan yang sama tetap dihitung satu ruangan; input 0 kg tetap dihitung. Cakupan = jumlah ruangan tercatat ÷ jumlah ruangan resmi × 100%.`;
  if (parsed.intent === 'generated') return `${scope}\n\nInfeksius ${format(facts.infectiousKg)} + jarum ${format(facts.sharpsKg)} + botol ${format(facts.bottleKg)} + sitotoksik ${format(facts.cytotoxicKg)} = ${format(facts.totalGeneratedKg)} kg.\n\nTermasuk catatan ruangan dan manual. Penjumlahan memakai angka asli sebelum pembulatan tampilan.`;
  return `${scope}\n\nAngka berasal dari catatan server sesuai periode dan lingkup pada jawaban. Catatan belum tersinkron tidak dimasukkan. Angka dihitung sebelum dibulatkan untuk tampilan. Gunakan rincian jawaban dan catatan sumber untuk pemeriksaan.`;
}
