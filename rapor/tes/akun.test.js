// Uji alur akun sekolah dan pembuatan spreadsheet, memakai tiruan Apps Script di memori.
// Jalankan dari akar repo: node --test rapor/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buatGas } = require('./tiruan-gas.js');

const DATA = { npsn: '20321653', nama: 'SD N BUGANGIN', email: 'sdnbugangin@gmail.com', sandi: 'rapor2026', ulangi: 'rapor2026', setuju: true, kabupaten: 'Kab. Kendal', provinsi: 'Jawa Tengah' };
const JAM = 3600000;

function siap() {
  const g = buatGas();
  g.ctx.siapkan();
  g.minta = (req) => JSON.parse(JSON.stringify(g.ctx.layani_(req)));
  g.tokenDari = (jenis) => {
    const isi = g.surat[g.surat.length - 1].htmlBody;
    return isi.match(new RegExp('\\?' + jenis + '=([0-9a-f]+)'))[1];
  };
  g.barisSekolah = () => g.pusat.getSheetByName('Sekolah').data.slice(1);
  return g;
}

function aktif(g, data = DATA) {
  assert.equal(g.minta({ aksi: 'daftar', data }).ok, true);
  assert.equal(g.minta({ aksi: 'verifikasi', token: g.tokenDari('verifikasi') }).ok, true);
}

test('siapkan aman dijalankan berulang', () => {
  const g = siap();
  g.ctx.siapkan();
  assert.equal(g.pusat.getSheetByName('Pengaturan').data.length, 12);
  assert.equal(g.pusat.sheets.length, 4);
  assert.equal(Object.keys(g.folder).length, 2, 'tidak ada folder dobel');
});

/** Nama-nama folder dari akar sampai folder berkas, mis. "Rapor SD/Data Sekolah". */
function jalur(g, id) {
  const nama = [];
  for (let f = g.lokasi[id] || id; f && f !== 'akar'; f = g.folder[f].induk) nama.unshift(g.folder[f].nama);
  return nama.join('/');
}

test('Drive rapi: semua hasil di dalam satu folder utama "Rapor SD"', () => {
  const g = siap();
  assert.deepEqual(g.isiAkar(), ['📁 Rapor SD']);
  assert.equal(jalur(g, 'pusat'), 'Rapor SD');
  aktif(g);
  aktif(g, { ...DATA, npsn: '20321654', email: 'sekolah.lain@gmail.com' });
  for (const id of Object.keys(g.berkas)) assert.equal(jalur(g, id), 'Rapor SD/Data Sekolah');
  assert.deepEqual(g.isiAkar(), ['📁 Rapor SD']);
});

test('Drive rapi: folder lama di luar folder utama dipindah masuk', () => {
  const g = buatGas();
  const lama = g.DriveApp.createFolder('Rapor SD - Data Sekolah');
  g.ctx.siapkan(); // pertama kali: belum ada pengaturan folder
  g.ctx.tulisPengaturanPusat_('Folder Data Sekolah', lama.getId()); // meniru pemasangan versi lama
  g.ctx.siapkan();
  assert.equal(jalur(g, lama.getId()), 'Rapor SD/Rapor SD - Data Sekolah');
});

test('Drive rapi: folder yang terhapus dibuat ulang di dalam folder utama', () => {
  const g = siap();
  const idData = Object.keys(g.folder).find((id) => g.folder[id].nama === 'Data Sekolah');
  g.folder[idData].sampah = true;
  aktif(g);
  const id = Object.keys(g.berkas)[0];
  assert.equal(jalur(g, id), 'Rapor SD/Data Sekolah');
  assert.notEqual(g.lokasi[id], idData);

  const idUtama = Object.keys(g.folder).find((x) => g.folder[x].nama === 'Rapor SD');
  g.folder[idUtama].sampah = true;
  aktif(g, { ...DATA, npsn: '20321654', email: 'sekolah.lain@gmail.com' });
  const baru = Object.keys(g.berkas)[1];
  assert.equal(jalur(g, baru), 'Rapor SD/Data Sekolah');
});

