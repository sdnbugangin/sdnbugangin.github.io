// Uji transkrip & SKL: rata-rata nilai rapor kelas 5-6 (dari arsip tahun lalu), praktik, isian manual, nomor urut.
// Jalankan dari akar repo: node --test rapor/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { sekolahAktif } = require('./tiruan-gas.js');

test('fungsi bantu: nomor urut, tahun ajaran sebelumnya, dua desimal', () => {
  const g = sekolahAktif();
  assert.equal(g.ctx.nomorKe_('400.3.11/060/SD', 0), '400.3.11/060/SD');
  assert.equal(g.ctx.nomorKe_('400.3.11/060/SD', 41), '400.3.11/101/SD');
  assert.equal(g.ctx.nomorKe_('Nomor: 421.2/ 009/ SD', 1), 'Nomor: 421.2/ 010/ SD');
  assert.equal(g.ctx.nomorKe_('SKL-7', 2), 'SKL-9');
  assert.equal(g.ctx.tahunAjaranSebelum_('2027/2028'), '2026/2027');
  assert.equal(g.ctx.duaDesimal_(85.3125), 85.31);
  assert.equal(g.ctx.duaDesimal_(81.505), 81.51);
});

/** Tahun 2026/2027: kelas 5 berisi ANI (Islam) dan BUDI (Katolik), nilai MTK dua semester; lalu naik ke kelas 6 tahun 2027/2028. */
function siapLulus() {
  const g = sekolahAktif();
  const M = (q) => { const h = g.minta(q); assert.notEqual(h.ok, false, q.aksi + ': ' + h.pesan); return h; };
  const r5 = M({ aksi: 'simpanRombel', rombel: { kelas: 5, nama: '' } }).rombel.id;
  M({ aksi: 'simpanRombel', rombel: { kelas: 6, nama: '' } });
  M({ aksi: 'simpanSiswa', rombel: r5, siswa: [
    { nama: 'ANI LESTARI', nisn: '0012345678', jk: 'P', agama: 'Islam', seni: 'Musik', tempatLahir: 'Kendal', tanggalLahir: '15/03/2015' },
    { nama: 'BUDI SANTOSO', nisn: '0012345679', jk: 'L', agama: 'Katolik', seni: 'Musik' }] });
  const id = Object.fromEntries(M({ aksi: 'siswaRombel', rombel: r5 }).siswa.map((s) => [s.nama.split(' ')[0], s.id]));
  const nilaiMtk = (kelas, rb, sem, ani, budi) => {
    M({ aksi: 'simpanTp', kelas, semester: sem, mapel: 'MTK', varian: '', tp: [{ tp: 'TP MTK', materi: 'bilangan' }] });
    M({ aksi: 'simpanNilai', rombel: rb, semester: sem, mapel: 'MTK', varian: '', nilai: { [id.ANI]: { TP1: String(ani[0]), TES: String(ani[1]) }, [id.BUDI]: { TP1: String(budi[0]), TES: String(budi[1]) } } });
  };
  nilaiMtk(5, r5, 1, [80, 80], [70, 70]);
  nilaiMtk(5, r5, 2, [90, 90], [70, 70]);
  M({ aksi: 'simpanProfil', profil: { 'Kepala Sekolah': 'YOS PUTRA K., S.Pd.' }, semester: 2 });
  M({ aksi: 'simpanKenaikan', rombel: r5, semester: 2, kenaikan: { [id.ANI]: 'naik', [id.BUDI]: 'naik' } });
  M({ aksi: 'taBaruJalankan', konfirmasi: 'MULAI 2027/2028' });
  const r6 = M({ aksi: 'dataSekolah' }).rombel.find((r) => r.kelas === 6).id;
  nilaiMtk(6, r6, 1, [70, 71], [70, 70]);
  nilaiMtk(6, r6, 2, [85, 85], [70, 70]);
  return { g, M, id, r6 };
}

test('nilai otomatis: kelas 5 dari arsip tahun lalu, kelas 6 tahun ini; rata-rata dua desimal', () => {
  const { M, id } = siapLulus();
  const d = M({ aksi: 'lulusData' });
  assert.equal(d.tahunAjaran, '2027/2028');
  assert.deepEqual(d.mapel.map((m) => m.kode), ['PAB', 'PP', 'BIND', 'MTK', 'IPAS', 'PJOK', 'SENI', 'MULOK1']);
  const ani = d.siswa.find((s) => s.id === id.ANI);
  assert.deepEqual(ani.nilai.MTK.auto, { '5-1': 80, '5-2': 90, '6-1': 71, '6-2': 85 }, '6-1: (70+71)/2 = 70,5 → nilai rapor tercetak 71');
  assert.equal(ani.nilai.MTK.akhir, 81.5);
  assert.equal(ani.nilai.PP.akhir, null);
  assert.equal(ani.rata, null, 'rata-rata baru ada bila semua mapel bernilai');
  assert.equal(ani.namaAgama, 'Pendidikan Agama Islam dan Budi Pekerti');
  assert.equal(d.siswa.find((s) => s.id === id.BUDI).namaAgama, 'Pendidikan Agama Katolik dan Budi Pekerti');
  assert.equal(ani.ttl, 'Kendal, 15 Maret 2015');
  assert.match(ani.peringatan.join(' '), /Keputusan kelulusan belum diisi/);
  assert.match(ani.peringatan.join(' '), /Pendidikan Pancasila: nilai kelas 5 smt 1 belum ada/);
  assert.match(d.masalahUmum.join(' '), /Nomor transkrip pertama belum diisi/);
});

