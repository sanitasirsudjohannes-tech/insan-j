import { useLandingContent } from './useLandingContent';

const highlights = [
  ['fa-mobile-alt', 'Siap untuk lapangan', 'Antarmuka responsif untuk digunakan dari ponsel maupun komputer.'],
  ['fa-wifi', 'PWA & dukungan offline', 'Dirancang sebagai aplikasi web progresif dengan dukungan penyimpanan dan sinkronisasi data offline.'],
  ['fa-users-cog', 'Berbasis peran', 'Akses dan modul dapat disesuaikan dengan peran pengguna di dalam aplikasi.'],
  ['fa-database', 'Data terpusat', 'Data kegiatan sanitasi tersusun dalam satu sistem sehingga lebih mudah ditelusuri.'],
];

export default function AboutSection() {
  const { content } = useLandingContent();
  const { badge, title, description } = content.about;

  return (
    <section id="tentang" className="relative bg-slate-950 px-5 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div data-landing-reveal className="max-w-3xl translate-y-4 opacity-0 transition-all duration-700">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">{badge}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
          <p className="mt-5 leading-7 text-slate-400 whitespace-pre-wrap">{description}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map(([icon, title, text]) => (
            <div key={title} data-landing-reveal className="translate-y-4 rounded-2xl border border-white/10 bg-white/4 p-5 opacity-0 transition-all duration-700 hover:-translate-y-1 hover:bg-white/[0.07]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                <i className={`fas ${icon}`} />
              </div>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
