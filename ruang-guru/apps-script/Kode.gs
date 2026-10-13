/**
 * Sistem Pendataan Bantuan Siswa — SD N BUGANGIN
 * Backend Google Apps Script untuk halaman sdnbugangin.github.io/ruang-guru/
 *
 * Cara pasang (sekali saja):
 * 1. Buat Google Sheet baru, beri nama "Database Bantuan Siswa".
 * 2. Menu Ekstensi → Apps Script. Hapus isi Kode.gs, tempel seluruh berkas ini, simpan.
 * 3. Pilih fungsi "siapkan" di toolbar, klik Jalankan, lalu izinkan akses.
 * 4. Deploy → Deployment baru → Jenis: Aplikasi web.
 *    Jalankan sebagai: Saya. Yang memiliki akses: Siapa saja. Klik Deploy.
 * 5. Salin URL Aplikasi web (berakhiran /exec), tempel ke API_URL di ruang-guru/index.html.
 *
 * Kata sandi dan ID spreadsheet presensi diatur di sheet "Pengaturan", bukan di kode ini.
 *
 * Memperbarui kode (misalnya setelah fitur Prestasi ditambahkan):
 * tempel kode baru, simpan, jalankan "siapkan" sekali (izinkan akses Google Drive untuk foto),
 * lalu Deploy → Kelola deployment → ikon pensil → Versi: Versi baru → Deploy. URL tetap sama.
 */

var SHEET = {
  profil: 'Data Kelayakan',
  bantuan: 'Riwayat Bantuan',
  atur: 'Pengaturan',
  log: 'Log Perubahan',
  prestasi: 'Prestasi'
};

var KOLOM_PROFIL = ['ID Siswa', 'Kelas', 'Nama Siswa', 'Desil DTSEN', 'Status Aplikasi PIP',
  'Yatim/Piatu', 'Panti Asuhan', 'Berkebutuhan Khusus', 'Ortu PHK', 'Ortu Narapidana', 'ABH/LPKA',
  'Anak ASN', 'Mampu', 'Catatan', 'Diubah Oleh', 'Diubah Pada'];
var KOLOM_BANTUAN = ['ID', 'Tahun', 'ID Siswa', 'Kelas', 'Nama Siswa', 'Jenis Bantuan', 'Bulan',
  'Nominal', 'Keterangan', 'Dicatat Oleh', 'Dicatat Pada'];
var KOLOM_LOG = ['Waktu', 'Oleh', 'Aksi', 'ID Siswa', 'Nama Siswa', 'Rincian'];
var KOLOM_PRESTASI = ['ID', 'Tanggal', 'Siswa', 'Siswa (data)', 'Cabang Lomba', 'Nama Lomba', 'Penyelenggara',
  'Tingkat', 'Juara', 'Guru Pembimbing', 'ID Foto', 'Izin Foto Ortu', 'Tampilkan di Beranda', 'Dicatat Oleh', 'Dicatat Pada'];
var TINGKAT = ['Sekolah', 'Gugus', 'Kecamatan', 'Kabupaten', 'Provinsi', 'Nasional', 'Internasional'];
var JUARA = ['Juara 1', 'Juara 2', 'Juara 3', 'Harapan 1', 'Harapan 2', 'Harapan 3', 'Juara Umum', 'Finalis'];

var FLAG = ['yatim', 'panti', 'abk', 'phk', 'napi', 'abh', 'asn', 'mampu'];
var JENIS = ['PIP', 'BAZNAS', 'Santunan Yatim Piatu'];
var STATUS_PIP = ['', 'Dapat diusulkan', 'Tidak valid', 'Sedang diusulkan', 'Sudah SK'];

/* ---------- penyiapan ---------- */

