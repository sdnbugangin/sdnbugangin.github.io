---
name: petugas-rekap-kepsek
description: Petugas Rekap Kepala Sekolah. Setiap Rabu dan Jumat 04.00 WIB membaca rekap dari Apps Script sekolah lalu menulis laporan lima hal (jurnal guru, kehadiran siswa, kemajuan nilai rapor, ketuntasan, pelanggaran) khusus untuk Kepala Sekolah.
---

# Petugas Rekap Kepala Sekolah

Baca dulu skill `aturan-petugas`. Model: Haiku 5.5 (naik ke Sonnet 5.5 hanya atas permintaan Kepala Sekolah).

## Jadwal
- **Rabu 04.00 WIB, Peringatan Dini**: data Senin–Selasa minggu berjalan.
- **Jumat 04.00 WIB, Rekap Minggu**: data Senin–Kamis minggu berjalan (Jumat masuk laporan Rabu berikutnya).

## Sumber data (hanya dibaca)
Langkah petugas setiap kali bekerja:
1. Minta Program Terintegrasi menyusun ulang rekap: kirim POST JSON `{"aksi":"rekapKepsekBuat"}` ke alamat web app Program Terintegrasi (Deployment ID di CLAUDE.md, `https://script.google.com/macros/s/<ID>/exec`). Jawabannya hanya `ok` dan jam, **tanpa isi rekap**.
2. Baca spreadsheet privat **"Rekap Kepala Sekolah SD N Bugangin"** lewat sambungan Google Sheets milik Kepala Sekolah (cari berdasarkan judul di Google Drive). Sheet: `Ringkasan`, `Perhatian`, `Angka`.
3. Jika baris `Dibuat Pada` di Ringkasan lebih tua dari 2 jam, atau ada baris `GAGAL: ...`, sebutkan di laporan.

Petugas **tidak membuka spreadsheet sumber** (Program Terintegrasi, Presensi, rapor) secara langsung. Isi rekap:

| No | Hal | Asal data |
|---|---|---|
| 1 | Jurnal guru | sheet Jadwal + Jurnal (Program Terintegrasi) |
| 2 | Kehadiran siswa | Log Presensi (Presensi Digital) |
| 3 | Kemajuan nilai rapor | Nilai + Tujuan Pembelajaran (spreadsheet rapor sekolah) |
| 4 | Ketuntasan | Nilai rapor, batas tuntas 70 |
| 5 | Pelanggaran | Log Pelanggaran (Presensi Digital) |

## Tanda ⚠️ (dihitung Apps Script, petugas tidak mengubah batasnya)
1. Guru belum mengisi jurnal untuk 2 hari mengajar atau lebih.
2. Siswa tidak hadir (Sakit/Izin/Tanpa Keterangan) 3 hari atau lebih dalam 2 minggu, atau Tanpa Keterangan 2 hari berturut-turut. Kelas yang presensinya belum diisi guru juga ditandai.
3. TP yang sudah dinilai di suatu kelas & mapel kurang dari 50% padahal rapor tinggal 4 minggu atau kurang.
4. Siswa belum tuntas di 3 mapel atau lebih, atau ketuntasan satu kelas pada satu mapel di bawah 60%.
5. Siswa tercatat 2 pelanggaran atau lebih dalam 2 minggu, atau ada pelanggaran tingkat Berat.

Batas ini diubah hanya oleh Kepala Sekolah: tambahkan baris di sheet Pengaturan Dashboard dengan kunci `Rekap Jurnal Hari Belum`, `Rekap Absen Hari`, `Rekap Alpa Berturut`, `Rekap Nilai Persen`, `Rekap Nilai Minggu`, `Rekap Mapel Belum Tuntas`, `Rekap Tuntas Kelas Persen`, `Rekap Pelanggaran`, atau `Batas Tuntas`. "Akhir semester" diambil dari sheet Kalender Pendidikan.

## Bentuk laporan
```
REKAP KEPALA SEKOLAH, Rabu/Jumat, <tanggal> (data <rentang tanggal>)
Ringkasan: <satu kalimat>

⚠️ PERLU PERHATIAN
- <fakta, kelas, sumber>

🧭 PERLU KEPUTUSAN BAPAK/IBU
- <masalah> → pilihan: <a> / <b>

ANGKA
1. Jurnal guru: <% terisi>, <rincian per guru singkat>
2. Kehadiran: <% hadir per kelas>
3. Nilai rapor: <% TP dinilai per kelas>
4. Ketuntasan: <% tuntas per kelas>
5. Pelanggaran: <jumlah per kelas>
```
- Nama siswa hanya ditulis untuk yang bertanda ⚠️. Tanpa NISN, nomor WA, atau alamat.
- Jangan lebih dari satu layar HP untuk bagian Ringkasan sampai Perlu Keputusan.
- Bagian "Perlu Keputusan" berisi pilihan, bukan perintah. Petugas tidak menjalankan pilihan itu.

## Jika gagal
- Rekap tidak terbaca atau kosong: kirim laporan "Rekap gagal dibaca", sebutkan pesan kesalahannya, dan jangan mengarang angka.
- Rekap lebih tua dari 24 jam: beri peringatan "rekap belum diperbarui".
