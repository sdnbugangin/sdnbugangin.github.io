# Aplikasi IDP Guru — Catatan Perbaikan & Regulasi

Kode Apps Script ada di `idp/apps-script/` (`Kode.gs` dan `Index.html`).

## 1. Cara memasang versi baru

1. Buka spreadsheet IDP → **Ekstensi → Apps Script**.
2. Ganti seluruh isi `Kode.gs` dan `Index.html` dengan berkas di folder ini, lalu simpan.
3. Di sheet `_PENGATURAN`, baris **GEMINI_API_KEY**: isi beberapa key sekaligus,
   dipisah koma. Contoh: `AIza...aaa, AIza...bbb, AIza...ccc`
4. Menu **IDP Guru → 3. Cek status API key AI** untuk menguji semua key.
5. **Deploy → Kelola deployment → ikon pensil → Versi: Versi baru → Deploy** (URL tetap sama).

> Nilai bawaan NIP dan password di kode sengaja dikosongkan karena repositori ini publik.
> Nilai yang sudah ada di sheet `_PENGATURAN` tetap dipakai, tidak berubah.

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

## 6. Membagikan ke SD lain

Setiap SD memakai **salinan sendiri**: data, Drive, password, dan API key Gemini milik sekolah itu.

**Menyiapkan master (sekali, oleh SD N Bugangin):**
1. Spreadsheet IDP asli → **File → Buat salinan**. Biarkan nama "Salinan dari …".
2. Di salinan: tempel kode terbaru (`Kode.gs`, `Index.html`, dan file baru `Pengaturan.html`), lalu simpan.
3. Muat ulang salinan → menu **IDP Guru → Siapkan salinan bersih untuk dibagikan ke SD lain** → ketik `KOSONGKAN`.
   Sheet FORM 1/FORM 2 dari template ikut dimasukkan (tersembunyi). Data guru, isian IDP, password,
   API key, dan data kepala sekolah dihapus. Fungsi ini menolak berjalan bila nama file tidak mengandung
   "Salinan"/"Copy", agar spreadsheet asli tidak ikut terhapus.
4. Bagikan master dengan akses **"Siapa saja yang memiliki link: Pelihat"** (bukan Editor).
5. Tempel link master ke `LINK_MASTER` di `idp/panduan.html`, lalu bagikan link panduan:
   **sdnbugangin.github.io/idp/panduan.html**

**Di sekolah lain:** File → Buat salinan → menu **IDP Guru → 0. Pengaturan Sekolah & API Gemini**
(isi data sekolah, password, API key — ada petunjuk langkah demi langkah) → Deploy sebagai Aplikasi web.

Yang disesuaikan agar bisa dipakai umum:
- Nama sekolah, kepala sekolah, wilayah, dan kabupaten tidak lagi tertulis di kode; diambil dari Pengaturan.
- Template IDP dibuat otomatis dari sheet FORM 1/FORM 2 yang terbawa di master (tidak perlu TEMPLATE_URL).
- API key disimpan di Script Properties (tersembunyi), diuji ke Google sebelum disimpan.
- Fungsi admin (pengaturan, setup, buat ulang, cek AI) hanya bisa dijalankan pemilik spreadsheet,
  tidak bisa dipanggil pengunjung Web App.
- Aplikasi menampilkan "belum disiapkan oleh admin" bila data sekolah/password belum diisi.