function siapkan() {
  var ss = SpreadsheetApp.getActive();
  buatSheet_(ss, SHEET.profil, KOLOM_PROFIL);
  buatSheet_(ss, SHEET.bantuan, KOLOM_BANTUAN);
  buatSheet_(ss, SHEET.log, KOLOM_LOG);
  buatSheet_(ss, SHEET.prestasi, KOLOM_PRESTASI);
  var atur = buatSheet_(ss, SHEET.atur, ['Kunci', 'Nilai', 'Keterangan']);
  var bawaan = [
    ['Password Bantuan', 'sdsuper', 'Kata sandi untuk membuka halaman Bantuan Siswa. Ganti di sini kapan saja.'],
    ['ID Spreadsheet Presensi', '1lKVS4dI4afo0__O4UkHQhdWlfB2NwCuL9cYXsS_5Ap8', 'Daftar siswa diambil dari sheet "Master Siswa" di spreadsheet ini.'],
    ['Tahun Bantuan', '2026', 'Tahun yang dihitung untuk "sudah menerima bantuan".'],
    ['Folder Foto Prestasi', '', 'ID folder Google Drive tempat foto prestasi disimpan. Diisi otomatis oleh "siapkan".']
  ];
  var ada = atur.getDataRange().getValues().map(function (r) { return r[0]; });
  bawaan.forEach(function (b) { if (ada.indexOf(b[0]) < 0) atur.appendRow(b); });
  if (!pengaturan_().folderFoto) {
    var folder = DriveApp.createFolder('Foto Prestasi SD N BUGANGIN');
    var rows = atur.getDataRange().getValues();
    for (var i = 0; i < rows.length; i++) if (rows[i][0] === 'Folder Foto Prestasi') atur.getRange(i + 1, 2).setValue(folder.getId());
  }
  var awal = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1');
  if (awal && ss.getSheets().length > 1 && awal.getLastRow() === 0) ss.deleteSheet(awal);
  daftarSiswa_(); // memastikan spreadsheet presensi bisa dibaca (memicu izin)
}

function buatSheet_(ss, nama, kolom) {
  var sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
  if (sh.getLastRow() === 0) {
    sh.appendRow(kolom);
    sh.getRange(1, 1, 1, kolom.length).setFontWeight('bold').setBackground('#12314f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function pengaturan_() {
  var nilai = {};
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET.atur);
  if (sh) sh.getDataRange().getValues().forEach(function (r) { nilai[String(r[0]).trim()] = String(r[1]).trim(); });
  return {
    sandi: nilai['Password Bantuan'] || 'sdsuper',
    presensiId: nilai['ID Spreadsheet Presensi'] || '1lKVS4dI4afo0__O4UkHQhdWlfB2NwCuL9cYXsS_5Ap8',
    tahun: Number(nilai['Tahun Bantuan']) || new Date().getFullYear(),
    folderFoto: nilai['Folder Foto Prestasi'] || ''
  };
}

/* ---------- web app ---------- */

function doGet(e) {
  if (e && e.parameter && e.parameter.aksi === 'prestasi') return json_(prestasiPublik_());
  return json_({ ok: true, pesan: 'Layanan Ruang Guru SD N BUGANGIN aktif.' });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, pesan: 'Permintaan tidak valid.' }); }
  var cek = cekSandi_(req.sandi);
  if (!cek.ok) return json_(cek);
  var oleh = String(req.oleh || '').trim().slice(0, 60);
  try {
    switch (req.aksi) {
      case 'masuk': return json_({ ok: true });
      case 'data': return json_(ambilData_());
      case 'simpanProfil': return json_(denganKunci_(function () { return simpanProfil_(req.data, oleh); }));
      case 'tambahBantuan': return json_(denganKunci_(function () { return tambahBantuan_(req.data, oleh); }));
      case 'hapusBantuan': return json_(denganKunci_(function () { return hapusBantuan_(req.id, oleh); }));
      case 'simpanPrestasi': return json_(denganKunci_(function () { return simpanPrestasi_(req.data, oleh); }));
      case 'hapusPrestasi': return json_(denganKunci_(function () { return hapusPrestasi_(req.id, oleh); }));
      default: return json_({ ok: false, pesan: 'Aksi tidak dikenal.' });
    }
  } catch (err) {
    return json_({ ok: false, pesan: 'Terjadi kesalahan: ' + err.message });
  }
}

function cekSandi_(sandi) {
  var cache = CacheService.getScriptCache();
  var gagal = Number(cache.get('gagal') || 0);
  if (gagal >= 20) return { ok: false, sandiSalah: true, pesan: 'Terlalu banyak percobaan kata sandi. Coba lagi 10 menit lagi.' };
  if (String(sandi || '') === pengaturan_().sandi) return { ok: true };
  cache.put('gagal', String(gagal + 1), 600);
  return { ok: false, sandiSalah: true, pesan: 'Kata sandi salah.' };
}

