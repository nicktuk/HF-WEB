'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { resolveImageUrl } from '@/lib/api';

const SESSION_KEY = 'hefa_popup_shown';

interface SessionPopupProps {
  imageUrl: string;
}

export function SessionPopup({ imageUrl }: SessionPopupProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(true);
  }, []);

  if (!visible) return null;

  const src = resolveImageUrl(imageUrl) ?? imageUrl;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => setVisible(false)}
    >
      <div
        className="relative max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setVisible(false)}
          className="absolute top-3 right-3 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
        <Image
          src={src}
          alt="Novedad"
          width={600}
          height={600}
          className="w-full h-auto block"
          priority
        />
      </div>
    </div>
  );
}
