/**
 * Aplikasi Rapor SD — isian wali kelas per rombel: ekstrakurikuler, ketidakhadiran, catatan wali kelas, dan kenaikan.
 *
 * Ekstrakurikuler: sekolah menyusun daftar kegiatan (Pengaturan "Ekstrakurikuler Ditawarkan"); siswa boleh mengikuti
 *   sebanyak apa pun dari daftar itu (tiap kegiatan sekali), masing-masing dengan predikat dan keterangan. Keterangan yang dikosongkan dibuat
 *   otomatis dari predikat saat dibaca (tidak disimpan), sehingga mengubah predikat langsung mengubah kalimatnya.
 * Presensi & Catatan: satu baris per siswa per semester. Kolom Tanggapan Orang Tua tidak disentuh.
 * Kenaikan: satu baris per siswa per tahun ajaran; hanya tampil di rapor semester 2 (keteranganKenaikan_).
 */

/* Batas pengaman daftar kegiatan sekolah (bukan batas per siswa). */
var MAKS_EKSKUL_SEKOLAH = 50;
var PREDIKAT_EKSKUL = ['Sangat Baik', 'Baik', 'Cukup', 'Kurang'];
var MAKS_HARI = 200;
var MAKS_CATATAN = 500;
var KUNCI_EKSKUL = 'Ekstrakurikuler Ditawarkan';

/* ---------- aturan ---------- */

function predikatEkskul_(v) {
  var t = teks_(v).toLowerCase();
  if (!t) return '';
  for (var i = 0; i < PREDIKAT_EKSKUL.length; i++) {
    var p = PREDIKAT_EKSKUL[i];
    if (t === p.toLowerCase() || t === p.split(' ').map(function (x) { return x.charAt(0); }).join('').toLowerCase()) return p;
  }
  return null;
}

/** Keterangan bawaan bila guru tidak menulis sendiri: "Sangat baik dalam mengikuti kegiatan Pramuka." */
function keteranganEkskul_(kegiatan, predikat) {
  return predikat ? hurufBesarAwal_(predikat.toLowerCase()) + ' dalam mengikuti kegiatan ' + kegiatan + '.' : '';
}

/** Daftar kegiatan sekolah: nama unik (tanpa beda huruf besar/kecil), tanpa titik koma. */
function cekDaftarEkskul_(daftar) {
  var hasil = [], salah = [], ada = {};
  (Array.isArray(daftar) ? daftar : []).forEach(function (x) {
    var n = teks_(x);
    if (!n) return;
    if (n.indexOf(';') >= 0) { salah.push('"' + n + '": nama kegiatan tidak boleh memakai titik koma.'); return; }
    if (n.length > 60) { salah.push('"' + n.slice(0, 30) + '…": nama kegiatan terlalu panjang (maks. 60 karakter).'); return; }
    if (ada[n.toLowerCase()]) { salah.push('"' + n + '" tertulis lebih dari sekali.'); return; }
    ada[n.toLowerCase()] = true;
    hasil.push(n);
  });
  if (hasil.length > MAKS_EKSKUL_SEKOLAH) salah.push('Paling banyak ' + MAKS_EKSKUL_SEKOLAH + ' kegiatan ekstrakurikuler.');
  return { daftar: hasil, salah: salah };
}

/** Jumlah hari: '' → '' (belum diisi), selain itu bilangan bulat 0–MAKS_HARI; null bila tidak sah. */
function jumlahHari_(v) {
  var t = teks_(v);
  if (t === '' || t === '-') return '';
  if (!/^\d+$/.test(t) || Number(t) > MAKS_HARI) return null;
  return Number(t);
}

function keputusanNaik_(v) {
  var t = teks_(v).toLowerCase();
  if (!t) return '';
  if (['naik', 'lulus', 'ya'].indexOf(t) >= 0) return 'naik';
  if (['tinggal', 'tidak naik', 'tidak lulus', 'tidak'].indexOf(t) >= 0) return 'tinggal';
  return null;
}

/* ---------- baca ---------- */

function ekskulSekolah_(ss) {
  return teks_(bacaKunciNilai_(ss, 'Pengaturan')[KUNCI_EKSKUL]).split(';').map(teks_).filter(String);
}