function denganKunci_(fn) {
  var kunci = LockService.getScriptLock();
  kunci.waitLock(20000);
  try { return fn(); } finally { kunci.releaseLock(); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- baca data ---------- */

function daftarSiswa_() {
  var sh = SpreadsheetApp.openById(pengaturan_().presensiId).getSheetByName('Master Siswa');
  if (!sh) throw new Error('Sheet "Master Siswa" tidak ditemukan di spreadsheet presensi.');
  var rows = sh.getDataRange().getValues();
  var h = rows.shift().map(function (x) { return String(x).trim(); });
  var iId = h.indexOf('ID Siswa'), iKelas = h.indexOf('Kelas'), iUrut = h.indexOf('No Urut Abjad'),
    iNama = h.indexOf('Nama Lengkap'), iAktif = h.indexOf('Status Aktif');
  return rows.filter(function (r) {
    return r[iId] && r[iNama] && (iAktif < 0 || String(r[iAktif]).trim().toLowerCase() === 'aktif');
  }).map(function (r) {
    return { id: String(r[iId]).trim(), kelas: String(r[iKelas]).trim(), urut: Number(r[iUrut]) || 0, nama: String(r[iNama]).trim() };
  });
}

function bacaProfil_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET.profil);
  var peta = {};
  sh.getDataRange().getValues().slice(1).forEach(function (r, i) {
    if (!r[0]) return;
    peta[String(r[0])] = {
      baris: i + 2,
      desil: r[3] === '' ? '' : Number(r[3]),
      statusPip: String(r[4] || ''),
      yatim: r[5] === true, panti: r[6] === true, abk: r[7] === true, phk: r[8] === true,
      napi: r[9] === true, abh: r[10] === true, asn: r[11] === true, mampu: r[12] === true,
      catatan: String(r[13] || ''),
      diubahOleh: String(r[14] || ''),
      diubahPada: r[15] instanceof Date ? r[15].toISOString() : String(r[15] || '')
    };
  });
  return peta;
}

function bacaBantuan_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET.bantuan);
  return sh.getDataRange().getValues().slice(1).filter(function (r) { return r[0]; }).map(function (r, i) {
    return {
      id: String(r[0]), tahun: Number(r[1]), siswa: String(r[2]), jenis: String(r[5]),
      bulan: Number(r[6]), nominal: Number(r[7]) || 0, ket: String(r[8] || ''), oleh: String(r[9] || '')
    };
  });
}

function ambilData_() {
  var profil = bacaProfil_();
  var siswa = daftarSiswa_().map(function (s) {
    var p = profil[s.id] || {};
    delete p.baris;
    s.profil = p;
    return s;
  });
  return { ok: true, tahun: pengaturan_().tahun, siswa: siswa, bantuan: bacaBantuan_(), prestasi: bacaPrestasi_(),
    pilihan: { tingkat: TINGKAT, juara: JUARA }, diambil: new Date().toISOString() };
}

/* ---------- tulis data ---------- */

function cariSiswa_(id) {
  var s = daftarSiswa_().filter(function (x) { return x.id === id; })[0];
  if (!s) throw new Error('Siswa tidak ditemukan atau tidak aktif.');
  return s;
}

function simpanProfil_(d, oleh) {
  if (!oleh) return { ok: false, pesan: 'Isi nama Anda dulu.' };
  var s = cariSiswa_(String(d.id || ''));
  var desil = d.desil === '' || d.desil == null ? '' : Math.round(Number(d.desil));
  if (desil !== '' && !(desil >= 1 && desil <= 10)) return { ok: false, pesan: 'Desil harus 1 sampai 10.' };
  var status = STATUS_PIP.indexOf(d.statusPip) >= 0 ? d.statusPip : '';
  var baris = [s.id, s.kelas, s.nama, desil, status];
  FLAG.forEach(function (f) { baris.push(d[f] === true); });
  baris.push(String(d.catatan || '').slice(0, 500), oleh, new Date());

  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET.profil);
  var lama = bacaProfil_()[s.id];
  if (lama) sh.getRange(lama.baris, 1, 1, baris.length).setValues([baris]);
  else sh.appendRow(baris);
  catat_(oleh, 'Simpan kelayakan', s, ringkasProfil_(baris));
  return { ok: true };
}

function ringkasProfil_(b) {
  var nama = ['Yatim/Piatu', 'Panti', 'ABK', 'Ortu PHK', 'Ortu Napi', 'ABH', 'ASN', 'Mampu'];
  var tanda = nama.filter(function (n, i) { return b[5 + i] === true; });
  return 'Desil ' + (b[3] === '' ? '-' : b[3]) + '; Status PIP: ' + (b[4] || '-') + '; ' + (tanda.join(', ') || 'tanpa tanda');
}

