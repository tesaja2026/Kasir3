import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  formatRupiah,
  formatTime,
  type Customer,
  type Product,
  type Store,
  type Transaction,
  type TransactionItem,
} from '../../lib/types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Logo } from '../../lib/logo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Search, ShoppingCart, Trash2, Minus, Plus, Banknote, Download, Image, Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function Cashier({ store }: { store: Store }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [exporting, setExporting] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [pRes, cRes] = await Promise.all([
      supabase.from('products').select('*').eq('store_token', store.token).order('name'),
      supabase.from('customers').select('*').eq('store_token', store.token).order('name'),
    ]);
    if (pRes.data) setProducts(pRes.data);
    if (cRes.data) setCustomers(cRes.data);
    setLoading(false);
  }, [store.token]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`cashier-${store.token}`)
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

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );
  const cartItems: { product: Product; qty: number }[] = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty }))
    .filter((x) => x.product);
  const cartTotal = cartItems.reduce((s, i) => s + i.product.price * i.qty, 0);
  const cartProfit = cartItems.reduce(
    (s, i) => s + (i.product.price - i.product.modal_price) * i.qty,
    0
  );

  function addToCart(p: Product) {
    setCart((c) => ({ ...c, [p.id]: Math.min((c[p.id] || 0) + 1, p.stock) }));
  }
  function setQty(p: Product, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[p.id];
      else next[p.id] = Math.min(qty, p.stock);
      return next;
    });
  }

  async function pay() {
    if (!customerId) {
      toast.error('Pilih pelanggan terlebih dahulu');
      return;
    }
    if (cartItems.length === 0) {
      toast.error('Keranjang masih kosong');
      return;
    }
    setPaying(true);
    const customer = customers.find((c) => c.id === customerId)!;
    const items: TransactionItem[] = cartItems.map((i) => ({
      id: i.product.id,
      name: i.product.name,
      price: i.product.price,
      modal_price: i.product.modal_price,
      qty: i.qty,
    }));

    const { data: trx, error: trxError } = await supabase
      .from('transactions')
      .insert({
        store_token: store.token,
        customer_id: customer.id,
        customer_name: customer.name,
        items,
        total: cartTotal,
        profit: cartProfit,
        source: 'owner',
      })
      .select()
      .single();

    if (trxError || !trx) {
      setPaying(false);
      toast.error('Gagal menyimpan transaksi');
      return;
    }

    for (const i of cartItems) {
      const { error: upErr } = await supabase
        .from('products')
        .update({
          stock: i.product.stock - i.qty,
          sold_count: i.product.sold_count + i.qty,
        })
        .eq('id', i.product.id)
        .eq('store_token', store.token);
      if (upErr) toast.error(`Gagal memperbarui stok ${i.product.name}`);
    }

    const { data: fresh } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', trx.id)
      .maybeSingle();
    setPaying(false);
    setReceipt(fresh ?? trx);
    setCart({});
    toast.success('Transaksi berhasil!');
  }

  async function ensureCanvas(): Promise<HTMLCanvasElement | null> {
    if (!receiptRef.current) return null;
    return html2canvas(receiptRef.current, { scale: 2, backgroundColor: '#ffffff' });
  }

  async function exportPDF() {
    setExporting(true);
    try {
      const canvas = await ensureCanvas();
      if (!canvas) return;
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`nota-${receipt?.id.slice(0, 8)}.pdf`);
    } catch {
      toast.error('Gagal membuat PDF');
    } finally {
      setExporting(false);
    }
  }

  async function exportJPG() {
    setExporting(true);
    try {
      const canvas = await ensureCanvas();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `nota-${receipt?.id.slice(0, 8)}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.92);
      link.click();
    } catch {
      toast.error('Gagal membuat gambar');
    } finally {
      setExporting(false);
    }
  }

  function shareWhatsApp() {
    if (!receipt) return;
    const lines = [
      `*${store.name}*`,
      `Nota ${formatTime(receipt.created_at)}`,
      `Pelanggan: ${receipt.customer_name || 'Umum'}`,
      '',
      ...receipt.items.map(
        (i) => `${i.name} x${i.qty} = ${formatRupiah(i.price * i.qty)}`
      ),
      '',
      `TOTAL: ${formatRupiah(Number(receipt.total))}`,
      'Terima kasih telah berbelanja!',
    ];
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-semibold">Pelanggan (wajib)</p>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={customers.length === 0}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">
              {customers.length === 0 ? 'Belum ada pelanggan' : 'Pilih pelanggan'}
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.phone ? ` — ${c.phone}` : ''}
              </option>
            ))}
          </select>
          {customers.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Tambahkan pelanggan terlebih dahulu di menu Pelanggan.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari produk..."
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : filtered.length === 0 ? (
          <p className="col-span-full text-sm text-muted-foreground">
            Tidak ada produk. Tambahkan di menu Produk.
          </p>
        ) : (
          filtered.map((p) => (
            <Card key={p.id} className="flex flex-col justify-between">
              <CardContent className="flex flex-1 flex-col gap-1 p-3">
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
                <p className="text-sm font-bold text-primary">{formatRupiah(p.price)}</p>
                <Badge variant={p.stock <= 0 ? 'destructive' : 'secondary'} className="w-fit">
                  Stok: {p.stock}
                </Badge>
                <Button
                  size="sm"
                  className="mt-auto w-full"
                  disabled={p.stock <= 0}
                  onClick={() => addToCart(p)}
                >
                  <Plus className="mr-1 h-3 w-3" /> Keranjang
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {cartItems.length > 0 && (
        <Card className="sticky bottom-24 z-20 border-primary/30 shadow-lg shadow-primary/10">
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2 font-bold">
              <ShoppingCart className="h-4 w-4" /> Keranjang
            </div>
            {cartItems.map(({ product, qty }) => (
              <div key={product.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{product.name}</span>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => setQty(product, qty - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center font-semibold">{qty}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => setQty(product, qty + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <button
                    className="ml-1 text-muted-foreground hover:text-destructive"
                    onClick={() => setQty(product, 0)}
                    aria-label="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <span className="w-24 text-right font-semibold">
                  {formatRupiah(product.price * qty)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-2">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-extrabold text-primary">{formatRupiah(cartTotal)}</span>
            </div>
            <Button size="lg" onClick={pay} disabled={paying || !customerId}>
              {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
              Bayar
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transaksi Berhasil</DialogTitle>
            <DialogDescription>Cetak atau bagikan nota berikut.</DialogDescription>
          </DialogHeader>
          {receipt && (
            <>
              <div
                ref={receiptRef}
                className="rounded-xl border bg-white p-5 text-black"
                style={{ fontFamily: 'monospace' }}
              >
                <div className="flex flex-col items-center gap-1 text-center">
                  <div className="scale-75"><Logo size={48} /></div>
                  <p className="text-base font-extrabold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    {store.name}
                  </p>
                  <p className="text-xs">Kode Toko: {store.token}</p>
                </div>
                <div className="my-3 border-t border-dashed" />
                <div className="flex justify-between text-xs">
                  <span>Waktu</span>
                  <span>{new Date(receipt.created_at).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Pelanggan</span>
                  <span>{receipt.customer_name || 'Umum'}</span>
                </div>
                <div className="my-3 border-t border-dashed" />
                {receipt.items.map((i) => (
                  <div key={i.id} className="mb-1">
                    <p className="text-sm font-semibold">{i.name}</p>
                    <div className="flex justify-between text-xs">
                      <span>
                        {i.qty} x {formatRupiah(i.price)}
                      </span>
                      <span>{formatRupiah(i.price * i.qty)}</span>
                    </div>
                  </div>
                ))}
                <div className="my-3 border-t border-dashed" />
                <div className="flex justify-between text-base font-extrabold">
                  <span>TOTAL</span>
                  <span>{formatRupiah(Number(receipt.total))}</span>
                </div>
                <p className="mt-3 text-center text-xs">Terima kasih telah berbelanja!</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" onClick={exportPDF} disabled={exporting}>
                  <Download className="mr-1 h-4 w-4" /> PDF
                </Button>
                <Button variant="outline" onClick={exportJPG} disabled={exporting}>
                  <Image className="mr-1 h-4 w-4" /> JPG
                </Button>
                <Button className="bg-[#25D366] hover:bg-[#1eb455]" onClick={shareWhatsApp}>
                  <Share2 className="mr-1 h-4 w-4" /> WhatsApp
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
