// Uji bagian murni Pantau Belajar. Data di sini buatan (bukan data siswa asli).
// Jalankan dari akar repo: node --test pantau/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../apps-script/Kode.gs');

const TA = '2026/2027';
function tabel(opsi = {}) {
  return {
    pengaturan: [{ Kunci: 'Tahun Ajaran', Nilai: TA }, { Kunci: 'Semester', Nilai: opsi.semester || 1 }],
    rombel: [{ 'ID Rombel': 'R4A', 'Tahun Ajaran': TA, Kelas: 4, 'Nama Rombel': '4A', 'Wali Kelas': 'Bu Contoh, S.Pd.' }],
    siswa: [
      { 'ID Siswa': 'S1', NISN: '0161234567', 'Nama Lengkap': 'ANAK CONTOH SATU', 'Nama Panggilan': 'Satu', Agama: 'Islam' },
      { 'ID Siswa': 'S2', NISN: '0169999999', 'Nama Lengkap': 'Anak Contoh Dua', 'Nama Panggilan': '', Agama: 'Kristen' },
      { 'ID Siswa': 'S3', NISN: '0160000003', 'Nama Lengkap': 'Anak Tanpa Kelas', Agama: 'Islam' }
    ],
    anggota: [
      { 'Tahun Ajaran': TA, 'ID Rombel': 'R4A', 'ID Siswa': 'S1', 'Seni Pilihan': 'Seni Musik, Seni Rupa' },
      { 'Tahun Ajaran': TA, 'ID Rombel': 'R4A', 'ID Siswa': 'S2', 'Seni Pilihan': 'Seni Tari' }
    ],
    mapelAktif: [
      { 'Tahun Ajaran': TA, Kelas: 4, 'Kode Mapel': 'MTK', 'Nama di Rapor': 'Matematika', Jenis: 'umum', Urutan: 2, Aktif: 'Ya' },
      { 'Tahun Ajaran': TA, Kelas: 4, 'Kode Mapel': 'PAI', 'Nama di Rapor': 'Pendidikan Agama', Jenis: 'agama', Urutan: 1, Aktif: 'Ya' },
      { 'Tahun Ajaran': TA, Kelas: 4, 'Kode Mapel': 'SENI', 'Nama di Rapor': 'Seni', Jenis: 'seni', Urutan: 3, Aktif: 'Ya' },
      { 'Tahun Ajaran': TA, Kelas: 4, 'Kode Mapel': 'BING', 'Nama di Rapor': 'Bahasa Inggris', Jenis: 'umum', Urutan: 4, Aktif: 'Tidak' },
      { 'Tahun Ajaran': TA, Kelas: 4, 'Kode Mapel': 'IPAS', 'Nama di Rapor': 'IPAS', Jenis: 'umum', Urutan: 5, Aktif: 'Ya' }
    ],
    tp: [
      ...['TP1', 'TP2', 'TP3', 'TP4'].map((k, i) => ({ 'Tahun Ajaran': TA, Semester: 1, Kelas: 4, 'Kode Mapel': 'MTK', Varian: '', 'Kode TP': k, 'Lingkup Materi': 'Bilangan', 'Tujuan Pembelajaran': 'TP matematika ' + (i + 1) })),
      { 'Tahun Ajaran': TA, Semester: 1, Kelas: 4, 'Kode Mapel': 'PAI', Varian: 'Islam', 'Kode TP': 'TP1', 'Tujuan Pembelajaran': 'TP PAI Islam' },
      { 'Tahun Ajaran': TA, Semester: 1, Kelas: 4, 'Kode Mapel': 'PAI', Varian: 'Kristen', 'Kode TP': 'TP2', 'Tujuan Pembelajaran': 'TP PAI Kristen' },
      { 'Tahun Ajaran': TA, Semester: 1, Kelas: 4, 'Kode Mapel': 'SENI', Varian: 'Seni Musik', 'Kode TP': 'TP1', 'Tujuan Pembelajaran': 'TP musik' },
      { 'Tahun Ajaran': TA, Semester: 1, Kelas: 4, 'Kode Mapel': 'SENI', Varian: 'Seni Rupa', 'Kode TP': 'TP2', 'Tujuan Pembelajaran': 'TP rupa' },
      { 'Tahun Ajaran': TA, Semester: 1, Kelas: 4, 'Kode Mapel': 'IPAS', Varian: '', 'Kode TP': 'TP1', 'Tujuan Pembelajaran': 'TP IPAS' },
      { 'Tahun Ajaran': TA, Semester: 2, Kelas: 4, 'Kode Mapel': 'MTK', Varian: '', 'Kode TP': 'TP5', 'Tujuan Pembelajaran': 'TP semester 2' },
      { 'Tahun Ajaran': TA, Semester: 1, Kelas: 4, 'Kode Mapel': 'MTK', Varian: '', 'Kode TP': 'TP9', 'Tujuan Pembelajaran': '' }
    ],
    nilai: [
      { 'Tahun Ajaran': TA, Semester: 1, 'ID Siswa': 'S1', 'Kode Mapel': 'MTK', Jenis: 'TP', Kode: 'TP1', Nilai: 85 },
      { 'Tahun Ajaran': TA, Semester: 1, 'ID Siswa': 'S1', 'Kode Mapel': 'MTK', Jenis: 'TP', Kode: 'TP2', Nilai: '65,5' },
      { 'Tahun Ajaran': TA, Semester: 1, 'ID Siswa': 'S1', 'Kode Mapel': 'MTK', Jenis: 'TP', Kode: 'TP3', Nilai: 70 },
      { 'Tahun Ajaran': TA, Semester: 1, 'ID Siswa': 'S1', 'Kode Mapel': 'MTK', Jenis: 'SAS', Kode: 'TES', Nilai: 10 },
      { 'Tahun Ajaran': TA, Semester: 1, 'ID Siswa': 'S1', 'Kode Mapel': 'PAI', Jenis: 'TP', Kode: 'TP1', Nilai: 90 },
      { 'Tahun Ajaran': TA, Semester: 1, 'ID Siswa': 'S1', 'Kode Mapel': 'SENI', Jenis: 'TP', Kode: 'TP1', Nilai: 80 },
      { 'Tahun Ajaran': TA, Semester: 1, 'ID Siswa': 'S2', 'Kode Mapel': 'MTK', Jenis: 'TP', Kode: 'TP1', Nilai: 40 },
      { 'Tahun Ajaran': '2025/2026', Semester: 1, 'ID Siswa': 'S1', 'Kode Mapel': 'MTK', Jenis: 'TP', Kode: 'TP4', Nilai: 99 }
    ]
  };
}

