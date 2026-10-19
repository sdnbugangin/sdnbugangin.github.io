// Uji input nilai per rombel: simpan, hitung ulang, varian agama/seni, dan penolakan isian salah.
// Jalankan dari akar repo: node --test rapor/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { sekolahAktif } = require('./tiruan-gas.js');

/** Sekolah dengan rombel kelas 5 berisi 3 siswa, TP Matematika, PAB Islam, dan TP dua seni. */
function siapNilai() {
  const g = sekolahAktif();
  const r = g.minta({ aksi: 'simpanRombel', rombel: { kelas: 5, nama: 'A' } }).rombel;
  g.minta({ aksi: 'simpanSiswa', rombel: r.id, siswa: [
    { nama: 'ANI LESTARI', panggilan: 'Ani', jk: 'P', agama: 'Islam', seni: 'Musik, Rupa' },
    { nama: 'BUDI SANTOSO', panggilan: 'Budi', jk: 'L', agama: 'Islam', seni: 'Musik' },
    { nama: 'CICI', jk: 'P', agama: 'Katolik', seni: 'Rupa' }
  ] });
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: [
    { tp: 'Peserta didik dapat menghitung keliling bangun datar', materi: 'keliling bangun datar' },
    { tp: 'Peserta didik dapat menghitung luas bangun datar', materi: 'luas bangun datar' },
    { tp: 'Peserta didik dapat mengukur besar sudut', materi: '' }] });
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'PAB', varian: 'Islam', tp: [{ tp: 'Membaca surah pendek' }] });
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'SENI', varian: 'Seni Musik', tp: [{ tp: 'Memainkan alat musik ritmis' }] });
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'SENI', varian: 'Seni Rupa', tp: [{ tp: 'Menggambar ilustrasi' }] });
  const siswa = g.minta({ aksi: 'siswaRombel', rombel: r.id }).siswa;
  return { g, rombel: r.id, id: Object.fromEntries(siswa.map((s) => [s.panggilan, s.id])) };
}

test('nilaiRombel: mapel pertama, agama terbanyak, siswa sesuai agama', () => {
  const { g, rombel } = siapNilai();
  const h = g.minta({ aksi: 'nilaiRombel', rombel });
  assert.equal(h.ok, true);
  assert.equal(h.semester, 1);
  assert.equal(h.mapel.kode, 'PAB');
  assert.deepEqual(h.varianAda, ['Islam', 'Katolik']);
  assert.equal(h.varian, 'Islam');
  assert.deepEqual(h.siswa.map((s) => [s.no, s.nama]), [[1, 'ANI LESTARI'], [2, 'BUDI SANTOSO']]);
  const k = g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'PAB', varian: 'Katolik' });
  assert.deepEqual(k.siswa.map((s) => [s.no, s.nama]), [[3, 'CICI']], 'nomor absen tetap nomor di rombel');
  assert.deepEqual(k.tp, []);
  assert.equal(g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'MTK' }).siswa.length, 3);
});

test('simpanNilai: tersimpan, dihitung dengan bobot 50:50, deskripsi memakai lingkup materi', () => {
  const { g, rombel, id } = siapNilai();
  const h = g.minta({ aksi: 'simpanNilai', rombel, mapel: 'MTK', varian: '', nilai: {
    [id.Ani]: { TP1: '95', TP2: '70', TP3: '80', TES: '84,5', PRAKTIK: '' },
    [id.Budi]: { TP1: '80', TP2: '80', TP3: '80', TES: '', PRAKTIK: '' },
    [id.Cici]: {}
  } });
  assert.equal(h.ok, true, h.pesan);
  assert.match(h.pesan, /Nilai Matematika 5A tersimpan\. 2 siswa nilainya belum lengkap\./);
  const ani = h.hasil[id.Ani];
  assert.equal(ani.nilai, Math.round((((95 + 70 + 80) / 3) + 84.5) / 2));
  assert.equal(ani.predikat, 'Baik');
  assert.equal(ani.lengkap, true);
  assert.equal(ani.deskripsiTinggi, 'Ananda Ani menunjukkan penguasaan yang sangat baik dalam keliling bangun datar.');
  assert.equal(ani.deskripsiRendah, 'Ananda Ani perlu pendampingan dalam luas bangun datar.');
  assert.equal(h.hasil[id.Budi].lengkap, false);
  assert.match(h.hasil[id.Budi].peringatan.join(' '), /akhir semester belum diisi/);
  assert.equal(h.hasil[id.Cici].nilai, null);
  // dimuat ulang: angka yang sama
  const lagi = g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'MTK' });
  assert.deepEqual(lagi.nilai[id.Ani], { TP1: 95, TP2: 70, TP3: 80, TES: 84.5 });
  assert.equal(g.isi('Nilai').length, 7);
});

