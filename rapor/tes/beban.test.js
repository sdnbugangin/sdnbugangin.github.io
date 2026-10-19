// Uji penulisan hemat: tulisTabel_ hanya menulis baris yang berubah, tetapi hasil akhirnya selalu sama
// dengan menulis ulang seluruh tabel. Juga batas biaya simpan nilai di sekolah besar.
// Jalankan dari akar repo: node --test rapor/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { sekolahAktif, BEBAN } = require('./tiruan-gas.js');

test('tulisTabel_: hasil acak selalu sama dengan isi yang diminta', () => {
  const g = sekolahAktif();
  const sh = g.ss.getSheetByName('Kenaikan');
  let acak = 7;
  const rnd = (n) => { acak = (acak * 1103515245 + 12345) % 2147483648; return acak % n; };
  let isi = [];
  for (let putaran = 0; putaran < 300; putaran++) {
    g.ctx.ISI_SHEET_ = {};
    if (rnd(2)) g.ctx.bacaTabel_(g.ss, 'Kenaikan'); // kadang dibaca dulu, kadang tidak
    const op = rnd(4);
    if (op === 0) isi.push({ 'Tahun Ajaran': '2026/2027', 'ID Siswa': 'S' + rnd(50), Keputusan: rnd(2) ? 'Naik' : 'Tinggal' });
    else if (op === 1 && isi.length) isi.splice(rnd(isi.length), 1);
    else if (op === 2 && isi.length) isi[rnd(isi.length)].Keputusan = rnd(2) ? 'Naik' : 'Tinggal';
    else isi = isi.slice(0, rnd(isi.length + 1));
    g.ctx.tulisTabel_(g.ss, 'Kenaikan', isi.map((o) => ({ ...o })));
    const nyata = sh.data.slice(1, sh.getLastRow()).map((r) => r.slice(0, 3));
    assert.deepEqual(nyata, isi.map((o) => [o['Tahun Ajaran'], o['ID Siswa'], o.Keputusan]), 'putaran ' + putaran);
  }
});

test('gantiDiTempat_: baris lain tidak bergeser, yang hilang dihapus, yang baru di akhir', () => {
  const g = sekolahAktif();
  const r = (id, v) => ({ id, v });
  const hasil = g.ctx.gantiDiTempat_([r('a', 1), r('x', 1), r('b', 1), r('y', 1), r('c', 1)],
    (o) => o.id.length === 1 && 'abc'.includes(o.id), (o) => o.id, [r('c', 3), r('a', 2), r('d', 4)]);
  assert.deepEqual(JSON.parse(JSON.stringify(hasil)), [r('a', 2), r('x', 1), r('y', 1), r('c', 3), r('d', 4)]);
});

test('simpan nilai di sekolah yang sudah penuh hanya menulis baris layar itu', () => {
  const g = sekolahAktif();
  const M = (q) => { const h = g.minta(q); assert.notEqual(h.ok, false, q.aksi + ': ' + h.pesan); return h; };
  const rombel = [];
  for (const n of ['A', 'B']) {
    const rb = M({ aksi: 'simpanRombel', rombel: { kelas: 5, nama: n } }).rombel;
    M({ aksi: 'simpanSiswa', rombel: rb.id, siswa: Array.from({ length: 32 }, (_, i) => ({ nama: 'SISWA ' + n + i, jk: 'L', agama: 'Islam', seni: 'Musik' })) });
    rombel.push(rb.id);
  }
  ['MTK', 'BIND', 'PP', 'IPAS'].forEach((m) => M({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: m, varian: '', tp: [1, 2, 3, 4].map((x) => ({ tp: 'TP ' + x, materi: 'm' + x })) }));
  const isi = (rb, m, dasar) => {
    const l = M({ aksi: 'nilaiRombel', rombel: rb, mapel: m });
    const nilai = {}; l.siswa.forEach((s, i) => { nilai[s.id] = { TES: String(dasar) }; l.tp.forEach((t) => { nilai[s.id][t.kode] = String(dasar + (i % 10)); }); });
    return nilai;
  };
  rombel.forEach((rb) => ['MTK', 'BIND', 'PP', 'IPAS'].forEach((m) => M({ aksi: 'simpanNilai', rombel: rb, mapel: m, varian: '', nilai: isi(rb, m, 70) })));
  assert.equal(g.isi('Nilai').length, 2 * 4 * 32 * 5);
  const sebelum = JSON.stringify(g.isi('Nilai'));
  // ubah satu angka di tengah sheet
  const nilai = isi(rombel[0], 'BIND', 70);
  const id0 = Object.keys(nilai)[3];
  nilai[id0].TES = '99';
  const a = BEBAN.tulis;
  M({ aksi: 'simpanNilai', rombel: rombel[0], mapel: 'BIND', varian: '', nilai });
  assert.ok(BEBAN.tulis - a <= 8, 'hanya 1 baris (8 sel) ditulis, bukan ' + (BEBAN.tulis - a));
  const sesudah = g.isi('Nilai');
  assert.equal(sesudah.length, 2 * 4 * 32 * 5);
  assert.equal(sesudah.filter((r, i) => JSON.stringify(r) !== JSON.stringify(JSON.parse(sebelum)[i])).length, 1, 'hanya satu baris yang berubah');
  // ganti semua angka satu layar: hanya layar itu (32 x 5 baris) yang ditulis
  const b = BEBAN.tulis;
  M({ aksi: 'simpanNilai', rombel: rombel[1], mapel: 'PP', varian: '', nilai: isi(rombel[1], 'PP', 60) });
  assert.ok(BEBAN.tulis - b <= 32 * 5 * 8, 'satu layar saja: ' + (BEBAN.tulis - b) + ' sel');
  // mengosongkan satu siswa menghapus barisnya; data lain tetap utuh
  const kosong = isi(rombel[1], 'PP', 60);
  kosong[Object.keys(kosong)[0]] = {};
  M({ aksi: 'simpanNilai', rombel: rombel[1], mapel: 'PP', varian: '', nilai: kosong });
  assert.equal(g.isi('Nilai').length, 2 * 4 * 32 * 5 - 5);
  const h = M({ aksi: 'nilaiRombel', rombel: rombel[0], mapel: 'BIND' });
  assert.equal(h.nilai[id0].TES, 99);
});

test('ujiBeban: berjalan sampai selesai lalu membersihkan sekolah uji', () => {
  const g = sekolahAktif();
  const sebelum = g.pusat.getSheetByName('Sekolah').data.filter((r) => r[0]).length;
  const hasil = g.ctx.ujiBeban();
  assert.match(hasil, /SELESAI: semua operasi berhasil/);
  assert.match(hasil, /isi \d+ TP dan \d+ nilai \(1 tahun\)/);
  assert.match(hasil, /simpan nilai MTK 5A \(1 angka berubah\): [\d.]+ dtk/);
  assert.equal(g.pusat.getSheetByName('Sekolah').data.filter((r) => r[0]).length, sebelum, 'baris sekolah uji dihapus');
  const id = Object.keys(g.berkas).find((k) => g.berkas[k].ss.getName().includes('SEKOLAH UJI BEBAN'));
  assert.equal(g.berkas[id].sampah, true, 'spreadsheet uji dibuang ke sampah');
  assert.ok(g.pusat.getSheetByName('Log').data.some((r) => r[2] === 'uji beban' && /SELESAI/.test(r[3])), 'hasil tercatat di Log Pusat');
  console.log(g.Logger.isi.join('\n'));
});
