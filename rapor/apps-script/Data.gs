/**
 * Aplikasi Rapor SD — data sekolah: profil, rombel, siswa, dan unduh salinan Excel.
 *
 * Semua isian diperiksa dan dirapikan dulu (fungsi murni di bagian atas, diuji di tes),
 * baru ditulis ke spreadsheet sekolah di dalam kunci, supaya dua guru yang menyimpan
 * bersamaan tidak saling menimpa.
 */

var KUNCI_PROFIL_TETAP = ['NPSN', 'Email']; // tidak bisa diubah dari halaman: identitas akun
var MAKS_SISWA_ROMBEL = 100;

var KOLOM_SISWA = {
  id: 'ID Siswa', nis: 'NIS', nisn: 'NISN', nama: 'Nama Lengkap', panggilan: 'Nama Panggilan',
  jk: 'Jenis Kelamin', agama: 'Agama', tempatLahir: 'Tempat Lahir', tanggalLahir: 'Tanggal Lahir',
  ayah: 'Nama Ayah', ibu: 'Nama Ibu', wali: 'Nama Wali', alamat: 'Alamat',
  pendidikanSebelumnya: 'Pendidikan Sebelumnya', pekerjaanAyah: 'Pekerjaan Ayah', pekerjaanIbu: 'Pekerjaan Ibu',
  alamatOrtu: 'Alamat Orang Tua', pekerjaanWali: 'Pekerjaan Wali', alamatWali: 'Alamat Wali'
};

/* Baris profil yang ditambahkan setelah versi pertama: dilengkapi otomatis di spreadsheet lama. */
var PROFIL_TAMBAHAN = [{ Kunci: 'Website', Nilai: '', Keterangan: 'Opsional, tercetak di sampul rapor.' }];

function profilLengkap_(rows) {
  var ada = {};
  rows.forEach(function (r) { ada[teks_(r.Kunci)] = true; });
  PROFIL_TAMBAHAN.forEach(function (t) { if (!ada[t.Kunci]) rows.push({ Kunci: t.Kunci, Nilai: t.Nilai, Keterangan: t.Keterangan }); });
  return rows;
}

/* ---------- pemeriksaan & perapian isian (murni) ---------- */

function teks_(v) { return v === null || v === undefined ? '' : String(v).trim().replace(/\s+/g, ' '); }

/**
 * Tanggal dari isian guru → "YYYY-MM-DD". Menerima 2015-03-04, 04/03/2015, 4-3-2015, atau objek Date.
 * Kosong → ''. Tanggal mustahil (31/02) atau di luar rentang tahun → null.
 */
function normalisasiTanggal_(v, tahunMin, tahunMaks) {
  if (v === null || v === undefined || v === '') return '';
  var t, b, h;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return null;
    t = v.getFullYear(); b = v.getMonth() + 1; h = v.getDate();
  } else {
    var s = teks_(v), m;
    if (!s) return '';
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { t = +m[1]; b = +m[2]; h = +m[3]; }
    else if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/))) { h = +m[1]; b = +m[2]; t = +m[3]; }
    else return null;
  }
  var d = new Date(t, b - 1, h);
  if (d.getFullYear() !== t || d.getMonth() !== b - 1 || d.getDate() !== h) return null;
  if ((tahunMin && t < tahunMin) || (tahunMaks && t > tahunMaks)) return null;
  return t + '-' + (b < 10 ? '0' : '') + b + '-' + (h < 10 ? '0' : '') + h;
}

function normalisasiJk_(v) {
  var s = teks_(v).toLowerCase().replace(/[^a-z]/g, '');
  if (s === 'l' || s === 'lk' || s === 'lakilaki' || s === 'laki') return 'L';
  if (s === 'p' || s === 'pr' || s === 'perempuan' || s === 'wanita') return 'P';
  return teks_(v);
}

/**
 * Seni pilihan siswa. Boleh lebih dari satu, dipisah koma, "dan", "&", "/" atau ";".
 * "rupa dan musik" → "Seni Musik, Seni Rupa" (urut sesuai daftar seni sekolah, tanpa dobel).
 * Seni yang tidak dikenal dibiarkan apa adanya agar dilaporkan oleh cekDaftarSiswa_.
 */
function normalisasiSeni_(v, ditawarkan) {
  var bagian = teks_(v).split(/\s*(?:,|;|\/|&|\bdan\b)\s*/i).map(teks_).filter(String);
  var kenal = [], asing = [];
  bagian.forEach(function (b) {
    var s = b.toLowerCase(), cocok = null;
    for (var i = 0; i < ditawarkan.length; i++) {
      var d = ditawarkan[i].toLowerCase();
      if (s === d || 'seni ' + s === d) cocok = ditawarkan[i];
    }
    if (cocok) { if (kenal.indexOf(cocok) < 0) kenal.push(cocok); }
    else if (asing.indexOf(b) < 0) asing.push(b);
  });
  kenal.sort(function (a, b) { return ditawarkan.indexOf(a) - ditawarkan.indexOf(b); });
  return kenal.concat(asing).join(', ');
}

/** Memeriksa daftar seni yang diajarkan sekolah. Hasil: { salah[], seni[] } urut sesuai PILIHAN_SENI. */
function cekSeniSekolah_(daftar) {
  var seni = PILIHAN_SENI.filter(function (x) { return (daftar || []).indexOf(x) >= 0; });
  var asing = (daftar || []).filter(function (x) { return PILIHAN_SENI.indexOf(x) < 0; });
  var salah = [];
  if (asing.length) salah.push('Seni tidak dikenal: ' + asing.join(', ') + '.');
  if (!seni.length) salah.push('Pilih minimal satu seni yang diajarkan sekolah.');
  return { salah: salah, seni: seni };
}

/** "MUHAMMAD rizki" → "Muhammad". Dipakai bila nama panggilan dikosongkan. */
function panggilanBawaan_(nama) {
  var kata = teks_(nama).split(' ')[0] || '';
  return kata ? kata.charAt(0).toUpperCase() + kata.slice(1).toLowerCase() : '';
}

/**
 * Merapikan satu baris siswa dari formulir/tempelan Excel.
 * Hasil: { siswa, salah[] }. siswa memakai kunci pendek (lihat KOLOM_SISWA) ditambah seni.
 */
