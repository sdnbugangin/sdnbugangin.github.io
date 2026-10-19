/**
 * Aplikasi Rapor SD (Kurikulum Merdeka) — backend Google Apps Script.
 * Melayani halaman sdnbugangin.github.io/rapor/ untuk semua sekolah yang mendaftar.
 *
 * Proyek Apps Script ini berisi berkas: Kode.gs, Akun.gs, Sekolah.gs, Data.gs, Tp.gs, Nilai.gs, Hitung.gs, Referensi.gs, Narasi.gs.
 *
 * Cara pasang (sekali saja, dengan akun Google PENGELOLA, bukan akun pribadi):
 * 1. Buat Google Sheet baru, beri nama "Rapor SD - Pusat".
 * 2. Menu Ekstensi → Apps Script. Buat kesembilan berkas di atas (tombol + → Skrip) dan tempel isinya.
 * 3. Pilih fungsi "siapkan" di toolbar, klik Jalankan, lalu izinkan akses.
 * 4. Deploy → Deployment baru → Jenis: Aplikasi web.
 *    Jalankan sebagai: Saya. Yang memiliki akses: Siapa saja. Klik Deploy.
 * 5. Salin URL Aplikasi web (berakhiran /exec), tempel ke API_URL di rapor/index.html.
 *
 * Memperbarui kode: tempel kode baru, simpan, jalankan "siapkan" sekali,
 * lalu Deploy → Kelola deployment → ikon pensil → Versi: Versi baru → Deploy. URL tetap sama.
 *
 * Setiap sekolah punya SATU akun (email sekolah + kata sandi khusus aplikasi ini) yang dipakai
 * bersama oleh semua gurunya.
 *
 * Semua hasil aplikasi berada di SATU folder utama di Drive akun pengelola (dibuat oleh "siapkan"):
 *   Rapor SD/
 *     Rapor SD - Pusat        ← spreadsheet ini (otomatis dipindahkan ke sini)
 *     Data Sekolah/           ← satu spreadsheet per sekolah, dibuat otomatis
 * Folder untuk hasil lain (mis. PDF rapor) kelak juga dibuat di dalam folder utama.
 */

var FOLDER_UTAMA = 'Rapor SD';
var SUBFOLDER = { dataSekolah: 'Data Sekolah' };

var PUSAT = {
  sekolah: 'Sekolah',
  token: 'Token',
  atur: 'Pengaturan',
  log: 'Log'
};

var KOLOM_SEKOLAH = ['NPSN', 'Nama Sekolah', 'Email', 'Hash Sandi', 'Garam', 'Status', 'ID Spreadsheet',
  'Terdaftar Pada', 'Diverifikasi Pada', 'Masuk Terakhir', 'Gagal Masuk', 'Terkunci Sampai'];
var KOLOM_TOKEN = ['Hash Token', 'NPSN', 'Jenis', 'Kedaluwarsa', 'Dipakai Pada'];
var KOLOM_LOG_PUSAT = ['Waktu', 'NPSN', 'Aksi', 'Rincian'];

/* ---------- penyiapan ---------- */

