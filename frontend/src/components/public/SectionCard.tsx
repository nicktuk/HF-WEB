'use client';

import { useRouter } from 'next/navigation';
import type { Section } from '@/types';

interface SectionCardProps {
  section: Section;
}

export function SectionCard({ section }: SectionCardProps) {
  const router = useRouter();
  const bgColor = section.bg_color || '#0D1B2A';
  const textColor = section.text_color || '#ffffff';

  const handleClick = () => {
    if (section.criteria_type === 'featured') router.push('/?featured=true');
    else if (section.criteria_type === 'immediate_delivery') router.push('/?immediate_delivery=true');
    else if (section.criteria_type === 'category' && section.criteria_value) router.push(`/?category=${encodeURIComponent(section.criteria_value)}`);
    else router.push('/');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group w-full overflow-hidden rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left"
    >
      {/* Title bar */}
      <div
        className="px-5 py-4"
        style={{ backgroundColor: bgColor }}
      >
        <h3 className="text-lg font-extrabold tracking-tight leading-tight" style={{ color: textColor }}>
          {section.title}
        </h3>
        {section.subtitle && (
          <p className="text-sm mt-0.5 opacity-75" style={{ color: textColor }}>
            {section.subtitle}
          </p>
        )}
      </div>

      {/* Image */}
      <div className="aspect-[16/9] relative overflow-hidden bg-zinc-100">
        {section.image_url ? (
          <img
            src={section.image_url}
            alt={section.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className="w-full h-full opacity-20"
            style={{
              backgroundColor: bgColor,
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
        )}
      </div>
    </button>
  );
}
