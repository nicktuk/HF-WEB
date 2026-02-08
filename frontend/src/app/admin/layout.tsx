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
} from 'lucide-react';
import { useAuth, useIsAuthenticated } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Productos', href: '/admin/productos', icon: Package },
  { name: 'Comparador', href: '/admin/comparador', icon: Scale },
];

const configSubmenu = [
  { name: 'Categorías', href: '/admin/categorias', icon: Tags },
  { name: 'Subcategorías', href: '/admin/subcategorias', icon: FolderTree },
  { name: 'Stock', href: '/admin/stock', icon: Package },
  { name: 'Webs Origen', href: '/admin/source-websites', icon: Globe },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const logout = useAuth((state) => state.logout);
  const [configOpen, setConfigOpen] = useState(false);

  // Auto-expand config menu if on a config page
  useEffect(() => {
    const isConfigPage = configSubmenu.some(item => pathname.startsWith(item.href));
    if (isConfigPage) {
      setConfigOpen(true);
    }
  }, [pathname]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated && pathname !== '/admin/login') {
      router.push('/admin/login');
    }
  }, [isAuthenticated, pathname, router]);

  // Show nothing while checking auth
  if (!isAuthenticated && pathname !== '/admin/login') {
    return null;
  }

  // Login page doesn't need the admin layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 hidden md:block">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-6 py-4 border-b border-gray-800">
            <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/admin' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}

            {/* Configuración submenu */}
            <div>
              <button
                onClick={() => setConfigOpen(!configOpen)}
                className={cn(
                  'flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  configSubmenu.some(item => pathname.startsWith(item.href))
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                <span className="flex items-center gap-3">
                  <Settings className="h-5 w-5" />
                  Configuración
                </span>
                {configOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {configOpen && (
                <div className="mt-1 ml-4 space-y-1">
                  {configSubmenu.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-gray-700 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
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
          <div className="px-4 py-4 border-t border-gray-800">
            <button
              onClick={logout}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold">Admin Panel</h1>
          <button
            onClick={logout}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        {/* Mobile navigation */}
        <nav className="flex overflow-x-auto px-2 pb-2 gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
          {/* Config submenu items for mobile */}
          {configSubmenu.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main content */}
      <main className="md:ml-64 pt-24 md:pt-0 min-h-screen">
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
