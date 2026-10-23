# Aplikasi IDP Guru — Catatan Perbaikan & Regulasi

Kode Apps Script ada di `idp/apps-script/` (`Kode.gs` dan `Index.html`).

## 1. Aplikasi bersama banyak sekolah — cara memasang

Satu Web App (milik SD N Bugangin) dipakai banyak SD. Sekolah lain **tidak membuka Google Sheets**:
mereka mendaftar sendiri di aplikasi (NPSN), lalu admin sekolah menempel API key Gemini sekolahnya.

Pemasangan oleh pemilik (sekali), di spreadsheet IDP SD N Bugangin yang asli:
1. **Ekstensi → Apps Script**: ganti isi `Kode.gs` dan `Index.html` dengan berkas di folder ini.
   File `Pengaturan.html` (bila pernah dibuat) boleh dihapus. Simpan.
2. Muat ulang spreadsheet → menu **IDP Guru → 1. Setup awal**.
3. Menu **IDP Guru → 2. Pindahkan data lama (satu sekolah) ke aplikasi bersama** → isi NPSN SD N Bugangin
   Guru, isian IDP, file, password, dan API key lama ikut dipindahkan; guru dan kepala sekolah
   tetap memakai password yang sama (juga untuk halaman Admin Sekolah).
4. **Terapkan → Kelola deployment → ikon pensil → Versi: Versi baru → Terapkan** (URL tetap sama).
5. Tempel URL aplikasi (`…/exec`) ke `LINK_APLIKASI` di `idp/panduan.html`, lalu bagikan
   **sdnbugangin.github.io/idp/panduan.html** ke SD lain.

Sheet yang dipakai: `_PENGATURAN` (global: TEMPLATE_URL, folder induk, isian awal atasan KS),
`_SEKOLAH` (satu baris per sekolah; satu password sekolah untuk guru & admin, tersimpan sebagai hash), `_GURU` dan `_DATA` (kolom NPSN).
API key tiap sekolah disimpan di Script Properties `KUNCI_<NPSN>`, tidak tampil di sheet.
Untuk menonaktifkan sekolah (mis. pendaftaran palsu), isi kolom **AKTIF** di `_SEKOLAH` dengan `TIDAK`.
Bila sekolah lupa password: menu **IDP Guru → 5. Atur ulang password sekolah**
(isi NPSN dan password baru), lalu kirim password baru ke kepala sekolah lewat pesan pribadi.

Uji otomatis: `node --test idp/tes/*.test.js` (tiruan Apps Script di memori).

## 2. Apa yang diperbaiki pada fitur AI

| Masalah lama | Perbaikan |
|---|---|
| Satu key habis → harus ganti key manual | Bisa banyak key; key yang habis kuota otomatis diistirahatkan sampai kuotanya pulih (reset harian ± pukul 14.00/15.00 WIB), key berikutnya langsung dipakai |
| Saat error 429, model yang sama dicoba ulang 3x → kuota makin cepat habis | 429 tidak diulang; langsung pindah ke model/key lain. Maksimal 6 permintaan per klik |
| Model "preview" bisa terpilih (kuota gratisnya sangat kecil) | Flash-Lite diutamakan (kuota lebih besar, lebih cepat), Flash biasa sebagai cadangan, preview paling belakang, "pro" tidak dipakai |
| Gemini 2.5 "berpikir" dulu → lambat, boros token | Mode berpikir dimatikan (2.5) / dibuat rendah (3.x) |
| Setiap kompetensi = 1 permintaan (±14 per guru) | Tombol **"Isi semua catatan yang masih kosong"** = 1 permintaan untuk semuanya |
| Klik ulang = permintaan baru | Jawaban disimpan 6 jam; klik ulang dengan isian sama tidak memakai kuota |
| Kadang JSON dari AI rusak | Memakai `responseSchema` agar format jawaban selalu benar |
| Daftar model ditanyakan berulang | Disimpan 3 hari, diperbarui otomatis bila model hilang (404) |

**Penting soal kuota:** kuota gratis Gemini dihitung **per project Google Cloud**, bukan per key.
Dua key dari project yang sama berbagi kuota. Jadi buat tiap key dari email/project berbeda.

Perbaikan lain: jalur rekomendasi AI tidak lagi bisa "tidak cocok" dengan jenisnya,
pengaturan dibaca sekali per permintaan (lebih cepat), password dikunci 10 menit setelah 5x salah,
dan NIP/NIK/nomor HP/email yang tertulis di kolom kondisi dihapus sebelum dikirim ke AI.

## 3. Keamanan & data pribadi (UU 27/2022 tentang Pelindungan Data Pribadi)

1. **Spreadsheet IDP saat ini dibagikan "Siapa saja yang memiliki link — Editor".**
   Siapa pun yang memegang link dapat melihat/mengubah data semua guru (nama, NIP, penilaian),
   melihat password dan API key, **bahkan mengubah kode Apps Script** yang berjalan atas nama akun Bapak.
   Bisa jadi ini juga penyebab kuota cepat habis (key dipakai orang lain).
   Segera: **Bagikan → Akses umum → Dibatasi**. Guru tidak memerlukan akses ke spreadsheet ini;
   mereka cukup memakai link Web App.
