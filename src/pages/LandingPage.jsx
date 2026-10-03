import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import LoginBackdrop from '../features/login/LoginBackdrop';

const features = [
  {
    icon: 'fa-trash-alt',
    title: 'Manajemen Limbah',
    text: 'Pencatatan limbah per ruangan, anorganik, pengangkutan, hingga rekap data dalam satu alur.',
  },
  {
    icon: 'fa-clipboard-check',
    title: 'Inspeksi Sanitasi',
    text: 'Mendukung pencatatan inspeksi sanitasi secara terstruktur dan mudah dipantau.',
  },
  {
    icon: 'fa-tint',
    title: 'Monitoring Lingkungan',
    text: 'Pemeriksaan air bersih dan air limbah dapat dikelola sebagai bagian dari data sanitasi.',
  },
  {
    icon: 'fa-chart-line',
    title: 'Rekap & Informasi',
    text: 'Data operasional tersusun menjadi informasi yang lebih mudah dibaca dan digunakan.',
  },
];

const steps = [
  ['01', 'Input', 'Data sanitasi dicatat langsung dari perangkat yang digunakan petugas.'],
  ['02', 'Kelola', 'Data tersimpan terstruktur sesuai modul dan kebutuhan pengguna.'],
  ['03', 'Pantau', 'Informasi dapat ditinjau kembali untuk membantu pemantauan kegiatan.'],
  ['04', 'Rekap', 'Data yang terkumpul dapat digunakan untuk laporan dan evaluasi.'],
];

export default function LandingPage() {
  const observerRef = useRef(null);

  useEffect(() => {
    const nodes = document.querySelectorAll('[data-landing-reveal]');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(node => node.classList.add('opacity-100', 'translate-y-0'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.12 }
    );
    observerRef.current = observer;
    nodes.forEach(node => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <section className="relative isolate min-h-[88vh] overflow-hidden bg-linear-to-br from-slate-950 via-blue-950 to-emerald-950">
        <LoginBackdrop />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.18),transparent_42%)]" />
        <nav className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <a href="#beranda" className="flex items-center gap-3">
            <img src={import.meta.env.BASE_URL + "img/Icon.webp"} alt="INSAN-J" className="h-10 w-10 rounded-xl object-contain" />
            <div>
              <div className="text-sm font-extrabold tracking-wide">INSAN-J</div>
              <div className="text-[10px] text-slate-300">Sanitasi RSUD Johannes</div>
            </div>
          </a>
          <div className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <button type="button" onClick={() => document.getElementById("tentang")?.scrollIntoView({ behavior: "smooth" })} className="transition hover:text-white">Tentang</button>
            <button type="button" onClick={() => document.getElementById("fitur")?.scrollIntoView({ behavior: "smooth" })} className="transition hover:text-white">Fitur</button>
            <button type="button" onClick={() => document.getElementById("alur")?.scrollIntoView({ behavior: "smooth" })} className="transition hover:text-white">Alur</button>
          </div>
          <Link to="/login" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/20">
            Masuk
          </Link>
        </nav>

        <div id="beranda" className="relative z-10 mx-auto flex min-h-[calc(88vh-80px)] w-full max-w-7xl items-center px-5 py-16 sm:px-8 lg:px-10">
          <div className="max-w-3xl translate-y-4 opacity-0 transition-all duration-700" data-landing-reveal>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
              Sistem Informasi Sanitasi
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-7xl">
              INSAN-J
              <span className="block bg-linear-to-r from-cyan-300 via-white to-emerald-300 bg-clip-text text-transparent">
                Informasi Sanitasi Johannes
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Platform digital untuk membantu pencatatan, pemantauan, pengelolaan, dan rekapitulasi kegiatan sanitasi rumah sakit secara lebih terstruktur.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-slate-900 shadow-xl transition hover:-translate-y-0.5 hover:bg-cyan-50">
                Masuk ke Aplikasi <i className="fas fa-arrow-right text-xs" />
              </Link>
              <button type="button" onClick={() => document.getElementById("tentang")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10">
                Pelajari INSAN-J
              </button>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-slate-950 to-transparent" />
      </section>

      <section id="tentang" className="relative bg-slate-950 px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div data-landing-reveal className="translate-y-4 opacity-0 transition-all duration-700">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Tentang INSAN-J</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Satu ruang untuk data sanitasi rumah sakit.</h2>
            <p className="mt-5 max-w-2xl leading-7 text-slate-400">
              INSAN-J dirancang untuk mendekatkan proses pencatatan kegiatan sanitasi dengan data yang dapat dipantau dan digunakan kembali. Fokusnya bukan sekadar memasukkan data, tetapi membangun alur kerja yang lebih rapi dari lapangan sampai rekap.
            </p>
          </div>
          <div data-landing-reveal className="grid grid-cols-2 gap-3 sm:gap-4">
            {[
              ['01', 'Terstruktur', 'Data tersusun dalam modul yang saling terhubung.'],
              ['02', 'Berbasis Web', 'Dapat digunakan melalui perangkat yang terhubung ke aplikasi.'],
              ['03', 'Mobile Ready', 'Antarmuka dirancang untuk penggunaan di lapangan.'],
              ['04', 'PWA', 'Mendukung pengalaman aplikasi web yang ringan dan praktis.'],
            ].map(([number, title, text]) => (
              <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-xs font-bold text-cyan-300">{number}</div>
                <h3 className="mt-5 font-bold">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="fitur" className="bg-slate-900/70 px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div data-landing-reveal className="translate-y-4 opacity-0 transition-all duration-700">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Fitur</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Modul yang mendukung pekerjaan sanitasi</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(feature => (
              <article key={feature.title} data-landing-reveal className="translate-y-4 opacity-0 rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition-all duration-700 hover:-translate-y-1 hover:bg-white/[0.07]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                  <i className={`fas ${feature.icon}`} />
                </div>
                <h3 className="mt-5 font-bold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="alur" className="bg-slate-950 px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div data-landing-reveal className="translate-y-4 opacity-0 transition-all duration-700">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Alur kerja</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Dari data lapangan menjadi informasi</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {steps.map(([number, title, text]) => (
              <div key={number} data-landing-reveal className="translate-y-4 opacity-0 border-t border-white/10 pt-5 transition-all duration-700">
                <div className="text-xs font-bold text-emerald-300">{number}</div>
                <h3 className="mt-3 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-cyan-300/15 bg-linear-to-br from-blue-900/60 to-emerald-900/40 p-8 text-center sm:p-12">
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" />
          <p className="relative text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">INSAN-J</p>
          <h2 className="relative mt-3 text-3xl font-bold sm:text-4xl">Mulai gunakan INSAN-J</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300">
            Masuk ke aplikasi untuk mengakses modul sesuai akun dan peran pengguna.
          </p>
          <Link to="/login" className="relative mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-slate-900 transition hover:bg-cyan-50">
            Masuk ke Aplikasi <i className="fas fa-arrow-right text-xs" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-xs text-slate-500 sm:px-8">
        © {new Date().getFullYear()} INSAN-J · Sanitasi RSUD Prof. Dr. W. Z. Johannes Kupang
      </footer>
    </main>
  );
}
