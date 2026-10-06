import { useEffect, useRef, useState } from 'react';

const videos = [
  { id: 'md9iaur645M' },
  { id: 'DWBzpEFwcQw' },
  { id: 'u8jKbiJrPX8' },
];

export default function VideoSection() {
  const videoCarouselRef = useRef(null);
  const [activeVideo, setActiveVideo] = useState(0);

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

  return (
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
  );
}
