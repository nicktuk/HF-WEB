'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Globe,
  Settings,
  Settings2,
  LogOut,
  Tags,
  FolderTree,
  ChevronDown,
  ChevronRight,
  Scale,
  DollarSign,
  MessageCircle,
  LineChart,
  ShoppingCart,
  PackageX,
  Menu,
  X,
  ClipboardList,
  Sparkles,
  Trophy,
  LayoutGrid,
} from 'lucide-react';
import { useAuth, useIsAuthenticated } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// Top-level items
const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
];

const productosSubmenu = [
  { name: 'Productos', href: '/admin/productos', icon: Package },
  { name: 'Compras', href: '/admin/stock/compras', icon: ShoppingCart },
  { name: 'Stock', href: '/admin/stock/resumen', icon: Package },
  { name: 'Stock sin match', href: '/admin/stock', icon: PackageX },
  { name: 'Comparador', href: '/admin/comparador', icon: Scale },
  { name: 'Descripciones IA', href: '/admin/ai-descripciones', icon: Sparkles },
];

const ventasSubmenu = [
  { name: 'Ventas', href: '/admin/ventas', icon: DollarSign },
  { name: 'Pedidos', href: '/admin/pedidos', icon: ClipboardList },
  { name: 'WhatsApp', href: '/admin/whatsapp', icon: MessageCircle },
];

const analiticaSubmenu = [
  { name: 'Movimientos', href: '/admin/analytics', icon: LineChart },
  { name: 'Ranking Clientes', href: '/admin/clientes-ranking', icon: Trophy },
];

const configSubmenu = [
  { name: 'Categorias', href: '/admin/categorias', icon: Tags },
  { name: 'Subcategorias', href: '/admin/subcategorias', icon: FolderTree },
  { name: 'Secciones', href: '/admin/secciones', icon: LayoutGrid },
  { name: 'Webs Origen', href: '/admin/source-websites', icon: Globe },
  { name: 'Configuracion IA', href: '/admin/configuracion', icon: Settings2 },
];

type SubmenuKey = 'productos' | 'ventas' | 'analitica' | 'config';

function useSubmenuState(pathname: string) {
  const [open, setOpen] = useState<Record<SubmenuKey, boolean>>({
    productos: false,
    ventas: false,
    analitica: false,
    config: false,
  });

  useEffect(() => {
    setOpen((prev) => ({
      ...prev,
      productos: productosSubmenu.some((i) => pathname.startsWith(i.href)),
      ventas: ventasSubmenu.some((i) => pathname.startsWith(i.href)),
      analitica: analiticaSubmenu.some((i) => pathname.startsWith(i.href)),
      config: configSubmenu.some((i) => pathname.startsWith(i.href)),
    }));
  }, [pathname]);

  const toggle = (key: SubmenuKey) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return { open, toggle };
}

