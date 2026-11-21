import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CUSTOMER_CODE_KEY, CUSTOMER_TOKEN_KEY, type Customer, type Store } from '../lib/types';
import { Logo } from '../lib/logo';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { ShoppingBag, Loader2, ArrowRight, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerLanding() {
  const navigate = useNavigate();
  const [code, setCode] = useState(() => localStorage.getItem(CUSTOMER_CODE_KEY) || '');
  const [loading, setLoading] = useState(false);

  async function openCatalog(e: React.FormEvent) {
    e.preventDefault();
    const loginCode = code.trim().toUpperCase();
    if (loginCode.length !== 6) {
      toast.error('Kode harus 6 karakter');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*, stores(name, token)')
      .eq('login_code', loginCode)
      .maybeSingle();
    setLoading(false);
    if (error || !data || !data.stores) {
      toast.error('Kode tidak ditemukan. Minta kode Anda kepada pemilik toko.');
      return;
    }
    const customer = data as unknown as Customer & { stores: Store };
    localStorage.setItem(CUSTOMER_CODE_KEY, loginCode);
    localStorage.setItem(CUSTOMER_TOKEN_KEY, customer.stores.token);
    navigate('/katalog');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/10 via-background to-background p-4">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <Logo size={64} />
        <h1 className="text-3xl font-extrabold tracking-tight">didKasir</h1>
        <p className="text-sm text-muted-foreground">
          Masukkan kode pribadi Anda dari pemilik toko
        </p>
      </div>
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <form onSubmit={openCatalog} className="flex flex-col gap-4">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="KODE ANDA (6 karakter)"
              maxLength={6}
              className="h-14 text-center text-2xl font-extrabold tracking-[0.4em] uppercase"
              autoCapitalize="characters"
              autoComplete="off"
            />
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Masuk Katalog <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Pemilik toko?{' '}
        <a href="/toko" className="font-semibold text-primary hover:underline">
          Masuk ke Aplikasi Toko di sini
        </a>
      </p>
    </div>
  );
}
