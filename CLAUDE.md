# Website SD N Bugangin

Situs statis GitHub Pages. Layanan yang butuh data berjalan sebagai aplikasi Google Apps Script (web app) milik akun sekolah, dan website hanya menautkan atau memanggilnya. Pemilik: Kepala Sekolah. Komunikasi dalam bahasa Indonesia yang sederhana; banyak guru pengguna sudah berumur.

## Proyek Apps Script

| Aplikasi | Script ID | Deployment ID (bagian alamat `/macros/s/…/exec`) | Data |
|---|---|---|---|
| Presensi Digital | `1YSGZGQn0fMHCXY8DRWa8EudCHbclZcBx6-gKiYEC_muEv-5L2cE1ZN3L` | `AKfycbwlW-dmXA93oPWO03GVUhirEt2Smu1dPzhRoST4xQwlpSiNKVZRamVwp1M5enwfXu1N` | spreadsheet Database_Presensi_SDN_Bugangin (terikat) |
| Super Admin (bantuan, prestasi, kabar) | `1y7MANEjhRxo58zEOe_InzrfFQIp55pQKVHhuToNBddbUjhtMYylpKGAu` | `AKfycbyE3fM1cmCXeMsdoygOAP92MIKSngirrd3pOd2U1t4Nr63wAO3lOfEjUyCPBUA7PTor` | spreadsheet Database Bantuan Siswa (terikat); salinan kode di `super-admin/apps-script/Kode.gs` |
| Persuratan | `15Mpx2pij8a_ICLDbyJVuaFwtLc6ga-QOre8WSePZCplAGYLhvRbRAb2D` (proyek lama `1zRk7Jfn…` tidak dipakai, tidak punya deployment) | `AKfycbzYhvR7D-rcUx64s0navcLL4JZBtZ6e_PgQ1zEQSKcVDqqtWL9Z7hrASOd26_WRqchX` | spreadsheet dibuat oleh `setupAwal()` |
| Update Nomor WA | `1UPX-pcnR8qEpkcUI0EqBqcRh1Bju3D_n5z8bp09h2UPZDWE5RlW69Kng` | `AKfycbxYn87T_TmCMIT30VdE7M_zNERwLIxMin_ILewdt2OT4_z4fu9MviA5mQmTmJ3szYHD` | — |

## Mengubah kode Apps Script lewat clasp

Kredensial clasp ada di variabel lingkungan `CLASPRC_JSON` (isi `~/.clasprc.json`).

- Tulis ke berkas tanpa menampilkannya: `printf '%s' "$CLASPRC_JSON" > ~/.clasprc.json && chmod 600 ~/.clasprc.json`. Jangan pernah mencetak, mencatat, atau meng-commit isinya.
- Kerjakan di direktori scratchpad, bukan di repo ini (repo publik): `clasp clone <Script ID>`, lalu selalu `clasp pull` dulu supaya perubahan yang dibuat langsung di editor tidak tertimpa.
- Uji perubahan sebelum `clasp push`.
- Pasang dengan memperbarui deployment yang sudah ada (cek `clasp --help` untuk nama perintahnya, misalnya `clasp update-deployment <Deployment ID>`). Jangan membuat deployment baru, karena alamatnya berubah dan tautan di website serta grup WA orang tua jadi putus.
- Minta persetujuan Kepala Sekolah sebelum `push` dan sebelum memasang versi baru; aplikasi dipakai guru dan orang tua setiap hari.

## Aturan data

- Data bantuan (PIP, BAZNAS, yatim piatu) dan pelanggaran hanya untuk guru. Halaman publik tidak boleh menampilkan nama siswa; jumlah di bawah 3 disamarkan.
- Nomor WA orang tua dan data siswa adalah data pribadi anak (UU No. 27/2022): jangan disalin ke repo.