function siapkan() {
  var ss = SpreadsheetApp.getActive();
  var sekolah = buatSheet_(ss, PUSAT.sekolah, KOLOM_SEKOLAH);
  sekolah.getRange(2, 1, sekolah.getMaxRows() - 1, 1).setNumberFormat('@'); // NPSN tetap teks
  buatSheet_(ss, PUSAT.token, KOLOM_TOKEN);
  buatSheet_(ss, PUSAT.log, KOLOM_LOG_PUSAT);
  var atur = buatSheet_(ss, PUSAT.atur, ['Kunci', 'Nilai', 'Keterangan']);
  var bawaan = [
    ['Alamat Halaman', 'https://sdnbugangin.github.io/rapor/', 'Alamat halaman aplikasi. Dipakai untuk tautan di email verifikasi dan lupa kata sandi.'],
    ['Nama Aplikasi', 'Rapor SD', 'Nama yang tampil di email.'],
    ['Folder Utama', '', 'ID folder "' + FOLDER_UTAMA + '" di Google Drive. Semua hasil aplikasi ada di dalamnya. Diisi otomatis.'],
    ['Folder Data Sekolah', '', 'ID subfolder tempat spreadsheet sekolah disimpan. Diisi otomatis.'],
    ['Pendaftaran Dibuka', 'Ya', 'Tidak = sekolah baru tidak bisa mendaftar (sekolah terdaftar tetap bisa masuk).'],
    ['NPSN Sumber TP Bawaan', '', 'NPSN sekolah yang TP-nya dipakai sebagai TP bawaan: disalin ke sekolah baru dan bisa diambil sekolah lain lewat tombol "Pakai TP bawaan".']
  ];
  var ada = atur.getDataRange().getValues().map(function (r) { return r[0]; });
  bawaan.forEach(function (b) { if (ada.indexOf(b[0]) < 0) atur.appendRow(b); });
  var utama = folderUtama_();
  DriveApp.getFileById(ss.getId()).moveTo(utama); // spreadsheet Pusat ikut masuk folder utama
  folderBagian_('Folder Data Sekolah', SUBFOLDER.dataSekolah);
  var awal = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1');
  if (awal && ss.getSheets().length > 1 && awal.getLastRow() === 0) ss.deleteSheet(awal);
  MailApp.getRemainingDailyQuota(); // memicu izin kirim email
}

function buatSheet_(ss, nama, kolom) {
  var sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
  if (sh.getLastRow() === 0) {
    sh.appendRow(kolom);
    sh.getRange(1, 1, 1, kolom.length).setFontWeight('bold').setBackground('#12314f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  } else {
    var judul = sh.getDataRange().getValues()[0].filter(function (x) { return x !== ''; });
    if (judul.length < kolom.length) {
      sh.getRange(1, 1, 1, kolom.length).setValues([kolom]).setFontWeight('bold').setBackground('#12314f').setFontColor('#ffffff');
    }
  }
  return sh;
}

function pusat_() { return SpreadsheetApp.getActive(); }

function pengaturanPusat_() {
  var nilai = {};
  var sh = pusat_().getSheetByName(PUSAT.atur);
  if (sh) sh.getDataRange().getValues().forEach(function (r) { nilai[String(r[0]).trim()] = String(r[1]).trim(); });
  var alamat = nilai['Alamat Halaman'] || 'https://sdnbugangin.github.io/rapor/';
  return {
    alamat: alamat.charAt(alamat.length - 1) === '/' ? alamat : alamat + '/',
    namaAplikasi: nilai['Nama Aplikasi'] || 'Rapor SD',
    daftarDibuka: String(nilai['Pendaftaran Dibuka'] || 'Ya').toLowerCase() !== 'tidak',
    sumberTp: String(nilai['NPSN Sumber TP Bawaan'] || '').trim().toUpperCase()
  };
}

/* ---------- folder Drive ---------- */

/** Folder dari ID yang tersimpan, atau null jika kosong, terhapus, atau tidak bisa dibuka. */
function bukaFolder_(id) {
  if (!id) return null;
  try {
    var f = DriveApp.getFolderById(id);
    return f.isTrashed() ? null : f;
  } catch (e) {
    return null;
  }
}

function idPengaturan_(kunci) {
  var sh = pusat_().getSheetByName(PUSAT.atur);
  var rows = sh ? sh.getDataRange().getValues() : [];
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === kunci) return String(rows[i][1]).trim();
  return '';
}

/** Folder utama "Rapor SD". Dibuat ulang jika hilang atau terhapus. */
function folderUtama_() {
  var f = bukaFolder_(idPengaturan_('Folder Utama'));
  if (f) return f;
  f = DriveApp.createFolder(FOLDER_UTAMA);
  tulisPengaturanPusat_('Folder Utama', f.getId());
  return f;
}

/**
 * Subfolder di dalam folder utama. Folder lama yang tersimpan (mis. dari versi sebelumnya yang
 * dibuat di luar folder utama) dipindahkan ke dalam folder utama; jika hilang, dibuat baru di dalamnya.
 */
function folderBagian_(kunci, nama) {
  var utama = folderUtama_();
  var f = bukaFolder_(idPengaturan_(kunci));
  if (f) {
    f.moveTo(utama);
    return f;
  }
  f = utama.createFolder(nama);
  tulisPengaturanPusat_(kunci, f.getId());
  return f;
}

