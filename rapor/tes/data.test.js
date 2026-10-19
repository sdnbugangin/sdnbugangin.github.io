// Uji data sekolah: profil, rombel, siswa, dan unduh Excel — memakai tiruan Apps Script di memori.
// Jalankan dari akar repo: node --test rapor/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buatGas } = require('./tiruan-gas.js');

const DATA = { npsn: '20321653', nama: 'SD N BUGANGIN', email: 'sdnbugangin@gmail.com', sandi: 'rapor2026', ulangi: 'rapor2026', setuju: true };
const salin = (x) => JSON.parse(JSON.stringify(x));

/** Sekolah aktif yang sudah masuk. g.minta otomatis membawa sesi. */
function sekolahAktif() {
  const g = buatGas();
  g.ctx.siapkan();
  const panggil = (req) => salin(g.ctx.layani_(req));
  panggil({ aksi: 'daftar', data: DATA });
  const token = g.surat.at(-1).htmlBody.match(/\?verifikasi=([0-9a-f]+)/)[1];
  panggil({ aksi: 'verifikasi', token });
  const { sesi } = panggil({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi });
  g.minta = (req) => panggil({ sesi, ...req });
  g.ss = Object.values(g.berkas)[0].ss;
  g.isi = (nama) => g.ss.getSheetByName(nama).data.slice(1).filter((r) => r.some((x) => x !== '' && x !== undefined));
  return g;
}

function rombel(g, kelas, nama, wali = '') {
  const h = g.minta({ aksi: 'simpanRombel', rombel: { kelas, nama, wali } });
  assert.equal(h.ok, true, h.pesan);
  return h.rombel.id;
}

const SISWA = [
  { nama: 'ANI LESTARI', nisn: '0012345678', nis: '1001', jk: 'Perempuan', agama: 'Islam', seni: 'musik', tanggalLahir: '15/03/2016' },
  { nama: 'budi santoso', panggilan: 'Budi', nisn: '0012345679', nis: '1002', jk: 'L', agama: 'Budha', seni: 'Seni Rupa', tanggalLahir: '2016-01-02' },
  { nama: 'Citra', nisn: '', nis: '1003', jk: 'p', agama: 'katolik', seni: '' }
];

/* ---------- fungsi murni ---------- */

test('normalisasiTanggal_: berbagai bentuk tanggal, tanggal mustahil ditolak', () => {
  const t = (v, a, b) => g0.ctx.normalisasiTanggal_(v, a, b);
  assert.equal(t('2016-03-15'), '2016-03-15');
  assert.equal(t('15/03/2016'), '2016-03-15');
  assert.equal(t('5-3-2016'), '2016-03-05');
  assert.equal(t('5.3.2016'), '2016-03-05');
  assert.equal(t(new Date(2016, 2, 15)), '2016-03-15');
  assert.equal(t(''), '');
  assert.equal(t(null), '');
  assert.equal(t('31/02/2016'), null);
  assert.equal(t('2016/13/01'), null);
  assert.equal(t('kemarin'), null);
  assert.equal(t('15/03/1990', 2001, 2023), null);
});
const g0 = buatGas();

test('normalisasi jenis kelamin, seni, dan nama panggilan', () => {
  const c = g0.ctx;
  assert.deepEqual(['L', 'l', 'Laki-laki', 'LAKI LAKI', 'lk'].map(c.normalisasiJk_), ['L', 'L', 'L', 'L', 'L']);
  assert.deepEqual(['P', 'perempuan', 'Pr', 'wanita'].map(c.normalisasiJk_), ['P', 'P', 'P', 'P']);
  assert.equal(c.normalisasiJk_('X'), 'X');
  const seni = ['Seni Musik', 'Seni Rupa'];
  assert.equal(c.normalisasiSeni_('musik', seni), 'Seni Musik');
  assert.equal(c.normalisasiSeni_('SENI RUPA', seni), 'Seni Rupa');
  assert.equal(c.normalisasiSeni_('Tari', seni), 'Tari');
  assert.equal(c.normalisasiSeni_('', seni), '');
  assert.equal(c.panggilanBawaan_('MUHAMMAD rizki'), 'Muhammad');
  assert.equal(c.panggilanBawaan_('  '), '');
});

