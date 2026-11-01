# Website SD N Bugangin

Situs statis GitHub Pages. Layanan yang butuh data berjalan sebagai aplikasi Google Apps Script (web app) milik akun sekolah, dan website hanya menautkan atau memanggilnya. Pemilik: Kepala Sekolah. Komunikasi dalam bahasa Indonesia yang sederhana; banyak guru pengguna sudah berumur.

## Proyek Apps Script

| Aplikasi | Script ID | Deployment ID (bagian alamat `/macros/s/…/exec`) | Data |
|---|---|---|---|
| Presensi Digital | `1YSGZGQn0fMHCXY8DRWa8EudCHbclZcBx6-gKiYEC_muEv-5L2cE1ZN3L` | `AKfycbwlW-dmXA93oPWO03GVUhirEt2Smu1dPzhRoST4xQwlpSiNKVZRamVwp1M5enwfXu1N` | spreadsheet Database_Presensi_SDN_Bugangin (terikat) |
| Super Admin (bantuan, prestasi, kabar) | `1y7MANEjhRxo58zEOe_InzrfFQIp55pQKVHhuToNBddbUjhtMYylpKGAu` | `AKfycbyE3fM1cmCXeMsdoygOAP92MIKSngirrd3pOd2U1t4Nr63wAO3lOfEjUyCPBUA7PTor` | spreadsheet Database Bantuan Siswa (terikat); salinan kode di `super-admin/apps-script/Kode.gs` |
| Persuratan | `15Mpx2pij8a_ICLDbyJVuaFwtLc6ga-QOre8WSePZCplAGYLhvRbRAb2D` | `AKfycbzYhvR7D-rcUx64s0navcLL4JZBtZ6e_PgQ1zEQSKcVDqqtWL9Z7hrASOd26_WRqchX` | spreadsheet dibuat oleh `setupAwal()` |
| Update Nomor WA | `1UPX-pcnR8qEpkcUI0EqBqcRh1Bju3D_n5z8bp09h2UPZDWE5RlW69Kng` | `AKfycbxYn87T_TmCMIT30VdE7M_zNERwLIxMin_ILewdt2OT4_z4fu9MviA5mQmTmJ3szYHD` | — |
| Pantau Belajar Anak | `15Zy0e4sRWSmcld2FV7Y_9PVoamAhmB7m3qjCZ2j_XGnQp-xZXs_x22YL` | `AKfycbxY8_LcuMcMR4Tv9zPraZJGduHPDOKtwOzHUpwhLiAx4wnzdLlkDdTmrAjWwbxMpuB_` | spreadsheet DB Pantau Belajar SD N Bugangin (dibuat `setupAwal()`); membaca spreadsheet rapor sekolah |

## Mengubah kode Apps Script lewat clasp

Kredensial clasp ada di variabel lingkungan `CLASPRC_JSON` (isi `~/.clasprc.json`).

- Tulis ke berkas tanpa menampilkannya: `printf '%s' "$CLASPRC_JSON" > ~/.clasprc.json && chmod 600 ~/.clasprc.json`. Jangan pernah mencetak, mencatat, atau meng-commit isinya.
- Kerjakan di direktori scratchpad, bukan di repo ini (repo publik): `clasp clone <Script ID>`, lalu selalu `clasp pull` dulu supaya perubahan yang dibuat langsung di editor tidak tertimpa.
- Uji perubahan sebelum `clasp push`.
- Pasang dengan memperbarui deployment yang sudah ada (cek `clasp --help` untuk nama perintahnya, misalnya `clasp update-deployment <Deployment ID>`). Jangan membuat deployment baru, karena alamatnya berubah dan tautan di website serta grup WA orang tua jadi putus.
- Minta persetujuan Kepala Sekolah sebelum `push` dan sebelum memasang versi baru; aplikasi dipakai guru dan orang tua setiap hari.
- Jika `clasp` belum ada di sesi: `npm install -g @google/clasp`.

## Pengaman agar kode lama yang sudah bagus tidak rusak

Ikuti urutan ini setiap kali mengubah aplikasi Apps Script:

1. **Catat versi yang sedang jalan.** Sebelum mengubah apa pun, jalankan `clasp list-deployments` dan laporkan nomor versi deployment resmi (mis. Presensi `@64`) ke Kepala Sekolah. Itu titik kembali.
2. **Perubahan kecil, satu per satu.** Satu perbaikan per pemasangan; jangan menggabungkan banyak perubahan sekaligus. Jangan menulis ulang atau merapikan bagian kode yang tidak diminta.
3. **Uji di alamat uji coba dulu.** (Untuk aplikasi yang dipanggil dari halaman website, mis. Pantau, alamat `/dev` tidak bisa dipakai karena butuh login Google; gantinya buat server baru tetap melayani halaman lama, uji dengan tes + data contoh, pasang, lalu tayangkan halaman.) Setelah `clasp push` (dengan izin), deployment resmi belum berubah. Berikan Kepala Sekolah alamat uji coba `https://script.google.com/macros/s/<ID deployment @HEAD>/dev` (ID `@HEAD` terlihat di `clasp list-deployments`; hanya bisa dibuka akun pemilik/editor), lalu tunggu konfirmasi bahwa sudah dicoba dan cocok.
4. **Cadangkan data bila susunan spreadsheet berubah.** Jika perubahan menambah/menghapus/memindah kolom atau sheet, minta Kepala Sekolah membuat salinan spreadsheet (File → Buat salinan) sebelum dipasang.
5. **Pasang di luar jam sibuk.** Pasang versi baru siang/sore setelah sekolah, bukan pagi saat presensi. Caranya: `clasp create-version "<keterangan>"`, lalu `clasp update-deployment <Deployment ID> -V <nomor versi baru> -d "<keterangan>"`.
6. **Cek setelah dipasang**, lalu laporkan nomor versi lama dan baru.
7. **Jika bermasalah, kembalikan segera** ke versi yang dicatat di langkah 1: `clasp update-deployment <Deployment ID> -V <nomor versi lama>`. Alamat tetap sama.

Untuk website (repo ini): kerjakan di cabang kerja, bukan langsung di cabang utama; perubahan baru tayang setelah Kepala Sekolah menyetujui penggabungan di GitHub. Halaman yang rusak dikembalikan dengan `git revert`, bukan menghapus riwayat.

## Rapor (dikelola di bolonulis.github.io)

- Aplikasi rapor ada di `https://bolonulis.github.io/app/` (repo `bolonulis/bolonulis.github.io`; server di repo privat `bolonulis/rapor-merdeka-digital-server`, proyek Apps Script `1WT1XoYN7HLAI8o7z0QphYhik--LohlXH8KPPeZbRWwlMRSRRAID3RDmk`, dipakai banyak SD). Website ini hanya menautkan ke sana (kartu di halaman depan dan pengalih `rapor/index.html`); jangan menyalin kode rapor ke repo ini.
- Spreadsheet `1NOW-sx-lwBiPAYpV3xjtm8uDomlYTyMFhR0lyThKH8U` adalah **Pusat** (daftar semua sekolah pengguna). Nilai SD N Bugangin ada di spreadsheet sekolah `1CnMyQq9ToDt8t4wxlDn_o7XPPb5ewhSjQCzwomz0bKo` ("Rapor - SD NEGERI BUGANGIN (20321653)"). Semua di folder Drive rapor milik akun Kepala Sekolah, akses terbatas (pemilik + bolonulis@gmail.com). Jangan pernah mengubahnya menjadi "siapa saja yang memiliki link".

## Pantau Belajar Anak (`pantau/`, khusus SD N Bugangin)

- Orang tua masuk dengan memilih kelas dan nama lengkap anak (daftar dari rapor tahun ajaran aktif) lalu sandi, melihat ketuntasan TP per mapel (Tuntas / Belum tuntas / Belum dinilai), tanpa angka nilai. Belum tuntas → saran meminta jadwal ulangan perbaikan ke guru kelas; semua tuntas → kalimat apresiasi.
- Aplikasi Apps Script tersendiri milik akun Kepala Sekolah; kode di `pantau/apps-script/Kode.gs`, tes `node --test pantau/tes/*.test.js`. Spreadsheet rapor sekolah **hanya dibaca**; server bolonulis tidak disentuh.
- Akun berkunci ID Siswa rapor (akun lama berkunci NISN tetap dikenali dan dipindah saat ganti sandi; server masih menerima masuk dengan NISN untuk halaman lama). Sandi awal semua siswa `muridsuper`, wajib diganti saat pertama masuk (min. 4 karakter); 5 kali salah → dikunci 15 menit; guru mengatur ulang sandi dengan PIN Guru. Batas Tuntas (bawaan 70) dan PIN Guru diatur di sheet Pengaturan spreadsheet "DB Pantau Belajar SD N Bugangin" (dibuat `setupAwal()`).
- Membaca sheet rapor berdasarkan judul kolom (Pengaturan, Rombel, Siswa, Anggota Rombel, Mapel Aktif, Tujuan Pembelajaran, Nilai). **Setiap kali server bolonulis mengubah susunan sheet, cek dan uji ulang aplikasi ini.**

## Aturan data

- Data bantuan (PIP, BAZNAS, yatim piatu) dan pelanggaran hanya untuk guru. Halaman publik tidak boleh menampilkan nama siswa; jumlah di bawah 3 disamarkan.
  - Pengecualian (keputusan Kepala Sekolah): daftar pilihan kelas → nama lengkap siswa di layar masuk Pantau Belajar / Tumbuh Kembang. Data di balik nama itu tetap hanya terbuka dengan sandi orang tua.
- Nomor WA orang tua dan data siswa adalah data pribadi anak (UU No. 27/2022): jangan disalin ke repo.
