// Uji isian wali kelas: daftar ekstrakurikuler sekolah, ekstrakurikuler siswa, ketidakhadiran & catatan, kenaikan.
// Jalankan dari akar repo: node --test rapor/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { sekolahAktif } = require('./tiruan-gas.js');

function siapWali(kelas = 5) {
  const g = sekolahAktif();
  const r = g.minta({ aksi: 'simpanRombel', rombel: { kelas, nama: '' } }).rombel;
  g.minta({ aksi: 'simpanSiswa', rombel: r.id, siswa: [
    { nama: 'ANI LESTARI', panggilan: 'Ani', jk: 'P', agama: 'Islam' },
    { nama: 'BUDI SANTOSO', panggilan: 'Budi', jk: 'L', agama: 'Islam' }] });
  const siswa = g.minta({ aksi: 'siswaRombel', rombel: r.id }).siswa;
  return { g, rombel: r.id, id: Object.fromEntries(siswa.map((s) => [s.panggilan, s.id])) };
}

test('aturan dasar: predikat, hari, keputusan, daftar kegiatan', () => {
  const { g } = siapWali();
  const c = g.ctx;
  assert.equal(c.predikatEkskul_('sangat baik'), 'Sangat Baik');
  assert.equal(c.predikatEkskul_('SB'), 'Sangat Baik');
  assert.equal(c.predikatEkskul_('b'), 'Baik');
  assert.equal(c.predikatEkskul_('Bagus'), null);
  assert.equal(c.keteranganEkskul_('Pramuka', 'Sangat Baik'), 'Sangat baik dalam mengikuti kegiatan Pramuka.');
  assert.equal(c.jumlahHari_(''), '');
  assert.equal(c.jumlahHari_('0'), 0);
  assert.equal(c.jumlahHari_(' 7 '), 7);
  assert.equal(c.jumlahHari_('2,5'), null);
  assert.equal(c.jumlahHari_('-1'), null);
  assert.equal(c.jumlahHari_('201'), null);
  assert.equal(c.keputusanNaik_('Lulus'), 'naik');
  assert.equal(c.keputusanNaik_('Tidak Lulus'), 'tinggal');
  assert.equal(c.keputusanNaik_('mungkin'), null);
  const d = JSON.parse(JSON.stringify(c.cekDaftarEkskul_([' Pramuka ', 'pramuka', '', 'Tari; Musik'])));
  assert.deepEqual(d.daftar, ['Pramuka']);
  assert.equal(d.salah.length, 2);
});

test('daftar ekstrakurikuler sekolah: disimpan, kegiatan yang dipakai tidak bisa dihapus', () => {
  const { g, rombel, id } = siapWali();
  assert.deepEqual(g.minta({ aksi: 'waliRombel', rombel }).ekskulSekolah, []);
  const s = g.minta({ aksi: 'simpanEkskulSekolah', daftar: ['Pramuka', 'Drum Band', 'Tilawah'] });
  assert.equal(s.ok, true, s.pesan);
  assert.deepEqual(g.minta({ aksi: 'waliRombel', rombel }).ekskulSekolah, ['Pramuka', 'Drum Band', 'Tilawah']);
  assert.equal(g.isi('Pengaturan').filter((r) => r[0] === 'Ekstrakurikuler Ditawarkan').length, 1);
  g.minta({ aksi: 'simpanEkskul', rombel, ekskul: { [id.Ani]: [{ kegiatan: 'Pramuka', predikat: 'Baik' }] } });
  const h = g.minta({ aksi: 'simpanEkskulSekolah', daftar: ['Drum Band'] });
  assert.equal(h.ok, false);
  assert.match(h.pesan, /Pramuka sudah diisi untuk 1 data siswa/);
  assert.equal(g.minta({ aksi: 'simpanEkskulSekolah', daftar: ['pramuka', 'Drum Band'] }).ok, true, 'beda huruf besar/kecil tetap kegiatan yang sama');
});

test('simpanEkskul: keterangan otomatis dari predikat, keterangan sendiri dipertahankan', () => {
  const { g, rombel, id } = siapWali();
  g.minta({ aksi: 'simpanEkskulSekolah', daftar: ['Pramuka', 'Drum Band'] });
  const h = g.minta({ aksi: 'simpanEkskul', rombel, ekskul: {
    [id.Ani]: [{ kegiatan: 'pramuka', predikat: 'SB', keterangan: '' }, { kegiatan: 'Drum Band', predikat: '', keterangan: 'Aktif sebagai mayoret.' }, { kegiatan: '' }],
    [id.Budi]: [] } });
  assert.equal(h.ok, true, h.pesan);
  assert.equal(h.pesan, 'Ekstrakurikuler Kelas 5 tersimpan. 1 siswa belum punya ekstrakurikuler.');
  assert.deepEqual(h.ekskul[id.Ani].map((e) => [e.kegiatan, e.predikat, e.keterangan, e.otomatis]), [
    ['Pramuka', 'Sangat Baik', '', 'Sangat baik dalam mengikuti kegiatan Pramuka.'],
    ['Drum Band', '', 'Aktif sebagai mayoret.', '']]);
  assert.match(h.cek[id.Budi].peringatan.join(' '), /Ekstrakurikuler belum diisi/);
  assert.equal(g.isi('Ekstrakurikuler').length, 2);
});

