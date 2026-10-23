// Uji aplikasi IDP bersama banyak sekolah, memakai tiruan Apps Script di memori.
// Jalankan dari akar repo: node --test idp/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buatGas } = require('./tiruan-gas.js');

const SD_A = { npsn: '20321653', nama: 'SD Negeri Bugangin', wilayah: 'Korwilcambiddik Kec. Kendal', kabupaten: 'Kendal',
  namaKs: 'Yos Putra Kurniawan, S.Pd.', nipKs: '198601282009031003', pwAdmin: 'adminsdA1', pwGuru: 'guruA1' };
const SD_B = { npsn: '20321700', nama: 'SD Negeri 1 Contoh', wilayah: 'Korwilcambiddik Kec. Kendal', kabupaten: 'Kendal',
  namaKs: 'Siti Aminah, S.Pd.', nipKs: '197501012000032001', pwAdmin: 'adminsdB1', pwGuru: 'guruB1' };
const GURU = { peran: 'Guru', nama: 'Dian Yustika, S.Pd.', nip: '199807272024212009', jenjang: 'Ahli Pertama', status: 'PPPK', pendidikan: 'S1' };

function siap(opsi) {
  const g = buatGas({ pengunjung: 'pemilik@gmail.com', ...opsi });
  g.ctx.setup();
  g.ctx.setCfg_('TEMPLATE_URL', 'https://docs.google.com/spreadsheets/d/' + g.tpl.id + '/edit');
  g.sesi.aktif = '';            // selanjutnya: pengunjung Web App tanpa akun
  return g;
}

function dataLengkap() {
  return {
    identitas: { nip: GURU.nip, jabatan: 'Guru Ahli Pertama', jenjang: 'Ahli Pertama', target: 'Ahli Muda', status: 'PPPK' },
    kinerja: { tahun: 2025, predikat: 'Baik', ada: false, ket: '' },
    kualifikasi: { syarat: 'S1', pendidikan: 'S1', ada: false, ket: '' },
    manajerial: Array.from({ length: 8 }, () => ({ skor: 0, catatan: '-' })),
    teknis: Array.from({ length: 5 }, (_, i) => ({ pilih: i < 4, skor: 0, catatan: '-' })),
    sosio: [{ skor: 1, catatan: 'Perlu lebih aktif di lingkungan.' }],
    rencana: { s0: { rekomendasi: 'Aktif di komunitas belajar.', jenis: 'Non Klasikal', jalur: 'coaching', tahun: [2026] } },
    tanggal: '2026-10-23'
  };
}

test('pengunjung Web App tidak bisa menjalankan fungsi pemilik', () => {
  const g = siap();
  assert.throws(() => g.ctx.setup(), /pemilik/);
  assert.throws(() => g.ctx.cekAI(), /pemilik/);
});

test('sekolah mendaftar sendiri; password tersimpan sebagai hash; NPSN tidak boleh ganda', () => {
  const g = siap();
  const hasil = g.panggil('daftarSekolah', SD_A);
  assert.equal(hasil.npsn, SD_A.npsn);
  assert.equal(hasil.isian.ATASAN_KS_NAMA, 'SUPARDI, S.Pd., M.Pd.');   // isian awal dari pengaturan global
  const baris = JSON.stringify(g.pusat.getSheetByName('_SEKOLAH').data);
  assert.ok(!baris.includes(SD_A.pwAdmin) && !baris.includes(SD_A.pwGuru), 'password asli tidak boleh tersimpan');
  assert.ok(baris.includes('"' + SD_A.npsn + '"'), 'NPSN tersimpan sebagai teks');
  assert.throws(() => g.panggil('daftarSekolah', SD_A), /sudah terdaftar/);
  assert.throws(() => g.panggil('daftarSekolah', { ...SD_B, npsn: '123' }), /8 digit/);
  assert.throws(() => g.panggil('daftarSekolah', { ...SD_B, pwGuru: SD_B.pwAdmin }), /berbeda/);
  assert.deepEqual(g.panggil('getInit').sekolah.map((s) => s.npsn), [SD_A.npsn]);
});

test('admin sekolah: password salah ditolak dan dikunci setelah 5x', () => {
  const g = siap();
  g.panggil('daftarSekolah', SD_A);
  for (let i = 0; i < 5; i++) assert.throws(() => g.panggil('adminMasuk', SD_A.npsn, 'salah'), /Password salah/);
  assert.throws(() => g.panggil('adminMasuk', SD_A.npsn, SD_A.pwAdmin), /Terlalu banyak/);
  assert.throws(() => g.panggil('adminMasuk', SD_A.npsn, SD_A.pwGuru), /Terlalu banyak|Password salah/);
});

test('password guru tidak bisa membuka halaman admin', () => {
  const g = siap();
  g.panggil('daftarSekolah', SD_A);
  assert.throws(() => g.panggil('adminMasuk', SD_A.npsn, SD_A.pwGuru), /Password salah/);
});

