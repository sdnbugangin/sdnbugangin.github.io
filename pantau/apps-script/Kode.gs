/**
 * Pantau Belajar Anak — SD N Bugangin.
 *
 * Orang tua masuk dengan NISN anak, lalu melihat ketuntasan setiap Tujuan Pembelajaran (TP)
 * dari nilai sumatif yang diisi guru di aplikasi Rapor Merdeka Digital (bolonulis.github.io).
 *
 * - Spreadsheet rapor sekolah HANYA DIBACA, tidak pernah ditulis.
 * - Sandi orang tua disimpan (di-hash) di spreadsheet milik aplikasi ini sendiri ("DB Pantau Belajar").
 * - Sandi awal semua siswa: SANDI_AWAL. Wajib diganti saat pertama masuk.
 * - 5 kali salah sandi → NISN dikunci 15 menit.
 * - Guru dapat mengatur ulang sandi ke sandi awal dengan PIN Guru (sheet Pengaturan).
 *
 * Pasang: jalankan setupAwal() sekali dari editor, lalu isi PIN Guru di sheet Pengaturan.
 * Web app: Jalankan sebagai Saya, akses Siapa saja.
 */

var RAPOR_SS_ID = '1CnMyQq9ToDt8t4wxlDn_o7XPPb5ewhSjQCzwomz0bKo'; // Rapor - SD NEGERI BUGANGIN (20321653), hanya dibaca
var SANDI_AWAL = 'muridsuper';
var MIN_SANDI = 4;
var MAKS_GAGAL = 5;
var MENIT_KUNCI = 15;
var JAM_SESI = 6;
var BATAS_TUNTAS_BAWAAN = 70;

var KOLOM_AKUN = ['NISN', 'Hash Sandi', 'Garam', 'Diubah Pada', 'Masuk Terakhir'];
var KOLOM_PENGATURAN = ['Kunci', 'Nilai', 'Keterangan'];
var KOLOM_LOG = ['Waktu', 'NISN', 'Aksi'];

/* =====================================================================
 * BAGIAN MURNI (tanpa layanan Google) — diuji di pantau/tes/
 * ===================================================================== */

function teks_(v) { return v === null || v === undefined ? '' : String(v).trim().replace(/\s+/g, ' '); }

/** NISN dirapikan: hanya angka. */
function rapikanNisn_(v) { return teks_(v).replace(/\D/g, ''); }

/** Angka nilai dari sel ("80,5" / 80.5 / '') → number atau null. */
function angka_(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  return isFinite(n) ? n : null;
}

/** Memeriksa sandi baru. Hasil: '' bila sah, atau pesan salah. */
function cekSandiBaru_(baru, ulangi) {
  baru = String(baru || '');
  if (baru.length < MIN_SANDI) return 'Sandi baru minimal ' + MIN_SANDI + ' karakter.';
  if (baru.length > 50) return 'Sandi baru terlalu panjang (maks. 50 karakter).';
  if (baru.toLowerCase() === SANDI_AWAL) return 'Sandi baru tidak boleh sama dengan sandi awal.';
  if (baru !== String(ulangi || '')) return 'Ulangi sandi baru tidak sama.';
  return '';
}

/** Status satu TP. */
function statusTp_(nilai, batas) {
  if (nilai === null) return 'belum';      // belum dinilai
  return nilai >= batas ? 'tuntas' : 'perbaikan';
}

var KALIMAT_APRESIASI = [
  '🌟 Hebat! Ananda {nama} sudah menuntaskan semua TP {mapel}. Terus semangat belajar dan pertahankan, ya!',
  '👏 Luar biasa! Semua TP {mapel} sudah tuntas. Terima kasih Ayah/Bunda telah mendampingi {nama} belajar di rumah.',
  '🏆 Selamat! {nama} tuntas di semua TP {mapel}. Usaha dan kesungguhannya patut dibanggakan. Ayo terus berprestasi!',
  '💪 Bagus sekali! {nama} sudah menguasai semua TP {mapel}. Beri pujian di rumah agar makin semangat belajar.'
];
var KALIMAT_SEJAUH_INI = '😊 Sejauh ini semua TP {mapel} yang sudah dinilai tuntas. Pertahankan semangat belajarnya, {nama}!';
var KALIMAT_PERBAIKAN = 'Ada {n} TP yang belum tuntas. Silakan menghubungi guru kelas{wali} untuk meminta jadwal ulangan perbaikan. ' +
  'Dampingi Ananda mengulang materinya di rumah, ya.';

