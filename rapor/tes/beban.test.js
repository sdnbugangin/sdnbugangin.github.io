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

/** Kelas 5A, 3 siswa, TP MTK, nilai tersimpan. */
function siapKecil() {
  const g = sekolahAktif();
  const rb = g.minta({ aksi: 'simpanRombel', rombel: { kelas: 5, nama: 'A' } }).rombel.id;
  g.minta({ aksi: 'simpanSiswa', rombel: rb, siswa: ['A', 'B', 'C'].map((n) => ({ nama: 'SISWA ' + n, jk: 'L', agama: 'Islam', seni: 'Musik' })) });
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: [{ tp: 'satu', materi: 'satu' }, { tp: 'dua', materi: 'dua' }] });
  const id = g.minta({ aksi: 'siswaRombel', rombel: rb }).siswa.map((s) => s.id);
  const nilai = Object.fromEntries(id.map((x, i) => [x, { TP1: String(70 + i), TP2: String(80 + i), TES: String(75 + i) }]));
  g.minta({ aksi: 'simpanNilai', rombel: rb, mapel: 'MTK', varian: '', nilai });
  return { g, rb, id, nilai };
}

test('baca sekaligus: satu panggilan Sheets API, sheet yang sama tidak dibaca dua kali', () => {
  const { g, rb } = siapKecil();
  const a = g.Sheets.dipanggil, b = BEBAN.panggilBaca;
  const h = g.minta({ aksi: 'nilaiRombel', rombel: rb, mapel: 'MTK' });
  assert.equal(h.ok, true);
  assert.equal(g.Sheets.dipanggil - a, 1, 'satu panggilan batchGet');
  // selain batchGet hanya 1 baca: pemeriksaan sesi di Pusat (status akun dan sandi terbaru), sengaja tidak di-cache
  assert.equal(BEBAN.panggilBaca - b - 1, 1, 'tidak ada baca sheet sekolah satu per satu');
});

test('baca sekaligus: tanggal "Diubah Pada" baris yang ikut ditulis ulang tidak bergeser', () => {
  const { g, rb, id, nilai } = siapKecil();
  const sh = g.ss.getSheetByName('Nilai');
  const sebelum = sh.data.slice(1).map((r) => r[7] instanceof Date ? r[7].getTime() : r[7]);
  g.jam.sekarang += 3600000;
  // ubah baris pertama dan terakhir saja: baris di antaranya ikut ditulis ulang dari isi yang dibaca lewat API
  nilai[id[0]].TP1 = '99'; nilai[id[2]].TES = '99';
  assert.equal(g.minta({ aksi: 'simpanNilai', rombel: rb, mapel: 'MTK', varian: '', nilai }).ok, true);
  const sesudah = sh.data.slice(1).map((r) => r[7] instanceof Date ? r[7].getTime() : r[7]);
  const berubah = sesudah.map((t, i) => t !== sebelum[i]).filter(Boolean).length;
  assert.equal(berubah, 2, 'hanya dua baris yang stempel waktunya baru');
  assert.ok(sh.data.slice(1).every((r) => r[7] instanceof Date), 'tetap berupa tanggal, bukan angka seri');
});

test('baca sekaligus gagal atau tidak aktif: tetap berjalan dengan cara biasa', () => {
  const { g, rb, id, nilai } = siapKecil();
  g.Sheets.gagal = true;
  nilai[id[1]].TP2 = '55';
  assert.equal(g.minta({ aksi: 'simpanNilai', rombel: rb, mapel: 'MTK', varian: '', nilai }).ok, true, 'kuota habis');
  g.Sheets.gagal = false;
  const simpan = g.ctx.Sheets;
  g.ctx.Sheets = undefined;
  const h = g.minta({ aksi: 'nilaiRombel', rombel: rb, mapel: 'MTK' });
  g.ctx.Sheets = simpan;
  assert.equal(h.nilai[id[1]].TP2, 55, 'tanpa layanan Sheets');
});

