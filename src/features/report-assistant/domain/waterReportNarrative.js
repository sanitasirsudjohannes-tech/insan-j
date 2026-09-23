const numberId = value => new Intl.NumberFormat('id-ID').format(Number(value) || 0);

export function buildWaterAnalysis(reportType, analytics = {}) {
  const total = Number(analytics.totalExaminations) || 0;
  const parameters = Number(analytics.totalParameters) || 0;
  const failed = Number(analytics.nonCompliantParameters) || 0;
  const locations = analytics.locations?.length || 0;
  if (!total) return 'Tidak terdapat data pemeriksaan air pada periode yang dipilih. Kesimpulan mengenai pemenuhan baku mutu belum dapat dibuat.';
  const unassessed = Number(analytics.unassessedParameters) || 0;
  const assessed = parameters - unassessed;
  const compliance = assessed > 0 ? ((assessed - failed) / assessed) * 100 : 0;
  const base = `Pada periode pelaporan terdapat ${numberId(total)} pemeriksaan pada ${numberId(locations)} titik/lokasi dengan ${numberId(parameters)} hasil parameter. Sebanyak ${numberId(assessed - failed)} parameter berstatus memenuhi, ${numberId(failed)} berstatus tidak memenuhi, dan ${numberId(unassessed)} belum dinilai. Persentase status memenuhi dari parameter yang sudah dinilai adalah ${compliance.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%; status dihitung dari angka hasil dan baku mutu yang dicatat serta perlu dicocokkan dengan laporan laboratorium.`;
  if (reportType === 'wastewater') {
    return `${base} Data terdiri atas ${numberId(analytics.inletCount)} pemeriksaan inlet dan ${numberId(analytics.outletCount)} pemeriksaan outlet. Hasil outlet perlu menjadi fokus penilaian akhir karena menggambarkan kualitas air setelah proses pengolahan IPAL.`;
  }
  return `${base} Lokasi atau parameter yang tidak memenuhi perlu ditelusuri penyebabnya, ditindaklanjuti, dan dijadwalkan untuk pemeriksaan ulang.`;
}

export function buildWaterConclusion(reportType, analytics = {}) {
  const total = Number(analytics.totalExaminations) || 0;
  const failed = Number(analytics.nonCompliantParameters) || 0;
  const unassessed = Number(analytics.unassessedParameters) || 0;
  if (!total) return 'Belum tersedia hasil pemeriksaan pada periode ini sehingga kondisi kualitas air belum dapat disimpulkan.';
  const subject = reportType === 'wastewater' ? 'air limbah pada inlet dan outlet IPAL' : 'air bersih pada lokasi sampling';
  return failed
    ? `Pemeriksaan ${subject} telah dilaksanakan sebanyak ${numberId(total)} kali. Ditemukan ${numberId(failed)} parameter berstatus tidak memenuhi baku mutu yang memerlukan tindak lanjut dan pemantauan ulang.`
    : unassessed
      ? `Pemeriksaan ${subject} telah dilaksanakan sebanyak ${numberId(total)} kali, tetapi ${numberId(unassessed)} parameter belum dinilai. Pemenuhan baku mutu belum dapat disimpulkan untuk seluruh parameter.`
      : `Pemeriksaan ${subject} telah dilaksanakan sebanyak ${numberId(total)} kali. Seluruh parameter yang dapat dibandingkan secara numerik berstatus memenuhi; cocokkan kembali dengan laporan laboratorium sebelum menetapkan kesimpulan akhir.`;
}