function normalisasiSiswa_(d, seniDitawarkan, tahunSekarang) {
  d = d || {};
  var salah = [];
  var s = {
    id: teks_(d.id), nis: teks_(d.nis).replace(/\s/g, ''), nisn: teks_(d.nisn).replace(/\s/g, ''),
    nama: teks_(d.nama), panggilan: teks_(d.panggilan), jk: normalisasiJk_(d.jk),
    agama: normalisasiAgama_(d.agama) || teks_(d.agama), tempatLahir: teks_(d.tempatLahir),
    tanggalLahir: '', ayah: teks_(d.ayah), ibu: teks_(d.ibu), wali: teks_(d.wali), alamat: teks_(d.alamat),
    pendidikanSebelumnya: teks_(d.pendidikanSebelumnya), pekerjaanAyah: teks_(d.pekerjaanAyah), pekerjaanIbu: teks_(d.pekerjaanIbu),
    alamatOrtu: teks_(d.alamatOrtu), pekerjaanWali: teks_(d.pekerjaanWali), alamatWali: teks_(d.alamatWali),
    seni: normalisasiSeni_(d.seni, seniDitawarkan || PILIHAN_SENI)
  };
  var tgl = normalisasiTanggal_(d.tanggalLahir, tahunSekarang - 25, tahunSekarang - 3);
  if (tgl === null) salah.push('tanggal lahir "' + teks_(d.tanggalLahir) + '" tidak valid (contoh: 15/03/2016).');
  else s.tanggalLahir = tgl;
  if (s.nama.length > 100) salah.push('nama terlalu panjang (maks. 100 karakter).');
  if (!s.panggilan && s.nama) s.panggilan = panggilanBawaan_(s.nama);
  if (s.panggilan.length > 30) salah.push('nama panggilan terlalu panjang (maks. 30 karakter).');
  ['tempatLahir', 'ayah', 'ibu', 'wali', 'pendidikanSebelumnya', 'pekerjaanAyah', 'pekerjaanIbu', 'pekerjaanWali'].forEach(function (k) {
    if (s[k].length > 100) salah.push(KOLOM_SISWA[k].toLowerCase() + ' terlalu panjang (maks. 100 karakter).');
  });
  ['alamat', 'alamatOrtu', 'alamatWali'].forEach(function (k) {
    if (s[k].length > 300) salah.push(KOLOM_SISWA[k].toLowerCase() + ' terlalu panjang (maks. 300 karakter).');
  });
  return { siswa: s, salah: salah };
}

/** Memeriksa isian profil. Hasil: { salah[], bersih{} } — hanya kunci yang boleh diubah. */
function cekProfil_(isian, kunciAda) {
  var salah = [], bersih = {};
  Object.keys(isian || {}).forEach(function (k) {
    if (KUNCI_PROFIL_TETAP.indexOf(k) >= 0 || kunciAda.indexOf(k) < 0) return;
    var v = teks_(isian[k]);
    if (k === 'Nama Sekolah' && !v) salah.push('Nama sekolah wajib diisi.');
    else if (k === 'NIP Kepala Sekolah' && v && !/^\d{18}$/.test(v.replace(/\s/g, ''))) salah.push('NIP kepala sekolah harus 18 digit angka (atau kosongkan).');
    else if (k === 'Kode Pos' && v && !/^\d{5}$/.test(v)) salah.push('Kode pos harus 5 digit angka.');
    else if (k === 'Telepon' && v && !/^[0-9+\-() ]{6,20}$/.test(v)) salah.push('Nomor telepon tidak valid.');
    else if (k === 'Tanggal Pembagian Rapor' && v && !normalisasiTanggal_(v)) salah.push('Tanggal pembagian rapor tidak valid.');
    else if (v.length > 200) salah.push(k + ' terlalu panjang (maks. 200 karakter).');
    if (k === 'NIP Kepala Sekolah') v = v.replace(/\s/g, '');
    if (k === 'Tanggal Pembagian Rapor' && v) v = normalisasiTanggal_(v) || v;
    bersih[k] = v;
  });
  return { salah: salah, bersih: bersih };
}

/**
 * Memeriksa rombel baru/ubahan terhadap rombel lain di tahun ajaran yang sama.
 * Nama rombel boleh kosong untuk kelas yang hanya punya satu rombel: namanya menjadi nomor kelas ("5").
 * Huruf saja diberi awalan nomor kelas: "a" → "5A".
 */
function cekRombel_(d, rombelLain) {
  var salah = [];
  var kelas = Number(d.kelas);
  var kelasSah = kelas >= 1 && kelas <= 6 && Math.floor(kelas) === kelas;
  var nama = teks_(d.nama).toUpperCase();
  var nip = teks_(d.nip).replace(/\s/g, '');
  if (!kelasSah) salah.push('Pilih kelas 1 sampai 6.');
  if (kelasSah && !nama) nama = String(kelas);
  else if (kelasSah && /^[A-Z]{1,2}$/.test(nama)) nama = kelas + nama;
  var lain = rombelLain.filter(function (r) { return r.id !== d.id; });
  if (nama.length > 20) salah.push('Nama rombel maksimal 20 karakter.');
  else if (lain.some(function (r) { return String(r.nama).toUpperCase() === nama; })) {
    salah.push(nama === String(kelas)
      ? 'Kelas ' + kelas + ' sudah punya rombel. Jika kelas ' + kelas + ' punya lebih dari satu rombel, isi nama rombel (misalnya A atau B), lalu ubah juga nama rombel yang sudah ada.'
      : 'Rombel ' + nama + ' sudah ada di tahun ajaran ini.');
  }
  if (teks_(d.wali).length > 100) salah.push('Nama wali kelas terlalu panjang.');
  if (nip && !/^\d{18}$/.test(nip)) salah.push('NIP wali kelas harus 18 digit angka (atau kosongkan).');
  var target = cekJumlahSiswa_(d.target);
  if (target === null) salah.push('Jumlah siswa harus angka 1 sampai ' + MAKS_SISWA_ROMBEL + ' (atau kosongkan).');
  return { salah: salah, rombel: { id: d.id, kelas: kelas, nama: nama, wali: teks_(d.wali), nip: nip, target: target || 0 } };
}

/** Jumlah siswa rombel dari isian: kosong → 0 (belum ditentukan), 1–100 → angka, selain itu → null (salah). */
function cekJumlahSiswa_(v) {
  if (v === undefined || v === null || teks_(v) === '' || Number(v) === 0) return 0;
  var n = Number(teks_(v));
  return n >= 1 && n <= MAKS_SISWA_ROMBEL && Math.floor(n) === n ? n : null;
}

/** Nama rombel untuk pesan: kelas dengan satu rombel (nama = nomor kelas) disebut "Kelas 5". */
function labelRombel_(r) { return String(r.nama) === String(r.kelas) ? 'Kelas ' + r.kelas : String(r.nama); }

/* ---------- akses spreadsheet sekolah ---------- */

function bukaSekolah_(npsn) {
  // ID spreadsheet diingat 10 menit agar tidak membaca sheet Sekolah di Pusat pada setiap permintaan.
  var cache = CacheService.getScriptCache(), kunci = 'ss:' + npsn;
  var id = cache.get(kunci);
  if (!id) {
    var s = cariSekolah_('npsn', npsn);
    if (!s || !s.spreadsheet) throw galatPengguna_('Spreadsheet sekolah tidak ditemukan. Hubungi pengelola aplikasi.');
    id = s.spreadsheet;
  }
  var ss;
  try {
    ss = SpreadsheetApp.openById(id);
  } catch (e) {
    cache.remove(kunci);
    throw galatPengguna_('Spreadsheet sekolah tidak bisa dibuka. Hubungi pengelola aplikasi.');
  }
  cache.put(kunci, id, 600);
  SEKOLAH_AKTIF_ = npsn;
  if (BACA_AWAL_.length) bacaSekaligus_(ss, BACA_AWAL_);
  return ss;
}

