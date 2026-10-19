// Uji kokurikuler: subdimensi per kelas, capaian per siswa, deskripsi dari Master Narasi, dan penolakan isian salah.
// Jalankan dari akar repo: node --test rapor/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { sekolahAktif } = require('./tiruan-gas.js');

/** Sekolah dengan rombel 5A (2 siswa) dan 5B (1 siswa). */
function siapKok() {
  const g = sekolahAktif();
  const a = g.minta({ aksi: 'simpanRombel', rombel: { kelas: 5, nama: 'A' } }).rombel;
  const b = g.minta({ aksi: 'simpanRombel', rombel: { kelas: 5, nama: 'B' } }).rombel;
  g.minta({ aksi: 'simpanSiswa', rombel: a.id, siswa: [
    { nama: 'ANI LESTARI', panggilan: 'Ani', jk: 'P', agama: 'Islam' },
    { nama: 'BUDI SANTOSO', panggilan: 'Budi', jk: 'L', agama: 'Islam' }] });
  g.minta({ aksi: 'simpanSiswa', rombel: b.id, siswa: [{ nama: 'CICI', jk: 'P', agama: 'Islam' }] });
  const siswa = g.minta({ aksi: 'siswaRombel', rombel: a.id }).siswa;
  return { g, a: a.id, b: b.id, id: Object.fromEntries(siswa.map((s) => [s.panggilan, s.id])) };
}

test('cekDimensiKelas_: nama baku, dimensi otomatis, ganda dan asing ditolak', () => {
  const { g } = siapKok();
  const c = JSON.parse(JSON.stringify(g.ctx.cekDimensiKelas_(['kerjasama', ' Menulis ', '', 'Fleksibitas Berpikir'])));
  assert.deepEqual(c.salah, []);
  assert.deepEqual(c.daftar, [
    { dimensi: 'Kolaborasi', subdimensi: 'Kerjasama' },
    { dimensi: 'Komunikasi', subdimensi: 'Menulis' },
    { dimensi: 'Kreativitas', subdimensi: 'Fleksibilitas Berpikir' }]);
  const s = JSON.parse(JSON.stringify(g.ctx.cekDimensiKelas_(['Kerjasama', 'kerjasama', 'Menari'])));
  assert.equal(s.salah.length, 2);
  assert.match(s.salah.join(' '), /lebih dari sekali/);
  assert.match(s.salah.join(' '), /"Menari" tidak dikenal/);
  const banyak = g.ctx.DIMENSI_PROFIL.flatMap((d) => d.sub).slice(0, 9);
  assert.match(g.ctx.cekDimensiKelas_(banyak).salah.join(' '), /Paling banyak 8/);
});

test('levelKok_: nama lengkap dan huruf awal diterima', () => {
  const { g } = siapKok();
  assert.equal(g.ctx.levelKok_('mahir'), 'Mahir');
  assert.equal(g.ctx.levelKok_('C'), 'Cakap');
  assert.equal(g.ctx.levelKok_(' b '), 'Berkembang');
  assert.equal(g.ctx.levelKok_(''), '');
  assert.equal(g.ctx.levelKok_('Baik'), null);
});

test('kokRombel: awal kosong, referensi 8 dimensi, siswa urut', () => {
  const { g, a } = siapKok();
  const h = g.minta({ aksi: 'kokRombel', rombel: a });
  assert.equal(h.ok, true, h.pesan);
  assert.equal(h.semester, 1);
  assert.deepEqual(h.dimensi, []);
  assert.equal(h.referensi.length, 8);
  assert.deepEqual(h.level, ['Mahir', 'Cakap', 'Berkembang']);
  assert.deepEqual(h.siswa.map((s) => s.nama), ['ANI LESTARI', 'BUDI SANTOSO']);
  assert.match(h.hasil[h.siswa[0].id].peringatan.join(' '), /belum diisi/);
  assert.equal(g.minta({ aksi: 'kokRombel', rombel: 'R-tidak-ada' }).ok, false);
});

