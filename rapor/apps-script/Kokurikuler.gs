/**
 * Aplikasi Rapor SD — kokurikuler (dimensi profil lulusan).
 *
 * Per kelas per semester sekolah memilih subdimensi yang dinilai (sheet Kokurikuler; dimensi mengikuti
 * subdimensinya). Capaian per siswa disimpan per subdimensi (sheet Capaian Kokurikuler), bukan per nomor
 * urut, sehingga mengubah urutan atau menambah subdimensi tidak menggeser capaian yang sudah ada.
 * Narasi diambil dari Master Narasi sekolah (bisa diubah di aplikasi) dan deskripsinya dihitung ulang
 * setiap kali dengan deskripsiKokurikuler_ (Hitung.gs).
 */

/* ---------- referensi ---------- */

/** Nama baku subdimensi (tanpa beda huruf besar/kecil dan spasi), atau '' bila tidak dikenal. */
function subdimensiBaku_(v) {
  var kunci = teks_(v).toLowerCase();
  if (!kunci) return '';
  if (ALIAS_SUBDIMENSI[kunci]) return ALIAS_SUBDIMENSI[kunci];
  for (var i = 0; i < DIMENSI_PROFIL.length; i++) {
    for (var j = 0; j < DIMENSI_PROFIL[i].sub.length; j++) {
      if (DIMENSI_PROFIL[i].sub[j].toLowerCase() === kunci) return DIMENSI_PROFIL[i].sub[j];
    }
  }
  return '';
}

function dimensiDari_(sub) {
  for (var i = 0; i < DIMENSI_PROFIL.length; i++) if (DIMENSI_PROFIL[i].sub.indexOf(sub) >= 0) return DIMENSI_PROFIL[i].dimensi;
  return '';
}

/** 'mahir' / 'M' → 'Mahir'; '' → ''; selain itu null (tidak sah). */
function levelKok_(v) {
  var t = teks_(v).toLowerCase();
  if (!t || t === '-') return '';
  for (var i = 0; i < LEVEL_KOKURIKULER.length; i++) {
    var l = LEVEL_KOKURIKULER[i];
    if (t === l.toLowerCase() || t === l.charAt(0).toLowerCase()) return l;
  }
  return null;
}

/**
 * Memeriksa daftar subdimensi satu kelas-semester. daftar = ['Kerjasama', ...] atau [{ subdimensi }].
 * Hasil { daftar: [{ dimensi, subdimensi }], salah: [] }. Daftar kosong boleh (belum dinilai).
 */
function cekDimensiKelas_(daftar) {
  var hasil = [], salah = [], ada = {};
  if (!Array.isArray(daftar)) daftar = [];
  daftar.forEach(function (d, i) {
    var mentah = d && typeof d === 'object' ? d.subdimensi : d;
    if (!teks_(mentah)) return;
    var sub = subdimensiBaku_(mentah);
    if (!sub) { salah.push('Baris ' + (i + 1) + ': subdimensi "' + teks_(mentah) + '" tidak dikenal.'); return; }
    if (ada[sub]) { salah.push('Subdimensi "' + sub + '" dipilih lebih dari sekali.'); return; }
    ada[sub] = true;
    hasil.push({ dimensi: dimensiDari_(sub), subdimensi: sub });
  });
  if (hasil.length > MAKS_SUBDIMENSI) salah.push('Paling banyak ' + MAKS_SUBDIMENSI + ' subdimensi per semester.');
  return { daftar: hasil, salah: salah };
}

/** Narasi teks bebas → bentuk yang pas di tengah kalimat: huruf kecil di awal, tanpa titik di akhir. */
function rapikanNarasi_(v) {
  return hurufKecilAwal_(teks_(v).replace(/[.\s]+$/, ''));
}

/* ---------- baca dari spreadsheet ---------- */

/** Master Narasi sekolah: { subdimensi: { Mahir: '...', ... } }. Baris rusak dilewati. */
function bacaNarasi_(ss) {
  var hasil = {};
  bacaTabel_(ss, 'Master Narasi').forEach(function (r) {
    var sub = subdimensiBaku_(r.Subdimensi), level = levelKok_(r.Level), narasi = rapikanNarasi_(r.Narasi);
    if (!sub || !level || !narasi) return;
    (hasil[sub] = hasil[sub] || {})[level] = narasi;
  });
  return hasil;
}

