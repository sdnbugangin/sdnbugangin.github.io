# Rancangan Aplikasi Rapor SD (Kurikulum Merdeka)

Aplikasi pengolahan nilai dan rapor untuk kelas 1–6, dipakai banyak sekolah.
Setiap sekolah mendaftar sendiri dan otomatis mendapat spreadsheet miliknya.
Aplikasi ini pengganti `RAPOR ... KELAS 5 ... .xlsm`: satu aplikasi untuk semua kelas, bukan satu file per kelas.

## 1. Keputusan yang sudah disepakati

| Hal | Keputusan |
|---|---|
| Login | Akun Google (termasuk belajar.id) |
| Bobot nilai rapor | Sumatif lingkup materi 50%, sumatif akhir semester 50%. Bisa diubah per sekolah. |
| Format rapor | Mengikuti RAPOR CETAK lama. **Semester 1 tanpa keterangan naik/lulus.** |
| Rombel | Satu kelas bisa punya beberapa rombel (5A, 5B, …) |
| Kelas 1–6 | Satu aplikasi, satu spreadsheet per sekolah, semua kelas di dalamnya |

## 2. Gambaran sistem

```
Guru / operator (browser, login akun Google)
        │
        ▼
Aplikasi web Apps Script (HtmlService) ──── Spreadsheet Pusat: daftar sekolah terdaftar
        │
        ▼
Spreadsheet Sekolah (satu per sekolah, dibuat otomatis saat daftar)
```

Tampilan aplikasi disajikan oleh Apps Script, bukan halaman GitHub Pages.
Alasannya, permintaan dari GitHub Pages ke Apps Script tidak bisa membawa login Google pengguna.
Situs `sdnbugangin.github.io/rapor/` cukup berisi halaman perkenalan dan tombol menuju aplikasi.

### Yang perlu diuji paling awal: izin akun belajar.id

Admin Google Workspace belajar.id bisa memblokir aplikasi Apps Script yang belum diverifikasi Google.
Sebelum membangun lebih jauh, kita uji aplikasi kecil dengan beberapa akun belajar.id.

- **Jika diizinkan:** aplikasi berjalan sebagai pengguna. Spreadsheet sekolah dibuat di Drive operator sekolah, sehingga data milik sekolah sendiri. Ini yang paling baik untuk perlindungan data pribadi (UU PDP).
- **Jika diblokir:** aplikasi berjalan sebagai akun pengelola. Spreadsheet sekolah disimpan di Drive akun pengelola dan dibagikan ke operator sekolah. Kita perlu kebijakan privasi tertulis, dan kuota Apps Script akun pengelola dipakai bersama semua sekolah.

## 3. Isi spreadsheet sekolah

Data disimpan dalam bentuk tabel panjang, satu baris per data, bukan satu sheet per mapel.
Dengan cara ini tidak ada batas 15 TP atau 60 siswa, dan tidak ada 21 sheet berisi rumus kembar.

| Sheet | Isi (kolom utama) |
|---|---|
| Profil Sekolah | nama, NPSN, alamat, kepala sekolah, NIP, tempat & tanggal rapor |
| Pengaturan | tahun ajaran & semester aktif, bobot, KKTP, mode deskripsi, seni yang ditawarkan |
| Pengguna | email, nama, NIP, peran (operator / kepala sekolah / wali kelas / guru mapel), rombel, mapel |
| Rombel | id, tahun ajaran, kelas (1–6), nama (5A), wali kelas |
| Siswa | id, NIS, NISN, nama, panggilan, JK, agama, tempat & tanggal lahir, orang tua, status (aktif / mutasi / lulus) |
| Anggota Rombel | tahun ajaran, rombel, siswa, seni pilihan |
| Mapel Aktif | tahun ajaran, kelas, kode mapel, urutan, nama di rapor |
| Tujuan Pembelajaran | tahun ajaran, semester, kelas, mapel (dan agama/seni bila perlu), kode TP, lingkup materi |
| Nilai | tahun ajaran, semester, siswa, mapel, jenis (TP / akhir), kode, nilai, diubah oleh, diubah pada |
| Kokurikuler | dimensi & subdimensi semester ini; capaian per siswa (Mahir / Cakap / Berkembang) |
| Master Narasi | subdimensi, level, narasi |
| Ekstrakurikuler | siswa, kegiatan, predikat, keterangan |
| Presensi & Catatan | siswa, sakit, izin, alpa, catatan wali kelas, tanggapan orang tua |
| Kenaikan | siswa, keputusan (naik / tinggal); hanya dipakai di semester 2 |
| Log | waktu, pengguna, aksi, rincian |

