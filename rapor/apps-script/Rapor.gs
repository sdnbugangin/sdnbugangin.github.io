/**
 * Aplikasi Rapor SD — rekap satu rombel: kelengkapan, leger, dan isi rapor tiap siswa.
 *
 * Semua dihitung ulang dari data mentah (angka nilai, capaian, isian wali kelas) dengan fungsi yang sama
 * dengan layar input, jadi yang dicetak selalu sama dengan yang dilihat guru.
 * Rapor dicetak dari peramban (Cetak / Simpan sebagai PDF), sehingga sekolah tidak perlu akses ke Drive pengelola.
 */

var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
var KUNCI_PROFIL_RAPOR = ['Kepala Sekolah', 'Tempat Pembagian Rapor', 'Tanggal Pembagian Rapor', 'Alamat'];

/** "2026-06-20" → "20 Juni 2026"; tanggal tidak sah → ''. */
function tanggalPanjang_(v) {
  var t = normalisasiTanggal_(v);
  if (!t) return '';
  var p = t.split('-');
  return Number(p[2]) + ' ' + NAMA_BULAN[Number(p[1]) - 1] + ' ' + p[0];
}

/** Nama mapel agama di rapor sesuai agama siswa. */
function namaMapelAgama_(agama) {
  if (!agama) return 'Pendidikan Agama dan Budi Pekerti';
  if (/^Kepercayaan/.test(agama)) return 'Pendidikan Kepercayaan terhadap Tuhan YME dan Budi Pekerti';
  return 'Pendidikan Agama ' + agama + ' dan Budi Pekerti';
}

/** Isian hitungNilaiMapel_ untuk satu siswa dari indeks nilai: tp = daftar TP, awalSas = '' atau 'Seni Musik|'. */
function isianSiswa_(nilaiSiswa, tp, awalSas) {
  var n = nilaiSiswa || {};
  return {
    tp: tp.map(function (t) { return { kode: t.kode, materi: t.materi || t.tp, nilai: n['TP|' + t.kode] }; }),
    akhir: KODE_SAS.map(function (x) { return n['SAS|' + awalSas + x]; })
  };
}

/** Nilai satu mapel untuk satu siswa, sudah memperhitungkan agama/seni pilihannya. */
function nilaiMapelSiswa_(m, s, nilaiSiswa, tpPer, aturan) {
  var atur = { bobot: aturan.bobot, kktp: aturan.kktp, deskripsi: aturan.deskripsi, panggilan: s.panggilan };
  var tpOf = function (v) { return tpPer[m.kode + '|' + v] || []; };
  var h, nama = m.nama;
  if (m.jenis === 'seni') {
    var bagian = s.seni.map(function (v) { return { nama: v, isian: isianSiswa_(nilaiSiswa, tpOf(v), v + '|') }; });
    h = hitungNilaiGabungan_(bagian, atur);
    s.seni.forEach(function (v) { if (!tpOf(v).length) h.peringatan.push(v + ': TP belum disusun.'); });
  } else {
    var varian = m.jenis === 'agama' ? s.agama : '';
    if (m.jenis === 'agama') nama = namaMapelAgama_(s.agama);
    if (m.jenis === 'agama' && !s.agama) {
      h = hitungNilaiMapel_({ tp: [], akhir: [] }, atur);
      h.peringatan = ['Agama siswa belum diisi.'];
    } else {
      h = hitungNilaiMapel_(isianSiswa_(nilaiSiswa, tpOf(varian), varian ? varian + '|' : ''), atur);
      if (!tpOf(varian).length) h.peringatan.unshift('TP belum disusun.');
    }
  }
  // TP tertinggi/terendah lengkap dengan isi TP-nya, untuk dipilih guru di e-Rapor (seni: satu per seni).
  var isiTp = function (t, seni) {
    var cari = (tpOf(seni || (m.jenis === 'agama' ? s.agama : '')) || []).filter(function (x) { return x.kode === t.kode; })[0];
    return { kode: t.kode, tp: cari ? cari.tp : '', nilai: t.nilai, seni: seni || '' };
  };
  var tinggi = [], rendah = [];
  (h.rincian || [{ nama: '', hasil: h }]).forEach(function (r) {
    if (r.hasil.tertinggi) tinggi.push(isiTp(r.hasil.tertinggi, r.nama));
    if (r.hasil.terendah) rendah.push(isiTp(r.hasil.terendah, r.nama));
  });
  return {
    kode: m.kode, nama: nama, jenis: m.jenis, nilai: h.nilai, predikat: h.predikat, lengkap: h.lengkap && !h.salah.length,
    deskripsi: [h.deskripsiTinggi, h.deskripsiRendah].filter(String), peringatan: h.peringatan.concat(h.salah),
    deskripsiTinggi: h.deskripsiTinggi, deskripsiRendah: h.deskripsiRendah, tpTinggi: tinggi, tpRendah: rendah
  };
}

