import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  CUSTOMER_TOKEN_KEY,
  CUSTOMER_CODE_KEY,
  formatRupiah,
  formatTime,
  type Customer,
  type Product,
  type Store,
  type Transaction,
  type TransactionItem,
} from '../lib/types';
import { Logo } from '../lib/logo';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { LogOut, ShoppingCart, Plus, Minus, Trash2, Banknote, Loader2, KeyRound, BadgeCheck, Package, Search, Phone, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerCatalog() {
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [me, setMe] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [myOrders, setMyOrders] = useState<Transaction[]>([]);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [contactOpen, setContactOpen] = useState(false);

  const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  const myCode = localStorage.getItem(CUSTOMER_CODE_KEY);

  useEffect(() => {
    if (!token || !myCode) {
      navigate('/', { replace: true });
      return;
    }
    (async () => {
      const { data: meData } = await supabase
        .from('customers')
        .select('*')
        .eq('login_code', myCode)
        .maybeSingle();
      if (!meData) {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_CODE_KEY);
        navigate('/', { replace: true });
        return;
      }
      setMe(meData);
      const { data: s } = await supabase
        .from('stores')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (!s) {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_CODE_KEY);
        navigate('/', { replace: true });
        return;
      }
      setStore(s);
      setLoading(false);
    })();
  }, [token, myCode, navigate]);

  const load = useCallback(async () => {
    if (!token) return;
    const [pRes, oRes] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('store_token', token)
        .order('name'),
      supabase
        .from('transactions')
        .select('*')
        .eq('store_token', token)
        .eq('customer_id', me?.id ?? '')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    if (pRes.data) setProducts(pRes.data);
    if (oRes.data) setMyOrders(oRes.data);
  }, [token, me?.id]);

  useEffect(() => {
    if (!store || !me) return;
    load();
    const channel = supabase
      .channel(`catalog-${token}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `store_token=eq.${token}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `store_token=eq.${token}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [store, me, load, token]);

  if (!token || !store || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const cartItems: { product: Product; qty: number }[] = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty }))
    .filter((x) => x.product);
  const cartTotal = cartItems.reduce((s, i) => s + i.product.price * i.qty, 0);
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase())
  );

  function normalizePhone(raw: string): string {
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    return digits;
  }
  const storePhone = store.phone || '';
  const waPhone = normalizePhone(storePhone);
  const storeMapsQuery = encodeURIComponent(store.name);

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

  function logout() {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_CODE_KEY);
    navigate('/', { replace: true });
  }

  async function checkout() {
    if (cartItems.length === 0) {
      toast.error('Keranjang masih kosong');
      return;
    }
    if (!me) return;
    setSubmitting(true);

    const items: TransactionItem[] = cartItems.map((i) => ({
      id: i.product.id,
      name: i.product.name,
      price: i.product.price,
      modal_price: i.product.modal_price,
      qty: i.qty,
    }));
    const profit = cartItems.reduce(
      (s, i) => s + (i.product.price - i.product.modal_price) * i.qty,
      0
    );

    const { error } = await supabase.from('transactions').insert({
      store_token: store!.token,
      customer_id: me.id,
      customer_name: me.name,
      items,
      total: cartTotal,
      profit,
      source: 'customer',
      status: 'pending',
    });
    if (error) {
      setSubmitting(false);
      toast.error('Gagal mengirim pesanan');
      return;
    }

    setSubmitting(false);
    setSuccess(true);
    setCart({});
    setCheckoutOpen(false);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col pb-28">
      <header className="sticky top-0 z-30 border-b bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={40} />
            <div className="min-w-0">
              <p className="truncate font-bold leading-tight">{store.name}</p>
              {me && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BadgeCheck className="h-3.5 w-3.5 text-success" />
                  {me.name} • <span className="font-mono font-bold text-primary">{me.login_code}</span>
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" onClick={() => setContactOpen(true)} aria-label="Hubungi toko">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={() => setOrdersOpen(true)}>
            <ShoppingCart className="mr-1 h-4 w-4" /> Pesanan Saya
          </Button>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Keluar">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk atau kategori..."
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground">Belum ada produk tersedia.</p>
          ) : filteredProducts.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground">
              Tidak ada produk yang cocok dengan "{search}".
            </p>
          ) : (
            filteredProducts.map((p) => (
              <Card key={p.id} className="flex flex-col justify-between">
                <CardContent className="flex flex-1 flex-col gap-1 p-3">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      loading="lazy"
                      className="mb-1 h-28 w-full rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="mb-1 flex h-28 w-full items-center justify-center rounded-lg border bg-muted">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
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
      </main>

      {cartItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {cartItems.reduce((s, i) => s + i.qty, 0)} item di keranjang
              </p>
              <p className="text-lg font-extrabold text-primary">{formatRupiah(cartTotal)}</p>
            </div>
            <Button size="lg" onClick={() => setCheckoutOpen(true)}>
              <ShoppingCart className="mr-2 h-4 w-4" /> Checkout
            </Button>
          </div>
        </div>
      )}

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pesanan Anda</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
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
            <div className="mt-2 flex flex-col gap-3">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="flex items-center gap-1 font-semibold">
                  <KeyRound className="h-4 w-4 text-primary" /> Pesanan atas nama {me?.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Kode pelanggan Anda: {myCode} — pesanan otomatis tercatat ke identitas Anda.
                </p>
              </div>
              <Button size="lg" onClick={checkout} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Banknote className="mr-2 h-4 w-4" /> Kirim Pesanan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={success} onOpenChange={setSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pesanan terkirim!</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Pesanan Anda sedang menunggu konfirmasi dari {store.name}. Cek status pesanan di tombol
            "Pesanan Saya" di atas.
          </p>
          <Button onClick={() => setSuccess(false)}>OK</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hubungi {store.name}</DialogTitle>
          </DialogHeader>
          {storePhone ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Hubungi toko untuk bertanya tentang produk, pesanan, atau ketersediaan stok.
              </p>
              <p className="text-center text-lg font-bold tracking-wide">{storePhone}</p>
              <div className="grid grid-cols-2 gap-3">
                <Button asChild variant="outline">
                  <a href={`tel:+${waPhone}`}>
                    <Phone className="mr-2 h-4 w-4" /> Telepon
                  </a>
                </Button>
                <Button asChild>
                  <a
                    href={`https://wa.me/${waPhone}?text=${storeMapsQuery}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Toko ini belum menambahkan nomor telepon. Silakan coba lagi nanti.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={ordersOpen} onOpenChange={setOrdersOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pesanan Saya</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {myOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>
            ) : (
              myOrders.map((o) => (
                <div key={o.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">{formatRupiah(Number(o.total))}</p>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatTime(o.created_at)} • {o.items.length} produk
                  </p>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {o.items.map((i) => (
                      <p key={i.id} className="text-xs text-muted-foreground">
                        {i.name} x{i.qty}
                      </p>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending')
    return <Badge variant="outline" className="text-amber-600 border-amber-300">Menunggu konfirmasi</Badge>;
  if (status === 'confirmed' || status === 'done')
    return <Badge className="bg-success/15 text-success hover:bg-success/25">Dikonfirmasi</Badge>;
  return <Badge variant="destructive">Ditolak</Badge>;
}
