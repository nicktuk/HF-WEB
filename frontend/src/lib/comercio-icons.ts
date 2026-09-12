import {
  Shield, ShieldCheck, Lock, BadgeCheck, Award, CheckCircle,
  Battery, BatteryCharging, Zap, Gauge, Timer, Clock,
  Truck, Package, PackageCheck, Boxes,
  Cpu, HardDrive, Monitor, Smartphone, Wifi, Volume2, Camera,
  Layers, Hammer, Wrench, Ruler, Weight,
  ThermometerSun, Snowflake, Flame, Droplet, Wind, Recycle,
  Users, ThumbsUp, Star,
  type LucideIcon,
} from 'lucide-react';

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
  Layers, Hammer, Wrench, Ruler, Weight,
  ThermometerSun, Snowflake, Flame, Droplet, Wind, Recycle,
  Users, ThumbsUp, Star,
};

export function getComercioIcon(name: string): LucideIcon | null {
  return COMERCIO_ICON_MAP[name] ?? null;
}
