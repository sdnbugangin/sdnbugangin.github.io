// Uji pindah tahun ajaran: naik/tinggal/lulus, rombel tahun baru, salinan TP/mapel, arsip nilai, cadangan.
// Jalankan dari akar repo: node --test rapor/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { sekolahAktif } = require('./tiruan-gas.js');

function siapTa() {
  const g = sekolahAktif();
  const M = (q) => { const h = g.minta(q); assert.notEqual(h.ok, false, q.aksi + ': ' + h.pesan); return h; };
  const rb = {};
  for (const [kelas, nama, wali] of [[1, '', 'Bu Satu'], [2, '', 'Bu Dua'], [4, 'A', 'Pak 4A'], [4, 'B', 'Bu 4B'], [5, 'A', 'Bu 5A'], [5, 'B', ''], [6, '', 'Pak Enam']]) {
    const r = M({ aksi: 'simpanRombel', rombel: { kelas, nama, wali } }).rombel;
    rb[r.nama] = r.id;
  }
  const isi = { 2: ['DINA'], '4A': ['ANI', 'BUDI'], '4B': ['CICI'], '5A': ['DODI'], '5B': ['EKA'], 6: ['FANI', 'GITA'] };
  const id = {};
  for (const [r, nama] of Object.entries(isi)) {
    M({ aksi: 'simpanSiswa', rombel: rb[r], siswa: nama.map((n) => ({ nama: n, jk: 'P', agama: 'Islam', seni: 'Musik' })) });
    M({ aksi: 'siswaRombel', rombel: rb[r] }).siswa.forEach((s) => { id[s.nama] = s.id; });
  }
  M({ aksi: 'simpanTp', kelas: 4, semester: 1, mapel: 'MTK', varian: '', tp: [{ tp: 'TP MTK 4', materi: 'pecahan' }] });
  M({ aksi: 'simpanNilai', rombel: rb['4A'], mapel: 'MTK', varian: '', nilai: { [id.ANI]: { TP1: '80', TES: '85' } } });
  M({ aksi: 'simpanDimensiKok', rombel: rb['4A'], dimensi: ['Kerjasama'] });
  M({ aksi: 'simpanProfil', profil: {}, semester: 2 });
  const putus = { 2: { DINA: 'naik' }, '4A': { ANI: 'naik', BUDI: 'tinggal' }, '4B': { CICI: 'naik' }, '5A': { DODI: 'naik' }, '5B': { EKA: 'naik' }, 6: { FANI: 'naik', GITA: 'tinggal' } };
  for (const [r, p] of Object.entries(putus)) {
    M({ aksi: 'simpanKenaikan', rombel: rb[r], semester: 2, kenaikan: Object.fromEntries(Object.entries(p).map(([n, v]) => [id[n], v])) });
  }
  return { g, M, rb, id };
}

test('tahunAjaranBerikut_ dan akhiranRombel_', () => {
  const g = sekolahAktif();
  assert.equal(g.ctx.tahunAjaranBerikut_('2026/2027'), '2027/2028');
  assert.equal(g.ctx.tahunAjaranBerikut_('2026-2027'), '');
  assert.equal(g.ctx.akhiranRombel_({ kelas: 5, nama: '5A' }), 'A');
  assert.equal(g.ctx.akhiranRombel_({ kelas: 5, nama: '5' }), '');
  assert.equal(g.ctx.akhiranRombel_({ kelas: 5, nama: 'MELATI' }), null);
});

test('pratinjau: semester 1 dan keputusan yang belum diisi menghalangi', () => {
  const { g, M, rb, id } = siapTa();
  M({ aksi: 'simpanKenaikan', rombel: rb['4A'], semester: 2, kenaikan: { [id.ANI]: 'naik', [id.BUDI]: '' } });
  let p = g.minta({ aksi: 'taBaruPratinjau' });
  assert.equal(p.taBaru, '2027/2028');
  assert.match(p.salah.join(' '), /1 siswa belum punya keputusan .*BUDI \(4A\)/);
  M({ aksi: 'simpanProfil', profil: {}, semester: 1 });
  p = g.minta({ aksi: 'taBaruPratinjau' });
  assert.match(p.salah.join(' '), /hanya bisa dimulai di semester 2/);
  const j = g.minta({ aksi: 'taBaruJalankan', konfirmasi: 'MULAI 2027/2028' });
  assert.equal(j.ok, false);
  assert.equal(g.ctx.aturSekolah_(g.ss).tahunAjaran, '2026/2027', 'tidak ada yang berubah');
});

