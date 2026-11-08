/**
 * Sistem Pendataan Bantuan Siswa — SD N BUGANGIN
 * Backend Google Apps Script untuk halaman sdnbugangin.github.io/super-admin/ (Ruang Super Admin)
 *
 * Cara pasang (sekali saja):
 * 1. Buat Google Sheet baru, beri nama "Database Bantuan Siswa".
 * 2. Menu Ekstensi → Apps Script. Hapus isi Kode.gs, tempel seluruh berkas ini, simpan.
 * 3. Pilih fungsi "siapkan" di toolbar, klik Jalankan, lalu izinkan akses.
 * 4. Deploy → Deployment baru → Jenis: Aplikasi web.
 *    Jalankan sebagai: Saya. Yang memiliki akses: Siapa saja. Klik Deploy.
 * 5. Salin URL Aplikasi web (berakhiran /exec), tempel ke API_URL di super-admin/index.html.
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
  prestasi: 'Prestasi',
  kabar: 'Kabar Sekolah'
};

var KOLOM_PROFIL = ['ID Siswa', 'Kelas', 'Nama Siswa', 'Desil DTSEN', 'Status Aplikasi PIP',
  'Yatim/Piatu', 'Panti Asuhan', 'Berkebutuhan Khusus', 'Ortu PHK', 'Ortu Narapidana', 'ABH/LPKA',
  'Anak ASN', 'Mampu', 'Catatan', 'Diubah Oleh', 'Diubah Pada', 'NISN', 'Nominasi PIP',
  'Berpotensi Putus Sekolah', 'Jumlah Tanggungan'];
var KOLOM_BANTUAN = ['ID', 'Tahun', 'ID Siswa', 'Kelas', 'Nama Siswa', 'Jenis Bantuan', 'Bulan',
  'Nominal', 'Keterangan', 'Dicatat Oleh', 'Dicatat Pada'];
var KOLOM_LOG = ['Waktu', 'Oleh', 'Aksi', 'ID Siswa', 'Nama Siswa', 'Rincian'];
var KOLOM_PRESTASI = ['ID', 'Tanggal', 'Siswa', 'Siswa (data)', 'Cabang Lomba', 'Nama Lomba', 'Penyelenggara',
  'Tingkat', 'Juara', 'Guru Pembimbing', 'ID Foto', 'Izin Foto Ortu', 'Tampilkan di Beranda', 'Dicatat Oleh', 'Dicatat Pada'];
var KOLOM_KABAR = ['ID', 'Tanggal', 'Judul', 'Isi Artikel', 'Kegiatan', 'Tempat', 'Peserta', 'Rincian', 'Kesan', 'ID Foto',
  'Tampilkan di Beranda', 'Ditulis Oleh', 'Dibuat Pada', 'Diubah Oleh', 'Diubah Pada'];
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
  buatSheet_(ss, SHEET.kabar, KOLOM_KABAR);
  var atur = buatSheet_(ss, SHEET.atur, ['Kunci', 'Nilai', 'Keterangan']);
  var bawaan = [
    ['Password Bantuan', 'sdsuper', 'Kata sandi untuk membuka halaman Bantuan Siswa. Ganti di sini kapan saja.'],
    ['ID Spreadsheet Presensi', '1lKVS4dI4afo0__O4UkHQhdWlfB2NwCuL9cYXsS_5Ap8', 'Daftar siswa diambil dari sheet "Master Siswa" di spreadsheet ini.'],
    ['Tahun Bantuan', '2026', 'Tahun yang dihitung untuk "sudah menerima bantuan".'],
    ['Folder Foto Prestasi', '', 'ID folder Google Drive tempat foto prestasi disimpan. Diisi otomatis oleh "siapkan".'],
    ['Nama Kepala Sekolah', 'YOS PUTRA KURNIAWAN, S.Pd.', 'Untuk tanda tangan di PDF daftar nominasi.'],
    ['NIP Kepala Sekolah', '', 'Untuk tanda tangan di PDF daftar nominasi.'],
    ['Alamat Sekolah', 'Kecamatan Kota Kendal, Kabupaten Kendal, Jawa Tengah', 'Untuk kop PDF.'],
    ['Tampilkan Grafik Bantuan', 'Ya', 'Ya = grafik bantuan tersalurkan (jumlah siswa dan total dana, tanpa nama) tampil di beranda. Tidak = disembunyikan.'],
    ['Batas Samaran Grafik', '3', 'Jumlah penerima di bawah angka ini ditulis "kurang dari 3" di grafik beranda agar siswa tidak bisa ditebak.'],
    ['Batas Tanggungan Banyak', '5', 'Siswa dengan jumlah tanggungan keluarga sebanyak ini atau lebih dihitung "tanggungan banyak" (kriteria pendukung).']
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
  } else {
    // kolom baru ditambahkan di versi kode berikutnya: lengkapi judul kolom
    var judul = sh.getDataRange().getValues()[0].filter(function (x) { return x !== ''; });
    if (judul.length < kolom.length) {
      sh.getRange(1, 1, 1, kolom.length).setValues([kolom]).setFontWeight('bold').setBackground('#12314f').setFontColor('#ffffff');
    }
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
    folderFoto: nilai['Folder Foto Prestasi'] || '',
    batasTanggungan: Number(nilai['Batas Tanggungan Banyak']) || 5,
    grafikTampil: String(nilai['Tampilkan Grafik Bantuan'] || 'Ya').toLowerCase() !== 'tidak',
    batasSamaran: Number(nilai['Batas Samaran Grafik']) || 3,
    sekolah: {
      nama: 'SD NEGERI BUGANGIN',
      alamat: nilai['Alamat Sekolah'] || 'Kecamatan Kota Kendal, Kabupaten Kendal, Jawa Tengah',
      kepsek: nilai['Nama Kepala Sekolah'] || 'YOS PUTRA KURNIAWAN, S.Pd.',
      nip: nilai['NIP Kepala Sekolah'] || ''
    }
  };
}

/* ---------- web app ---------- */