function rekapRombel_(npsn, req) {
  var ss = bukaSekolah_(npsn);
  req = req || {};
  var k = konteksWali_(ss, req);
  if (k.galat) return { ok: false, pesan: k.galat };
  var kelas = k.rombel.kelas;
  var aturan = aturanNilai_(ss);

  // profil sekolah
  var profil = {};
  bacaTabel_(ss, 'Profil Sekolah').forEach(function (r) { profil[teks_(r.Kunci)] = teks_(r.Nilai); });
  var masalahUmum = [];
  KUNCI_PROFIL_RAPOR.forEach(function (x) { if (!profil[x]) masalahUmum.push('Profil sekolah: ' + x + ' belum diisi.'); });
  if (profil['Tanggal Pembagian Rapor'] && !tanggalPanjang_(profil['Tanggal Pembagian Rapor'])) masalahUmum.push('Profil sekolah: tanggal pembagian rapor tidak valid.');
  if (!k.rombel.wali) masalahUmum.push('Nama wali kelas ' + labelRombel_(k.rombel) + ' belum diisi (Data Sekolah → Rombel).');

  // siswa + identitas
  var identitas = {};
  bacaTabel_(ss, 'Siswa').forEach(function (r) { identitas[teks_(r['ID Siswa'])] = { nis: teks_(r.NIS), nisn: teks_(r.NISN) }; });

  // mapel, TP, dan nilai
  var mapel = mapelAktifKelas_(ss, k.ta, kelas);
  if (!mapel.length) masalahUmum.push('Belum ada mapel aktif di kelas ' + kelas + '.');
  var tpPer = {};
  bacaTabel_(ss, 'Tujuan Pembelajaran').forEach(function (r) {
    if (teks_(r['Tahun Ajaran']) !== k.ta || Number(r.Semester) !== k.sem || Number(r.Kelas) !== kelas || !teks_(r['Tujuan Pembelajaran'])) return;
    var kunci = teks_(r['Kode Mapel']) + '|' + teks_(r.Varian);
    (tpPer[kunci] = tpPer[kunci] || []).push(barisTp_(r));
  });
  var nilai = {}; // idSiswa → kodeMapel → { 'TP|TP1': 80, 'SAS|Seni Musik|TES': 75 }
  bacaTabel_(ss, 'Nilai').forEach(function (n) {
    var id = teks_(n['ID Siswa']);
    if (!k.kenal[id] || teks_(n['Tahun Ajaran']) !== k.ta || Number(n.Semester) !== k.sem) return;
    var per = (nilai[id] = nilai[id] || {});
    (per[teks_(n['Kode Mapel'])] = per[teks_(n['Kode Mapel'])] || {})[teks_(n.Jenis) + '|' + teks_(n.Kode)] = n.Nilai;
  });

  // kokurikuler dan isian wali kelas
  var kk = { ta: k.ta, sem: k.sem, rombel: k.rombel, siswa: k.siswa, dimensi: dimensiKelas_(ss, k.ta, k.sem, kelas) };
  var hasilKok = hasilKok_(ss, kk, capaianTersimpan_(ss, kk), bacaNarasi_(ss));
  var wali = bentukWali_(ss, k);

  var siswa = k.siswa.map(function (s) {
    var hasilMapel = mapel.map(function (m) { return nilaiMapelSiswa_(m, s, (nilai[s.id] || {})[m.kode], tpPer, aturan); });
    var masalah = [];
    hasilMapel.forEach(function (h) {
      if (!h.lengkap) masalah.push(h.nama + ': ' + (h.peringatan[0] || 'nilai belum lengkap.'));
    });
    if (!kk.dimensi.length) masalah.push('Kokurikuler: subdimensi kelas ' + kelas + ' belum dipilih.');
    else if (!hasilKok[s.id].lengkap) masalah.push('Kokurikuler: ' + (hasilKok[s.id].peringatan[0] || 'capaian belum lengkap.'));
    wali.cek[s.id].peringatan.forEach(function (p) { masalah.push(p); });
    var ekskul = wali.ekskul[s.id].map(function (e) { return { kegiatan: e.kegiatan, keterangan: e.keterangan || e.otomatis }; });
    var naik = keteranganKenaikan_(kelas, k.sem, wali.kenaikan[s.id]);
    var nilaiAda = hasilMapel.filter(function (h) { return h.lengkap; }).map(function (h) { return h.nilai; });
    var semuaLengkap = hasilMapel.length > 0 && nilaiAda.length === hasilMapel.length;
    return {
      id: s.id, no: s.no, nama: s.nama, nis: (identitas[s.id] || {}).nis || '', nisn: (identitas[s.id] || {}).nisn || '',
      mapel: hasilMapel, kokurikuler: hasilKok[s.id].teks, ekskul: ekskul,
      presensi: wali.presensi[s.id], kenaikan: naik,
      jumlah: semuaLengkap ? nilaiAda.reduce(function (a, b) { return a + b; }, 0) : null,
      rataRata: semuaLengkap ? bulatkan_(rataRata_(nilaiAda), 2) : null,
      masalah: masalah
    };
  });
  var urutan = peringkat_(siswa.map(function (s) { return { id: s.id, jumlah: s.jumlah }; }));
  siswa.forEach(function (s) { s.peringkat = urutan[s.id] || null; });

  return {
    ok: true, tahunAjaran: k.ta, semester: k.sem,
    rombel: { id: k.rombel.id, kelas: kelas, nama: k.rombel.nama, label: labelRombel_(k.rombel), wali: k.rombel.wali, nip: k.rombel.nip,
      romawi: ROMAWI[kelas], fase: FASE_KELAS[kelas] },
    sekolah: {
      nama: profil['Nama Sekolah'] || '', npsn: profil.NPSN || '', alamat: [profil.Alamat, profil['Desa/Kelurahan'], profil.Kecamatan, profil['Kabupaten/Kota']].filter(String).join(', '),
      kepala: profil['Kepala Sekolah'] || '', nipKepala: profil['NIP Kepala Sekolah'] || '',
      tempat: profil['Tempat Pembagian Rapor'] || '', tanggal: tanggalPanjang_(profil['Tanggal Pembagian Rapor'])
    },
    mapel: mapel.map(function (m) { return { kode: m.kode, nama: m.nama, jenis: m.jenis }; }),
    siswa: siswa, masalahUmum: masalahUmum,
    siap: siswa.filter(function (s) { return !s.masalah.length; }).length
  };
}
