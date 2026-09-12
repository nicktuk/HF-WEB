import {
  Shield, ShieldCheck, Lock, BadgeCheck, Award, CheckCircle,
  Battery, BatteryCharging, Zap, Gauge, Timer, Clock,
  Truck, Package, PackageCheck, Boxes,
  Cpu, HardDrive, Monitor, Smartphone, Wifi, Volume2, Camera,
  Layers, Hammer, Wrench, Ruler, Weight, Palette,
  ThermometerSun, Snowflake, Flame, Droplet, Wind, Recycle,
  Users, ThumbsUp, Star,
  type LucideIcon,
} from 'lucide-react';
import type { ComercioIconItem } from '@/types';

/**
 * Whitelist cerrada de íconos "serios" para el canal comercios — tiene que
 * coincidir exactamente con COMERCIO_ICON_WHITELIST en
 * backend/app/services/ai_description.py, porque la IA solo puede elegir
 * nombres de esta lista.
 */
export const COMERCIO_ICON_MAP: Record<string, LucideIcon> = {
  Shield, ShieldCheck, Lock, BadgeCheck, Award, CheckCircle,
  Battery, BatteryCharging, Zap, Gauge, Timer, Clock,
  Truck, Package, PackageCheck, Boxes,
  Cpu, HardDrive, Monitor, Smartphone, Wifi, Volume2, Camera,
  Layers, Hammer, Wrench, Ruler, Weight, Palette,
  ThermometerSun, Snowflake, Flame, Droplet, Wind, Recycle,
  Users, ThumbsUp, Star,
};

export function getComercioIcon(name: string): LucideIcon | null {
  return COMERCIO_ICON_MAP[name] ?? null;
}

export interface ParsedDescripcionLine {
  text: string;
  isBullet: boolean;
  icon: LucideIcon | null;
}

const BULLET_PREFIX_RE = /^[•\-*‣▪●·►▶]\s*/;

/**
 * Separa la descripción del canal comercios en líneas, marcando cuáles son
 * viñetas de características y matcheando cada una con su ícono generado por
 * IA (por texto exacto, no por posición — así sigue funcionando aunque se
 * haya sacado algún ícono puntual desde el editor).
 */
export function parseDescripcionConIconos(
  descripcion: string,
  iconos?: ComercioIconItem[] | null,
): ParsedDescripcionLine[] {
  const pool = (iconos || []).map(i => ({ ...i, used: false }));
  const result: ParsedDescripcionLine[] = [];

  for (const raw of descripcion.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const match = line.match(BULLET_PREFIX_RE);
    if (match) {
      const cleaned = line.slice(match[0].length).trim();
      const found = pool.find(p => !p.used && p.label === cleaned);
      if (found) found.used = true;
      result.push({ text: cleaned, isBullet: true, icon: found ? getComercioIcon(found.icon) : null });
    } else {
      result.push({ text: line, isBullet: false, icon: null });
    }
  }

  return result;
}