test('kunci per sekolah: sekolah lain tidak menunggu, sekolah yang sama menunggu lalu diberi pesan jelas', () => {
  const { g, rb, id, nilai } = siapKecil();
  const npsnLain = '20321654';
  const lain = sekolahAktif({ npsn: npsnLain, nama: 'SD LAIN', email: 'sdlain@gmail.com', sandi: 'rapor2026', ulangi: 'rapor2026', setuju: true }, g);
  const rbLain = lain.minta({ aksi: 'simpanRombel', rombel: { kelas: 1, nama: '' } });
  // sekolah pertama "sedang menyimpan" dari perangkat lain
  g.cache.set('kunci:20321653', { isi: 'perangkat-lain', sampai: g.jam.sekarang + 60000 });
  assert.equal(rbLain.ok, true);
  assert.equal(lain.minta({ aksi: 'simpanRombel', rombel: { kelas: 2, nama: '' } }).ok, true, 'sekolah lain tetap bisa menyimpan');
  const t = g.jam.sekarang;
  const h = g.minta({ aksi: 'simpanNilai', rombel: rb, mapel: 'MTK', varian: '', nilai });
  assert.equal(h.ok, false);
  assert.match(h.pesan, /sedang disimpan dari perangkat lain/);
  assert.ok(g.jam.sekarang - t >= 20000, 'menunggu ±20 dtk sebelum menyerah');
  // setelah kunci lepas sendiri (60 dtk), bisa menyimpan; kunci dilepas lagi sesudahnya
  g.jam.sekarang += 60000;
  assert.equal(g.minta({ aksi: 'simpanNilai', rombel: rb, mapel: 'MTK', varian: '', nilai }).ok, true);
  assert.equal(g.cache.has('kunci:20321653'), false, 'kunci dilepas setelah selesai');
  assert.equal(id.length, 3);
});

test('baca sekaligus: layanan dengan ID lain tetap ditemukan; tanpa layanan memakai REST; REST ditolak diingat 1 jam', () => {
  const { g, rb } = siapKecil();
  const simpan = g.ctx.Sheets;
  // ID lain
  g.ctx.SheetsKu = simpan; g.ctx.Sheets = undefined;
  assert.equal(g.minta({ aksi: 'nilaiRombel', rombel: rb, mapel: 'MTK' }).ok, true);
  assert.equal(g.ctx.CARA_BACA_SEKALIGUS_, 'layanan Sheets (ID: SheetsKu)');
  delete g.ctx.SheetsKu;
  // tanpa layanan → REST
  const r0 = g.rest.dipanggil;
  assert.equal(g.minta({ aksi: 'nilaiRombel', rombel: rb, mapel: 'MTK' }).ok, true);
  assert.equal(g.rest.dipanggil - r0, 1);
  assert.equal(g.ctx.CARA_BACA_SEKALIGUS_, 'Sheets API lewat UrlFetch');
  // REST ditolak → cara biasa, alasan tercatat, tidak dicoba lagi selama 1 jam
  g.rest.kode = 403;
  const h = g.minta({ aksi: 'nilaiRombel', rombel: rb, mapel: 'MTK' });
  assert.equal(h.ok, true, 'tetap berhasil dengan cara biasa');
  assert.match(g.ctx.GALAT_BACA_SEKALIGUS_, /HTTP 403 .*disabled/);
  const r1 = g.rest.dipanggil;
  assert.equal(g.minta({ aksi: 'nilaiRombel', rombel: rb, mapel: 'MTK' }).ok, true);
  assert.equal(g.rest.dipanggil, r1, 'tidak mencoba REST lagi');
  g.jam.sekarang += 3600 * 1000 + 1; g.rest.kode = 200;
  g.minta({ aksi: 'nilaiRombel', rombel: rb, mapel: 'MTK' });
  assert.equal(g.rest.dipanggil, r1 + 1, 'dicoba lagi setelah 1 jam');
  g.ctx.Sheets = simpan;
});
