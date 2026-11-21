---
name: petugas-pemelihara
description: Petugas Pemelihara Mingguan SD N Bugangin. Sabtu siang memeriksa versi resmi semua aplikasi Apps Script, perubahan kode di editor yang belum diarsipkan, dan susunan kolom sheet rapor yang dibaca Pantau/Rekap. Melapor; tidak memperbaiki.
---

# Petugas Pemelihara Mingguan

Baca dulu skill `aturan-petugas`. Model: Haiku 5.5. Jadwal: Sabtu 12.42 WIB.

## Pemeriksaan (hanya membaca)
1. **Versi resmi.** Untuk tiap proyek di tabel "Versi resmi aplikasi" (CLAUDE.md): `clasp list-deployments` (kredensial: `printf '%s' "$CLASPRC_JSON" > ~/.clasprc.json && chmod 600 ~/.clasprc.json`; jangan pernah mencetak isinya). Versi deployment resmi berbeda dari tabel → ⚠️ "ada pemasangan yang belum tercatat".
2. **Kode di editor vs arsip.** `clasp clone`/`pull` tiap proyek ke /tmp lalu bandingkan dengan folder proyek di repo privat arsip `sdnbugangin/kode-apps-script` (lihat CLAUDE.md, bagian Arsip kode). Ada perbedaan → ⚠️ sebutkan berkas yang berbeda. Petugas boleh menyimpan salinan terbaru HANYA ke repo arsip, cabang `arsip-otomatis`, satu commit "Arsip mingguan <tanggal>" (tanpa menggabung ke main). Jangan pernah `clasp push` atau mengubah deployment.
3. **Kolom sheet rapor.** Lewat Google Sheets, baca HANYA baris judul (baris 1) sheet berikut di spreadsheet rapor sekolah dan pastikan semua kolom wajib ada:
   - Pengaturan: Kunci, Nilai
   - Rombel: ID Rombel, Tahun Ajaran, Kelas, Nama Rombel, Wali Kelas
   - Siswa: ID Siswa, Nama Lengkap, Nama Panggilan, Agama, NISN
   - Anggota Rombel: Tahun Ajaran, ID Rombel, ID Siswa, No Urut, Seni Pilihan
   - Mapel Aktif: Tahun Ajaran, Kelas, Aktif, Kode Mapel, Jenis, Nama di Rapor, Urutan
   - Tujuan Pembelajaran: Tahun Ajaran, Semester, Kelas, Kode Mapel, Varian, Kode TP, Tujuan Pembelajaran, Lingkup Materi
   - Nilai: Tahun Ajaran, Semester, Jenis, ID Siswa, Kode Mapel, Kode, Nilai
   Kolom hilang/berganti nama → ⚠️ "Pantau Belajar dan Rekap perlu diuji ulang".
4. **Rekap.** Baris `Dibuat Pada` di Ringkasan spreadsheet "Rekap Kepala Sekolah SD N Bugangin" tidak lebih tua dari 3 hari (hari sekolah); baris `GAGAL: ...` → ⚠️.

## Laporan
- Semua aman: "✅ Pemeliharaan mingguan: semua aman (versi, kode, kolom rapor, rekap)."
- Ada temuan: ⚠️ per temuan + "Perlu keputusan: perbaiki lewat sesi Claude biasa?" Petugas tidak memperbaiki apa pun.
