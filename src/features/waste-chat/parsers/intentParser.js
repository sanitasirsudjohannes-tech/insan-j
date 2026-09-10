export function detectWasteIntent(text, { type, types, roomName }) {
  if (/banding|perbandingan|dibanding|naik|turun|perubahan|selisih|\bvs\.?\b/i.test(text)) return 'comparison';
  if (/(?:tanggal|tgl|hari)\s+(?:berapa|apa)(?:\s+saja)?.*(?:diangkut|pengangkutan|angkut)|(?:diangkut|pengangkutan|angkut).*(?:tanggal|tgl|hari)\s+(?:berapa|apa)(?:\s+saja)?/i.test(text)) return 'transport_dates';
  if (type && /(?:tanggal|tgl|hari)\s+(?:berapa|apa)(?:\s+saja)?.*(?:ada|terdapat|tercatat|timbul|dihasilkan)|(?:ada|terdapat|tercatat|timbul|dihasilkan).*(?:tanggal|tgl|hari)\s+(?:berapa|apa)(?:\s+saja)?/i.test(text)) return 'type_dates';
  if (type && /(?:ruang(?:an)?|unit|bangsal).*(?:yang\s+)?(?:ada|memiliki|menghasilkan|terdapat|punya)|(?:ruang(?:an)?|unit|bangsal)\s+(?:apa|mana)(?:\s+saja)?/i.test(text)) return 'type_rooms';
  if (/(?:ruang|unit|penghasil).*(?:terkecil|terendah|tersedikit|paling sedikit)|(?:terkecil|terendah|tersedikit|paling sedikit).*(?:ruang|unit|penghasil)/i.test(text)) return 'bottom_room';
  if (/(?:ruang|unit|penghasil).*(?:terbesar|terbanyak|tertinggi|paling|ranking|urutan)|(?:terbesar|terbanyak|tertinggi|paling).*(?:ruang|unit|penghasil)/i.test(text)) return 'top_rooms';
  if (roomName && type) return 'room_type_total';
  if (roomName && /berapa|jumlah|total|timbulan|dihasilkan/i.test(text)) return 'room_total';
  if (/(?:tanggal|hari).*(?:timbulan|limbah).*(?:terbesar|terbanyak|tertinggi|paling banyak)|(?:timbulan|limbah).*(?:terbesar|terbanyak|tertinggi|paling banyak).*(?:tanggal|hari)/i.test(text)) return 'peak_day';
  if (/berapa\s+hari|jumlah\s+hari|hari.*(?:tercatat|ada data|ada timbulan)/i.test(text)) return 'active_days';
  if (/jenis.*(?:dominan|terbesar|tertinggi|terbanyak|paling)|dominan/i.test(text)) return 'dominant_type';
  if (types.length > 1 || /(?:rincian.*jenis)|(?:rincian|jumlah|timbulan|data).*(?:berdasarkan|per|masing[ -]?masing)\s+jenis|semua jenis|komposisi|jenis\s+limbah/i.test(text)) return 'type_breakdown';
  if (type) return 'type_total';
  if (/(?:rincian|ringkasan|rekap|ikhtisar|gambaran|detail|data)\s+(?:data\s+)?limbah|limbah\s+secara\s+keseluruhan/i.test(text)) return 'waste_summary';
  if (/sisa\s+awal|awal\s+periode/i.test(text)) return 'opening_balance';
  if (/limbah.*(?:tersedia|dikelola)|total.*(?:tersedia|dikelola)/i.test(text)) return 'available_total';
  if (/persen.*(?:angkut|pengangkutan)|cakupan.*(?:angkut|pengangkutan)/i.test(text)) return 'transport_coverage';
  if (/rata[ -]?rata|rerata|rataan|per\s*hari/i.test(text)) return 'average';
  if (/sisa|tersisa|tersimpan|penumpukan|menumpuk|belum.*(?:angkut|dibawa|dikirim|keluar)/i.test(text)) return 'remaining';
  if (/diangkut|terangkut|pengangkutan|angkut|dibawa|dikirim|pengiriman|keluar/i.test(text)) return 'transported';
  if (/timbulan|dihasilkan|menghasilkan|produksi|terkumpul|hasil\s+timbang|berat\s+limbah|total limbah|limbah masuk/i.test(text)) return 'generated';
  return 'unknown';
}
