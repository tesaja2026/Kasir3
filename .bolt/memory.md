# Project memory

## Product intent & audience

- App kasir (Point of Sale / POS) dari repo GitHub `sinaunyervis/kasir2` yang ingin dikembangkan lebih lanjut oleh user.
- User berencana meng-clone source code beserta seluruh database-nya untuk dimodifikasi.
- Target: sistem kasir yang siap dikembangkan (fitur belum diketahui karena repo belum berhasil diakses).

## Brand personality & voice

- Komunikasi user dalam Bahasa Indonesia; balasan tetap dalam Bahasa Indonesia.
- Nada langsung, praktis, dan solusi-oriented.

## Visual design & UX direction

- Belum ada informasi UI/UX karena repo belum berhasil diakses.
- Placeholder: desian menyusul setelah struktur project terlihat.

## Decisions, constraints & rationale

- Lingkungan ini memblokir perintah `git`; cloning dilakukan via unduhan arsip ZIP dari GitHub API.
- Repo `sinaunyervis/kasir2` mengembalikan 404 (tidak ditemukan); kemungkinan private atau salah nama.
- Repo alternatif `sinaunyervis/Kasir1` ada tetapi kosong (hanya README satu baris), tanpa kode atau file database.
- Belum membuat tabel apa pun di Supabase sengaja — menunggu struktur asli project terlihat agar tidak salah skema.
- User diminta untuk: (a) mengubah `kasir2` menjadi public, atau (b) memastikan nama repo benar, atau (c) meng-upload kode lokal jika belum di-push.

## Open questions & assumptions

- Apakah repo `kasir2` memang ada dan hanya private? Atau salah ketik nama?
- Bahasa/teknologi project belum diketahui (Node.js? PHP? lain?) — menunggu repo berhasil diakses.
- Struktur database belum diketahui; asumsi: perlu dump SQL atau migration files dari repo.
- Apakah user ingin tetap menggunakan Supabase, atau mengikuti database original dari project?