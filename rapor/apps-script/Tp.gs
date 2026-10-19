/**
 * Aplikasi Rapor SD — Tujuan Pembelajaran (TP).
 *
 * TP disusun per kelas, mapel, varian (agama/seni), dan semester; dipakai semua rombel di kelas itu.
 * Setiap TP punya kode tetap (TP1, TP2, …) yang dirujuk oleh nilai, sehingga mengubah urutan atau teks TP
 * tidak memindahkan nilai ke TP lain. TP yang sudah punya nilai tidak bisa dihapus.
 *
 * TP bawaan: TP milik sekolah sumber (Pengaturan Pusat "NPSN Sumber TP Bawaan") disalin ke sekolah baru
 * saat akunnya aktif, dan bisa diambil sekolah lain lewat tombol "Pakai TP bawaan".
 */

var MAKS_TP_SET = 40; // TP per kelas, mapel, varian, dan semester
var MAKS_KARAKTER_MATERI = 150;

/* ---------- pemeriksaan (murni) ---------- */

/**
 * Merapikan daftar TP dari guru. daftar = [{ kode?, tp, materi }].
 * kodeLain = kode yang dipakai varian lain di kelas-mapel-semester yang sama (agar tidak bentrok).
 * Baris kosong dibuang; kode lama dipertahankan, TP baru mendapat kode berikutnya yang belum dipakai.
 * Hasil: { salah[], tp: [{ kode, tp, materi }] }.
 */
function cekDaftarTp_(daftar, kodeLain) {
  var salah = [], dipakai = {}, teksDipakai = {};
  (kodeLain || []).forEach(function (k) { dipakai[k] = true; });
  var bersih = (Array.isArray(daftar) ? daftar : []).map(function (d) {
    return { kode: teks_(d && d.kode).toUpperCase(), tp: teks_(d && d.tp), materi: teks_(d && d.materi) };
  }).filter(function (d) { return d.tp || d.materi; });
  if (bersih.length > MAKS_TP_SET) salah.push('Maksimal ' + MAKS_TP_SET + ' TP per mapel per semester.');
  bersih.forEach(function (d, i) {
    var baris = 'TP nomor ' + (i + 1) + ': ';
    if (!d.tp) salah.push(baris + 'tujuan pembelajaran masih kosong.');
    else if (d.tp.length > MAKS_KARAKTER_TP) {
      salah.push(baris + 'terlalu panjang (' + d.tp.length + ' karakter). e-Rapor membatasi ' + MAKS_KARAKTER_TP + ' karakter.');
    }
    if (d.materi.length > MAKS_KARAKTER_MATERI) salah.push(baris + 'lingkup materi maksimal ' + MAKS_KARAKTER_MATERI + ' karakter.');
    var kunci = d.tp.toLowerCase();
    if (kunci && teksDipakai[kunci]) salah.push(baris + 'sama persis dengan TP nomor ' + teksDipakai[kunci] + '.');
    else if (kunci) teksDipakai[kunci] = i + 1;
    if (!/^TP\d+$/.test(d.kode) || dipakai[d.kode]) d.kode = '';
    if (d.kode) dipakai[d.kode] = true;
  });
  var n = 0;
  bersih.forEach(function (d) {
    if (d.kode) return;
    do { n++; } while (dipakai['TP' + n]);
    d.kode = 'TP' + n;
    dipakai[d.kode] = true;
  });
  return { salah: salah, tp: bersih };
}

/** Varian yang berlaku untuk satu jenis mapel: agama → daftar agama, seni → seni sekolah, lainnya → ['']. */
function varianMapel_(jenis, seniSekolah) {
  if (jenis === 'agama') return AGAMA.slice();
  if (jenis === 'seni') return seniSekolah.slice();
  return [''];
}

function kelasSah_(kelas) {
  var k = Number(kelas);
  return k >= 1 && k <= 6 && Math.floor(k) === k ? k : 0;
}

/* ---------- bantuan spreadsheet ---------- */

