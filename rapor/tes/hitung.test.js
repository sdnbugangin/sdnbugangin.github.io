// Uji mesin hitung rapor. Jalankan dari akar repo: node --test rapor/tes/*.test.js
// Berkas .gs dimuat ke satu konteks, sama seperti Apps Script menggabungkan semua berkas proyek.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = vm.createContext({});
for (const f of ['Referensi.gs', 'Hitung.gs']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', f), 'utf8'), ctx, { filename: f });
}
const R = (kode) => vm.runInContext(kode, ctx);
const hitung = (isian, aturan) => ctx.hitungNilaiMapel_(isian, aturan);
const tp = (...pasangan) => pasangan.map(([materi, nilai], i) => ({ kode: 'TP' + (i + 1), materi, nilai }));
const salin = (x) => JSON.parse(JSON.stringify(x));

test('bacaNilai_: kosong, nol, koma desimal, dan isian salah', () => {
  assert.deepEqual(salin(ctx.bacaNilai_('')), { ok: true, nilai: null });
  assert.deepEqual(salin(ctx.bacaNilai_(null)), { ok: true, nilai: null });
  assert.deepEqual(salin(ctx.bacaNilai_('-')), { ok: true, nilai: null });
  assert.equal(ctx.bacaNilai_(0).nilai, 0);
  assert.equal(ctx.bacaNilai_('85,5').nilai, 85.5);
  assert.equal(ctx.bacaNilai_(' 90 ').nilai, 90);
  assert.equal(ctx.bacaNilai_('101').ok, false);
  assert.equal(ctx.bacaNilai_(-1).ok, false);
  assert.equal(ctx.bacaNilai_('delapan').ok, false);
  assert.equal(ctx.bacaNilai_('8O').ok, false); // huruf O, bukan nol
  assert.equal(ctx.bacaNilai_(NaN).ok, false);
});

test('bulatkan_: setengah ke atas tanpa galat desimal', () => {
  assert.equal(ctx.bulatkan_(84.5), 85);
  assert.equal(ctx.bulatkan_(84.49), 84);
  assert.equal(ctx.bulatkan_(1.005, 2), 1.01);
  assert.equal(ctx.bulatkan_(null), null);
});

test('nilai rapor memakai bobot 50:50, bukan rata-rata biasa', () => {
  const h = hitung({ tp: tp(['A', 80], ['B', 90], ['C', 70]), akhir: [100] });
  assert.equal(h.nilaiLingkup, 80);
  assert.equal(h.nilaiAkhir, 100);
  assert.equal(h.nilai, 90);
  assert.equal(h.lengkap, true);
  assert.equal(h.predikat, 'Sangat baik');

  const b = hitung({ tp: tp(['A', 80]), akhir: [100] }, { bobot: { lingkup: 60, akhir: 40 } });
  assert.equal(b.nilai, 88);
});

test('nilai 0 dihitung sebagai nilai, bukan dianggap kosong', () => {
  const h = hitung({ tp: tp(['A', 0], ['B', 100]), akhir: [50] });
  assert.equal(h.nilaiLingkup, 50);
  assert.equal(h.nilai, 50);
});

test('siswa tanpa nilai tidak menghasilkan error', () => {
  const h = hitung({ tp: tp(['A', ''], ['B', null]), akhir: [] });
  assert.equal(h.nilai, null);
  assert.equal(h.predikat, '');
  assert.equal(h.deskripsiTinggi, '');
  assert.equal(h.deskripsiRendah, '');
  assert.equal(h.lengkap, false);
  assert.match(h.peringatan.join(' '), /Belum ada nilai/);
  const kosong = hitung(undefined);
  assert.equal(kosong.nilai, null);
});

test('komponen belum lengkap: nilai sementara dan peringatan', () => {
  const h = hitung({ tp: tp(['A', 80]), akhir: [] });
  assert.equal(h.nilai, 80);
  assert.equal(h.lengkap, false);
  assert.match(h.peringatan.join(' '), /akhir semester belum diisi/);
  const a = hitung({ tp: [], akhir: [70, 80] });
  assert.equal(a.nilai, 75);
  assert.match(a.peringatan.join(' '), /lingkup materi belum diisi/);
});