test('Drive rapi: spreadsheet yang gagal dipindah langsung dibuang, akun tetap menunggu', () => {
  const g = siap();
  g.minta({ aksi: 'daftar', data: DATA });
  const token = g.tokenDari('verifikasi');
  g.DriveApp.gagalPindah = true;
  const h = g.minta({ aksi: 'verifikasi', token });
  assert.equal(h.ok, false);
  assert.equal(g.berkas.ss1.sampah, true);
  assert.deepEqual(g.isiAkar(), ['📁 Rapor SD']);
  assert.equal(g.barisSekolah()[0][5], 'Menunggu verifikasi');
  g.DriveApp.gagalPindah = false;
  assert.equal(g.minta({ aksi: 'verifikasi', token }).ok, true, 'bisa dicoba lagi dengan tautan yang sama');
});

test('daftar: isian salah ditolak dengan pesan yang jelas', () => {
  const g = siap();
  const coba = (ubah) => g.minta({ aksi: 'daftar', data: { ...DATA, ...ubah } });
  assert.match(coba({ npsn: '1234' }).pesan, /NPSN harus 8/);
  assert.match(coba({ nama: 'SD' }).pesan, /Nama sekolah/);
  assert.match(coba({ email: 'bukan-email' }).pesan, /email tidak valid/);
  assert.match(coba({ sandi: 'pendek', ulangi: 'pendek' }).pesan, /minimal 8/);
  assert.match(coba({ sandi: '12345678', ulangi: '12345678' }).pesan, /hanya angka/);
  assert.match(coba({ sandi: 'Rapor2026', ulangi: 'rapor2026' }).pesan, /tidak sama/);
  assert.match(coba({ npsn: 'P9998877', sandi: 'p9998877', ulangi: 'p9998877' }).pesan, /jangan sama dengan NPSN/);
  assert.match(coba({ setuju: false }).pesan, /persetujuan/);
  assert.equal(g.barisSekolah().length, 0);
  assert.equal(g.surat.length, 0);
});

test('daftar: tersimpan tanpa kata sandi asli, email aktivasi terkirim', () => {
  const g = siap();
  const h = g.minta({ aksi: 'daftar', data: { ...DATA, email: '  SDNBugangin@Gmail.com ' } });
  assert.equal(h.ok, true);
  const [baris] = g.barisSekolah();
  assert.equal(baris[0], '20321653');
  assert.equal(baris[2], 'sdnbugangin@gmail.com');
  assert.equal(baris[5], 'Menunggu verifikasi');
  assert.match(baris[3], /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(g.pusat.sheets.map((s) => s.data)).includes('rapor2026'), 'kata sandi asli tidak boleh tersimpan');
  assert.equal(g.surat.length, 1);
  assert.equal(g.surat[0].to, 'sdnbugangin@gmail.com');
  const token = g.tokenDari('verifikasi');
  assert.ok(!JSON.stringify(g.pusat.getSheetByName('Token').data).includes(token), 'token asli tidak boleh tersimpan');
});

test('daftar: NPSN atau email yang sudah dipakai ditolak', () => {
  const g = siap();
  g.minta({ aksi: 'daftar', data: DATA });
  assert.match(g.minta({ aksi: 'daftar', data: DATA }).pesan, /menunggu verifikasi/);
  assert.match(g.minta({ aksi: 'daftar', data: { ...DATA, npsn: '20321654' } }).pesan, /Email ini sudah dipakai/);
  g.minta({ aksi: 'verifikasi', token: g.tokenDari('verifikasi') });
  assert.match(g.minta({ aksi: 'daftar', data: { ...DATA, email: 'lain@gmail.com' } }).pesan, /sudah terdaftar/);
});

test('daftar: pendaftaran yang tidak diverifikasi 48 jam boleh ditimpa, tautan lamanya mati', () => {
  const g = siap();
  g.minta({ aksi: 'daftar', data: { ...DATA, email: 'salah.ketik@gmail.com' } });
  const tokenLama = g.tokenDari('verifikasi');
  g.jam.sekarang += 49 * JAM;
  assert.equal(g.minta({ aksi: 'daftar', data: DATA }).ok, true);
  assert.equal(g.barisSekolah().length, 1);
  assert.equal(g.barisSekolah()[0][2], 'sdnbugangin@gmail.com');
  assert.equal(g.minta({ aksi: 'verifikasi', token: tokenLama }).ok, false);
  assert.equal(g.minta({ aksi: 'verifikasi', token: g.tokenDari('verifikasi') }).ok, true);
});

