import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, type Product, type Store } from '../../lib/types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { PackagePlus, Search, Pencil, Loader2, Package, ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface FormState {
  name: string;
  price: string;
  modal_price: string;
  stock: string;
  category: string;
  image_url: string;
}

const EMPTY: FormState = { name: '', price: '', modal_price: '', stock: '', category: '', image_url: '' };

export default function Products({ store }: { store: Store }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('store_token', store.token)
      .order('created_at', { ascending: false });
    if (data) setProducts(data);
    setLoading(false);
  }, [store.token]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`products-${store.token}`)
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

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      price: String(p.price),
      modal_price: String(p.modal_price),
      stock: String(p.stock),
      category: p.category || '',
      image_url: p.image_url || '',
    });
    setOpen(true);
  }

  async function pickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Pilih file gambar (JPG, PNG, dll)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, image_url: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(form.price);
    const modal = Number(form.modal_price);
    const stock = Number(form.stock);
    if (!form.name.trim() || !isFinite(price) || !isFinite(modal) || !isFinite(stock)) {
      toast.error('Lengkapi semua data dengan benar');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      price,
      modal_price: modal,
      stock,
      category: form.category.trim() || null,
      image_url: form.image_url || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editing.id)
        .eq('store_token', store.token));
    } else {
      ({ error } = await supabase
        .from('products')
        .insert({ ...payload, store_token: store.token }));
    }
    setSaving(false);
    if (error) {
      toast.error('Gagal menyimpan produk');
      return;
    }
    setOpen(false);
    toast.success(editing ? 'Produk diperbarui' : 'Produk ditambahkan');
  }

  async function removeProduct(id: string) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('store_token', store.token);
    if (error) {
      toast.error('Gagal menghapus produk');
      return;
    }
    setOpen(false);
    toast.success('Produk dihapus');
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk..."
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <PackagePlus className="mr-1 h-4 w-4" /> Tambah
        </Button>
      </div>

      {loading ? (
        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
            <Package className="h-8 w-8" />
            <p className="text-sm">Belum ada produk. Tambahkan produk pertama Anda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex gap-3 p-4">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="h-20 w-20 shrink-0 rounded-lg border object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border bg-muted">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{p.name}</p>
                      {p.category && (
                        <Badge variant="outline" className="mt-0.5">
                          {p.category}
                        </Badge>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-sm font-bold text-primary">{formatRupiah(p.price)}</span>
                    <Badge variant="secondary">Modal {formatRupiah(p.modal_price)}</Badge>
                    <Badge variant={p.stock <= 2 ? 'destructive' : 'secondary'}>Stok {p.stock}</Badge>
                    <Badge variant="outline">{p.sold_count}x terjual</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Produk' : 'Produk Baru'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label>Gambar Produk</Label>
              <div className="flex items-center gap-3">
                {form.image_url ? (
                  <img
                    src={form.image_url}
                    alt="Pratinjau"
                    className="h-20 w-20 rounded-lg border object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed bg-muted">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="p-image"
                    className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                  >
                    Pilih Gambar
                  </Label>
                  <input
                    id="p-image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickImage(e.target.files?.[0])}
                  />
                  {form.image_url && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 text-destructive hover:text-destructive"
                      onClick={() => setForm({ ...form, image_url: '' })}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">JPG/PNG, maksimal 2 MB.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Nama Produk</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Kopi Sachet"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-price">Harga Jual</Label>
                <Input
                  id="p-price"
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-modal">Harga Modal</Label>
                <Input
                  id="p-modal"
                  type="number"
                  min="0"
                  value={form.modal_price}
                  onChange={(e) => setForm({ ...form, modal_price: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-stock">Stok</Label>
                <Input
                  id="p-stock"
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-cat">Kategori</Label>
                <Input
                  id="p-cat"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Contoh: Minuman"
                />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
            {editing && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => removeProduct(editing.id)}
              >
                Hapus Produk
              </Button>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
