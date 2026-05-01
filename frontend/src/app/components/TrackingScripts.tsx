'use client';

import { usePathname } from 'next/navigation';
import MetaPixel from './MetaPixel';
import { GoogleAnalytics } from '@next/third-parties/google';

export default function TrackingScripts() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;
  return (
    <>
      <MetaPixel />
      <GoogleAnalytics gaId="G-D4LPGEKSXS" />
    </>
  );
}