/** Mapel aktif di satu kelas, urut sesuai urutan rapor: [{ kode, nama, jenis }]. */
function mapelAktifKelas_(ss, ta, kelas) {
  return bacaTabel_(ss, 'Mapel Aktif')
    .filter(function (r) { return teks_(r['Tahun Ajaran']) === ta && Number(r.Kelas) === kelas && teks_(r.Aktif) === 'Ya'; })
    .sort(function (a, b) { return (Number(a.Urutan) || 99) - (Number(b.Urutan) || 99); })
    .map(function (r) { return { kode: teks_(r['Kode Mapel']), nama: teks_(r['Nama di Rapor']), jenis: teks_(r.Jenis) }; });
}

function barisTp_(r) {
  return {
    semester: Number(r.Semester), kelas: Number(r.Kelas), mapel: teks_(r['Kode Mapel']), varian: teks_(r.Varian),
    kode: teks_(r['Kode TP']), tp: teks_(r['Tujuan Pembelajaran']), materi: teks_(r['Lingkup Materi'])
  };
}

/** { 'KODEMAPEL|KODETP': true } untuk TP yang sudah punya nilai di kelas & semester ini. */
function tpBernilai_(ss, ta, semester, kelas) {
  var kelasRombel = {}, kelasSiswa = {}, ada = {};
  daftarRombel_(ss, ta).forEach(function (r) { kelasRombel[r.id] = r.kelas; });
  bacaTabel_(ss, 'Anggota Rombel').forEach(function (a) {
    if (teks_(a['Tahun Ajaran']) === ta) kelasSiswa[teks_(a['ID Siswa'])] = kelasRombel[teks_(a['ID Rombel'])];
  });
  bacaTabel_(ss, 'Nilai').forEach(function (n) {
    if (teks_(n['Tahun Ajaran']) !== ta || Number(n.Semester) !== semester || teks_(n.Jenis) !== 'TP' || teks_(n.Nilai) === '') return;
    if (kelasSiswa[teks_(n['ID Siswa'])] === kelas) ada[teks_(n['Kode Mapel']) + '|' + teks_(n.Kode)] = true;
  });
  return ada;
}

/* ---------- aksi ---------- */

function tpKelas_(npsn, kelas, semester) {
  var k = kelasSah_(kelas);
  if (!k) return { ok: false, pesan: 'Pilih kelas 1 sampai 6.' };
  var ss = bukaSekolah_(npsn);
  var atur = aturSekolah_(ss);
  var sem = Number(semester) === 2 ? 2 : Number(semester) === 1 ? 1 : atur.semester;
  var mapel = mapelAktifKelas_(ss, atur.tahunAjaran, k).map(function (m) {
    m.varian = varianMapel_(m.jenis, atur.seni);
    return m;
  });
  var tp = {};
  bacaTabel_(ss, 'Tujuan Pembelajaran').forEach(function (r) {
    if (teks_(r['Tahun Ajaran']) !== atur.tahunAjaran || Number(r.Semester) !== sem || Number(r.Kelas) !== k) return;
    var t = barisTp_(r);
    var kunci = t.mapel + '|' + t.varian;
    (tp[kunci] = tp[kunci] || []).push({ kode: t.kode, tp: t.tp, materi: t.materi });
  });
  // Agama siswa di kelas ini, agar halaman langsung memilih agama yang paling banyak.
  var agama = {}, rombelKelas = {}, siswaKelas = {};
  daftarRombel_(ss, atur.tahunAjaran).forEach(function (r) { if (r.kelas === k) rombelKelas[r.id] = true; });
  bacaTabel_(ss, 'Anggota Rombel').forEach(function (a) {
    if (teks_(a['Tahun Ajaran']) === atur.tahunAjaran && rombelKelas[teks_(a['ID Rombel'])]) siswaKelas[teks_(a['ID Siswa'])] = true;
  });
  bacaTabel_(ss, 'Siswa').forEach(function (s) {
    if (siswaKelas[teks_(s['ID Siswa'])]) agama[teks_(s.Agama)] = (agama[teks_(s.Agama)] || 0) + 1;
  });
  var sumber = pengaturanPusat_().sumberTp;
  return {
    ok: true, kelas: k, fase: FASE_KELAS[k], semester: sem, tahunAjaran: atur.tahunAjaran, mapel: mapel, tp: tp,
    agama: agama, bernilai: tpBernilai_(ss, atur.tahunAjaran, sem, k), adaBawaan: !!sumber && sumber !== npsn,
    maksKarakter: MAKS_KARAKTER_TP
  };
}

