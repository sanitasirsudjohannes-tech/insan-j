import { useEffect, useRef, useState } from 'react';
import { getGalleryItems } from '../admin/landing/landingSettingsService';

export default function VideoSection() {
  const photoCarouselRef = useRef(null);
  const videoCarouselRef = useRef(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [activeVideo, setActiveVideo] = useState(0);
  const [items, setItems] = useState([]);

  useEffect(() => {
    // Load gallery items
    getGalleryItems().then(data => {
      setItems(data);
    }).catch(console.error);
  }, []);

  const photos = items.filter(item => item.type === 'image');
  const videos = items.filter(item => item.type === 'youtube');

  // Helper: track closest-to-center card in a carousel
  const useCarouselTracker = (ref, deps, setter) => {
    useEffect(() => {
      const carousel = ref.current;
      if (!carousel || deps.length === 0) return undefined;

      const update = () => {
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

        setter(closestIndex);
      };

      update();
      carousel.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      return () => {
        carousel.removeEventListener('scroll', update);
        window.removeEventListener('resize', update);
      };
    }, [deps]);
  };

  useCarouselTracker(photoCarouselRef, photos, setActivePhoto);
  useCarouselTracker(videoCarouselRef, videos, setActiveVideo);

  const scrollToPhoto = (index) => {
    if (!photoCarouselRef.current) return;
    const cards = Array.from(photoCarouselRef.current.children);
    cards[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  return (
    <section id="galery" className="relative scroll-mt-6 overflow-hidden bg-slate-900/70 px-5 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div data-landing-reveal className="max-w-3xl translate-y-4 opacity-0 transition-all duration-700">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Galeri Kegiatan Sanitasi</h2>
          <p className="mt-5 max-w-2xl leading-7 text-slate-300">Dokumentasi kegiatan sanitasi dalam upaya menjaga kebersihan, kesehatan, keamanan, dan kualitas lingkungan rumah sakit.</p>
        </div>

        <div className="relative mt-12">
          {items.length === 0 && (
            <div className="py-20 text-center text-slate-500 text-sm border border-white/10 rounded-2xl bg-white/5">
              Belum ada media di galeri.
            </div>
          )}

          {photos.length > 0 && (
            <div className="mb-16">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                    <i className="fas fa-camera text-sm" />
                  </span>
                  Galeri Foto
                </h3>
              </div>
              
              <div className="relative -mx-5 px-5 sm:mx-0 sm:px-0">
                <div className="relative -mx-5 px-5 sm:mx-0 sm:px-0">
                  <div
                    ref={photoCarouselRef}
                    className="flex snap-x snap-mandatory gap-0 overflow-x-auto px-[10vw] pb-8 pt-6 scrollbar-none [perspective:1200px] [&::-webkit-scrollbar]:hidden sm:px-[20vw] md:px-[28vw] lg:px-[32vw]"
                  >
                    {photos.map((photo, index) => {
                      const distance = index - activePhoto;
                      const isActive = distance === 0;
                      const clampedDistance = Math.max(-2, Math.min(2, distance));
                      const rotateY = clampedDistance * -10;
                      const scale = isActive ? 1 : Math.max(0.76, 0.9 - Math.abs(clampedDistance) * 0.05);
                      const opacity = isActive ? 1 : Math.max(0.38, 0.72 - Math.abs(clampedDistance) * 0.12);

                      return (
                        <article
                          key={photo.id}
                          className="first:ml-0 -ml-[8vw] w-[68vw] shrink-0 snap-center cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:-ml-[5vw] sm:w-[42vw] md:-ml-[3vw] md:w-[30vw] lg:-ml-[2.5vw] lg:w-[25vw]"
                          style={{
                            transform: `perspective(1200px) rotateY(${rotateY}deg) scale(${scale})`,
                            transformOrigin: 'center center',
                            opacity,
                            zIndex: isActive ? 20 : 10 - Math.abs(distance),
                          }}
                          onClick={() => scrollToPhoto(index)}
                        >
                          <div className="group relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-slate-950 shadow-[0_20px_55px_rgba(2,6,23,0.45)] ring-1 ring-white/5">
                            <div className="absolute inset-0 z-10 bg-linear-to-t from-slate-950/55 via-transparent to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-30" />
                            <div className="relative aspect-[4/3] overflow-hidden">
                              <img
                                src={photo.url}
                                alt="Foto kegiatan sanitasi"
                                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                loading="lazy"
                              />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollToPhoto(Math.max(0, activePhoto - 1))}
                    disabled={activePhoto === 0}
                    className="absolute left-2 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-slate-950/60 text-white shadow-xl backdrop-blur-xl transition hover:bg-white/15 disabled:pointer-events-none disabled:opacity-0 sm:left-4"
                    aria-label="Foto sebelumnya"
                  >
                    <i className="fas fa-chevron-left text-sm" />
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollToPhoto(Math.min(photos.length - 1, activePhoto + 1))}
                    disabled={activePhoto === photos.length - 1}
                    className="absolute right-2 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-slate-950/60 text-white shadow-xl backdrop-blur-xl transition hover:bg-white/15 disabled:pointer-events-none disabled:opacity-0 sm:right-4"
                    aria-label="Foto berikutnya"
                  >
                    <i className="fas fa-chevron-right text-sm" />
                  </button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-2" aria-hidden="true">
                  {photos.map((photo, index) => (
                    <button 
                      key={photo.id}
                      onClick={() => scrollToPhoto(index)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        index === activePhoto ? 'w-8 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'w-2 bg-white/20 hover:bg-white/40'
                      }`} 
                      aria-label={`Lihat foto ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {videos.length > 0 && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                    <i className="fas fa-video text-sm" />
                  </span>
                  Video Dokumentasi
                </h3>
                <span className="text-xs text-slate-500 md:hidden">Geser →</span>
              </div>
              
              <div className="relative -mx-5 px-5 sm:mx-0 sm:px-0">
                <div ref={videoCarouselRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-8 scrollbar-none [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3 md:gap-6 md:pb-0">
                  {videos.map(video => (
                    <article key={video.id} className="w-[86vw] shrink-0 snap-center sm:w-[75vw] md:w-auto">
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-xl group hover:border-blue-500/30 transition-colors duration-300">
                        <div className="relative aspect-video overflow-hidden bg-slate-950">
                          <iframe
                            className="h-full w-full"
                            src={`https://www.youtube-nocookie.com/embed/${video.url}?rel=0`}
                            title={`Video kegiatan sanitasi`}
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-2 md:hidden" aria-hidden="true">
                  {videos.map((video, index) => (
                    <span
                      key={video.id}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        index === activeVideo ? 'w-8 bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]' : 'w-2 bg-white/20'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