2. Setelah itu **buat API key baru** dan hapus key lama di aistudio.google.com (anggap sudah bocor),
   lalu **ganti PASSWORD** di `_PENGATURAN`.
3. File IDP per guru dibagikan "siapa saja yang memiliki link — Lihat" agar tombol unduh berfungsi.
   Link itu berisi nama, NIP, dan hasil penilaian — sampaikan ke guru agar tidak menyebarkannya.
4. Tingkat gratis Gemini API dapat memakai isi permintaan untuk peningkatan layanan Google.
   Karena itu aplikasi tidak mengirim nama/NIP, dan guru diminta tidak menulis data pribadi siswa
   di kolom kondisi.
5. Satu password untuk semua guru berarti guru A bisa membuka IDP guru B. Untuk tahap berikutnya,
   pertimbangkan PIN per guru.

## 4. Kesesuaian dengan regulasi (materi sosialisasi BKPSDM Kendal)

| Regulasi | Isi pokok | Di aplikasi |
|---|---|---|
| UU 20/2023 tentang ASN, Pasal 49 | ASN wajib mengembangkan kompetensi melalui pembelajaran terintegrasi dengan pekerjaan | Prompt AI kini menekankan kegiatan di tempat kerja (komunitas belajar, IHT, coaching) |
| PP 11/2017 jo. PP 17/2020 | Pengembangan kompetensi minimal **20 JP per tahun** | Belum dihitung otomatis — lihat saran 5.1 |
| Peraturan LAN 10/2018 | Jenis klasikal & nonklasikal; pola **70-20-10** | AI kini mengutamakan Non Klasikal; Klasikal untuk GAP 3–4 |
| PermenPANRB 38/2017 | Standar kompetensi manajerial (8) & sosial kultural | Sesuai Formulir 1 |
| PermenPANRB 6/2022 | Predikat kinerja: Sangat Baik … Sangat Kurang | Sesuai; GAP kinerja = di bawah "Baik" |
| PermenPANRB 21/2024 (JF Guru) | Jenjang Ahli Pertama–Utama | Sesuai |
| UU 14/2005 Pasal 9 | Kualifikasi guru S1/D4 | GAP kualifikasi bila di bawah S1/D4 |
| Perbup Kendal 59/2021 | Izin belajar & tugas belajar | Muncul petunjuk saat ada GAP kualifikasi |

Catatan atas template resmi:

- Pada daftar pilihan jalur di template, **"sosialisasi"** ada di Non Klasikal, padahal di
  Peraturan LAN 10/2018 sosialisasi termasuk **Klasikal**. Aplikasi tetap mengikuti template dari
  Korwil agar tidak ditolak; sebaiknya ditanyakan ke Korwil/BKPSDM.
- Di contoh file Excel, jalur ditulis "Coaching/Mentoring" (tidak ada di daftar pilihan).
  Aplikasi memakai pilihan resmi: `coaching` atau `mentoring`.
- Materi coaching menyebut IDP sebagai **hasil dialog atasan–bawahan**. Skor GAP sebaiknya
  ditetapkan bersama kepala sekolah; AI hanya untuk draf kalimat. Teks di aplikasi sudah
  diperbarui untuk mengingatkan hal ini.

## 5. Saran pengembangan berikutnya

1. Tambahkan kolom perkiraan **JP** per rencana dan peringatan bila total per tahun < 20 JP.
2. Rekap untuk kepala sekolah: jumlah guru per GAP & per jalur, sebagai bahan usulan
   kebutuhan bangkom ke Korwil / Disdikbud.
3. PIN per guru menggantikan satu password bersama.
4. Unduhan PDF/Excel dibuat langsung oleh skrip (tanpa membagikan file ke publik).

## 6. Catatan aplikasi bersama

- **Pendaftaran bebas dengan NPSN** (sesuai pilihan). Pengamannya: NPSN harus 8 digit dan unik,
  maksimal 20 sekolah baru per jam (`BATAS_DAFTAR_PER_JAM`), dan pemilik bisa menonaktifkan sekolah.
- **Semua data ada di Google Drive akun pemilik.** Pemilik menjadi pengelola data pribadi guru dari
  sekolah lain (UU 27/2022). Sebaiknya diketahui Korwil, dan kelak bisa dipindah ke akun khusus.
- **Satu password per sekolah** (sesuai pilihan): dipakai guru dan kepala sekolah, termasuk halaman Admin.
  Konsekuensinya setiap guru di sekolah itu bisa mengubah data sekolah, API key, dan menghapus guru.
- **AI per sekolah:** guru hanya memakai API key sekolahnya sendiri; sekolah tanpa key memakai
  kalimat bawaan tanpa memanggil Google.
- **Simpan bersamaan:** kunci (lock) hanya dipakai saat menulis sheet; pembuatan file (±20 detik)
  di luar kunci, sehingga guru dari banyak sekolah tidak saling menunggu.
- **Batas akun Gmail:** sekitar 20.000 panggilan internet (UrlFetch) per hari untuk semua sekolah.
  Cukup untuk satu kabupaten; bila sangat ramai, AI otomatis jatuh ke kalimat bawaan.
- Spreadsheet master salinan (cara lama) tidak dipakai lagi dan boleh dihapus.