test('daftar: email pendaftaran kedaluwarsa bisa dipakai sekolah lain', () => {
  const g = siap();
  g.minta({ aksi: 'daftar', data: { ...DATA, npsn: '11111111' } });
  g.minta({ aksi: 'daftar', data: { ...DATA, npsn: '22222222', email: 'b@gmail.com' } });
  g.jam.sekarang += 49 * JAM;
  assert.equal(g.minta({ aksi: 'daftar', data: DATA }).ok, true);
  assert.deepEqual(g.barisSekolah().map((r) => r[0]), ['22222222', '20321653']);
});

test('daftar: ditutup oleh pengelola, atau kuota email habis', () => {
  const g = siap();
  g.MailApp.kuota = 0;
  assert.match(g.minta({ aksi: 'daftar', data: DATA }).pesan, /Kuota email/);
  g.ctx.tulisPengaturanPusat_('Pendaftaran Dibuka', 'Tidak');
  assert.match(g.minta({ aksi: 'daftar', data: DATA }).pesan, /ditutup/);
});

test('verifikasi: spreadsheet sekolah dibuat lengkap di folder data sekolah', () => {
  const g = siap();
  g.minta({ aksi: 'daftar', data: DATA });
  assert.match(g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi }).pesan, /belum aktif/);
  const h = g.minta({ aksi: 'verifikasi', token: g.tokenDari('verifikasi') });
  assert.equal(h.ok, true);

  const [baris] = g.barisSekolah();
  assert.equal(baris[5], 'Aktif');
  const b = g.berkas[baris[6]];
  assert.equal(jalur(g, baris[6]), 'Rapor SD/Data Sekolah');
  assert.equal(b.ss.getName(), 'Rapor - SD N BUGANGIN (20321653)');
  const nama = b.ss.getSheets().map((s) => s.nama);
  assert.deepEqual(nama, JSON.parse(JSON.stringify(g.ctx.STRUKTUR_SEKOLAH.map((s) => s.nama))));

  const nilai = (sheet, kunci) => b.ss.getSheetByName(sheet).data.find((r) => r[0] === kunci)[1];
  assert.equal(nilai('Profil Sekolah', 'NPSN'), '20321653');
  assert.equal(nilai('Pengaturan', 'Tahun Ajaran'), '2026/2027');
  assert.equal(Number(nilai('Pengaturan', 'Semester')), 1);
  assert.equal(b.ss.getSheetByName('KKTP').data.length, 5);
  assert.equal(b.ss.getSheetByName('Master Narasi').data.length, 76);

  const mapel = b.ss.getSheetByName('Mapel Aktif').data.slice(1);
  const aktifKelas = (k) => mapel.filter((r) => r[1] === k && r[6] === 'Ya').map((r) => r[2]);
  assert.ok(!aktifKelas(1).includes('IPAS'));
  assert.ok(aktifKelas(4).includes('IPAS'));
  assert.ok(mapel.some((r) => r[1] === 6 && r[2] === 'KKA' && r[6] === 'Tidak'));
});

test('verifikasi: klik ganda tidak membuat spreadsheet kedua', () => {
  const g = siap();
  g.minta({ aksi: 'daftar', data: DATA });
  const token = g.tokenDari('verifikasi');
  g.minta({ aksi: 'verifikasi', token });
  const h = g.minta({ aksi: 'verifikasi', token });
  assert.equal(h.sudahAktif, true);
  assert.equal(Object.keys(g.berkas).length, 1);
});

test('verifikasi: tautan salah atau kedaluwarsa ditolak', () => {
  const g = siap();
  assert.equal(g.minta({ aksi: 'verifikasi', token: 'abc' }).ok, false);
  assert.equal(g.minta({ aksi: 'verifikasi', token: 'f'.repeat(64) }).ok, false);
  g.minta({ aksi: 'daftar', data: DATA });
  g.jam.sekarang += 49 * JAM;
  assert.match(g.minta({ aksi: 'verifikasi', token: g.tokenDari('verifikasi') }).pesan, /kedaluwarsa/);
  assert.equal(Object.keys(g.berkas).length, 0);
});