test('simpanDimensiKok: berlaku untuk semua rombel kelas itu, per semester', () => {
  const { g, a, b } = siapKok();
  const h = g.minta({ aksi: 'simpanDimensiKok', rombel: a, semester: 1, dimensi: ['Kerjasama', 'Menulis'] });
  assert.equal(h.ok, true, h.pesan);
  assert.equal(h.pesan, '2 subdimensi kelas 5 semester 1 tersimpan.');
  assert.deepEqual(h.dimensi.map((d) => d.dimensi), ['Kolaborasi', 'Komunikasi']);
  assert.equal(h.narasi.Kerjasama.Cakap.teks, h.narasi.Kerjasama.Cakap.bawaan);
  assert.deepEqual(g.minta({ aksi: 'kokRombel', rombel: b, semester: 1 }).dimensi.map((d) => d.subdimensi), ['Kerjasama', 'Menulis']);
  assert.deepEqual(g.minta({ aksi: 'kokRombel', rombel: a, semester: 2 }).dimensi, []);
  assert.deepEqual(g.isi('Kokurikuler').map((r) => r.slice(1)), [[1, 5, 1, 'Kolaborasi', 'Kerjasama'], [1, 5, 2, 'Komunikasi', 'Menulis']]);
  assert.equal(g.minta({ aksi: 'simpanDimensiKok', rombel: a, dimensi: ['Menari'] }).ok, false);
});

test('simpanKok: deskripsi dari narasi, tertinggi dan terendah, lengkap/belum', () => {
  const { g, a, id } = siapKok();
  g.minta({ aksi: 'simpanDimensiKok', rombel: a, dimensi: ['Kerjasama', 'Menulis'] });
  const h = g.minta({ aksi: 'simpanKok', rombel: a, capaian: {
    [id.Ani]: { Kerjasama: 'Mahir', Menulis: 'b' },
    [id.Budi]: { Kerjasama: 'C', Menulis: '' }
  } });
  assert.equal(h.ok, true, h.pesan);
  assert.equal(h.pesan, 'Capaian kokurikuler 5A tersimpan. 1 siswa belum lengkap.');
  const ani = h.hasil[id.Ani];
  assert.equal(ani.lengkap, true);
  assert.match(ani.teks, /^Ananda Ani sudah baik dalam dimensi profil Kolaborasi, salah satunya mampu /);
  assert.match(ani.teks, /, dan masih perlu bimbingan dalam dimensi profil Komunikasi agar dapat .+\.$/);
  assert.equal(h.hasil[id.Budi].lengkap, false);
  assert.match(h.hasil[id.Budi].peringatan.join(' '), /1 subdimensi belum diisi/);
  assert.equal(h.capaian[id.Ani].Menulis, 'Berkembang');
  assert.equal(g.isi('Capaian Kokurikuler').length, 3);
  // dimuat ulang sama; subdimensi yang sudah berisi tidak bisa dihapus
  assert.deepEqual(g.minta({ aksi: 'kokRombel', rombel: a }).capaian, h.capaian);
  const hapus = g.minta({ aksi: 'simpanDimensiKok', rombel: a, dimensi: ['Menulis'] });
  assert.equal(hapus.ok, false);
  assert.match(hapus.pesan, /"Kerjasama" sudah punya capaian 2 siswa/);
  // urutan boleh diubah dan subdimensi baru boleh ditambah tanpa menggeser capaian
  const urut = g.minta({ aksi: 'simpanDimensiKok', rombel: a, dimensi: ['Menulis', 'Peduli', 'Kerjasama'] });
  assert.equal(urut.ok, true, urut.pesan);
  assert.equal(urut.capaian[id.Ani].Kerjasama, 'Mahir');
  assert.equal(urut.hasil[id.Ani].lengkap, false);
});

test('simpanKok: isian salah ditolak semuanya, kosong menghapus', () => {
  const { g, a, id } = siapKok();
  assert.equal(g.minta({ aksi: 'simpanKok', rombel: a, capaian: {} }).pesan, 'Pilih dulu subdimensi yang dinilai di kelas ini.');
  g.minta({ aksi: 'simpanDimensiKok', rombel: a, dimensi: ['Kerjasama'] });
  g.minta({ aksi: 'simpanKok', rombel: a, capaian: { [id.Ani]: { Kerjasama: 'Mahir' } } });
  const s = g.minta({ aksi: 'simpanKok', rombel: a, capaian: { [id.Ani]: { Kerjasama: 'Baik' }, [id.Budi]: { Kerjasama: 'Mahir' } } });
  assert.equal(s.ok, false);
  assert.match(s.pesan, /1\. ANI LESTARI — Kerjasama: isi Mahir, Cakap, atau Berkembang/);
  assert.equal(g.isi('Capaian Kokurikuler').length, 1, 'tidak ada yang tersimpan');
  assert.equal(g.minta({ aksi: 'simpanKok', rombel: a, capaian: { 'S-asing': {} } }).ok, false);
  const k = g.minta({ aksi: 'simpanKok', rombel: a, capaian: { [id.Ani]: { Kerjasama: '' } } });
  assert.equal(k.ok, true);
  assert.equal(g.isi('Capaian Kokurikuler').length, 0);
});

