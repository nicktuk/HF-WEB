'use client';

import type { Section } from '@/types';

interface SectionCardProps {
  section: Section;
  onSelect: (section: Section) => void;
}

export function SectionCard({ section, onSelect }: SectionCardProps) {
  const borderColor = section.bg_color || '#0D1B2A';
  const textColor = section.text_color || '#1a1a1a';

  return (
    <button
      type="button"
      onClick={() => onSelect(section)}
      className="shrink-0 flex flex-col overflow-hidden bg-white shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 text-left focus:outline-none"
      style={{
        width: '300px',
        height: '360px',
        border: `3px solid ${borderColor}`,
      }}
    >
      {/* Title area — top */}
      <div className="shrink-0 px-4 py-3 bg-white">
        <p
          className="text-base font-extrabold tracking-tight leading-tight"
          style={{ color: textColor }}
        >
          {section.title}
        </p>
        {section.subtitle && (
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
            {section.subtitle}
          </p>
        )}
      </div>

      {/* Image — fills remaining space */}
      <div className="flex-1 w-full overflow-hidden">
        {section.image_url ? (
          <img
            src={section.image_url}
            alt={section.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full opacity-30"
            style={{ backgroundColor: borderColor }}
          />
        )}
      </div>
    </button>
  );
}
