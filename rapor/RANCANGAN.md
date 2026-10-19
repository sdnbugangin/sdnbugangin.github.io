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
| Kokurikuler | subdimensi yang dinilai per kelas per semester (dimensi mengikuti subdimensinya) |
| Capaian Kokurikuler | capaian per siswa per subdimensi (Mahir / Cakap / Berkembang) |
| Master Narasi | subdimensi, level, narasi (75 baris bawaan dari rapor lama) |
| Ekstrakurikuler | siswa, kegiatan, predikat, keterangan (tanpa batas jumlah per siswa) |
| Presensi & Catatan | siswa, sakit, izin, alpa, catatan wali kelas, tanggapan orang tua |
| Kenaikan | siswa, keputusan (Naik / Tinggal; kelas 6: Lulus / Tidak Lulus) per tahun ajaran; hanya tampil di rapor semester 2 |
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

### Tujuan Pembelajaran (TP)

- **Disusun per kelas, mapel, dan semester**, dan dipakai semua rombel di kelas itu. Agama punya TP per agama, Seni per seni. Maksimal 40 TP per mapel per semester.
- **Tiap TP punya dua isian:**
  - Tujuan Pembelajaran, maksimal **100 karakter** (batas e-Rapor), dihitung langsung saat diketik;
  - Lingkup materi (opsional) untuk kalimat deskripsi rapor; jika kosong, teks TP yang dipakai.
- **Kode TP tetap** (TP1, TP2, …) dan dirujuk oleh nilai, jadi mengubah urutan atau teks TP tidak memindahkan nilai. TP yang sudah punya nilai tidak bisa dihapus.
- **TP bawaan:** isi Pengaturan Pusat **"NPSN Sumber TP Bawaan"** dengan NPSN sekolah tempat TP disusun.
  - Sekolah yang mendaftar setelahnya langsung mendapat salinan TP itu.
  - Sekolah lain bisa mengambilnya per mapel dengan tombol **Pakai TP bawaan**.
  - Salinan di tiap sekolah bebas diubah tanpa mengubah sumbernya.
- **Unduh format e-Rapor:** tombol "Unduh TP kelas ini" membuat satu berkas `f_tp (…).xlsx` per mapel, berisi semester 1 dan 2, dalam satu ZIP.
  - Isinya sama dengan template impor TP e-Rapor Kemendikdasmen: judul, kode mapel di C2, "SD", kolom NO/TINGKAT/FASE/SEMESTER/TP, daftar pilihan, dan batas 100 karakter.
  - Berkas dibuat di browser dengan ExcelJS dan JSZip (cdnjs).
  - Kode mapel e-Rapor ada di `KODE_ERAPOR` (`Referensi.gs`); yang belum diketahui (Agama per agama, Pancasila, PJOK, KKA, Mulok) diberi peringatan dan sel C2-nya dikosongkan.
  - Agama: satu berkas per agama. Seni: semua seni digabung dalam berkas "Seni Budaya".

### Input nilai

- **Satu layar** = satu rombel, satu mapel, satu agama/seni, satu semester. Hanya siswa yang mengikuti agama/seni itu yang tampil, tetap dengan nomor absen rombelnya.
- **Kolom**: TP1…TPn (sumatif lingkup materi) serta **SAS Tes** dan **SAS Praktik** (sumatif akhir semester, boleh salah satu; jika keduanya diisi, dirata-rata).
- **Cara isi**: angka 0–100, koma desimal boleh. Kotak yang salah langsung merah dan simpan dicegah. Enter pindah ke siswa berikutnya. Satu blok angka bisa ditempel dari Excel.
- **Tersimpan per angka** di sheet Nilai: Jenis `TP` dengan kode TP, atau Jenis `SAS` dengan kode `TES`/`PRAKTIK`. Untuk mapel dengan varian, kode SAS diawali varian (`Seni Musik|TES`) karena satu siswa bisa mengikuti beberapa seni.
- **Nilai rapor, predikat, dan deskripsi tidak disimpan.** Semuanya dihitung ulang dari angka dengan `hitungNilaiMapel_` memakai bobot, KKTP, dan gaya deskripsi sekolah, sehingga perubahan pengaturan langsung berlaku. Pengaturan yang rusak (bobot ≠ 100%) dilaporkan, bukan menghasilkan nilai salah.
- **Hasil per siswa** (nilai, predikat, deskripsi tertinggi/terendah, peringatan seperti "SAS belum diisi") tampil setelah disimpan, ditambah penghitung "Lengkap 28 dari 30 siswa".