function doGet(e) {
  if (e && e.parameter && e.parameter.aksi === 'prestasi') return json_(prestasiPublik_());
  if (e && e.parameter && e.parameter.aksi === 'kabar') return json_(kabarPublik_());
  if (e && e.parameter && e.parameter.aksi === 'grafikBantuan') return json_(grafikBantuanPublik_());
  return json_({ ok: true, pesan: 'Layanan Ruang Super Admin SD N BUGANGIN aktif.' });
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
      case 'tandai': return json_(denganKunci_(function () { return tandai_(req, oleh); }));
      case 'pdf': return json_(buatPdf_(req));
      case 'simpanKabar': return json_(denganKunci_(function () { return simpanKabar_(req.data, oleh); }));
      case 'hapusKabar': return json_(denganKunci_(function () { return hapusKabar_(req.id, oleh); }));
      case 'simpanPrestasi': return json_(denganKunci_(function () { return simpanPrestasi_(req.data, oleh); }));
      case 'hapusPrestasi': return json_(denganKunci_(function () { return hapusPrestasi_(req.id, oleh); }));
      case 'tumbuhKelas': return json_(tumbuhKelas_(req));
      case 'simpanTumbuh': return json_(denganKunci_(function () { return simpanTumbuh_(req, oleh); }));
      case 'laporanKelas': return json_(laporanKelas_(req));
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
  var sh = sheetProfil_();
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
      diubahPada: r[15] instanceof Date ? r[15].toISOString() : String(r[15] || ''),
      nisn: String(r[16] || '').replace(/^'/, ''),
      nominasi: r[17] === true,
      putus: r[18] === true,
      tanggungan: r[19] === '' || r[19] == null ? '' : Number(r[19])
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
  return { ok: true, tahun: pengaturan_().tahun, siswa: siswa, bantuan: bacaBantuan_(), prestasi: bacaPrestasi_(), kabar: bacaKabar_(),
    pilihan: { tingkat: TINGKAT, juara: JUARA }, sekolah: pengaturan_().sekolah, aturan: { batasTanggungan: pengaturan_().batasTanggungan }, diambil: new Date().toISOString() };
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
  var nisn = String(d.nisn || '').replace(/\D/g, '');
  if (nisn && nisn.length !== 10) return { ok: false, pesan: 'NISN harus 10 angka.' };
  var tanggungan = d.tanggungan === '' || d.tanggungan == null ? '' : Math.round(Number(d.tanggungan));
  if (tanggungan !== '' && !(tanggungan >= 1 && tanggungan <= 30)) return { ok: false, pesan: 'Jumlah tanggungan harus 1 sampai 30 orang.' };
  var lama = bacaProfil_()[s.id];
  var baris = [s.id, s.kelas, s.nama, desil, status];
  FLAG.forEach(function (f) { baris.push(d[f] === true); });
  baris.push(String(d.catatan || '').slice(0, 500), oleh, new Date(), nisn ? "'" + nisn : '', lama ? lama.nominasi : false,
    d.putus === true, tanggungan);

  var sh = sheetProfil_();
  if (lama) sh.getRange(lama.baris, 1, 1, baris.length).setValues([baris]);
  else sh.appendRow(baris);
  catat_(oleh, 'Simpan kelayakan', s, ringkasProfil_(baris));
  return { ok: true };
}

function ringkasProfil_(b) {
  var nama = ['Yatim/Piatu', 'Panti', 'ABK', 'Ortu PHK', 'Ortu Napi', 'ABH', 'ASN', 'Mampu'];
  var tanda = nama.filter(function (n, i) { return b[5 + i] === true; });
  if (b[18] === true) tanda.unshift('Berpotensi putus sekolah');
  if (b[19] !== '') tanda.push('Tanggungan ' + b[19] + ' orang');
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
  CacheService.getScriptCache().remove('grafik-bantuan');
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
      CacheService.getScriptCache().remove('grafik-bantuan');
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

/* ---------- nominasi PIP & PDF ---------- */

function sheetProfil_() {
  return buatSheet_(SpreadsheetApp.getActive(), SHEET.profil, KOLOM_PROFIL);
}

/* Tandai beberapa siswa sekaligus: kolom 'nominasi' (true/false) atau 'statusPip'. */
function tandai_(req, oleh) {
  if (!oleh) return { ok: false, pesan: 'Isi nama Anda dulu.' };
  var ids = (req.ids || []).map(String).slice(0, 300);
  if (!ids.length) return { ok: false, pesan: 'Tidak ada siswa yang dipilih.' };
  var kolom, nilai;
  if (req.kolom === 'nominasi') { kolom = 18; nilai = req.nilai === true; }
  else if (req.kolom === 'statusPip' && STATUS_PIP.indexOf(req.nilai) >= 0) { kolom = 5; nilai = req.nilai; }
  else return { ok: false, pesan: 'Tanda tidak dikenal.' };
  var semua = {};
  daftarSiswa_().forEach(function (s) { semua[s.id] = s; });
  var sh = sheetProfil_(), profil = bacaProfil_(), waktu = new Date(), nama = [];
  ids.forEach(function (id) {
    var s = semua[id];
    if (!s) return;
    var p = profil[id];
    if (!p) {
      var baru = [s.id, s.kelas, s.nama, '', ''];
      FLAG.forEach(function () { baru.push(false); });
      baru.push('', oleh, waktu, '', false, false, '');
      baru[kolom - 1] = nilai;
      sh.appendRow(baru);
    } else {
      sh.getRange(p.baris, kolom).setValue(nilai);
      sh.getRange(p.baris, 15, 1, 2).setValues([[oleh, waktu]]);
    }
    nama.push(s.nama);
  });
  if (!nama.length) return { ok: false, pesan: 'Siswa tidak ditemukan atau tidak aktif.' };
  catat_(oleh, req.kolom === 'nominasi' ? (nilai ? 'Masukkan nominasi PIP' : 'Keluarkan dari nominasi PIP') : 'Status PIP: ' + nilai,
    { id: ids.join(','), nama: nama.join('; ') }, nama.length + ' siswa');
  return { ok: true, jumlah: nama.length };
}

/* Ubah dokumen HTML (dibuat di halaman Ruang Super Admin) menjadi PDF. */
function buatPdf_(req) {
  var html = String(req.html || '');
  if (!html || html.length > 1500000) return { ok: false, pesan: 'Dokumen kosong atau terlalu besar.' };
  var nama = String(req.nama || 'Dokumen').replace(/[^\w\- ]+/g, '').slice(0, 80) || 'Dokumen';
  var pdf = Utilities.newBlob(html, 'text/html', nama + '.html').getAs('application/pdf');
  return { ok: true, nama: nama + '.pdf', base64: Utilities.base64Encode(pdf.getBytes()) };
}

/* ---------- kabar sekolah (artikel kegiatan) ---------- */

function sheetKabar_() {
  return buatSheet_(SpreadsheetApp.getActive(), SHEET.kabar, KOLOM_KABAR);
}

function bacaKabar_() {
  return sheetKabar_().getDataRange().getValues().slice(1).filter(function (r) { return r[0]; }).map(function (r) {
    var foto = [];
    try { foto = JSON.parse(r[9] || '[]'); } catch (err) {}
    return {
      id: String(r[0]), tanggal: teksTanggal_(r[1]), judul: String(r[2] || ''), isi: String(r[3] || ''),
      kegiatan: String(r[4] || ''), tempat: String(r[5] || ''), peserta: String(r[6] || ''), rincian: String(r[7] || ''),
      kesan: String(r[8] || ''), foto: foto, tampilkan: r[10] === true, penulis: String(r[11] || ''),
      diubahOleh: String(r[13] || '')
    };
  }).sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0; });
}

function kabarPublik_() {
  var cache = CacheService.getScriptCache();
  var simpan = cache.get('kabar-publik');
  if (simpan) return JSON.parse(simpan);
  var hasil = {
    ok: true,
    kabar: bacaKabar_().filter(function (k) { return k.tampilkan; }).map(function (k) {
      return { id: k.id, tanggal: k.tanggal, judul: k.judul, isi: k.isi, foto: k.foto, penulis: k.penulis };
    }),
    diambil: new Date().toISOString()
  };
  var teks = JSON.stringify(hasil);
  if (teks.length < 90000) cache.put('kabar-publik', teks, 300);
  return hasil;
}

function simpanKabar_(d, oleh) {
  if (!oleh) return { ok: false, pesan: 'Isi nama Anda dulu.' };
  d = d || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.tanggal || ''))) return { ok: false, pesan: 'Isi tanggal kegiatan.' };
  var judul = String(d.judul || '').trim().slice(0, 150);
  var isi = String(d.isi || '').trim().slice(0, 20000);
  if (!judul) return { ok: false, pesan: 'Judul artikel masih kosong. Tekan "Susun Artikel Otomatis" atau tulis judulnya.' };
  if (isi.length < 40) return { ok: false, pesan: 'Isi artikel terlalu pendek. Tekan "Susun Artikel Otomatis" atau tulis isinya.' };

  var sh = sheetKabar_();
  var rows = sh.getDataRange().getValues();
  var baris = 0, lama = null;
  if (d.id) {
    for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === String(d.id)) { baris = i + 1; lama = rows[i]; break; }
    if (!baris) return { ok: false, pesan: 'Artikel tidak ditemukan (mungkin sudah dihapus).' };
  }
  var foto = [];
  if (lama) { try { foto = JSON.parse(lama[9] || '[]'); } catch (err) {} }
  var buang = (d.hapusFoto || []).map(String);
  foto = foto.filter(function (id) { if (buang.indexOf(id) >= 0) { buangFoto_(id); return false; } return true; });
  var baru = (d.fotoBaru || []).slice(0, Math.max(0, 4 - foto.length));
  baru.forEach(function (f, n) { foto.push(simpanFoto_(f, 'Kabar - ' + judul.slice(0, 50) + ' ' + (foto.length + 1))); });

  var waktu = new Date();
  var nilai = [d.id || Utilities.getUuid(), d.tanggal, judul, isi,
    String(d.kegiatan || '').slice(0, 150), String(d.tempat || '').slice(0, 150), String(d.peserta || '').slice(0, 300),
    String(d.rincian || '').slice(0, 2000), String(d.kesan || '').slice(0, 2000), JSON.stringify(foto), d.tampilkan === true,
    lama ? lama[11] : oleh, lama ? lama[12] : waktu, oleh, waktu];
  if (baris) sh.getRange(baris, 1, 1, nilai.length).setValues([nilai]);
  else sh.appendRow(nilai);
  CacheService.getScriptCache().remove('kabar-publik');
  catat_(oleh, baris ? 'Ubah kabar' : 'Tulis kabar', { id: '', nama: '' }, judul);
  return { ok: true, id: nilai[0] };
}

