import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, type Store, type Transaction, type ClosedTransaction } from '../../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import {
  BarChart3,
  ShoppingCart,
  TrendingUp,
  Wallet,
  Trophy,
  RotateCcw,
  Loader2,
  KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProductRow {
  name: string;
  qty: number;
  revenue: number;
  profit: number;
}

interface Report {
  count: number;
  revenue: number;
  profit: number;
  best: ProductRow[];
}

export default function MonthlyReport({ store }: { store: Store }) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [resetAt, setResetAt] = useState<string>(store.monthly_report_reset_at || '');
  const [resetOpen, setResetOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const since = resetAt
      ? new Date(Math.max(new Date(resetAt).getTime(), monthStart.getTime())).toISOString()
      : monthStart.toISOString();

    const [tRes, cRes, sRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('store_token', store.token)
        .gte('created_at', since),
      supabase
        .from('closed_transactions')
        .select('*')
        .eq('store_token', store.token)
        .gte('created_at', since),
      supabase.from('stores').select('monthly_report_reset_at').eq('token', store.token).maybeSingle(),
    ]);

    const all: (Transaction | ClosedTransaction)[] = [
      ...(tRes.data || []),
      ...(cRes.data || []),
    ];
    const rows: ProductRow[] = [];
    const map = new Map<string, ProductRow>();
    let revenue = 0;
    let profit = 0;
    for (const t of all) {
      if (t.status === 'rejected') continue;
      const total = Number(t.total);
      revenue += total;
      profit += Number(t.profit);
      for (const item of t.items || []) {
        const row = map.get(item.id) || { name: item.name, qty: 0, revenue: 0, profit: 0 };
        row.qty += item.qty;
        row.revenue += item.price * item.qty;
        row.profit += (item.price - item.modal_price) * item.qty;
        map.set(item.id, row);
      }
    }
    rows.push(...map.values());
    rows.sort((a, b) => b.qty - a.qty);
    setReport({ count: all.length, revenue, profit, best: rows.slice(0, 5) });
    if (sRes.data?.monthly_report_reset_at) setResetAt(sRes.data.monthly_report_reset_at);
    setLoading(false);
  }, [store.token, resetAt]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!pin) return;
    setResetting(true);
    const { data } = await supabase
      .from('stores')
      .select('password')
      .eq('token', store.token)
      .maybeSingle();
    if (!data || data.password !== pin) {
      setResetting(false);
      toast.error('PIN salah. Gunakan password login pemilik toko.');
      return;
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('stores')
      .update({ monthly_report_reset_at: now })
      .eq('token', store.token);
    setResetting(false);
    if (error) {
      toast.error('Gagal mereset laporan');
      return;
    }
    setResetAt(now);
    setPin('');
    setResetOpen(false);
    toast.success('Laporan bulanan direset. Perhitungan dimulai dari sekarang.');
  }

  const periodLabel = resetAt
    ? new Date(resetAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-primary" /> Laporan Bulanan
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit text-xs">
            Periode sejak {periodLabel}
          </Badge>
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          ) : report ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                  icon={ShoppingCart}
                  label="Jumlah Transaksi"
                  value={String(report.count)}
                />
                <StatCard icon={Wallet} label="Omzet" value={formatRupiah(report.revenue)} />
                <StatCard
                  icon={TrendingUp}
                  label="Keuntungan Bersih"
                  value={formatRupiah(report.profit)}
                  accent
                />
              </div>
              <div className="flex flex-col gap-2 rounded-xl border p-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Trophy className="h-4 w-4 text-amber-500" /> Produk Terlaris
                </p>
                {report.best.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada penjualan bulan ini.</p>
                ) : (
                  report.best.map((r, i) => (
                    <div
                      key={r.name}
                      className="flex items-center justify-between rounded-lg border p-2.5 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="truncate font-medium">{r.name}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold">{r.qty}x</p>
                        <p className="text-xs text-success">+{formatRupiah(r.profit)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <p className="text-sm font-semibold">Reset Laporan</p>
          <p className="text-xs text-muted-foreground">
            Reset memulai perhitungan baru dari saat tombol ditekan. Data tidak dihapus —
            riwayat tetap tersimpan. Klik Fullday pun tidak menghilangkan laporan ini.
          </p>
          <Button variant="destructive" onClick={() => setResetOpen(true)} className="w-fit">
            <RotateCcw className="mr-2 h-4 w-4" /> Reset Laporan Bulanan
          </Button>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Masukkan PIN</DialogTitle>
            <DialogDescription>
              PIN sama dengan password login pemilik toko. Laporan akan mulai dihitung ulang
              dari sekarang.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReset} className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reset-pin">PIN</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-pin"
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="PIN pemilik toko"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setResetOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" variant="destructive" className="flex-1" disabled={resetting}>
                {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className={`text-xl font-extrabold ${accent ? 'text-success' : ''}`}>{value}</p>
    </div>
  );
}