function isiKalimat_(pola, isi) {
  return pola.replace(/\{(\w+)\}/g, function (_, k) { return isi[k] === undefined ? '' : String(isi[k]); });
}

/** Pilihan kalimat yang tetap untuk mapel yang sama (tidak berganti tiap dibuka). */
function pilihKalimat_(daftar, kunci) {
  var h = 0, s = String(kunci);
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003;
  return daftar[h % daftar.length];
}

/**
 * Ringkasan satu mapel untuk orang tua.
 * tp = [{ kode, tp, materi, nilai }]; tidak ada angka nilai di hasil.
 */
function ringkasMapel_(mapel, tp, batas, panggilan, wali) {
  var daftar = tp.map(function (t) {
    return { kode: t.kode, tp: t.tp, materi: t.materi || '', status: statusTp_(t.nilai, batas) };
  });
  var jumlah = { tuntas: 0, perbaikan: 0, belum: 0 };
  daftar.forEach(function (t) { jumlah[t.status]++; });
  var isi = { nama: panggilan || 'Ananda', mapel: mapel.nama, n: jumlah.perbaikan, wali: wali ? ' (' + wali + ')' : '' };
  var pesan = null;
  if (jumlah.perbaikan) pesan = { jenis: 'perbaikan', teks: isiKalimat_(KALIMAT_PERBAIKAN, isi) };
  else if (jumlah.tuntas && !jumlah.belum) pesan = { jenis: 'apresiasi', teks: isiKalimat_(pilihKalimat_(KALIMAT_APRESIASI, mapel.kode + mapel.nama), isi) };
  else if (jumlah.tuntas) pesan = { jenis: 'semangat', teks: isiKalimat_(KALIMAT_SEJAUH_INI, isi) };
  return { kode: mapel.kode, nama: mapel.nama, jumlah: jumlah, tp: daftar, pesan: pesan };
}

/** Varian mapel yang diikuti siswa: agama → [agamanya], seni → seni pilihannya, lainnya → ['']. */
function varianSiswa_(jenis, agama, seni) {
  if (jenis === 'agama') return agama ? [agama] : [];
  if (jenis === 'seni') return seni.length ? seni : [];
  return [''];
}

/**
 * Ketuntasan satu siswa dari tabel-tabel rapor (array objek berkunci judul kolom).
 * t = { pengaturan, rombel, siswa, anggota, mapelAktif, tp, nilai }
 * Hasil: { ok, pesan } atau { ok, siswa, semester, semesterAktif, mapel[] }.
 */
