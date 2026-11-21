import { useEffect, useRef, useState, useCallback } from 'react';
import { getGalleryItems } from '../admin/landing/landingSettingsService';

// ── Carousel scroll tracker ───────────────────────────────────────────────────
function useCarouselTracker(ref, deps, setter) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !deps.length) return undefined;

    const update = () => {
      const cards = Array.from(el.children);
      if (!cards.length) return;
      const center = el.scrollLeft + el.clientWidth / 2;
      let closest = 0;
      let minDist = Infinity;
      cards.forEach((card, i) => {
        const d = Math.abs((card.offsetLeft + card.offsetWidth / 2) - center);
        if (d < minDist) { minDist = d; closest = i; }
      });
      setter(closest);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps.length]);
}

// ── Photo Gallery ─────────────────────────────────────────────────────────────
function PhotoGallery({ photos }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const thumbRef = useRef(null);

  const goTo = useCallback((i) => {
    const clamped = Math.max(0, Math.min(photos.length - 1, i));
    setActiveIndex(clamped);
    // scroll thumbnail into view
    const thumb = thumbRef.current?.children[clamped];
    thumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [photos.length]);

  useEffect(() => {
    const handleKey = (e) => {
      if (lightbox !== null) {
        if (e.key === 'ArrowRight') goTo(lightbox + 1);
        if (e.key === 'ArrowLeft') goTo(lightbox - 1);
        if (e.key === 'Escape') setLightbox(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightbox, goTo]);

  const active = photos[activeIndex];

  return (
    <div className="mb-16">
      {/* Section Header */}
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
          <i className="fas fa-camera text-sm" />
        </span>
        <h3 className="text-xl font-bold text-white">Galeri Foto</h3>
        <span className="ml-auto rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-400">
          {activeIndex + 1} / {photos.length}
        </span>
      </div>

      {/* Main Featured Image */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-950 shadow-2xl ring-1 ring-white/10 group">
        <div className="relative aspect-video sm:aspect-21/9 overflow-hidden">
          <img
            key={active.id}
            src={active.url}
            alt={`Foto kegiatan sanitasi ${activeIndex + 1}`}
            className="h-full w-full object-cover transition-all duration-500 ease-in-out group-hover:scale-[1.02]"
            loading="lazy"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-slate-950/60 via-transparent to-transparent" />

          {/* Expand button */}
          <button
            onClick={() => setLightbox(activeIndex)}
            className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm hover:bg-white/20"
            aria-label="Perbesar foto"
          >
            <i className="fas fa-expand text-xs" />
          </button>

          {/* Prev / Next arrows */}
          <button
            onClick={() => goTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-0 disabled:pointer-events-none"
            aria-label="Foto sebelumnya"
          >
            <i className="fas fa-chevron-left text-sm" />
          </button>
          <button
            onClick={() => goTo(activeIndex + 1)}
            disabled={activeIndex === photos.length - 1}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-0 disabled:pointer-events-none"
            aria-label="Foto berikutnya"
          >
            <i className="fas fa-chevron-right text-sm" />
          </button>
        </div>
      </div>

      {/* Thumbnails */}
      <div
        ref={thumbRef}
        className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => goTo(i)}
            className={`relative shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-300 ${
              i === activeIndex
                ? 'border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)] opacity-100'
                : 'border-white/10 opacity-50 hover:opacity-80 hover:border-white/30'
            }`}
            style={{ width: 72, height: 52 }}
            aria-label={`Lihat foto ${i + 1}`}
          >
            <img
              src={photo.url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 backdrop-blur-md"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
            aria-label="Tutup"
          >
            <i className="fas fa-xmark text-lg" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goTo(lightbox - 1); setLightbox(s => Math.max(0, s - 1)); }}
            disabled={lightbox === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 disabled:opacity-0"
          >
            <i className="fas fa-chevron-left" />
          </button>
          <img
            src={photos[lightbox]?.url}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); goTo(lightbox + 1); setLightbox(s => Math.min(photos.length - 1, s + 1)); }}
            disabled={lightbox === photos.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 disabled:opacity-0"
          >
            <i className="fas fa-chevron-right" />
          </button>
          <span className="absolute bottom-4 text-sm text-white/60">{lightbox + 1} / {photos.length}</span>
        </div>
      )}
    </div>
  );
}

// ── Video Slider ──────────────────────────────────────────────────────────────
function VideoSlider({ videos }) {
  const carouselRef = useRef(null);
  const [activeVideo, setActiveVideo] = useState(0);

  useCarouselTracker(carouselRef, videos, setActiveVideo);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
          <i className="fas fa-video text-sm" />
        </span>
        <h3 className="text-xl font-bold text-white">Video Dokumentasi</h3>
        <span className="ml-auto text-xs text-slate-500 md:hidden">Geser →</span>
      </div>

      <div className="relative -mx-5 sm:mx-0">
        <div
          ref={carouselRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-8 scrollbar-none [&::-webkit-scrollbar]:hidden sm:px-0 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3 md:gap-6 md:pb-0"
        >
          {videos.map(video => (
            <article key={video.id} className="w-[86vw] shrink-0 snap-center sm:w-[75vw] md:w-auto">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-xl transition-colors duration-300 hover:border-blue-500/30">
                <div className="relative aspect-video overflow-hidden bg-slate-950">
                  <iframe
                    className="h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${video.url}?rel=0`}
                    title="Video kegiatan sanitasi"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Mobile dot indicators */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-2 md:hidden">
          {videos.map((video, i) => (
            <span
              key={video.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeVideo
                  ? 'w-8 bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]'
                  : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────
export default function VideoSection() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    getGalleryItems().then(setItems).catch(console.error);
  }, []);

  const photos = items.filter(item => item.type === 'image');
  const videos = items.filter(item => item.type === 'youtube');

  return (
    <section id="galery" className="relative scroll-mt-6 overflow-hidden bg-slate-900/70 px-5 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div data-landing-reveal className="max-w-3xl translate-y-4 opacity-0 transition-all duration-700">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Galeri Kegiatan Sanitasi</h2>
          <p className="mt-5 max-w-2xl leading-7 text-slate-300">
            Dokumentasi kegiatan sanitasi dalam upaya menjaga kebersihan, kesehatan, keamanan, dan kualitas lingkungan rumah sakit.
          </p>
        </div>

        <div className="mt-12">
          {items.length === 0 && (
            <div className="py-20 text-center text-slate-500 text-sm border border-white/10 rounded-2xl bg-white/5">
              Belum ada media di galeri.
            </div>
          )}
          {photos.length > 0 && <PhotoGallery photos={photos} />}
          {videos.length > 0 && <VideoSlider videos={videos} />}
        </div>
      </div>
    </section>
  );
}