test('normalisasiSiswa_: spasi dirapikan, panggilan otomatis, tanggal tidak valid dilaporkan', () => {
  const h = salin(g0.ctx.normalisasiSiswa_({ nama: '  ani   lestari ', nisn: '00123 45678', jk: 'perempuan', agama: 'Konghucu', tanggalLahir: '30/02/2016' }, ['Seni Musik'], 2026));
  assert.equal(h.siswa.nama, 'ani lestari');
  assert.equal(h.siswa.panggilan, 'Ani');
  assert.equal(h.siswa.nisn, '0012345678');
  assert.equal(h.siswa.jk, 'P');
  assert.equal(h.siswa.agama, 'Khonghucu');
  assert.match(h.salah[0], /tanggal lahir "30\/02\/2016" tidak valid/);
  assert.match(g0.ctx.normalisasiSiswa_({ nama: 'A', tanggalLahir: '01/01/1990' }, [], 2026).salah[0], /tidak valid/);
});

test('cekProfil_ dan cekRombel_ menolak isian yang salah', () => {
  const c = g0.ctx;
  const kunci = ['Nama Sekolah', 'NPSN', 'Email', 'NIP Kepala Sekolah', 'Kode Pos', 'Telepon', 'Tanggal Pembagian Rapor'];
  const p = salin(c.cekProfil_({ 'Nama Sekolah': '', 'NIP Kepala Sekolah': '1234', 'Kode Pos': '5131', Telepon: 'abc',
    'Tanggal Pembagian Rapor': '32/12/2026', NPSN: '99999999', Email: 'x@y.z', 'Kunci Asing': 'x' }, kunci));
  assert.equal(p.salah.length, 5);
  assert.equal('NPSN' in p.bersih, false);
  assert.equal('Email' in p.bersih, false);
  assert.equal('Kunci Asing' in p.bersih, false);
  const ok = salin(c.cekProfil_({ 'NIP Kepala Sekolah': '1986 0128 2009 0310 03', 'Tanggal Pembagian Rapor': '19/12/2026' }, kunci));
  assert.deepEqual(ok, { salah: [], bersih: { 'NIP Kepala Sekolah': '198601282009031003', 'Tanggal Pembagian Rapor': '2026-12-19' } });

  const lain = [{ id: 'R1', nama: '5A' }];
  assert.match(c.cekRombel_({ kelas: 5, nama: '5a' }, lain).salah[0], /sudah ada/);
  assert.equal(c.cekRombel_({ id: 'R1', kelas: 5, nama: '5a' }, lain).salah.length, 0, 'mengubah rombel sendiri boleh');
  assert.match(c.cekRombel_({ kelas: 7, nama: '7A' }, []).salah[0], /kelas 1 sampai 6/);
  // kelas dengan satu rombel cukup dikosongkan namanya; huruf saja diberi awalan nomor kelas
  assert.equal(c.cekRombel_({ kelas: 5, nama: '' }, []).rombel.nama, '5');
  assert.equal(c.cekRombel_({ kelas: 5, nama: ' b ' }, []).rombel.nama, '5B');
  assert.equal(c.cekRombel_({ kelas: 5, nama: 'Melati' }, []).rombel.nama, 'MELATI');
  assert.match(c.cekRombel_({ kelas: 5, nama: '' }, [{ id: 'R2', nama: '5' }]).salah[0], /Kelas 5 sudah punya rombel/);
  assert.match(c.cekRombel_({ kelas: 5, nama: 'a' }, [{ id: 'R1', nama: '5A' }]).salah[0], /Rombel 5A sudah ada/);
  assert.match(c.cekRombel_({ kelas: 5, nama: '5B', nip: '123' }, []).salah[0], /18 digit/);
});

/* ---------- profil ---------- */

test('dataSekolah: ringkasan awal sekolah baru', () => {
  const g = sekolahAktif();
  const h = g.minta({ aksi: 'dataSekolah' });
  assert.equal(h.ok, true);
  assert.equal(h.tahunAjaran, '2026/2027');
  assert.equal(h.semester, 1);
  assert.deepEqual(h.seni, ['Seni Musik', 'Seni Rupa', 'Seni Tari', 'Seni Teater']);
  assert.deepEqual(h.rombel, []);
  assert.equal(h.profil.find((p) => p.kunci === 'NPSN').tetap, true);
  assert.equal(h.profil.find((p) => p.kunci === 'Kepala Sekolah').tetap, false);
});

