// Uji aplikasi IDP bersama banyak sekolah, memakai tiruan Apps Script di memori.
// Jalankan dari akar repo: node --test idp/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buatGas } = require('./tiruan-gas.js');

const SD_A = { npsn: '20321653', nama: 'SD Negeri Bugangin', wilayah: 'Korwilcambiddik Kec. Kendal', kabupaten: 'Kendal',
  namaKs: 'Yos Putra Kurniawan, S.Pd.', nipKs: '198601282009031003', password: 'sekolahA1' };
const SD_B = { npsn: '20321700', nama: 'SD Negeri 1 Contoh', wilayah: 'Korwilcambiddik Kec. Kendal', kabupaten: 'Kendal',
  namaKs: 'Siti Aminah, S.Pd.', nipKs: '197501012000032001', password: 'sekolahB1' };
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
  assert.ok(!baris.includes(SD_A.password), 'password asli tidak boleh tersimpan');
  assert.ok(baris.includes('"' + SD_A.npsn + '"'), 'NPSN tersimpan sebagai teks');
  assert.throws(() => g.panggil('daftarSekolah', SD_A), /sudah terdaftar/);
  assert.throws(() => g.panggil('daftarSekolah', { ...SD_B, npsn: '123' }), /8 digit/);
  assert.throws(() => g.panggil('daftarSekolah', { ...SD_B, password: '123' }), /minimal 6/);
  assert.deepEqual(g.panggil('getInit').sekolah.map((s) => s.npsn), [SD_A.npsn]);
});

test('admin sekolah: password salah ditolak dan dikunci setelah 5x', () => {
  const g = siap();
  g.panggil('daftarSekolah', SD_A);
  for (let i = 0; i < 5; i++) assert.throws(() => g.panggil('adminMasuk', SD_A.npsn, 'salah'), /Password salah/);
  assert.throws(() => g.panggil('adminMasuk', SD_A.npsn, SD_A.password), /Terlalu banyak/);
});

test('satu password sekolah dipakai guru dan halaman admin', () => {
  const g = siap();
  g.panggil('daftarSekolah', SD_A);
  g.panggil('daftar', SD_A.npsn, GURU, SD_A.password);
  assert.equal(g.panggil('login', SD_A.npsn, GURU.nama, SD_A.password).profil.nama, GURU.nama);
  assert.equal(g.panggil('adminMasuk', SD_A.npsn, SD_A.password).guru.length, 1);
  assert.ok(g.pusat.getSheetByName('_SEKOLAH').data[0].includes('HASH_PASSWORD'));
});

test('API key diuji dulu, disimpan per sekolah, dan tidak tampil utuh', () => {
  const g = siap({ gemini: (url, k) => (k === 'KEY_SALAH_xxxxxxxxxxxxxxxxxxxxxxxxxx' ? { kode: 400, isi: { error: { message: 'API key not valid' } } } : { kode: 200, isi: { models: [] } }) });
  g.panggil('daftarSekolah', SD_A);
  assert.throws(() => g.panggil('adminTambahKunci', SD_A.npsn, SD_A.password, 'KEY_SALAH_xxxxxxxxxxxxxxxxxxxxxxxxxx'), /ditolak/);
  assert.throws(() => g.panggil('adminTambahKunci', SD_A.npsn, SD_A.password, 'pendek'), /Format/);
  const h = g.panggil('adminTambahKunci', SD_A.npsn, SD_A.password, 'AQ.KunciSekolahA_1234567890abcdefghijklmn');
  assert.deepEqual(h.kunci, ['…klmn']);
  assert.match(h.info, /aktif/);
  assert.equal(g.props['KUNCI_' + SD_A.npsn], 'AQ.KunciSekolahA_1234567890abcdefghijklmn');
  assert.ok(!JSON.stringify(g.pusat.sheets.map((s) => s.data)).includes('KunciSekolahA'), 'key tidak boleh ada di sheet');
  assert.deepEqual(g.panggil('adminHapusKunci', SD_A.npsn, SD_A.password, 0).kunci, []);
});