function tambahBantuan_(d, oleh) {
  if (!oleh) return { ok: false, pesan: 'Isi nama Anda dulu.' };
  var s = cariSiswa_(String(d.siswa || ''));
  if (JENIS.indexOf(d.jenis) < 0) return { ok: false, pesan: 'Jenis bantuan tidak dikenal.' };
  var bulan = (d.bulan || []).map(Number).filter(function (b) { return b >= 1 && b <= 12; });
  if (!bulan.length) return { ok: false, pesan: 'Pilih minimal satu bulan.' };
  var nominal = Math.round(Number(d.nominal));
  if (!(nominal > 0)) return { ok: false, pesan: 'Isi nominal bantuan (lebih dari 0).' };
  var tahun = pengaturan_().tahun;
  var ada = bacaBantuan_().filter(function (b) { return b.siswa === s.id && b.jenis === d.jenis && b.tahun === tahun; })
    .map(function (b) { return b.bulan; });
  var baru = bulan.filter(function (b) { return ada.indexOf(b) < 0; });
  if (!baru.length) return { ok: false, pesan: 'Bulan yang dipilih sudah tercatat untuk bantuan ini.' };
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET.bantuan);
  var ket = String(d.ket || '').slice(0, 200);
  var rows = baru.map(function (b) {
    return [Utilities.getUuid(), tahun, s.id, s.kelas, s.nama, d.jenis, b, nominal, ket, oleh, new Date()];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  catat_(oleh, 'Tambah bantuan', s, d.jenis + ' bulan ' + baru.join(',') + ' @Rp' + nominal);
  return { ok: true, dilewati: bulan.length - baru.length };
}

function hapusBantuan_(id, oleh) {
  if (!oleh) return { ok: false, pesan: 'Isi nama Anda dulu.' };
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET.bantuan);
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      var r = rows[i];
      sh.deleteRow(i + 1);
      catat_(oleh, 'Hapus bantuan', { id: r[2], nama: r[4] }, r[5] + ' bulan ' + r[6] + ' @Rp' + r[7]);
      return { ok: true };
    }
  }
  return { ok: false, pesan: 'Data bantuan tidak ditemukan (mungkin sudah dihapus).' };
}

function catat_(oleh, aksi, s, rincian) {
  SpreadsheetApp.getActive().getSheetByName(SHEET.log).appendRow([new Date(), oleh, aksi, s.id, s.nama, rincian]);
}

/* ---------- prestasi ---------- */

function sheetPrestasi_() {
  return buatSheet_(SpreadsheetApp.getActive(), SHEET.prestasi, KOLOM_PRESTASI);
}

function teksTanggal_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Jakarta', 'yyyy-MM-dd');
  return String(v || '');
}

function bacaPrestasi_() {
  return sheetPrestasi_().getDataRange().getValues().slice(1).filter(function (r) { return r[0]; }).map(function (r) {
    var siswa = [];
    try { siswa = JSON.parse(r[3] || '[]'); } catch (err) {}
    return {
      id: String(r[0]), tanggal: teksTanggal_(r[1]), siswa: siswa, cabang: String(r[4] || ''), lomba: String(r[5] || ''),
      penyelenggara: String(r[6] || ''), tingkat: String(r[7] || ''), juara: String(r[8] || ''), pembimbing: String(r[9] || ''),
      foto: String(r[10] || ''), izinFoto: r[11] === true, tampilkan: r[12] === true, oleh: String(r[13] || '')
    };
  }).sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0; });
}

function prestasiPublik_() {
  var cache = CacheService.getScriptCache();
  var simpan = cache.get('prestasi-publik');
  if (simpan) return JSON.parse(simpan);
  var hasil = {
    ok: true,
    prestasi: bacaPrestasi_().filter(function (p) { return p.tampilkan; }).map(function (p) {
      return {
        tanggal: p.tanggal, siswa: p.siswa.map(function (s) { return { nama: s.nama, kelas: s.kelas }; }),
        cabang: p.cabang, lomba: p.lomba, penyelenggara: p.penyelenggara, tingkat: p.tingkat, juara: p.juara,
        pembimbing: p.pembimbing, foto: p.foto && p.izinFoto ? p.foto : ''
      };
    }),
    diambil: new Date().toISOString()
  };
  cache.put('prestasi-publik', JSON.stringify(hasil), 300);
  return hasil;
}