function hapusKabar_(id, oleh) {
  if (!oleh) return { ok: false, pesan: 'Isi nama Anda dulu.' };
  var sh = sheetKabar_();
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      try { JSON.parse(rows[i][9] || '[]').forEach(buangFoto_); } catch (err) {}
      sh.deleteRow(i + 1);
      CacheService.getScriptCache().remove('kabar-publik');
      catat_(oleh, 'Hapus kabar', { id: '', nama: '' }, rows[i][2]);
      return { ok: true };
    }
  }
  return { ok: false, pesan: 'Artikel tidak ditemukan (mungkin sudah dihapus).' };
}

/* ---------- grafik bantuan untuk beranda (publik, tanpa nama) ---------- */

/* Per tahun per jenis: jumlah siswa penerima (unik) dan total dana. Jumlah siswa di bawah
   batas samaran tidak dikirim, hanya ditandai "kecil", agar penerima tidak bisa ditebak. */
function grafikBantuanPublik_() {
  var atur = pengaturan_();
  if (!atur.grafikTampil) return { ok: true, tampil: false };
  var cache = CacheService.getScriptCache();
  var simpan = cache.get('grafik-bantuan');
  if (simpan) return JSON.parse(simpan);
  var peta = {};
  bacaBantuan_().forEach(function (b) {
    if (!b.tahun || JENIS.indexOf(b.jenis) < 0) return;
    var k = b.tahun + '|' + b.jenis;
    if (!peta[k]) peta[k] = { tahun: b.tahun, jenis: b.jenis, siswa: {}, dana: 0 };
    peta[k].siswa[b.siswa] = true;
    peta[k].dana += b.nominal;
  });
  var data = Object.keys(peta).map(function (k) {
    var x = peta[k], n = Object.keys(x.siswa).length;
    return n < atur.batasSamaran
      ? { tahun: x.tahun, jenis: x.jenis, siswa: null, kecil: true, dana: x.dana }
      : { tahun: x.tahun, jenis: x.jenis, siswa: n, kecil: false, dana: x.dana };
  }).sort(function (a, b) { return a.tahun - b.tahun || JENIS.indexOf(a.jenis) - JENIS.indexOf(b.jenis); });
  var hasil = { ok: true, tampil: true, jenis: JENIS, batasSamaran: atur.batasSamaran, data: data, diambil: new Date().toISOString() };
  cache.put('grafik-bantuan', JSON.stringify(hasil), 600);
  return hasil;
}

/* =====================================================================
 * TUMBUH KEMBANG — berat & tinggi badan bulanan (diukur minggu pertama)
 * ===================================================================== */

var KOLOM_TUMBUH = ['ID Siswa', 'Kelas', 'Nama Siswa', 'Tahun Ajaran', 'Bulan', 'Tanggal Ukur', 'Berat (kg)', 'Tinggi (cm)',
  'Dicatat Oleh', 'Dicatat Pada'];
var BATAS_UKUR = { bbMin: 10, bbMaks: 100, tbMin: 80, tbMaks: 190 };

/** Tahun ajaran untuk tanggal: Juli–Desember → "t/t+1", Januari–Juni → "t-1/t". */
function tahunAjaranDari_(d) {
  var t = d.getFullYear(), b = d.getMonth() + 1;
  return b >= 7 ? t + '/' + (t + 1) : (t - 1) + '/' + t;
}

/** Bulan-bulan satu tahun ajaran: ["2026-07", …, "2027-06"]. */
function bulanTahunAjaran_(ta) {
  var t = Number(String(ta).split('/')[0]), hasil = [];
  for (var i = 0; i < 12; i++) {
    var b = 7 + i, th = t + (b > 12 ? 1 : 0);
    b = b > 12 ? b - 12 : b;
    hasil.push(th + '-' + (b < 10 ? '0' : '') + b);
  }
  return hasil;
}

/** "72,5" / 72.5 / '' → angka atau null; bukan angka → NaN. */
function angkaUkur_(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  return isFinite(n) ? Math.round(n * 10) / 10 : NaN;
}

/**
 * Memeriksa isian satu siswa. lalu = { bb, tb } pengukuran sebelumnya (boleh null).
 * Hasil: { bb, tb, salah: '', peringatan: '' }. Salah → tidak boleh disimpan; peringatan → tetap disimpan.
 */
function cekUkur_(isi, lalu) {
  var bb = angkaUkur_(isi && isi.bb), tb = angkaUkur_(isi && isi.tb), salah = '', peringatan = '';
  if (isNaN(bb)) salah = 'berat badan bukan angka';
  else if (isNaN(tb)) salah = 'tinggi badan bukan angka';
  else if ((bb === null) !== (tb === null)) salah = 'berat dan tinggi harus diisi keduanya';
  else if (bb !== null && (bb < BATAS_UKUR.bbMin || bb > BATAS_UKUR.bbMaks)) salah = 'berat badan ' + bb + ' kg di luar kewajaran (' + BATAS_UKUR.bbMin + '–' + BATAS_UKUR.bbMaks + ' kg)';
  else if (tb !== null && (tb < BATAS_UKUR.tbMin || tb > BATAS_UKUR.tbMaks)) salah = 'tinggi badan ' + tb + ' cm di luar kewajaran (' + BATAS_UKUR.tbMin + '–' + BATAS_UKUR.tbMaks + ' cm)';
  else if (bb !== null && lalu) {
    if (lalu.tb && tb < lalu.tb - 1) peringatan = 'tinggi turun dari ' + lalu.tb + ' cm';
    else if (lalu.bb && Math.abs(bb - lalu.bb) > 5) peringatan = 'berat berubah lebih dari 5 kg (sebelumnya ' + lalu.bb + ' kg)';
  }
  return { bb: bb, tb: tb, salah: salah, peringatan: peringatan };
}

/** "Kelas 4" tetap; "4" → "Kelas 4". */
function namaKelas_(k) { return /^kelas\b/i.test(String(k)) ? String(k) : 'Kelas ' + k; }

function sheetTumbuh_() { return buatSheet_(SpreadsheetApp.getActive(), 'Tumbuh Kembang', KOLOM_TUMBUH); }