test('simpanKok: rombel lain dan semester lain tidak tersentuh', () => {
  const { g, a, b, id } = siapKok();
  g.minta({ aksi: 'simpanDimensiKok', rombel: a, semester: 1, dimensi: ['Kerjasama'] });
  g.minta({ aksi: 'simpanDimensiKok', rombel: a, semester: 2, dimensi: ['Kerjasama'] });
  const cici = g.minta({ aksi: 'kokRombel', rombel: b }).siswa[0].id;
  g.minta({ aksi: 'simpanKok', rombel: b, capaian: { [cici]: { Kerjasama: 'Cakap' } } });
  g.minta({ aksi: 'simpanKok', rombel: a, semester: 2, capaian: { [id.Ani]: { Kerjasama: 'Mahir' } } });
  g.minta({ aksi: 'simpanKok', rombel: a, semester: 1, capaian: { [id.Ani]: { Kerjasama: 'Berkembang' } } });
  g.minta({ aksi: 'simpanKok', rombel: a, semester: 1, capaian: {} });
  assert.deepEqual(g.isi('Capaian Kokurikuler').map((r) => [r[1], r[4]]).sort(), [[1, 'Cakap'], [2, 'Mahir']]);
});

test('simpanNarasi: mengubah narasi sekolah, kosong kembali ke bawaan, tanpa panggilan bila diatur', () => {
  const { g, a, id } = siapKok();
  g.minta({ aksi: 'simpanDimensiKok', rombel: a, dimensi: ['Kerjasama'] });
  const n = g.minta({ aksi: 'simpanNarasi', narasi: [{ subdimensi: 'kerjasama', level: 'Mahir', narasi: 'Bekerja sama dengan sangat baik.' }] });
  assert.equal(n.ok, true, n.pesan);
  const h = g.minta({ aksi: 'simpanKok', rombel: a, capaian: { [id.Ani]: { Kerjasama: 'Mahir' } } });
  assert.equal(h.hasil[id.Ani].teks, 'Ananda Ani sudah baik dalam dimensi profil Kolaborasi, salah satunya mampu bekerja sama dengan sangat baik.');
  assert.equal(h.narasi.Kerjasama.Mahir.teks, 'bekerja sama dengan sangat baik');
  assert.equal(g.isi('Master Narasi').length, 75, 'baris diganti, tidak bertambah');
  g.minta({ aksi: 'simpanNarasi', narasi: [{ subdimensi: 'Kerjasama', level: 'Mahir', narasi: '' }] });
  const k = g.minta({ aksi: 'kokRombel', rombel: a });
  assert.equal(k.narasi.Kerjasama.Mahir.teks, k.narasi.Kerjasama.Mahir.bawaan);
  assert.equal(g.minta({ aksi: 'simpanNarasi', narasi: [{ subdimensi: 'Menari', level: 'Mahir', narasi: 'x' }] }).ok, false);
  assert.match(g.minta({ aksi: 'simpanNarasi', narasi: [{ subdimensi: 'Peduli', level: 'Cakap', narasi: 'x'.repeat(301) }] }).pesan, /terlalu panjang/);
  // tanpa nama panggilan
  const atur = g.ss.getSheetByName('Pengaturan').data;
  atur.find((r) => r[0] === 'Pakai Nama Panggilan')[1] = 'Tidak';
  assert.match(g.minta({ aksi: 'kokRombel', rombel: a }).hasil[id.Ani].teks, /^Ananda sudah baik/);
});

test('narasi lama berejaan "Fleksibitas" tetap terbaca', () => {
  const { g, a, id } = siapKok();
  g.ss.getSheetByName('Master Narasi').data.push(['Fleksibitas Berpikir', 'Cakap', 'narasi lama sekolah']);
  g.minta({ aksi: 'simpanDimensiKok', rombel: a, dimensi: ['Fleksibilitas Berpikir'] });
  const h = g.minta({ aksi: 'simpanKok', rombel: a, capaian: { [id.Ani]: { 'Fleksibilitas Berpikir': 'Cakap' } } });
  assert.match(h.hasil[id.Ani].teks, /mampu narasi lama sekolah\.$/);
  assert.deepEqual(h.hasil[id.Ani].peringatan, []);
});
