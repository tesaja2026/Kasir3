import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, formatTime, type Product, type Store, type Transaction } from '../../lib/types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { ClipboardList, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MessageCircle, Printer } from 'lucide-react';
import { buildReceiptText, printReceipt, whatsappReceiptUrl } from '../../lib/receipt';

export default function Orders({ store }: { store: Store }) {
  const [orders, setOrders] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [oRes, pRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('store_token', store.token)
        .neq('source', 'owner')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('products').select('*').eq('store_token', store.token),
    ]);
    if (oRes.data) setOrders(oRes.data);
    if (pRes.data) setProducts(pRes.data);
    setLoading(false);
  }, [store.token]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`orders-${store.token}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `store_token=eq.${store.token}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, store.token]);

  async function confirmOrder(t: Transaction) {
    setActing(t.id);
    for (const i of t.items || []) {
      const p = products.find((x) => x.id === i.id);
      if (p) {
        await supabase
          .from('products')
          .update({
            stock: Math.max(p.stock - i.qty, 0),
            sold_count: p.sold_count + i.qty,
          })
          .eq('id', p.id)
          .eq('store_token', store.token);
      }
    }
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'confirmed' })
      .eq('id', t.id)
      .eq('store_token', store.token);
    setActing(null);
    if (error) {
      toast.error('Gagal mengonfirmasi pesanan');
      return;
    }
    printReceipt(store, t);
    toast.success('Pesanan dikonfirmasi. Nota pembelian terbuka untuk dicetak.', {
      action: {
        label: 'WhatsApp',
        onClick: () => window.open(whatsappReceiptUrl(store, t), '_blank'),
      },
      duration: 12000,
    });
  }

  async function rejectOrder(t: Transaction) {
    setActing(t.id);
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'rejected' })
      .eq('id', t.id)
      .eq('store_token', store.token);
    setActing(null);
    if (error) {
      toast.error('Gagal menolak pesanan');
      return;
    }
    toast.success('Pesanan ditolak');
  }

  const pending = orders.filter((o) => o.status === 'pending');
  const history = orders.filter((o) => o.status !== 'pending');

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        Semua orderan dari aplikasi pelanggan muncul di sini dan harus dikonfirmasi dulu sebelum
        diproses — stok baru berkurang setelah Anda mengonfirmasi.
      </p>
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <ClipboardList className="h-4 w-4" /> Perlu Konfirmasi ({pending.length})
        </h2>
        <div className="flex flex-col gap-3">
          {loading ? (
            <Skeleton className="h-28 rounded-xl" />
          ) : pending.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Tidak ada pesanan yang menunggu konfirmasi.
              </CardContent>
            </Card>
          ) : (
            pending.map((o) => (
              <Card key={o.id} className="border-amber-300 bg-amber-50/50">
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{o.customer_name || 'Pelanggan'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(o.created_at)} • via aplikasi pelanggan
                      </p>
                    </div>
                    <Badge variant="outline" className="border-amber-400 text-amber-600">
                      Menunggu
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-0.5 rounded-lg bg-white/70 p-2">
                    {o.items.map((i) => (
                      <div key={i.id} className="flex justify-between text-sm">
                        <span>
                          {i.name} x{i.qty}
                        </span>
                        <span className="font-semibold">{formatRupiah(i.price * i.qty)}</span>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-between border-t pt-1 font-extrabold text-primary">
                      <span>Total</span>
                      <span>{formatRupiah(Number(o.total))}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={acting === o.id}
                      onClick={() => confirmOrder(o)}
                    >
                      {acting === o.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Konfirmasi
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={acting === o.id}
                      onClick={() => rejectOrder(o)}
                    >
                      <X className="mr-2 h-4 w-4" /> Tolak
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-muted-foreground">Riwayat Pesanan</h2>
          <div className="flex flex-col gap-2">
            {history.map((o) => (
              <Card key={o.id}>
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-semibold">{o.customer_name || 'Pelanggan'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(o.created_at)} • {formatRupiah(Number(o.total))}
                    </p>
                  </div>
                  {o.status === 'confirmed' ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Cetak nota"
                        title="Cetak nota"
                        onClick={() => printReceipt(store, o)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Bagikan ke WhatsApp"
                        title="Bagikan ke WhatsApp"
                        onClick={() => window.open(whatsappReceiptUrl(store, o), '_blank')}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Badge className="bg-success/15 text-success hover:bg-success/25">
                        <Check className="mr-1 h-3 w-3" /> Dikonfirmasi
                      </Badge>
                    </div>
                  ) : o.status === 'rejected' ? (
                    <Badge variant="destructive">
                      <X className="mr-1 h-3 w-3" /> Ditolak
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Selesai</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