test('API key diuji dulu, disimpan per sekolah, dan tidak tampil utuh', () => {
  const g = siap({ gemini: (url, k) => (k === 'KEY_SALAH_xxxxxxxxxxxxxxxxxxxxxxxxxx' ? { kode: 400, isi: { error: { message: 'API key not valid' } } } : { kode: 200, isi: { models: [] } }) });
  g.panggil('daftarSekolah', SD_A);
  assert.throws(() => g.panggil('adminTambahKunci', SD_A.npsn, SD_A.pwAdmin, 'KEY_SALAH_xxxxxxxxxxxxxxxxxxxxxxxxxx'), /ditolak/);
  assert.throws(() => g.panggil('adminTambahKunci', SD_A.npsn, SD_A.pwAdmin, 'pendek'), /Format/);
  const h = g.panggil('adminTambahKunci', SD_A.npsn, SD_A.pwAdmin, 'AQ.KunciSekolahA_1234567890abcdefghijklmn');
  assert.deepEqual(h.kunci, ['…klmn']);
  assert.match(h.info, /aktif/);
  assert.equal(g.props['KUNCI_' + SD_A.npsn], 'AQ.KunciSekolahA_1234567890abcdefghijklmn');
  assert.ok(!JSON.stringify(g.pusat.sheets.map((s) => s.data)).includes('KunciSekolahA'), 'key tidak boleh ada di sheet');
  assert.deepEqual(g.panggil('adminHapusKunci', SD_A.npsn, SD_A.pwAdmin, 0).kunci, []);
});

test('saran AI memakai key sekolah sendiri; sekolah tanpa key memakai kalimat bawaan tanpa memanggil Google', () => {
  const g = siap();
  g.panggil('daftarSekolah', SD_A);
  g.panggil('daftarSekolah', SD_B);
  g.panggil('adminTambahKunci', SD_A.npsn, SD_A.pwAdmin, 'AQ.KunciSekolahA_1234567890abcdefghijklmn');
  g.panggil('daftar', SD_A.npsn, GURU, SD_A.pwGuru);
  g.panggil('daftar', SD_B.npsn, GURU, SD_B.pwGuru);       // nama & NIP sama di sekolah lain tetap boleh
  const req = { mode: 'catatanSemua', jabatan: 'Guru Ahli Pertama', items: [{ kategori: 't', idx: 0, skor: 2, konteks: '' }] };

  g.panggilan.length = 0;
  const a = g.panggil('saranAI', SD_A.npsn, GURU.nama, SD_A.pwGuru, req);
  assert.equal(a.sumber, 'ai');
  assert.ok(g.panggilan.length > 0 && g.panggilan.every((p) => p.kunci === 'AQ.KunciSekolahA_1234567890abcdefghijklmn'));

  g.panggilan.length = 0;
  const b = g.panggil('saranAI', SD_B.npsn, GURU.nama, SD_B.pwGuru, req);
  assert.equal(b.sumber, 'bawaan');
  assert.equal(g.panggilan.length, 0, 'sekolah B tidak boleh memakai key sekolah A');

  assert.equal(g.panggil('login', SD_A.npsn, GURU.nama, SD_A.pwGuru).aiAktif, true);
  assert.equal(g.panggil('login', SD_B.npsn, GURU.nama, SD_B.pwGuru).aiAktif, false);
  assert.throws(() => g.panggil('login', SD_B.npsn, GURU.nama, SD_A.pwGuru), /Password salah/);
});

test('simpan & buat file: file masuk folder sekolah, data tercatat dengan NPSN, terlihat di admin', () => {
  const g = siap();
  g.panggil('daftarSekolah', SD_A);
  g.panggil('daftar', SD_A.npsn, GURU, SD_A.pwGuru);
  const r = g.panggil('simpan', SD_A.npsn, GURU.nama, SD_A.pwGuru, dataLengkap(), true);
  assert.equal(r.ok, true);
  assert.ok(r.file && r.file.xlsx);
  const s = g.ctx.cariSekolah_(SD_A.npsn);
  const fileId = r.file.sheet.match(/\/d\/([^/]+)/)[1];
  assert.equal(g.berkas[fileId].folder, s.FOLDER_ID);
  const f1 = g.berkas[fileId].ss.getSheetByName('FORM 1');
  assert.equal(f1.getRange('B4').getValues()[0][0], ': ' + SD_A.namaKs);
  const baris = g.pusat.getSheetByName('_DATA').data[1];
  assert.equal(baris[6], SD_A.npsn);
  assert.equal(baris[2], 'Selesai');
  const admin = g.panggil('adminMasuk', SD_A.npsn, SD_A.pwAdmin);
  assert.equal(admin.guru[0].status, 'Selesai');
});