### Kokurikuler

- **Subdimensi per kelas per semester** (1–8), dipilih dari 8 dimensi profil lulusan (`DIMENSI_PROFIL`). Dimensinya mengikuti otomatis. Pilihan ini berlaku untuk semua rombel di kelas itu.
- **Capaian disimpan per subdimensi**, bukan per nomor urut, sehingga mengubah urutan atau menambah subdimensi tidak menggeser capaian yang sudah ada. Subdimensi yang sudah punya capaian tidak bisa dihapus.
- **Isian**: Mahir / Cakap / Berkembang (huruf M/C/B juga diterima). Isian lain ditolak semuanya, dan isian kosong menghapus capaian. Pilihan di judul kolom mengisi satu kolom sekaligus.
- **Deskripsi** dihitung ulang dengan `deskripsiKokurikuler_`, memakai narasi dari Master Narasi sekolah: dimensi tertinggi disebut "sudah baik… salah satunya mampu…", dimensi terendah "masih perlu bimbingan… agar dapat…".
- **Master Narasi** bisa diubah di aplikasi dan berlaku untuk semua kelas. Narasi yang dikosongkan kembali ke bawaan. Ejaan lama "Fleksibitas Berpikir" tetap dikenali.

### Wali kelas (ekstrakurikuler, ketidakhadiran, catatan, kenaikan)

- **Daftar ekstrakurikuler sekolah** diisi dengan "jumlah ekstrakurikuler" lalu kotak bernomor (maks. 50 sebagai pengaman), disimpan di Pengaturan "Ekstrakurikuler Ditawarkan". Kegiatan yang sudah diisi untuk siswa tahun ini tidak bisa dihapus.
- **Ekstrakurikuler siswa**: boleh lebih dari satu kegiatan dari daftar sekolah (tanpa batas selain daftar itu; satu kegiatan sekali), masing-masing dengan predikat (Sangat Baik/Baik/Cukup/Kurang) dan keterangan.
  - Keterangan kosong dibuat otomatis saat dibaca, misalnya "Sangat baik dalam mengikuti kegiatan Pramuka.", sehingga selalu sesuai predikat.
  - Satu kegiatan bisa ditambahkan ke semua siswa sekaligus.
- **Ketidakhadiran**: bilangan bulat 0–200 hari; kosong = belum diisi. Tersedia tombol "isi 0" dan tempel blok dari Excel.
- **Catatan wali kelas**: maksimal 500 karakter.
- **Tanggapan Orang Tua** tidak diubah oleh aplikasi.
- **Kenaikan** diisi sekali per tahun ajaran. Kelas 6 memakai Lulus/Tidak Lulus. Keterangan hanya muncul di rapor semester 2 (`keteranganKenaikan_`).

### Cek & cetak rapor

- **`rekapRombel_`** (Rapor.gs) menghitung ulang seluruh isi rapor satu rombel dari data mentah dengan fungsi yang sama seperti layar input.
  - Agama memakai varian sesuai agama siswa. Nama mapelnya menjadi "Pendidikan Agama Islam dan Budi Pekerti" dan seterusnya.
  - Seni memakai `hitungNilaiGabungan_` atas semua seni pilihan siswa.
