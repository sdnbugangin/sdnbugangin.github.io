# Rancangan Aplikasi Rapor SD (Kurikulum Merdeka)

Aplikasi pengolahan nilai dan rapor untuk kelas 1–6, dipakai banyak sekolah.
Setiap sekolah mendaftar sendiri dan otomatis mendapat spreadsheet miliknya.
Aplikasi ini pengganti `RAPOR ... KELAS 5 ... .xlsm`: satu aplikasi untuk semua kelas, bukan satu file per kelas.

## 1. Keputusan yang sudah disepakati

| Hal | Keputusan |
|---|---|
| Login | **Satu akun per sekolah**: email sekolah + kata sandi khusus aplikasi, dipakai bersama semua guru. Tanpa PIN, tanpa akun per guru. Risiko akun bersama menjadi tanggung jawab sekolah (disetujui saat mendaftar). |
| Bobot nilai rapor | Sumatif lingkup materi 50%, sumatif akhir semester 50%. Bisa diubah per sekolah. |
| Format rapor | Mengikuti RAPOR CETAK lama. **Semester 1 tanpa keterangan naik/lulus.** |
| Rombel | Satu kelas bisa punya beberapa rombel (5A, 5B, …) |
| Kelas 1–6 | Satu aplikasi, satu spreadsheet per sekolah, semua kelas di dalamnya |

## 2. Gambaran sistem

```
Guru / operator (browser)
        │  sdnbugangin.github.io/rapor/   — email sekolah + kata sandi
        ▼
Aplikasi web Apps Script (berjalan sebagai akun pengelola)
        │
        ├── Spreadsheet Pusat: daftar sekolah, hash kata sandi, token, log
        └── Folder "Data Sekolah": satu spreadsheet per sekolah, dibuat otomatis
```

Semua hasil aplikasi berada di **satu folder utama** di Drive akun pengelola. Tidak ada berkas yang tertinggal di akar Drive:

```
Rapor SD/
├── Rapor SD - Pusat      (spreadsheet + skrip; dipindahkan ke sini oleh "siapkan")
└── Data Sekolah/         (satu spreadsheet per sekolah)
```

Hasil berikutnya (PDF rapor, unduhan) dibuat sebagai subfolder di dalam `Rapor SD/` lewat `folderBagian_`.
Jika folder terhapus, aplikasi membuatnya lagi di dalam folder utama. Spreadsheet sekolah yang gagal dipindah atau diisi langsung dibuang.

- Tampilan ada di GitHub Pages (`rapor/index.html`), sama seperti halaman Super Admin.
- Apps Script dipasang sekali oleh pengelola (langkahnya di bagian atas `apps-script/Kode.gs`) dan dijalankan sebagai akun pengelola. Semua spreadsheet sekolah tersimpan di Drive akun itu.
- Gunakan akun Google **khusus aplikasi ini**, bukan akun pribadi, supaya mudah diserahkan atau dikelola bersama.
- Batas akun Gmail biasa: sekitar 100 email per hari (untuk aktivasi dan lupa kata sandi) dan jumlah permintaan bersamaan yang terbatas. Cukup untuk puluhan sekolah. Kalau penggunanya sudah ratusan sekolah, pindahkan ke akun Google Workspace.

### Alur akun

1. **Daftar:** operator mengisi NPSN, nama sekolah, email, dan kata sandi aplikasi, lalu menyetujui pengelolaan data.
2. **Verifikasi:** tautan aktivasi dikirim ke email sekolah dan berlaku 48 jam. Saat diklik, akun aktif dan spreadsheet sekolah dibuat. Pendaftaran yang tidak diverifikasi dalam 48 jam boleh ditimpa, supaya NPSN tidak "tersandera" oleh salah ketik email.
3. **Masuk:** email dan kata sandi. Salah 5 kali, akun dikunci 15 menit. Sesi berakhir setelah 6 jam tidak dipakai.
4. **Ganti kata sandi** (misalnya saat ada guru pindah): semua perangkat lain otomatis keluar.
5. **Lupa kata sandi:** tautan reset dikirim ke email sekolah, berlaku 1 jam dan hanya sekali pakai.

Keamanan:
- Kata sandi disimpan sebagai hash HMAC-SHA256 berulang dengan garam acak. Token aktivasi, reset, dan sesi hanya disimpan hash-nya.
- Pesan kesalahan masuk dan lupa kata sandi tidak membocorkan apakah sebuah email terdaftar.
- Aplikasi tidak pernah meminta kata sandi email sekolah.

## 3. Isi spreadsheet sekolah