test('isian salah ditolak, dilaporkan, dan tidak ikut dihitung', () => {
  const h = hitung({ tp: tp(['A', 80], ['B', '850']), akhir: [90] });
  assert.equal(h.nilaiLingkup, 80);
  assert.equal(h.lengkap, false);
  assert.match(h.salah[0], /TP2: Nilai 850 di luar rentang/);
});

test('jumlah TP tidak dibatasi (rapor lama maksimal 15)', () => {
  const banyak = Array.from({ length: 30 }, (_, i) => ({ kode: 'TP' + (i + 1), materi: 'M' + (i + 1), nilai: 70 + (i % 10) }));
  const h = hitung({ tp: banyak, akhir: [80] });
  assert.equal(h.lengkap, true);
  assert.equal(h.tertinggi.materi, 'M10');
});

test('deskripsi tertinggi dan terendah dengan nama panggilan', () => {
  const h = hitung({ tp: tp(['Keliling dan Luas Bangun Datar', 95], ['Besar Sudut', 70], ['Statistik.', 80]), akhir: [85] },
    { panggilan: 'Budi' });
  assert.equal(h.deskripsiTinggi, 'Ananda Budi menunjukkan penguasaan yang sangat baik dalam Keliling dan Luas Bangun Datar.');
  assert.equal(h.deskripsiRendah, 'Ananda Budi perlu pendampingan dalam Besar Sudut.');
});

test('deskripsi tanpa nama panggilan diawali huruf besar', () => {
  const h = hitung({ tp: tp(['Pecahan', 90], ['Desimal', 60]), akhir: [80] });
  assert.equal(h.deskripsiTinggi, 'Menunjukkan penguasaan yang sangat baik dalam Pecahan.');
  assert.equal(h.deskripsiRendah, 'Perlu pendampingan dalam Desimal.');
});

test('satu TP atau semua TP sama: tidak ada kalimat "perlu pendampingan" yang kontradiktif', () => {
  const satu = hitung({ tp: tp(['Pecahan', 90]), akhir: [90] }, { panggilan: 'Ani' });
  assert.ok(satu.deskripsiTinggi);
  assert.equal(satu.deskripsiRendah, '');
  const sama = hitung({ tp: tp(['Pecahan', 85], ['Desimal', 85]), akhir: [90] });
  assert.equal(sama.deskripsiRendah, '');
});

test('mode predikat: kalimat sesuai rentang KKTP masing-masing TP', () => {
  const aturan = { panggilan: 'Sari', deskripsi: { mode: 'predikat', pakaiPanggilan: true } };
  const h = hitung({ tp: tp(['Pecahan', 90], ['Desimal', 65]), akhir: [80] }, aturan);
  assert.equal(h.deskripsiTinggi, 'Ananda Sari menunjukkan penguasaan yang sangat baik dalam Pecahan.');
  assert.equal(h.deskripsiRendah, 'Ananda Sari menunjukkan penguasaan yang cukup dalam Desimal.');
});

test('TP tanpa lingkup materi diberi peringatan dan tidak masuk deskripsi', () => {
  const h = hitung({ tp: [{ kode: 'TP1', materi: '', nilai: 95 }, { kode: 'TP2', materi: 'Pecahan', nilai: 80 }], akhir: [80] });
  assert.equal(h.tertinggi.materi, 'Pecahan');
  assert.match(h.peringatan.join(' '), /TP1 belum punya lingkup materi/);
});

test('predikat mengikuti batas KKTP 88 / 74 / 60', () => {
  const p = (n) => ctx.barisKktp_(n, ctx.KKTP_BAWAAN).predikat;
  assert.equal(p(100), 'Sangat baik');
  assert.equal(p(88), 'Sangat baik');
  assert.equal(p(87), 'Baik');
  assert.equal(p(74), 'Baik');
  assert.equal(p(73), 'Cukup');
  assert.equal(p(60), 'Cukup');
  assert.equal(p(59), 'Perlu bimbingan');
  assert.equal(p(0), 'Perlu bimbingan');
  assert.equal(ctx.barisKktp_(null, ctx.KKTP_BAWAAN), null);
});