test('simpanProfil: tersimpan, NPSN/email tidak bisa diubah, semester bisa diganti', () => {
  const g = sekolahAktif();
  const salah = g.minta({ aksi: 'simpanProfil', profil: { 'NIP Kepala Sekolah': '12' } });
  assert.equal(salah.ok, false);
  const h = g.minta({ aksi: 'simpanProfil', semester: 2, profil: {
    'Kepala Sekolah': 'Yos Putra Kurniawan, S.Pd.', 'NIP Kepala Sekolah': '198601282009031003', 'Kode Pos': '51314',
    'Tanggal Pembagian Rapor': '19/12/2026', NPSN: '11111111' } });
  assert.equal(h.ok, true);
  const d = g.minta({ aksi: 'dataSekolah' });
  const nilai = (k) => d.profil.find((p) => p.kunci === k).nilai;
  assert.equal(nilai('Kepala Sekolah'), 'Yos Putra Kurniawan, S.Pd.');
  assert.equal(nilai('NIP Kepala Sekolah'), '198601282009031003', 'NIP 18 digit tetap utuh sebagai teks');
  assert.equal(nilai('Tanggal Pembagian Rapor'), '2026-12-19');
  assert.equal(nilai('NPSN'), '20321653');
  assert.equal(d.semester, 2);
  assert.equal(g.minta({ aksi: 'simpanProfil', profil: {}, semester: 3 }).ok, false);
  assert.match(g.isi('Log').at(-1)[1], /ubah profil/);
});

/* ---------- rombel ---------- */

test('rombel: tambah, urut per kelas, nama dobel ditolak, ubah wali kelas', () => {
  const g = sekolahAktif();
  rombel(g, 5, '5b');
  const id5a = rombel(g, 5, '5A', 'Meirtha Hardiana, S.Pd');
  rombel(g, 1, '1A');
  assert.match(g.minta({ aksi: 'simpanRombel', rombel: { kelas: 5, nama: '5a' } }).pesan, /sudah ada/);
  assert.deepEqual(g.minta({ aksi: 'dataSekolah' }).rombel.map((r) => r.nama), ['1A', '5A', '5B']);
  const h = g.minta({ aksi: 'simpanRombel', rombel: { id: id5a, kelas: 5, nama: '5A', wali: 'Guru Baru', nip: '199805092026062001' } });
  assert.equal(h.ok, true);
  const r = g.minta({ aksi: 'dataSekolah' }).rombel.find((x) => x.id === id5a);
  assert.equal(r.wali, 'Guru Baru');
  assert.equal(r.nip, '199805092026062001');
  assert.equal(g.isi('Rombel').length, 3);
  assert.equal(g.minta({ aksi: 'simpanRombel', rombel: { id: 'Rpalsu', kelas: 5, nama: '5C' } }).ok, false);
});

test('rombel: kelas dengan satu rombel tidak perlu nama, pesannya menyebut "Kelas 1"', () => {
  const g = sekolahAktif();
  const h = g.minta({ aksi: 'simpanRombel', rombel: { kelas: 1, nama: '' } });
  assert.equal(h.rombel.nama, '1');
  assert.equal(h.pesan, 'Rombel Kelas 1 tersimpan.');
  assert.match(g.minta({ aksi: 'simpanRombel', rombel: { kelas: 1, nama: '' } }).pesan, /Kelas 1 sudah punya rombel/);
  const s = g.minta({ aksi: 'simpanSiswa', rombel: h.rombel.id, siswa: SISWA.slice(0, 1) });
  assert.match(s.pesan, /^1 siswa Kelas 1 tersimpan/);
  const id5 = rombel(g, 5, 'b');
  assert.equal(g.minta({ aksi: 'dataSekolah' }).rombel.find((r) => r.id === id5).nama, '5B');
});

test('rombel: hanya rombel kosong yang bisa dihapus', () => {
  const g = sekolahAktif();
  const id = rombel(g, 5, '5A');
  const kosong = rombel(g, 5, '5B');
  g.minta({ aksi: 'simpanSiswa', rombel: id, siswa: SISWA.slice(0, 1) });
  assert.match(g.minta({ aksi: 'hapusRombel', id }).pesan, /masih berisi 1 siswa/);
  assert.equal(g.minta({ aksi: 'hapusRombel', id: kosong }).ok, true);
  assert.deepEqual(g.minta({ aksi: 'dataSekolah' }).rombel.map((r) => [r.nama, r.jumlah]), [['5A', 1]]);
  assert.equal(g.minta({ aksi: 'hapusRombel', id: kosong }).ok, false);
});

/* ---------- siswa ---------- */