Data disimpan dalam bentuk tabel panjang, satu baris per data, bukan satu sheet per mapel.
Dengan cara ini tidak ada batas 15 TP atau 60 siswa, dan tidak ada 21 sheet berisi rumus kembar.

| Sheet | Isi (kolom utama) |
|---|---|
| Profil Sekolah | nama, NPSN, alamat, kepala sekolah, NIP, tempat & tanggal rapor |
| Pengaturan | tahun ajaran & semester aktif, bobot, mode deskripsi, seni yang ditawarkan |
| KKTP | batas bawah, predikat, kalimat deskripsi |
| Rombel | id, tahun ajaran, kelas (1–6), nama (5A), nama & NIP wali kelas |
| Siswa | id, NIS, NISN, nama, panggilan, JK, agama, tempat & tanggal lahir, orang tua, status (aktif / mutasi / lulus) |
| Anggota Rombel | tahun ajaran, rombel, siswa, seni pilihan |
| Mapel Aktif | tahun ajaran, kelas, kode mapel, urutan, nama di rapor |
| Tujuan Pembelajaran | tahun ajaran, semester, kelas, mapel (dan agama/seni bila perlu), kode TP, lingkup materi |
| Nilai | tahun ajaran, semester, siswa, mapel, jenis (TP / akhir), kode, nilai, diubah oleh, diubah pada |
| Kokurikuler | dimensi & subdimensi semester ini; capaian per siswa (Mahir / Cakap / Berkembang) |
| Master Narasi | subdimensi, level, narasi (75 baris bawaan dari rapor lama) |
| Ekstrakurikuler | siswa, kegiatan, predikat, keterangan |
| Presensi & Catatan | siswa, sakit, izin, alpa, catatan wali kelas, tanggapan orang tua |
| Kenaikan | siswa, keputusan (naik / tinggal); hanya dipakai di semester 2 |
| Log | waktu, pengguna, aksi, rincian |

Struktur mapel per kelas (bawaan, bisa diubah sekolah) ada di `apps-script/Referensi.gs`:
IPAS mulai kelas 3; Bahasa Inggris aktif bawaan kelas 3–6; Koding & KA serta Mulok diaktifkan sekolah bila ada.
Mapel agama dan seni dinilai sesuai agama dan seni pilihan masing-masing siswa, tetapi tampil sebagai satu baris di rapor.

Kolom identitas (NIS, NISN, ID, tahun ajaran) berformat teks, supaya NISN `0012345678` tidak berubah menjadi angka `12345678`.
Struktur lengkapnya ada di `STRUKTUR_SEKOLAH` di `apps-script/Sekolah.gs`.

## 4. Pengguna

Satu akun untuk satu sekolah. Semua guru (wali kelas maupun guru mapel) masuk dengan email dan kata sandi yang sama, lalu memilih kelas atau rombel yang akan diisi.
Aplikasi tidak membatasi guru hanya pada kelasnya sendiri. Akibat akun bersama, misalnya nilai kelas lain yang terubah tanpa sengaja, menjadi tanggung jawab sekolah.
Pengamannya: setiap perubahan nilai dicatat di Log beserta waktunya, dan kepala sekolah bisa mengunci rapor yang sudah final (tahap 5).

### Aturan data siswa (tahap 3)

- **Isian dirapikan sebelum disimpan.** "Laki-laki" menjadi `L`, "Budha" menjadi `Buddha`, "musik" menjadi `Seni Musik`. Tanggal `15/03/2016` disimpan sebagai `2016-03-15` dan ditampilkan lagi sebagai `15/03/2016`. Nama panggilan diisi dari kata pertama nama jika kosong.
- **Satu kesalahan menolak seluruh simpanan.** Semua kesalahan dilaporkan sekaligus dengan nomor baris yang sama dengan tabel, dan tidak ada data yang tersimpan setengah jadi.
- **NISN/NIS unik di satu sekolah.** Siswa tidak bisa berada di dua rombel pada tahun ajaran yang sama.
- **Siswa yang dihapus dari rombel tidak dihapus datanya.** Jika siswa itu ditempel di rombel lain dengan NISN (atau NIS) yang sama, ia disambungkan ke data lamanya sehingga tidak ada siswa dobel.
- **Rombel hanya bisa dihapus jika sudah kosong.** Satu rombel maksimal 100 siswa.
- **Jumlah siswa per rombel** diisi sekali (di form rombel atau di halaman siswa).
  - Tabel siswa langsung disiapkan sebanyak itu (tombol "Siapkan baris"), tanpa klik "Tambah baris" berulang.
  - Penghitung menampilkan "Terisi 28 dari 30 siswa (kurang 2)" di halaman siswa dan di kartu rombel.
  - Siswa yang diisi melebihi jumlah itu ditolak.