- **Kelengkapan** per siswa: nilai tiap mapel (TP + SAS lengkap), kokurikuler, ekstrakurikuler, ketidakhadiran, catatan, dan kenaikan (hanya semester 2). Juga diperiksa: profil sekolah (kepala sekolah, alamat, tempat & tanggal pembagian) dan nama wali kelas.
- **Leger**: nilai semua mapel, jumlah, rata-rata, dan peringkat. Peringkat hanya diberikan kepada siswa yang semua nilainya lengkap; nilai sama mendapat peringkat sama.
- **Cetak** dilakukan dari peramban (A4 tegak; leger A4 mendatar) lewat dialog cetak, yang juga bisa **Simpan sebagai PDF**. Cara ini dipilih karena guru tidak punya akses ke Drive pengelola, sehingga PDF di Drive tidak berguna bagi sekolah.
  - Format mengikuti RAPOR CETAK lama: identitas, tabel muatan pelajaran (muatan lokal dikelompokkan a., b., …), kokurikuler, ekstrakurikuler, ketidakhadiran & catatan, tanggapan orang tua, keputusan (semester 2), dan tanda tangan.
  - Mencetak rapor yang belum lengkap tetap bisa, tetapi harus dikonfirmasi dulu.
- **Unduh Excel** (satu berkas per rombel per semester) untuk disalin ke e-Rapor. Isinya:
  - Daftar Siswa dan Rekap Nilai (leger);
  - satu sheet per mapel: nilai akhir, **TP tertinggi dan TP terendah** tiap siswa (kode + isi TP, seni satu per seni, agama sesuai agama siswa) yang dicentang guru di e-Rapor, deskripsi capaian, dan catatan bila belum lengkap;
  - Kokurikuler;
  - Ekskul & Kehadiran (termasuk keputusan kenaikan di semester 2).
  - NISN ditulis sebagai teks agar nol di depan tidak hilang. Nama sheet yang lebih dari 31 karakter memakai kode mapel (IPAS, PJOK).

### Sampul dan identitas

- Tombol **Cetak sampul & identitas** di Cek & Cetak Rapor → Cetak Rapor. Satu siswa = 3 halaman A4, mengikuti SAMPUL CETAK lama:
  1. **Halaman depan**: RAPOR PESERTA DIDIK SEKOLAH DASAR (SD), logo Tut Wuri Handayani (`logo-tutwuri.png`), nama, NISN/NIS, Kementerian.
  2. **Identitas sekolah**: nama, NPSN, alamat, kode pos, desa, kecamatan, kabupaten, provinsi, website, email.
  3. **Identitas peserta didik**: data diri, orang tua dan pekerjaannya, alamat orang tua, wali, kotak pas foto 3×4, dan tanda tangan kepala sekolah.
- Kolom siswa tambahan untuk sampul: Pendidikan Sebelumnya, Pekerjaan Ayah/Ibu, Alamat Orang Tua, Pekerjaan Wali, Alamat Wali.
- Profil sekolah mendapat baris **Website**. Spreadsheet lama dilengkapi otomatis (`profilLengkap_`).
- Logo ditunggu sampai termuat sebelum jendela cetak dibuka.

### Transkrip nilai dan SKL kelas 6

- Menu **Transkrip & SKL**. Nilai tiap mapel = rata-rata **nilai rapor tercetak**, ditulis **2 desimal**, dari:
  - kelas 5 semester 1 dan 2 (tahun ajaran lalu, termasuk Arsip Nilai);
  - kelas 6 semester 1 dan 2;
  - **praktik** bila diisi.
- Rata-rata = rata-rata nilai mapel. Hanya dihitung bila semua mapel bernilai.
- Nilai dari aplikasi tampil samar. Setiap angka bisa diisi atau ditimpa manual (misalnya tahun pertama memakai aplikasi); bila dikosongkan, kembali ke nilai aplikasi.
- **Mapel di transkrip mengikuti urutan master**: Agama (nama sesuai agama siswa), Pendidikan Pancasila, Bahasa Indonesia, Matematika, IPAS, PJOK, Seni dan Budaya, lalu "Muatan Lokal: …".
  - Bahasa Inggris dan KKA hanya muncul bila **dicentang** sekolah (kebijakan dinas) dan diajarkan di kelas 6.
- **Penomoran**: nomor transkrip dan nomor SKL diisi untuk siswa pertama, lalu siswa berikutnya otomatis +1 dengan nol di depan dipertahankan (060, 061, …). Urutannya mengikuti rombel lalu nomor absen; siswa tidak lulus dilewati.
- **Pengaturan surat**:
  - kop baris 1, tempat surat, dan logo pemda (kiri) dan logo sekolah (kanan) berlaku lintas tahun;
  - nomor SK kelulusan, tanggal kelulusan, dan tanggal transkrip per tahun ajaran;
  - logo diperkecil di peramban dan disimpan di sheet **Kelulusan** (≤ 48.000 karakter per sel).
