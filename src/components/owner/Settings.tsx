import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Store } from '../../lib/types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { KeyRound, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings({ store }: { store: Store }) {
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [phone, setPhone] = useState(store.phone || '');

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!oldPass || newPass.length < 4) {
      toast.error('Password baru minimal 4 karakter');
      return;
    }
    if (newPass !== confirmPass) {
      toast.error('Konfirmasi password tidak sama');
      return;
    }
    setSavingPassword(true);
    const { data, error } = await supabase
      .from('stores')
      .select('password')
      .eq('token', store.token)
      .maybeSingle();
    if (error || !data) {
      setSavingPassword(false);
      toast.error('Gagal memverifikasi password lama');
      return;
    }
    if (data.password !== oldPass) {
      setSavingPassword(false);
      toast.error('Password lama salah');
      return;
    }
    const { error: updateError } = await supabase
      .from('stores')
      .update({ password: newPass })
      .eq('token', store.token);
    setSavingPassword(false);
    if (updateError) {
      toast.error('Gagal mengubah password');
      return;
    }
    setOldPass('');
    setNewPass('');
    setConfirmPass('');
    toast.success('Password berhasil diubah');
  }

  async function savePhone(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned && cleaned.replace(/[^0-9]/g, '').length < 8) {
      toast.error('Nomor telepon tidak valid');
      return;
    }
    setSavingPhone(true);
    const { error } = await supabase
      .from('stores')
      .update({ phone: cleaned || null })
      .eq('token', store.token);
    setSavingPhone(false);
    if (error) {
      toast.error('Gagal menyimpan nomor telepon');
      return;
    }
    setPhone(cleaned);
    toast.success('Nomor telepon disimpan');
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" /> Ubah Password Login
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-old">Password Lama</Label>
              <Input
                id="s-old"
                type="password"
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
                placeholder="password sekarang"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-new">Password Baru</Label>
              <Input
                id="s-new"
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="minimal 4 karakter"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-confirm">Ulangi Password Baru</Label>
              <Input
                id="s-confirm"
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="ulangi password baru"
              />
            </div>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4 text-primary" /> Nomor Telepon Toko
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePhone} className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-phone">Nomor Telepon / WhatsApp</Label>
              <Input
                id="s-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
              />
              <p className="text-xs text-muted-foreground">
                Nomor ini bisa dihubungi pelanggan dari aplikasi katalog toko Anda.
              </p>
            </div>
            <Button type="submit" disabled={savingPhone}>
              {savingPhone && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Nomor
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