function hitungKetuntasan_(t, nisn, semesterDiminta, batas) {
  var atur = {};
  t.pengaturan.forEach(function (r) { atur[teks_(r.Kunci)] = r.Nilai; });
  var ta = teks_(atur['Tahun Ajaran']);
  var semAktif = Number(atur.Semester) === 2 ? 2 : 1;
  var sem = Number(semesterDiminta) === 1 || Number(semesterDiminta) === 2 ? Number(semesterDiminta) : semAktif;

  var s = null;
  t.siswa.forEach(function (r) { if (!s && rapikanNisn_(r.NISN) === nisn) s = r; });
  if (!s) return { ok: false, pesan: 'Data siswa tidak ditemukan.' };
  var idSiswa = teks_(s['ID Siswa']);
  var anggota = t.anggota.filter(function (a) { return teks_(a['Tahun Ajaran']) === ta && teks_(a['ID Siswa']) === idSiswa; })[0];
  if (!anggota) return { ok: false, pesan: 'Ananda belum terdaftar di kelas mana pun tahun ajaran ' + ta + '. Silakan hubungi wali kelas.' };
  var rombel = t.rombel.filter(function (r) { return teks_(r['ID Rombel']) === teks_(anggota['ID Rombel']) && teks_(r['Tahun Ajaran']) === ta; })[0];
  if (!rombel) return { ok: false, pesan: 'Data kelas Ananda belum lengkap. Silakan hubungi wali kelas.' };
  var kelas = Number(rombel.Kelas);
  var panggilan = teks_(s['Nama Panggilan']) || teks_(s['Nama Lengkap']).split(' ')[0];
  var wali = teks_(rombel['Wali Kelas']);
  var seni = teks_(anggota['Seni Pilihan']).split(',').map(teks_).filter(String);

  var nilaiSiswa = {};
  t.nilai.forEach(function (n) {
    if (teks_(n['ID Siswa']) !== idSiswa || teks_(n['Tahun Ajaran']) !== ta || Number(n.Semester) !== sem || teks_(n.Jenis) !== 'TP') return;
    nilaiSiswa[teks_(n['Kode Mapel']).toUpperCase() + '|' + teks_(n.Kode)] = angka_(n.Nilai);
  });

  var mapelKelas = t.mapelAktif
    .filter(function (r) { return teks_(r['Tahun Ajaran']) === ta && Number(r.Kelas) === kelas && teks_(r.Aktif) === 'Ya'; })
    .sort(function (a, b) { return (Number(a.Urutan) || 99) - (Number(b.Urutan) || 99); });

  var hasil = [];
  mapelKelas.forEach(function (m) {
    var kode = teks_(m['Kode Mapel']).toUpperCase(), jenis = teks_(m.Jenis);
    varianSiswa_(jenis, teks_(s.Agama), seni).forEach(function (varian) {
      var tp = t.tp.filter(function (r) {
        return teks_(r['Tahun Ajaran']) === ta && Number(r.Semester) === sem && Number(r.Kelas) === kelas &&
          teks_(r['Kode Mapel']).toUpperCase() === kode && teks_(r.Varian) === varian && teks_(r['Tujuan Pembelajaran']);
      }).map(function (r) {
        var k = teks_(r['Kode TP']);
        return { kode: k, tp: teks_(r['Tujuan Pembelajaran']), materi: teks_(r['Lingkup Materi']),
          nilai: nilaiSiswa.hasOwnProperty(kode + '|' + k) ? nilaiSiswa[kode + '|' + k] : null };
      });
      if (!tp.length) return;
      var nama = teks_(m['Nama di Rapor']) + (varian && jenis === 'seni' ? ' (' + varian + ')' : '');
      hasil.push(ringkasMapel_({ kode: kode + (varian ? '|' + varian : ''), nama: nama }, tp, batas, panggilan, wali));
    });
  });

  return {
    ok: true,
    siswa: { nama: teks_(s['Nama Lengkap']), panggilan: panggilan, kelas: teks_(rombel['Nama Rombel']) || String(kelas), wali: wali },
    tahunAjaran: ta, semester: sem, semesterAktif: semAktif, mapel: hasil
  };
}

/* =====================================================================
 * BAGIAN APPS SCRIPT
 * ===================================================================== */

function doGet() {
  return ContentService.createTextOutput('Layanan Pantau Belajar SD N Bugangin. Buka https://sdnbugangin.github.io/pantau/');
}

function doPost(e) {
  var hasil;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    hasil = layani_(req);
  } catch (err) {
    hasil = { ok: false, pesan: err && err.pengguna ? err.message : 'Terjadi gangguan. Coba lagi beberapa saat lagi.' };
    if (!(err && err.pengguna)) console.error(err && err.stack || err);
  }
  return ContentService.createTextOutput(JSON.stringify(hasil)).setMimeType(ContentService.MimeType.JSON);
}

