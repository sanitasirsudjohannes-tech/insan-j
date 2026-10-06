import { useEffect, useRef, useState } from 'react';
import { getGalleryItems } from '../admin/landing/landingSettingsService';

export default function VideoSection() {
  const photoCarouselRef = useRef(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [items, setItems] = useState([]);

  useEffect(() => {
    // Load gallery items
    getGalleryItems().then(data => {
      setItems(data);
    }).catch(console.error);
  }, []);

  const photos = items.filter(item => item.type === 'image');
  const videos = items.filter(item => item.type === 'youtube');

  useEffect(() => {
    const carousel = photoCarouselRef.current;
    if (!carousel || photos.length === 0) return undefined;

    const updateActivePhoto = () => {
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

      setActivePhoto(closestIndex);
    };

    updateActivePhoto();
    carousel.addEventListener('scroll', updateActivePhoto, { passive: true });
    window.addEventListener('resize', updateActivePhoto);
    return () => {
      carousel.removeEventListener('scroll', updateActivePhoto);
      window.removeEventListener('resize', updateActivePhoto);
    };
  }, [photos]);

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
                <div ref={photoCarouselRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-8 pt-4 scrollbar-none [&::-webkit-scrollbar]:hidden">
                  {photos.map((photo, index) => (
                    <article 
                      key={photo.id} 
                      className={`w-[85vw] shrink-0 snap-center sm:w-[60vw] md:w-[40vw] lg:w-[35vw] transition-all duration-500 ease-out cursor-pointer ${
                        activePhoto === index ? 'scale-100 opacity-100' : 'scale-95 opacity-50 hover:opacity-80'
                      }`}
                      onClick={() => scrollToPhoto(index)}
                    >
                      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl ring-1 ring-white/5 group relative">
                        <div className="absolute inset-0 z-10 bg-linear-to-t from-slate-950/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="relative aspect-[4/3] overflow-hidden">
                          <img
                            src={photo.url}
                            alt="Foto kegiatan sanitasi"
                            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    </article>
                  ))}
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
              </div>
              
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {videos.map(video => (
                  <article key={video.id}>
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
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
