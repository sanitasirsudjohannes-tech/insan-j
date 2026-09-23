const numberId = value => new Intl.NumberFormat('id-ID').format(Number(value) || 0);

export function buildWaterAnalysis(reportType, analytics = {}) {
  const total = Number(analytics.totalExaminations) || 0;
  const parameters = Number(analytics.totalParameters) || 0;
  const failed = Number(analytics.nonCompliantParameters) || 0;
  const locations = analytics.locations?.length || 0;
  if (!total) return 'Tidak terdapat data pemeriksaan air pada periode yang dipilih. Kesimpulan mengenai pemenuhan baku mutu belum dapat dibuat.';
  const compliance = parameters > 0 ? ((parameters - failed) / parameters) * 100 : 0;
  const base = `Pada periode pelaporan terdapat ${numberId(total)} pemeriksaan pada ${numberId(locations)} titik/lokasi dengan ${numberId(parameters)} hasil parameter. Sebanyak ${numberId(parameters - failed)} parameter berstatus memenuhi dan ${numberId(failed)} parameter berstatus tidak memenuhi, sehingga tingkat pemenuhan berdasarkan status yang dicatat adalah ${compliance.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%.`;
  if (reportType === 'wastewater') {
    return `${base} Data terdiri atas ${numberId(analytics.inletCount)} pemeriksaan inlet dan ${numberId(analytics.outletCount)} pemeriksaan outlet. Hasil outlet perlu menjadi fokus penilaian akhir karena menggambarkan kualitas air setelah proses pengolahan IPAL.`;
  }
  return `${base} Lokasi atau parameter yang tidak memenuhi perlu ditelusuri penyebabnya, ditindaklanjuti, dan dijadwalkan untuk pemeriksaan ulang.`;
}

export function buildWaterConclusion(reportType, analytics = {}) {
  const total = Number(analytics.totalExaminations) || 0;
  const failed = Number(analytics.nonCompliantParameters) || 0;
  if (!total) return 'Belum tersedia hasil pemeriksaan pada periode ini sehingga kondisi kualitas air belum dapat disimpulkan.';
  const subject = reportType === 'wastewater' ? 'air limbah pada inlet dan outlet IPAL' : 'air bersih pada lokasi sampling';
  return failed
    ? `Pemeriksaan ${subject} telah dilaksanakan sebanyak ${numberId(total)} kali. Ditemukan ${numberId(failed)} parameter berstatus tidak memenuhi baku mutu yang memerlukan tindak lanjut dan pemantauan ulang.`
    : `Pemeriksaan ${subject} telah dilaksanakan sebanyak ${numberId(total)} kali dan seluruh parameter yang dicatat berstatus memenuhi baku mutu.`;
}

