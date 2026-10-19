/**
 * Aplikasi Rapor SD — input nilai mapel per rombel.
 *
 * Satu layar = satu rombel, satu mapel, satu varian (agama/seni), satu semester.
 * Nilai disimpan di sheet Nilai, satu baris per angka:
 *   Jenis "TP"  → Kode = kode TP (TP1, TP2, …; unik di kelas-mapel-semester, jadi tanpa varian)
 *   Jenis "SAS" → Kode = "TES" / "PRAKTIK", diawali varian bila mapel punya varian ("Seni Musik|TES"),
 *                 karena satu siswa bisa mengikuti beberapa seni.
 * Nilai rapor, predikat, dan deskripsi tidak disimpan; selalu dihitung ulang dari angka-angka ini
 * dengan hitungNilaiMapel_ (Hitung.gs), sehingga mengubah bobot/KKTP langsung berlaku.
 */

var KODE_SAS = ['TES', 'PRAKTIK'];

function kodeSas_(varian, kode) { return varian ? varian + '|' + kode : kode; }

/* ---------- aturan perhitungan sekolah ---------- */

/**
 * Bobot, KKTP, dan gaya deskripsi dari spreadsheet sekolah, sudah diperiksa.
 * Pengaturan yang rusak (mis. bobot tidak 100%) menghasilkan galat yang jelas, bukan nilai yang salah.
 */
function aturanNilai_(ss) {
  var a = bacaKunciNilai_(ss, 'Pengaturan');
  var bobot = { lingkup: Number(a['Bobot Lingkup Materi']), akhir: Number(a['Bobot Akhir Semester']) };
  var kktp = bacaTabel_(ss, 'KKTP').map(function (r) {
    return { min: Number(r['Batas Bawah']), predikat: teks_(r.Predikat), kalimat: teks_(r['Kalimat Deskripsi']) };
  }).sort(function (x, y) { return y.min - x.min; });
  var salah = cekBobot_(bobot).concat(cekKktp_(kktp));
  if (salah.length) throw galatPengguna_('Pengaturan nilai sekolah perlu diperbaiki: ' + salah[0]);
  var mode = teks_(a['Mode Deskripsi']).toLowerCase() === 'predikat' ? 'predikat' : 'tetap';
  return {
    bobot: bobot, kktp: kktp,
    deskripsi: {
      mode: mode,
      kalimatTinggi: teks_(a['Kalimat Capaian Tertinggi']) || DESKRIPSI_BAWAAN.kalimatTinggi,
      kalimatRendah: teks_(a['Kalimat Capaian Terendah']) || DESKRIPSI_BAWAAN.kalimatRendah,
      pakaiPanggilan: teks_(a['Pakai Nama Panggilan']).toLowerCase() !== 'tidak'
    }
  };
}

/* ---------- siswa dan TP untuk satu layar ---------- */

/** Siswa satu rombel urut nomor absen, dengan agama dan seni pilihan. */
function siswaUrut_(ss, ta, rombelId) {
  var siswa = {};
  bacaTabel_(ss, 'Siswa').forEach(function (r) { siswa[teks_(r['ID Siswa'])] = r; });
  return bacaTabel_(ss, 'Anggota Rombel')
    .filter(function (a) { return teks_(a['ID Rombel']) === rombelId && teks_(a['Tahun Ajaran']) === ta && siswa[teks_(a['ID Siswa'])]; })
    .sort(function (a, b) { return Number(a['No Urut']) - Number(b['No Urut']); })
    .map(function (a, i) {
      var s = siswa[teks_(a['ID Siswa'])];
      return {
        id: teks_(a['ID Siswa']), no: i + 1, nama: teks_(s['Nama Lengkap']), panggilan: teks_(s['Nama Panggilan']),
        agama: teks_(s.Agama), seni: pecahSeni_(teks_(a['Seni Pilihan']))
      };
    });
}

