import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import LoginBackdrop from '../features/login/LoginBackdrop';
import Sidebar from '../components/Sidebar';
import BottomNavigation from '../components/BottomNavigation';

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

const videos = [
  { id: 'md9iaur645M' },
  { id: 'DWBzpEFwcQw' },
  { id: 'u8jKbiJrPX8' },
];

const workflow = [
  ['01', 'Catat di lapangan', 'Petugas memasukkan data kegiatan sanitasi melalui perangkat yang digunakan.'],
  ['02', 'Data tersimpan', 'Data dikumpulkan dan dikelola sesuai modul serta hak akses pengguna.'],
  ['03', 'Pantau & kelola', 'Informasi dapat ditinjau kembali untuk pemantauan kegiatan sanitasi.'],
  ['04', 'Rekap & laporkan', 'Data yang terkumpul menjadi dasar rekapitulasi dan kebutuhan pelaporan.'],
];

const highlights = [
  ['fa-mobile-alt', 'Siap untuk lapangan', 'Antarmuka responsif untuk digunakan dari ponsel maupun komputer.'],
  ['fa-wifi', 'PWA & dukungan offline', 'Dirancang sebagai aplikasi web progresif dengan dukungan penyimpanan dan sinkronisasi data offline.'],
  ['fa-users-cog', 'Berbasis peran', 'Akses dan modul dapat disesuaikan dengan peran pengguna di dalam aplikasi.'],
  ['fa-database', 'Data terpusat', 'Data kegiatan sanitasi tersusun dalam satu sistem sehingga lebih mudah ditelusuri.'],
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

  const videoCarouselRef = useRef(null);
  const [activeVideo, setActiveVideo] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const carousel = videoCarouselRef.current;
    if (!carousel) return undefined;

    const updateActiveVideo = () => {
      const cards = Array.from(carousel.children);
      if (!cards.length) return;

      const center = carousel.scrollLeft + carousel.clientWidth / 2;
      let closestIndex = 0;
      let closestDistance = Infinity;

      cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(cardCenter - center);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActiveVideo(closestIndex);
    };

    updateActiveVideo();
    carousel.addEventListener('scroll', updateActiveVideo, { passive: true });
    window.addEventListener('resize', updateActiveVideo);
    return () => {
      carousel.removeEventListener('scroll', updateActiveVideo);
      window.removeEventListener('resize', updateActiveVideo);
    };
  }, []);

  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <Sidebar variant="landing" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <BottomNavigation variant="landing" />
      {/* Hero */}
      <section className="relative isolate min-h-[92vh] overflow-hidden bg-linear-to-br from-slate-950 via-blue-950 to-emerald-950">
        <LoginBackdrop />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.12),transparent_32%)]" />

        <nav className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 text-left">
            <img src={import.meta.env.BASE_URL + 'img/Icon.webp'} alt="INSAN-J" className="h-10 w-10 rounded-xl object-contain" />
            <div>
              <div className="text-sm font-extrabold tracking-wide">INSAN-J</div>
              <div className="text-[10px] text-slate-300">Informasi Sanitasi Johannes</div>
            </div>
          </button>

          <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/20" aria-label="Buka menu">
            <i className="fas fa-bars mr-2 text-xs" />Menu
          </button>
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
              <button type="button" onClick={() => scrollTo('modul')} className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10">
                Lihat Modul
              </button>
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

      {/* Tentang */}
      <section id="tentang" className="relative bg-slate-950 px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div data-landing-reveal className="max-w-3xl translate-y-4 opacity-0 transition-all duration-700">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Tentang INSAN-J</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Digitalisasi alur kerja sanitasi rumah sakit.</h2>
            <p className="mt-5 leading-7 text-slate-400">
              INSAN-J menghubungkan kegiatan yang sebelumnya tersebar dalam pencatatan lapangan, pemantauan, pengelolaan data, dan rekapitulasi ke dalam satu aplikasi. Dengan begitu, data sanitasi dapat dicatat lebih terarah dan digunakan kembali saat dibutuhkan.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map(([icon, title, text]) => (
              <div key={title} data-landing-reveal className="translate-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 opacity-0 transition-all duration-700 hover:-translate-y-1 hover:bg-white/[0.07]">
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

      {/* Modul */}
      <section id="modul" className="bg-slate-900/70 px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div data-landing-reveal className="max-w-3xl translate-y-4 opacity-0 transition-all duration-700">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Modul INSAN-J</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Satu aplikasi untuk berbagai kegiatan sanitasi</h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">Modul ditampilkan sesuai kebutuhan dan hak akses pengguna.</p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map(module => (
              <article key={module.title} data-landing-reveal className="group translate-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 opacity-0 transition-all duration-700 hover:-translate-y-1 hover:border-cyan-300/20 hover:bg-white/[0.07]">
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

      {/* Video */}
      <section id="galery" className="relative scroll-mt-6 overflow-hidden bg-slate-900/70 px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div data-landing-reveal className="max-w-3xl translate-y-4 opacity-0 transition-all duration-700">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Kegiatan Sanitasi RSUD Prof. Dr. W.Z. Johannes Kupang</h2>
            <p className="mt-5 max-w-2xl leading-7 text-slate-300">Dokumentasi kegiatan sanitasi dalam upaya menjaga kebersihan, kesehatan, keamanan, dan kualitas lingkungan rumah sakit.</p>
          </div>

          <div className="relative mt-10">
            <div ref={videoCarouselRef} className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible">
              {videos.map(video => (
                <article key={video.id} className="w-[86vw] shrink-0 snap-center sm:w-[70vw] md:w-auto">
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-xl">
                    <div className="relative aspect-video overflow-hidden bg-slate-950">
                      <iframe
                        className="h-full w-full"
                        src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0`}
                        title={`Video kegiatan sanitasi RSUD Prof. Dr. W.Z. Johannes Kupang`}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-2 flex justify-center gap-1.5 md:hidden" aria-hidden="true">
              {videos.map((video, index) => (
                <span key={video.id} className="h-1.5 w-5 rounded-full bg-white/20">
                  <span className={`block h-full rounded-full ${index === activeVideo ? 'bg-cyan-300' : 'bg-transparent'}`} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Alur */}
      <section id="alur" className="bg-slate-950 px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div data-landing-reveal className="max-w-3xl translate-y-4 opacity-0 transition-all duration-700">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Alur kerja</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Dari kegiatan lapangan menjadi informasi</h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">INSAN-J dirancang mengikuti alur sederhana agar data dapat bergerak dari pencatatan sampai kebutuhan pelaporan.</p>
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

      {/* CTA */}
      <section className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-cyan-300/15 bg-linear-to-br from-blue-900/70 to-emerald-900/45 p-8 text-center sm:p-14">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-emerald-300/10 blur-3xl" />
          <p className="relative text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">INSAN-J · Sanitasi Johannes</p>
          <h2 className="relative mt-3 text-3xl font-bold sm:text-4xl">Kelola data sanitasi dalam satu sistem.</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300">
            Masuk ke INSAN-J untuk mengakses modul sesuai akun dan peran pengguna.
          </p>
          <Link to="/login" className="relative mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-slate-900 transition hover:bg-cyan-50">
            Masuk ke Aplikasi <i className="fas fa-arrow-right text-xs" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-xs text-slate-500 sm:px-8">
        © {new Date().getFullYear()} INSAN-J · Unit Sanitasi RSUD Prof. Dr. W. Z. Johannes Kupang
      </footer>
    </main>
  );
}