function sheetSekolah_(ss, nama) {
  var sh = ss.getSheetByName(nama);
  if (!sh) throw galatPengguna_('Sheet "' + nama + '" hilang dari spreadsheet sekolah. Hubungi pengelola aplikasi.');
  return sh;
}

/** Isi sheet sebagai daftar objek berkunci nama kolom. Baris kosong dilewati. */
/*
 * Isi sheet yang terakhir dibaca/ditulis dalam permintaan ini (dikosongkan di awal setiap permintaan oleh layani_).
 * tulisTabel_ memakainya untuk menulis hanya baris yang berubah, bukan seluruh sheet.
 */
var ISI_SHEET_ = {};
var JUDUL_SHEET_ = {}; // baris judul yang ikut terbaca, agar tulisTabel_ tidak perlu membacanya lagi

/* Sheet yang dibaca sekaligus di awal permintaan (diatur siapkanPermintaan_ menurut aksi). */
var BACA_AWAL_ = [];
var SHEET_INTI_ = ['Pengaturan', 'Rombel', 'Siswa', 'Anggota Rombel'];
var BACA_PER_AKSI_ = {
  dataSekolah: ['Profil Sekolah', 'Pengaturan', 'Rombel', 'Anggota Rombel'],
  nilaiRombel: SHEET_INTI_.concat(['Mapel Aktif', 'Tujuan Pembelajaran', 'Nilai', 'KKTP']),
  kokRombel: SHEET_INTI_.concat(['Kokurikuler', 'Capaian Kokurikuler', 'Master Narasi']),
  waliRombel: SHEET_INTI_.concat(['Presensi & Catatan', 'Ekstrakurikuler', 'Kenaikan']),
  tpKelas: SHEET_INTI_.concat(['Mapel Aktif', 'Tujuan Pembelajaran', 'Nilai']),
  rekapRombel: SHEET_INTI_.concat(['Profil Sekolah', 'KKTP', 'Mapel Aktif', 'Tujuan Pembelajaran', 'Nilai', 'Kokurikuler',
    'Capaian Kokurikuler', 'Master Narasi', 'Presensi & Catatan', 'Ekstrakurikuler', 'Kenaikan'])
};
BACA_PER_AKSI_.simpanNilai = BACA_PER_AKSI_.nilaiRombel;
BACA_PER_AKSI_.simpanKok = BACA_PER_AKSI_.simpanDimensiKok = BACA_PER_AKSI_.kokRombel;
BACA_PER_AKSI_.simpanEkskul = BACA_PER_AKSI_.simpanPresensi = BACA_PER_AKSI_.simpanKenaikan = BACA_PER_AKSI_.waliRombel;
BACA_PER_AKSI_.simpanTp = BACA_PER_AKSI_.tpKelas;
BACA_PER_AKSI_.kunciRapor = BACA_PER_AKSI_.bukaKunciRapor = SHEET_INTI_;

/** Dipanggil di awal setiap permintaan: kosongkan isi sheet yang diingat dan tentukan sheet yang dibaca sekaligus. */
function siapkanPermintaan_(aksi) {
  SEKOLAH_AKTIF_ = '';
  ISI_SHEET_ = {};
  JUDUL_SHEET_ = {};
  BACA_AWAL_ = BACA_PER_AKSI_[aksi] || [];
}

function hurufKolom_(n) { return String.fromCharCode(64 + n); }

/** Nomor seri tanggal Google Sheets (zona waktu spreadsheet) → Date. */
function tanggalDariSerial_(serial, zona) {
  var kira = new Date(Math.round((serial - 25569) * 86400000));
  var z = Utilities.formatDate(kira, zona, 'Z'); // mis. "+0700"
  var menit = (z.charAt(0) === '-' ? -1 : 1) * (Number(z.substr(1, 2)) * 60 + Number(z.substr(3, 2)));
  return new Date(kira.getTime() - menit * 60000);
}

/**
 * Membaca beberapa sheet dalam SATU panggilan Google Sheets API (layanan lanjutan "Sheets").
 * Membuka sheet satu per satu lewat SpreadsheetApp makan ±0,2–0,3 detik per sheet; ini memangkasnya.
 * Bila layanan belum diaktifkan, kuota habis, atau ada galat apa pun, tidak terjadi apa-apa:
 * bacaTabel_ membaca dengan cara biasa.
 */
var GALAT_BACA_SEKALIGUS_ = ''; // sebab terakhir baca sekaligus tidak dipakai (untuk ujiBeban)
var CARA_BACA_SEKALIGUS_ = '';  // 'layanan Sheets (ID: …)' atau 'Sheets API lewat UrlFetch'

/** Layanan lanjutan Google Sheets API, apa pun ID yang dipakai saat menambahkannya (biasanya "Sheets"). */
function layananSheets_() {
  if (typeof Sheets !== 'undefined' && Sheets && Sheets.Spreadsheets) return { id: 'Sheets', api: Sheets };
  var g = typeof globalThis !== 'undefined' ? globalThis : (function () { return this; })();
  var nama = g ? Object.getOwnPropertyNames(g) : [];
  for (var i = 0; i < nama.length; i++) {
    try {
      var o = g[nama[i]];
      if (o && typeof o === 'object' && o.Spreadsheets && o.Spreadsheets.Values && typeof o.Spreadsheets.Values.batchGet === 'function') {
        return { id: nama[i], api: o };
      }
    } catch (e) { /* properti yang tidak bisa dibaca: lewati */ }
  }
  return null;
}

/**
 * Satu panggilan batchGet: lewat layanan lanjutan bila ada, kalau tidak langsung ke REST API Sheets
 * dengan token skrip. Penolakan REST (mis. API tidak aktif di proyek) diingat 1 jam agar tidak dicoba terus.
 */