test('NISN dirapikan dan nilai berkoma dibaca', () => {
  assert.equal(P.rapikanNisn_(' 016 123-4567 '), '0161234567');
  assert.equal(P.angka_('65,5'), 65.5);
  assert.equal(P.angka_(''), null);
  assert.equal(P.angka_('abc'), null);
});

test('aturan sandi baru', () => {
  assert.match(P.cekSandiBaru_('abc', 'abc'), /minimal 4/);
  assert.match(P.cekSandiBaru_('MuridSuper', 'MuridSuper'), /sandi awal/);
  assert.match(P.cekSandiBaru_('abcd', 'abce'), /tidak sama/);
  assert.equal(P.cekSandiBaru_('1234', '1234'), '');
});

test('status TP: kosong = belum dinilai, bukan belum tuntas', () => {
  assert.equal(P.statusTp_(null, 70), 'belum');
  assert.equal(P.statusTp_(70, 70), 'tuntas');
  assert.equal(P.statusTp_(69.9, 70), 'perbaikan');
});

test('ketuntasan siswa: hitungan per mapel, varian agama & seni, tanpa angka nilai', () => {
  const h = P.hitungKetuntasan_(tabel(), '0161234567', undefined, 70);
  assert.equal(h.ok, true);
  assert.equal(h.semester, 1);
  assert.deepEqual(h.siswa, { nama: 'ANAK CONTOH SATU', panggilan: 'Satu', kelas: '4A', wali: 'Bu Contoh, S.Pd.' });
  // urut sesuai Urutan; mapel tidak aktif dan mapel tanpa TP tidak muncul
  assert.deepEqual(h.mapel.map(m => m.nama), ['Pendidikan Agama', 'Matematika', 'Seni (Seni Musik)', 'Seni (Seni Rupa)', 'IPAS']);

  const mtk = h.mapel.find(m => m.nama === 'Matematika');
  assert.deepEqual(mtk.jumlah, { tuntas: 2, perbaikan: 1, belum: 1 });
  assert.deepEqual(mtk.tp.map(t => t.status), ['tuntas', 'perbaikan', 'tuntas', 'belum']); // TP4 tahun lalu tidak dihitung
  assert.equal(mtk.pesan.jenis, 'perbaikan');
  assert.match(mtk.pesan.teks, /1 TP yang belum tuntas/);
  assert.match(mtk.pesan.teks, /Bu Contoh/);
  assert.ok(!JSON.stringify(h).includes('65.5') && !JSON.stringify(h).includes('"nilai"'), 'angka nilai tidak boleh dikirim');

  const pai = h.mapel.find(m => m.nama === 'Pendidikan Agama');
  assert.deepEqual(pai.tp.map(t => t.tp), ['TP PAI Islam']);
  assert.equal(pai.pesan.jenis, 'apresiasi');
  assert.match(pai.pesan.teks, /Satu/);

  const rupa = h.mapel.find(m => m.nama === 'Seni (Seni Rupa)');
  assert.deepEqual(rupa.jumlah, { tuntas: 0, perbaikan: 0, belum: 1 });
  assert.equal(rupa.pesan, null);
});