test('saran AI memakai key sekolah sendiri; sekolah tanpa key memakai kalimat bawaan tanpa memanggil Google', () => {
  const g = siap();
  g.panggil('daftarSekolah', SD_A);
  g.panggil('daftarSekolah', SD_B);
  g.panggil('adminTambahKunci', SD_A.npsn, SD_A.password, 'AQ.KunciSekolahA_1234567890abcdefghijklmn');
  g.panggil('daftar', SD_A.npsn, GURU, SD_A.password);
  g.panggil('daftar', SD_B.npsn, GURU, SD_B.password);       // nama & NIP sama di sekolah lain tetap boleh
  const req = { mode: 'catatanSemua', jabatan: 'Guru Ahli Pertama', items: [{ kategori: 't', idx: 0, skor: 2, konteks: '' }] };

  g.panggilan.length = 0;
  const a = g.panggil('saranAI', SD_A.npsn, GURU.nama, SD_A.password, req);
  assert.equal(a.sumber, 'ai');
  assert.ok(g.panggilan.length > 0 && g.panggilan.every((p) => p.kunci === 'AQ.KunciSekolahA_1234567890abcdefghijklmn'));

  g.panggilan.length = 0;
  const b = g.panggil('saranAI', SD_B.npsn, GURU.nama, SD_B.password, req);
  assert.equal(b.sumber, 'bawaan');
  assert.equal(g.panggilan.length, 0, 'sekolah B tidak boleh memakai key sekolah A');

  assert.equal(g.panggil('login', SD_A.npsn, GURU.nama, SD_A.password).aiAktif, true);
  assert.equal(g.panggil('login', SD_B.npsn, GURU.nama, SD_B.password).aiAktif, false);
  assert.throws(() => g.panggil('login', SD_B.npsn, GURU.nama, SD_A.password), /Password salah/);
});

test('simpan & buat file: file masuk folder sekolah, data tercatat dengan NPSN, terlihat di admin', () => {
  const g = siap();
  g.panggil('daftarSekolah', SD_A);
  g.panggil('daftar', SD_A.npsn, GURU, SD_A.password);
  const r = g.panggil('simpan', SD_A.npsn, GURU.nama, SD_A.password, dataLengkap(), true);
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
  const admin = g.panggil('adminMasuk', SD_A.npsn, SD_A.password);
  assert.equal(admin.guru[0].status, 'Selesai');
});

test('admin mengubah data sekolah dan password guru', () => {
  const g = siap();
  g.panggil('daftarSekolah', SD_A);
  g.panggil('daftar', SD_A.npsn, GURU, SD_A.password);
  assert.throws(() => g.panggil('adminSimpan', SD_A.npsn, SD_A.password, { NIP_KS: '123' }), /18 digit/);
  assert.throws(() => g.panggil('adminSimpan', SD_A.npsn, SD_A.password, { pwBaru: '123' }), /minimal 6/);
  const h = g.panggil('adminSimpan', SD_A.npsn, SD_A.password, { JABATAN_KS: 'Plt. Kepala Sekolah', pwBaru: 'guruBaru9' });
  assert.equal(h.isian.JABATAN_KS, 'Plt. Kepala Sekolah');
  assert.throws(() => g.panggil('login', SD_A.npsn, GURU.nama, SD_A.password), /Password salah/);
  assert.equal(g.panggil('login', SD_A.npsn, GURU.nama, 'guruBaru9').atasan.jabatan, 'Plt. Kepala Sekolah');
  assert.throws(() => g.panggil('adminMasuk', SD_A.npsn, SD_A.password), /Password salah/);
  g.panggil('adminHapusGuru', SD_A.npsn, 'guruBaru9', GURU.nama);
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
  const jawab = [SD_A.npsn];
  g.ctx.SpreadsheetApp.getUi = () => ({
    ButtonSet: { OK_CANCEL: 1 }, Button: { OK: 'OK' },
    prompt: () => ({ getSelectedButton: () => 'OK', getResponseText: () => jawab.shift() }),
    alert: () => {}
  });
  g.ctx.pindahkanDataLama();
  g.sesi.aktif = '';
  const s = g.panggil('getInit').sekolah;
  assert.deepEqual(s.map((x) => x.nama), ['SD Negeri Bugangin']);
  const masuk = g.panggil('login', SD_A.npsn, GURU.nama, 'lama123');       // password lama tetap berlaku
  assert.equal(masuk.aiAktif, true);
  assert.equal(masuk.data.kinerja.predikat, 'Baik');
  assert.equal(g.panggil('adminMasuk', SD_A.npsn, 'lama123').guru.length, 1);  // juga untuk halaman admin
  assert.equal(g.ctx.getCfg_().PASSWORD, '');
  assert.equal(g.ctx.getCfg_().GEMINI_API_KEY, '');
});