test('kolom identitas tetap teks: NISN berawalan nol tidak hilang', () => {
  const g = siap();
  aktif(g);
  const ss = g.berkas[g.barisSekolah()[0][6]].ss;
  const siswa = ss.getSheetByName('Siswa');
  siswa.getRange(2, 3).setValue('0012345678');
  siswa.getRange(2, 1).setValue('0001');
  assert.equal(siswa.data[1][2], '0012345678');
  assert.equal(siswa.data[1][0], '0001');
});

test('masuk: berhasil, sesi berlaku, email tidak peka huruf besar', () => {
  const g = siap();
  aktif(g);
  const h = g.minta({ aksi: 'masuk', email: ' SDNBUGANGIN@gmail.com', sandi: DATA.sandi });
  assert.equal(h.ok, true);
  assert.equal(h.sekolah.npsn, '20321653');
  assert.equal(h.sekolah.email, 'sdnbugangin@gmail.com');
  assert.equal(h.sekolah.hash, undefined);
  const s = g.minta({ aksi: 'sesi', sesi: h.sesi });
  assert.equal(s.ok, true);
  assert.equal(s.sekolah.nama, 'SD N BUGANGIN');
  assert.ok(![...g.cache.keys()].some((k) => k.includes(h.sesi)), 'token sesi asli tidak boleh jadi kunci cache');
});

test('masuk: salah 5 kali dikunci 15 menit, lalu bisa lagi', () => {
  const g = siap();
  aktif(g);
  for (let i = 0; i < 5; i++) assert.equal(g.minta({ aksi: 'masuk', email: DATA.email, sandi: 'salah' + i }).pesan, 'Email atau kata sandi salah.');
  assert.match(g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi }).pesan, /dikunci sementara/);
  g.jam.sekarang += 16 * 60000;
  assert.equal(g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi }).ok, true);
});

test('masuk: email tidak terdaftar memberi pesan yang sama dengan sandi salah', () => {
  const g = siap();
  aktif(g);
  assert.equal(g.minta({ aksi: 'masuk', email: 'tidak.ada@gmail.com', sandi: 'apa saja' }).pesan, 'Email atau kata sandi salah.');
  assert.equal(g.minta({ aksi: 'masuk', email: '', sandi: '' }).ok, false);
});

test('sesi: berakhir setelah 6 jam tidak dipakai, diperpanjang jika dipakai', () => {
  const g = siap();
  aktif(g);
  const { sesi } = g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi });
  g.jam.sekarang += 5 * JAM;
  assert.equal(g.minta({ aksi: 'sesi', sesi }).ok, true);
  g.jam.sekarang += 5 * JAM;
  assert.equal(g.minta({ aksi: 'sesi', sesi }).ok, true);
  g.jam.sekarang += 7 * JAM;
  assert.equal(g.minta({ aksi: 'sesi', sesi }).sesiHabis, true);
});

test('keluar: sesi tidak berlaku lagi', () => {
  const g = siap();
  aktif(g);
  const { sesi } = g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi });
  assert.equal(g.minta({ aksi: 'keluar', sesi }).ok, true);
  assert.equal(g.minta({ aksi: 'sesi', sesi }).sesiHabis, true);
});

test('ganti sandi: perangkat lain otomatis keluar, perangkat ini tetap masuk', () => {
  const g = siap();
  aktif(g);
  const hp = g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi }).sesi;
  const laptop = g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi }).sesi;
  assert.match(g.minta({ aksi: 'gantiSandi', sesi: laptop, lama: 'keliru', baru: 'baru2026x', ulangi: 'baru2026x' }).pesan, /lama salah/);
  assert.match(g.minta({ aksi: 'gantiSandi', sesi: laptop, lama: DATA.sandi, baru: DATA.sandi, ulangi: DATA.sandi }).pesan, /berbeda/);
  const h = g.minta({ aksi: 'gantiSandi', sesi: laptop, lama: DATA.sandi, baru: 'baru2026x', ulangi: 'baru2026x' });
  assert.equal(h.ok, true);
  assert.equal(g.minta({ aksi: 'sesi', sesi: hp }).sesiHabis, true);
  assert.equal(g.minta({ aksi: 'sesi', sesi: laptop }).sesiHabis, true);
  assert.equal(g.minta({ aksi: 'sesi', sesi: h.sesi }).ok, true);
  assert.equal(g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi }).ok, false);
  assert.equal(g.minta({ aksi: 'masuk', email: DATA.email, sandi: 'baru2026x' }).ok, true);
});