test('praktik dan isian manual ikut dirata-rata; manual menimpa nilai aplikasi; kosong kembali ke aplikasi', () => {
  const { M, id } = siapLulus();
  const semua = (v) => ({ '5-1': v, '5-2': v, '6-1': v, '6-2': v, PRAKTIK: '' });
  const nilai = { PAB: semua('80'), PP: semua('82'), BIND: semua('84'), MTK: { PRAKTIK: '88' }, IPAS: semua('86'), PJOK: semua('90'), SENI: semua('85,5'), MULOK1: semua('83') };
  let h = M({ aksi: 'simpanLulus', isian: { [id.ANI]: { ijazah: 'DN-03/D-SD/0001234', nilai } } });
  let ani = h.siswa.find((s) => s.id === id.ANI);
  assert.equal(ani.nilai.MTK.akhir, 82.8, '(80+90+71+85+88)/5');
  assert.equal(ani.nilai.SENI.akhir, 85.5);
  assert.equal(ani.ijazah, 'DN-03/D-SD/0001234');
  assert.equal(ani.rata, Math.round(((80 + 82 + 84 + 82.8 + 86 + 90 + 85.5 + 83) / 8) * 100) / 100);
  assert.equal(ani.jumlah, 673.3);
  // menimpa nilai aplikasi, lalu dikosongkan lagi
  h = M({ aksi: 'simpanLulus', isian: { [id.ANI]: { nilai: { MTK: { '5-1': '60', PRAKTIK: '88' } } } } });
  ani = h.siswa.find((s) => s.id === id.ANI);
  assert.equal(ani.nilai.MTK.manual['5-1'], 60);
  assert.equal(ani.nilai.MTK.akhir, 78.8);
  h = M({ aksi: 'simpanLulus', isian: { [id.ANI]: { nilai: { MTK: { '5-1': '', PRAKTIK: '88' } } } } });
  assert.equal(h.siswa.find((s) => s.id === id.ANI).nilai.MTK.akhir, 82.8);
  assert.equal(h.siswa.find((s) => s.id === id.ANI).ijazah, 'DN-03/D-SD/0001234', 'nomor ijazah tidak tersentuh');
});

test('isian salah ditolak; nomor transkrip/SKL berurutan, tidak lulus dilewati', () => {
  const { g, M, id, r6 } = siapLulus();
  const t = g.minta({ aksi: 'simpanLulus', isian: { [id.ANI]: { nilai: { MTK: { PRAKTIK: '120' } } } } });
  assert.equal(t.ok, false);
  assert.match(t.pesan, /ANI LESTARI — Matematika \(Praktik\)/);
  assert.equal(g.minta({ aksi: 'simpanLulus', isian: { 'S-asing': {} } }).ok, false);
  M({ aksi: 'simpanAturLulus', atur: { nomorTranskrip: '400.3.11/060/SD', nomorSkl: '400.3.11/120/SD', nomorSk: '400.3.11/059/SD',
    tanggalLulus: '02/06/2028', tanggalTranskrip: '2028-06-18', kop1: 'PEMERINTAH KABUPATEN KENDAL', tempat: 'Kabupaten Kendal' } });
  let d = M({ aksi: 'lulusData' });
  assert.deepEqual(d.siswa.map((s) => s.nomorTranskrip), ['400.3.11/060/SD', '400.3.11/061/SD']);
  assert.equal(d.tanggalLulusPanjang, '2 Juni 2028');
  assert.equal(d.tanggalTranskripPanjang, '18 Juni 2028');
  M({ aksi: 'simpanKenaikan', rombel: r6, semester: 2, kenaikan: { [id.ANI]: 'tinggal', [id.BUDI]: 'naik' } });
  d = M({ aksi: 'lulusData' });
  const ani = d.siswa.find((s) => s.id === id.ANI), budi = d.siswa.find((s) => s.id === id.BUDI);
  assert.equal(ani.status, 'TIDAK LULUS');
  assert.equal(ani.nomorTranskrip, undefined);
  assert.equal(budi.status, 'LULUS');
  assert.equal(budi.nomorTranskrip, '400.3.11/060/SD');
  assert.equal(budi.nomorSkl, '400.3.11/120/SD');
});

test('pengaturan: logo divalidasi, mapel tambahan hanya bila dicentang dan diajarkan', () => {
  const { g, M } = siapLulus();
  assert.match(g.minta({ aksi: 'simpanAturLulus', atur: { logoSekolah: 'bukan gambar' } }).pesan, /harus gambar PNG atau JPG/);
  assert.match(g.minta({ aksi: 'simpanAturLulus', atur: { logoSekolah: 'data:image/png;base64,' + 'A'.repeat(50000) } }).pesan, /terlalu besar/);
  assert.match(g.minta({ aksi: 'simpanAturLulus', atur: { tanggalLulus: '31/02/2028' } }).pesan, /tidak valid/);
  assert.match(g.minta({ aksi: 'simpanAturLulus', atur: { nomorTranskrip: 'tanpa angka' } }).pesan, /angka urut/);
  M({ aksi: 'simpanAturLulus', atur: { logoSekolah: 'data:image/png;base64,iVBORw0KGgo=', mapelTambahan: ['BING', 'KKA', 'XYZ'] } });
  const d = M({ aksi: 'lulusData' });
  assert.equal(d.atur.logoSekolah, 'data:image/png;base64,iVBORw0KGgo=');
  assert.deepEqual(d.mapel.map((m) => m.kode), ['PAB', 'PP', 'BIND', 'MTK', 'IPAS', 'PJOK', 'SENI', 'BING', 'MULOK1'], 'KKA tidak diajarkan di kelas 6 → tidak muncul');
  assert.deepEqual(d.mapelPilihan.map((m) => m.kode), ['BING']);
  // logo berlaku lintas tahun (Tahun Ajaran "*")
  assert.ok(g.isi('Kelulusan').some((r) => r[0] === '*' && r[2] === 'logoSekolah'));
});
