import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, formatDate, type Store, type Transaction } from '../../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { FileSpreadsheet, MoonStar, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface RecapRow {
  name: string;
  qty: number;
  revenue: number;
  profit: number;
}

export default function CloseDay({ store }: { store: Store }) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recap, setRecap] = useState<RecapRow[] | null>(null);
  const [recapMeta, setRecapMeta] = useState<{ date: string; total: number; profit: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    const [tRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('store_token', store.token)
        .gte('created_at', startOfToday())
        .order('created_at', { ascending: false }),
    ]);
    if (tRes.data) setTransactions(tRes.data);
    setLoading(false);
  }, [store.token]);

  useEffect(() => {
    load();
  }, [load]);

  const todayTotal = transactions.reduce((s, t) => s + Number(t.total), 0);
  const todayProfit = transactions.reduce((s, t) => s + Number(t.profit), 0);

  function buildRecap(): RecapRow[] {
    const map = new Map<string, RecapRow>();
    for (const t of transactions) {
      for (const item of t.items || []) {
        const row = map.get(item.id) || { name: item.name, qty: 0, revenue: 0, profit: 0 };
        row.qty += item.qty;
        row.revenue += item.price * item.qty;
        row.profit += (item.price - item.modal_price) * item.qty;
        map.set(item.id, row);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.profit - a.profit);
  }

  async function endDay() {
    if (transactions.length === 0) {
      toast.info('Belum ada transaksi hari ini');
      return;
    }
    const rows = buildRecap();
    setRecap(rows);
    setRecapMeta({
      date: formatDate(new Date().toISOString()),
      total: todayTotal,
      profit: todayProfit,
    });
    const archive = transactions.map((t) => ({
      id: t.id,
      store_token: t.store_token,
      customer_id: t.customer_id,
      customer_name: t.customer_name,
      items: t.items,
      total: t.total,
      profit: t.profit,
      source: t.source,
      status: t.status,
      created_at: t.created_at,
    }));
    const { error: archiveError } = await supabase
      .from('closed_transactions')
      .upsert(archive, { onConflict: 'id' });
    if (archiveError) {
      setConfirmOpen(false);
      toast.error('Gagal mengarsipkan transaksi. Rekap bulanan aman, coba lagi.');
      return;
    }
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('store_token', store.token)
      .gte('created_at', startOfToday());
    setConfirmOpen(false);
    if (error) {
      toast.error('Rekap dibuat, tetapi gagal membersihkan transaksi');
      return;
    }
    setTransactions([]);
    toast.success('Aktivitas harian diakhiri. Transaksi hari ini diarsipkan ke rekap bulanan.');
  }

  function exportExcel() {
    if (!recap || !recapMeta) return;
    const wsData = [
      [`Rekap Harian - ${store.name}`],
      [`Tanggal: ${recapMeta.date}`],
      [],
      ['Produk', 'Qty Terjual', 'Pendapatan', 'Keuntungan Bersih'],
      ...recap.map((r) => [r.name, r.qty, r.revenue, r.profit]),
      [],
      ['TOTAL', '', recapMeta.total, recapMeta.profit],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Harian');
    XLSX.writeFile(wb, `rekap-${store.token}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MoonStar className="h-5 w-5 text-primary" /> Fullday — Tutup Toko
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-sm">
                  {transactions.length} transaksi
                </Badge>
                <Badge variant="secondary" className="text-sm">
                  Omzet {formatRupiah(todayTotal)}
                </Badge>
                <Badge className="bg-success/15 text-success hover:bg-success/25 text-sm">
                  Untung {formatRupiah(todayProfit)}
                </Badge>
              </div>
              <Button size="lg" onClick={() => setConfirmOpen(true)}>
                Akhiri Aktivitas Harian
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {recap && recapMeta && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-success" /> Rekap {recapMeta.date}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recap.map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.qty} terjual</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatRupiah(r.revenue)}</p>
                  <p className="text-xs text-success">+{formatRupiah(r.profit)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-bold">Total Keuntungan Hari Ini</span>
              <span className="text-lg font-extrabold text-primary">
                {formatRupiah(recapMeta.profit)}
              </span>
            </div>
            <Button size="lg" onClick={exportExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Akhiri aktivitas harian?</DialogTitle>
            <DialogDescription>
              Rekap penjualan hari ini akan dibuat, lalu SEMUA transaksi hari ini dikosongkan.
              Export Excel dulu jika ingin menyimpan bukti rekap.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button className="flex-1" onClick={endDay}>
              <Loader2 className="mr-2 hidden h-4 w-4 animate-spin" />
              Ya, Buat Rekap
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
