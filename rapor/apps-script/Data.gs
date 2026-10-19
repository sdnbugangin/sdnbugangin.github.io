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
  ayah: 'Nama Ayah', ibu: 'Nama Ibu', wali: 'Nama Wali', alamat: 'Alamat'
};

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

function normalisasiSeni_(v, ditawarkan) {
  var s = teks_(v).toLowerCase();
  if (!s) return '';
  for (var i = 0; i < ditawarkan.length; i++) {
    var d = ditawarkan[i].toLowerCase();
    if (s === d || 'seni ' + s === d) return ditawarkan[i];
  }
  return teks_(v);
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
    seni: normalisasiSeni_(d.seni, seniDitawarkan || PILIHAN_SENI)
  };
  var tgl = normalisasiTanggal_(d.tanggalLahir, tahunSekarang - 25, tahunSekarang - 3);
  if (tgl === null) salah.push('tanggal lahir "' + teks_(d.tanggalLahir) + '" tidak valid (contoh: 15/03/2016).');
  else s.tanggalLahir = tgl;
  if (s.nama.length > 100) salah.push('nama terlalu panjang (maks. 100 karakter).');
  if (!s.panggilan && s.nama) s.panggilan = panggilanBawaan_(s.nama);
  if (s.panggilan.length > 30) salah.push('nama panggilan terlalu panjang (maks. 30 karakter).');
  ['tempatLahir', 'ayah', 'ibu', 'wali'].forEach(function (k) { if (s[k].length > 100) salah.push(k + ' terlalu panjang.'); });
  if (s.alamat.length > 300) salah.push('alamat terlalu panjang (maks. 300 karakter).');
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
  return { salah: salah, rombel: { id: d.id, kelas: kelas, nama: nama, wali: teks_(d.wali), nip: nip } };
}

/** Nama rombel untuk pesan: kelas dengan satu rombel (nama = nomor kelas) disebut "Kelas 5". */
function labelRombel_(r) { return String(r.nama) === String(r.kelas) ? 'Kelas ' + r.kelas : String(r.nama); }

/* ---------- akses spreadsheet sekolah ---------- */

function bukaSekolah_(npsn) {
  var s = cariSekolah_('npsn', npsn);
  if (!s || !s.spreadsheet) throw galatPengguna_('Spreadsheet sekolah tidak ditemukan. Hubungi pengelola aplikasi.');
  try {
    return SpreadsheetApp.openById(s.spreadsheet);
  } catch (e) {
    throw galatPengguna_('Spreadsheet sekolah tidak bisa dibuka. Hubungi pengelola aplikasi.');
  }
}

function sheetSekolah_(ss, nama) {
  var sh = ss.getSheetByName(nama);
  if (!sh) throw galatPengguna_('Sheet "' + nama + '" hilang dari spreadsheet sekolah. Hubungi pengelola aplikasi.');
  return sh;
}

/** Isi sheet sebagai daftar objek berkunci nama kolom. Baris kosong dilewati. */
function bacaTabel_(ss, nama) {
  var kolom = strukturSheet_(nama).kolom;
  var rows = sheetSekolah_(ss, nama).getDataRange().getValues();
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
function tulisTabel_(ss, nama, data) {
  var st = strukturSheet_(nama);
  var sh = sheetSekolah_(ss, nama);
  var lama = Math.max(sh.getLastRow() - 1, 0);
  var perlu = data.length + 1;
  if (sh.getMaxRows() < perlu) {
    var awal = sh.getMaxRows() + 1;
    sh.insertRowsAfter(sh.getMaxRows(), perlu - sh.getMaxRows() + 200);
    formatTeks_(sh, st, awal);
  }
  if (data.length) {
    sh.getRange(2, 1, data.length, st.kolom.length).setValues(data.map(function (o) {
      return st.kolom.map(function (k) { return o[k] === undefined || o[k] === null ? '' : o[k]; });
    }));
  }
  if (lama > data.length) sh.getRange(data.length + 2, 1, lama - data.length, st.kolom.length).clearContent();
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
  var profil = bacaTabel_(ss, 'Profil Sekolah').map(function (r) {
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
      return { id: teks_(r['ID Rombel']), kelas: Number(r.Kelas), nama: teks_(r['Nama Rombel']), wali: teks_(r['Wali Kelas']), nip: teks_(r['NIP Wali Kelas']) };
    })
    .sort(function (a, b) { return a.kelas - b.kelas || (a.nama < b.nama ? -1 : a.nama > b.nama ? 1 : 0); });
}

function simpanProfil_(npsn, isian, semester) {
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var rows = bacaTabel_(ss, 'Profil Sekolah');
    var cek = cekProfil_(isian, rows.map(function (r) { return teks_(r.Kunci); }));
    var sem = Number(semester);
    if (semester !== undefined && sem !== 1 && sem !== 2) cek.salah.push('Semester harus 1 atau 2.');
    if (cek.salah.length) return { ok: false, salah: cek.salah, pesan: cek.salah[0] };
    rows.forEach(function (r) { if (teks_(r.Kunci) in cek.bersih) r.Nilai = cek.bersih[teks_(r.Kunci)]; });
    tulisTabel_(ss, 'Profil Sekolah', rows);
    if (sem === 1 || sem === 2) {
      var atur = bacaTabel_(ss, 'Pengaturan');
      atur.forEach(function (r) { if (teks_(r.Kunci) === 'Semester') r.Nilai = sem; });
      tulisTabel_(ss, 'Pengaturan', atur);
    }
    catatSekolah_(ss, 'ubah profil', Object.keys(cek.bersih).join(', ') + (sem ? '; semester ' + sem : ''));
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
    } else {
      var dipakai = {};
      semua.forEach(function (x) { dipakai[teks_(x['ID Rombel'])] = true; });
      r.id = idBaru_('R', dipakai);
      semua.push({ 'ID Rombel': r.id, 'Tahun Ajaran': ta, Kelas: r.kelas, 'Nama Rombel': r.nama, 'Wali Kelas': r.wali, 'NIP Wali Kelas': r.nip });
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
function simpanSiswa_(npsn, rombelId, daftar) {
  var ss = bukaSekolah_(npsn);
  if (!Array.isArray(daftar)) return { ok: false, pesan: 'Daftar siswa tidak valid.' };
  if (daftar.length > MAKS_SISWA_ROMBEL) return { ok: false, pesan: 'Satu rombel maksimal ' + MAKS_SISWA_ROMBEL + ' siswa.' };
  return denganKunci_(function () {
    var atur = aturSekolah_(ss);
    var ta = atur.tahunAjaran;
    rombelId = teks_(rombelId);
    var rombel = daftarRombel_(ss, ta).filter(function (r) { return r.id === rombelId; })[0];
    if (!rombel) return { ok: false, pesan: 'Rombel tidak ditemukan. Muat ulang halaman.' };

    var tahun = new Date().getFullYear();
    var salah = [];
    var bersih = daftar.map(function (d, i) {
      var n = normalisasiSiswa_(d, atur.seni, tahun);
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
    catatSekolah_(ss, 'simpan siswa', rombel.nama + ': ' + bersih.length + ' siswa');

    var tanpaSeni = bersih.filter(function (s) { return !s.seni; }).length;
    return {
      ok: true, siswa: bersih,
      pesan: bersih.length + ' siswa ' + labelRombel_(rombel) + ' tersimpan.' +
        (tanpaSeni ? ' Catatan: ' + tanpaSeni + ' siswa belum memilih seni (wajib diisi sebelum cetak rapor).' : '')
    };
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