Struktur mapel per kelas (bawaan, bisa diubah sekolah) ada di `apps-script/Referensi.gs`:
IPAS mulai kelas 3; Bahasa Inggris aktif bawaan kelas 3–6; Koding & KA serta Mulok diaktifkan sekolah bila ada.
Mapel agama dan seni dinilai sesuai agama dan seni pilihan masing-masing siswa, tetapi tampil sebagai satu baris di rapor.

## 4. Peran pengguna

| Peran | Boleh |
|---|---|
| Operator | Semua: profil, pengguna, rombel, siswa, pengaturan, kenaikan kelas tahunan |
| Kepala sekolah | Melihat semua kelas, mengunci rapor, mencetak |
| Wali kelas | Siswa rombelnya: nilai semua mapel, kokurikuler, ekstrakurikuler, presensi, catatan, cetak rapor |
| Guru mapel | Nilai mapelnya saja (misalnya guru PAI, PJOK) di rombel yang ditugaskan |

## 5. Pencegahan error (pelajaran dari rapor Excel lama)

| Masalah di file lama | Penyebab | Penanganan di aplikasi baru |
|---|---|---|
| ±2.400 `#N/A` | Rumus merujuk file lain di `C:\Users\Lenovo\...` | Tidak ada rumus lintas file; semua data dalam satu spreadsheet sekolah |
| 118 `#VALUE!` di REKAP SEMUA | `LEFT(teks, LEN-2)` pada teks kosong | Deskripsi disusun oleh kode; siswa tanpa nilai menghasilkan teks kosong dan peringatan |
| 57 `#VALUE!` di PENILAIAN | Narasi kokurikuler gagal jika dimensi belum diisi | `deskripsiKokurikuler_` menangani 0, 1, atau banyak dimensi |
| Bobot di sheet Mapel tidak berpengaruh | Bobot tidak dipakai rumus mana pun | Bobot dipakai langsung dan diperiksa (wajib berjumlah 100%) |
| Nilai 0 dianggap kosong | `AVERAGEIF(...,">0")` | 0 tetap dihitung sebagai nilai; kosong dibedakan |
| Kalimat "semester ke-1 dan ke-2" tidak pernah muncul | RAPOR CETAK J66 merujuk J56 yang kosong | Keterangan kenaikan dari `keteranganKenaikan_`; semester 1 tidak ditampilkan |
| Satu perbaikan harus diulang di 21 sheet | Rumus disalin per mapel | Satu fungsi untuk semua mapel dan semua kelas |
| Maksimal 15 TP, jumlah siswa terbatas | Kolom dan baris tetap | Data tabel panjang tanpa batas kolom |
| Tidak jalan di Excel lama atau Google Sheets | LAMBDA, ANCHORARRAY, VBA | Tidak dipakai |
| Ejaan agama berbeda (Budha/Buddha) | Nama sheet harus sama persis | Ejaan dinormalisasi oleh `normalisasiAgama_` |

Aturan umum:

1. **Isian diperiksa sebelum disimpan.** Nilai harus angka 0–100 (koma desimal diterima). NISN 10 digit dan tidak boleh dobel. JK harus L/P. Agama dan seni harus dari daftar.
2. **Tidak pernah tampil kode error.** Fungsi hitung selalu mengembalikan hasil berbentuk sama, ditambah daftar `peringatan` dan `salah` dalam bahasa guru.
3. **Rapor hanya bisa dicetak jika lengkap.** Ada halaman "Cek Kelengkapan" per rombel yang menampilkan semua peringatan sebelum cetak.
4. **Penyimpanan aman saat dipakai bersamaan.** `LockService` dipakai saat menyimpan, dan setiap perubahan nilai dicatat di Log.
5. **Diuji otomatis.** `rapor/tes/` berisi uji untuk setiap kasus di tabel atas. Jalankan: `node --test rapor/tes/*.test.js`.

## 6. Tahapan

| Tahap | Isi | Status |
|---|---|---|
| 1 | Mesin hitung + data referensi + uji otomatis | ✅ selesai (`apps-script/Hitung.gs`, `Referensi.gs`, `tes/`) |
| 2 | Uji izin belajar.id; pendaftaran sekolah; pembuatan spreadsheet sekolah otomatis | berikutnya |
| 3 | Halaman operator: profil, pengguna, rombel, siswa (dengan impor dari Excel/Dapodik) | |
| 4 | Halaman input nilai, TP, kokurikuler, ekstrakurikuler, presensi | |
| 5 | Cek kelengkapan, rekap/leger, cetak rapor PDF (sampul, rapor, transkrip, SKL) | |
| 6 | Kenaikan kelas tahunan, uji coba di SDN Bugangin, lalu dibuka untuk sekolah lain | |
