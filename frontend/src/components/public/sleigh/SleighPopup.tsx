'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type TransitionEvent } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { resolveImageUrl } from '@/lib/api';
import { christmasFont } from '@/components/public/navidad/fonts';
import { NightScene, SleighTeam } from './SleighArt';

interface PopupSlide {
  image: string;
  link: string;
}

interface SleighPopupProps {
  slides: PopupSlide[];
  interval: number;
  onClose: () => void;
}

type Phase = 'offLeft' | 'entering' | 'holding' | 'leaving';

const ENTER_MS = 1600;
const LEAVE_MS = 1300;
const FADE_MS = 300;
/** Margen para avanzar aunque no llegue `transitionend` (p. ej. pestaña en segundo plano). */
const TRANSITION_FALLBACK_MS = 250;

const IMAGE_SIZES = '(max-width: 639px) 240px, 320px';

/** Lee un media query del navegador y se mantiene al día con sus cambios. */
function useMediaQuery(query: string): boolean {
  // El popup solo se monta en el cliente (después de un useEffect), así que
  // leer matchMedia en el estado inicial no genera diferencias de hidratación.
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/**
 * Popup de inicio navideño: un trineo con renos cruza la pantalla llevando la
 * imagen del slide, frena en el centro, espera y sale; entra el siguiente.
 */
export function SleighPopup({ slides, interval, onClose }: SleighPopupProps) {
  const isMobile = useMediaQuery('(max-width: 639px)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const holdMs = Math.max(interval, 3.5) * 1000;
  const multiple = slides.length > 1;

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'holding' : 'offLeft');
  const [faded, setFaded] = useState(false);
  const [paused, setPaused] = useState(false);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  const remainingRef = useRef(holdMs);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePaused = () => setPaused(hoverRef.current || focusRef.current);

  const startHolding = useCallback(() => {
    remainingRef.current = holdMs;
    setPhase('holding');
  }, [holdMs]);

  // Movimiento reducido: el trineo queda quieto y la imagen cambia con un fundido.
  const fadeTo = useCallback((target: number) => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setFaded(true);
    fadeTimerRef.current = setTimeout(() => {
      setIdx(target);
      remainingRef.current = holdMs;
      setFaded(false);
      // Fuerza a reprogramar la espera aunque ya estuviéramos en 'holding'.
      setPhase('holding');
      fadeTimerRef.current = null;
    }, FADE_MS);
  }, [holdMs]);

  // Si cambia la preferencia de movimiento mientras el popup está abierto,
  // el trineo se acomoda en el centro.
  useEffect(() => {
    if (reducedMotion && phaseRef.current !== 'holding') startHolding();
  }, [reducedMotion, startHolding]);

  useEffect(() => () => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
  }, []);

  // offLeft → entering, tras dos frames para que el navegador pinte la posición inicial.
  useEffect(() => {
    if (phase !== 'offLeft') return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPhase('entering'));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [phase, idx]);

  const finishTransition = useCallback((from: 'entering' | 'leaving') => {
    if (phaseRef.current !== from) return;
    if (from === 'entering') {
      startHolding();
    } else {
      setIdx((i) => (i + 1) % slides.length);
      setPhase('offLeft');
    }
  }, [slides.length, startHolding]);

  // Respaldo por si no llega `transitionend`.
  useEffect(() => {
    if (phase !== 'entering' && phase !== 'leaving') return;
    const t = setTimeout(
      () => finishTransition(phase),
      (phase === 'entering' ? ENTER_MS : LEAVE_MS) + TRANSITION_FALLBACK_MS
    );
    return () => clearTimeout(t);
  }, [phase, finishTransition]);

  // holding: espera; se pausa con hover (mouse) o foco dentro del escenario.
  useEffect(() => {
    if (phase !== 'holding' || !multiple || paused || faded) return;
    const startedAt = Date.now();
    const t = setTimeout(() => {
      remainingRef.current = 0;
      if (reducedMotion) {
        fadeTo((idx + 1) % slides.length);
      } else {
        setPhase('leaving');
      }
    }, remainingRef.current);
    return () => {
      clearTimeout(t);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
    };
  }, [phase, multiple, paused, faded, reducedMotion, fadeTo, idx, slides.length]);

  const onTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== 'transform') return;
    if (phase === 'entering' || phase === 'leaving') finishTransition(phase);
  };

  const goTo = (target: number) => {
    if (reducedMotion) {
      fadeTo(target);
      return;
    }
    setIdx(target);
    setPhase('offLeft');
  };
  const prev = () => goTo((idx - 1 + slides.length) % slides.length);
  const next = () => goTo((idx + 1) % slides.length);

  // Desplazamiento del tren (en % del ancho del escenario).
  let moverStyle: CSSProperties;
  if (reducedMotion || phase === 'holding') {
    moverStyle = { transform: 'translateX(0)', transition: 'none' };
  } else if (phase === 'offLeft') {
    moverStyle = { transform: 'translateX(-130%)', transition: 'none' };
  } else if (phase === 'entering') {
    moverStyle = { transform: 'translateX(0)', transition: `transform ${ENTER_MS}ms cubic-bezier(.2,.8,.3,1)` };
  } else {
    moverStyle = { transform: 'translateX(130%)', transition: `transform ${LEAVE_MS}ms cubic-bezier(.6,0,.9,.4)` };
  }

  const trainWidth = isMobile ? 96 : 79;
  const trainStyle: CSSProperties = {
    width: `${trainWidth}%`,
    left: `${(100 - trainWidth) / 2}%`,
    bottom: isMobile ? '16%' : '13%',
    aspectRatio: '600 / 400',
  };
  const frameStyle: CSSProperties = isMobile
    ? { left: '8%', top: '-8%', width: '56%' }
    : { left: '11%', top: '1.5%', width: '41.6%' };
  // El gorro mide 9% del ancho del tren; acá se expresa relativo al marco.
  const hatWidth = `${(9 / parseFloat(frameStyle.width as string)) * 100}%`;

  const slide = slides[idx];
  const src = resolveImageUrl(slide.image) ?? slide.image;
  const nextSlide = multiple ? slides[(idx + 1) % slides.length] : null;
  const nextSrc = nextSlide ? resolveImageUrl(nextSlide.image) ?? nextSlide.image : null;

  const image = (
    <Image
      key={src}
      src={src}
      alt={`Novedad ${idx + 1}`}
      fill
      sizes={IMAGE_SIZES}
      className="object-cover"
      priority={idx === 0}
    />
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] aspect-[3/4] overflow-hidden rounded-2xl shadow-2xl sm:max-w-[760px] sm:aspect-[760/540]"
        onClick={(e) => e.stopPropagation()}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') { hoverRef.current = true; updatePaused(); } }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') { hoverRef.current = false; updatePaused(); } }}
        onFocus={() => { focusRef.current = true; updatePaused(); }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            focusRef.current = false;
            updatePaused();
          }
        }}
      >
        <NightScene />

        <p
          className={`${christmasFont.className} absolute left-4 top-3 z-10 pr-14 text-2xl leading-tight sm:left-6 sm:top-4 sm:text-3xl`}
          style={{ color: '#FDE68A' }}
        >
          ¡Llegó la Navidad a HE·FA!
        </p>

        {/* Tren: el wrapper de ancho completo se desplaza; adentro, el trineo flota. */}
        <div className="absolute inset-0" style={moverStyle} onTransitionEnd={onTransitionEnd}>
          <div className="absolute" style={trainStyle}>
            <div className="sleigh-bob absolute inset-0">
              <SleighTeam compact={isMobile} />
              <div className="absolute aspect-square" style={frameStyle}>
                <div
                  className="relative h-full w-full overflow-hidden rounded-[10px]"
                  style={{
                    border: '5px solid #FACC15',
                    boxShadow: '0 10px 24px rgba(0,0,0,.4)',
                    backgroundColor: '#0B1A2E',
                    opacity: faded ? 0 : 1,
                    transition: reducedMotion ? `opacity ${FADE_MS}ms ease` : undefined,
                  }}
                >
                  {slide.link ? (
                    <a
                      href={slide.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onClose}
                      className="absolute inset-0 block cursor-pointer"
                    >
                      {image}
                    </a>
                  ) : (
                    image
                  )}
                </div>
                <svg
                  viewBox="0 0 30 26"
                  aria-hidden="true"
                  className="pointer-events-none absolute"
                  style={{ width: hatWidth, right: '-7%', top: '-11%', transform: 'rotate(18deg) scaleX(-1)' }}
                >
                  <path d="M3 21 C8 6 18 1 26 9 L23 12 C19 7 13 9 10 21 Z" fill="#DC2626" />
                  <rect x="1" y="19" width="14" height="5" rx="2.5" fill="#fff" />
                  <circle cx="26" cy="10" r="3.2" fill="#fff" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 flex items-center justify-center w-11 h-11 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Nav arrows + dots */}
        {multiple && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-11 h-11 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-11 h-11 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-20">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'
                  }`}
                  aria-label={`Imagen ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Precarga de la imagen siguiente (eager: con lazy, una imagen oculta nunca se descarga). */}
        {nextSrc && nextSrc !== src && (
          <div aria-hidden="true" className="relative hidden">
            <Image src={nextSrc} alt="" fill sizes={IMAGE_SIZES} loading="eager" />
          </div>
        )}
      </div>
    </div>
  );
}
