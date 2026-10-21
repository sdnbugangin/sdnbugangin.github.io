// Uji rekap rombel: isi rapor per siswa, seni ganda digabung, agama sesuai siswa, kelengkapan, leger, dan peringkat.
// Jalankan dari akar repo: node --test rapor/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { sekolahAktif } = require('./tiruan-gas.js');

const MAPEL_K5 = ['PAB', 'PP', 'BIND', 'MTK', 'IPAS', 'SENI', 'PJOK', 'BING', 'MULOK1'];

/** Kelas 5 dengan dua siswa; semua TP disusun satu per mapel/varian. */
function siapRapor() {
  const g = sekolahAktif();
  const r = g.minta({ aksi: 'simpanRombel', rombel: { kelas: 5, nama: '', wali: 'MEIRTHA H., S.Pd', nip: '198001012005012001' } }).rombel;
  g.minta({ aksi: 'simpanSiswa', rombel: r.id, siswa: [
    { nama: 'ANI LESTARI', panggilan: 'Ani', jk: 'P', agama: 'Islam', seni: 'Musik, Rupa', nis: '101', nisn: '0012345678' },
    { nama: 'BUDI SANTOSO', panggilan: 'Budi', jk: 'L', agama: 'Katolik', seni: 'Musik', nis: '102' }] });
  const tp = (mapel, varian, materi) => g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel, varian,
    tp: [{ tp: 'TP pertama ' + materi, materi: materi + ' satu' }, { tp: 'TP kedua ' + materi, materi: materi + ' dua' }] });
  MAPEL_K5.forEach((m) => {
    if (m === 'PAB') { tp(m, 'Islam', 'wudu'); tp(m, 'Katolik', 'doa'); }
    else if (m === 'SENI') { tp(m, 'Seni Musik', 'irama'); tp(m, 'Seni Rupa', 'gambar'); }
    else tp(m, '', m.toLowerCase());
  });
  const siswa = g.minta({ aksi: 'siswaRombel', rombel: r.id }).siswa;
  const id = Object.fromEntries(siswa.map((s) => [s.panggilan, s.id]));
  /** Isi nilai mapel untuk satu siswa: [TP1, TP2, TES]. */
  const nilai = (mapel, varian, siswaId, [a, b, c]) => {
    const h = g.minta({ aksi: 'simpanNilai', rombel: r.id, semester: 1, mapel, varian, nilai: { [siswaId]: { TP1: a, TP2: b, TES: c } } });
    assert.equal(h.ok, true, h.pesan);
  };
  return { g, rombel: r.id, id, nilai };
}

/** Lengkapi semua isian siswa yang disebut. Kode TP diambil dari layar nilai (unik lintas varian: TP3, TP4, …). */
function lengkapi({ g, rombel, id }, siswaList) {
  const kode = (mapel, varian) => g.minta({ aksi: 'nilaiRombel', rombel, semester: 1, mapel, varian }).tp.map((t) => t.kode);
  const isi = (mapel, varian, [a, b, c]) => { const [k1, k2] = kode(mapel, varian); return { [k1]: a, [k2]: b, TES: c }; };
  const isiNilai = {};
  siswaList.forEach((p, i) => {
    const sid = id[p];
    MAPEL_K5.forEach((m) => {
      if (m === 'SENI') return;
      const varian = m === 'PAB' ? (p === 'Ani' ? 'Islam' : 'Katolik') : '';
      isiNilai[m + '|' + varian] = isiNilai[m + '|' + varian] || {};
      isiNilai[m + '|' + varian][sid] = isi(m, varian, [String(90 - i * 10), String(70 - i * 10), String(80 - i * 10)]);
    });
  });
  Object.entries(isiNilai).forEach(([k, v]) => {
    const [mapel, varian] = k.split('|');
    assert.equal(g.minta({ aksi: 'simpanNilai', rombel, semester: 1, mapel, varian, nilai: v }).ok, true);
  });
  // seni: Ani dua seni, Budi satu
  const musik = {}; const rupa = {};
  siswaList.forEach((p) => { musik[id[p]] = isi('SENI', 'Seni Musik', ['90', '80', '85']); });
  if (siswaList.includes('Ani')) rupa[id.Ani] = isi('SENI', 'Seni Rupa', ['70', '60', '65']);
  g.minta({ aksi: 'simpanNilai', rombel, semester: 1, mapel: 'SENI', varian: 'Seni Musik', nilai: musik });
  if (siswaList.includes('Ani')) g.minta({ aksi: 'simpanNilai', rombel, semester: 1, mapel: 'SENI', varian: 'Seni Rupa', nilai: rupa });
  g.minta({ aksi: 'simpanDimensiKok', rombel, semester: 1, dimensi: ['Kerjasama'] });
  g.minta({ aksi: 'simpanKok', rombel, semester: 1, capaian: Object.fromEntries(siswaList.map((p) => [id[p], { Kerjasama: 'Cakap' }])) });
  g.minta({ aksi: 'simpanEkskulSekolah', daftar: ['Pramuka'] });
  g.minta({ aksi: 'simpanEkskul', rombel, semester: 1, ekskul: Object.fromEntries(siswaList.map((p) => [id[p], [{ kegiatan: 'Pramuka', predikat: 'Baik' }]])) });
  g.minta({ aksi: 'simpanPresensi', rombel, semester: 1, presensi: Object.fromEntries(siswaList.map((p) => [id[p], { sakit: '1', izin: '0', alpa: '0', catatan: 'Tingkatkan.' }])) });
  g.minta({ aksi: 'simpanProfil', profil: { 'Kepala Sekolah': 'YOS PUTRA K., S.Pd', Alamat: 'Jl. Bugangin', 'Tempat Pembagian Rapor': 'Kendal', 'Tanggal Pembagian Rapor': '2026-12-19' } });
}

