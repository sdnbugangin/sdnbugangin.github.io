// Uji Tujuan Pembelajaran: simpan, kode tetap, TP bawaan, dan data unduhan format e-Rapor.
// Jalankan dari akar repo: node --test rapor/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buatGas, sekolahAktif } = require('./tiruan-gas.js');

const salin = (x) => JSON.parse(JSON.stringify(x));
const g0 = buatGas();

const TP_MTK = [
  { tp: 'Peserta didik dapat menghitung keliling bangun datar', materi: 'Keliling bangun datar' },
  { tp: 'Peserta didik dapat menghitung luas bangun datar', materi: 'Luas bangun datar' },
  { tp: 'Peserta didik dapat mengukur besar sudut', materi: '' }
];

test('cekDaftarTp_: baris kosong dibuang, kode urut, panjang dan dobel diperiksa', () => {
  const h = salin(g0.ctx.cekDaftarTp_([{ tp: ' A  b ' }, {}, { tp: '', materi: '' }, { tp: 'C', materi: 'm' }], []));
  assert.deepEqual(h.salah, []);
  assert.deepEqual(h.tp, [{ kode: 'TP1', tp: 'A b', materi: '' }, { kode: 'TP2', tp: 'C', materi: 'm' }]);

  const panjang = g0.ctx.cekDaftarTp_([{ tp: 'x'.repeat(101) }], []);
  assert.match(panjang.salah[0], /101 karakter\). e-Rapor membatasi 100/);
  assert.equal(g0.ctx.cekDaftarTp_([{ tp: 'x'.repeat(100) }], []).salah.length, 0);
  assert.match(g0.ctx.cekDaftarTp_([{ tp: 'Sama' }, { tp: 'sama' }], []).salah[0], /sama persis dengan TP nomor 1/);
  assert.match(g0.ctx.cekDaftarTp_([{ materi: 'hanya materi' }], []).salah[0], /masih kosong/);
  assert.match(g0.ctx.cekDaftarTp_(Array.from({ length: 41 }, (_, i) => ({ tp: 'TP ' + i })), []).salah[0], /Maksimal 40/);
});

test('cekDaftarTp_: kode lama dipertahankan, kode varian lain tidak dipakai ulang', () => {
  const h = salin(g0.ctx.cekDaftarTp_([{ kode: 'TP3', tp: 'C' }, { tp: 'Baru' }, { kode: 'TP3', tp: 'Dobel kode' }, { kode: 'xx', tp: 'Kode aneh' }], ['TP1']));
  assert.deepEqual(h.tp.map((t) => t.kode), ['TP3', 'TP2', 'TP4', 'TP5']);
});

test('tpKelas: mapel aktif kelas, varian agama/seni, agama siswa', () => {
  const g = sekolahAktif();
  const r = g.minta({ aksi: 'simpanRombel', rombel: { kelas: 5, nama: '' } }).rombel;
  g.minta({ aksi: 'simpanSiswa', rombel: r.id, siswa: [
    { nama: 'Ani', jk: 'P', agama: 'Islam' }, { nama: 'Budi', jk: 'L', agama: 'Islam' }, { nama: 'Cici', jk: 'P', agama: 'Katolik' }] });
  const h = g.minta({ aksi: 'tpKelas', kelas: 5 });
  assert.equal(h.ok, true);
  assert.equal(h.fase, 'C');
  assert.equal(h.semester, 1);
  assert.deepEqual(h.mapel.map((m) => m.kode), ['PAB', 'PP', 'BIND', 'MTK', 'IPAS', 'SENI', 'PJOK', 'BING', 'MULOK1']);
  assert.equal(h.mapel[0].varian.length, 7);
  assert.deepEqual(h.mapel.find((m) => m.kode === 'SENI').varian, ['Seni Musik', 'Seni Rupa', 'Seni Tari', 'Seni Teater']);
  assert.deepEqual(h.mapel.find((m) => m.kode === 'MTK').varian, ['']);
  assert.deepEqual(h.agama, { Islam: 2, Katolik: 1 });
  assert.equal(h.adaBawaan, false);
  assert.equal(g.minta({ aksi: 'tpKelas', kelas: 7 }).ok, false);
  assert.equal(g.minta({ aksi: 'tpKelas', kelas: 1 }).mapel.some((m) => m.kode === 'IPAS'), false);
});