/* ---------- Status gizi ---------- */
/** Rujukan WHO 2007 umur 61–228 bulan (dasar Permenkes No. 2 Tahun 2020): L,M,S per bulan, dipisah ";", mulai bulan ke-61. */
var RUJUKAN_WHO = {
  imtL: '-0.7387,15.2641,0.0839;-0.7621,15.2616,0.08414;-0.7856,15.2604,0.08439;-0.8089,15.2605,0.08464;-0.8322,15.2619,0.0849;-0.8554,15.2645,0.08516;-0.8785,15.2684,0.08543;-0.9015,15.2737,0.0857;-0.9243,15.2801,0.08597;-0.9471,15.2877,0.08625;-0.9697,15.2965,0.08653;-0.9921,15.3062,0.08682;-1.0144,15.3169,0.08711;-1.0365,15.3285,0.08741;-1.0584,15.3408,0.08771;-1.0801,15.354,0.08802;-1.1017,15.3679,0.08833;-1.123,15.3825,0.08865;-1.1441,15.3978,0.08898;-1.1649,15.4137,0.08931;-1.1856,15.4302,0.08964;-1.206,15.4473,0.08998;-1.2261,15.465,0.09033;-1.246,15.4832,0.09068;-1.2656,15.5019,0.09103;-1.2849,15.521,0.09139;-1.304,15.5407,0.09176;-1.3228,15.5608,0.09213;-1.3414,15.5814,0.09251;-1.3596,15.6023,0.09289;-1.3776,15.6237,0.09327;-1.3953,15.6455,0.09366;-1.4126,15.6677,0.09406;-1.4297,15.6903,0.09445;-1.4464,15.7133,0.09486;-1.4629,15.7368,0.09526;-1.479,15.7606,0.09567;-1.4947,15.7848,0.09609;-1.5101,15.8094,0.09651;-1.5252,15.8344,0.09693;-1.5399,15.8597,0.09735;-1.5542,15.8855,0.09778;-1.5681,15.9116,0.09821;-1.5817,15.9381,0.09864;-1.5948,15.9651,0.09907;-1.6076,15.9925,0.09951;-1.6199,16.0205,0.09994;-1.6318,16.049,0.10038;-1.6433,16.0781,0.10082;-1.6544,16.1078,0.10126;-1.6651,16.1381,0.1017;-1.6753,16.1692,0.10214;-1.6851,16.2009,0.10259;-1.6944,16.2333,0.10303;-1.7032,16.2665,0.10347;-1.7116,16.3004,0.10391;-1.7196,16.3351,0.10435;-1.7271,16.3704,0.10478;-1.7341,16.4065,0.10522;-1.7407,16.4433,0.10566;-1.7468,16.4807,0.10609;-1.7525,16.5189,0.10652;-1.7578,16.5578,0.10695;-1.7626,16.5974,0.10738;-1.767,16.6376,0.1078;-1.771,16.6786,0.10823;-1.7745,16.7203,0.10865;-1.7777,16.7628,0.10906;-1.7804,16.8059,0.10948;-1.7828,16.8497,0.10989;-1.7847,16.8941,0.1103;-1.7862,16.9392,0.1107;-1.7873,16.985,0.1111;-1.7881,17.0314,0.1115;-1.7884,17.0784,0.11189;-1.7884,17.1262,0.11228;-1.788,17.1746,0.11266;-1.7873,17.2236,0.11304;-1.7861,17.2734,0.11342;-1.7846,17.324,0.11379;-1.7828,17.3752,0.11415;-1.7806,17.4272,0.11451;-1.778,17.4799,0.11487;-1.7751,17.5334,0.11522;-1.7719,17.5877,0.11556;-1.7684,17.6427,0.1159;-1.7645,17.6985,0.11623;-1.7604,17.7551,0.11656;-1.7559,17.8124,0.11688;-1.7511,17.8704,0.1172;-1.7461,17.9292,0.11751;-1.7408,17.9887,0.11781;-1.7352,18.0488,0.11811;-1.7293,18.1096,0.11841;-1.7232,18.171,0.11869;-1.7168,18.233,0.11898;-1.7102,18.2955,0.11925;-1.7033,18.3586,0.11952;-1.6962,18.4221,0.11979;-1.6888,18.486,0.12005;-1.6811,18.5502,0.1203;-1.6732,18.6148,0.12055;-1.6651,18.6795,0.12079;-1.6568,18.7445,0.12102;-1.6482,18.8095,0.12125;-1.6394,18.8746,0.12148;-1.6304,18.9398,0.1217;-1.6211,19.005,0.12191;-1.6116,19.0701,0.12212;-1.602,19.1351,0.12233;-1.5921,19.2,0.12253;-1.5821,19.2648,0.12272;-1.5719,19.3294,0.12291;-1.5615,19.3937,0.1231;-1.551,19.4578,0.12328;-1.5403,19.5217,0.12346;-1.5294,19.5853,0.12363;-1.5185,19.6486,0.1238;-1.5074,19.7117,0.12396;-1.4961,19.7744,0.12412;-1.4848,19.8367,0.12428;-1.4733,19.8987,0.12443;-1.4617,19.9603,0.12458;-1.45,20.0215,0.12473;-1.4382,20.0823,0.12487;-1.4263,20.1427,0.12501;-1.4143,20.2026,0.12514;-1.4022,20.2621,0.12528;-1.39,20.3211,0.12541;-1.3777,20.3796,0.12554;-1.3653,20.4376,0.12567;-1.3529,20.4951,0.12579;-1.3403,20.5521,0.12591;-1.3277,20.6085,0.12603;-1.3149,20.6644,0.12615;-1.3021,20.7197,0.12627;-1.2892,20.7745,0.12638;-1.2762,20.8287,0.1265;-1.2631,20.8824,0.12661;-1.2499,20.9355,0.12672;-1.2366,20.9881,0.12683;-1.2233,21.04,0.12694;-1.2098,21.0914,0.12704;-1.1962,21.1423,0.12715;-1.1826,21.1925,0.12726;-1.1688,21.2423,0.12736;-1.155,21.2914,0.12746;-1.141,21.34,0.12756;-1.127,21.388,0.12767;-1.1129,21.4354,0.12777;-1.0986,21.4822,0.12787;-1.0843,21.5285,0.12797;-1.0699,21.5742,0.12807;-1.0553,21.6193,0.12816;-1.0407,21.6638,0.12826;-1.026,21.7077,0.12836;-1.0112,21.751,0.12845;-0.9962,21.7937,0.12855;-0.9812,21.8358,0.12864;-0.9661,21.8773,0.12874;-0.9509,21.9182,0.12883;-0.9356,21.9585,0.12893;-0.9202,21.9982,0.12902;-0.9048,22.0374,0.12911;-0.8892,22.076,0.1292;-0.8735,22.114,0.1293;-0.8578,22.1514,0.12939;-0.8419,22.1883,0.12948',
  imtP: '-0.8886,15.2441,0.09692;-0.9068,15.2434,0.09738;-0.9248,15.2433,0.09783;-0.9427,15.2438,0.09829;-0.9605,15.2448,0.09875;-0.978,15.2464,0.0992;-0.9954,15.2487,0.09966;-1.0126,15.2516,0.10012;-1.0296,15.2551,0.10058;-1.0464,15.2592,0.10104;-1.063,15.2641,0.10149;-1.0794,15.2697,0.10195;-1.0956,15.276,0.10241;-1.1115,15.2831,0.10287;-1.1272,15.2911,0.10333;-1.1427,15.2998,0.10379;-1.1579,15.3095,0.10425;-1.1728,15.32,0.10471;-1.1875,15.3314,0.10517;-1.2019,15.3439,0.10562;-1.216,15.3572,0.10608;-1.2298,15.3717,0.10654;-1.2433,15.3871,0.107;-1.2565,15.4036,0.10746;-1.2693,15.4211,0.10792;-1.2819,15.4397,0.10837;-1.2941,15.4593,0.10883;-1.306,15.4798,0.10929;-1.3175,15.5014,0.10974;-1.3287,15.524,0.1102;-1.3395,15.5476,0.11065;-1.3499,15.5723,0.1111;-1.36,15.5979,0.11156;-1.3697,15.6246,0.11201;-1.379,15.6523,0.11246;-1.388,15.681,0.11291;-1.3966,15.7107,0.11335;-1.4047,15.7415,0.1138;-1.4125,15.7732,0.11424;-1.4199,15.8058,0.11469;-1.427,15.8394,0.11513;-1.4336,15.8738,0.11557;-1.4398,15.909,0.11601;-1.4456,15.9451,0.11644;-1.4511,15.9818,0.11688;-1.4561,16.0194,0.11731;-1.4607,16.0575,0.11774;-1.465,16.0964,0.11816;-1.4688,16.1358,0.11859;-1.4723,16.1759,0.11901;-1.4753,16.2166,0.11943;-1.478,16.258,0.11985;-1.4803,16.2999,0.12026;-1.4823,16.3425,0.12067;-1.4838,16.3858,0.12108;-1.485,16.4298,0.12148;-1.4859,16.4746,0.12188;-1.4864,16.52,0.12228;-1.4866,16.5663,0.12268;-1.4864,16.6133,0.12307;-1.4859,16.6612,0.12346;-1.4851,16.71,0.12384;-1.4839,16.7595,0.12422;-1.4825,16.81,0.1246;-1.4807,16.8614,0.12497;-1.4787,16.9136,0.12534;-1.4763,16.9667,0.12571;-1.4737,17.0208,0.12607;-1.4708,17.0757,0.12643;-1.4677,17.1316,0.12678;-1.4642,17.1883,0.12713;-1.4606,17.2459,0.12748;-1.4567,17.3044,0.12782;-1.4526,17.3637,0.12816;-1.4482,17.4238,0.12849;-1.4436,17.4847,0.12882;-1.4389,17.5464,0.12914;-1.4339,17.6088,0.12946;-1.4288,17.6719,0.12978;-1.4235,17.7357,0.13009;-1.418,17.8001,0.1304;-1.4123,17.8651,0.1307;-1.4065,17.9306,0.13099;-1.4006,17.9966,0.13129;-1.3945,18.063,0.13158;-1.3883,18.1297,0.13186;-1.3819,18.1967,0.13214;-1.3755,18.2639,0.13241;-1.3689,18.3312,0.13268;-1.3621,18.3986,0.13295;-1.3553,18.466,0.13321;-1.3483,18.5333,0.13347;-1.3413,18.6006,0.13372;-1.3341,18.6677,0.13397;-1.3269,18.7346,0.13421;-1.3195,18.8012,0.13445;-1.3121,18.8675,0.13469;-1.3046,18.9335,0.13492;-1.297,18.9991,0.13514;-1.2894,19.0642,0.13537;-1.2816,19.1289,0.13559;-1.2739,19.1931,0.1358;-1.2661,19.2567,0.13601;-1.2583,19.3197,0.13622;-1.2504,19.382,0.13642;-1.2425,19.4437,0.13662;-1.2345,19.5045,0.13681;-1.2266,19.5647,0.137;-1.2186,19.624,0.13719;-1.2107,19.6824,0.13738;-1.2027,19.74,0.13756;-1.1947,19.7966,0.13774;-1.1867,19.8523,0.13791;-1.1788,19.907,0.13808;-1.1708,19.9607,0.13825;-1.1629,20.0133,0.13841;-1.1549,20.0648,0.13858;-1.147,20.1152,0.13873;-1.139,20.1644,0.13889;-1.1311,20.2125,0.13904;-1.1232,20.2595,0.1392;-1.1153,20.3053,0.13934;-1.1074,20.3499,0.13949;-1.0996,20.3934,0.13963;-1.0917,20.4357,0.13977;-1.0838,20.4769,0.13991;-1.076,20.517,0.14005;-1.0681,20.556,0.14018;-1.0603,20.5938,0.14031;-1.0525,20.6306,0.14044;-1.0447,20.6663,0.14057;-1.0368,20.7008,0.1407;-1.029,20.7344,0.14082;-1.0212,20.7668,0.14094;-1.0134,20.7982,0.14106;-1.0055,20.8286,0.14118;-0.9977,20.858,0.1413;-0.9898,20.8863,0.14142;-0.9819,20.9137,0.14153;-0.974,20.9401,0.14164;-0.9661,20.9656,0.14176;-0.9582,20.9901,0.14187;-0.9503,21.0138,0.14198;-0.9423,21.0367,0.14208;-0.9344,21.0587,0.14219;-0.9264,21.0801,0.1423;-0.9184,21.1007,0.1424;-0.9104,21.1206,0.1425;-0.9024,21.1399,0.14261;-0.8944,21.1586,0.14271;-0.8863,21.1768,0.14281;-0.8783,21.1944,0.14291;-0.8703,21.2116,0.14301;-0.8623,21.2282,0.14311;-0.8542,21.2444,0.1432;-0.8462,21.2603,0.1433;-0.8382,21.2757,0.1434;-0.8301,21.2908,0.14349;-0.8221,21.3055,0.14359;-0.814,21.32,0.14368;-0.806,21.3341,0.14377;-0.798,21.348,0.14386;-0.7899,21.3617,0.14396;-0.7819,21.3752,0.14405;-0.7738,21.3884,0.14414;-0.7658,21.4014,0.14423;-0.7577,21.4143,0.14432;-0.7496,21.4269,0.14441',
  tbL: '1,110.2647,0.04164;1,110.8006,0.04172;1,111.3338,0.0418;1,111.8636,0.04187;1,112.3895,0.04195;1,112.911,0.04203;1,113.428,0.04211;1,113.941,0.04218;1,114.45,0.04226;1,114.9547,0.04234;1,115.4549,0.04241;1,115.9509,0.04249;1,116.4432,0.04257;1,116.9325,0.04264;1,117.4196,0.04272;1,117.9046,0.0428;1,118.388,0.04287;1,118.87,0.04295;1,119.3508,0.04303;1,119.8303,0.04311;1,120.3085,0.04318;1,120.7853,0.04326;1,121.2604,0.04334;1,121.7338,0.04342;1,122.2053,0.0435;1,122.675,0.04358;1,123.1429,0.04366;1,123.6092,0.04374;1,124.0736,0.04382;1,124.5361,0.0439;1,124.9964,0.04398;1,125.4545,0.04406;1,125.9104,0.04414;1,126.364,0.04422;1,126.8156,0.0443;1,127.2651,0.04438;1,127.7129,0.04446;1,128.159,0.04454;1,128.6034,0.04462;1,129.0466,0.0447;1,129.4887,0.04478;1,129.93,0.04487;1,130.3705,0.04495;1,130.8103,0.04503;1,131.2495,0.04511;1,131.6884,0.04519;1,132.1269,0.04527;1,132.5652,0.04535;1,133.0031,0.04543;1,133.4404,0.04551;1,133.877,0.04559;1,134.313,0.04566;1,134.7483,0.04574;1,135.1829,0.04582;1,135.6168,0.04589;1,136.0501,0.04597;1,136.4829,0.04604;1,136.9153,0.04612;1,137.3474,0.04619;1,137.7795,0.04626;1,138.2119,0.04633;1,138.6452,0.0464;1,139.0797,0.04647;1,139.5158,0.04654;1,139.954,0.04661;1,140.3948,0.04667;1,140.8387,0.04674;1,141.2859,0.0468;1,141.7368,0.04686;1,142.1916,0.04692;1,142.6501,0.04698;1,143.1126,0.04703;1,143.5795,0.04709;1,144.0511,0.04714;1,144.5276,0.04719;1,145.0093,0.04723;1,145.4964,0.04728;1,145.9891,0.04732;1,146.4878,0.04736;1,146.9927,0.0474;1,147.5041,0.04744;1,148.0224,0.04747;1,148.5478,0.0475;1,149.0807,0.04753;1,149.6212,0.04755;1,150.1694,0.04758;1,150.7256,0.04759;1,151.2899,0.04761;1,151.8623,0.04762;1,152.4425,0.04763;1,153.0298,0.04763;1,153.6234,0.04764;1,154.2223,0.04763;1,154.8258,0.04763;1,155.4329,0.04762;1,156.0426,0.0476;1,156.6539,0.04758;1,157.266,0.04756;1,157.8775,0.04754;1,158.4871,0.04751;1,159.0937,0.04747;1,159.6962,0.04744;1,160.2939,0.0474;1,160.8861,0.04735;1,161.472,0.0473;1,162.0505,0.04725;1,162.6207,0.0472;1,163.1816,0.04714;1,163.7321,0.04707;1,164.2717,0.04701;1,164.7994,0.04694;1,165.3145,0.04687;1,165.8165,0.04679;1,166.305,0.04671;1,166.7799,0.04663;1,167.2415,0.04655;1,167.6899,0.04646;1,168.1255,0.04637;1,168.5482,0.04628;1,168.958,0.04619;1,169.3549,0.04609;1,169.7389,0.04599;1,170.1099,0.04589;1,170.468,0.04579;1,170.8136,0.04569;1,171.1468,0.04559;1,171.468,0.04548;1,171.7773,0.04538;1,172.0748,0.04527;1,172.3606,0.04516;1,172.6345,0.04506;1,172.8967,0.04495;1,173.147,0.04484;1,173.3856,0.04473;1,173.6126,0.04462;1,173.828,0.04451;1,174.0321,0.0444;1,174.2251,0.04429;1,174.4071,0.04418;1,174.5784,0.04407;1,174.7392,0.04396;1,174.8896,0.04385;1,175.0301,0.04375;1,175.1609,0.04364;1,175.2824,0.04353;1,175.3951,0.04343;1,175.4995,0.04332;1,175.5959,0.04322;1,175.685,0.04311;1,175.7672,0.04301;1,175.8432,0.04291;1,175.9133,0.04281;1,175.9781,0.04271;1,176.038,0.04261;1,176.0935,0.04251;1,176.1449,0.04241;1,176.1925,0.04232;1,176.2368,0.04222;1,176.2779,0.04213;1,176.3162,0.04204;1,176.3518,0.04195;1,176.3851,0.04185;1,176.4162,0.04177;1,176.4453,0.04168;1,176.4724,0.04159;1,176.4976,0.0415;1,176.5211,0.04142;1,176.5432,0.04134',
  tbP: '1,109.6016,0.04355;1,110.1258,0.04364;1,110.6451,0.04373;1,111.1596,0.04382;1,111.6696,0.0439;1,112.1753,0.04399;1,112.6767,0.04407;1,113.174,0.04415;1,113.6672,0.04423;1,114.1565,0.04431;1,114.6421,0.04439;1,115.1244,0.04447;1,115.6039,0.04454;1,116.0812,0.04461;1,116.5568,0.04469;1,117.0311,0.04475;1,117.5044,0.04482;1,117.9769,0.04489;1,118.4489,0.04495;1,118.9208,0.04502;1,119.3926,0.04508;1,119.8648,0.04514;1,120.3374,0.0452;1,120.8105,0.04525;1,121.2843,0.04531;1,121.7587,0.04536;1,122.2338,0.04542;1,122.7098,0.04547;1,123.1868,0.04551;1,123.6646,0.04556;1,124.1435,0.04561;1,124.6234,0.04565;1,125.1045,0.04569;1,125.5869,0.04573;1,126.0706,0.04577;1,126.5558,0.04581;1,127.0424,0.04585;1,127.5304,0.04588;1,128.0199,0.04591;1,128.5109,0.04594;1,129.0035,0.04597;1,129.4975,0.046;1,129.9932,0.04602;1,130.4904,0.04604;1,130.9891,0.04607;1,131.4895,0.04608;1,131.9912,0.0461;1,132.4944,0.04612;1,132.9989,0.04613;1,133.5046,0.04614;1,134.0118,0.04615;1,134.5202,0.04616;1,135.0299,0.04616;1,135.541,0.04617;1,136.0533,0.04617;1,136.567,0.04616;1,137.0821,0.04616;1,137.5987,0.04616;1,138.1167,0.04615;1,138.6363,0.04614;1,139.1575,0.04612;1,139.6803,0.04611;1,140.2049,0.04609;1,140.7313,0.04607;1,141.2594,0.04605;1,141.7892,0.04603;1,142.3206,0.046;1,142.8534,0.04597;1,143.3874,0.04594;1,143.9222,0.04591;1,144.4575,0.04588;1,144.9929,0.04584;1,145.528,0.0458;1,146.0622,0.04576;1,146.5951,0.04571;1,147.1262,0.04567;1,147.6548,0.04562;1,148.1804,0.04557;1,148.7023,0.04552;1,149.2197,0.04546;1,149.7322,0.04541;1,150.239,0.04535;1,150.7394,0.04529;1,151.2327,0.04523;1,151.7182,0.04516;1,152.1951,0.0451;1,152.6628,0.04503;1,153.1206,0.04497;1,153.5678,0.0449;1,154.0041,0.04483;1,154.429,0.04476;1,154.8423,0.04468;1,155.2437,0.04461;1,155.633,0.04454;1,156.0101,0.04446;1,156.3748,0.04439;1,156.7269,0.04431;1,157.0666,0.04423;1,157.3936,0.04415;1,157.7082,0.04408;1,158.0102,0.044;1,158.2997,0.04392;1,158.5771,0.04384;1,158.8425,0.04376;1,159.0961,0.04369;1,159.3382,0.04361;1,159.5691,0.04353;1,159.789,0.04345;1,159.9983,0.04337;1,160.1971,0.0433;1,160.3857,0.04322;1,160.5643,0.04314;1,160.7332,0.04307;1,160.8927,0.04299;1,161.043,0.04292;1,161.1845,0.04284;1,161.3176,0.04277;1,161.4425,0.0427;1,161.5596,0.04263;1,161.6692,0.04255;1,161.7717,0.04248;1,161.8673,0.04241;1,161.9564,0.04235;1,162.0393,0.04228;1,162.1164,0.04221;1,162.188,0.04214;1,162.2542,0.04208;1,162.3154,0.04201;1,162.3719,0.04195;1,162.4239,0.04189;1,162.4717,0.04182;1,162.5156,0.04176;1,162.556,0.0417;1,162.5933,0.04164;1,162.6276,0.04158;1,162.6594,0.04152;1,162.689,0.04147;1,162.7165,0.04141;1,162.7425,0.04136;1,162.767,0.0413;1,162.7904,0.04125;1,162.8126,0.04119;1,162.834,0.04114;1,162.8545,0.04109;1,162.8743,0.04104;1,162.8935,0.04099;1,162.912,0.04094;1,162.93,0.04089;1,162.9476,0.04084;1,162.9649,0.0408;1,162.9817,0.04075;1,162.9983,0.04071;1,163.0144,0.04066;1,163.03,0.04062;1,163.0451,0.04058;1,163.0595,0.04053;1,163.0733,0.04049;1,163.0862,0.04045;1,163.0982,0.04041;1,163.1092,0.04037;1,163.1192,0.04034;1,163.1279,0.0403;1,163.1355,0.04026;1,163.1418,0.04023;1,163.1469,0.04019;1,163.1508,0.04016;1,163.1534,0.04012;1,163.1548,0.04009'
};