function konteksWali_(ss, req) {
  var atur = aturSekolah_(ss), ta = atur.tahunAjaran;
  var sem = Number(req.semester) === 1 || Number(req.semester) === 2 ? Number(req.semester) : atur.semester;
  var rombel = daftarRombel_(ss, ta).filter(function (r) { return r.id === teks_(req.rombel); })[0];
  if (!rombel) return { galat: 'Rombel tidak ditemukan. Muat ulang halaman.' };
  var siswa = siswaUrut_(ss, ta, rombel.id);
  var kenal = {};
  siswa.forEach(function (s) { kenal[s.id] = s; });
  return { ta: ta, sem: sem, rombel: rombel, siswa: siswa, kenal: kenal };
}

function milikLayar_(k, r, perSemester) {
  return k.kenal[teks_(r['ID Siswa'])] && teks_(r['Tahun Ajaran']) === k.ta && (!perSemester || Number(r.Semester) === k.sem);
}

function bentukWali_(ss, k) {
  var ekskul = {}, presensi = {}, kenaikan = {};
  k.siswa.forEach(function (s) { ekskul[s.id] = []; presensi[s.id] = { sakit: '', izin: '', alpa: '', catatan: '' }; kenaikan[s.id] = ''; });
  bacaTabel_(ss, 'Ekstrakurikuler').forEach(function (r) {
    if (!milikLayar_(k, r, true) || !teks_(r.Kegiatan)) return;
    var p = predikatEkskul_(r.Predikat) || '';
    ekskul[teks_(r['ID Siswa'])].push({ kegiatan: teks_(r.Kegiatan), predikat: p, keterangan: teks_(r.Keterangan),
      otomatis: keteranganEkskul_(teks_(r.Kegiatan), p) });
  });
  bacaTabel_(ss, 'Presensi & Catatan').forEach(function (r) {
    if (!milikLayar_(k, r, true)) return;
    presensi[teks_(r['ID Siswa'])] = { sakit: r.Sakit, izin: r.Izin, alpa: r['Tanpa Keterangan'], catatan: teks_(r['Catatan Wali Kelas']) };
  });
  bacaTabel_(ss, 'Kenaikan').forEach(function (r) {
    if (milikLayar_(k, r, false)) kenaikan[teks_(r['ID Siswa'])] = keputusanNaik_(r.Keputusan) || '';
  });
  var ket = {};
  k.siswa.forEach(function (s) {
    var p = [];
    if (!ekskul[s.id].length) p.push('Ekstrakurikuler belum diisi.');
    var pr = presensi[s.id];
    if (pr.sakit === '' || pr.izin === '' || pr.alpa === '') p.push('Ketidakhadiran belum lengkap.');
    if (!pr.catatan) p.push('Catatan wali kelas belum diisi.');
    var naik = keteranganKenaikan_(k.rombel.kelas, k.sem, kenaikan[s.id]);
    p = p.concat(naik.peringatan);
    ket[s.id] = { peringatan: p, kenaikan: naik.teks };
  });
  return {
    ok: true, tahunAjaran: k.ta, semester: k.sem, rombel: k.rombel, maksEkskulSekolah: MAKS_EKSKUL_SEKOLAH, predikat: PREDIKAT_EKSKUL,
    ekskulSekolah: ekskulSekolah_(ss),
    siswa: k.siswa.map(function (s) { return { id: s.id, no: s.no, nama: s.nama }; }),
    ekskul: ekskul, presensi: presensi, kenaikan: kenaikan, cek: ket
  };
}

/* ---------- aksi ---------- */

function waliRombel_(npsn, req) {
  var ss = bukaSekolah_(npsn);
  var k = konteksWali_(ss, req || {});
  if (k.galat) return { ok: false, pesan: k.galat };
  return bentukWali_(ss, k);
}

