import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { generateCode, TOKEN_KEY, type Store } from '../lib/types';
import { Logo } from '../lib/logo';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Store as StoreIcon, LogIn, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OwnerLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [regName, setRegName] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');

  const [created, setCreated] = useState<Store | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginUser.trim() || !loginPass) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('username', loginUser.trim())
      .eq('password', loginPass)
      .maybeSingle();
    setLoading(false);
    if (error || !data) {
      toast.error('Username atau password salah');
      return;
    }
    localStorage.setItem(TOKEN_KEY, data.token);
    navigate('/dashboard');
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regName.trim() || !regUser.trim() || regPass.length < 4) {
      toast.error('Lengkapi semua data, password minimal 4 karakter');
      return;
    }
    setLoading(true);
    const { data: existing } = await supabase
      .from('stores')
      .select('id')
      .eq('username', regUser.trim())
      .maybeSingle();
    if (existing) {
      setLoading(false);
      toast.error('Username sudah dipakai, coba yang lain');
      return;
    }
    const payload = {
      name: regName.trim(),
      username: regUser.trim(),
      password: regPass,
      token: generateCode(6),
      owner_code: generateCode(6),
    };
    const { data, error } = await supabase
      .from('stores')
      .insert(payload)
      .select()
      .single();
    setLoading(false);
    if (error || !data) {
      toast.error('Gagal membuat toko, coba lagi');
      return;
    }
    setCreated(data);
  }

  function copyToken() {
    if (!created) return;
    navigator.clipboard.writeText(created.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function finish() {
    if (!created) return;
    localStorage.setItem(TOKEN_KEY, created.token);
    navigate('/dashboard');
  }

  if (created) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 via-background to-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
            <Logo size={56} />
            <div>
              <h1 className="text-xl font-bold">Toko "{created.name}" berhasil dibuat!</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Bagikan kode ini kepada pelanggan agar mereka bisa melihat katalog toko Anda.
              </p>
            </div>
            <button
              onClick={copyToken}
              className="group flex w-full items-center justify-between rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-5 py-4 transition hover:border-primary"
            >
              <span className="text-3xl font-extrabold tracking-[0.3em] text-primary">
                {created.token}
              </span>
              {copied ? (
                <Check className="h-5 w-5 text-success" />
              ) : (
                <Copy className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              )}
            </button>
            <div className="w-full rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Kode Pemilik:</span>{' '}
                {created.owner_code} — simpan baik-baik.
              </p>
              <p className="mt-1">
                <span className="font-semibold text-foreground">Username:</span> {created.username}
              </p>
            </div>
            <Button className="w-full" size="lg" onClick={finish}>
              <StoreIcon className="mr-2 h-4 w-4" /> Buka Aplikasi Toko
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 via-background to-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo size={56} />
          <h1 className="text-2xl font-extrabold tracking-tight">didKasir</h1>
          <p className="text-sm text-muted-foreground">Aplikasi Toko & Kasir</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'register')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Masuk</TabsTrigger>
                <TabsTrigger value="register">Buat Toko</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-user">Username</Label>
                    <Input
                      id="login-user"
                      value={loginUser}
                      onChange={(e) => setLoginUser(e.target.value)}
                      placeholder="username pemilik"
                      autoCapitalize="none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-pass">Password</Label>
                    <Input
                      id="login-pass"
                      type="password"
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      placeholder="password"
                    />
                  </div>
                  <Button type="submit" size="lg" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                    Masuk ke Toko
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="mt-4 flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name">Nama Toko</Label>
                    <Input
                      id="reg-name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Contoh: Berkah Jaya"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-user">Username</Label>
                    <Input
                      id="reg-user"
                      value={regUser}
                      onChange={(e) => setRegUser(e.target.value)}
                      placeholder="username untuk login"
                      autoCapitalize="none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-pass">Password</Label>
                    <Input
                      id="reg-pass"
                      type="password"
                      value={regPass}
                      onChange={(e) => setRegPass(e.target.value)}
                      placeholder="minimal 4 karakter"
                    />
                  </div>
                  <Button type="submit" size="lg" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Buat Toko & Dapatkan Kode
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Pelanggan?{' '}
          <a href="/" className="font-semibold text-primary hover:underline">
            Masuk dengan Kode Toko di sini
          </a>
        </p>
      </div>
    </div>
  );
}