- **Cetak**: A4, margin 2 cm, Arial 12, sama dengan master Word.
  - Kop: 12/16/10 pt dengan garis ganda.
  - Identitas menjorok 0,75 cm, titik dua di 7 cm.
  - Tabel 1,04/11,43/4,43 cm, kotak foto 2,3 × 3 cm, dan tanda tangan kepala sekolah.
  - Hasil cetak dicek dengan menumpangkannya pada render master.
- **SKL** mengikuti sheet SKL file lama: kalimat "Yang bertanda tangan…", "dinyatakan LULUS… berdasarkan Keputusan Kepala… Nomor…", tabel nilai, dan masa berlaku sampai ijazah terbit.
- **Unduh Excel** dengan kolom yang sama dengan berkas input mail merge (Nomor Transkrip, NPSN, Nama Siswa, …, Jumlah, Rata-Rata, Agama Siswa), ditambah Nomor SKL dan sheet Nilai Rinci.

### Kunci rapor

- Di **Cek & Cetak Rapor**, rapor satu rombel pada satu semester bisa **dikunci** setelah final. Kunci disimpan di Pengaturan "Rapor Terkunci".
- **Selama terkunci, yang ditolak server:**
  - nilai, capaian kokurikuler, ekstrakurikuler, ketidakhadiran & catatan rombel itu;
  - keputusan kenaikan (bila semester 2 terkunci);
  - data siswa (bila semester berjalan terkunci);
  - hal yang berlaku sekelas: TP, subdimensi kokurikuler, dan mapel aktif kelas itu;
  - narasi yang dipakai kelas itu.
- Halaman isian tetap bisa dibuka, tetapi hanya untuk melihat (ada penanda 🔒).
- **Buka kunci** wajib disertai alasan. Kunci dan buka kunci tercatat di Log sekolah.
- Karena satu akun dipakai bersama, kunci melindungi dari salah ubah, bukan dari niat jahat.

### Kinerja (uji beban)

- Sekolah besar (6 kelas × 2 rombel × 32 siswa) mengisi ±14.700 baris Nilai per semester, atau ±29.500 per tahun.
- **Penulisan hemat:** `tulisTabel_` membandingkan dengan isi yang dibaca di permintaan yang sama (`ISI_SHEET_`) dan hanya menulis rentang baris yang berubah. `gantiDiTempat_` mengganti baris di tempatnya, jadi baris lain tidak bergeser. Angka yang tidak berubah tidak disentuh, dan stempel waktunya tetap.
  - Hasilnya: simpan satu layar nilai menulis ±1.300 sel, bukan ±118.000 (satu angka berubah: 8 sel).
- **Baca hemat:**
  - setiap sheet dibaca paling banyak sekali per permintaan (`ISI_SHEET_`, termasuk baris judul);
  - sheet yang diperlukan suatu aksi (`BACA_PER_AKSI_`) dibaca sekaligus dalam **satu** panggilan layanan lanjutan Google Sheets API (`bacaSekaligus_`); tanggal "Diubah Pada" dikembalikan dari nomor seri ke Date;
  - ID spreadsheet sekolah diingat 10 menit di CacheService.
  - Layanan lanjutan dicari dengan ID apa pun (`layananSheets_`). Bila tidak ada, `ambilBatch_` memanggil REST `values:batchGet` lewat UrlFetch dengan token skrip. Penolakan REST (403/404/400) diingat 1 jam.
  - Bila semuanya tidak bisa dipakai, atau kuota habis, aplikasi otomatis membaca dengan cara biasa.
  - Hasilnya: membuka/menyimpan layar cukup 2 panggilan baca (sesi + baca sekaligus), sebelumnya 10–21.
- Hasil uji beban pertama di server (sebelum baca hemat, sekolah 384 siswa dengan nilai 1 tahun):
  - buka layar nilai 5,8 dtk;
  - simpan nilai 7–8 dtk;
  - rekap rapor 8,1 dtk;
  - simpan ketidakhadiran 3,2 dtk.
  
  Kesimpulannya: yang lambat adalah banyaknya pembacaan sheet, bukan penulisan.