function simpanTp_(npsn, req) {
  var k = kelasSah_(req.kelas);
  var sem = Number(req.semester);
  if (!k) return { ok: false, pesan: 'Pilih kelas 1 sampai 6.' };
  if (sem !== 1 && sem !== 2) return { ok: false, pesan: 'Semester harus 1 atau 2.' };
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var atur = aturSekolah_(ss), ta = atur.tahunAjaran;
    var kodeMapel = teks_(req.mapel).toUpperCase();
    var m = mapelAktifKelas_(ss, ta, k).filter(function (x) { return x.kode === kodeMapel; })[0];
    if (!m) return { ok: false, pesan: 'Mapel ini tidak aktif di kelas ' + k + '. Atur di tab Mata Pelajaran.' };
    var varian = teks_(req.varian);
    var bolehVarian = varianMapel_(m.jenis, atur.seni);
    if (bolehVarian.indexOf(varian) < 0) return { ok: false, pesan: 'Pilih ' + (m.jenis === 'agama' ? 'agama' : 'seni') + ' terlebih dahulu.' };

    var semua = bacaTabel_(ss, 'Tujuan Pembelajaran');
    var samaMapel = function (r) {
      return teks_(r['Tahun Ajaran']) === ta && Number(r.Semester) === sem && Number(r.Kelas) === k && teks_(r['Kode Mapel']) === kodeMapel;
    };
    var lama = semua.filter(function (r) { return samaMapel(r) && teks_(r.Varian) === varian; }).map(barisTp_);
    var kodeLain = semua.filter(function (r) { return samaMapel(r) && teks_(r.Varian) !== varian; })
      .map(function (r) { return teks_(r['Kode TP']); });
    var cek = cekDaftarTp_(req.tp, kodeLain);

    var bernilai = tpBernilai_(ss, ta, sem, k);
    var baru = {};
    cek.tp.forEach(function (t) { baru[t.kode] = true; });
    lama.forEach(function (t) {
      if (!baru[t.kode] && bernilai[kodeMapel + '|' + t.kode]) {
        cek.salah.push('"' + t.tp + '" sudah punya nilai, jadi tidak bisa dihapus. Ubah teksnya saja jika perlu.');
      }
    });
    if (cek.salah.length) return { ok: false, salah: cek.salah, pesan: cek.salah[0] };

    var sisa = semua.filter(function (r) { return !(samaMapel(r) && teks_(r.Varian) === varian); });
    cek.tp.forEach(function (t) {
      sisa.push({
        'Tahun Ajaran': ta, Semester: sem, Kelas: k, 'Kode Mapel': kodeMapel, Varian: varian,
        'Kode TP': t.kode, 'Lingkup Materi': t.materi, 'Tujuan Pembelajaran': t.tp
      });
    });
    tulisTabel_(ss, 'Tujuan Pembelajaran', sisa);
    catatSekolah_(ss, 'simpan TP', 'Kelas ' + k + ' smt ' + sem + ' ' + m.nama + (varian ? ' (' + varian + ')' : '') + ': ' + cek.tp.length + ' TP');
    return { ok: true, tp: cek.tp, pesan: cek.tp.length + ' TP ' + m.nama + (varian ? ' (' + varian + ')' : '') + ' tersimpan.' };
  });
}

/**
 * TP bawaan dari sekolah sumber untuk tahun ajaran sumber yang sedang berjalan.
 * Tidak pernah melempar galat: jika sumber belum diatur atau tidak bisa dibuka, hasilnya daftar kosong.
 */
function tpSumber_() {
  try {
    var sumber = pengaturanPusat_().sumberTp;
    var s = sumber && cariSekolah_('npsn', sumber);
    if (!s || s.status !== STATUS.aktif || !s.spreadsheet) return [];
    var ss = SpreadsheetApp.openById(s.spreadsheet);
    var ta = aturSekolah_(ss).tahunAjaran;
    return bacaTabel_(ss, 'Tujuan Pembelajaran')
      .filter(function (r) { return teks_(r['Tahun Ajaran']) === ta && teks_(r['Tujuan Pembelajaran']); })
      .map(barisTp_);
  } catch (e) {
    return [];
  }
}