function layani_(req) {
  switch (req.aksi) {
    case 'masuk': return masuk_(rapikanNisn_(req.nisn), String(req.sandi || ''));
    case 'gantiSandi': return gantiSandi_(req.sesi, req.lama, req.baru, req.ulangi);
    case 'ketuntasan': return ketuntasan_(req.sesi, req.semester);
    case 'keluar': CacheService.getScriptCache().remove('sesi:' + teks_(req.sesi)); return { ok: true };
    case 'guruReset': return guruReset_(String(req.pin || ''), rapikanNisn_(req.nisn));
    default: return { ok: false, pesan: 'Permintaan tidak dikenal.' };
  }
}

function galat_(pesan) { var e = new Error(pesan); e.pengguna = true; return e; }

/* ---------- spreadsheet ---------- */

function dbPantau_() {
  var id = PropertiesService.getScriptProperties().getProperty('DB_ID');
  if (!id) throw galat_('Aplikasi belum disiapkan. Hubungi sekolah.');
  return SpreadsheetApp.openById(id);
}

/** Tabel → array objek berkunci judul kolom (baris 1). */
function bacaTabel_(ss, nama) {
  var sh = ss.getSheetByName(nama);
  if (!sh) throw galat_('Data rapor sekolah belum lengkap (sheet "' + nama + '"). Hubungi sekolah.');
  var v = sh.getDataRange().getValues();
  var judul = (v[0] || []).map(teks_);
  return v.slice(1).map(function (r) {
    var o = {};
    judul.forEach(function (j, i) { if (j) o[j] = r[i] === undefined || r[i] === null ? '' : r[i]; });
    return o;
  });
}

function pengaturan_() {
  var hasil = {};
  bacaTabel_(dbPantau_(), 'Pengaturan').forEach(function (r) { hasil[teks_(r.Kunci)] = r.Nilai; });
  return hasil;
}

function batasTuntas_() {
  var b = angka_(pengaturan_()['Batas Tuntas']);
  return b === null || b < 0 || b > 100 ? BATAS_TUNTAS_BAWAAN : b;
}

function catat_(nisn, aksi) {
  try { dbPantau_().getSheetByName('Log').appendRow([new Date(), nisn, aksi]); } catch (e) { /* log tidak boleh menggagalkan */ }
}

/* ---------- akun orang tua ---------- */

function hashSandi_(sandi, garam) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, garam + '|' + sandi, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ((x + 256) % 256).toString(16).replace(/^(.)$/, '0$1'); }).join('');
}

function cariAkun_(sh, nisn) {
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (rapikanNisn_(v[i][0]) === nisn) return { baris: i + 1, hash: teks_(v[i][1]), garam: teks_(v[i][2]) };
  return null;
}

function nisnTerdaftar_(nisn) {
  var cache = CacheService.getScriptCache(), k = 'ada:' + nisn, c = cache.get(k);
  if (c) return c === '1';
  var ada = bacaTabel_(SpreadsheetApp.openById(RAPOR_SS_ID), 'Siswa').some(function (r) { return rapikanNisn_(r.NISN) === nisn; });
  cache.put(k, ada ? '1' : '0', 600);
  return ada;
}

