import { Link } from 'react-router-dom';
import LoginBackdrop from '../login/LoginBackdrop';

export default function HeroSection({ setSidebarOpen }) {
  return (
    <section className="relative isolate min-h-[92vh] overflow-hidden bg-linear-to-br from-slate-950 via-blue-950 to-emerald-950">
      <LoginBackdrop />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.12),transparent_32%)]" />

      <nav className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-slate-200 backdrop-blur transition hover:bg-white/20 hover:text-white md:inline-flex"
            aria-label="Buka menu"
          >
            <i className="fas fa-bars text-sm" />
          </button>

          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 text-left">
            <img src={import.meta.env.BASE_URL + 'img/Icon.webp'} alt="INSAN-J" className="h-10 w-10 rounded-xl object-contain" />
            <div>
              <div className="text-sm font-extrabold tracking-wide">INSAN-J</div>
              <div className="text-[10px] text-slate-300">Informasi Sanitasi Johannes</div>
            </div>
          </button>
        </div>

        <Link to="/login" className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/20">
          Masuk
        </Link>
      </nav>

      <div className="relative z-10 mx-auto grid min-h-[calc(92vh-80px)] w-full max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-20">
        <div data-landing-reveal className="translate-y-4 opacity-0 transition-all duration-700">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            Sistem Informasi Sanitasi RSUD Johannes
          </div>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-7xl">
            INSAN-J
            <span className="mt-2 block bg-linear-to-r from-cyan-300 via-white to-emerald-300 bg-clip-text text-transparent">
              Informasi Sanitasi Johannes
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Sistem informasi untuk mendukung pekerjaan sanitasi rumah sakit — mulai dari pencatatan limbah, inspeksi sanitasi, pemeriksaan lingkungan, hingga rekapitulasi data.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-slate-900 shadow-xl transition hover:-translate-y-0.5 hover:bg-cyan-50">
              Masuk ke Aplikasi <i className="fas fa-arrow-right text-xs" />
            </Link>
          </div>
        </div>

        {/* Visual ringkasan aplikasi */}
        <div data-landing-reveal className="relative hidden translate-y-4 opacity-0 transition-all duration-700 lg:block">
          <div className="absolute -inset-8 rounded-[2.5rem] bg-cyan-300/5 blur-3xl" />
          <div className="relative rounded-[2rem] border border-white/15 bg-slate-950/65 p-4 shadow-2xl backdrop-blur-xl">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.06] p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Dashboard</p>
                  <h2 className="mt-1 text-lg font-bold">Ringkasan Sanitasi</h2>
                </div>
                <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                  Terpantau
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ['Limbah', 'Tercatat'],
                  ['Inspeksi', 'Terpantau'],
                  ['Air Bersih', 'Diperiksa'],
                  ['Rekap', 'Tersedia'],
                ].map(([title, value]) => (
                  <div key={title} className="rounded-xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="h-1.5 w-8 rounded-full bg-cyan-300/70" />
                    <p className="mt-3 text-xs text-slate-400">{title}</p>
                    <p className="mt-1 text-sm font-bold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">Alur data sanitasi</p>
                  <i className="fas fa-chart-line text-xs text-cyan-300" />
                </div>
                <div className="mt-4 flex items-center gap-2 text-[9px] text-slate-400">
                  <span className="rounded-lg bg-cyan-300/10 px-2 py-1.5 text-cyan-200">Input</span>
                  <span className="text-slate-600">→</span>
                  <span className="rounded-lg bg-emerald-300/10 px-2 py-1.5 text-emerald-200">Kelola</span>
                  <span className="text-slate-600">→</span>
                  <span className="rounded-lg bg-blue-300/10 px-2 py-1.5 text-blue-200">Pantau</span>
                  <span className="text-slate-600">→</span>
                  <span className="rounded-lg bg-white/10 px-2 py-1.5 text-slate-200">Rekap</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-36 bg-linear-to-t from-slate-950 to-transparent" />
    </section>
  );
}