test('cekBobot_ dan cekKktp_ menolak pengaturan yang salah', () => {
  assert.deepEqual(salin(ctx.cekBobot_({ lingkup: 50, akhir: 50 })), []);
  assert.match(ctx.cekBobot_({ lingkup: 60, akhir: 50 })[0], /harus 100%/);
  assert.equal(ctx.cekBobot_({ lingkup: '50', akhir: 50 }).length, 1);
  assert.deepEqual(salin(ctx.cekKktp_(ctx.KKTP_BAWAAN)), []);
  assert.ok(ctx.cekKktp_([{ min: 70, predikat: 'Baik' }, { min: 80, predikat: 'A' }, { min: 0, predikat: 'C' }]).length);
  assert.ok(ctx.cekKktp_([{ min: 70, predikat: 'Baik' }, { min: 10, predikat: 'C' }]).length);
  assert.ok(ctx.cekKktp_([]).length);
});

const NARASI = {
  Kerjasama: { Mahir: 'memimpin kerja kelompok.', Cakap: 'bekerja sama dengan teman', Berkembang: 'mulai mau bekerja sama' },
  Kebugaran: { Mahir: 'menjaga kebugaran', Cakap: 'berolahraga teratur', Berkembang: 'mengenal pola hidup sehat' }
};

test('kokurikuler: dimensi terkuat dan yang perlu bimbingan', () => {
  const h = ctx.deskripsiKokurikuler_('Budi', [
    { dimensi: 'Kolaborasi', subdimensi: 'Kerjasama', level: 'Mahir' },
    { dimensi: 'Kesehatan', subdimensi: 'Kebugaran', level: 'Berkembang' }
  ], NARASI);
  assert.equal(h.teks, 'Ananda Budi sudah baik dalam dimensi profil Kolaborasi, salah satunya mampu memimpin kerja kelompok, ' +
    'dan masih perlu bimbingan dalam dimensi profil Kesehatan agar dapat mengenal pola hidup sehat.');
});

test('kokurikuler: belum diisi / satu dimensi / semua sama tidak menghasilkan #VALUE!', () => {
  const kosong = ctx.deskripsiKokurikuler_('Budi', [{ dimensi: 'Kolaborasi', subdimensi: 'Kerjasama', level: '' }], NARASI);
  assert.equal(kosong.teks, '');
  assert.match(kosong.peringatan[0], /belum diisi/);

  const satu = ctx.deskripsiKokurikuler_('Budi', [{ dimensi: 'Kolaborasi', subdimensi: 'Kerjasama', level: 'Cakap' }], NARASI);
  assert.equal(satu.teks, 'Ananda Budi sudah baik dalam dimensi profil Kolaborasi, salah satunya mampu bekerja sama dengan teman.');

  const sama = ctx.deskripsiKokurikuler_('Budi', [
    { dimensi: 'Kolaborasi', subdimensi: 'Kerjasama', level: 'Cakap' },
    { dimensi: 'Kesehatan', subdimensi: 'Kebugaran', level: 'Cakap' }
  ], NARASI);
  assert.doesNotMatch(sama.teks, /perlu bimbingan/);
});

test('kokurikuler: narasi yang hilang dan level tak dikenal dilaporkan', () => {
  const h = ctx.deskripsiKokurikuler_('', [
    { dimensi: 'Kreativitas', subdimensi: 'Karya', level: 'Mahir' },
    { dimensi: 'Kolaborasi', subdimensi: 'Kerjasama', level: 'Hebat' }
  ], NARASI);
  assert.equal(h.teks, 'Ananda sudah baik dalam dimensi profil Kreativitas.');
  assert.equal(h.peringatan.length, 2);
});

test('peringkat_: nilai sama berbagi peringkat, nilai kosong dilewati', () => {
  const p = salin(ctx.peringkat_([
    { id: 'a', jumlah: 800 }, { id: 'b', jumlah: 850 }, { id: 'c', jumlah: 800 }, { id: 'd', jumlah: null }, { id: 'e', jumlah: 700 }
  ]));
  assert.deepEqual(p, { b: 1, a: 2, c: 2, e: 4 });
});