test('lupa sandi: email tak terdaftar tidak bisa ditebak, tautan reset sekali pakai', () => {
  const g = siap();
  aktif(g);
  const surat = g.surat.length;
  const tidakAda = g.minta({ aksi: 'lupaSandi', email: 'tidak.ada@gmail.com' });
  const ada = g.minta({ aksi: 'lupaSandi', email: DATA.email });
  assert.equal(tidakAda.pesan, ada.pesan);
  assert.equal(g.surat.length, surat + 1);

  const token = g.tokenDari('reset');
  assert.match(g.minta({ aksi: 'resetSandi', token, sandi: 'pendek', ulangi: 'pendek' }).pesan, /minimal 8/);
  assert.equal(g.minta({ aksi: 'resetSandi', token, sandi: 'sandiBaru1', ulangi: 'sandiBaru1' }).ok, true);
  assert.equal(g.minta({ aksi: 'resetSandi', token, sandi: 'sandiBaru2', ulangi: 'sandiBaru2' }).ok, false);
  assert.equal(g.minta({ aksi: 'masuk', email: DATA.email, sandi: 'sandiBaru1' }).ok, true);
});

test('lupa sandi: tautan lama mati saat minta baru, dan kedaluwarsa setelah 1 jam', () => {
  const g = siap();
  aktif(g);
  g.minta({ aksi: 'lupaSandi', email: DATA.email });
  const lama = g.tokenDari('reset');
  g.minta({ aksi: 'lupaSandi', email: DATA.email });
  const baru = g.tokenDari('reset');
  assert.equal(g.minta({ aksi: 'resetSandi', token: lama, sandi: 'sandiBaru1', ulangi: 'sandiBaru1' }).ok, false);
  g.jam.sekarang += 2 * JAM;
  assert.equal(g.minta({ aksi: 'resetSandi', token: baru, sandi: 'sandiBaru1', ulangi: 'sandiBaru1' }).ok, false);
});

test('reset sandi membuka kunci akun yang terkunci', () => {
  const g = siap();
  aktif(g);
  for (let i = 0; i < 5; i++) g.minta({ aksi: 'masuk', email: DATA.email, sandi: 'salah' });
  g.minta({ aksi: 'lupaSandi', email: DATA.email });
  g.minta({ aksi: 'resetSandi', token: g.tokenDari('reset'), sandi: 'sandiBaru1', ulangi: 'sandiBaru1' });
  assert.equal(g.minta({ aksi: 'masuk', email: DATA.email, sandi: 'sandiBaru1' }).ok, true);
});

test('akun dinonaktifkan pengelola: tidak bisa masuk, sesi lama putus', () => {
  const g = siap();
  aktif(g);
  const { sesi } = g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi });
  g.pusat.getSheetByName('Sekolah').data[1][5] = 'Nonaktif';
  const putus = g.minta({ aksi: 'sesi', sesi });
  assert.equal(putus.sesiHabis, true);
  assert.equal(putus.ditutup, true);
  assert.match(putus.pesan, /sudah ditutup.*hubungi pengembang: Yos Putra Kurniawan, S\.Pd\. \(WhatsApp 0822-2004-4779\)/);
  assert.equal(g.minta({ aksi: 'sesi', sesi }).ditutup, undefined, 'sesi sudah dibuang');
  const m = g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi });
  assert.equal(m.ditutup, true);
  assert.match(m.pesan, /sudah ditutup/);
});