// Reusable submenu components for sidebar
function SidebarSubmenu({
  label,
  icon: Icon,
  items,
  isOpen,
  onToggle,
  pathname,
}: {
  label: string;
  icon: React.ElementType;
  items: { name: string; href: string; icon: React.ElementType }[];
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
}) {
  const anyActive = items.some((i) => pathname.startsWith(i.href));
  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          anyActive ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
        )}
      >
        <span className="flex items-center gap-3">
          <Icon className="h-5 w-5" />
          {label}
        </span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {isOpen && (
        <div className="ml-4 mt-1 space-y-1">
          {items.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-white/10 text-white border-l-2 border-blue-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Reusable submenu for mobile (horizontal chips)
function MobileSubmenu({
  label,
  icon: Icon,
  items,
  isOpen,
  onToggle,
  pathname,
}: {
  label: string;
  icon: React.ElementType;
  items: { name: string; href: string; icon: React.ElementType }[];
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
}) {
  const anyActive = items.some((i) => pathname.startsWith(i.href));
  return (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          anyActive ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
        )}
      >
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {label}
        </span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {isOpen && (
        <div className="flex gap-1 overflow-x-auto pl-2">
          {items.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-2',
                  isActive ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const logout = useAuth((state) => state.logout);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { open, toggle } = useSubmenuState(pathname);

  // Close mobile menu on route change.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Redirect to login if not authenticated.
  useEffect(() => {
    if (!isAuthenticated && pathname !== '/admin/login') {
      router.push('/admin/login');
    }
  }, [isAuthenticated, pathname, router]);

  if (!isAuthenticated && pathname !== '/admin/login') return null;
  if (pathname === '/admin/login') return <>{children}</>;

  return (
    <div className="min-h-screen bg-zinc-100">
      <button
        onClick={() => setDesktopMenuOpen(!desktopMenuOpen)}
        className="fixed left-3 top-3 z-[60] hidden rounded-lg bg-[#0D1B2A] p-2 text-white shadow-md transition-colors hover:bg-[#16406a] md:block"
        aria-label={desktopMenuOpen ? 'Ocultar menu' : 'Mostrar menu'}
      >
        {desktopMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 hidden w-64 bg-[#0D1B2A] transition-transform duration-200 md:block',
          desktopMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-6 py-4">
            <h1 className="text-xl font-bold text-white tracking-wide">HE-FA</h1>
            <p className="text-[10px] uppercase tracking-widest text-zinc-400 mt-0.5">Panel Admin</p>
          </div>

          <nav className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {/* Dashboard */}
            <div>
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-white/10 text-white border-l-2 border-blue-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            <div>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Catálogo
              </p>
              <SidebarSubmenu
                label="Productos"
                icon={Package}
                items={productosSubmenu}
                isOpen={open.productos}
                onToggle={() => toggle('productos')}
                pathname={pathname}
              />
            </div>

            <div>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Comercial
              </p>
              <SidebarSubmenu
                label="Ventas"
                icon={DollarSign}
                items={ventasSubmenu}
                isOpen={open.ventas}
                onToggle={() => toggle('ventas')}
                pathname={pathname}
              />
            </div>

            <div>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Analítica
              </p>
              <SidebarSubmenu
                label="Analítica"
                icon={LineChart}
                items={analiticaSubmenu}
                isOpen={open.analitica}
                onToggle={() => toggle('analitica')}
                pathname={pathname}
              />
            </div>

            <div>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Configuración
              </p>
              <SidebarSubmenu
                label="Configuracion"
                icon={Settings}
                items={configSubmenu}
                isOpen={open.config}
                onToggle={() => toggle('config')}
                pathname={pathname}
              />
            </div>
          </nav>

          <div className="border-t border-white/10 px-4 py-4">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
              Cerrar sesion
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="fixed left-0 right-0 top-0 z-40 border-b bg-white md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              aria-label={mobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <h1 className="text-lg font-bold">Admin Panel</h1>
          </div>
          <button onClick={logout} className="p-2 text-gray-600 hover:text-gray-900">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        {mobileMenuOpen && (
          <nav className="space-y-2 px-2 pb-2">
            {/* Dashboard chip */}
            <div className="flex gap-1 overflow-x-auto">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-2',
                      isActive ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            <MobileSubmenu
              label="Productos"
              icon={Package}
              items={productosSubmenu}
              isOpen={open.productos}
              onToggle={() => toggle('productos')}
              pathname={pathname}
            />
            <MobileSubmenu
              label="Ventas"
              icon={DollarSign}
              items={ventasSubmenu}
              isOpen={open.ventas}
              onToggle={() => toggle('ventas')}
              pathname={pathname}
            />
            <MobileSubmenu
              label="Analítica"
              icon={LineChart}
              items={analiticaSubmenu}
              isOpen={open.analitica}
              onToggle={() => toggle('analitica')}
              pathname={pathname}
            />
            <MobileSubmenu
              label="Configuracion"
              icon={Settings}
              items={configSubmenu}
              isOpen={open.config}
              onToggle={() => toggle('config')}
              pathname={pathname}
            />
          </nav>
        )}
      </header>

      {/* Main content */}
      <main
        className={cn(
          'min-h-screen pt-16 md:pt-0 transition-[margin] duration-200',
          desktopMenuOpen ? 'md:ml-64' : 'md:ml-0'
        )}
      >
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