function narasiBawaan_() {
  var hasil = {};
  NARASI_BAWAAN.forEach(function (r) {
    var sub = subdimensiBaku_(r[0]);
    if (sub) (hasil[sub] = hasil[sub] || {})[r[1]] = rapikanNarasi_(r[2]);
  });
  return hasil;
}

function dimensiKelas_(ss, ta, sem, kelas) {
  return bacaTabel_(ss, 'Kokurikuler').filter(function (r) {
    return teks_(r['Tahun Ajaran']) === ta && Number(r.Semester) === sem && Number(r.Kelas) === kelas && subdimensiBaku_(r.Subdimensi);
  }).sort(function (a, b) { return Number(a.No) - Number(b.No); }).map(function (r) {
    var sub = subdimensiBaku_(r.Subdimensi);
    return { dimensi: dimensiDari_(sub), subdimensi: sub };
  });
}

/** Subdimensi kelas-semester ini yang sudah punya capaian siswa: { subdimensi: jumlah siswa }. */
function subdimensiTerisi_(ss, ta, sem, kelas) {
  var kelasRombel = {}, kelasSiswa = {}, ada = {};
  daftarRombel_(ss, ta).forEach(function (r) { kelasRombel[r.id] = r.kelas; });
  bacaTabel_(ss, 'Anggota Rombel').forEach(function (a) {
    if (teks_(a['Tahun Ajaran']) === ta) kelasSiswa[teks_(a['ID Siswa'])] = kelasRombel[teks_(a['ID Rombel'])];
  });
  bacaTabel_(ss, 'Capaian Kokurikuler').forEach(function (c) {
    if (teks_(c['Tahun Ajaran']) !== ta || Number(c.Semester) !== sem || !levelKok_(c.Level)) return;
    if (kelasSiswa[teks_(c['ID Siswa'])] !== kelas) return;
    var sub = subdimensiBaku_(c.Subdimensi);
    if (sub) ada[sub] = (ada[sub] || 0) + 1;
  });
  return ada;
}

/** Konteks satu layar: rombel, semester, siswa, dan subdimensi kelasnya. Hasil { galat } bila tidak cocok. */
function konteksKok_(ss, req) {
  var atur = aturSekolah_(ss), ta = atur.tahunAjaran;
  var sem = Number(req.semester) === 1 || Number(req.semester) === 2 ? Number(req.semester) : atur.semester;
  var rombel = daftarRombel_(ss, ta).filter(function (r) { return r.id === teks_(req.rombel); })[0];
  if (!rombel) return { galat: 'Rombel tidak ditemukan. Muat ulang halaman.' };
  return { ta: ta, sem: sem, rombel: rombel, siswa: siswaUrut_(ss, ta, rombel.id), dimensi: dimensiKelas_(ss, ta, sem, rombel.kelas) };
}

/** Capaian tersimpan siswa di layar ini: { idSiswa: { subdimensi: 'Cakap' } }, hanya subdimensi kelas ini. */
function capaianTersimpan_(ss, k) {
  var hasil = {}, sub = {};
  k.siswa.forEach(function (s) { hasil[s.id] = {}; });
  k.dimensi.forEach(function (d) { sub[d.subdimensi] = true; });
  bacaTabel_(ss, 'Capaian Kokurikuler').forEach(function (c) {
    var id = teks_(c['ID Siswa']), s = subdimensiBaku_(c.Subdimensi), level = levelKok_(c.Level);
    if (!hasil[id] || !sub[s] || !level || teks_(c['Tahun Ajaran']) !== k.ta || Number(c.Semester) !== k.sem) return;
    hasil[id][s] = level;
  });
  return hasil;
}

function hasilKok_(ss, k, capaian, narasi) {
  var pakaiPanggilan = teks_(bacaKunciNilai_(ss, 'Pengaturan')['Pakai Nama Panggilan']).toLowerCase() !== 'tidak';
  var hasil = {};
  k.siswa.forEach(function (s) {
    var c = capaian[s.id] || {};
    var d = deskripsiKokurikuler_(pakaiPanggilan ? s.panggilan : '', k.dimensi.map(function (x) {
      return { dimensi: x.dimensi, subdimensi: x.subdimensi, level: c[x.subdimensi] || '' };
    }), narasi);
    var kurang = k.dimensi.filter(function (x) { return !c[x.subdimensi]; }).length;
    if (k.dimensi.length && kurang && kurang < k.dimensi.length) d.peringatan.push(kurang + ' subdimensi belum diisi.');
    hasil[s.id] = { teks: d.teks, peringatan: d.peringatan, lengkap: k.dimensi.length > 0 && !kurang };
  });
  return hasil;
}