test('pemilik mengatur ulang password sekolah yang lupa', () => {
  const g = siap();
  g.panggil('daftarSekolah', SD_A);
  const jawab = [SD_A.npsn, 'adminBaru77'];
  g.ctx.SpreadsheetApp.getUi = () => ({
    ButtonSet: { OK_CANCEL: 1 }, Button: { OK: 'OK' },
    prompt: () => ({ getSelectedButton: () => 'OK', getResponseText: () => jawab.shift() }),
    alert: () => {}
  });
  g.sesi.aktif = 'pemilik@gmail.com';
  g.ctx.aturUlangPasswordSekolah();
  g.sesi.aktif = '';
  assert.throws(() => g.panggil('adminMasuk', SD_A.npsn, SD_A.password), /Password salah/);
  assert.equal(g.panggil('adminMasuk', SD_A.npsn, 'adminBaru77').npsn, SD_A.npsn);
  assert.throws(() => g.panggil('aturUlangPasswordSekolah'), /pemilik/);
});

// ---------- unit kerja non-sekolah & ASN non-guru ----------
const DINAS = { jenisUnit: 'Dinas/Badan/Kantor', nama: 'Bidang Pembinaan Ketenagaan Disdikbud', wilayah: 'Dinas Pendidikan dan Kebudayaan', kabupaten: 'Kendal',
  namaKs: 'Supardi, S.Pd., M.Pd.', nipKs: '197109211999031009', jabatanKs: 'Kepala Bidang Pembinaan Ketenagaan', password: 'dinas123' };
const STAF = { peran: 'Pegawai', jenisPegawai: 'Non Guru', nama: 'Rina Wulandari, S.E.', nip: '199001012015032001', status: 'PNS', pendidikan: 'S1',
  jenisJabatan: 'Fungsional', jabatan: 'Analis SDM Aparatur Ahli Pertama' };

function dataNonGuru() {
  const d = dataLengkap();
  d.identitas = { nip: STAF.nip, jenisPegawai: 'Non Guru', jenisJabatan: 'Fungsional', jabatan: STAF.jabatan, target: 'Analis SDM Aparatur Ahli Muda', status: 'PNS', jenjang: '' };
  d.kualifikasi.syarat = 'S1';
  d.teknis = [
    { nama: 'Manajemen data kepegawaian', pilih: true, skor: 2, catatan: 'Belum mandiri mengolah data SIASN.' },
    { nama: 'Analisis jabatan dan beban kerja', pilih: true, skor: 0, catatan: '-' }
  ];
  d.rencana.t0 = { rekomendasi: 'Mentoring oleh analis senior.', jenis: 'Non Klasikal', jalur: 'mentoring', tahun: [2027] };
  d.atasan = { nama: 'Dra. Endang Lestari', nip: '197001011995032001', jabatan: 'Kepala Subbagian Umum dan Kepegawaian', unit: 'Disdikbud Kendal' };
  return d;
}

