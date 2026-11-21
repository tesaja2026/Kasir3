import { formatRupiah, type Store, type Transaction } from './types';
import { toast } from 'sonner';

export function buildReceiptText(store: Store, t: Transaction): string {
  const date = new Date(t.created_at).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const lines = t.items.map(
    (i) => `${i.name} x${i.qty} — ${formatRupiah(i.price * i.qty)}`
  );
  return [
    `*${store.name}*`,
    `Nota Pembelian`,
    `-----------------------------`,
    `No. Nota: ${t.id.slice(0, 8).toUpperCase()}`,
    `Tanggal: ${date}`,
    `Pelanggan: ${t.customer_name || '-'}`,
    `-----------------------------`,
    ...lines,
    `-----------------------------`,
    `Total: ${formatRupiah(Number(t.total))}`,
    ``,
    `Terima kasih telah berbelanja!`,
  ].join('\n');
}

export function whatsappReceiptUrl(store: Store, t: Transaction, phone?: string | null): string {
  const text = encodeURIComponent(buildReceiptText(store, t));
  const digits = (phone || '').replace(/\D/g, '');
  const intl = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  return intl ? `https://wa.me/${intl}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function printReceipt(store: Store, t: Transaction) {
  const date = new Date(t.created_at).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const rows = t.items
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${formatRupiah(
          i.price * i.qty
        )}</td></tr>`
    )
    .join('');
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Nota ${t.id.slice(0, 8).toUpperCase()}</title>
<style>
  body { font-family: 'Courier New', monospace; max-width: 320px; margin: 0 auto; padding: 16px; font-size: 13px; }
  h1 { text-align: center; font-size: 18px; margin: 0 0 2px; }
  p.sub { text-align: center; margin: 0 0 10px; }
  hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 2px 0; vertical-align: top; font-size: 13px; }
  th { text-align: left; }
  .total { font-weight: bold; font-size: 15px; }
  .center { text-align: center; }
</style>
</head>
<body>
  <h1>${store.name}</h1>
  <p class="sub">Nota Pembelian</p>
  <hr />
  <p>No. Nota: ${t.id.slice(0, 8).toUpperCase()}<br />
  Tanggal: ${date}<br />
  Pelanggan: ${t.customer_name || '-'}</p>
  <hr />
  <table>
    <tr><th>Produk</th><th style="text-align:center">Qty</th><th style="text-align:right">Harga</th></tr>
    ${rows}
  </table>
  <hr />
  <table>
    <tr class="total"><td>TOTAL</td><td style="text-align:right">${formatRupiah(Number(t.total))}</td></tr>
  </table>
  <hr />
  <p class="center">Terima kasih telah berbelanja!</p>
</body>
</html>`;
  const win = window.open('', '_blank', 'width=380,height=560');
  if (!win) {
    toast.error('Pop-up diblokir. Izinkan pop-up untuk mencetak nota.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
