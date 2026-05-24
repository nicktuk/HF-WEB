'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type AdminRole } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function LoginPage() {
  const [apiKey, setApiKey] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const login = useAuth((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/me`,
        { headers: { 'X-Admin-API-Key': apiKey } }
      );

      if (response.ok) {
        const data = await response.json();
        login(apiKey, data.role as AdminRole, remember);
        router.push('/admin');
      } else {
        setError('API key inválida');
      }
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold text-center text-gray-900">
            Admin Panel
          </h1>
          <p className="text-center text-gray-600">
            Ingresa tu API key para continuar
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              label="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Ingresa tu API key"
              error={error}
              required
            />

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                Recordarme en este equipo
                <span className="text-xs text-gray-400 ml-1">(hasta 12 hs)</span>
              </span>
            </label>

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
            >
              Ingresar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