/** Apakah siswa mengikuti varian ini (agama/seni)? Mapel tanpa varian diikuti semua siswa. */
function ikutVarian_(s, jenis, varian) {
  if (jenis === 'agama') return s.agama === varian;
  if (jenis === 'seni') return s.seni.indexOf(varian) >= 0;
  return true;
}

/** Varian yang punya siswa di rombel ini, terbanyak dulu. */
function varianRombel_(siswa, jenis, seniSekolah) {
  if (jenis !== 'agama' && jenis !== 'seni') return [''];
  var daftar = jenis === 'agama' ? AGAMA : seniSekolah;
  return daftar.map(function (v) {
    return { v: v, n: siswa.filter(function (s) { return ikutVarian_(s, jenis, v); }).length };
  }).filter(function (x) { return x.n; })
    .sort(function (a, b) { return b.n - a.n; })
    .map(function (x) { return x.v; });
}

function tpSet_(ss, ta, sem, kelas, mapel, varian) {
  return bacaTabel_(ss, 'Tujuan Pembelajaran').filter(function (r) {
    return teks_(r['Tahun Ajaran']) === ta && Number(r.Semester) === sem && Number(r.Kelas) === kelas &&
      teks_(r['Kode Mapel']) === mapel && teks_(r.Varian) === varian && teks_(r['Tujuan Pembelajaran']);
  }).map(barisTp_);
}

/**
 * Konteks satu layar input: rombel, mapel, varian, semester, siswa yang ikut, dan TP.
 * Hasil { galat } bila ada yang tidak cocok.
 */
function konteksNilai_(ss, req) {
  var atur = aturSekolah_(ss), ta = atur.tahunAjaran;
  var sem = Number(req.semester) === 1 || Number(req.semester) === 2 ? Number(req.semester) : atur.semester;
  var rombel = daftarRombel_(ss, ta).filter(function (r) { return r.id === teks_(req.rombel); })[0];
  if (!rombel) return { galat: 'Rombel tidak ditemukan. Muat ulang halaman.' };
  var mapelKelas = mapelAktifKelas_(ss, ta, rombel.kelas);
  if (!mapelKelas.length) return { galat: 'Belum ada mapel aktif di kelas ' + rombel.kelas + '.' };
  var mapel = teks_(req.mapel) ? mapelKelas.filter(function (m) { return m.kode === teks_(req.mapel).toUpperCase(); })[0] : mapelKelas[0];
  if (!mapel) return { galat: 'Mapel ini tidak aktif di kelas ' + rombel.kelas + '.' };
  var semuaSiswa = siswaUrut_(ss, ta, rombel.id);
  var varianAda = varianRombel_(semuaSiswa, mapel.jenis, atur.seni);
  var varian = req.varian !== undefined && varianAda.indexOf(teks_(req.varian)) >= 0 ? teks_(req.varian) : (varianAda[0] || '');
  var siswa = semuaSiswa.filter(function (s) { return ikutVarian_(s, mapel.jenis, varian); });
  return {
    ta: ta, sem: sem, rombel: rombel, mapelKelas: mapelKelas, mapel: mapel, varian: varian, varianAda: varianAda,
    siswa: siswa, jumlahRombel: semuaSiswa.length, tp: tpSet_(ss, ta, sem, rombel.kelas, mapel.kode, varian)
  };
}

/** Angka tersimpan untuk siswa-siswa di konteks ini: { idSiswa: { TP1: 85, TES: 80, PRAKTIK: '' } }. */
function nilaiTersimpan_(ss, k) {
  var ids = {}, hasil = {};
  k.siswa.forEach(function (s) { ids[s.id] = true; hasil[s.id] = {}; });
  var kodeTp = {};
  k.tp.forEach(function (t) { kodeTp[t.kode] = true; });
  bacaTabel_(ss, 'Nilai').forEach(function (n) {
    var id = teks_(n['ID Siswa']);
    if (!ids[id] || teks_(n['Tahun Ajaran']) !== k.ta || Number(n.Semester) !== k.sem || teks_(n['Kode Mapel']) !== k.mapel.kode) return;
    var kode = teks_(n.Kode), jenis = teks_(n.Jenis);
    if (jenis === 'TP' && kodeTp[kode]) hasil[id][kode] = n.Nilai;
    if (jenis === 'SAS') {
      KODE_SAS.forEach(function (s) { if (kode === kodeSas_(k.varian, s)) hasil[id][s] = n.Nilai; });
    }
  });
  return hasil;
}