- **Kunci per sekolah:**
  - `denganKunci_` mengunci per NPSN lewat CacheService. Kunci skrip hanya dipegang sesaat untuk mengambil kunci itu, sehingga sekolah berbeda bisa menyimpan bersamaan.
  - Sekolah yang sama menunggu paling lama 20 dtk, lalu mendapat pesan "sedang disimpan dari perangkat lain".
  - Kunci lepas sendiri setelah 60 dtk bila eksekusi terhenti.
  - Urusan akun di Pusat tetap memakai kunci skrip.
- Uji beban kedua (baca hemat tanpa Sheets API, 384 siswa, 1 tahun):
  - buka layar nilai 4,8 dtk; simpan nilai 5,0–5,3 dtk; rekap 5,8 dtk; buka kokurikuler 2,3 dtk.
  - Rinciannya: baca 1 sheet kecil 0,2 dtk; baca sheet Nilai 29.480 baris 2,1 dtk.
- Uji beban ketiga (layanan Sheets tidak terdeteksi): hasilnya mirip uji kedua, dengan variasi server ±1 dtk.
- **`ujiBeban()` (Uji.gs)** dijalankan pengelola dari editor untuk mengukur waktu nyata di server Google:
  - membuat sekolah uji sementara berisi 384 siswa dengan nilai satu tahun;
  - mengukur operasi sehari-hari dan mencatat hasilnya ke Log Pusat ("uji beban");
  - lalu menghapus sekolah uji itu.

### Tahun ajaran baru

Dari **Data Sekolah → Profil → Tahun ajaran baru**, sekali setahun, setelah rapor semester 2 dibagikan.

- **Periksa kesiapan** (`taBaruPratinjau_`):
  - semester harus 2 dan semua siswa sudah punya keputusan naik/tinggal (siswa yang belum disebut namanya);
  - bila ada rombel yang rapor semester 2-nya belum dikunci, muncul peringatan;
  - pratinjau menampilkan rombel tahun baru, asal siswa yang naik, dan daftar siswa lulus.
- **Mulai** (`taBaruJalankan_`), wajib mengetik "MULAI 2027/2028":
  1. **Cadangan** spreadsheet sekolah dibuat di "Rapor SD/Cadangan". Bila cadangan gagal, tidak ada yang diubah.
  2. Rombel tahun baru disusun sama per kelas (nama, wali, NIP ikut).
     - Siswa naik masuk kelas berikutnya dengan akhiran nama yang sama (4A → 5A). Bila tidak ada, ke satu-satunya rombel kelas itu, atau ke rombel urutan yang sama. Bila kelas itu belum punya rombel, rombel baru dibuat.
     - Siswa tinggal tetap di rombelnya. Kelas 6 yang lulus diberi status "Lulus". Kelas 1 kosong.
  3. Mapel Aktif, TP, dan subdimensi kokurikuler disalin ke tahun baru.
  4. Nilai tahun lalu dipindah ke sheet **Arsip Nilai**, agar sheet Nilai tetap kecil dan cepat.
  5. Pengaturan diubah ke tahun ajaran baru, semester 1. Tercatat di Log.

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
| 4 | Tujuan Pembelajaran ✅ (`Tp.gs`), input nilai ✅ (`Nilai.gs`), kokurikuler ✅ (`Kokurikuler.gs`), ekstrakurikuler, presensi, catatan, kenaikan ✅ (`WaliKelas.gs`) | ✅ selesai |
| 5 | Cek kelengkapan ✅, leger ✅, cetak rapor ✅ (`Rapor.gs`), unduh Excel ✅, kunci rapor ✅ (`Kunci.gs`), uji beban ✅ (`Uji.gs`), sampul ✅, transkrip & SKL ✅ (`Kelulusan.gs`) | ✅ selesai |
| 6 | Kenaikan kelas tahunan ✅ (`TahunAjaran.gs`), uji coba di SDN Bugangin, lalu dibuka untuk sekolah lain | |
