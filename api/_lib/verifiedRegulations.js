const REGULATIONS = [
  {
    year: 2025,
    keywords: ['air limbah', 'limbah cair', 'ipal', 'domestik', 'baku mutu'],
    strongKeywords: ['air limbah', 'limbah cair', 'ipal', 'baku mutu'],
    title: 'Peraturan Menteri Lingkungan Hidup/BPLH Nomor 11 Tahun 2025 tentang Baku Mutu Air Limbah dan Standar Teknologi Pengolahan Air Limbah untuk Air Limbah Domestik',
    issuer: 'Kementerian Lingkungan Hidup/BPLH',
    status: 'Berlaku',
    relevance: 'Mengatur baku mutu dan standar teknologi pengolahan air limbah domestik serta mencabut Permen LHK P.68 Tahun 2016.',
    url: 'https://jdih.kemenlh.go.id/detail/peraturan-menteri-lingkungan-hidupbadan-pengendalian-lingkungan-hidup-nomor-11-tahun-2025',
  },
  {
    year: 2023,
    keywords: ['kesehatan lingkungan', 'rumah sakit', 'fasyankes', 'air', 'udara', 'pangan', 'vektor', 'limbah'],
    strongKeywords: ['kesehatan lingkungan'],
    title: 'Peraturan Menteri Kesehatan Nomor 2 Tahun 2023 tentang Peraturan Pelaksanaan Peraturan Pemerintah Nomor 66 Tahun 2014 tentang Kesehatan Lingkungan',
    issuer: 'Kementerian Kesehatan',
    status: 'Perlu diperiksa pada sumber',
    relevance: 'Menjadi rujukan pelaksanaan kesehatan lingkungan, termasuk standar dan persyaratan media lingkungan pada fasilitas pelayanan kesehatan.',
    url: 'https://peraturan.go.id/id/permenkes-no-2-tahun-2023',
  },
  {
    year: 2021,
    keywords: ['persetujuan lingkungan', 'pengelolaan lingkungan', 'air limbah', 'limbah b3', 'b3'],
    strongKeywords: ['persetujuan lingkungan', 'limbah b3'],
    title: 'Peraturan Pemerintah Nomor 22 Tahun 2021 tentang Penyelenggaraan Perlindungan dan Pengelolaan Lingkungan Hidup',
    issuer: 'Pemerintah Republik Indonesia',
    status: 'Berlaku',
    relevance: 'Mengatur persetujuan lingkungan, perlindungan mutu air, serta pengelolaan limbah B3 dan non-B3.',
    url: 'https://peraturan.go.id/id/pp-no-22-tahun-2021',
  },
];

export function findVerifiedRegulations(question, limit = 5) {
  const words = String(question || '').toLocaleLowerCase('id-ID');
  return REGULATIONS.map(item => {
    const matches = item.keywords.reduce((score, keyword) => score + (words.includes(keyword) ? 1 : 0), 0);
    const specificMatches = item.strongKeywords.reduce((score, keyword) => score + (words.includes(keyword) ? 5 : 0), 0);
    return { ...item, score: matches + specificMatches };
  }).filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || right.year - left.year)
    .slice(0, limit)
    .map(({ keywords, strongKeywords, year, score, ...item }) => item);
}