function ambilBatch_(id, ranges) {
  var opsi = { valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER' };
  var layanan = layananSheets_(), galat = [];
  if (layanan) {
    try {
      var r = layanan.api.Spreadsheets.Values.batchGet(id, { ranges: ranges, valueRenderOption: opsi.valueRenderOption, dateTimeRenderOption: opsi.dateTimeRenderOption });
      CARA_BACA_SEKALIGUS_ = 'layanan Sheets (ID: ' + layanan.id + ')';
      return r;
    } catch (e) { galat.push('layanan ' + layanan.id + ': ' + e.message); }
  } else {
    galat.push('layanan Sheets tidak ditemukan');
  }
  var cache = CacheService.getScriptCache();
  var mati = cache.get('sheetsapi:mati');
  if (mati) { GALAT_BACA_SEKALIGUS_ = galat.concat(['REST: ' + mati]).join('; '); return null; }
  try {
    var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(id) + '/values:batchGet?' +
      ranges.map(function (x) { return 'ranges=' + encodeURIComponent(x); }).join('&') +
      '&valueRenderOption=' + opsi.valueRenderOption + '&dateTimeRenderOption=' + opsi.dateTimeRenderOption;
    var jawab = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    var kode = jawab.getResponseCode();
    if (kode === 200) { CARA_BACA_SEKALIGUS_ = 'Sheets API lewat UrlFetch'; return JSON.parse(jawab.getContentText()); }
    var alasan = 'HTTP ' + kode + ' ' + String(jawab.getContentText()).replace(/\s+/g, ' ').slice(0, 160);
    if (kode === 403 || kode === 404 || kode === 400) cache.put('sheetsapi:mati', alasan, 3600);
    galat.push('REST: ' + alasan);
  } catch (e2) { galat.push('REST: ' + e2.message); }
  GALAT_BACA_SEKALIGUS_ = galat.join('; ');
  return null;
}

/**
 * Membaca beberapa sheet dalam SATU panggilan Google Sheets API.
 * Membuka sheet satu per satu lewat SpreadsheetApp makan ±0,2–0,3 detik per sheet; ini memangkasnya.
 * Bila API tidak bisa dipakai, tidak terjadi apa-apa: bacaTabel_ membaca dengan cara biasa.
 */
function bacaSekaligus_(ss, daftar) {
  var perlu = daftar.filter(function (n) { return !ISI_SHEET_[kunciIsi_(ss, n)]; });
  if (!perlu.length) return true;
  try {
    var res = ambilBatch_(ss.getId(), perlu.map(function (n) { return "'" + n + "'!A1:" + hurufKolom_(strukturSheet_(n).kolom.length); }));
    if (!res) return false;
    var zona = ss.getSpreadsheetTimeZone(), hasil = {};
    perlu.forEach(function (n, i) {
      var st = strukturSheet_(n), vr = (res.valueRanges || [])[i];
      if (!vr) throw new Error('jawaban tidak lengkap');
      var baris = vr.values || [];
      JUDUL_SHEET_[kunciIsi_(ss, n)] = st.kolom.map(function (k, j) { return baris[0] && baris[0][j] !== undefined ? baris[0][j] : ''; });
      hasil[n] = baris.slice(1).map(function (r) {
        return st.kolom.map(function (kol, j) {
          var v = r[j];
          if (v === undefined || v === null) return '';
          if (st.tanggal && st.tanggal.indexOf(kol) >= 0 && typeof v === 'number') return tanggalDariSerial_(v, zona);
          return v;
        });
      });
    });
    Object.keys(hasil).forEach(function (n) { ISI_SHEET_[kunciIsi_(ss, n)] = hasil[n]; });
    return true;
  } catch (e) {
    GALAT_BACA_SEKALIGUS_ = 'Sheets API galat: ' + e.message;
    return false;
  }
}

function kunciIsi_(ss, nama) { return ss.getId() + '|' + nama; }

function bacaTabel_(ss, nama) {
  var kolom = strukturSheet_(nama).kolom;
  var kunci = kunciIsi_(ss, nama);
  if (!ISI_SHEET_[kunci]) {
    // Belum dibaca di permintaan ini: baca sekali, lalu pakai ulang (sheet yang sama tidak dibaca dua kali).
    var semua = sheetSekolah_(ss, nama).getDataRange().getValues().map(function (r) {
      return kolom.map(function (k, j) { return r[j] === undefined || r[j] === null ? '' : r[j]; });
    });
    JUDUL_SHEET_[kunci] = semua[0] || [];
    ISI_SHEET_[kunci] = semua.slice(1);
  }
  var rows = [kolom].concat(ISI_SHEET_[kunci]);
  var hasil = [];
  for (var i = 1; i < rows.length; i++) {
    var kosong = true, o = {};
    for (var j = 0; j < kolom.length; j++) {
      var v = rows[i][j];
      o[kolom[j]] = v === undefined || v === null ? '' : v;
      if (o[kolom[j]] !== '') kosong = false;
    }
    if (!kosong) hasil.push(o);
  }
  return hasil;
}

/** Menulis ulang seluruh isi sheet (di bawah judul) dari daftar objek. */
/** Sama untuk keperluan menulis: angka 85 dan teks "85", tanggal yang sama, kosong dan null. */
function samaSel_(a, b) {
  if (a instanceof Date || b instanceof Date) return String(a && a.getTime ? a.getTime() : a) === String(b && b.getTime ? b.getTime() : b);
  return String(a === null || a === undefined ? '' : a) === String(b === null || b === undefined ? '' : b);
}

function samaBaris_(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (var j = 0; j < a.length; j++) if (!samaSel_(a[j], b[j])) return false;
  return true;
}

/**
 * Menulis seluruh isi tabel (tanpa baris judul). Hanya rentang baris yang berbeda dari isi lama yang ditulis:
 * simpan nilai satu mapel di sekolah besar menulis puluhan baris, bukan belasan ribu.
 */
function tulisTabel_(ss, nama, data) {
  var st = strukturSheet_(nama);
  var sh = sheetSekolah_(ss, nama);
  // Spreadsheet yang dibuat versi lama belum punya kolom baru (mis. Jumlah Siswa): judulnya dilengkapi di sini.
  var kunci = kunciIsi_(ss, nama);
  var judul = JUDUL_SHEET_[kunci] || sh.getRange(1, 1, 1, st.kolom.length).getValues()[0];
  if (judul.join('|') !== st.kolom.join('|')) {
    sh.getRange(1, 1, 1, st.kolom.length).setValues([st.kolom])
      .setFontWeight('bold').setBackground('#12314f').setFontColor('#ffffff');
    JUDUL_SHEET_[kunci] = st.kolom.slice();
  }
  var baru = data.map(function (o) {
    return st.kolom.map(function (k) { return o[k] === undefined || o[k] === null ? '' : o[k]; });
  });
  var lama = ISI_SHEET_[kunci];
  var jumlahLama = Math.max(sh.getLastRow() - 1, 0);
  if (!lama || lama.length !== jumlahLama) {
    // Belum dibaca di permintaan ini (atau sheet berubah di luar aplikasi): baca dulu agar perbandingan benar.
    lama = jumlahLama ? sh.getRange(2, 1, jumlahLama, st.kolom.length).getValues() : [];
  }
  var perlu = baru.length + 1;
  if (sh.getMaxRows() < perlu) {
    var awal = sh.getMaxRows() + 1;
    sh.insertRowsAfter(sh.getMaxRows(), perlu - sh.getMaxRows() + 200);
    formatTeks_(sh, st, awal);
  }
  var mulai = 0;
  while (mulai < baru.length && mulai < lama.length && samaBaris_(baru[mulai], lama[mulai])) mulai++;
  var akhir = baru.length - 1; // baris terakhir yang perlu ditulis
  if (baru.length === lama.length) {
    while (akhir >= mulai && samaBaris_(baru[akhir], lama[akhir])) akhir--;
  }
  if (akhir >= mulai) sh.getRange(mulai + 2, 1, akhir - mulai + 1, st.kolom.length).setValues(baru.slice(mulai, akhir + 1));
  if (lama.length > baru.length) sh.getRange(baru.length + 2, 1, lama.length - baru.length, st.kolom.length).clearContent();
  ISI_SHEET_[kunci] = baru;
}

/**
 * Mengganti baris dalam satu lingkup (mis. satu layar nilai) tanpa menggeser baris lain:
 * baris lama yang kuncinya masih ada diganti di tempat, yang hilang dihapus, yang baru ditambah di akhir.
 * Dengan begitu tulisTabel_ hanya menulis bagian kecil sheet.
 */
function gantiDiTempat_(semua, diLingkup, kunci, baru) {
  var per = {}, urut = [];
  baru.forEach(function (o) { var k = kunci(o); if (!(k in per)) urut.push(k); per[k] = o; });
  var hasil = [], dipakai = {};
  semua.forEach(function (r) {
    if (!diLingkup(r)) { hasil.push(r); return; }
    var k = kunci(r);
    if (k in per && !dipakai[k]) { hasil.push(per[k]); dipakai[k] = true; }
  });
  urut.forEach(function (k) { if (!dipakai[k]) hasil.push(per[k]); });
  return hasil;
}

function bacaKunciNilai_(ss, nama) {
  var hasil = {};
  bacaTabel_(ss, nama).forEach(function (r) { hasil[teks_(r.Kunci)] = r.Nilai; });
  return hasil;
}

function catatSekolah_(ss, aksi, rincian) {
  sheetSekolah_(ss, 'Log').appendRow([new Date(), aksi, String(rincian || '').slice(0, 500)]);
}

function aturSekolah_(ss) {
  var a = bacaKunciNilai_(ss, 'Pengaturan');
  var seni = teks_(a['Seni Ditawarkan']).split(',').map(teks_).filter(String);
  return {
    tahunAjaran: teks_(a['Tahun Ajaran']),
    semester: Number(a['Semester']) === 2 ? 2 : 1,
    seni: seni.length ? seni : PILIHAN_SENI.slice()
  };
}

function idBaru_(awalan, dipakai) {
  var id;
  do { id = awalan + Utilities.getUuid().replace(/-/g, '').slice(0, 10); } while (dipakai[id]);
  return id;
}

/* ---------- aksi: ringkasan sekolah & profil ---------- */

function dataSekolah_(npsn) {
  var ss = bukaSekolah_(npsn);
  var atur = aturSekolah_(ss);
  var profil = profilLengkap_(bacaTabel_(ss, 'Profil Sekolah')).map(function (r) {
    return { kunci: teks_(r.Kunci), nilai: teks_(r.Nilai), ket: teks_(r.Keterangan), tetap: KUNCI_PROFIL_TETAP.indexOf(teks_(r.Kunci)) >= 0 };
  });
  var jumlah = {};
  bacaTabel_(ss, 'Anggota Rombel').forEach(function (a) {
    if (teks_(a['Tahun Ajaran']) === atur.tahunAjaran) jumlah[teks_(a['ID Rombel'])] = (jumlah[teks_(a['ID Rombel'])] || 0) + 1;
  });
  var rombel = daftarRombel_(ss, atur.tahunAjaran).map(function (r) { r.jumlah = jumlah[r.id] || 0; return r; });
  return { ok: true, profil: profil, tahunAjaran: atur.tahunAjaran, semester: atur.semester, seni: atur.seni, rombel: rombel };
}

function daftarRombel_(ss, tahunAjaran) {
  return bacaTabel_(ss, 'Rombel').filter(function (r) { return teks_(r['Tahun Ajaran']) === tahunAjaran; })
    .map(function (r) {
      return {
        id: teks_(r['ID Rombel']), kelas: Number(r.Kelas), nama: teks_(r['Nama Rombel']), wali: teks_(r['Wali Kelas']),
        nip: teks_(r['NIP Wali Kelas']), target: Number(r['Jumlah Siswa']) || 0
      };
    })
    .sort(function (a, b) { return a.kelas - b.kelas || (a.nama < b.nama ? -1 : a.nama > b.nama ? 1 : 0); });
}

function simpanProfil_(npsn, isian, semester, seni) {
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var rows = profilLengkap_(bacaTabel_(ss, 'Profil Sekolah'));
    var cek = cekProfil_(isian, rows.map(function (r) { return teks_(r.Kunci); }));
    var sem = Number(semester);
    if (semester !== undefined && sem !== 1 && sem !== 2) cek.salah.push('Semester harus 1 atau 2.');
    var cekSeni = null;
    if (seni !== undefined) {
      cekSeni = cekSeniSekolah_(Array.isArray(seni) ? seni : []);
      cek.salah = cek.salah.concat(cekSeni.salah);
      // Seni yang masih dipilih siswa tahun ini tidak boleh dihapus dari daftar sekolah.
      var atur = aturSekolah_(ss), pakai = {}; // seni → jumlah siswa yang memilihnya tahun ini
      bacaTabel_(ss, 'Anggota Rombel').forEach(function (a) {
        if (teks_(a['Tahun Ajaran']) !== atur.tahunAjaran) return;
        pecahSeni_(teks_(a['Seni Pilihan'])).forEach(function (x) { pakai[x] = (pakai[x] || 0) + 1; });
      });
      Object.keys(pakai).forEach(function (x) {
        if (cekSeni.seni.indexOf(x) < 0 && !cekSeni.salah.length) {
          cek.salah.push(x + ' masih dipilih ' + pakai[x] + ' siswa. Ubah dulu seni pilihan siswa tersebut.');
        }
      });
    }
    if (cek.salah.length) return { ok: false, salah: cek.salah, pesan: cek.salah[0] };
    rows.forEach(function (r) { if (teks_(r.Kunci) in cek.bersih) r.Nilai = cek.bersih[teks_(r.Kunci)]; });
    tulisTabel_(ss, 'Profil Sekolah', rows);
    if (sem === 1 || sem === 2 || cekSeni) {
      var pengaturan = bacaTabel_(ss, 'Pengaturan');
      pengaturan.forEach(function (r) {
        if (teks_(r.Kunci) === 'Semester' && (sem === 1 || sem === 2)) r.Nilai = sem;
        if (teks_(r.Kunci) === 'Seni Ditawarkan' && cekSeni) r.Nilai = cekSeni.seni.join(', ');
      });
      tulisTabel_(ss, 'Pengaturan', pengaturan);
    }
    catatSekolah_(ss, 'ubah profil', Object.keys(cek.bersih).join(', ') + (sem ? '; semester ' + sem : '') +
      (cekSeni ? '; seni ' + cekSeni.seni.join(', ') : ''));
    return { ok: true, pesan: 'Profil sekolah tersimpan.' };
  });
}