/** Nilai rapor, predikat, deskripsi, dan peringatan untuk tiap siswa di layar ini. */
function hasilNilai_(k, nilai, aturan) {
  var hasil = {};
  k.siswa.forEach(function (s) {
    var n = nilai[s.id] || {};
    var h = hitungNilaiMapel_({
      tp: k.tp.map(function (t) { return { kode: t.kode, materi: t.materi || t.tp, nilai: n[t.kode] }; }),
      akhir: KODE_SAS.map(function (x) { return n[x]; })
    }, {
      bobot: aturan.bobot, kktp: aturan.kktp, deskripsi: aturan.deskripsi, panggilan: s.panggilan
    });
    hasil[s.id] = {
      nilai: h.nilai, predikat: h.predikat, lengkap: h.lengkap, deskripsiTinggi: h.deskripsiTinggi,
      deskripsiRendah: h.deskripsiRendah, peringatan: h.peringatan, salah: h.salah
    };
  });
  return hasil;
}

function bentukLayar_(k, nilai, hasil) {
  return {
    ok: true, tahunAjaran: k.ta, semester: k.sem, rombel: k.rombel,
    mapelKelas: k.mapelKelas.map(function (m) { return { kode: m.kode, nama: m.nama, jenis: m.jenis }; }),
    mapel: { kode: k.mapel.kode, nama: k.mapel.nama, jenis: k.mapel.jenis }, varian: k.varian, varianAda: k.varianAda,
    siswa: k.siswa.map(function (s) { return { id: s.id, no: s.no, nama: s.nama }; }), jumlahRombel: k.jumlahRombel,
    tp: k.tp.map(function (t) { return { kode: t.kode, tp: t.tp, materi: t.materi }; }),
    nilai: nilai, hasil: hasil
  };
}

/* ---------- aksi ---------- */

function nilaiRombel_(npsn, req) {
  var ss = bukaSekolah_(npsn);
  var k = konteksNilai_(ss, req || {});
  if (k.galat) return { ok: false, pesan: k.galat };
  var nilai = nilaiTersimpan_(ss, k);
  var layar = bentukLayar_(k, nilai, hasilNilai_(k, nilai, aturanNilai_(ss)));
  layar.terkunci = infoKunci_(ss, k.ta, k.sem, k.rombel.id);
  return layar;
}

/**
 * Menyimpan angka satu layar. req.nilai = { idSiswa: { TP1: '85', TES: '80,5', PRAKTIK: '' } }.
 * Semua angka diperiksa dulu (0–100, koma desimal boleh); satu saja salah → tidak ada yang tersimpan.
 * Isian kosong menghapus angka lama. Baris di luar layar ini (mapel/varian/semester lain) tidak disentuh.
 */