test('kode akses: wajib untuk cekKode/masuk/daftar/lupa sandi bila diisi; sesi yang sudah ada tidak terganggu', () => {
  const g = siap();
  aktif(g);
  const { sesi } = g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi });
  assert.equal(g.minta({ aksi: 'info' }).kodeAkses, false);
  g.ctx.tulisPengaturanPusat_('Kode Akses', 'sdsuper');
  assert.equal(g.minta({ aksi: 'info' }).kodeAkses, true);
  assert.equal(g.minta({ aksi: 'cekKode' }).kodeSalah, true);
  assert.match(g.minta({ aksi: 'cekKode', kodeAkses: 'salah' }).pesan, /Kode akses salah/);
  assert.equal(g.minta({ aksi: 'cekKode', kodeAkses: ' SDSuper ' }).ok, true, 'tidak peka huruf besar dan spasi');
  assert.equal(g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi }).kodeSalah, true);
  assert.equal(g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi, kodeAkses: 'sdsuper' }).ok, true);
  assert.equal(g.minta({ aksi: 'lupaSandi', email: DATA.email }).kodeSalah, true);
  assert.equal(g.minta({ aksi: 'sesi', sesi }).ok, true, 'guru yang sudah masuk tetap bisa bekerja');
  assert.equal(g.minta({ aksi: 'statistik' }).ok, true);
});

test('permintaan aneh dan galat server tidak membocorkan detail', () => {
  const g = siap();
  assert.equal(g.minta({ aksi: 'sesi' }).sesiHabis, true);
  assert.equal(g.minta({ aksi: 'hapusSemua', sesi: 'x'.repeat(64) }).sesiHabis, true);
  assert.equal(g.ctx.doPost({ postData: { contents: '{bukan json' } }).isi.ok, false);
  assert.equal(g.ctx.doPost({ postData: { contents: 'null' } }).isi.ok, false);

  aktif(g);
  const { sesi } = g.minta({ aksi: 'masuk', email: DATA.email, sandi: DATA.sandi });
  assert.equal(g.minta({ aksi: 'hapusSemua', sesi }).pesan, 'Aksi tidak dikenal.');
  g.pusat.deleteSheet(g.pusat.getSheetByName('Token'));
  const h = g.minta({ aksi: 'lupaSandi', email: DATA.email });
  assert.equal(h.pesan, 'Terjadi kesalahan di server. Coba lagi beberapa saat lagi.');
  assert.match(g.pusat.getSheetByName('Log').data.at(-1)[3], /^lupaSandi:/);
});

test('tahun ajaran dan semester dari tanggal', () => {
  const g = siap();
  const ta = (s) => JSON.parse(JSON.stringify(g.ctx.tahunAjaran_(s)));
  assert.deepEqual(ta('2026-07-01T00:00:00'), { tahunAjaran: '2026/2027', semester: 1 });
  assert.deepEqual(ta('2026-12-31T00:00:00'), { tahunAjaran: '2026/2027', semester: 1 });
  assert.deepEqual(ta('2027-01-02T00:00:00'), { tahunAjaran: '2026/2027', semester: 2 });
  assert.deepEqual(ta('2027-06-30T00:00:00'), { tahunAjaran: '2026/2027', semester: 2 });
});

test('wilayah sekolah: nama baku kabupaten/kota dan provinsi, wajib saat daftar', () => {
  const g = siap();
  assert.equal(g.ctx.kabupatenBaku_('kab.  kendal'), 'Kabupaten Kendal');
  assert.equal(g.ctx.kabupatenBaku_('KENDAL'), 'Kabupaten Kendal');
  assert.equal(g.ctx.kabupatenBaku_('kota semarang'), 'Kota Semarang');
  assert.equal(g.ctx.kabupatenBaku_('Kabupaten'), '');
  assert.equal(g.ctx.provinsiBaku_('jawa tengah'), 'Jawa Tengah');
  assert.equal(g.ctx.provinsiBaku_('Provinsi DIY'), 'DI Yogyakarta');
  assert.equal(g.ctx.provinsiBaku_('Narnia'), '');
  assert.match(g.minta({ aksi: 'daftar', data: { ...DATA, kabupaten: '' } }).pesan, /Kabupaten\/kota wajib/);
  assert.match(g.minta({ aksi: 'daftar', data: { ...DATA, provinsi: 'Narnia' } }).pesan, /Pilih provinsi/);
  aktif(g);
  const baris = g.barisSekolah()[0];
  assert.deepEqual([baris[12], baris[13]], ['Kabupaten Kendal', 'Jawa Tengah']);
});

