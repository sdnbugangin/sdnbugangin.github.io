/**
 * Aplikasi Rapor SD — pembuatan spreadsheet sekolah.
 *
 * Setiap sekolah yang akunnya aktif mendapat satu spreadsheet berisi data kelas 1–6.
 * Data disimpan sebagai tabel panjang (satu baris per data), sehingga tidak ada batas jumlah TP,
 * siswa, atau rombel, dan tidak ada rumus yang bisa rusak.
 */

var VERSI_STRUKTUR = 1;

var STRUKTUR_SEKOLAH = [
  { nama: 'Profil Sekolah', kolom: ['Kunci', 'Nilai', 'Keterangan'], teks: ['Nilai'] },
  { nama: 'Pengaturan', kolom: ['Kunci', 'Nilai', 'Keterangan'], teks: ['Nilai'] },
  { nama: 'KKTP', kolom: ['Batas Bawah', 'Predikat', 'Kalimat Deskripsi'] },
  { nama: 'Rombel', kolom: ['ID Rombel', 'Tahun Ajaran', 'Kelas', 'Nama Rombel', 'Wali Kelas', 'NIP Wali Kelas'],
    teks: ['ID Rombel', 'Tahun Ajaran', 'NIP Wali Kelas'] },
  { nama: 'Siswa', kolom: ['ID Siswa', 'NIS', 'NISN', 'Nama Lengkap', 'Nama Panggilan', 'Jenis Kelamin', 'Agama',
    'Tempat Lahir', 'Tanggal Lahir', 'Nama Ayah', 'Nama Ibu', 'Nama Wali', 'Alamat', 'Status', 'Keterangan Status'],
    teks: ['ID Siswa', 'NIS', 'NISN', 'Tanggal Lahir'] },
  { nama: 'Anggota Rombel', kolom: ['Tahun Ajaran', 'ID Rombel', 'ID Siswa', 'No Urut', 'Seni Pilihan'], teks: ['Tahun Ajaran', 'ID Rombel', 'ID Siswa'] },
  { nama: 'Mapel Aktif', kolom: ['Tahun Ajaran', 'Kelas', 'Kode Mapel', 'Nama di Rapor', 'Jenis', 'Urutan', 'Aktif'], teks: ['Tahun Ajaran'] },
  { nama: 'Tujuan Pembelajaran', kolom: ['Tahun Ajaran', 'Semester', 'Kelas', 'Kode Mapel', 'Varian', 'Kode TP',
    'Lingkup Materi', 'Tujuan Pembelajaran'], teks: ['Tahun Ajaran', 'Kode TP'] },
  { nama: 'Nilai', kolom: ['Tahun Ajaran', 'Semester', 'ID Siswa', 'Kode Mapel', 'Jenis', 'Kode', 'Nilai', 'Diubah Pada'],
    teks: ['Tahun Ajaran', 'ID Siswa', 'Kode'] },
  { nama: 'Kokurikuler', kolom: ['Tahun Ajaran', 'Semester', 'Kelas', 'No', 'Dimensi', 'Subdimensi'], teks: ['Tahun Ajaran'] },
  { nama: 'Capaian Kokurikuler', kolom: ['Tahun Ajaran', 'Semester', 'ID Siswa', 'No', 'Level'], teks: ['Tahun Ajaran', 'ID Siswa'] },
  { nama: 'Master Narasi', kolom: ['Subdimensi', 'Level', 'Narasi'] },
  { nama: 'Ekstrakurikuler', kolom: ['Tahun Ajaran', 'Semester', 'ID Siswa', 'Kegiatan', 'Predikat', 'Keterangan'], teks: ['Tahun Ajaran', 'ID Siswa'] },
  { nama: 'Presensi & Catatan', kolom: ['Tahun Ajaran', 'Semester', 'ID Siswa', 'Sakit', 'Izin', 'Tanpa Keterangan',
    'Catatan Wali Kelas', 'Tanggapan Orang Tua'], teks: ['Tahun Ajaran', 'ID Siswa'] },
  { nama: 'Kenaikan', kolom: ['Tahun Ajaran', 'ID Siswa', 'Keputusan'], teks: ['Tahun Ajaran', 'ID Siswa'] },
  { nama: 'Log', kolom: ['Waktu', 'Aksi', 'Rincian'] }
];

/* teks: kolom yang wajib berformat teks biasa (lihat isiSpreadsheetSekolah_). */

/**
 * Tahun ajaran dan semester yang berjalan pada tanggal tertentu.
 * Juli–Desember → semester 1 (ganjil) tahun ajaran T/T+1; Januari–Juni → semester 2 (genap) tahun ajaran T-1/T.
 */
function tahunAjaran_(tanggal) {
  var d = tanggal ? new Date(tanggal) : new Date();
  var t = d.getFullYear();
  return d.getMonth() >= 6 ? { tahunAjaran: t + '/' + (t + 1), semester: 1 }
    : { tahunAjaran: (t - 1) + '/' + t, semester: 2 };
}

/**
 * Membuat spreadsheet sekolah di folder "Rapor SD/Data Sekolah". Hasil: ID spreadsheet.
 * Spreadsheet baru selalu muncul dulu di akar Drive, jadi langsung dipindahkan. Jika gagal dipindah
 * atau diisi, spreadsheet dibuang agar tidak ada berkas berserakan di Drive.
 */
