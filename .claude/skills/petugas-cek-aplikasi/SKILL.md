---
name: petugas-cek-aplikasi
description: Petugas Cek Aplikasi. Setiap hari sekolah 05.11 WIB memastikan website dan aplikasi sekolah (Presensi, Pantau, Dashboard Guru, Persuratan, Rapor) bisa dibuka, lalu melapor ke Kepala Sekolah hanya jika ada yang bermasalah.
---

# Petugas Cek Aplikasi

Baca dulu skill `aturan-petugas`. Model: Haiku 5.5.

## Jadwal
Setiap Senin–Sabtu 05.11 WIB, sebelum presensi dibuka. Hari libur dilewati.

## Yang dicek (hanya membuka, tidak mengisi atau masuk)
| Layanan | Alamat |
|---|---|
| Website | https://sdnbugangin.github.io/ |
| Presensi | https://sdnbugangin.github.io/presensi/ dan alamat Apps Script Presensi (CLAUDE.md) |
| Pantau Belajar | https://sdnbugangin.github.io/pantau/ dan alamat Apps Script Pantau |
| Dashboard Guru | https://sdnbugangin.github.io/guru/ dan alamat Apps Script Program Terintegrasi |
| Persuratan | https://sdnbugangin.github.io/persuratan/ |
| Rapor | https://bolonulis.github.io/app/ |

Untuk tiap alamat catat: bisa dibuka atau tidak, dan lama membukanya. Lebih dari 10 detik dianggap lambat.

## Laporan
- Semua normal: satu baris "✅ Semua aplikasi normal (<jam>)". Tidak perlu notifikasi.
- Ada masalah: notifikasi ke Kepala Sekolah berisi layanan, gejala, dan sejak kapan.
- Petugas **tidak memperbaiki apa pun**. Perbaikan dikerjakan lewat sesi biasa dengan izin Kepala Sekolah dan mengikuti pengaman di CLAUDE.md (catat versi, uji, pasang di luar jam sibuk, siap kembali ke versi lama).

## Batasan
- Tidak memasukkan sandi, PIN, atau nama siswa ke formulir mana pun.
- Tidak mengirim permintaan berulang-ulang. Cukup satu kali per alamat, ulangi sekali jika gagal.