var KOLOM_LAHIR = ['ID Siswa', 'Nama Siswa', 'Jenis Kelamin', 'Tanggal Lahir'];
var GIZI = ['Gizi buruk', 'Gizi kurang', 'Gizi baik', 'Gizi lebih', 'Obesitas'];
var TINGGI = ['Sangat pendek', 'Pendek', 'Normal', 'Tinggi'];
var LMS_ = {};

function sheetLahir_() { return buatSheet_(SpreadsheetApp.getActive(), 'Data Lahir Siswa', KOLOM_LAHIR); }

function teksTanggal_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, 'Asia/Jakarta', 'yyyy-MM-dd');
  var t = String(v || '').trim(), m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) t = m[3] + '-' + (m[2].length < 2 ? '0' : '') + m[2] + '-' + (m[1].length < 2 ? '0' : '') + m[1];
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
}

/** Jenis kelamin dan tanggal lahir per ID siswa: { id: { jk: 'L'|'P', lahir: 'yyyy-mm-dd' } }. */
function bacaLahir_() {
  var peta = {};
  sheetLahir_().getDataRange().getValues().slice(1).forEach(function (r) {
    var id = String(r[0] || '').trim(), jk = String(r[2] || '').trim().toUpperCase().charAt(0), lahir = teksTanggal_(r[3]);
    if (id && (jk === 'L' || jk === 'P') && lahir) peta[id] = { jk: jk, lahir: lahir };
  });
  return peta;
}