test('dinas mendaftar tanpa NPSN: kode unit otomatis; nama unit tidak boleh ganda', () => {
  const g = siap();
  const h = g.panggil('daftarSekolah', DINAS);
  assert.match(h.npsn, /^UK\d{6}$/);
  assert.equal(h.jenisUnit, 'Dinas/Badan/Kantor');
  assert.throws(() => g.panggil('daftarSekolah', { ...DINAS, nipKs: '197501012000032001' }), /sudah terdaftar/);
  const unit = g.panggil('getInit').sekolah[0];
  assert.equal(unit.jenis, 'Dinas/Badan/Kantor');
  assert.equal(g.panggil('adminMasuk', h.npsn.toLowerCase(), DINAS.password).npsn, h.npsn);   // kode tidak peka huruf besar/kecil
});

test('ASN non-guru: daftar, kompetensi teknis isian sendiri, atasan sendiri, file berlabel sesuai', () => {
  const g = siap();
  const kode = g.panggil('daftarSekolah', DINAS).npsn;
  assert.throws(() => g.panggil('daftar', kode, { ...STAF, jabatan: '' }, DINAS.password), /Nama jabatan/);
  const m = g.panggil('daftar', kode, STAF, DINAS.password);
  assert.equal(m.profil.jenisPegawai, 'Non Guru');
  assert.equal(m.profil.peran, 'Pegawai');
  assert.equal(m.atasan.nama, DINAS.namaKs);                 // bawaan: kepala unit
  const r = g.panggil('simpan', kode, STAF.nama, DINAS.password, dataNonGuru(), true);
  assert.equal(r.ok, true, r.pesan);
  const f1 = g.berkas[r.file.sheet.match(/\/d\/([^/]+)/)[1]].ss.getSheetByName('FORM 1');
  const sel = (a) => f1.getRange(a).getValues()[0][0];
  assert.equal(sel('B4'), ': Dra. Endang Lestari');          // atasan isian pegawai
  assert.equal(sel('B11'), 'Jabatan Fungsional');
  assert.equal(sel('B12'), STAF.jabatan);
  assert.equal(sel('B37'), '1. Manajemen data kepegawaian');
  assert.equal(sel('B39'), '');                               // baris teknis yang tidak dipakai dikosongkan
  assert.equal(sel('E37'), 'v');                              // skor 2
  assert.equal(sel('H37'), 'Belum mandiri mengolah data SIASN.');
  const f2 = g.berkas[r.file.sheet.match(/\/d\/([^/]+)/)[1]].ss.getSheetByName('FORM 2');
  assert.equal(f2.getRange('H11').getValues()[0][0], '1. Manajemen data kepegawaian');
});

test('validasi non-guru: nama kompetensi teknis wajib, maksimal 5', () => {
  const g = siap();
  const d = dataNonGuru();
  d.teknis[1].nama = '';
  assert.ok(g.ctx.validasi_(d).some((x) => /nama kompetensi belum diisi/.test(x)));
  d.teknis = Array.from({ length: 6 }, (_, i) => ({ nama: 'K' + i, skor: 0, catatan: '-' }));
  assert.ok(g.ctx.validasi_(d).some((x) => /1–5 kompetensi/.test(x)));
});

test('AI mengusulkan kompetensi teknis dari nama jabatan; tanpa key diberi pesan jelas', () => {
  const g = siap({ gemini: (url) => (url.includes(':generateContent')
    ? { kode: 200, isi: { candidates: [{ content: { parts: [{ text: '[{"nama":"Pengelolaan data ASN","def":"Mengolah data kepegawaian."},{"nama":"Analisis jabatan","def":"Menyusun anjab."}]' }] } }] } }
    : { kode: 200, isi: { models: [{ name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] }] } }) });
  const kode = g.panggil('daftarSekolah', DINAS).npsn;
  g.panggil('daftar', kode, STAF, DINAS.password);
  const req = { mode: 'saranTeknis', jenisPegawai: 'Non Guru', jabatan: STAF.jabatan, jenisJabatan: 'Fungsional' };
  assert.throws(() => g.panggil('saranAI', kode, STAF.nama, DINAS.password, req), /belum diaktifkan/);
  g.panggil('adminTambahKunci', kode, DINAS.password, 'AQ.KunciDinas_1234567890abcdefghijklmnopq');
  const h = g.panggil('saranAI', kode, STAF.nama, DINAS.password, req);
  assert.deepEqual(h.hasil.map((x) => x.nama), ['Pengelolaan data ASN', 'Analisis jabatan']);
  // saran bawaan memakai nama kompetensi isian pegawai
  const fb = g.ctx.fallbackCatatan_({ kategori: 't', idx: 0, skor: 2, nama: 'Pengelolaan arsip', jenisPegawai: 'Non Guru' }, '');
  assert.match(fb.catatan, /pengelolaan arsip/);
});