test('simpanSiswa: isian dirapikan, ID dibuat, NISN berawalan nol tetap utuh', () => {
  const g = sekolahAktif();
  const id = rombel(g, 5, '5A');
  const h = g.minta({ aksi: 'simpanSiswa', rombel: id, siswa: SISWA });
  assert.equal(h.ok, true, JSON.stringify(h.salah));
  assert.match(h.pesan, /3 siswa 5A tersimpan.*1 siswa belum memilih seni/);

  const d = g.minta({ aksi: 'siswaRombel', rombel: id });
  assert.deepEqual(d.siswa.map((s) => s.nama), ['ANI LESTARI', 'budi santoso', 'Citra']);
  const [ani, budi, citra] = d.siswa;
  assert.match(ani.id, /^S[0-9a-f]{10}$/);
  assert.equal(ani.nisn, '0012345678');
  assert.equal(ani.jk, 'P');
  assert.equal(ani.seni, 'Seni Musik');
  assert.equal(ani.tanggalLahir, '2016-03-15');
  assert.equal(ani.panggilan, 'Ani');
  assert.equal(budi.agama, 'Buddha');
  assert.equal(budi.panggilan, 'Budi');
  assert.equal(citra.agama, 'Katolik');
  assert.equal(citra.seni, '');
  const baris = g.isi('Siswa').find((r) => r[3] === 'ANI LESTARI');
  assert.equal(baris[2], '0012345678');
  assert.equal(baris[13], 'Aktif');
  assert.equal(g.minta({ aksi: 'dataSekolah' }).rombel[0].jumlah, 3);
});

test('simpanSiswa: semua kesalahan dilaporkan sekaligus, tidak ada yang tersimpan', () => {
  const g = sekolahAktif();
  const id = rombel(g, 5, '5A');
  const h = g.minta({ aksi: 'simpanSiswa', rombel: id, siswa: [
    { nama: 'Ani', nisn: '0012345678', jk: 'P', agama: 'Islam' },
    { nama: 'Budi', nisn: '0012345678', jk: 'L', agama: 'Islam', tanggalLahir: '31/02/2016' },
    { nama: '', jk: 'L', agama: 'Islam' },
    { nama: 'Cici', jk: 'X', agama: 'Lainnya', seni: 'Seni Lukis' }
  ] });
  assert.equal(h.ok, false);
  const semua = h.salah.join('\n');
  assert.match(semua, /Baris 2 \(Budi\): tanggal lahir/);
  assert.match(semua, /NISN sama dengan baris 1/);
  assert.match(semua, /Baris 3: nama siswa kosong/);
  assert.match(semua, /jenis kelamin harus L atau P/);
  assert.match(semua, /agama "Lainnya" tidak dikenal/);
  assert.match(semua, /seni pilihan "Seni Lukis" tidak ditawarkan/);
  assert.equal(g.isi('Siswa').length, 0);
  assert.equal(g.isi('Anggota Rombel').length, 0);
});

test('simpanSiswa: NISN yang sudah dipakai di rombel lain ditolak dengan nama rombelnya', () => {
  const g = sekolahAktif();
  const a = rombel(g, 5, '5A');
  const b = rombel(g, 5, '5B');
  g.minta({ aksi: 'simpanSiswa', rombel: a, siswa: SISWA.slice(0, 1) });
  const h = g.minta({ aksi: 'simpanSiswa', rombel: b, siswa: [{ ...SISWA[0], nama: 'Ani Lain' }] });
  assert.equal(h.ok, false);
  assert.match(h.pesan, /NISN sudah dipakai ANI LESTARI di 5A/);
});

test('simpanSiswa: memindah siswa 5A → 5B dengan hapus lalu tempel ulang tidak membuat data dobel', () => {
  const g = sekolahAktif();
  const a = rombel(g, 5, '5A');
  const b = rombel(g, 5, '5B');
  g.minta({ aksi: 'simpanSiswa', rombel: a, siswa: SISWA });
  const idAni = g.minta({ aksi: 'siswaRombel', rombel: a }).siswa[0].id;
  const sisa = g.minta({ aksi: 'siswaRombel', rombel: a }).siswa.slice(1);
  assert.equal(g.minta({ aksi: 'simpanSiswa', rombel: a, siswa: sisa }).ok, true);
  const h = g.minta({ aksi: 'simpanSiswa', rombel: b, siswa: [{ ...SISWA[0], id: undefined }] });
  assert.equal(h.ok, true, h.pesan);
  assert.equal(g.minta({ aksi: 'siswaRombel', rombel: b }).siswa[0].id, idAni);
  assert.equal(g.isi('Siswa').length, 3, 'tidak ada siswa dobel');
  assert.deepEqual(g.minta({ aksi: 'dataSekolah' }).rombel.map((r) => [r.nama, r.jumlah]), [['5A', 2], ['5B', 1]]);
});

