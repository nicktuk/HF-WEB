'use client';

import { seasonalTheme } from '@/config/seasonalTheme';
import { trackPublicEvent } from '@/lib/analytics';
import { ChristmasBannerScene } from './ChristmasArt';
import { christmasFont } from './fonts';

export function ChristmasBanner() {
  const onClick = () => trackPublicEvent('banner_click', { metadata: { banner: 'navidad' } });

  return (
    <div className="mb-4">
      {/* Desktop / tablet */}
      <div className="container mx-auto hidden px-4 pt-4 sm:block">
        <a
          href={seasonalTheme.navidadHref}
          onClick={onClick}
          className="flex h-[240px] overflow-hidden rounded-2xl"
          style={{ backgroundColor: '#14532D', boxShadow: '0 0 0 4px #FACC15, 0 0 24px 6px rgba(250,204,21,.45)' }}
        >
          <div className="relative h-full shrink-0" style={{ width: '58%' }}>
            <ChristmasBannerScene />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-12"
              style={{ background: 'linear-gradient(to right, rgba(20,83,45,0), #14532D)' }}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 px-6">
            <span className={`${christmasFont.className} leading-none text-white`} style={{ fontSize: 46 }}>
              {seasonalTheme.bannerTitle}
            </span>
            <span className="text-[15px] leading-snug" style={{ color: '#DCFCE7' }}>
              {seasonalTheme.bannerSubtitle}
            </span>
            <span
              className="mt-1 inline-flex h-10 w-fit items-center gap-2 rounded-full px-5 text-sm font-extrabold"
              style={{ backgroundColor: '#FACC15', color: '#14532D' }}
            >
              {seasonalTheme.bannerCta}
              <span aria-hidden="true">→</span>
            </span>
          </div>
        </a>
      </div>

      {/* Mobile */}
      <a
        href={seasonalTheme.navidadHref}
        onClick={onClick}
        className="flex h-[160px] overflow-hidden sm:hidden"
        style={{ backgroundColor: '#14532D', borderBottom: '4px solid #FACC15' }}
      >
        <div className="h-full shrink-0" style={{ width: '56%' }}>
          <ChristmasBannerScene />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-3">
          <span className={`${christmasFont.className} leading-none text-white`} style={{ fontSize: 26 }}>
            {seasonalTheme.bannerTitle}
          </span>
          <span className="text-xs leading-snug" style={{ color: '#DCFCE7' }}>
            {seasonalTheme.bannerSubtitleShort}
          </span>
        </div>
      </a>
    </div>
  );
}