/** Mengganti daftar kegiatan ekstrakurikuler sekolah. Kegiatan yang sudah diikuti siswa tahun ini tidak bisa dihapus. */
function simpanEkskulSekolah_(npsn, daftar) {
  var cek = cekDaftarEkskul_(daftar);
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var ta = aturSekolah_(ss).tahunAjaran, baru = {}, pakai = {};
    cek.daftar.forEach(function (n) { baru[n.toLowerCase()] = true; });
    bacaTabel_(ss, 'Ekstrakurikuler').forEach(function (r) {
      if (teks_(r['Tahun Ajaran']) === ta && teks_(r.Kegiatan)) pakai[teks_(r.Kegiatan)] = (pakai[teks_(r.Kegiatan)] || 0) + 1;
    });
    Object.keys(pakai).forEach(function (n) {
      if (!baru[n.toLowerCase()]) cek.salah.push(n + ' sudah diisi untuk ' + pakai[n] + ' data siswa tahun ini, jadi tidak bisa dihapus.');
    });
    if (cek.salah.length) return { ok: false, salah: cek.salah, pesan: cek.salah[0] };
    var rows = bacaTabel_(ss, 'Pengaturan'), ada = false;
    rows.forEach(function (r) { if (teks_(r.Kunci) === KUNCI_EKSKUL) { r.Nilai = cek.daftar.join('; '); ada = true; } });
    if (!ada) rows.push({ Kunci: KUNCI_EKSKUL, Nilai: cek.daftar.join('; '), Keterangan: 'Kegiatan ekstrakurikuler sekolah, dipisah titik koma.' });
    tulisTabel_(ss, 'Pengaturan', rows);
    catatSekolah_(ss, 'ubah daftar ekstrakurikuler', cek.daftar.join('; '));
    return { ok: true, ekskulSekolah: cek.daftar, pesan: cek.daftar.length + ' kegiatan ekstrakurikuler tersimpan.' };
  });
}

/**
 * req.ekskul = { idSiswa: [{ kegiatan, predikat, keterangan }] }. Baris tanpa kegiatan diabaikan.
 * Semua isian diperiksa dulu; satu salah → tidak ada yang tersimpan.
 */
function simpanEkskul_(npsn, req) {
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var k = konteksWali_(ss, req || {});
    if (k.galat) return { ok: false, pesan: k.galat };
    var isian = req.ekskul && typeof req.ekskul === 'object' ? req.ekskul : {};
    var tawar = {}, salah = [], baru = [];
    ekskulSekolah_(ss).forEach(function (n) { tawar[n.toLowerCase()] = n; });
    Object.keys(isian).forEach(function (id) { if (!k.kenal[id]) salah.push('Ada siswa yang tidak terdaftar di rombel ini. Muat ulang halaman.'); });
    k.siswa.forEach(function (s) {
      var daftar = (Array.isArray(isian[s.id]) ? isian[s.id] : []).filter(function (e) { return e && teks_(e.kegiatan); });
      var ada = {}, awal = s.no + '. ' + s.nama + ' — ';
      daftar.forEach(function (e) {
        var keg = tawar[teks_(e.kegiatan).toLowerCase()], pred = predikatEkskul_(e.predikat), ket = teks_(e.keterangan);
        if (!keg) { salah.push(awal + '"' + teks_(e.kegiatan) + '" tidak ada di daftar ekstrakurikuler sekolah.'); return; }
        if (ada[keg]) { salah.push(awal + keg + ' tertulis lebih dari sekali.'); return; }
        ada[keg] = true;
        if (pred === null) { salah.push(awal + keg + ': predikat harus ' + PREDIKAT_EKSKUL.join(', ') + '.'); return; }
        if (!pred && !ket) { salah.push(awal + keg + ': isi predikat atau keterangan.'); return; }
        if (ket.length > 300) { salah.push(awal + keg + ': keterangan terlalu panjang (maks. 300 karakter).'); return; }
        baru.push({ 'Tahun Ajaran': k.ta, Semester: k.sem, 'ID Siswa': s.id, Kegiatan: keg, Predikat: pred, Keterangan: ket });
      });
    });
    if (salah.length) return { ok: false, salah: salah, pesan: salah[0] };
    var sisa = bacaTabel_(ss, 'Ekstrakurikuler').filter(function (r) { return !milikLayar_(k, r, true); });
    tulisTabel_(ss, 'Ekstrakurikuler', sisa.concat(baru));
    catatSekolah_(ss, 'simpan ekstrakurikuler', k.rombel.nama + ' smt ' + k.sem + ': ' + baru.length + ' kegiatan');
    var layar = bentukWali_(ss, k);
    var belum = k.siswa.filter(function (s) { return !layar.ekskul[s.id].length; }).length;
    layar.pesan = 'Ekstrakurikuler ' + labelRombel_(k.rombel) + ' tersimpan.' + (belum ? ' ' + belum + ' siswa belum punya ekstrakurikuler.' : '');
    return layar;
  });
}