test('simpanNilai: isian salah ditolak semua, dengan nomor absen dan nama siswa', () => {
  const { g, rombel, id } = siapNilai();
  const h = g.minta({ aksi: 'simpanNilai', rombel, mapel: 'MTK', varian: '', nilai: {
    [id.Ani]: { TP1: '950', TES: 'delapan' }, [id.Budi]: { TP2: '-5' } } });
  assert.equal(h.ok, false);
  assert.deepEqual(h.salah, [
    '1. ANI LESTARI — TP1: Nilai 950 di luar rentang 0–100.',
    '1. ANI LESTARI — Sumatif akhir tes: "delapan" bukan angka.',
    '2. BUDI SANTOSO — TP2: "-5" bukan angka.'
  ]);
  assert.equal(g.isi('Nilai').length, 0);
});

test('simpanNilai: mengosongkan isian menghapus angka lama, mapel lain tidak tersentuh', () => {
  const { g, rombel, id } = siapNilai();
  g.minta({ aksi: 'simpanNilai', rombel, mapel: 'PAB', varian: 'Islam', nilai: { [id.Ani]: { TP1: '90', TES: '88' } } });
  g.minta({ aksi: 'simpanNilai', rombel, mapel: 'MTK', varian: '', nilai: { [id.Ani]: { TP1: '90', TP2: '80' } } });
  g.minta({ aksi: 'simpanNilai', rombel, mapel: 'MTK', varian: '', nilai: { [id.Ani]: { TP1: '90', TP2: '' } } });
  assert.deepEqual(g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'MTK' }).nilai[id.Ani], { TP1: 90 });
  assert.deepEqual(g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'PAB', varian: 'Islam' }).nilai[id.Ani], { TP1: 90, TES: 88 });
});

test('simpanNilai: seni ganda — satu siswa dinilai di dua seni, angkanya terpisah', () => {
  const { g, rombel, id } = siapNilai();
  const musik = g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'SENI', varian: 'Seni Musik' });
  assert.deepEqual(musik.siswa.map((s) => s.nama), ['ANI LESTARI', 'BUDI SANTOSO']);
  const rupa = g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'SENI', varian: 'Seni Rupa' });
  assert.deepEqual(rupa.siswa.map((s) => s.nama), ['ANI LESTARI', 'CICI']);
  g.minta({ aksi: 'simpanNilai', rombel, mapel: 'SENI', varian: 'Seni Musik', nilai: { [id.Ani]: { TP1: '90', TES: '80' } } });
  g.minta({ aksi: 'simpanNilai', rombel, mapel: 'SENI', varian: 'Seni Rupa', nilai: { [id.Ani]: { TP2: '70', TES: '60' } } });
  assert.deepEqual(g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'SENI', varian: 'Seni Musik' }).nilai[id.Ani], { TP1: 90, TES: 80 });
  assert.deepEqual(g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'SENI', varian: 'Seni Rupa' }).nilai[id.Ani], { TP2: 70, TES: 60 });
  const kode = g.isi('Nilai').filter((r) => r[4] === 'SAS').map((r) => r[5]).sort();
  assert.deepEqual(kode, ['Seni Musik|TES', 'Seni Rupa|TES']);
});