/* ---------- aksi: rombel ---------- */

function simpanRombel_(npsn, d) {
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var ta = aturSekolah_(ss).tahunAjaran;
    var semua = bacaTabel_(ss, 'Rombel');
    var cek = cekRombel_(d || {}, daftarRombel_(ss, ta));
    if (cek.salah.length) return { ok: false, salah: cek.salah, pesan: cek.salah[0] };
    var r = cek.rombel;
    if (r.id) {
      var lama = semua.filter(function (x) { return teks_(x['ID Rombel']) === r.id && teks_(x['Tahun Ajaran']) === ta; })[0];
      if (!lama) return { ok: false, pesan: 'Rombel tidak ditemukan. Muat ulang halaman.' };
      lama.Kelas = r.kelas; lama['Nama Rombel'] = r.nama; lama['Wali Kelas'] = r.wali; lama['NIP Wali Kelas'] = r.nip;
      lama['Jumlah Siswa'] = r.target || '';
    } else {
      var dipakai = {};
      semua.forEach(function (x) { dipakai[teks_(x['ID Rombel'])] = true; });
      r.id = idBaru_('R', dipakai);
      semua.push({ 'ID Rombel': r.id, 'Tahun Ajaran': ta, Kelas: r.kelas, 'Nama Rombel': r.nama, 'Wali Kelas': r.wali, 'NIP Wali Kelas': r.nip,
        'Jumlah Siswa': r.target || '' });
    }
    tulisTabel_(ss, 'Rombel', semua);
    catatSekolah_(ss, d.id ? 'ubah rombel' : 'tambah rombel', r.nama + ' (kelas ' + r.kelas + ')');
    return { ok: true, rombel: r, pesan: 'Rombel ' + labelRombel_(r) + ' tersimpan.' };
  });
}