- **No. Absen = urutan baris di tabel** (disimpan sebagai No Urut). Tombol "Urutkan nama A–Z" menyusun ulang nomor absen. Nomor ini dipakai di presensi, leger, dan rapor.
- **Lebih dari 1.000 baris tetap aman.** Baris tambahan sheet dibuat otomatis, lengkap dengan format teksnya.

### Mata pelajaran per kelas

- **Tab Mata Pelajaran** menampilkan tabel centang mapel × kelas 1–6. Hanya mapel yang dicentang yang muncul di input nilai dan di rapor, sehingga sekolah yang belum mengajarkan Bahasa Inggris atau KKA tidak mendapat baris kosong di rapor.
- **Mapel wajib selalu aktif**: Agama, Pancasila, Bahasa Indonesia, Matematika, IPAS (kelas 3–6), Seni dan Budaya, dan PJOK.
- **Mapel pilihan**: Bahasa Inggris (kelas 1–6), Koding dan Kecerdasan Artifisial (kelas 5–6), dan muatan lokal.
- **Muatan lokal** bisa sampai 7, sama seperti rapor Excel lama. Muatan lokal yang aktif wajib diberi nama sungguhan (misalnya Bahasa Jawa), supaya rapor tidak tercetak "Muatan Lokal 1". Nama mapel tidak boleh dobel.
- **Mapel yang sudah punya nilai** di suatu kelas tidak bisa dinonaktifkan, supaya nilai tidak hilang dari rapor diam-diam.

### Seni dan Budaya dengan lebih dari satu seni

- **Seni yang diajarkan diatur per sekolah** di tab Profil (centang Musik, Rupa, Tari, dan/atau Teater). Seni yang masih dipilih siswa tidak bisa dihapus dari daftar.
- **Seni pilihan diatur per siswa** dan boleh lebih dari satu: `Musik, Rupa`. Ada tombol "Terapkan ke semua baris" untuk sekolah yang semua siswanya mengikuti seni yang sama. Sekolah yang hanya mengajarkan satu seni tidak perlu mengisi apa pun, karena seninya terisi otomatis.
- **Setiap seni punya TP dan nilai sendiri.** Di rapor tetap tampil sebagai **satu baris "Seni dan Budaya"** (`hitungNilaiGabungan_` di `Hitung.gs`):
  - nilai = rata-rata nilai akhir tiap seni (sama seperti rapor Excel lama);
  - deskripsi = TP tertinggi/terendah tiap seni digabung dalam satu kalimat, misalnya *"Ananda Budi menunjukkan penguasaan yang sangat baik dalam memainkan alat musik ritmis dan menggambar ilustrasi."* Rapor lama mengulang kalimat pembukanya untuk setiap seni;
  - seni yang belum dinilai membuat rapor siswa itu "belum lengkap", dengan nama seninya di peringatan.

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
4. **Aman saat dipakai bersamaan.** `LockService` dipakai saat menyimpan, dan setiap perubahan nilai dicatat di Log.
5. **Diuji otomatis.** `rapor/tes/` berisi uji untuk setiap kasus di tabel atas dan untuk seluruh alur akun, memakai tiruan Apps Script (`tes/tiruan-gas.js`). Jalankan: `node --test rapor/tes/*.test.js`.

## 6. Tahapan

| Tahap | Isi | Status |
|---|---|---|
| 1 | Mesin hitung + data referensi + uji otomatis | ✅ selesai (`apps-script/Hitung.gs`, `Referensi.gs`, `tes/`) |
| 2 | Akun sekolah (daftar, verifikasi email, masuk, lupa & ganti kata sandi) dan pembuatan spreadsheet sekolah otomatis | ✅ selesai (`index.html`, `apps-script/Kode.gs`, `Akun.gs`, `Sekolah.gs`, `Narasi.gs`) |
| 3 | Data sekolah: profil, rombel & wali kelas, siswa (tempel langsung dari Excel/Dapodik), unduh salinan Excel | ✅ selesai (`apps-script/Data.gs`, halaman Data Sekolah & Siswa) |
| 4 | Halaman input nilai, TP, kokurikuler, ekstrakurikuler, presensi | berikutnya |
| 5 | Cek kelengkapan, rekap/leger, cetak rapor PDF (sampul, rapor, transkrip, SKL), kunci rapor | |
| 6 | Kenaikan kelas tahunan, uji coba di SDN Bugangin, lalu dibuka untuk sekolah lain | |