test('statistik terbuka: jumlah sekolah aktif per provinsi dan kabupaten, tanpa nama sekolah', () => {
  const g = siap();
  aktif(g);
  aktif(g, { ...DATA, npsn: '20300001', email: 'b@gmail.com', kabupaten: 'Kendal' });
  aktif(g, { ...DATA, npsn: '20300002', email: 'c@gmail.com', kabupaten: 'Kota Semarang' });
  aktif(g, { ...DATA, npsn: '20300003', email: 'd@gmail.com', kabupaten: 'Sleman', provinsi: 'DI Yogyakarta' });
  g.minta({ aksi: 'daftar', data: { ...DATA, npsn: '20300004', email: 'e@gmail.com' } }); // belum verifikasi: tidak dihitung
  const h = g.minta({ aksi: 'statistik' });
  assert.equal(h.ok, true);
  assert.deepEqual([h.sekolah, h.kabupaten, h.provinsi], [4, 3, 2]);
  assert.deepEqual(h.rincian[0], { provinsi: 'Jawa Tengah', sekolah: 3,
    kabupaten: [{ nama: 'Kabupaten Kendal', sekolah: 2 }, { nama: 'Kota Semarang', sekolah: 1 }] });
  assert.doesNotMatch(JSON.stringify(h), /BUGANGIN|@/);
});

test('statistik ikut profil: kabupaten/provinsi yang diubah di Data Sekolah tersalin ke Pusat', () => {
  const { sekolahAktif } = require('./tiruan-gas.js');
  const s = sekolahAktif();
  assert.equal(s.minta({ aksi: 'statistik' }).rincian[0].kabupaten[0].nama, 'Kabupaten Kendal');
  assert.equal(s.minta({ aksi: 'simpanProfil', profil: { 'Kabupaten/Kota': 'Kota Pekalongan', Provinsi: 'Jawa Tengah' } }).ok, true);
  const baris = s.pusat.getSheetByName('Sekolah').data.find((r) => r[0] === '20321653');
  assert.equal(baris[12], 'Kota Pekalongan');
  assert.equal(s.minta({ aksi: 'statistik' }).rincian[0].kabupaten[0].nama, 'Kota Pekalongan', 'cache dibuang saat wilayah berubah');
});

test('mode pemeliharaan: hanya aksi baca yang dilayani; pengumuman lewat aksi info', () => {
  const { sekolahAktif } = require('./tiruan-gas.js');
  const s = sekolahAktif();
  assert.deepEqual(s.minta({ aksi: 'info' }), { ok: true, pemeliharaan: false, pesanPemeliharaan: '', pengumuman: '', kodeAkses: false, daftarDibuka: true });
  s.ctx.tulisPengaturanPusat_('Pengumuman', 'Fitur baru: Transkrip & SKL kelas 6.');
  s.ctx.tulisPengaturanPusat_('Mode Pemeliharaan', 'Ya');
  const i = s.minta({ aksi: 'info' });
  assert.equal(i.pemeliharaan, true);
  assert.match(i.pesanPemeliharaan, /pemeliharaan/);
  assert.equal(i.pengumuman, 'Fitur baru: Transkrip & SKL kelas 6.');
  const simpan = s.minta({ aksi: 'simpanProfil', profil: { Kecamatan: 'Kendal' } });
  assert.equal(simpan.ok, false);
  assert.equal(simpan.pemeliharaan, true);
  assert.equal(s.minta({ aksi: 'dataSekolah' }).ok, true, 'membaca tetap bisa');
  assert.equal(s.minta({ aksi: 'daftar', data: {} }).pemeliharaan, true, 'pendaftaran juga ditahan');
  s.ctx.tulisPengaturanPusat_('Pesan Pemeliharaan', 'Pembaruan sampai pukul 21.00 WIB.');
  assert.equal(s.minta({ aksi: 'simpanProfil', profil: {} }).pesan, 'Pembaruan sampai pukul 21.00 WIB.');
  s.ctx.tulisPengaturanPusat_('Mode Pemeliharaan', 'Tidak');
  assert.equal(s.minta({ aksi: 'simpanProfil', profil: { Kecamatan: 'Kendal' } }).ok, true);
});