test('simpanEkskul: tanpa batas per siswa selain daftar sekolah; daftar sekolah sampai 50', () => {
  const { g, rombel, id } = siapWali();
  const daftar = Array.from({ length: 13 }, (_, i) => 'Kegiatan ' + (i + 1));
  assert.equal(g.minta({ aksi: 'simpanEkskulSekolah', daftar }).ok, true);
  const h = g.minta({ aksi: 'simpanEkskul', rombel, ekskul: { [id.Ani]: daftar.map((k) => ({ kegiatan: k, predikat: 'Baik' })) } });
  assert.equal(h.ok, true, h.pesan);
  assert.equal(h.ekskul[id.Ani].length, 13, 'siswa boleh mengikuti 13 kegiatan');
  const banyak = Array.from({ length: 51 }, (_, i) => 'K' + i);
  assert.match(g.minta({ aksi: 'simpanEkskulSekolah', daftar: banyak }).pesan, /Paling banyak 50/);
});

test('simpanEkskul: isian salah ditolak semuanya', () => {
  const { g, rombel, id } = siapWali();
  g.minta({ aksi: 'simpanEkskulSekolah', daftar: ['Pramuka'] });
  const salah = (e) => g.minta({ aksi: 'simpanEkskul', rombel, ekskul: { [id.Ani]: e } });
  assert.match(salah([{ kegiatan: 'Futsal', predikat: 'Baik' }]).pesan, /"Futsal" tidak ada di daftar/);
  assert.match(salah([{ kegiatan: 'Pramuka', predikat: 'Baik' }, { kegiatan: 'PRAMUKA', predikat: 'Baik' }]).pesan, /lebih dari sekali/);
  assert.match(salah([{ kegiatan: 'Pramuka', predikat: 'Bagus' }]).pesan, /predikat harus/);
  assert.match(salah([{ kegiatan: 'Pramuka' }]).pesan, /isi predikat atau keterangan/);
  assert.equal(g.minta({ aksi: 'simpanEkskul', rombel, ekskul: { 'S-asing': [] } }).ok, false);
  assert.equal(g.isi('Ekstrakurikuler').length, 0);
});

test('simpanPresensi: angka hari dan catatan, tanggapan orang tua tidak tersentuh, semester terpisah', () => {
  const { g, rombel, id } = siapWali();
  const h = g.minta({ aksi: 'simpanPresensi', rombel, semester: 1, presensi: {
    [id.Ani]: { sakit: '2', izin: '0', alpa: '', catatan: 'Pertahankan semangat belajarmu.' },
    [id.Budi]: { sakit: '', izin: '', alpa: '', catatan: '' } } });
  assert.equal(h.ok, true, h.pesan);
  assert.deepEqual(h.presensi[id.Ani], { sakit: 2, izin: 0, alpa: '', catatan: 'Pertahankan semangat belajarmu.' });
  assert.match(h.cek[id.Ani].peringatan.join(' '), /Ketidakhadiran belum lengkap/);
  assert.equal(g.isi('Presensi & Catatan').length, 1, 'siswa tanpa isian tidak dibuatkan baris');
  // tanggapan orang tua diisi langsung di spreadsheet → tetap ada setelah simpan ulang
  g.ss.getSheetByName('Presensi & Catatan').data[1][7] = 'Terima kasih.';
  g.minta({ aksi: 'simpanPresensi', rombel, semester: 1, presensi: { [id.Ani]: { sakit: '3', izin: '0', alpa: '0', catatan: 'Baik.' } } });
  assert.deepEqual(g.isi('Presensi & Catatan').map((r) => r.slice(3)), [[3, 0, 0, 'Baik.', 'Terima kasih.']]);
  g.minta({ aksi: 'simpanPresensi', rombel, semester: 2, presensi: { [id.Ani]: { sakit: '1', izin: '1', alpa: '1', catatan: 'x' } } });
  assert.equal(g.isi('Presensi & Catatan').length, 2);
  const s = g.minta({ aksi: 'simpanPresensi', rombel, presensi: { [id.Budi]: { sakit: '2,5' } } });
  assert.equal(s.ok, false);
  assert.match(s.pesan, /2\. BUDI SANTOSO — Sakit: isi bilangan bulat/);
  assert.match(g.minta({ aksi: 'simpanPresensi', rombel, presensi: { [id.Budi]: { catatan: 'x'.repeat(501) } } }).pesan, /terlalu panjang/);
});

test('kenaikan: hanya diminta di semester 2, kelas 6 memakai lulus', () => {
  const { g, rombel, id } = siapWali();
  assert.equal(g.minta({ aksi: 'waliRombel', rombel, semester: 1 }).cek[id.Ani].peringatan.some((p) => /kenaikan/.test(p)), false);
  const h = g.minta({ aksi: 'simpanKenaikan', rombel, semester: 2, kenaikan: { [id.Ani]: 'naik', [id.Budi]: '' } });
  assert.equal(h.ok, true, h.pesan);
  assert.equal(h.cek[id.Ani].kenaikan, 'Naik ke kelas VI (enam)');
  assert.match(h.cek[id.Budi].peringatan.join(' '), /Keputusan kenaikan kelas belum diisi/);
  assert.deepEqual(g.isi('Kenaikan').map((r) => r[2]), ['Naik']);
  assert.equal(g.minta({ aksi: 'simpanKenaikan', rombel, kenaikan: { [id.Ani]: 'mungkin' } }).ok, false);

  const k6 = siapWali(6);
  const l = k6.g.minta({ aksi: 'simpanKenaikan', rombel: k6.rombel, semester: 2, kenaikan: { [k6.id.Ani]: 'naik', [k6.id.Budi]: 'tinggal' } });
  assert.equal(l.pesan, 'Keputusan kelulusan Kelas 6 tersimpan.');
  assert.deepEqual(k6.g.isi('Kenaikan').map((r) => r[2]), ['Lulus', 'Tidak Lulus']);
  assert.equal(l.cek[k6.id.Ani].kenaikan, 'LULUS');
});