test('tanggalPanjang_ dan namaMapelAgama_', () => {
  const { g } = siapRapor();
  assert.equal(g.ctx.tanggalPanjang_('2026-06-20'), '20 Juni 2026');
  assert.equal(g.ctx.tanggalPanjang_('05/12/2026'), '5 Desember 2026');
  assert.equal(g.ctx.tanggalPanjang_('31/02/2026'), '');
  assert.equal(g.ctx.namaMapelAgama_('Islam'), 'Pendidikan Agama Islam dan Budi Pekerti');
  assert.equal(g.ctx.namaMapelAgama_('Kepercayaan terhadap Tuhan YME'), 'Pendidikan Kepercayaan terhadap Tuhan YME dan Budi Pekerti');
});

test('rekapRombel: awal kosong, semua kekurangan dilaporkan', () => {
  const { g, rombel } = siapRapor();
  const h = g.minta({ aksi: 'rekapRombel', rombel });
  assert.equal(h.ok, true, h.pesan);
  assert.deepEqual(h.mapel.map((m) => m.kode), MAPEL_K5);
  assert.equal(h.siap, 0);
  assert.match(h.masalahUmum.join(' '), /Kepala Sekolah belum diisi/);
  assert.match(h.masalahUmum.join(' '), /Tanggal Pembagian Rapor belum diisi/);
  const ani = h.siswa[0];
  assert.equal(ani.nisn, '0012345678');
  assert.equal(ani.mapel[0].nama, 'Pendidikan Agama Islam dan Budi Pekerti');
  assert.equal(h.siswa[1].mapel[0].nama, 'Pendidikan Agama Katolik dan Budi Pekerti');
  const teks = ani.masalah.join(' | ');
  assert.match(teks, /Matematika: Belum ada nilai yang diisi/);
  assert.match(teks, /Kokurikuler: subdimensi kelas 5 belum dipilih/);
  assert.match(teks, /Ekstrakurikuler belum diisi/);
  assert.match(teks, /Catatan wali kelas belum diisi/);
  assert.doesNotMatch(teks, /kenaikan/, 'semester 1 tidak menuntut keputusan kenaikan');
  assert.equal(ani.peringkat, null);
});

