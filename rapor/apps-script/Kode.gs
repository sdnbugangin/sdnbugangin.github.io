/**
 * Aplikasi Rapor SD (Kurikulum Merdeka) — backend Google Apps Script.
 * Melayani halaman sdnbugangin.github.io/rapor/ untuk semua sekolah yang mendaftar.
 *
 * Proyek Apps Script ini berisi berkas: Kode.gs, Akun.gs, Sekolah.gs, Hitung.gs, Referensi.gs, Narasi.gs.
 *
 * Cara pasang (sekali saja, dengan akun Google PENGELOLA, bukan akun pribadi):
 * 1. Buat Google Sheet baru, beri nama "Rapor SD - Pusat".
 * 2. Menu Ekstensi → Apps Script. Buat keenam berkas di atas (tombol + → Skrip) dan tempel isinya.
 * 3. Pilih fungsi "siapkan" di toolbar, klik Jalankan, lalu izinkan akses.
 * 4. Deploy → Deployment baru → Jenis: Aplikasi web.
 *    Jalankan sebagai: Saya. Yang memiliki akses: Siapa saja. Klik Deploy.
 * 5. Salin URL Aplikasi web (berakhiran /exec), tempel ke API_URL di rapor/index.html.
 *
 * Memperbarui kode: tempel kode baru, simpan, jalankan "siapkan" sekali,
 * lalu Deploy → Kelola deployment → ikon pensil → Versi: Versi baru → Deploy. URL tetap sama.
 *
 * Setiap sekolah punya SATU akun (email sekolah + kata sandi khusus aplikasi ini) yang dipakai
 * bersama oleh semua gurunya. Spreadsheet setiap sekolah dibuat otomatis di Drive akun pengelola,
 * di folder "Rapor SD - Data Sekolah".
 */

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
    ['Folder Data Sekolah', '', 'ID folder Google Drive tempat spreadsheet sekolah disimpan. Diisi otomatis oleh "siapkan".'],
    ['Pendaftaran Dibuka', 'Ya', 'Tidak = sekolah baru tidak bisa mendaftar (sekolah terdaftar tetap bisa masuk).']
  ];
  var ada = atur.getDataRange().getValues().map(function (r) { return r[0]; });
  bawaan.forEach(function (b) { if (ada.indexOf(b[0]) < 0) atur.appendRow(b); });
  if (!pengaturanPusat_().folder) {
    var folder = DriveApp.createFolder('Rapor SD - Data Sekolah');
    tulisPengaturanPusat_('Folder Data Sekolah', folder.getId());
  }
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
    folder: nilai['Folder Data Sekolah'] || '',
    daftarDibuka: String(nilai['Pendaftaran Dibuka'] || 'Ya').toLowerCase() !== 'tidak'
  };
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