function masuk_(nisn, sandi) {
  var salahUmum = { ok: false, pesan: 'NISN atau sandi salah.' };
  if (!/^\d{10}$/.test(nisn)) return { ok: false, pesan: 'NISN harus 10 angka.' };
  var cache = CacheService.getScriptCache();
  if (cache.get('kunci:' + nisn)) return { ok: false, pesan: 'Terlalu banyak percobaan salah. Coba lagi ' + MENIT_KUNCI + ' menit lagi.' };

  var benar = false, wajibGanti = false;
  if (nisnTerdaftar_(nisn)) {
    var akun = cariAkun_(dbPantau_().getSheetByName('Akun Ortu'), nisn);
    if (akun && akun.hash) benar = hashSandi_(sandi, akun.garam) === akun.hash;
    else { benar = sandi === SANDI_AWAL; wajibGanti = true; }
  }
  if (!benar) {
    var gagal = Number(cache.get('gagal:' + nisn) || 0) + 1;
    if (gagal >= MAKS_GAGAL) {
      cache.put('kunci:' + nisn, '1', MENIT_KUNCI * 60);
      cache.remove('gagal:' + nisn);
      catat_(nisn, 'dikunci ' + MENIT_KUNCI + ' menit');
      return { ok: false, pesan: 'Sudah ' + MAKS_GAGAL + ' kali salah. Coba lagi ' + MENIT_KUNCI + ' menit lagi.' };
    }
    cache.put('gagal:' + nisn, String(gagal), MENIT_KUNCI * 60);
    return salahUmum;
  }
  cache.remove('gagal:' + nisn);
  var sesi = Utilities.getUuid();
  cache.put('sesi:' + sesi, JSON.stringify({ nisn: nisn, wajibGanti: wajibGanti }), JAM_SESI * 3600);
  catat_(nisn, 'masuk');
  return { ok: true, sesi: sesi, wajibGanti: wajibGanti };
}

function bacaSesi_(sesi) {
  var c = CacheService.getScriptCache().get('sesi:' + teks_(sesi));
  if (!c) return null;
  return JSON.parse(c);
}

function gantiSandi_(sesi, lama, baru, ulangi) {
  var s = bacaSesi_(sesi);
  if (!s) return { ok: false, sesiHabis: true, pesan: 'Sesi berakhir. Silakan masuk lagi.' };
  var salah = cekSandiBaru_(baru, ulangi);
  if (salah) return { ok: false, pesan: salah };
  var kunci = LockService.getScriptLock();
  kunci.waitLock(20000);
  try {
    var sh = dbPantau_().getSheetByName('Akun Ortu');
    var akun = cariAkun_(sh, s.nisn);
    if (!s.wajibGanti) {
      var cocok = akun && akun.hash ? hashSandi_(String(lama || ''), akun.garam) === akun.hash : String(lama || '') === SANDI_AWAL;
      if (!cocok) return { ok: false, pesan: 'Sandi lama salah.' };
    }
    var garam = Utilities.getUuid();
    var baris = [s.nisn, hashSandi_(String(baru), garam), garam, new Date(), new Date()];
    if (akun) sh.getRange(akun.baris, 1, 1, baris.length).setValues([baris]);
    else sh.appendRow(baris);
  } finally { kunci.releaseLock(); }
  s.wajibGanti = false;
  CacheService.getScriptCache().put('sesi:' + teks_(sesi), JSON.stringify(s), JAM_SESI * 3600);
  catat_(s.nisn, 'ganti sandi');
  return { ok: true, pesan: 'Sandi baru tersimpan. Ingat baik-baik sandi ini.' };
}

function ketuntasan_(sesi, semester) {
  var s = bacaSesi_(sesi);
  if (!s) return { ok: false, sesiHabis: true, pesan: 'Sesi berakhir. Silakan masuk lagi.' };
  if (s.wajibGanti) return { ok: false, wajibGanti: true, pesan: 'Buat sandi baru dulu.' };
  var ss = SpreadsheetApp.openById(RAPOR_SS_ID);
  var t = {
    pengaturan: bacaTabel_(ss, 'Pengaturan'), rombel: bacaTabel_(ss, 'Rombel'), siswa: bacaTabel_(ss, 'Siswa'),
    anggota: bacaTabel_(ss, 'Anggota Rombel'), mapelAktif: bacaTabel_(ss, 'Mapel Aktif'),
    tp: bacaTabel_(ss, 'Tujuan Pembelajaran'), nilai: bacaTabel_(ss, 'Nilai')
  };
  return hitungKetuntasan_(t, s.nisn, semester, batasTuntas_());
}

/* ---------- guru ---------- */