/** Umur dalam bulan penuh pada tanggal ukur ('yyyy-mm-dd'). */
function umurBulan_(lahir, ukur) {
  var a = lahir.split('-').map(Number), b = ukur.split('-').map(Number);
  return (b[0] - a[0]) * 12 + (b[1] - a[1]) - (b[2] < a[2] ? 1 : 0);
}

function lms_(kunci, bulan) {
  if (!LMS_[kunci]) LMS_[kunci] = RUJUKAN_WHO[kunci].split(';').map(function (x) { return x.split(',').map(Number); });
  return LMS_[kunci][bulan - 61];
}

/** Skor-z metode LMS WHO; untuk IMT, di luar ±3 SD memakai jarak SD2–SD3 (aturan WHO 2007). */
function skorZ_(x, l, m, s, batasi) {
  var z = l ? (Math.pow(x / m, l) - 1) / (l * s) : Math.log(x / m) / s;
  if (!batasi || Math.abs(z) <= 3) return z;
  var sd = function (k) { return m * Math.pow(1 + l * s * k, 1 / l); };
  return z > 3 ? 3 + (x - sd(3)) / (sd(3) - sd(2)) : -3 + (x - sd(-3)) / (sd(-2) - sd(-3));
}

function kategoriGizi_(z) { return z < -3 ? GIZI[0] : z < -2 ? GIZI[1] : z <= 1 ? GIZI[2] : z <= 2 ? GIZI[3] : GIZI[4]; }
function kategoriTinggi_(z) { return z < -3 ? TINGGI[0] : z < -2 ? TINGGI[1] : z <= 3 ? TINGGI[2] : TINGGI[3]; }