function tpBawaan_(npsn, kelas, semester, mapel, varian) {
  var sumber = pengaturanPusat_().sumberTp;
  if (!sumber || sumber === npsn) return { ok: false, pesan: 'TP bawaan belum tersedia.' };
  var k = kelasSah_(kelas), sem = Number(semester), kode = teks_(mapel).toUpperCase(), v = teks_(varian);
  var tp = tpSumber_().filter(function (t) { return t.kelas === k && t.semester === sem && t.mapel === kode && t.varian === v; })
    .map(function (t) { return { tp: t.tp, materi: t.materi }; });
  if (!tp.length) return { ok: false, pesan: 'TP bawaan untuk mapel, kelas, dan semester ini belum ada.' };
  return { ok: true, tp: tp, pesan: tp.length + ' TP bawaan dimuat. Periksa dan ubah bila perlu, lalu klik Simpan TP.' };
}

/**
 * Data untuk berkas impor TP e-Rapor satu kelas (dua semester), satu berkas per mapel.
 * Agama: satu berkas per agama (di e-Rapor tiap agama adalah mapel tersendiri).
 * Seni: semua seni digabung dalam satu berkas "Seni Budaya" (kode e-Rapor yang dikirim sekolah).
 */
function tpEkspor_(npsn, kelas) {
  var k = kelasSah_(kelas);
  if (!k) return { ok: false, pesan: 'Pilih kelas 1 sampai 6.' };
  var ss = bukaSekolah_(npsn);
  var atur = aturSekolah_(ss), ta = atur.tahunAjaran;
  var semua = bacaTabel_(ss, 'Tujuan Pembelajaran').filter(function (r) {
    return teks_(r['Tahun Ajaran']) === ta && Number(r.Kelas) === k && teks_(r['Tujuan Pembelajaran']);
  }).map(barisTp_);
  var berkas = [], peringatan = [];
  mapelAktifKelas_(ss, ta, k).forEach(function (m) {
    var kelompok = m.jenis === 'agama' ? AGAMA.map(function (a) { return [a]; }) : [varianMapel_(m.jenis, atur.seni)];
    kelompok.forEach(function (varianBerkas) {
      var baris = semua.filter(function (t) { return t.mapel === m.kode && varianBerkas.indexOf(t.varian) >= 0; })
        .sort(function (a, b) {
          return a.semester - b.semester || varianBerkas.indexOf(a.varian) - varianBerkas.indexOf(b.varian) ||
            Number(a.kode.slice(2)) - Number(b.kode.slice(2));
        });
      if (!baris.length) return;
      var agama = m.jenis === 'agama' ? varianBerkas[0] : '';
      var nama = agama ? 'Pendidikan Agama ' + agama + ' dan Budi Pekerti' : m.nama;
      var e = agama ? null : KODE_ERAPOR[m.kode];
      if (!e) peringatan.push('Kode e-Rapor untuk ' + nama + ' belum diketahui: sel C2 di berkasnya masih kosong, isi sendiri sebelum impor.');
      if (baris.length > 100) peringatan.push(nama + ': ' + baris.length + ' TP, melebihi 100 baris template e-Rapor.');
      berkas.push({
        mapel: m.kode, varian: agama, nama: nama,
        judul: e ? e.nama : nama.toUpperCase(), kodeErapor: e ? e.kode : '', namaBerkas: 'f_tp (' + (e ? e.berkas : nama) + ').xlsx',
        baris: baris.map(function (t) { return { tingkat: k, fase: FASE_KELAS[k], semester: t.semester, tp: t.tp }; })
      });
    });
  });
  if (!berkas.length) return { ok: false, pesan: 'Belum ada TP yang tersimpan untuk kelas ' + k + '.' };
  return { ok: true, kelas: k, tahunAjaran: ta, berkas: berkas, peringatan: peringatan };
}