function buatSpreadsheetSekolah_(d) {
  var folder = folderBagian_('Folder Data Sekolah', SUBFOLDER.dataSekolah);
  var ss = SpreadsheetApp.create('Rapor - ' + d.nama + ' (' + d.npsn + ')');
  var berkas = DriveApp.getFileById(ss.getId());
  try {
    berkas.moveTo(folder);
    isiSpreadsheetSekolah_(ss, d, new Date());
  } catch (e) {
    berkas.setTrashed(true);
    throw e;
  }
  return ss.getId();
}

/** Mengisi spreadsheet kosong dengan semua sheet dan data bawaan. */
function isiSpreadsheetSekolah_(ss, d, tanggal) {
  var ta = tahunAjaran_(tanggal);
  var awal = ss.getSheets()[0];
  STRUKTUR_SEKOLAH.forEach(function (st, i) {
    var sh = i === 0 ? awal.setName(st.nama) : ss.insertSheet(st.nama);
    sh.getRange(1, 1, 1, st.kolom.length).setValues([st.kolom])
      .setFontWeight('bold').setBackground('#12314f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    formatTeks_(sh, st, 2);
  });

  tulisBaris_(ss, 'Profil Sekolah', [
    ['Nama Sekolah', d.nama, 'Seperti tertulis di rapor.'],
    ['NPSN', d.npsn, ''],
    ['NSS', '', ''],
    ['Nama Instansi', '', 'Misalnya: DINAS PENDIDIKAN DAN KEBUDAYAAN KABUPATEN ...'],
    ['Alamat', '', 'Jalan dan nomor.'],
    ['Desa/Kelurahan', '', ''],
    ['Kecamatan', '', ''],
    ['Kabupaten/Kota', '', ''],
    ['Provinsi', '', ''],
    ['Kode Pos', '', ''],
    ['Telepon', '', ''],
    ['Email', d.email, 'Email akun sekolah di aplikasi rapor.'],
    ['Kepala Sekolah', '', 'Nama lengkap dengan gelar.'],
    ['NIP Kepala Sekolah', '', 'Kosongkan jika tidak ada.'],
    ['Tempat Pembagian Rapor', '', 'Misalnya: Kendal'],
    ['Tanggal Pembagian Rapor', '', '']
  ]);

  tulisBaris_(ss, 'Pengaturan', [
    ['Tahun Ajaran', ta.tahunAjaran, 'Tahun ajaran yang sedang diisi.'],
    ['Semester', ta.semester, '1 = ganjil (tanpa keterangan naik/lulus), 2 = genap.'],
    ['Bobot Lingkup Materi', BOBOT_BAWAAN.lingkup, 'Persen. Jumlah dengan bobot akhir semester harus 100.'],
    ['Bobot Akhir Semester', BOBOT_BAWAAN.akhir, 'Persen.'],
    ['Mode Deskripsi', DESKRIPSI_BAWAAN.mode, 'tetap = kalimat tertinggi/terendah di bawah; predikat = kalimat sesuai KKTP nilai TP.'],
    ['Kalimat Capaian Tertinggi', DESKRIPSI_BAWAAN.kalimatTinggi, ''],
    ['Kalimat Capaian Terendah', DESKRIPSI_BAWAAN.kalimatRendah, ''],
    ['Pakai Nama Panggilan', DESKRIPSI_BAWAAN.pakaiPanggilan ? 'Ya' : 'Tidak', 'Ya = deskripsi diawali "Ananda <nama panggilan>".'],
    ['Seni Ditawarkan', PILIHAN_SENI.join(', '), 'Seni yang diajarkan di sekolah, dipisah koma.'],
    ['Versi Struktur', VERSI_STRUKTUR, 'Jangan diubah.']
  ]);

  tulisBaris_(ss, 'KKTP', KKTP_BAWAAN.map(function (b) { return [b.min, b.predikat, b.kalimat]; }));

  var mapel = [];
  for (var k = 1; k <= 6; k++) {
    MAPEL_BAWAAN.forEach(function (m, urut) {
      if (m.kelas.indexOf(k) < 0) return;
      mapel.push([ta.tahunAjaran, k, m.kode, m.nama, m.jenis, urut + 1, m.aktifBawaan.indexOf(k) >= 0 ? 'Ya' : 'Tidak']);
    });
  }
  tulisBaris_(ss, 'Mapel Aktif', mapel);

  tulisBaris_(ss, 'Master Narasi', NARASI_BAWAAN);
  tulisBaris_(ss, 'Log', [[tanggal || new Date(), 'dibuat', 'Spreadsheet sekolah dibuat otomatis saat akun diaktifkan.']]);
}

/**
 * Kolom identitas disimpan sebagai teks: NISN "0012345678" tidak boleh berubah jadi angka 12345678.
 * Berlaku dari baris dariBaris sampai baris terakhir sheet.
 */
function formatTeks_(sh, st, dariBaris) {
  var banyak = sh.getMaxRows() - dariBaris + 1;
  if (banyak < 1) return;
  (st.teks || []).forEach(function (nama) {
    sh.getRange(dariBaris, st.kolom.indexOf(nama) + 1, banyak, 1).setNumberFormat('@');
  });
}

function strukturSheet_(nama) {
  for (var i = 0; i < STRUKTUR_SEKOLAH.length; i++) if (STRUKTUR_SEKOLAH[i].nama === nama) return STRUKTUR_SEKOLAH[i];
  throw new Error('Struktur sheet tidak dikenal: ' + nama);
}

function tulisBaris_(ss, nama, baris) {
  if (!baris.length) return;
  ss.getSheetByName(nama).getRange(2, 1, baris.length, baris[0].length).setValues(baris);
}