test('rekapRombel: lengkap → siap cetak, seni ganda digabung, peringkat dan leger', () => {
  const ctx = siapRapor();
  lengkapi(ctx, ['Ani', 'Budi']);
  const h = ctx.g.minta({ aksi: 'rekapRombel', rombel: ctx.rombel });
  assert.deepEqual(h.masalahUmum, []);
  assert.deepEqual(h.siswa.map((s) => s.masalah), [[], []]);
  assert.equal(h.siap, 2);
  assert.equal(h.sekolah.tanggal, '19 Desember 2026');
  assert.equal(h.rombel.romawi, 'V');
  assert.equal(h.rombel.fase, 'C');
  const ani = h.siswa[0], budi = h.siswa[1];
  // MTK Ani: lingkup (90+70)/2 = 80, akhir 80 → 80
  assert.equal(ani.mapel.find((m) => m.kode === 'MTK').nilai, 80);
  const seni = ani.mapel.find((m) => m.kode === 'SENI');
  // Musik: (85 + 85)/2 = 85; Rupa: (65 + 65)/2 = 65; gabungan 75
  assert.equal(seni.nilai, 75);
  assert.equal(seni.nama, 'Seni dan Budaya');
  assert.equal(seni.deskripsi.length, 2);
  assert.match(seni.deskripsi[0], /irama satu/);
  assert.match(seni.deskripsi[0], /gambar satu/, 'TP tertinggi tiap seni digabung dalam satu kalimat');
  // TP tertinggi/terendah untuk e-Rapor: kode dan isi TP; seni satu per seni
  const mtk = ani.mapel.find((m) => m.kode === 'MTK');
  assert.deepEqual(JSON.parse(JSON.stringify(mtk.tpTinggi)), [{ kode: 'TP1', tp: 'TP pertama mtk', nilai: 90, seni: '' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(mtk.tpRendah)), [{ kode: 'TP2', tp: 'TP kedua mtk', nilai: 70, seni: '' }]);
  assert.deepEqual(seni.tpTinggi.map((t) => [t.seni, t.tp]), [['Seni Musik', 'TP pertama irama'], ['Seni Rupa', 'TP pertama gambar']]);
  const pabBudi = budi.mapel[0];
  assert.equal(pabBudi.tpTinggi[0].tp, 'TP pertama doa', 'TP agama sesuai agama siswa');
  assert.match(ani.kokurikuler, /^Ananda Ani sudah baik dalam dimensi profil Kolaborasi/);
  assert.deepEqual(ani.ekskul, [{ kegiatan: 'Pramuka', keterangan: 'Baik dalam mengikuti kegiatan Pramuka.' }]);
  assert.equal(ani.kenaikan.tampil, false);
  assert.equal(ani.jumlah, 80 * 8 + 75);
  assert.equal(ani.peringkat, 1);
  assert.equal(budi.peringkat, 2);
  assert.equal(budi.rataRata, Math.round(((70 * 8 + 85) / 9) * 100) / 100);
});

test('rekapRombel: semester 2 menuntut keputusan kenaikan, peringkat hanya untuk yang lengkap', () => {
  const ctx = siapRapor();
  lengkapi(ctx, ['Ani']);
  const h = ctx.g.minta({ aksi: 'rekapRombel', rombel: ctx.rombel });
  assert.equal(h.siap, 1);
  assert.equal(h.siswa[0].peringkat, 1);
  assert.equal(h.siswa[1].peringkat, null);
  assert.equal(h.siswa[1].jumlah, null);
  const s2 = ctx.g.minta({ aksi: 'rekapRombel', rombel: ctx.rombel, semester: 2 });
  assert.match(s2.siswa[0].masalah.join(' '), /Keputusan kenaikan kelas belum diisi/);
  ctx.g.minta({ aksi: 'simpanKenaikan', rombel: ctx.rombel, semester: 2, kenaikan: { [ctx.id.Ani]: 'naik' } });
  const s2b = ctx.g.minta({ aksi: 'rekapRombel', rombel: ctx.rombel, semester: 2 });
  assert.deepEqual(JSON.parse(JSON.stringify(s2b.siswa[0].kenaikan)), { tampil: true, teks: 'Naik ke kelas VI (enam)', peringatan: [] });
});

test('rekapRombel: siswa tanpa agama atau TP varian belum disusun dilaporkan jelas', () => {
  const { g, rombel, id } = siapRapor();
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'PAB', varian: 'Katolik', tp: [] });
  const h = g.minta({ aksi: 'rekapRombel', rombel });
  assert.match(h.siswa.find((s) => s.id === id.Budi).masalah.join(' '), /Pendidikan Agama Katolik dan Budi Pekerti: TP belum disusun/);
  assert.equal(g.minta({ aksi: 'rekapRombel', rombel: 'R-x' }).ok, false);
});