test('simpanTp: tersimpan per kelas/semester/mapel/varian dengan kode tetap', () => {
  const g = sekolahAktif();
  const h = g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: TP_MTK });
  assert.equal(h.ok, true, h.pesan);
  assert.equal(h.pesan, '3 TP Matematika tersimpan.');
  const isi = g.minta({ aksi: 'tpKelas', kelas: 5, semester: 1 }).tp['MTK|'];
  assert.deepEqual(isi.map((t) => t.kode), ['TP1', 'TP2', 'TP3']);
  // urutan diubah + satu TP baru: kode lama tetap melekat pada teksnya
  const ubah = [isi[2], { tp: 'Peserta didik dapat membaca diagram batang' }, isi[0], isi[1]];
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: ubah });
  const baru = g.minta({ aksi: 'tpKelas', kelas: 5, semester: 1 }).tp['MTK|'];
  assert.deepEqual(baru.map((t) => t.kode), ['TP3', 'TP4', 'TP1', 'TP2']);
  assert.equal(g.minta({ aksi: 'tpKelas', kelas: 5, semester: 2 }).tp['MTK|'], undefined, 'semester 2 terpisah');
  assert.equal(g.isi('Tujuan Pembelajaran').length, 4);
});

test('simpanTp: varian agama/seni terpisah, kodenya tidak bentrok', () => {
  const g = sekolahAktif();
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'PAB', varian: 'Islam', tp: [{ tp: 'Membaca surah pendek' }] });
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'PAB', varian: 'Katolik', tp: [{ tp: 'Mengenal doa Bapa Kami' }] });
  const tp = g.minta({ aksi: 'tpKelas', kelas: 5, semester: 1 }).tp;
  assert.deepEqual(tp['PAB|Islam'].map((t) => t.kode), ['TP1']);
  assert.deepEqual(tp['PAB|Katolik'].map((t) => t.kode), ['TP2']);
  assert.match(g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'PAB', varian: '', tp: [] }).pesan, /Pilih agama/);
  assert.match(g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'SENI', varian: 'Seni Lukis', tp: [] }).pesan, /Pilih seni/);
});

test('simpanTp: mapel tidak aktif, kelas/semester salah ditolak', () => {
  const g = sekolahAktif();
  assert.match(g.minta({ aksi: 'simpanTp', kelas: 1, semester: 1, mapel: 'IPAS', varian: '', tp: [] }).pesan, /tidak aktif di kelas 1/);
  assert.match(g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'KKA', varian: '', tp: [] }).pesan, /tidak aktif/);
  assert.match(g.minta({ aksi: 'simpanTp', kelas: 0, semester: 1, mapel: 'MTK', tp: [] }).pesan, /kelas 1 sampai 6/);
  assert.match(g.minta({ aksi: 'simpanTp', kelas: 5, semester: 3, mapel: 'MTK', tp: [] }).pesan, /Semester/);
});

test('simpanTp: TP yang sudah punya nilai tidak bisa dihapus, tapi teksnya boleh diubah', () => {
  const g = sekolahAktif();
  const r = g.minta({ aksi: 'simpanRombel', rombel: { kelas: 5, nama: '' } }).rombel;
  g.minta({ aksi: 'simpanSiswa', rombel: r.id, siswa: [{ nama: 'Ani', jk: 'P', agama: 'Islam' }] });
  const idSiswa = g.minta({ aksi: 'siswaRombel', rombel: r.id }).siswa[0].id;
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: TP_MTK });
  g.ss.getSheetByName('Nilai').appendRow(['2026/2027', 1, idSiswa, 'MTK', 'TP', 'TP1', 90, '']);
  assert.deepEqual(g.minta({ aksi: 'tpKelas', kelas: 5 }).bernilai, { 'MTK|TP1': true });
  const isi = g.minta({ aksi: 'tpKelas', kelas: 5 }).tp['MTK|'];
  assert.match(g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: isi.slice(1) }).pesan, /sudah punya nilai/);
  const ubah = [{ ...isi[0], tp: 'Peserta didik dapat menghitung keliling segi empat' }, ...isi.slice(1)];
  assert.equal(g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: ubah }).ok, true);
});