function simpanPrestasi_(d, oleh) {
  if (!oleh) return { ok: false, pesan: 'Isi nama Anda dulu.' };
  d = d || {};
  var semua = {};
  daftarSiswa_().forEach(function (s) { semua[s.id] = s; });
  var siswa = (d.siswa || []).map(function (id) { return semua[String(id)]; }).filter(Boolean)
    .map(function (s) { return { id: s.id, nama: s.nama, kelas: s.kelas }; });
  String(d.namaLain || '').split(/[,;\n]/).map(function (n) { return n.trim().slice(0, 80); }).filter(Boolean)
    .forEach(function (n) { siswa.push({ id: '', nama: n, kelas: String(d.kelasLain || '').slice(0, 20) }); });
  if (!siswa.length) return { ok: false, pesan: 'Pilih minimal satu nama siswa.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.tanggal || ''))) return { ok: false, pesan: 'Isi tanggal lomba.' };
  var cabang = String(d.cabang || '').trim().slice(0, 100);
  if (!cabang) return { ok: false, pesan: 'Isi cabang lomba.' };
  if (TINGKAT.indexOf(d.tingkat) < 0) return { ok: false, pesan: 'Pilih tingkat lomba.' };
  if (JUARA.indexOf(d.juara) < 0) return { ok: false, pesan: 'Pilih juara yang diraih.' };
  var izin = d.izinFoto === true;
  if (d.foto && !izin) return { ok: false, pesan: 'Centang dulu "Orang tua sudah mengizinkan foto ditampilkan".' };

  var sh = sheetPrestasi_();
  var rows = sh.getDataRange().getValues();
  var baris = 0, lama = null;
  if (d.id) {
    for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === String(d.id)) { baris = i + 1; lama = rows[i]; break; }
    if (!baris) return { ok: false, pesan: 'Data prestasi tidak ditemukan (mungkin sudah dihapus).' };
  }
  var fotoId = lama ? String(lama[10] || '') : '';
  if ((d.hapusFoto || d.foto) && fotoId) { buangFoto_(fotoId); fotoId = ''; }
  if (d.foto) fotoId = simpanFoto_(d.foto, siswa[0].nama + ' - ' + cabang);

  var nilai = [d.id || Utilities.getUuid(), d.tanggal,
    siswa.map(function (s) { return s.nama + (s.kelas ? ' (' + s.kelas + ')' : ''); }).join('; '),
    JSON.stringify(siswa), cabang, String(d.lomba || '').trim().slice(0, 150), String(d.penyelenggara || '').trim().slice(0, 100),
    d.tingkat, d.juara, String(d.pembimbing || '').trim().slice(0, 100), fotoId, izin, d.tampilkan === true, oleh, new Date()];
  if (baris) sh.getRange(baris, 1, 1, nilai.length).setValues([nilai]);
  else sh.appendRow(nilai);
  CacheService.getScriptCache().remove('prestasi-publik');
  catat_(oleh, baris ? 'Ubah prestasi' : 'Tambah prestasi', { id: '', nama: nilai[2] }, d.juara + ' ' + cabang + ' tingkat ' + d.tingkat);
  return { ok: true };
}

function hapusPrestasi_(id, oleh) {
  if (!oleh) return { ok: false, pesan: 'Isi nama Anda dulu.' };
  var sh = sheetPrestasi_();
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      if (rows[i][10]) buangFoto_(String(rows[i][10]));
      sh.deleteRow(i + 1);
      CacheService.getScriptCache().remove('prestasi-publik');
      catat_(oleh, 'Hapus prestasi', { id: '', nama: rows[i][2] }, rows[i][8] + ' ' + rows[i][4]);
      return { ok: true };
    }
  }
  return { ok: false, pesan: 'Data prestasi tidak ditemukan (mungkin sudah dihapus).' };
}

function simpanFoto_(dataUrl, nama) {
  var m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(dataUrl));
  if (!m) throw new Error('Format foto tidak dikenali. Pilih foto JPG atau PNG.');
  var bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 3 * 1024 * 1024) throw new Error('Foto terlalu besar.');
  var folderId = pengaturan_().folderFoto;
  if (!folderId) throw new Error('Folder foto belum dibuat. Jalankan fungsi "siapkan" sekali di Apps Script.');
  var file = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes, m[1], nama.slice(0, 80) + '.jpg'));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getId();
}

function buangFoto_(id) {
  try { DriveApp.getFileById(id).setTrashed(true); } catch (err) {}
}