function hapusRombel_(npsn, id) {
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var ta = aturSekolah_(ss).tahunAjaran;
    id = teks_(id);
    var isi = bacaTabel_(ss, 'Anggota Rombel').filter(function (a) {
      return teks_(a['ID Rombel']) === id && teks_(a['Tahun Ajaran']) === ta;
    }).length;
    if (isi) return { ok: false, pesan: 'Rombel masih berisi ' + isi + ' siswa. Kosongkan daftar siswanya dulu.' };
    var semua = bacaTabel_(ss, 'Rombel');
    var sisa = semua.filter(function (x) { return !(teks_(x['ID Rombel']) === id && teks_(x['Tahun Ajaran']) === ta); });
    if (sisa.length === semua.length) return { ok: false, pesan: 'Rombel tidak ditemukan. Muat ulang halaman.' };
    tulisTabel_(ss, 'Rombel', sisa);
    catatSekolah_(ss, 'hapus rombel', id);
    return { ok: true, pesan: 'Rombel dihapus.' };
  });
}

/* ---------- aksi: siswa ---------- */

function siswaDariBaris_(r) {
  var s = {};
  Object.keys(KOLOM_SISWA).forEach(function (k) { s[k] = teks_(r[KOLOM_SISWA[k]]); });
  return s;
}

function siswaRombel_(npsn, rombelId) {
  var ss = bukaSekolah_(npsn);
  var atur = aturSekolah_(ss);
  rombelId = teks_(rombelId);
  var rombel = daftarRombel_(ss, atur.tahunAjaran).filter(function (r) { return r.id === rombelId; })[0];
  if (!rombel) return { ok: false, pesan: 'Rombel tidak ditemukan. Muat ulang halaman.' };
  var siswa = {};
  bacaTabel_(ss, 'Siswa').forEach(function (r) { siswa[teks_(r['ID Siswa'])] = r; });
  var daftar = bacaTabel_(ss, 'Anggota Rombel')
    .filter(function (a) { return teks_(a['ID Rombel']) === rombelId && teks_(a['Tahun Ajaran']) === atur.tahunAjaran; })
    .sort(function (a, b) { return Number(a['No Urut']) - Number(b['No Urut']); })
    .filter(function (a) { return siswa[teks_(a['ID Siswa'])]; })
    .map(function (a) {
      var s = siswaDariBaris_(siswa[teks_(a['ID Siswa'])]);
      s.seni = teks_(a['Seni Pilihan']);
      return s;
    });
  return { ok: true, rombel: rombel, siswa: daftar, seni: atur.seni };
}

/**
 * Menyimpan daftar siswa satu rombel (urutan daftar = nomor urut).
 * Siswa yang dihapus dari daftar hanya keluar dari rombel ini; datanya tetap tersimpan.
 */