function guruReset_(pin, nisn) {
  var cache = CacheService.getScriptCache();
  if (cache.get('kunci:guru')) return { ok: false, pesan: 'Terlalu banyak PIN salah. Coba lagi ' + MENIT_KUNCI + ' menit lagi.' };
  var pinBenar = teks_(pengaturan_()['PIN Guru']);
  if (!pinBenar || pinBenar.length < 6) return { ok: false, pesan: 'PIN Guru belum diatur (minimal 6 karakter). Hubungi Kepala Sekolah.' };
  if (pin !== pinBenar) {
    var gagal = Number(cache.get('gagal:guru') || 0) + 1;
    if (gagal >= MAKS_GAGAL) { cache.put('kunci:guru', '1', MENIT_KUNCI * 60); cache.remove('gagal:guru'); }
    else cache.put('gagal:guru', String(gagal), MENIT_KUNCI * 60);
    return { ok: false, pesan: 'PIN Guru salah.' };
  }
  cache.remove('gagal:guru');
  if (!/^\d{10}$/.test(nisn)) return { ok: false, pesan: 'NISN harus 10 angka.' };
  if (!nisnTerdaftar_(nisn)) return { ok: false, pesan: 'NISN tidak ditemukan di data rapor.' };
  var kunci = LockService.getScriptLock();
  kunci.waitLock(20000);
  try {
    var sh = dbPantau_().getSheetByName('Akun Ortu');
    var akun = cariAkun_(sh, nisn);
    if (akun) sh.getRange(akun.baris, 2, 1, 3).setValues([['', '', new Date()]]);
  } finally { kunci.releaseLock(); }
  cache.remove('kunci:' + nisn);
  cache.remove('gagal:' + nisn);
  catat_(nisn, 'sandi diatur ulang oleh guru');
  return { ok: true, pesan: 'Sandi NISN ' + nisn + ' kembali ke sandi awal "' + SANDI_AWAL + '". Orang tua wajib membuat sandi baru saat masuk.' };
}

/* ---------- pemasangan ---------- */

/** Jalankan sekali dari editor: membuat spreadsheet "DB Pantau Belajar SD N Bugangin". */
function setupAwal() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('DB_ID')) { Logger.log('Sudah disiapkan: ' + props.getProperty('DB_ID')); return; }
  var ss = SpreadsheetApp.create('DB Pantau Belajar SD N Bugangin');
  var akun = ss.getSheets()[0].setName('Akun Ortu');
  akun.getRange(1, 1, 1, KOLOM_AKUN.length).setValues([KOLOM_AKUN]).setFontWeight('bold');
  akun.getRange('A:C').setNumberFormat('@');
  var atur = ss.insertSheet('Pengaturan');
  atur.getRange(1, 1, 3, 3).setValues([
    KOLOM_PENGATURAN,
    ['Batas Tuntas', BATAS_TUNTAS_BAWAAN, 'Nilai TP minimal agar disebut Tuntas (0–100).'],
    ['PIN Guru', '', 'Isi minimal 6 karakter. Dipakai guru untuk mengatur ulang sandi orang tua. Jangan dibagikan ke orang tua.']
  ]);
  atur.getRange(1, 1, 1, 3).setFontWeight('bold');
  atur.getRange('B3').setNumberFormat('@');
  var log = ss.insertSheet('Log');
  log.getRange(1, 1, 1, KOLOM_LOG.length).setValues([KOLOM_LOG]).setFontWeight('bold');
  props.setProperty('DB_ID', ss.getId());
  Logger.log('DB dibuat: ' + ss.getUrl());
}

if (typeof module !== 'undefined') {
  module.exports = { rapikanNisn_: rapikanNisn_, angka_: angka_, cekSandiBaru_: cekSandiBaru_, statusTp_: statusTp_,
    ringkasMapel_: ringkasMapel_, hitungKetuntasan_: hitungKetuntasan_, SANDI_AWAL: SANDI_AWAL };
}