function simpanNilai_(npsn, req) {
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var k = konteksNilai_(ss, req || {});
    if (k.galat) return { ok: false, pesan: k.galat };
    cekTerkunci_(ss, k.ta, k.sem, k.rombel);
    if (!k.tp.length) return { ok: false, pesan: 'Belum ada TP untuk mapel ini. Susun dulu di menu Tujuan Pembelajaran.' };
    if (k.varian !== teks_(req.varian)) return { ok: false, pesan: 'Pilihan agama/seni berubah. Muat ulang halaman.' };
    var isian = req.nilai && typeof req.nilai === 'object' ? req.nilai : {};
    var kenal = {};
    k.siswa.forEach(function (s) { kenal[s.id] = s; });
    var salah = [], baru = {};
    Object.keys(isian).forEach(function (id) {
      if (!kenal[id]) salah.push('Ada siswa yang tidak terdaftar di layar ini. Muat ulang halaman.');
    });
    k.siswa.forEach(function (s) {
      var n = isian[s.id] || {};
      baru[s.id] = {};
      k.tp.map(function (t) { return t.kode; }).concat(KODE_SAS).forEach(function (kode) {
        var b = bacaNilai_(n[kode]);
        if (!b.ok) salah.push(s.no + '. ' + s.nama + ' — ' + (KODE_SAS.indexOf(kode) >= 0 ? 'Sumatif akhir ' + kode.toLowerCase() : kode) + ': ' + b.pesan);
        else if (b.nilai !== null) baru[s.id][kode] = b.nilai;
      });
    });
    if (salah.length) return { ok: false, salah: salah, pesan: salah[0] };

    var kodeTp = {};
    k.tp.forEach(function (t) { kodeTp[t.kode] = true; });
    var kodeSasIni = {};
    KODE_SAS.forEach(function (x) { kodeSasIni[kodeSas_(k.varian, x)] = x; });
    var semua = bacaTabel_(ss, 'Nilai');
    var diLingkup = function (n) {
      if (!kenal[teks_(n['ID Siswa'])] || teks_(n['Tahun Ajaran']) !== k.ta || Number(n.Semester) !== k.sem ||
        teks_(n['Kode Mapel']) !== k.mapel.kode) return false;
      var kode = teks_(n.Kode);
      return (teks_(n.Jenis) === 'TP' && kodeTp[kode]) || (teks_(n.Jenis) === 'SAS' && kodeSasIni[kode]);
    };
    var kunciBaris = function (n) { return teks_(n['ID Siswa']) + '|' + teks_(n.Jenis) + '|' + teks_(n.Kode); };
    var lamaPer = {};
    semua.forEach(function (n) { if (diLingkup(n)) lamaPer[kunciBaris(n)] = n; });
    var waktu = new Date(), jumlah = 0, ganti = [];
    k.siswa.forEach(function (s) {
      Object.keys(baru[s.id]).forEach(function (kode) {
        var sas = KODE_SAS.indexOf(kode) >= 0;
        var r = {
          'Tahun Ajaran': k.ta, Semester: k.sem, 'ID Siswa': s.id, 'Kode Mapel': k.mapel.kode,
          Jenis: sas ? 'SAS' : 'TP', Kode: sas ? kodeSas_(k.varian, kode) : kode, Nilai: baru[s.id][kode], 'Diubah Pada': waktu
        };
        var lama = lamaPer[kunciBaris(r)];
        ganti.push(lama && Number(lama.Nilai) === r.Nilai && teks_(lama.Nilai) !== '' ? lama : r); // angka sama: baris tidak disentuh
        jumlah++;
      });
    });
    tulisTabel_(ss, 'Nilai', gantiDiTempat_(semua, diLingkup, kunciBaris, ganti));
    catatSekolah_(ss, 'simpan nilai', k.rombel.nama + ' ' + k.mapel.nama + (k.varian ? ' (' + k.varian + ')' : '') +
      ' smt ' + k.sem + ': ' + jumlah + ' angka');
    var hasil = hasilNilai_(k, baru, aturanNilai_(ss));
    var belum = k.siswa.filter(function (s) { return !hasil[s.id].lengkap; }).length;
    var layar = bentukLayar_(k, baru, hasil);
    layar.pesan = 'Nilai ' + k.mapel.nama + (k.varian ? ' (' + k.varian + ')' : '') + ' ' + labelRombel_(k.rombel) + ' tersimpan.' +
      (belum ? ' ' + belum + ' siswa nilainya belum lengkap.' : ' Semua siswa sudah lengkap.');
    return layar;
  });
}