function bentukKok_(ss, k, capaian) {
  var narasi = bacaNarasi_(ss), bawaan = narasiBawaan_();
  var narasiDipakai = {};
  k.dimensi.forEach(function (d) {
    narasiDipakai[d.subdimensi] = {};
    LEVEL_KOKURIKULER.forEach(function (l) {
      narasiDipakai[d.subdimensi][l] = { teks: (narasi[d.subdimensi] || {})[l] || '', bawaan: (bawaan[d.subdimensi] || {})[l] || '' };
    });
  });
  return {
    ok: true, tahunAjaran: k.ta, semester: k.sem, rombel: k.rombel, level: LEVEL_KOKURIKULER, maks: MAKS_SUBDIMENSI,
    referensi: DIMENSI_PROFIL, dimensi: k.dimensi,
    terisi: subdimensiTerisi_(ss, k.ta, k.sem, k.rombel.kelas),
    siswa: k.siswa.map(function (s) { return { id: s.id, no: s.no, nama: s.nama }; }),
    capaian: capaian, hasil: hasilKok_(ss, k, capaian, narasi), narasi: narasiDipakai
  };
}

/* ---------- aksi ---------- */

function kokRombel_(npsn, req) {
  var ss = bukaSekolah_(npsn);
  var k = konteksKok_(ss, req || {});
  if (k.galat) return { ok: false, pesan: k.galat };
  return bentukKok_(ss, k, capaianTersimpan_(ss, k));
}

/**
 * Menyimpan subdimensi yang dinilai untuk kelas rombel ini pada semester itu (berlaku untuk semua rombel kelas itu).
 * Subdimensi yang sudah punya capaian siswa tidak bisa dihapus.
 */
function simpanDimensiKok_(npsn, req) {
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var k = konteksKok_(ss, req || {});
    if (k.galat) return { ok: false, pesan: k.galat };
    var cek = cekDimensiKelas_(req.dimensi);
    var terisi = subdimensiTerisi_(ss, k.ta, k.sem, k.rombel.kelas);
    var baru = {};
    cek.daftar.forEach(function (d) { baru[d.subdimensi] = true; });
    k.dimensi.forEach(function (d) {
      if (!baru[d.subdimensi] && terisi[d.subdimensi]) {
        cek.salah.push('"' + d.subdimensi + '" sudah punya capaian ' + terisi[d.subdimensi] + ' siswa, jadi tidak bisa dihapus.');
      }
    });
    if (cek.salah.length) return { ok: false, salah: cek.salah, pesan: cek.salah[0] };

    var sisa = bacaTabel_(ss, 'Kokurikuler').filter(function (r) {
      return !(teks_(r['Tahun Ajaran']) === k.ta && Number(r.Semester) === k.sem && Number(r.Kelas) === k.rombel.kelas);
    });
    cek.daftar.forEach(function (d, i) {
      sisa.push({ 'Tahun Ajaran': k.ta, Semester: k.sem, Kelas: k.rombel.kelas, No: i + 1, Dimensi: d.dimensi, Subdimensi: d.subdimensi });
    });
    tulisTabel_(ss, 'Kokurikuler', sisa);
    catatSekolah_(ss, 'simpan dimensi kokurikuler', 'Kelas ' + k.rombel.kelas + ' smt ' + k.sem + ': ' + cek.daftar.length + ' subdimensi');
    k.dimensi = cek.daftar;
    var layar = bentukKok_(ss, k, capaianTersimpan_(ss, k));
    layar.pesan = cek.daftar.length + ' subdimensi kelas ' + k.rombel.kelas + ' semester ' + k.sem + ' tersimpan.';
    return layar;
  });
}

/**
 * Menyimpan capaian satu rombel. req.capaian = { idSiswa: { subdimensi: 'Cakap' | 'C' | '' } }.
 * Semua isian diperiksa dulu; satu salah → tidak ada yang tersimpan. Kosong menghapus capaian lama.
 */
