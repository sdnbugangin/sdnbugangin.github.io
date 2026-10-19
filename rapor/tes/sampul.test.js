// Uji data sampul dan identitas: kolom siswa tambahan, profil Website untuk spreadsheet lama, isi rekap.
// Jalankan dari akar repo: node --test rapor/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { sekolahAktif } = require('./tiruan-gas.js');

test('kolom siswa tambahan tersimpan dan ikut di rekap sebagai identitas', () => {
  const g = sekolahAktif();
  const r = g.minta({ aksi: 'simpanRombel', rombel: { kelas: 5, nama: '' } }).rombel;
  const h = g.minta({ aksi: 'simpanSiswa', rombel: r.id, siswa: [{
    nama: 'ANI LESTARI', nisn: '0012345678', nis: '101', jk: 'P', agama: 'Islam', seni: 'Musik', tempatLahir: 'Kendal', tanggalLahir: '15/03/2016',
    ayah: 'BUDI', ibu: 'SITI', alamat: 'Bugangin RT 1', pendidikanSebelumnya: 'TK Pertiwi', pekerjaanAyah: 'Petani', pekerjaanIbu: 'Pedagang',
    alamatOrtu: 'Bugangin RT 1', wali: '', pekerjaanWali: '', alamatWali: '' }] });
  assert.equal(h.ok, true, h.pesan);
  const s = g.minta({ aksi: 'siswaRombel', rombel: r.id }).siswa[0];
  assert.equal(s.pendidikanSebelumnya, 'TK Pertiwi');
  assert.equal(s.pekerjaanIbu, 'Pedagang');
  const rek = g.minta({ aksi: 'rekapRombel', rombel: r.id });
  const id = rek.siswa[0].identitas;
  assert.equal(id.tanggalLahirPanjang, '15 Maret 2016');
  assert.equal(id.jkPanjang, 'Perempuan');
  assert.equal(id.pekerjaanAyah, 'Petani');
  assert.equal(id.alamatOrtu, 'Bugangin RT 1');
  assert.equal(rek.sekolah.email, 'sdnbugangin@gmail.com');
  const panjang = g.minta({ aksi: 'simpanSiswa', rombel: r.id, siswa: [{ nama: 'X', jk: 'L', agama: 'Islam', seni: 'Musik', pekerjaanAyah: 'p'.repeat(101) }] });
  assert.equal(panjang.ok, false);
  assert.match(panjang.pesan, /pekerjaan ayah terlalu panjang/);
});

test('profil Website: ada di sekolah baru, dilengkapi otomatis di spreadsheet lama, bisa disimpan', () => {
  const g = sekolahAktif();
  assert.ok(g.minta({ aksi: 'dataSekolah' }).profil.some((p) => p.kunci === 'Website'));
  // spreadsheet versi lama: baris Website belum ada
  const sh = g.ss.getSheetByName('Profil Sekolah');
  sh.data = sh.data.filter((r) => r[0] !== 'Website');
  assert.ok(g.minta({ aksi: 'dataSekolah' }).profil.some((p) => p.kunci === 'Website'), 'tampil walau baris belum ada');
  const h = g.minta({ aksi: 'simpanProfil', profil: { Website: 'sdnbugangin.sch.id', 'Kode Pos': '51351' } });
  assert.equal(h.ok, true, h.pesan);
  assert.ok(g.isi('Profil Sekolah').some((r) => r[0] === 'Website' && r[1] === 'sdnbugangin.sch.id'), 'baris dibuat saat disimpan');
  const r = g.minta({ aksi: 'simpanRombel', rombel: { kelas: 1, nama: '' } }).rombel;
  const rek = g.minta({ aksi: 'rekapRombel', rombel: r.id });
  assert.equal(rek.sekolah.website, 'sdnbugangin.sch.id');
  assert.equal(rek.sekolah.kodePos, '51351');
});