test('pratinjau lengkap: tujuan rombel, rombel baru untuk kelas yang belum ada, lulus', () => {
  const { g } = siapTa();
  const p = g.minta({ aksi: 'taBaruPratinjau' });
  assert.deepEqual(p.salah, []);
  assert.deepEqual(p.ringkas, { naik: 5, tinggal: 1, lulus: 1, tidakLulus: 1 });
  const per = Object.fromEntries(p.rombel.map((r) => [r.label, [r.naik, r.tinggal, r.wali]]));
  assert.deepEqual(per, {
    'Kelas 1': [0, 0, 'Bu Satu'], 'Kelas 2': [0, 0, 'Bu Dua'], 'Kelas 3': [1, 0, ''],
    '4A': [0, 1, 'Pak 4A'], '4B': [0, 0, 'Bu 4B'], '5A': [1, 0, 'Bu 5A'], '5B': [1, 0, ''], 'Kelas 6': [2, 1, 'Pak Enam'] });
  assert.match(p.peringatan.join(' '), /Rombel Kelas 3 dibuat baru/);
  assert.deepEqual(p.lulus, ['FANI (Kelas 6)']);
  assert.equal(g.ctx.aturSekolah_(g.ss).tahunAjaran, '2026/2027', 'pratinjau tidak mengubah apa pun');
});

test('jalankan: konfirmasi wajib, lalu semua dipindah dengan benar', () => {
  const { g, M, id } = siapTa();
  assert.match(g.minta({ aksi: 'taBaruJalankan', konfirmasi: 'mulai' }).pesan, /Ketik MULAI 2027\/2028/);
  const h = g.minta({ aksi: 'taBaruJalankan', konfirmasi: 'mulai 2027/2028' });
  assert.equal(h.ok, true, h.pesan);
  assert.match(h.pesan, /Tahun ajaran 2027\/2028 semester 1 dimulai\. 5 siswa naik kelas, 1 tinggal kelas, 1 lulus/);
  const d = M({ aksi: 'dataSekolah' });
  assert.equal(d.tahunAjaran, '2027/2028');
  assert.equal(d.semester, 1);
  const rombel = Object.fromEntries(d.rombel.map((r) => [r.nama, r]));
  const nama = (r) => M({ aksi: 'siswaRombel', rombel: rombel[r].id }).siswa.map((s) => s.nama);
  assert.deepEqual(nama('5A'), ['ANI']);
  assert.deepEqual(nama('5B'), ['CICI']);
  assert.deepEqual(nama('4A'), ['BUDI']);
  assert.deepEqual(nama('6'), ['DODI', 'EKA', 'GITA']);
  assert.deepEqual(nama('3'), ['DINA']);
  assert.deepEqual(nama('1'), [], 'kelas 1 kosong untuk siswa baru');
  assert.equal(rombel['5A'].wali, 'Bu 5A', 'wali kelas ikut rombelnya');
  const fani = g.isi('Siswa').find((r) => r[3] === 'FANI');
  assert.equal(fani[13], 'Lulus');
  // TP, mapel, dan subdimensi tersalin; nilai lama diarsipkan
  assert.ok(g.isi('Tujuan Pembelajaran').some((r) => r[0] === '2027/2028' && r[2] === 4 && r[3] === 'MTK'), 'TP tersalin');
  assert.equal(M({ aksi: 'mapelSekolah' }).ok, true);
  assert.equal(g.isi('Nilai').length, 0);
  assert.equal(g.isi('Arsip Nilai').length, 2);
  assert.equal(g.isi('Arsip Nilai')[0][0], '2026/2027');
  assert.ok(g.isi('Kokurikuler').some((r) => r[0] === '2027/2028'));
  // siswa bisa langsung dinilai di tahun baru
  M({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: [{ tp: 'TP MTK 5', materi: 'desimal' }] });
  assert.equal(M({ aksi: 'simpanNilai', rombel: rombel['5A'].id, mapel: 'MTK', varian: '', nilai: { [id.ANI]: { TP1: '90' } } }).ok, true);
  // cadangan ada di folder Cadangan dalam Rapor SD, Drive tetap rapi
  const cad = Object.values(g.berkas).find((b) => /cadangan sebelum 2027-2028/.test(b.ss.getName()));
  assert.ok(cad, 'cadangan dibuat');
  assert.equal(cad.ss.getSheetByName('Pengaturan').data.find((r) => r[0] === 'Tahun Ajaran')[1], '2026/2027', 'cadangan berisi data lama');
  assert.deepEqual(g.isiAkar(), ['📁 Rapor SD']);
  assert.match(g.isi('Log').map((r) => r[1] + ' ' + r[2]).join('\n'), /tahun ajaran baru 2026\/2027 → 2027\/2028/);
  // tidak bisa dijalankan dua kali: tahun baru masih semester 1
  assert.equal(g.minta({ aksi: 'taBaruJalankan', konfirmasi: 'MULAI 2028/2029' }).ok, false);
});

test('jalankan: cadangan gagal → tidak ada yang berubah', () => {
  const { g } = siapTa();
  g.DriveApp.gagalSalin = true;
  const h = g.minta({ aksi: 'taBaruJalankan', konfirmasi: 'MULAI 2027/2028' });
  assert.equal(h.ok, false);
  assert.match(h.pesan, /Cadangan spreadsheet gagal dibuat/);
  assert.equal(g.ctx.aturSekolah_(g.ss).tahunAjaran, '2026/2027');
  assert.equal(g.isi('Nilai').length, 2);
});