test('kepala unit dinas mendaftar sebagai pegawai; atasannya = atasan kepala unit', () => {
  const g = siap();
  const kode = g.panggil('daftarSekolah', DINAS).npsn;
  g.panggil('adminSimpan', kode, DINAS.password, { ATASAN_KS_NAMA: 'Kepala Dinas X', ATASAN_KS_JABATAN: 'Kepala Dinas' });
  const m = g.panggil('daftar', kode, { ...STAF, peran: 'Kepala', nama: DINAS.namaKs, nip: DINAS.nipKs, jenisJabatan: 'Administrator', jabatan: 'Kabid' }, DINAS.password);
  assert.equal(m.profil.peran, 'Kepala Unit');
  assert.equal(m.profil.jabatan, DINAS.jabatanKs);
  assert.equal(m.atasan.nama, 'Kepala Dinas X');
});

test('file gagal dibuat: isian tetap tersimpan dan pesan error jelas', () => {
  const g = siap();
  g.panggil('daftarSekolah', SD_A);
  g.panggil('daftar', SD_A.npsn, GURU, SD_A.password);
  g.ctx.setCfg_('TEMPLATE_URL', '');                           // template hilang → file gagal
  const r = g.panggil('simpan', SD_A.npsn, GURU.nama, SD_A.password, dataLengkap(), true);
  assert.equal(r.ok, false);
  assert.match(r.pesan, /sudah tersimpan.*\n.*Template/s);
  const baris = g.pusat.getSheetByName('_DATA').data[1];
  assert.equal(baris[2], 'Lengkap, file gagal dibuat');
  assert.equal(JSON.parse(baris[5]).kinerja.predikat, 'Baik');
});

test('setup memetakan ulang kolom _SEKOLAH susunan lama (HASH_ADMIN/HASH_GURU) tanpa menggeser data', () => {
  const g = buatGas({ pengunjung: 'pemilik@gmail.com' });
  const lama = ['NPSN', 'NAMA_SEKOLAH', 'WILAYAH', 'KABUPATEN', 'TEMPAT', 'NAMA_KS', 'NIP_KS', 'JABATAN_KS', 'ATASAN_KS_NAMA', 'ATASAN_KS_NIP',
    'ATASAN_KS_JABATAN', 'ATASAN_KS_UNIT', 'HASH_ADMIN', 'HASH_GURU', 'FOLDER_ID', 'AKTIF', 'DIBUAT'];
  const hashGuru = g.ctx.buatHash_('sdsuper');
  g.pusat.insertSheet('_SEKOLAH').data = [lama, ['20321653', 'SD Negeri Bugangin', '', 'Kendal', 'Kendal', 'Yos', '198601282009031003', 'Kepala Sekolah',
    'Supardi', '', 'Kabid', 'Dinas', g.ctx.buatHash_('adminxx1'), hashGuru, 'folderLama123', 'YA', '2026-10-23 07:27']];
  g.ctx.setup();
  g.sesi.aktif = '';
  const s = g.ctx.cariSekolah_('20321653');
  assert.equal(s.FOLDER_ID, 'folderLama123');
  assert.equal(s.AKTIF, 'YA');
  assert.equal(s.HASH_PASSWORD, hashGuru);
  assert.equal(g.pusat.getSheetByName('_SEKOLAH').data[0].filter(Boolean).length, 17);
});