/**
 * Status gizi (IMT/U, Permenkes No. 2 Tahun 2020) dan tinggi menurut umur (TB/U, rujukan WHO 2007) untuk anak 5–18 tahun.
 * data = { jk, lahir }, tanggal ukur 'yyyy-mm-dd', bb kg, tb cm. Hasil null bila data tidak lengkap.
 */
function statusGizi_(data, tanggal, bb, tb) {
  if (!data || !tanggal || bb === null || tb === null || bb === undefined || tb === undefined) return null;
  var umur = umurBulan_(data.lahir, tanggal);
  if (umur < 61 || umur > 228) return { umurBulan: umur, diLuarUmur: true };
  var imt = bb / Math.pow(tb / 100, 2), a = lms_('imt' + data.jk, umur), b = lms_('tb' + data.jk, umur);
  var zImt = skorZ_(imt, a[0], a[1], a[2], true), zTb = skorZ_(tb, b[0], b[1], b[2], false);
  return { umurBulan: umur, imt: Math.round(imt * 10) / 10, zImt: Math.round(zImt * 100) / 100, gizi: kategoriGizi_(zImt),
    zTb: Math.round(zTb * 100) / 100, tinggi: kategoriTinggi_(zTb) };
}

/** Rekap status gizi satu bulan per kelas, dari semua pengukuran bulan itu. */
function rekapGizi_(semua, bulan, lahir) {
  var rekap = {};
  semua.forEach(function (x) {
    if (x.bulan !== bulan || x.bb === null) return;
    var r = rekap[x.kelas] = rekap[x.kelas] || { diukur: 0, tanpaLahir: 0, gizi: {}, tinggi: {} };
    r.diukur++;
    var st = statusGizi_(lahir[x.id], x.tanggal, x.bb, x.tb);
    if (!st || st.diLuarUmur) { r.tanpaLahir++; return; }
    r.gizi[st.gizi] = (r.gizi[st.gizi] || 0) + 1;
    r.tinggi[st.tinggi] = (r.tinggi[st.tinggi] || 0) + 1;
  });
  return rekap;
}

function teksBulan_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return v.getFullYear() + '-' + (v.getMonth() < 9 ? '0' : '') + (v.getMonth() + 1);
  }
  return String(v || '').trim();
}

/** Semua pengukuran: [{ baris, id, kelas, nama, ta, bulan, tanggal, bb, tb }]. */
function bacaTumbuh_() {
  return sheetTumbuh_().getDataRange().getValues().slice(1).map(function (r, i) {
    return { baris: i + 2, id: String(r[0]).trim(), kelas: String(r[1]).trim(), nama: String(r[2]).trim(), ta: String(r[3]).trim(),
      bulan: teksBulan_(r[4]), tanggal: r[5] instanceof Date ? Utilities.formatDate(r[5], 'Asia/Jakarta', 'yyyy-MM-dd') : String(r[5] || ''),
      bb: angkaUkur_(r[6]), tb: angkaUkur_(r[7]) };
  }).filter(function (x) { return x.id && x.bulan; });
}

/** Pengukuran terakhir tiap siswa SEBELUM bulan tertentu: { id: { bulan, bb, tb } }. */
function ukurSebelum_(semua, bulan) {
  var hasil = {};
  semua.forEach(function (x) {
    if (x.bulan >= bulan || x.bb === null) return;
    if (!hasil[x.id] || hasil[x.id].bulan < x.bulan) hasil[x.id] = { bulan: x.bulan, bb: x.bb, tb: x.tb };
  });
  return hasil;
}

function tumbuhKelas_(req) {
  var sekarang = new Date(), ta = tahunAjaranDari_(sekarang), daftarBulan = bulanTahunAjaran_(ta);
  var bulanIni = teksBulan_(sekarang);
  var bulan = daftarBulan.indexOf(req.bulan) >= 0 && req.bulan <= bulanIni ? req.bulan : bulanIni;
  var kelas = String(req.kelas || '').trim();
  var siswa = daftarSiswa_().filter(function (s) { return s.kelas === kelas; })
    .sort(function (a, b) { return a.urut - b.urut || (a.nama < b.nama ? -1 : 1); });
  var semua = bacaTumbuh_(), nilai = {}, tglUkur = {}, tanggal = '', lahir = bacaLahir_();
  semua.forEach(function (x) { if (x.bulan === bulan) { nilai[x.id] = { bb: x.bb, tb: x.tb }; tglUkur[x.id] = x.tanggal; if (!tanggal && kelas === x.kelas) tanggal = x.tanggal; } });
  var lalu = ukurSebelum_(semua, bulan);
  var terisi = {};
  semua.forEach(function (x) { if (x.ta === ta) terisi[x.bulan] = (terisi[x.bulan] || 0) + (x.kelas === kelas ? 1 : 0); });
  return {
    ok: true, tahunAjaran: ta, bulan: bulan,
    bulanPilihan: daftarBulan.filter(function (b) { return b <= bulanIni; }),
    terisi: terisi, tanggal: tanggal, rekap: rekapGizi_(semua, bulan, lahir),
    siswa: siswa.map(function (s) {
      var n = nilai[s.id] || null;
      return { id: s.id, nama: s.nama, urut: s.urut, nilai: n, lalu: lalu[s.id] || null, adaLahir: !!lahir[s.id], tanggalUkur: n ? tglUkur[s.id] : '',
        status: n ? statusGizi_(lahir[s.id], tglUkur[s.id], n.bb, n.tb) : null };
    })
  };
}

function simpanTumbuh_(req, oleh) {
  if (!oleh) return { ok: false, pesan: 'Isi nama Anda dulu.' };
  var sekarang = new Date(), ta = tahunAjaranDari_(sekarang), bulanIni = teksBulan_(sekarang);
  var bulan = String(req.bulan || '');
  if (bulanTahunAjaran_(ta).indexOf(bulan) < 0 || bulan > bulanIni) return { ok: false, pesan: 'Bulan tidak sah. Pilih bulan di tahun ajaran ini.' };
  var tanggal = String(req.tanggal || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || tanggal.slice(0, 7) !== bulan) return { ok: false, pesan: 'Tanggal ukur harus di bulan yang dipilih.' };
  var kelas = String(req.kelas || '').trim();
  var siswa = daftarSiswa_().filter(function (s) { return s.kelas === kelas; });
  if (!siswa.length) return { ok: false, pesan: 'Kelas tidak ditemukan.' };
  var isian = req.isian && typeof req.isian === 'object' ? req.isian : {};
  var semua = bacaTumbuh_(), lalu = ukurSebelum_(semua, bulan);
  var salah = [], peringatan = [], baru = {};
  siswa.forEach(function (s) {
    var c = cekUkur_(isian[s.id] || {}, lalu[s.id]);
    if (c.salah) salah.push(s.nama + ': ' + c.salah + '.');
    else { baru[s.id] = c; if (c.peringatan) peringatan.push(s.nama + ': ' + c.peringatan + '.'); }
  });
  if (salah.length) return { ok: false, salah: salah, pesan: 'Belum tersimpan. ' + salah[0] };

  var sh = sheetTumbuh_(), waktu = new Date(), jumlah = 0, hapus = [];
  var ada = {};
  semua.forEach(function (x) { if (x.bulan === bulan) ada[x.id] = x.baris; });
  siswa.forEach(function (s) {
    var c = baru[s.id];
    if (c.bb === null) { if (ada[s.id]) hapus.push(ada[s.id]); return; }
    var baris = [s.id, s.kelas, s.nama, ta, "'" + bulan, tanggal, c.bb, c.tb, oleh, waktu];
    if (ada[s.id]) sh.getRange(ada[s.id], 1, 1, baris.length).setValues([baris]);
    else sh.appendRow(baris);
    jumlah++;
  });
  hapus.sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
  catat_(oleh, 'Tumbuh kembang', { id: '', nama: namaKelas_(kelas) }, bulan + ': ' + jumlah + ' siswa' + (hapus.length ? ', ' + hapus.length + ' dikosongkan' : ''));
  return { ok: true, jumlah: jumlah, peringatan: peringatan,
    pesan: 'Tersimpan: ' + jumlah + ' dari ' + siswa.length + ' siswa ' + namaKelas_(kelas) + '.' };
}

