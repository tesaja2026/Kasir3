import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, type Store, type TransactionItem } from '../../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { AlertCircle, ClipboardList, PackageOpen } from 'lucide-react';

type PendingTransaction = {
  items: TransactionItem[] | null;
};

type ProductSummary = {
  id: string;
  name: string;
  qty: number;
  orderCount: number;
  estimatedTotal: number;
};

export default function PendingSummary({ store }: { store: Store }) {
  const [orders, setOrders] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const { data, error: queryError } = await supabase
      .from('transactions')
      .select('items')
      .eq('store_token', store.token)
      .eq('source', 'customer')
      .eq('status', 'pending');

    if (queryError) {
      setError(true);
      setLoading(false);
      return;
    }

    setOrders((data ?? []) as PendingTransaction[]);
    setLoading(false);
  }, [store.token]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`pending-summary-${store.token}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `store_token=eq.${store.token}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, store.token]);

  const summary = useMemo(() => {
    const byProduct = new Map<string, ProductSummary>();

    for (const order of orders) {
      for (const item of order.items ?? []) {
        const current = byProduct.get(item.id);
        if (current) {
          current.qty += item.qty;
          current.orderCount += 1;
          current.estimatedTotal += item.price * item.qty;
        } else {
          byProduct.set(item.id, {
            id: item.id,
            name: item.name,
            qty: item.qty,
            orderCount: 1,
            estimatedTotal: item.price * item.qty,
          });
        }
      }
    }

    return Array.from(byProduct.values()).sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
  }, [orders]);

  const totalItems = summary.reduce((total, item) => total + item.qty, 0);
  const estimatedTotal = summary.reduce((total, item) => total + item.estimatedTotal, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Rekap Pesanan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jumlah seluruh produk dari pesanan pelanggan yang belum dikonfirmasi.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Rekap belum dapat dimuat. Periksa koneksi lalu buka menu ini kembali.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pesanan menunggu</p>
            {loading ? <Skeleton className="mt-2 h-7 w-16" /> : <p className="mt-1 text-2xl font-extrabold text-primary">{orders.length}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total item diminta</p>
            {loading ? <Skeleton className="mt-2 h-7 w-16" /> : <p className="mt-1 text-2xl font-extrabold text-primary">{totalItems}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageOpen className="h-5 w-5 text-primary" />
            Produk yang perlu disiapkan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-3 px-4 pb-4">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : summary.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 pb-6 pt-3 text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-semibold">Belum ada pesanan yang menunggu</p>
              <p className="text-xs text-muted-foreground">
                Produk akan muncul di sini setelah pelanggan mengirim pesanan.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {summary.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Dari {item.orderCount} pesanan pelanggan
                    </p>
                  </div>
                  <Badge className="shrink-0 px-3 py-1 text-base font-extrabold">
                    {item.qty} pcs
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && summary.length > 0 && (
        <p className="text-right text-xs text-muted-foreground">
          Perkiraan nilai pesanan: <span className="font-semibold">{formatRupiah(estimatedTotal)}</span>
        </p>
      )}
    </div>
  );
}
