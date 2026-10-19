// Uji kunci rapor: semua jalur ubah ditolak saat terkunci, bisa dibuka dengan alasan, dan tercatat di log.
// Jalankan dari akar repo: node --test rapor/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { sekolahAktif } = require('./tiruan-gas.js');

function siapKunci() {
  const g = sekolahAktif();
  const a = g.minta({ aksi: 'simpanRombel', rombel: { kelas: 5, nama: 'A' } }).rombel;
  const b = g.minta({ aksi: 'simpanRombel', rombel: { kelas: 5, nama: 'B' } }).rombel;
  g.minta({ aksi: 'simpanSiswa', rombel: a.id, siswa: [{ nama: 'ANI', panggilan: 'Ani', jk: 'P', agama: 'Islam', seni: 'Musik' }] });
  g.minta({ aksi: 'simpanSiswa', rombel: b.id, siswa: [{ nama: 'BUDI', jk: 'L', agama: 'Islam', seni: 'Musik' }] });
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: [{ tp: 'TP satu', materi: 'satu' }] });
  g.minta({ aksi: 'simpanDimensiKok', rombel: a.id, dimensi: ['Kerjasama'] });
  g.minta({ aksi: 'simpanEkskulSekolah', daftar: ['Pramuka'] });
  const ani = g.minta({ aksi: 'siswaRombel', rombel: a.id }).siswa[0].id;
  const budi = g.minta({ aksi: 'siswaRombel', rombel: b.id }).siswa[0].id;
  return { g, a: a.id, b: b.id, ani, budi };
}

test('kunci: semua jalur ubah rombel itu ditolak dengan pesan jelas', () => {
  const { g, a, ani } = siapKunci();
  const k = g.minta({ aksi: 'kunciRapor', rombel: a, semester: 1 });
  assert.equal(k.ok, true, k.pesan);
  assert.ok(k.terkunci.waktu);
  assert.equal(g.minta({ aksi: 'kunciRapor', rombel: a, semester: 1 }).ok, false, 'tidak bisa dikunci dua kali');
  const tolak = (req, pola) => {
    const h = g.minta(req);
    assert.equal(h.ok, false, req.aksi + ' seharusnya ditolak');
    assert.match(h.pesan, pola || /sudah dikunci/, req.aksi);
  };
  tolak({ aksi: 'simpanNilai', rombel: a, mapel: 'MTK', varian: '', nilai: { [ani]: { TP1: '80' } } });
  tolak({ aksi: 'simpanKok', rombel: a, capaian: { [ani]: { Kerjasama: 'Cakap' } } });
  tolak({ aksi: 'simpanEkskul', rombel: a, ekskul: { [ani]: [{ kegiatan: 'Pramuka', predikat: 'Baik' }] } });
  tolak({ aksi: 'simpanPresensi', rombel: a, presensi: { [ani]: { sakit: '1' } } });
  tolak({ aksi: 'simpanSiswa', rombel: a, siswa: [{ nama: 'ANI LESTARI', jk: 'P', agama: 'Islam', seni: 'Musik' }] });
  tolak({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: [{ tp: 'TP diubah', materi: 'satu' }] }, /kelas 5 yang sudah dikunci/);
  tolak({ aksi: 'simpanDimensiKok', rombel: a, dimensi: ['Kerjasama', 'Menulis'] }, /kelas 5 yang sudah dikunci/);
  tolak({ aksi: 'simpanNarasi', narasi: [{ subdimensi: 'Kerjasama', level: 'Cakap', narasi: 'baru' }] }, /dipakai rapor 5A yang sudah dikunci/);
  const mapel = g.minta({ aksi: 'mapelSekolah' }).mapel;
  tolak({ aksi: 'simpanMapel', mapel: mapel.map((m) => (m.kode === 'BING' ? { ...m, kelas: { ...m.kelas, 5: false } } : m)) }, /kelas 5 yang sudah dikunci/);
  // layar menampilkan status terkunci
  assert.ok(g.minta({ aksi: 'nilaiRombel', rombel: a, mapel: 'MTK' }).terkunci);
  assert.ok(g.minta({ aksi: 'kokRombel', rombel: a }).terkunci);
  assert.ok(g.minta({ aksi: 'waliRombel', rombel: a }).terkunci);
  assert.ok(g.minta({ aksi: 'rekapRombel', rombel: a }).terkunci);
});

test('kunci: rombel lain, semester lain, kelas lain, dan narasi lain tetap bisa diubah', () => {
  const { g, a, b, budi } = siapKunci();
  g.minta({ aksi: 'kunciRapor', rombel: a, semester: 1 });
  assert.equal(g.minta({ aksi: 'simpanNilai', rombel: b, mapel: 'MTK', varian: '', nilai: { [budi]: { TP1: '80' } } }).ok, true, 'rombel 5B');
  assert.equal(g.minta({ aksi: 'nilaiRombel', rombel: b, mapel: 'MTK' }).terkunci, null);
  assert.equal(g.minta({ aksi: 'simpanTp', kelas: 5, semester: 2, mapel: 'MTK', varian: '', tp: [{ tp: 'TP smt 2', materi: 'x' }] }).ok, true, 'semester 2');
  assert.equal(g.minta({ aksi: 'simpanTp', kelas: 4, semester: 1, mapel: 'MTK', varian: '', tp: [{ tp: 'TP kls 4', materi: 'x' }] }).ok, true, 'kelas 4');
  assert.equal(g.minta({ aksi: 'simpanNarasi', narasi: [{ subdimensi: 'Menulis', level: 'Cakap', narasi: 'menulis dengan rapi' }] }).ok, true, 'narasi lain');
  assert.equal(g.minta({ aksi: 'simpanKenaikan', rombel: a, semester: 2, kenaikan: {} }).ok, true, 'kenaikan (semester 2 belum dikunci)');
});

test('buka kunci: wajib alasan, tercatat di log, lalu bisa diubah lagi', () => {
  const { g, a, ani } = siapKunci();
  g.minta({ aksi: 'kunciRapor', rombel: a, semester: 1 });
  assert.match(g.minta({ aksi: 'bukaKunciRapor', rombel: a, semester: 1, alasan: '' }).pesan, /alasan/);
  const h = g.minta({ aksi: 'bukaKunciRapor', rombel: a, semester: 1, alasan: 'Salah input nilai MTK Ani' });
  assert.equal(h.ok, true, h.pesan);
  assert.equal(g.minta({ aksi: 'simpanNilai', rombel: a, mapel: 'MTK', varian: '', nilai: { [ani]: { TP1: '80' } } }).ok, true);
  const log = g.isi('Log').map((r) => r[1] + ': ' + r[2]).join('\n');
  assert.match(log, /kunci rapor: 5A smt 1/);
  assert.match(log, /buka kunci rapor: 5A smt 1 — alasan: Salah input nilai MTK Ani/);
  assert.equal(g.minta({ aksi: 'bukaKunciRapor', rombel: a, semester: 1, alasan: 'lagi lagi' }).ok, false);
  // kunci semester 2 menahan keputusan kenaikan
  g.minta({ aksi: 'kunciRapor', rombel: a, semester: 2 });
  assert.match(g.minta({ aksi: 'simpanKenaikan', rombel: a, semester: 2, kenaikan: { [ani]: 'naik' } }).pesan, /semester 2 sudah dikunci/);
});