test('admin mengubah data sekolah dan password guru', () => {
  const g = siap();
  g.panggil('daftarSekolah', SD_A);
  g.panggil('daftar', SD_A.npsn, GURU, SD_A.pwGuru);
  assert.throws(() => g.panggil('adminSimpan', SD_A.npsn, SD_A.pwAdmin, { NIP_KS: '123' }), /18 digit/);
  assert.throws(() => g.panggil('adminSimpan', SD_A.npsn, SD_A.pwAdmin, { pwGuruBaru: SD_A.pwAdmin }), /sama/);
  const h = g.panggil('adminSimpan', SD_A.npsn, SD_A.pwAdmin, { JABATAN_KS: 'Plt. Kepala Sekolah', pwGuruBaru: 'guruBaru9' });
  assert.equal(h.isian.JABATAN_KS, 'Plt. Kepala Sekolah');
  assert.throws(() => g.panggil('login', SD_A.npsn, GURU.nama, SD_A.pwGuru), /Password salah/);
  assert.equal(g.panggil('login', SD_A.npsn, GURU.nama, 'guruBaru9').atasan.jabatan, 'Plt. Kepala Sekolah');
  g.panggil('adminHapusGuru', SD_A.npsn, SD_A.pwAdmin, GURU.nama);
  assert.deepEqual(g.panggil('namaGuruSekolah', SD_A.npsn), []);
});

test('data lama satu sekolah dipindahkan menjadi sekolah pertama', () => {
  const g = buatGas({ pengunjung: 'pemilik@gmail.com' });
  // susunan lama: pengaturan sekolah di _PENGATURAN, _GURU 7 kolom, _DATA 6 kolom
  const cfg = g.pusat.insertSheet('_PENGATURAN');
  cfg.data = [['KUNCI', 'NILAI', 'KET'], ['NAMA_KS', 'YOS PUTRA KURNIAWAN, S.Pd.'], ['NIP_KS', SD_A.nipKs], ['JABATAN_KS', 'Kepala Sekolah'],
    ['NAMA_SEKOLAH', 'SD Negeri Bugangin'], ['TEMPAT', 'Kendal'], ['PASSWORD', 'lama123'], ['GEMINI_API_KEY', 'AQ.KunciLama_1234567890abcdefghijklmnop'],
    ['WILAYAH', 'Korwilcambiddik Kec. Kendal']];
  g.pusat.insertSheet('_GURU').data = [['NAMA'], [GURU.nama, GURU.nip, 'Guru Ahli Pertama', 'PPPK', 'S1', 'Guru', 'Ahli Pertama']];
  g.pusat.insertSheet('_DATA').data = [['NAMA'], [GURU.nama, new Date(), 'Draf', '', '', JSON.stringify(dataLengkap())]];
  const jawab = [SD_A.npsn, 'adminBaru99'];
  g.ctx.SpreadsheetApp.getUi = () => ({
    ButtonSet: { OK_CANCEL: 1 }, Button: { OK: 'OK' },
    prompt: () => ({ getSelectedButton: () => 'OK', getResponseText: () => jawab.shift() }),
    alert: () => {}
  });
  g.ctx.pindahkanDataLama();
  g.sesi.aktif = '';
  const s = g.panggil('getInit').sekolah;
  assert.deepEqual(s.map((x) => x.nama), ['SD Negeri Bugangin']);
  const masuk = g.panggil('login', SD_A.npsn, GURU.nama, 'lama123');       // password guru lama tetap berlaku
  assert.equal(masuk.aiAktif, true);
  assert.equal(masuk.data.kinerja.predikat, 'Baik');
  assert.equal(g.panggil('adminMasuk', SD_A.npsn, 'adminBaru99').guru.length, 1);
  assert.equal(g.ctx.getCfg_().PASSWORD, '');
  assert.equal(g.ctx.getCfg_().GEMINI_API_KEY, '');
});

test('pemilik mengatur ulang password admin sekolah yang lupa', () => {
  const g = siap();
  g.panggil('daftarSekolah', SD_A);
  const jawab = [SD_A.npsn, 'adminBaru77'];
  g.ctx.SpreadsheetApp.getUi = () => ({
    ButtonSet: { OK_CANCEL: 1 }, Button: { OK: 'OK' },
    prompt: () => ({ getSelectedButton: () => 'OK', getResponseText: () => jawab.shift() }),
    alert: () => {}
  });
  g.sesi.aktif = 'pemilik@gmail.com';
  g.ctx.aturUlangPasswordAdmin();
  g.sesi.aktif = '';
  assert.throws(() => g.panggil('adminMasuk', SD_A.npsn, SD_A.pwAdmin), /Password salah/);
  assert.equal(g.panggil('adminMasuk', SD_A.npsn, 'adminBaru77').npsn, SD_A.npsn);
  assert.throws(() => g.panggil('aturUlangPasswordAdmin'), /pemilik/);
});
