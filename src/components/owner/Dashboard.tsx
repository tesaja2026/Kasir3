import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  formatRupiah,
  formatTime,
  restockScore,
  restockReason,
  type Product,
  type Store,
  type Transaction,
} from '../../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import {
  ReceiptText,
  TrendingUp,
  AlertTriangle,
  Flame,
  Lightbulb,
} from 'lucide-react';

export default function Dashboard({ store }: { store: Store }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [pRes, tRes, cRes] = await Promise.all([
      supabase.from('products').select('*').eq('store_token', store.token),
      supabase
        .from('transactions')
        .select('*')
        .eq('store_token', store.token)
        .gte('created_at', startOfToday())
        .order('created_at', { ascending: false }),
      supabase.from('customers').select('id, name').eq('store_token', store.token),
    ]);
    if (pRes.data) setProducts(pRes.data);
    if (tRes.data) setTransactions(tRes.data);
    if (cRes.data) {
      const map: Record<string, string> = {};
      for (const c of cRes.data) map[c.id] = c.name;
      setCustomers(map);
    }
    setLoading(false);
  }, [store.token]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`dashboard-${store.token}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `store_token=eq.${store.token}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `store_token=eq.${store.token}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, store.token]);

  const totalSales = transactions.reduce((s, t) => s + Number(t.total), 0);
  const totalProfit = transactions.reduce((s, t) => s + Number(t.profit), 0);

  const lowStock = [...products].sort((a, b) => a.stock - b.stock).slice(0, 5);
  const bestSelling = [...products].sort((a, b) => b.sold_count - a.sold_count).slice(0, 5);
  const restock = [...products].sort((a, b) => restockScore(b) - restockScore(a)).slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={<ReceiptText className="h-5 w-5" />}
          label="Total Transaksi Hari Ini"
          value={formatRupiah(totalSales)}
          sub={`${transactions.length} transaksi`}
          loading={loading}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Keuntungan Bersih Hari Ini"
          value={formatRupiah(totalProfit)}
          sub="harga jual - harga modal"
          loading={loading}
          accent
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-5 w-5 text-amber-500" /> Rekomendasi Restok Cerdas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : restock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada produk.</p>
          ) : (
            restock.map((p) => (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{p.name}</p>
                  <Badge variant={p.stock <= 2 ? 'destructive' : 'secondary'}>Stok: {p.stock}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Skor {restockScore(p).toFixed(2)} — {restockReason(p)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MiniList
          title="Stok Paling Sedikit"
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          items={lowStock}
          render={(p) => (
            <Badge variant={p.stock <= 2 ? 'destructive' : 'secondary'}>Sisa {p.stock}</Badge>
          )}
          loading={loading}
        />
        <MiniList
          title="Paling Sering Terjual"
          icon={<Flame className="h-4 w-4 text-amber-500" />}
          items={bestSelling}
          render={(p) => <Badge variant="secondary">{p.sold_count}x terjual</Badge>}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Transaksi Hari Ini</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada transaksi hari ini.</p>
          ) : (
            transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-semibold">{t.customer_name || 'Umum'}</p>
                  <p className="text-xs text-muted-foreground">{formatTime(t.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatRupiah(Number(t.total))}</p>
                  <p className="text-xs text-success">+{formatRupiah(Number(t.profit))}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  loading,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? 'border-primary/30 bg-primary/5' : ''}>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            accent ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-28" />
          ) : (
            <p className={`truncate text-lg font-extrabold ${accent ? 'text-primary' : ''}`}>{value}</p>
          )}
          <p className="text-[11px] text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniList({
  title,
  icon,
  items,
  render,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  items: Product[];
  render: (p: Product) => React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada produk.</p>
        ) : (
          items.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="truncate font-medium">{p.name}</span>
              {render(p)}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