/** req.presensi = { idSiswa: { sakit, izin, alpa, catatan } }. Kosong = belum diisi. */
function simpanPresensi_(npsn, req) {
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var k = konteksWali_(ss, req || {});
    if (k.galat) return { ok: false, pesan: k.galat };
    var isian = req.presensi && typeof req.presensi === 'object' ? req.presensi : {};
    var salah = [], baru = {};
    Object.keys(isian).forEach(function (id) { if (!k.kenal[id]) salah.push('Ada siswa yang tidak terdaftar di rombel ini. Muat ulang halaman.'); });
    k.siswa.forEach(function (s) {
      var p = isian[s.id] && typeof isian[s.id] === 'object' ? isian[s.id] : {}, b = {};
      [['sakit', 'Sakit'], ['izin', 'Izin'], ['alpa', 'Tanpa keterangan']].forEach(function (x) {
        var h = jumlahHari_(p[x[0]]);
        if (h === null) salah.push(s.no + '. ' + s.nama + ' — ' + x[1] + ': isi bilangan bulat 0–' + MAKS_HARI + '.');
        b[x[0]] = h;
      });
      b.catatan = teks_(p.catatan);
      if (b.catatan.length > MAKS_CATATAN) salah.push(s.no + '. ' + s.nama + ' — catatan terlalu panjang (maks. ' + MAKS_CATATAN + ' karakter).');
      baru[s.id] = b;
    });
    if (salah.length) return { ok: false, salah: salah, pesan: salah[0] };
    var lama = {};
    var sisa = bacaTabel_(ss, 'Presensi & Catatan').filter(function (r) {
      if (!milikLayar_(k, r, true)) return true;
      lama[teks_(r['ID Siswa'])] = r;
      return false;
    });
    k.siswa.forEach(function (s) {
      var b = baru[s.id], tanggapan = lama[s.id] ? lama[s.id]['Tanggapan Orang Tua'] : '';
      if (b.sakit === '' && b.izin === '' && b.alpa === '' && !b.catatan && !teks_(tanggapan)) return;
      sisa.push({ 'Tahun Ajaran': k.ta, Semester: k.sem, 'ID Siswa': s.id, Sakit: b.sakit, Izin: b.izin, 'Tanpa Keterangan': b.alpa,
        'Catatan Wali Kelas': b.catatan, 'Tanggapan Orang Tua': tanggapan });
    });
    tulisTabel_(ss, 'Presensi & Catatan', sisa);
    catatSekolah_(ss, 'simpan presensi & catatan', k.rombel.nama + ' smt ' + k.sem);
    var layar = bentukWali_(ss, k);
    layar.pesan = 'Ketidakhadiran dan catatan ' + labelRombel_(k.rombel) + ' tersimpan.';
    return layar;
  });
}

/** req.kenaikan = { idSiswa: 'naik' | 'tinggal' | '' }. Berlaku untuk tahun ajaran ini (rapor semester 2). */
function simpanKenaikan_(npsn, req) {
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var k = konteksWali_(ss, req || {});
    if (k.galat) return { ok: false, pesan: k.galat };
    var isian = req.kenaikan && typeof req.kenaikan === 'object' ? req.kenaikan : {};
    var salah = [], baru = {};
    Object.keys(isian).forEach(function (id) { if (!k.kenal[id]) salah.push('Ada siswa yang tidak terdaftar di rombel ini. Muat ulang halaman.'); });
    k.siswa.forEach(function (s) {
      var v = keputusanNaik_(isian[s.id]);
      if (v === null) salah.push(s.no + '. ' + s.nama + ' — keputusan tidak dikenal.');
      else baru[s.id] = v;
    });
    if (salah.length) return { ok: false, salah: salah, pesan: salah[0] };
    var sisa = bacaTabel_(ss, 'Kenaikan').filter(function (r) { return !milikLayar_(k, r, false); });
    var lulus = k.rombel.kelas === 6;
    k.siswa.forEach(function (s) {
      if (baru[s.id]) sisa.push({ 'Tahun Ajaran': k.ta, 'ID Siswa': s.id, Keputusan: baru[s.id] === 'naik' ? (lulus ? 'Lulus' : 'Naik') : (lulus ? 'Tidak Lulus' : 'Tinggal') });
    });
    tulisTabel_(ss, 'Kenaikan', sisa);
    catatSekolah_(ss, 'simpan kenaikan', k.rombel.nama);
    var layar = bentukWali_(ss, k);
    layar.pesan = 'Keputusan ' + (lulus ? 'kelulusan' : 'kenaikan kelas') + ' ' + labelRombel_(k.rombel) + ' tersimpan.';
    return layar;
  });
}