function simpanSiswa_(npsn, rombelId, daftar, jumlah) {
  var ss = bukaSekolah_(npsn);
  if (!Array.isArray(daftar)) return { ok: false, pesan: 'Daftar siswa tidak valid.' };
  if (daftar.length > MAKS_SISWA_ROMBEL) return { ok: false, pesan: 'Satu rombel maksimal ' + MAKS_SISWA_ROMBEL + ' siswa.' };
  var target = jumlah === undefined ? undefined : cekJumlahSiswa_(jumlah);
  if (target === null) return { ok: false, pesan: 'Jumlah siswa harus angka 1 sampai ' + MAKS_SISWA_ROMBEL + '.' };
  if (target && daftar.length > target) {
    return { ok: false, pesan: 'Siswa yang diisi (' + daftar.length + ') lebih banyak dari jumlah siswa rombel (' + target + '). Periksa daftar atau perbarui jumlah siswa.' };
  }
  return denganKunci_(function () {
    var atur = aturSekolah_(ss);
    var ta = atur.tahunAjaran;
    rombelId = teks_(rombelId);
    var rombel = daftarRombel_(ss, ta).filter(function (r) { return r.id === rombelId; })[0];
    if (!rombel) return { ok: false, pesan: 'Rombel tidak ditemukan. Muat ulang halaman.' };
    // Data siswa (nama, agama, seni) ikut tercetak di rapor: dikunci bila rapor semester berjalan sudah final.
    cekTerkunci_(ss, ta, atur.semester, rombel);

    var tahun = new Date().getFullYear();
    var salah = [];
    var bersih = daftar.map(function (d, i) {
      var n = normalisasiSiswa_(d, atur.seni, tahun);
      if (!n.siswa.seni && atur.seni.length === 1) n.siswa.seni = atur.seni[0]; // sekolah dengan satu seni: terisi otomatis
      n.salah.forEach(function (x) { salah.push('Baris ' + (i + 1) + (n.siswa.nama ? ' (' + n.siswa.nama + ')' : '') + ': ' + x); });
      return n.siswa;
    });
    salah = salah.concat(cekDaftarSiswa_(bersih, { seniDitawarkan: atur.seni }));

    var semuaSiswa = bacaTabel_(ss, 'Siswa');
    var anggota = bacaTabel_(ss, 'Anggota Rombel');
    var namaRombel = {};
    daftarRombel_(ss, ta).forEach(function (r) { namaRombel[r.id] = labelRombel_(r); });
    var rombelSiswa = {};
    anggota.forEach(function (a) {
      if (teks_(a['Tahun Ajaran']) === ta && teks_(a['ID Rombel']) !== rombelId) rombelSiswa[teks_(a['ID Siswa'])] = teks_(a['ID Rombel']);
    });
    var adaId = {}, nisnLain = {}, nisLain = {};
    semuaSiswa.forEach(function (r) { adaId[teks_(r['ID Siswa'])] = r; });
    var idDaftar = {};
    bersih.forEach(function (s) { if (s.id) idDaftar[s.id] = true; });
    // Siswa yang diketik/ditempel ulang (tanpa ID) tetapi NISN-nya (atau NIS bila NISN kosong) cocok dengan
    // siswa tersimpan yang belum masuk rombel lain disambungkan ke data lamanya, bukan dibuat dobel.
    // Contoh: siswa dihapus dari 5A lalu ditempel di 5B.
    bersih.forEach(function (s) {
      if (s.id || (!s.nisn && !s.nis)) return;
      var cocok = semuaSiswa.filter(function (r) {
        var id = teks_(r['ID Siswa']);
        if (idDaftar[id] || rombelSiswa[id]) return false;
        return s.nisn ? teks_(r.NISN) === s.nisn : teks_(r.NIS) === s.nis;
      })[0];
      if (cocok) {
        s.id = teks_(cocok['ID Siswa']);
        idDaftar[s.id] = true;
        cocok.Status = 'Aktif';
      }
    });
    semuaSiswa.forEach(function (r) {
      var id = teks_(r['ID Siswa']);
      if (idDaftar[id] || teks_(r.Status) !== 'Aktif') return;
      if (teks_(r.NISN)) nisnLain[teks_(r.NISN)] = r;
      if (teks_(r.NIS)) nisLain[teks_(r.NIS)] = r;
    });
    bersih.forEach(function (s, i) {
      var baris = 'Baris ' + (i + 1) + (s.nama ? ' (' + s.nama + ')' : '') + ': ';
      if (s.id && !adaId[s.id]) salah.push(baris + 'data siswa tidak ditemukan. Muat ulang halaman.');
      if (s.id && rombelSiswa[s.id]) salah.push(baris + 'siswa ini sudah terdaftar di ' + (namaRombel[rombelSiswa[s.id]] || 'rombel lain') + '.');
      var lain = s.nisn && nisnLain[s.nisn];
      if (lain) salah.push(baris + 'NISN sudah dipakai ' + teks_(lain['Nama Lengkap']) + (rombelSiswa[teks_(lain['ID Siswa'])] ? ' di ' + namaRombel[rombelSiswa[teks_(lain['ID Siswa'])]] : '') + '.');
      lain = s.nis && nisLain[s.nis];
      if (lain) salah.push(baris + 'NIS sudah dipakai ' + teks_(lain['Nama Lengkap']) + '.');
    });
    if (salah.length) return { ok: false, salah: salah, pesan: salah[0] };

    var dipakai = {};
    Object.keys(adaId).forEach(function (id) { dipakai[id] = true; });
    bersih.forEach(function (s) {
      var r;
      if (s.id) r = adaId[s.id];
      else {
        s.id = idBaru_('S', dipakai);
        dipakai[s.id] = true;
        r = { Status: 'Aktif', 'Keterangan Status': '' };
        semuaSiswa.push(r);
      }
      Object.keys(KOLOM_SISWA).forEach(function (k) { r[KOLOM_SISWA[k]] = s[k]; });
    });
    tulisTabel_(ss, 'Siswa', semuaSiswa);

    var sisa = anggota.filter(function (a) { return !(teks_(a['ID Rombel']) === rombelId && teks_(a['Tahun Ajaran']) === ta); });
    bersih.forEach(function (s, i) {
      sisa.push({ 'Tahun Ajaran': ta, 'ID Rombel': rombelId, 'ID Siswa': s.id, 'No Urut': i + 1, 'Seni Pilihan': s.seni });
    });
    tulisTabel_(ss, 'Anggota Rombel', sisa);
    if (target !== undefined && target !== rombel.target) {
      var semuaRombel = bacaTabel_(ss, 'Rombel');
      semuaRombel.forEach(function (r) {
        if (teks_(r['ID Rombel']) === rombelId && teks_(r['Tahun Ajaran']) === ta) r['Jumlah Siswa'] = target || '';
      });
      tulisTabel_(ss, 'Rombel', semuaRombel);
      rombel.target = target;
    }
    catatSekolah_(ss, 'simpan siswa', rombel.nama + ': ' + bersih.length + ' siswa' + (rombel.target ? ' dari ' + rombel.target : ''));

    var tanpaSeni = bersih.filter(function (s) { return !s.seni; }).length;
    var kurang = rombel.target ? rombel.target - bersih.length : 0;
    return {
      ok: true, siswa: bersih, target: rombel.target,
      pesan: bersih.length + ' siswa ' + labelRombel_(rombel) + ' tersimpan.' +
        (kurang > 0 ? ' Catatan: masih kurang ' + kurang + ' siswa dari jumlah siswa rombel (' + rombel.target + ').' : '') +
        (tanpaSeni ? ' Catatan: ' + tanpaSeni + ' siswa belum memilih seni (wajib diisi sebelum cetak rapor).' : '')
    };
  });
}

/* ---------- aksi: mata pelajaran per kelas ---------- */

/** Baris Mapel Aktif satu tahun ajaran → daftar mapel dengan status aktif per kelas: { kelas: { 5: true, … } }. */
function kelompokMapel_(baris) {
  var urut = [], per = {};
  baris.forEach(function (r) {
    var kode = teks_(r['Kode Mapel']);
    if (!per[kode]) {
      var bawaan = mapelBawaan_(kode);
      per[kode] = {
        kode: kode, nama: teks_(r['Nama di Rapor']), jenis: teks_(r.Jenis), urutan: Number(r.Urutan) || 99,
        pilihan: !!(bawaan && bawaan.pilihan), kelas: {}
      };
      urut.push(per[kode]);
    }
    per[kode].kelas[Number(r.Kelas)] = teks_(r.Aktif) === 'Ya';
  });
  return urut.sort(function (a, b) { return a.urutan - b.urutan || (a.kode < b.kode ? -1 : 1); });
}

/**
 * Memeriksa perubahan mapel. lama = kelompokMapel_(...), isian = [{ kode, nama, kelas: { 1: true, … } }],
 * bernilai = { 'BING|5': true } (mapel di kelas yang sudah punya nilai).
 * Hasil: { salah[], mapel[] } — mapel berisi keadaan akhir semua mapel (yang tidak dikirim tetap seperti lama).
 * Mapel wajib selalu aktif. Muatan lokal yang aktif wajib diberi nama sungguhan (bukan "Muatan Lokal 1").
 */