test('TP bawaan: disalin ke sekolah baru dan bisa diambil sekolah lain', () => {
  const sumber = sekolahAktif();
  sumber.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: TP_MTK });
  sumber.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'PAB', varian: 'Islam', tp: [{ tp: 'Membaca surah pendek', materi: 'Surah pendek' }] });
  // sekolah yang mendaftar sebelum sumber diatur: belum punya TP, tapi bisa mengambil TP bawaan
  const lama = sekolahAktif({ npsn: '20300001', nama: 'SD LAMA', email: 'sd.lama@gmail.com', sandi: 'rapor2026', ulangi: 'rapor2026', setuju: true, kabupaten: 'Kab. Kendal', provinsi: 'Jawa Tengah' }, sumber);
  assert.equal(lama.isi('Tujuan Pembelajaran').length, 0);
  assert.match(lama.minta({ aksi: 'tpBawaan', kelas: 5, semester: 1, mapel: 'MTK', varian: '' }).pesan, /belum tersedia/);

  sumber.ctx.tulisPengaturanPusat_('NPSN Sumber TP Bawaan', '20321653');
  assert.equal(lama.minta({ aksi: 'tpKelas', kelas: 5 }).adaBawaan, true);
  assert.equal(sumber.minta({ aksi: 'tpKelas', kelas: 5 }).adaBawaan, false, 'sekolah sumber tidak menarik dari dirinya sendiri');
  const ambil = lama.minta({ aksi: 'tpBawaan', kelas: 5, semester: 1, mapel: 'MTK', varian: '' });
  assert.equal(ambil.ok, true);
  assert.deepEqual(ambil.tp.map((t) => t.materi), ['Keliling bangun datar', 'Luas bangun datar', '']);
  assert.match(lama.minta({ aksi: 'tpBawaan', kelas: 4, semester: 1, mapel: 'MTK', varian: '' }).pesan, /belum ada/);

  // sekolah yang mendaftar setelah sumber diatur: TP bawaan langsung terpasang
  const baru = sekolahAktif({ npsn: '20300002', nama: 'SD BARU', email: 'sd.baru@gmail.com', sandi: 'rapor2026', ulangi: 'rapor2026', setuju: true, kabupaten: 'Kab. Kendal', provinsi: 'Jawa Tengah' }, sumber);
  const tp = baru.minta({ aksi: 'tpKelas', kelas: 5 }).tp;
  assert.deepEqual(tp['MTK|'].map((t) => t.tp), TP_MTK.map((t) => t.tp));
  assert.equal(tp['PAB|Islam'][0].materi, 'Surah pendek');
  // dan tetap bisa diubah sekolah itu sendiri tanpa mengubah sumber
  baru.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: [{ tp: 'TP milik SD BARU' }] });
  assert.equal(sumber.minta({ aksi: 'tpKelas', kelas: 5 }).tp['MTK|'].length, 3);
});

test('TP bawaan: sumber yang salah atau tidak bisa dibuka tidak menggagalkan pendaftaran', () => {
  const g = sekolahAktif();
  g.ctx.tulisPengaturanPusat_('NPSN Sumber TP Bawaan', '99999999');
  const baru = sekolahAktif({ npsn: '20300003', nama: 'SD C', email: 'sd.c@gmail.com', sandi: 'rapor2026', ulangi: 'rapor2026', setuju: true, kabupaten: 'Kab. Kendal', provinsi: 'Jawa Tengah' }, g);
  assert.equal(baru.isi('Tujuan Pembelajaran').length, 0);
  assert.match(baru.minta({ aksi: 'tpBawaan', kelas: 5, semester: 1, mapel: 'MTK', varian: '' }).pesan, /belum ada/);
});

test('tpEkspor: satu berkas per mapel sesuai format e-Rapor, agama per agama, seni digabung', () => {
  const g = sekolahAktif();
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: TP_MTK });
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 2, mapel: 'MTK', varian: '', tp: [{ tp: 'Peserta didik dapat menyajikan data' }] });
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'SENI', varian: 'Seni Rupa', tp: [{ tp: 'Menggambar ilustrasi' }] });
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'SENI', varian: 'Seni Musik', tp: [{ tp: 'Memainkan alat musik ritmis' }] });
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'PAB', varian: 'Islam', tp: [{ tp: 'Membaca surah pendek' }] });
  g.minta({ aksi: 'simpanTp', kelas: 6, semester: 1, mapel: 'MTK', varian: '', tp: [{ tp: 'TP kelas 6' }] });
  const h = g.minta({ aksi: 'tpEkspor', kelas: 5 });
  assert.equal(h.ok, true);
  assert.deepEqual(h.berkas.map((b) => b.namaBerkas), ['f_tp (Pendidikan Agama Islam dan Budi Pekerti).xlsx', 'f_tp (Matematika (Umum)).xlsx', 'f_tp (Seni Budaya).xlsx']);
  const mtk = h.berkas[1];
  assert.equal(mtk.kodeErapor, '401000000');
  assert.equal(mtk.judul, 'MATEMATIKA (UMUM)');
  assert.deepEqual(mtk.baris.map((b) => [b.tingkat, b.fase, b.semester]), [[5, 'C', 1], [5, 'C', 1], [5, 'C', 1], [5, 'C', 2]]);
  assert.deepEqual(h.berkas[2].baris.map((b) => b.tp), ['Memainkan alat musik ritmis', 'Menggambar ilustrasi'], 'seni urut sesuai daftar seni sekolah');
  assert.equal(h.berkas[0].kodeErapor, '');
  assert.match(h.peringatan[0], /Kode e-Rapor untuk Pendidikan Agama Islam dan Budi Pekerti belum diketahui/);
  assert.match(g.minta({ aksi: 'tpEkspor', kelas: 3 }).pesan, /Belum ada TP/);
});

test('aksi TP wajib sesi', () => {
  const g = sekolahAktif();
  for (const aksi of ['tpKelas', 'simpanTp', 'tpBawaan', 'tpEkspor']) assert.equal(salin(g.ctx.layani_({ aksi })).sesiHabis, true);
});