test('simpanSiswa: ID siswa rombel lain yang dikirim ke rombel ini ditolak', () => {
  const g = sekolahAktif();
  const a = rombel(g, 5, '5A');
  const b = rombel(g, 5, '5B');
  g.minta({ aksi: 'simpanSiswa', rombel: a, siswa: SISWA.slice(0, 1) });
  const ani = g.minta({ aksi: 'siswaRombel', rombel: a }).siswa[0];
  assert.match(g.minta({ aksi: 'simpanSiswa', rombel: b, siswa: [ani] }).pesan, /sudah terdaftar di 5A/);
  assert.match(g.minta({ aksi: 'simpanSiswa', rombel: b, siswa: [{ ...ani, id: 'Spalsu' }] }).pesan, /tidak ditemukan/);
});

test('simpanSiswa: mengurangi daftar mengosongkan baris sisa, urutan mengikuti daftar', () => {
  const g = sekolahAktif();
  const a = rombel(g, 5, '5A');
  g.minta({ aksi: 'simpanSiswa', rombel: a, siswa: SISWA });
  const d = g.minta({ aksi: 'siswaRombel', rombel: a }).siswa;
  g.minta({ aksi: 'simpanSiswa', rombel: a, siswa: [d[2], d[0]] });
  const baru = g.minta({ aksi: 'siswaRombel', rombel: a }).siswa;
  assert.deepEqual(baru.map((s) => s.nama), ['Citra', 'ANI LESTARI']);
  assert.equal(g.isi('Anggota Rombel').length, 2);
  assert.deepEqual(g.isi('Anggota Rombel').map((r) => r[3]), [1, 2]);
});

test('simpanSiswa: batas 100 siswa, rombel tak dikenal, dan isian bukan daftar', () => {
  const g = sekolahAktif();
  const a = rombel(g, 5, '5A');
  const banyak = Array.from({ length: 101 }, (_, i) => ({ nama: 'Siswa ' + i, jk: 'L', agama: 'Islam' }));
  assert.match(g.minta({ aksi: 'simpanSiswa', rombel: a, siswa: banyak }).pesan, /maksimal 100/);
  assert.match(g.minta({ aksi: 'simpanSiswa', rombel: 'Rpalsu', siswa: [] }).pesan, /tidak ditemukan/);
  assert.equal(g.minta({ aksi: 'simpanSiswa', rombel: a, siswa: 'bukan daftar' }).ok, false);
  assert.equal(g.minta({ aksi: 'siswaRombel', rombel: 'Rpalsu' }).ok, false);
});

test('tulisTabel_: lebih dari 1000 baris tetap aman, kolom teks tetap teks', () => {
  const g = sekolahAktif();
  const data = Array.from({ length: 1500 }, (_, i) => ({ 'ID Siswa': 'S' + i, NISN: '00' + String(i).padStart(8, '0'), 'Nama Lengkap': 'Siswa ' + i, Status: 'Aktif' }));
  g.ctx.tulisTabel_(g.ss, 'Siswa', data);
  const sh = g.ss.getSheetByName('Siswa');
  assert.ok(sh.getMaxRows() >= 1501);
  assert.equal(sh.data[1400][2], '0000001399');
  assert.equal(g.ctx.bacaTabel_(g.ss, 'Siswa').length, 1500);
});

test('sheet sekolah yang hilang memberi pesan jelas, bukan error teknis', () => {
  const g = sekolahAktif();
  g.ss.deleteSheet(g.ss.getSheetByName('Rombel'));
  assert.match(g.minta({ aksi: 'dataSekolah' }).pesan, /Sheet "Rombel" hilang/);
});

/* ---------- unduh & sesi ---------- */

test('unduhExcel: berkas xlsx spreadsheet sekolah, nama berkas rapi', () => {
  const g = sekolahAktif();
  const h = g.minta({ aksi: 'unduhExcel' });
  assert.equal(h.ok, true);
  assert.equal(h.nama, 'Rapor - SD N BUGANGIN (20321653) 2026-10-18.xlsx');
  assert.equal(Buffer.from(h.data, 'base64').toString(), 'xlsx:ss1');
});

test('aksi data wajib sesi yang sah', () => {
  const g = sekolahAktif();
  for (const aksi of ['dataSekolah', 'simpanProfil', 'simpanRombel', 'hapusRombel', 'siswaRombel', 'simpanSiswa', 'unduhExcel']) {
    assert.equal(salin(g.ctx.layani_({ aksi })).sesiHabis, true, aksi);
  }
});