test('fase per kelas dan kelas tidak valid ditolak', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(ctx.faseKelas_), ['A', 'A', 'B', 'B', 'C', 'C']);
  assert.equal(ctx.faseKelas_('5'), 'C');
  assert.throws(() => ctx.faseKelas_(7), /Kelas harus 1 sampai 6/);
  assert.throws(() => ctx.faseKelas_('V'), /Kelas harus 1 sampai 6/);
});

test('kenaikan: semester 1 tanpa keterangan, semester 2 naik/tinggal/lulus', () => {
  for (let k = 1; k <= 6; k++) assert.equal(ctx.keteranganKenaikan_(k, 1, 'naik').tampil, false);
  assert.equal(ctx.keteranganKenaikan_(5, 2, 'naik').teks, 'Naik ke kelas VI (enam)');
  assert.equal(ctx.keteranganKenaikan_(1, 2, 'tinggal').teks, 'Tinggal di kelas I (satu)');
  assert.equal(ctx.keteranganKenaikan_(6, 2, 'naik').teks, 'LULUS');
  assert.equal(ctx.keteranganKenaikan_(6, 2, 'tinggal').teks, 'TIDAK LULUS');
  const belum = ctx.keteranganKenaikan_(6, 2, '');
  assert.equal(belum.teks, '');
  assert.match(belum.peringatan[0], /kelulusan belum diisi/);
  assert.throws(() => ctx.keteranganKenaikan_(5, 3, 'naik'), /Semester harus 1 atau 2/);
});

test('agama: ejaan lain dikenali, isian asing ditolak', () => {
  assert.equal(ctx.normalisasiAgama_('Budha'), 'Buddha');
  assert.equal(ctx.normalisasiAgama_(' KONGHUCU '), 'Khonghucu');
  assert.equal(ctx.normalisasiAgama_('Aliran Kepercayaan'), 'Kepercayaan terhadap Tuhan YME');
  assert.equal(ctx.normalisasiAgama_('lainnya'), null);
});

test('cekDaftarSiswa_: data dobel dan isian salah ditemukan per baris', () => {
  const salah = ctx.cekDaftarSiswa_([
    { nama: 'Ani', nisn: '0123456789', nis: '1001', jk: 'P', agama: 'Islam', seni: 'Seni Rupa' },
    { nama: 'Budi', nisn: '0123456789', nis: '1001', jk: 'L', agama: 'Budha' },
    { nama: 'Cici', nisn: '12345', jk: 'X', agama: 'lainnya', seni: 'Seni Lukis' },
    { nama: '' }
  ]);
  assert.equal(salah.length, 7);
  assert.match(salah[0], /Baris 2 \(Budi\): NISN sama dengan baris 1/);
  assert.match(salah[1], /NIS sama dengan baris 1/);
  assert.match(salah.join('\n'), /Baris 3 \(Cici\): NISN harus 10 digit/);
  assert.match(salah.join('\n'), /Baris 4: nama siswa kosong/);
  assert.deepEqual(salin(ctx.cekDaftarSiswa_([{ nama: 'Ani', jk: 'p', agama: 'islam' }])), []);
});

test('struktur mapel bawaan: IPAS mulai kelas 3, tiap kelas punya mapel inti', () => {
  const aktif = (k) => R('MAPEL_BAWAAN').filter((m) => m.aktifBawaan.includes(k)).map((m) => m.kode);
  assert.ok(!aktif(1).includes('IPAS'));
  assert.ok(aktif(3).includes('IPAS'));
  for (let k = 1; k <= 6; k++) for (const m of ['PAB', 'PP', 'BIND', 'MTK', 'SENI', 'PJOK']) assert.ok(aktif(k).includes(m), m + ' kelas ' + k);
  for (const m of R('MAPEL_BAWAAN')) for (const k of m.aktifBawaan) assert.ok(m.kelas.includes(k), m.kode);
});
