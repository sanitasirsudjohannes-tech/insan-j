const workflow = [
  ['01', 'Catat di lapangan', 'Petugas memasukkan data kegiatan sanitasi melalui perangkat yang digunakan.'],
  ['02', 'Data tersimpan', 'Data dikumpulkan dan dikelola sesuai modul serta hak akses pengguna.'],
  ['03', 'Pantau & kelola', 'Informasi dapat ditinjau kembali untuk pemantauan kegiatan sanitasi.'],
  ['04', 'Rekap & laporkan', 'Data yang terkumpul menjadi dasar rekapitulasi dan kebutuhan pelaporan.'],
];

import { useLandingContent } from './useLandingContent';

export default function WorkflowSection() {
  const { content } = useLandingContent();
  const { badge, title, description } = content.workflow;

  return (
    <section id="alur" className="bg-slate-950 px-5 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div data-landing-reveal className="max-w-3xl translate-y-4 opacity-0 transition-all duration-700">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">{badge}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
          <p className="mt-4 text-sm leading-6 text-slate-400 whitespace-pre-wrap">{description}</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {workflow.map(([number, title, text], index) => (
            <div key={number} data-landing-reveal className="relative translate-y-4 border-t border-white/10 pt-5 opacity-0 transition-all duration-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300">{number}</span>
                {index < workflow.length - 1 && <span className="hidden text-slate-700 md:block">→</span>}
              </div>
              <h3 className="mt-3 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
