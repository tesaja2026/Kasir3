export interface Store {
  id: string;
  name: string;
  token: string;
  owner_code: string;
  username: string;
  password: string;
  phone: string | null;
  monthly_report_reset_at: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  store_token: string;
  name: string;
  price: number;
  modal_price: number;
  stock: number;
  category: string | null;
  image_url: string | null;
  sold_count: number;
  created_at: string;
}

export interface Customer {
  id: string;
  store_token: string;
  name: string;
  phone: string | null;
  login_code: string;
  total_profit_contributed: number;
  created_at: string;
}

export interface TransactionItem {
  id: string;
  name: string;
  price: number;
  modal_price: number;
  qty: number;
}

export interface Transaction {
  id: string;
  store_token: string;
  customer_id: string | null;
  customer_name: string | null;
  items: TransactionItem[];
  total: number;
  profit: number;
  source: 'owner' | 'customer';
  status: 'pending' | 'confirmed' | 'done' | 'rejected';
  created_at: string;
}

export interface ClosedTransaction extends Omit<Transaction, 'id'> {
  id: string;
  archived_at: string;
}

export const TOKEN_KEY = 'didkasir_owner_token';
export const CUSTOMER_TOKEN_KEY = 'didkasir_customer_token';
export const CUSTOMER_CODE_KEY = 'didkasir_customer_code';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCode(length = 6): string {
  let out = '';
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += CHARS[arr[i] % CHARS.length];
  return out;
}

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function restockScore(p: Product): number {
  const profitPerItem = Math.max(p.price - p.modal_price, 0);
  const stockFactor = 1 / Math.max(p.stock, 1);
  return profitPerItem * 0.6 + stockFactor * 0.4;
}

export function restockReason(p: Product): string {
  const profitPerItem = p.price - p.modal_price;
  if (p.stock <= 0) return 'Stok habis total, wajib restok sekarang';
  if (profitPerItem > 0 && p.stock <= 5)
    return `Keuntungan tinggi tapi stok tinggal ${p.stock}`;
  if (p.stock <= 2) return `Stok hampir habis (sisa ${p.stock})`;
  return `Sering terjual (${p.sold_count}x), pastikan stok aman`;
}