function simpanKok_(npsn, req) {
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var k = konteksKok_(ss, req || {});
    if (k.galat) return { ok: false, pesan: k.galat };
    if (!k.dimensi.length) return { ok: false, pesan: 'Pilih dulu subdimensi yang dinilai di kelas ini.' };
    var isian = req.capaian && typeof req.capaian === 'object' ? req.capaian : {};
    var kenal = {}, salah = [], baru = {};
    k.siswa.forEach(function (s) { kenal[s.id] = s; });
    Object.keys(isian).forEach(function (id) {
      if (!kenal[id]) salah.push('Ada siswa yang tidak terdaftar di rombel ini. Muat ulang halaman.');
    });
    k.siswa.forEach(function (s) {
      var c = isian[s.id] && typeof isian[s.id] === 'object' ? isian[s.id] : {};
      baru[s.id] = {};
      k.dimensi.forEach(function (d) {
        var l = levelKok_(c[d.subdimensi]);
        if (l === null) salah.push(s.no + '. ' + s.nama + ' — ' + d.subdimensi + ': isi Mahir, Cakap, atau Berkembang.');
        else if (l) baru[s.id][d.subdimensi] = l;
      });
    });
    if (salah.length) return { ok: false, salah: salah, pesan: salah[0] };

    var sub = {};
    k.dimensi.forEach(function (d) { sub[d.subdimensi] = true; });
    var sisa = bacaTabel_(ss, 'Capaian Kokurikuler').filter(function (c) {
      return !(kenal[teks_(c['ID Siswa'])] && teks_(c['Tahun Ajaran']) === k.ta && Number(c.Semester) === k.sem &&
        sub[subdimensiBaku_(c.Subdimensi)]);
    });
    var jumlah = 0;
    k.siswa.forEach(function (s) {
      k.dimensi.forEach(function (d) {
        if (!baru[s.id][d.subdimensi]) return;
        sisa.push({ 'Tahun Ajaran': k.ta, Semester: k.sem, 'ID Siswa': s.id, Subdimensi: d.subdimensi, Level: baru[s.id][d.subdimensi] });
        jumlah++;
      });
    });
    tulisTabel_(ss, 'Capaian Kokurikuler', sisa);
    catatSekolah_(ss, 'simpan kokurikuler', k.rombel.nama + ' smt ' + k.sem + ': ' + jumlah + ' capaian');
    var layar = bentukKok_(ss, k, baru);
    var belum = k.siswa.filter(function (s) { return !layar.hasil[s.id].lengkap; }).length;
    layar.pesan = 'Capaian kokurikuler ' + labelRombel_(k.rombel) + ' tersimpan.' +
      (belum ? ' ' + belum + ' siswa belum lengkap.' : ' Semua siswa sudah lengkap.');
    return layar;
  });
}

/**
 * Mengubah Master Narasi sekolah. req.narasi = [{ subdimensi, level, narasi }].
 * Narasi kosong mengembalikan narasi bawaan untuk subdimensi-level itu.
 */
function simpanNarasi_(npsn, req) {
  var daftar = req && Array.isArray(req.narasi) ? req.narasi : [];
  var bawaan = narasiBawaan_(), salah = [], ubah = {};
  daftar.forEach(function (n) {
    var sub = subdimensiBaku_(n && n.subdimensi), level = levelKok_(n && n.level);
    if (!sub || !level) { salah.push('Subdimensi atau capaian tidak dikenal.'); return; }
    var teks = rapikanNarasi_(n.narasi) || (bawaan[sub] || {})[level] || '';
    if (!teks) { salah.push(sub + ' (' + level + '): narasi tidak boleh kosong.'); return; }
    if (teks.length > 300) { salah.push(sub + ' (' + level + '): narasi terlalu panjang (maks. 300 karakter).'); return; }
    ubah[sub + '|' + level] = { Subdimensi: sub, Level: level, Narasi: teks };
  });
  if (salah.length) return { ok: false, salah: salah, pesan: salah[0] };
  if (!Object.keys(ubah).length) return { ok: false, pesan: 'Tidak ada narasi yang diubah.' };
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var sisa = bacaTabel_(ss, 'Master Narasi').filter(function (r) {
      return !ubah[subdimensiBaku_(r.Subdimensi) + '|' + levelKok_(r.Level)];
    });
    Object.keys(ubah).forEach(function (x) { sisa.push(ubah[x]); });
    tulisTabel_(ss, 'Master Narasi', sisa);
    catatSekolah_(ss, 'simpan narasi', Object.keys(ubah).length + ' narasi');
    return { ok: true, pesan: Object.keys(ubah).length + ' narasi tersimpan.' };
  });
}
