import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TOKEN_KEY, formatRupiah, formatTime, type Store, type Transaction, type Product } from '../lib/types';
import { Logo } from '../lib/logo';
import Dashboard from '../components/owner/Dashboard';
import Cashier from '../components/owner/Cashier';
import Customers from '../components/owner/Customers';
import Products from '../components/owner/Products';
import CloseDay from '../components/owner/CloseDay';
import MonthlyReport from '../components/owner/MonthlyReport';
import Orders from '../components/owner/Orders';
import PendingSummary from '../components/owner/PendingSummary';
import Settings from '../components/owner/Settings';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Store as StoreIcon,
  LogOut,
  MoonStar,
  ClipboardList,
  ListChecks,
  BarChart3,
  Settings as SettingsIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const TABS = [
  { id: 'kasir', label: 'Kasir', icon: ShoppingCart },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pesanan', label: 'Pesanan', icon: ClipboardList },
  { id: 'rekap', label: 'Rekap', icon: ListChecks },
  { id: 'pelanggan', label: 'Pelanggan', icon: Users },
  { id: 'produk', label: 'Produk', icon: Package },
] as const;

type TabId = (typeof TABS)[number]['id'] | 'tutup' | 'laporan' | 'pengaturan';

export default function OwnerApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [store, setStore] = useState<Store | null>(null);
  const [tab, setTab] = useState<TabId>('kasir');
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!token) {
      navigate('/toko', { replace: true });
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (error || !data) {
        localStorage.removeItem(TOKEN_KEY);
        navigate('/toko', { replace: true });
        return;
      }
      setStore(data);
      setEditName(data.name);
    })();
  }, [token, navigate]);

  useEffect(() => {
    if (!token) return;
    const loadPending = async () => {
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('store_token', token)
        .eq('status', 'pending');
      setPendingCount(count ?? 0);
    };
    loadPending();
    const channel = supabase
      .channel(`owner-orders-${token}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `store_token=eq.${token}` },
        (payload) => {
          loadPending();
          if (
            payload.eventType === 'INSERT' &&
            (payload.new as Transaction).source === 'customer'
          ) {
            const t = payload.new as Transaction;
            toast('Pesanan baru masuk!', {
              description: `${t.customer_name || 'Pelanggan'} • ${formatRupiah(Number(t.total))}`,
              duration: 8000,
              action: {
                label: 'Lihat',
                onClick: () => goTabRef.current?.('pesanan'),
              },
            });
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('didKasir — Pesanan Baru', {
                body: `${t.customer_name || 'Pelanggan'} • ${formatRupiah(Number(t.total))}`,
              });
            }
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [token]);

  if (!token || !store) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const goTabRef = { current: null as ((id: TabId) => void) | null };
  goTabRef.current = goTab;

  function goTab(id: TabId) {
    setTab(id);
    navigate(`/dashboard#${id}`);
  }

  async function saveName() {
    if (!editName.trim() || !token) return;
    const { error } = await supabase
      .from('stores')
      .update({ name: editName.trim() })
      .eq('token', token);
    if (error) {
      toast.error('Gagal menyimpan nama toko');
      return;
    }
    setEditOpen(false);
    toast.success('Nama toko diperbarui');
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    navigate('/toko', { replace: true });
  }

  const activeTab: TabId = (location.hash.replace('#', '') || 'kasir') as TabId;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col pb-24">
      <header className="sticky top-0 z-30 border-b bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={40} />
            <div className="min-w-0">
              <p className="truncate font-bold leading-tight">{store.name}</p>
              <p className="text-xs text-muted-foreground">
                Kode Toko: <span className="font-semibold text-primary">{store.token}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit nama toko">
                  <StoreIcon className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Nama Toko</DialogTitle>
                </DialogHeader>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                <Button onClick={saveName}>Simpan</Button>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Keluar">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4">
        {activeTab === 'kasir' && <Cashier store={store} />}
        {activeTab === 'dashboard' && <Dashboard store={store} />}
        {activeTab === 'pesanan' && <Orders store={store} />}
        {activeTab === 'rekap' && <PendingSummary store={store} />}
        {activeTab === 'pelanggan' && <Customers store={store} />}
        {activeTab === 'produk' && <Products store={store} />}
        {activeTab === 'laporan' && <MonthlyReport store={store} />}
        {activeTab === 'tutup' && <CloseDay store={store} />}
        {activeTab === 'pengaturan' && <Settings store={store} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-9">
          {TABS.slice(0, 3).map((t) => (
            <NavButton
              key={t.id}
              tab={t}
              active={activeTab === t.id}
              badge={t.id === 'pesanan' ? pendingCount : 0}
              onClick={() => goTab(t.id)}
            />
          ))}
          <button
            onClick={() => goTab('tutup')}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition',
              activeTab === 'tutup' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MoonStar className="h-5 w-5" />
            Fullday
          </button>
          <button
            onClick={() => goTab('laporan')}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition',
              activeTab === 'laporan' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <BarChart3 className="h-5 w-5" />
            Laporan
          </button>
          <button
            onClick={() => goTab('pengaturan')}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition',
              activeTab === 'pengaturan' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <SettingsIcon className="h-5 w-5" />
            Pengaturan
          </button>
          {TABS.slice(3).map((t) => (
            <NavButton key={t.id} tab={t} active={activeTab === t.id} badge={0} onClick={() => goTab(t.id)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function NavButton({
  tab,
  active,
  badge,
  onClick,
}: {
  tab: { id: string; label: string; icon: React.ComponentType<{ className?: string }> };
  active: boolean;
  badge: number;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="h-5 w-5" />
      {tab.label}
      {badge > 0 && (
        <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
