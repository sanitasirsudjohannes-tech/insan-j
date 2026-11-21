const modules = [
  {
    icon: 'fa-trash-alt',
    title: 'Limbah Dihasilkan',
    text: 'Catat timbulan limbah per ruangan dan limbah anorganik dari kegiatan rumah sakit.',
    tag: 'Pencatatan',
  },
  {
    icon: 'fa-truck',
    title: 'Pengangkutan Limbah',
    text: 'Kelola pencatatan pengangkutan sehingga alur limbah dapat ditelusuri dari sumbernya.',
    tag: 'Pengelolaan',
  },
  {
    icon: 'fa-clipboard-check',
    title: 'Inspeksi Sanitasi',
    text: 'Dokumentasikan pemeriksaan sanitasi secara terstruktur untuk membantu pemantauan lapangan.',
    tag: 'Pemantauan',
  },
  {
    icon: 'fa-tint',
    title: 'Pemeriksaan Air',
    text: 'Kelola pemeriksaan air bersih dan air limbah beserta parameter hasil pemeriksaannya.',
    tag: 'Lingkungan',
  },
  {
    icon: 'fa-chart-bar',
    title: 'Rekap Limbah',
    text: 'Lihat dan olah data menjadi rekapitulasi yang lebih mudah dibaca untuk kebutuhan pelaporan.',
    tag: 'Informasi',
  },
  {
    icon: 'fa-file-alt',
    title: 'Asisten Laporan',
    text: 'Membantu menelusuri informasi dan menyusun kebutuhan laporan dari data yang tersedia.',
    tag: 'Pendukung',
  },
];

import { useLandingContent } from './useLandingContent';

export default function ModulesSection() {
  const { content } = useLandingContent();
  const { badge, title, description } = content.modules;

  return (
    <section id="modul" className="bg-slate-900/70 px-5 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div data-landing-reveal className="max-w-3xl translate-y-4 opacity-0 transition-all duration-700">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">{badge}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
          <p className="mt-4 text-sm leading-6 text-slate-400 whitespace-pre-wrap">{description}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(module => (
            <article key={module.title} data-landing-reveal className="group translate-y-4 rounded-2xl border border-white/10 bg-white/4 p-6 opacity-0 transition-all duration-700 hover:-translate-y-1 hover:border-cyan-300/20 hover:bg-white/[0.07]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300 transition group-hover:bg-cyan-400/15">
                  <i className={`fas ${module.icon}`} />
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-400">{module.tag}</span>
              </div>
              <h3 className="mt-5 font-bold">{module.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{module.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