function cekMapel_(lama, isian, bernilai) {
  var salah = [];
  var akhir = lama.map(function (m) { return { kode: m.kode, nama: m.nama, jenis: m.jenis, urutan: m.urutan, pilihan: m.pilihan, kelas: Object.assign({}, m.kelas) }; });
  var urutanMaks = akhir.reduce(function (x, m) { return Math.max(x, m.urutan); }, 0);
  (Array.isArray(isian) ? isian : []).forEach(function (d) {
    var kode = teks_(d && d.kode).toUpperCase();
    var bawaan = mapelBawaan_(kode);
    if (!bawaan) { salah.push('Mapel "' + kode + '" tidak dikenal.'); return; }
    var m = akhir.filter(function (x) { return x.kode === kode; })[0];
    if (!m) {
      if (bawaan.jenis !== 'mulok') { salah.push('Mapel ' + bawaan.nama + ' tidak dikenal di spreadsheet sekolah.'); return; }
      m = { kode: kode, nama: bawaan.nama, jenis: 'mulok', urutan: ++urutanMaks, pilihan: true, kelas: {}, baru: true };
      bawaan.kelas.forEach(function (k) { m.kelas[k] = false; });
      akhir.push(m);
    }
    var minta = (d && d.kelas) || {};
    Object.keys(m.kelas).forEach(function (k) {
      var mau = minta[k] === true;
      if (!m.pilihan) { m.kelas[k] = true; return; }
      if (m.kelas[k] && !mau && bernilai[kode + '|' + k]) {
        salah.push(m.nama + ' kelas ' + k + ' sudah punya nilai, jadi tidak bisa dinonaktifkan.');
        return;
      }
      m.kelas[k] = mau;
    });
    if (m.jenis === 'mulok') {
      var nama = teks_(d.nama);
      var aktif = Object.keys(m.kelas).some(function (k) { return m.kelas[k]; });
      if (nama) m.nama = nama;
      if (aktif && (!nama || /^muatan lokal \d+$/i.test(nama))) salah.push('Beri nama muatan lokal yang diajarkan (misalnya Bahasa Jawa), bukan "' + (nama || m.nama) + '".');
      else if (nama.length > 60) salah.push('Nama muatan lokal maksimal 60 karakter.');
    }
  });
  var namaDipakai = {};
  akhir.forEach(function (m) {
    var aktif = Object.keys(m.kelas).some(function (k) { return m.kelas[k]; });
    if (!aktif) return;
    var kunci = m.nama.toLowerCase();
    if (namaDipakai[kunci]) salah.push('Nama mapel "' + m.nama + '" dipakai dua kali.');
    namaDipakai[kunci] = true;
  });
  return { salah: salah, mapel: akhir };
}

/** { 'KODE|kelas': true } untuk mapel yang sudah punya nilai tersimpan di tahun ajaran ini. */
function mapelBernilai_(ss, ta) {
  var kelasRombel = {}, kelasSiswa = {}, ada = {};
  daftarRombel_(ss, ta).forEach(function (r) { kelasRombel[r.id] = r.kelas; });
  bacaTabel_(ss, 'Anggota Rombel').forEach(function (a) {
    if (teks_(a['Tahun Ajaran']) === ta) kelasSiswa[teks_(a['ID Siswa'])] = kelasRombel[teks_(a['ID Rombel'])];
  });
  bacaTabel_(ss, 'Nilai').forEach(function (n) {
    if (teks_(n['Tahun Ajaran']) !== ta || teks_(n.Nilai) === '') return;
    var k = kelasSiswa[teks_(n['ID Siswa'])];
    if (k) ada[teks_(n['Kode Mapel']) + '|' + k] = true;
  });
  return ada;
}

function mapelSekolah_(npsn) {
  var ss = bukaSekolah_(npsn);
  var ta = aturSekolah_(ss).tahunAjaran;
  var baris = bacaTabel_(ss, 'Mapel Aktif').filter(function (r) { return teks_(r['Tahun Ajaran']) === ta; });
  return { ok: true, tahunAjaran: ta, mapel: kelompokMapel_(baris), maksMulok: MAKS_MULOK };
}

function simpanMapel_(npsn, isian) {
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var ta = aturSekolah_(ss).tahunAjaran;
    var semua = bacaTabel_(ss, 'Mapel Aktif');
    var baris = semua.filter(function (r) { return teks_(r['Tahun Ajaran']) === ta; });
    var cek = cekMapel_(kelompokMapel_(baris), isian, mapelBernilai_(ss, ta));
    if (cek.salah.length) return { ok: false, salah: cek.salah, pesan: cek.salah[0] };
    var berubah = {};
    cek.mapel.forEach(function (m) {
      Object.keys(m.kelas).forEach(function (k) {
        var r = baris.filter(function (x) { return teks_(x['Kode Mapel']) === m.kode && Number(x.Kelas) === Number(k); })[0];
        if (!r) {
          r = { 'Tahun Ajaran': ta, Kelas: Number(k), 'Kode Mapel': m.kode, Jenis: m.jenis, Urutan: m.urutan };
          semua.push(r);
        }
        if (teks_(r['Nama di Rapor']) !== m.nama || teks_(r.Aktif) !== (m.kelas[k] ? 'Ya' : 'Tidak')) berubah[Number(k)] = true;
        r['Nama di Rapor'] = m.nama;
        r.Aktif = m.kelas[k] ? 'Ya' : 'Tidak';
      });
    });
    Object.keys(berubah).forEach(function (k) { cekKelasTerkunci_(ss, ta, 0, Number(k)); });
    tulisTabel_(ss, 'Mapel Aktif', semua);
    catatSekolah_(ss, 'ubah mapel', cek.mapel.filter(function (m) { return m.pilihan; }).map(function (m) {
      return m.nama + ': ' + Object.keys(m.kelas).filter(function (k) { return m.kelas[k]; }).join(',');
    }).join('; '));
    return { ok: true, mapel: kelompokMapel_(bacaTabel_(ss, 'Mapel Aktif').filter(function (r) { return teks_(r['Tahun Ajaran']) === ta; })),
      pesan: 'Mata pelajaran tersimpan. Hanya mapel yang dicentang yang muncul di input nilai dan rapor.' };
  });
}

/* ---------- aksi: unduh salinan Excel ---------- */

function unduhExcel_(npsn) {
  var s = cariSekolah_('npsn', npsn);
  if (!s || !s.spreadsheet) throw galatPengguna_('Spreadsheet sekolah tidak ditemukan. Hubungi pengelola aplikasi.');
  var res = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + s.spreadsheet + '/export?format=xlsx', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw galatPengguna_('Berkas Excel gagal disiapkan. Coba lagi beberapa saat lagi.');
  var tanggal = normalisasiTanggal_(new Date());
  return {
    ok: true,
    nama: 'Rapor - ' + s.nama.replace(/[\\\/:*?"<>|]/g, '') + ' (' + s.npsn + ') ' + tanggal + '.xlsx',
    data: Utilities.base64Encode(res.getBlob().getBytes())
  };
}
