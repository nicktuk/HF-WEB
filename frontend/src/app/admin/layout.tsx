'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Globe,
  Settings,
  LogOut,
  Tags,
  FolderTree,
  ChevronDown,
  ChevronRight,
  Scale,
  DollarSign,
  MessageCircle,
  ShoppingCart,
  PackageX,
  Menu,
  X,
} from 'lucide-react';
import { useAuth, useIsAuthenticated } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Productos', href: '/admin/productos', icon: Package },
  { name: 'Ventas', href: '/admin/ventas', icon: DollarSign },
  { name: 'WhatsApp', href: '/admin/whatsapp', icon: MessageCircle },
  { name: 'Comparador', href: '/admin/comparador', icon: Scale },
];

const stockSubmenu = [
  { name: 'Compras', href: '/admin/stock/compras', icon: ShoppingCart },
  { name: 'Stock', href: '/admin/stock/resumen', icon: Package },
  { name: 'Stock sin match', href: '/admin/stock', icon: PackageX },
];

const configSubmenu = [
  { name: 'Categorias', href: '/admin/categorias', icon: Tags },
  { name: 'Subcategorias', href: '/admin/subcategorias', icon: FolderTree },
  { name: 'Webs Origen', href: '/admin/source-websites', icon: Globe },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const logout = useAuth((state) => state.logout);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // Auto-expand submenu if on one of its pages.
  useEffect(() => {
    const isStockPage = stockSubmenu.some((item) => pathname.startsWith(item.href));
    const isConfigPage = configSubmenu.some((item) => pathname.startsWith(item.href));
    if (isStockPage) {
      setStockOpen(true);
    }
    if (isConfigPage) {
      setConfigOpen(true);
    }
  }, [pathname]);

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

  // Show nothing while checking auth.
  if (!isAuthenticated && pathname !== '/admin/login') {
    return null;
  }

  // Login page doesn't need the admin layout.
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <button
        onClick={() => setDesktopMenuOpen(!desktopMenuOpen)}
        className="fixed left-3 top-3 z-[60] hidden rounded-lg bg-gray-900 p-2 text-white shadow-md transition-colors hover:bg-gray-800 md:block"
        aria-label={desktopMenuOpen ? 'Ocultar menu' : 'Mostrar menu'}
      >
        {desktopMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 hidden w-64 bg-gray-900 transition-transform duration-200 md:block',
          desktopMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="border-b border-gray-800 px-6 py-4">
            <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-4 py-4">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}

            {/* Stock submenu */}
            <div>
              <button
                onClick={() => setStockOpen(!stockOpen)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  stockSubmenu.some((item) => pathname.startsWith(item.href))
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )}
              >
                <span className="flex items-center gap-3">
                  <ShoppingCart className="h-5 w-5" />
                  Stock
                </span>
                {stockOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {stockOpen && (
                <div className="ml-4 mt-1 space-y-1">
                  {stockSubmenu.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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

            {/* Configuracion submenu */}
            <div>
              <button
                onClick={() => setConfigOpen(!configOpen)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  configSubmenu.some((item) => pathname.startsWith(item.href))
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )}
              >
                <span className="flex items-center gap-3">
                  <Settings className="h-5 w-5" />
                  Configuracion
                </span>
                {configOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {configOpen && (
                <div className="ml-4 mt-1 space-y-1">
                  {configSubmenu.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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
          </nav>

          {/* Logout */}
          <div className="border-t border-gray-800 px-4 py-4">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
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
          <div className="flex gap-1 overflow-x-auto">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));

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

          <div className="space-y-1">
            <button
              onClick={() => setStockOpen(!stockOpen)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                stockSubmenu.some((item) => pathname.startsWith(item.href))
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Stock
              </span>
              {stockOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {stockOpen && (
              <div className="flex gap-1 overflow-x-auto pl-2">
                {stockSubmenu.map((item) => {
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

          <div className="space-y-1">
            <button
              onClick={() => setConfigOpen(!configOpen)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                configSubmenu.some((item) => pathname.startsWith(item.href))
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuracion
              </span>
              {configOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {configOpen && (
              <div className="flex gap-1 overflow-x-auto pl-2">
                {configSubmenu.map((item) => {
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