test('simpanNilai: tanpa TP, varian berubah, atau siswa asing ditolak', () => {
  const { g, rombel, id } = siapNilai();
  assert.match(g.minta({ aksi: 'simpanNilai', rombel, mapel: 'PAB', varian: 'Katolik', nilai: {} }).pesan, /Belum ada TP/);
  assert.match(g.minta({ aksi: 'simpanNilai', rombel, mapel: 'PAB', varian: 'Hindu', nilai: {} }).pesan, /berubah/);
  assert.match(g.minta({ aksi: 'simpanNilai', rombel, mapel: 'PAB', varian: 'Islam', nilai: { [id.Cici]: { TP1: '80' } } }).pesan, /tidak terdaftar/);
  assert.match(g.minta({ aksi: 'nilaiRombel', rombel: 'Rpalsu' }).pesan, /Rombel tidak ditemukan/);
  assert.match(g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'KKA' }).pesan, /tidak aktif/);
});

test('nilai yang tersimpan mengunci TP-nya dari penghapusan', () => {
  const { g, rombel, id } = siapNilai();
  g.minta({ aksi: 'simpanNilai', rombel, mapel: 'MTK', varian: '', nilai: { [id.Ani]: { TP2: '75' } } });
  const tp = g.minta({ aksi: 'tpKelas', kelas: 5 }).tp['MTK|'];
  assert.match(g.minta({ aksi: 'simpanTp', kelas: 5, semester: 1, mapel: 'MTK', varian: '', tp: [tp[0], tp[2]] }).pesan, /sudah punya nilai/);
});

test('mengubah bobot atau KKTP langsung mengubah hasil, pengaturan rusak dilaporkan', () => {
  const { g, rombel, id } = siapNilai();
  g.minta({ aksi: 'simpanNilai', rombel, mapel: 'MTK', varian: '', nilai: { [id.Ani]: { TP1: '80', TES: '100' } } });
  assert.equal(g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'MTK' }).hasil[id.Ani].nilai, 90);
  const atur = g.ss.getSheetByName('Pengaturan').data;
  atur.find((r) => r[0] === 'Bobot Lingkup Materi')[1] = 60;
  atur.find((r) => r[0] === 'Bobot Akhir Semester')[1] = 40;
  assert.equal(g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'MTK' }).hasil[id.Ani].nilai, 88);
  atur.find((r) => r[0] === 'Bobot Akhir Semester')[1] = 50;
  assert.match(g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'MTK' }).pesan, /Pengaturan nilai sekolah perlu diperbaiki: Jumlah bobot harus 100%/);
});

test('semester 2 terpisah dari semester 1', () => {
  const { g, rombel, id } = siapNilai();
  g.minta({ aksi: 'simpanTp', kelas: 5, semester: 2, mapel: 'MTK', varian: '', tp: [{ tp: 'Menyajikan data' }] });
  g.minta({ aksi: 'simpanNilai', rombel, mapel: 'MTK', varian: '', semester: 1, nilai: { [id.Ani]: { TP1: '95' } } });
  g.minta({ aksi: 'simpanNilai', rombel, mapel: 'MTK', varian: '', semester: 2, nilai: { [id.Ani]: { TP1: '70' } } });
  // kode TP dihitung per semester: TP1 semester 2 berbeda dengan TP1 semester 1, nilainya tidak tertukar
  const s2 = g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'MTK', semester: 2 });
  assert.deepEqual(s2.tp.map((t) => [t.kode, t.tp]), [['TP1', 'Menyajikan data']]);
  assert.deepEqual(s2.nilai[id.Ani], { TP1: 70 });
  assert.deepEqual(g.minta({ aksi: 'nilaiRombel', rombel, mapel: 'MTK' }).nilai[id.Ani], { TP1: 95 });
});

test('aksi nilai wajib sesi', () => {
  const { g } = siapNilai();
  for (const aksi of ['nilaiRombel', 'simpanNilai']) assert.equal(JSON.parse(JSON.stringify(g.ctx.layani_({ aksi }))).sesiHabis, true);
});
