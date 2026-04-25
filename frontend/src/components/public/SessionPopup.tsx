'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { resolveImageUrl } from '@/lib/api';

const LS_KEY = 'hefa_browser_open';
const SS_KEY = 'hefa_popup_seen';

interface PopupSlide {
  image: string;
  link: string;
}

interface SessionPopupProps {
  slides: PopupSlide[];
}

export function SessionPopup({ slides }: SessionPopupProps) {
  const [visible, setVisible] = useState(false);
  const [idx, setIdx] = useState(0);
  const isPaused = useRef(false);

  useEffect(() => {
    const browserOpen = localStorage.getItem(LS_KEY) === '1';
    const seenThisLoad = sessionStorage.getItem(SS_KEY) === '1';

    localStorage.setItem(LS_KEY, '1');

    if (!browserOpen || !seenThisLoad) {
      sessionStorage.setItem(SS_KEY, '1');
      setVisible(true);
    }

    const onUnload = () => localStorage.removeItem(LS_KEY);
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  const prev = useCallback(() => setIdx(i => (i - 1 + slides.length) % slides.length), [slides.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % slides.length), [slides.length]);

  useEffect(() => {
    if (!visible || slides.length <= 1) return;
    const t = setInterval(() => {
      if (!isPaused.current) next();
    }, 4000);
    return () => clearInterval(t);
  }, [visible, slides.length, next]);

  if (!visible) return null;

  const slide = slides[idx];
  const src = resolveImageUrl(slide.image) ?? slide.image;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => setVisible(false)}
    >
      <div
        className="relative max-w-lg md:max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        onMouseEnter={() => { isPaused.current = true; }}
        onMouseLeave={() => { isPaused.current = false; }}
      >
        {/* Close */}
        <button
          onClick={() => setVisible(false)}
          className="absolute top-3 right-3 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Image — clickable if link exists */}
        {slide.link ? (
          <a href={slide.link} target="_blank" rel="noopener noreferrer" onClick={() => setVisible(false)}>
            <Image
              key={src}
              src={src}
              alt={`Novedad ${idx + 1}`}
              width={900}
              height={900}
              className="w-full h-auto block cursor-pointer"
              priority
            />
          </a>
        ) : (
          <Image
            key={src}
            src={src}
            alt={`Novedad ${idx + 1}`}
            width={900}
            height={900}
            className="w-full h-auto block"
            priority
          />
        )}

        {/* Nav arrows + dots */}
        {slides.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-20">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'
                  }`}
                  aria-label={`Imagen ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
