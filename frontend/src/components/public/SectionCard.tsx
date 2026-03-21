'use client';

import type { Section } from '@/types';

interface SectionCardProps {
  section: Section;
  onSelect: (section: Section) => void;
}

export function SectionCard({ section, onSelect }: SectionCardProps) {
  const bgColor = section.bg_color || '#1a1a2e';
  const textColor = section.text_color || '#ffffff';

  return (
    <button
      type="button"
      onClick={() => onSelect(section)}
      className="relative shrink-0 overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-200 hover:-translate-y-0.5 text-left focus:outline-none h-full"
      style={{
        width: '300px',
        background: bgColor,
        borderLeft: `4px solid ${textColor}40`,
      }}
    >
      {/* Título */}
      <div className="relative z-10 px-4 pt-4 pb-2">
        <p className="text-xl font-extrabold tracking-tight leading-tight drop-shadow" style={{ color: textColor }}>
          {section.title}
        </p>
        {section.subtitle && (
          <p className="text-xs mt-1 font-medium opacity-80" style={{ color: textColor }}>
            {section.subtitle}
          </p>
        )}
      </div>

      {/* Imagen */}
      <div className="relative z-10 flex-1 w-full flex items-end justify-center px-4 pb-4 pt-2" style={{ height: 'calc(100% - 70px)' }}>
        {section.image_url ? (
          <img
            src={section.image_url}
            alt={section.title}
            className="max-w-full max-h-full object-contain drop-shadow-2xl"
          />
        ) : (
          <div className="w-full h-full opacity-20 rounded" style={{ backgroundColor: textColor }} />
        )}
      </div>
    </button>
  );
}