function tulisPengaturanPusat_(kunci, nilai) {
  var sh = pusat_().getSheetByName(PUSAT.atur);
  var rows = sh.getDataRange().getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === kunci) { sh.getRange(i + 1, 2).setValue(nilai); return; }
  }
  sh.appendRow([kunci, nilai, '']);
}

/* ---------- web app ---------- */

function doGet() {
  return json_({ ok: true, pesan: 'Layanan Aplikasi Rapor SD aktif.' });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, pesan: 'Permintaan tidak valid.' }); }
  if (!req || typeof req !== 'object') return json_({ ok: false, pesan: 'Permintaan tidak valid.' });
  return json_(layani_(req));
}

/** Memproses satu permintaan. Dipisah dari doPost agar bisa diuji tanpa ContentService. */
function layani_(req) {
  try {
    switch (req.aksi) {
      case 'daftar': return daftar_(req.data || {});
      case 'verifikasi': return verifikasi_(req.token);
      case 'masuk': return masuk_(req.email, req.sandi);
      case 'lupaSandi': return lupaSandi_(req.email);
      case 'resetSandi': return resetSandi_(req.token, req.sandi, req.ulangi);
    }
    var sesi = bacaSesi_(req.sesi);
    if (!sesi) return { ok: false, sesiHabis: true, pesan: 'Sesi berakhir. Silakan masuk lagi.' };
    switch (req.aksi) {
      case 'sesi': return { ok: true, sekolah: ringkasSekolah_(sesi.npsn) };
      case 'keluar': return keluar_(req.sesi);
      case 'gantiSandi': return gantiSandi_(sesi.npsn, req.lama, req.baru, req.ulangi);
      case 'dataSekolah': return dataSekolah_(sesi.npsn);
      case 'simpanProfil': return simpanProfil_(sesi.npsn, req.profil || {}, req.semester, req.seni);
      case 'simpanRombel': return simpanRombel_(sesi.npsn, req.rombel || {});
      case 'hapusRombel': return hapusRombel_(sesi.npsn, req.id);
      case 'siswaRombel': return siswaRombel_(sesi.npsn, req.rombel);
      case 'simpanSiswa': return simpanSiswa_(sesi.npsn, req.rombel, req.siswa, req.jumlah);
      case 'mapelSekolah': return mapelSekolah_(sesi.npsn);
      case 'simpanMapel': return simpanMapel_(sesi.npsn, req.mapel);
      case 'unduhExcel': return unduhExcel_(sesi.npsn);
      case 'tpKelas': return tpKelas_(sesi.npsn, req.kelas, req.semester);
      case 'simpanTp': return simpanTp_(sesi.npsn, req);
      case 'tpBawaan': return tpBawaan_(sesi.npsn, req.kelas, req.semester, req.mapel, req.varian);
      case 'tpEkspor': return tpEkspor_(sesi.npsn, req.kelas);
      case 'nilaiRombel': return nilaiRombel_(sesi.npsn, req);
      case 'simpanNilai': return simpanNilai_(sesi.npsn, req);
      default: return { ok: false, pesan: 'Aksi tidak dikenal.' };
    }
  } catch (err) {
    if (err.untukPengguna) return { ok: false, pesan: err.message };
    try { catatPusat_('', 'galat', String(req.aksi) + ': ' + err.message); } catch (e2) { /* log pun gagal: abaikan */ }
    return { ok: false, pesan: 'Terjadi kesalahan di server. Coba lagi beberapa saat lagi.' };
  }
}

/** Kesalahan yang pesannya aman dan berguna untuk ditampilkan apa adanya kepada pengguna. */
function galatPengguna_(pesan) {
  var e = new Error(pesan);
  e.untukPengguna = true;
  return e;
}

function denganKunci_(fn) {
  var kunci = LockService.getScriptLock();
  if (!kunci.tryLock(20000)) throw galatPengguna_('Server sedang sibuk melayani sekolah lain. Coba lagi sebentar lagi.');
  try { return fn(); } finally { kunci.releaseLock(); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function catatPusat_(npsn, aksi, rincian) {
  var sh = pusat_().getSheetByName(PUSAT.log);
  if (sh) sh.appendRow([new Date(), npsn || '', aksi, String(rincian || '').slice(0, 500)]);
}