test('sebagian dinilai dan semua tuntas → pesan semangat', () => {
  const t = tabel();
  t.nilai = t.nilai.filter(n => !(n.Kode === 'TP2' && n['Kode Mapel'] === 'MTK'));
  const mtk = P.hitungKetuntasan_(t, '0161234567', 1, 70).mapel.find(m => m.nama === 'Matematika');
  assert.equal(mtk.pesan.jenis, 'semangat');
});

test('agama siswa lain dan panggilan bawaan dari nama depan', () => {
  const h = P.hitungKetuntasan_(tabel(), '0169999999', 1, 70);
  assert.equal(h.siswa.panggilan, 'Anak');
  assert.deepEqual(h.mapel.find(m => m.nama === 'Pendidikan Agama').tp.map(t => t.tp), ['TP PAI Kristen']);
  assert.equal(h.mapel.filter(m => m.nama.startsWith('Seni')).length, 0); // Seni Tari tidak punya TP
});

test('semester 2 bisa dipilih; semester tidak sah kembali ke semester aktif', () => {
  const h2 = P.hitungKetuntasan_(tabel(), '0161234567', 2, 70);
  assert.equal(h2.semester, 2);
  assert.deepEqual(h2.mapel.map(m => m.nama), ['Matematika']);
  assert.equal(P.hitungKetuntasan_(tabel({ semester: 2 }), '0161234567', 7, 70).semester, 2);
});

test('batas tuntas mengikuti pengaturan', () => {
  const mtk = P.hitungKetuntasan_(tabel(), '0161234567', 1, 60).mapel.find(m => m.nama === 'Matematika');
  assert.deepEqual(mtk.jumlah, { tuntas: 3, perbaikan: 0, belum: 1 });
});

test('siswa tidak ada atau belum masuk kelas', () => {
  assert.equal(P.hitungKetuntasan_(tabel(), '0000000000', 1, 70).ok, false);
  assert.match(P.hitungKetuntasan_(tabel(), '0160000003', 1, 70).pesan, /belum terdaftar/);
});
