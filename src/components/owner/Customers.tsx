import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, formatTime, type Customer, type Store, type Transaction } from '../../lib/types';
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
import { UserPlus, Users, Loader2, ChevronRight, Phone, Copy, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { generateCode } from '../../lib/types';

export default function Customers({ store }: { store: Store }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [codeCreated, setCodeCreated] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    const [cRes, tRes] = await Promise.all([
      supabase.from('customers').select('*').eq('store_token', store.token).order('name'),
      supabase
        .from('transactions')
        .select('*')
        .eq('store_token', store.token)
        .order('created_at', { ascending: false }),
    ]);
    if (cRes.data) setCustomers(cRes.data);
    if (tRes.data) setTransactions(tRes.data);
    setLoading(false);
  }, [store.token]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`customers-${store.token}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers', filter: `store_token=eq.${store.token}` },
        () => load()
      )
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

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    let lastError: string | null = null;
    let created: Customer | null = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          store_token: store.token,
          name: name.trim(),
          phone: phone.trim() || null,
          login_code: generateCode(6),
        })
        .select()
        .single();
      if (!error && data) created = data;
      else lastError = error?.message ?? 'unknown';
    }
    setSaving(false);
    if (!created) {
      toast.error('Gagal menambah pelanggan');
      return;
    }
    setName('');
    setPhone('');
    setOpen(false);
    setCodeCreated(created);
    toast.success('Pelanggan ditambahkan');
  }

  async function regenerateCode(c: Customer) {
    const { data, error } = await supabase
      .from('customers')
      .update({ login_code: generateCode(6) })
      .eq('id', c.id)
      .eq('store_token', store.token)
      .select()
      .single();
    if (error || !data) {
      toast.error('Gagal membuat kode baru');
      return;
    }
    setDetail(data);
    toast.success('Kode login baru dibuat');
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success('Kode disalin: ' + code);
  }

  async function removeCustomer(id: string) {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('store_token', store.token);
    if (error) {
      toast.error('Gagal menghapus pelanggan');
      return;
    }
    toast.success('Pelanggan dihapus');
  }

  const statsFor = (c: Customer) => {
    const list = transactions.filter((t) => t.customer_id === c.id);
    return {
      count: list.length,
      total: list.reduce((s, t) => s + Number(t.total), 0),
      profit: list.reduce((s, t) => s + Number(t.profit), 0),
      list,
    };
  };

  return (
    <div className="flex flex-col gap-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="lg">
            <UserPlus className="mr-2 h-4 w-4" /> Tambah Pelanggan Baru
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pelanggan Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={addCustomer} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Nama</Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama pelanggan" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">No. HP</Label>
              <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
            <Users className="h-8 w-8" />
            <p className="text-sm">Belum ada pelanggan. Tambahkan pelanggan pertama Anda.</p>
          </CardContent>
        </Card>
      ) : (
        customers.map((c) => {
          const s = statsFor(c);
          return (
            <Card key={c.id} className="cursor-pointer transition hover:border-primary/40">
              <CardContent className="p-4" onClick={() => setDetail(c)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{c.name}</p>
                    {c.phone && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="font-mono font-bold text-primary">
                    <KeyRound className="mr-1 h-3 w-3" /> {c.login_code}
                  </Badge>
                  <Badge variant="secondary">{s.count} transaksi</Badge>
                  <Badge variant="secondary">Total {formatRupiah(s.total)}</Badge>
                  <Badge className="bg-success/15 text-success hover:bg-success/25">
                    Untung {formatRupiah(s.profit)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog
        open={!!codeCreated}
        onOpenChange={(o) => !o && setCodeCreated(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Kode Login Pelanggan</DialogTitle>
          </DialogHeader>
          {codeCreated && (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                Bagikan kode ini kepada <span className="font-semibold text-foreground">{codeCreated.name}</span>{' '}
                untuk masuk sebagai pelanggan Anda.
              </p>
              <div className="w-full rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 py-4 text-4xl font-extrabold tracking-[0.3em] text-primary">
                {codeCreated.login_code}
              </div>
              <Button className="w-full" onClick={() => copyCode(codeCreated.login_code)}>
                <Copy className="mr-2 h-4 w-4" /> Salin Kode
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Kode Login Pelanggan</p>
                  <p className="text-2xl font-extrabold tracking-widest text-primary">
                    {detail.login_code}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyCode(detail.login_code)}
                    aria-label="Salin kode"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => regenerateCode(detail)}
                    aria-label="Buat kode baru"
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {statsFor(detail).list.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
              ) : (
                statsFor(detail).list.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-semibold">{formatRupiah(Number(t.total))}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(t.created_at)} • {t.items.length} item
                      </p>
                    </div>
                    <Badge className="bg-success/15 text-success hover:bg-success/25">
                      +{formatRupiah(Number(t.profit))}
                    </Badge>
                  </div>
                ))
              )}
              <Button
                variant="destructive"
                className="mt-2"
                onClick={() => {
                  if (detail) removeCustomer(detail.id);
                  setDetail(null);
                }}
              >
                Hapus Pelanggan
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