/* ---------- Laporan bulanan untuk orang tua ---------- */
var SARAN_GIZI = {
  'Gizi baik': 'Pertumbuhan Ananda sesuai dengan umurnya. Pertahankan kebiasaan sarapan setiap pagi, makan sesuai pedoman Isi Piringku (separuh piring sayur dan buah), tidur cukup, dan aktif bergerak minimal 60 menit sehari.',
  'Gizi lebih': 'Berat badan Ananda sedikit di atas anak seusianya. Kurangi minuman manis, gorengan, dan jajanan kemasan; perbanyak sayur, buah, dan air putih; ajak Ananda aktif bergerak minimal 60 menit sehari.',
  'Obesitas': 'Berat badan Ananda jauh di atas anak seusianya. Batasi minuman manis dan jajanan, perbanyak sayur, buah, dan air putih, ajak Ananda bergerak aktif setiap hari, dan konsultasikan ke Puskesmas atau tenaga kesehatan untuk saran yang sesuai.',
  'Gizi kurang': 'Berat badan Ananda di bawah anak seusianya. Pastikan Ananda sarapan dan makan teratur tiga kali sehari dengan lauk berprotein (telur, ikan, tempe, tahu, daging), dan konsultasikan ke Puskesmas.',
  'Gizi buruk': 'Berat badan Ananda jauh di bawah anak seusianya. Mohon segera memeriksakan Ananda ke Puskesmas agar mendapat penanganan yang tepat.'
};
var SARAN_PENDEK = 'Tinggi badan Ananda di bawah anak seusianya. Cukupi protein hewani (telur, ikan, susu), tidur cukup, dan konsultasikan ke Puskesmas untuk pemeriksaan lebih lanjut.';

/** Saran untuk orang tua dari status gizi dan tinggi; [] bila belum ada status. */
function saranKesehatan_(st) {
  if (!st || st.diLuarUmur) return [];
  var saran = [SARAN_GIZI[st.gizi]];
  if (st.tinggi === 'Pendek' || st.tinggi === 'Sangat pendek') saran.push(SARAN_PENDEK);
  return saran;
}

/** Baris sheet sebagai objek berdasarkan judul kolom. */
function barisBerjudul_(sh) {
  if (!sh) return [];
  var v = sh.getDataRange().getValues(), h = (v.shift() || []).map(function (x) { return String(x).trim(); });
  return v.map(function (r) { var o = {}; h.forEach(function (k, i) { if (k) o[k] = r[i]; }); return o; });
}

var BULAN_ANGKA = { januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12 };

/** "1 September 2026" / Date / "2026-09-01" → "2026-09-01". */
function tanggalLog_(v) {
  var t = teksTanggal_(v);
  if (t) return t;
  var m = String(v || '').trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/), b = m && BULAN_ANGKA[m[2].toLowerCase()];
  return b ? m[3] + '-' + (b < 10 ? '0' : '') + b + '-' + (m[1].length < 2 ? '0' : '') + m[1] : '';
}

/** Rekap kehadiran satu kelas satu bulan dari Log Presensi: { nama: { Hadir, Sakit, Izin, 'Tanpa Keterangan', hari } }. */
function kehadiranBulan_(ssPresensi, kelas, bulan) {
  var catat = {};
  barisBerjudul_(ssPresensi.getSheetByName('Log Presensi')).forEach(function (r) {
    var tgl = tanggalLog_(r['Tanggal Key']) || tanggalLog_(r['Tanggal']);
    if (String(r['Kelas']).trim() !== kelas || tgl.slice(0, 7) !== bulan) return;
    var nama = String(r['Nama Siswa']).trim();
    (catat[nama] = catat[nama] || {})[tgl] = String(r['Status']).trim(); // baris belakangan menimpa (koreksi guru)
  });
  var hasil = {};
  Object.keys(catat).forEach(function (nama) {
    var h = { 'Hadir': 0, 'Sakit': 0, 'Izin': 0, 'Tanpa Keterangan': 0, hari: 0 };
    Object.keys(catat[nama]).forEach(function (t) { var st = catat[nama][t]; if (h[st] !== undefined) { h[st]++; h.hari++; } });
    hasil[nama] = h;
  });
  return hasil;
}

/** Pelanggaran satu kelas satu bulan: { nama: [{ tanggal, jenis, tingkat }] } — tanpa catatan khusus guru. */
function pelanggaranBulan_(ssPresensi, kelas, bulan) {
  var hasil = {};
  barisBerjudul_(ssPresensi.getSheetByName('Log Pelanggaran')).forEach(function (r) {
    var tgl = tanggalLog_(r['Tanggal']) || tanggalLog_(r['Timestamp']);
    if (String(r['Kelas']).trim() !== kelas || tgl.slice(0, 7) !== bulan) return;
    var nama = String(r['Nama Siswa']).trim();
    (hasil[nama] = hasil[nama] || []).push({ tanggal: tgl, jenis: String(r['Jenis Pelanggaran'] || '').trim(), tingkat: String(r['Tingkat'] || '').trim() });
  });
  Object.keys(hasil).forEach(function (n) { hasil[n].sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; }); });
  return hasil;
}

/** "2026-11" → "2026-10"; "2027-01" → "2026-12". */
function bulanSebelum_(bulan) {
  var t = Number(bulan.slice(0, 4)), b = Number(bulan.slice(5, 7)) - 1;
  if (b === 0) { b = 12; t--; }
  return t + '-' + (b < 10 ? '0' : '') + b;
}

/**
 * Data laporan bulanan orang tua untuk semua siswa satu kelas (hanya membaca).
 * Laporan bulan X dibagikan di awal bulan X: pengukuran bulan X, kehadiran dan pelanggaran bulan sebelumnya.
 */
function laporanKelas_(req) {
  var dasar = tumbuhKelas_(req), kelas = String(req.kelas || '').trim(), bulan = dasar.bulan, bulanRekap = bulanSebelum_(bulan);
  var ssPresensi = SpreadsheetApp.openById(pengaturan_().presensiId);
  var hadir = kehadiranBulan_(ssPresensi, kelas, bulanRekap), langgar = pelanggaranBulan_(ssPresensi, kelas, bulanRekap);
  var guru = { nama: '', nip: '' };
  barisBerjudul_(ssPresensi.getSheetByName('Master Guru Kelas')).forEach(function (r) {
    if (String(r['Kelas']).trim() === kelas) guru = { nama: String(r['Nama Guru Kelas'] || '').trim(), nip: String(r['NIP'] || '').trim() };
  });
  var lahir = bacaLahir_(), sekolah = pengaturan_().sekolah;
  return {
    ok: true, kelas: kelas, bulan: bulan, bulanRekap: bulanRekap, tahunAjaran: dasar.tahunAjaran, guru: guru,
    kepsek: { nama: sekolah.kepsek, nip: sekolah.nip },
    siswa: dasar.siswa.map(function (s) {
      return { id: s.id, nama: s.nama, jk: lahir[s.id] ? lahir[s.id].jk : '', lahir: lahir[s.id] ? lahir[s.id].lahir : '', tanggalUkur: s.tanggalUkur,
        nilai: s.nilai, lalu: s.lalu, status: s.status, saran: saranKesehatan_(s.status),
        kehadiran: hadir[s.nama] || null, pelanggaran: langgar[s.nama] || [] };
    })
  };
}

if (typeof module !== 'undefined') {
  module.exports = { tahunAjaranDari_: tahunAjaranDari_, bulanTahunAjaran_: bulanTahunAjaran_, cekUkur_: cekUkur_, angkaUkur_: angkaUkur_,
    statusGizi_: statusGizi_, skorZ_: skorZ_, umurBulan_: umurBulan_, lms_: lms_, tanggalLog_: tanggalLog_, saranKesehatan_: saranKesehatan_, bulanSebelum_: bulanSebelum_ };
}
