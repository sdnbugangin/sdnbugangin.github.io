/**
 * APLIKASI IDP GURU SD – APLIKASI BERSAMA BANYAK SEKOLAH
 * Formulir 1 & 2 Individual Development Plan (dikembangkan oleh SD Negeri Bugangin, Kendal)
 *
 * Cara kerja:
 *  - Satu Web App dipakai banyak SD. Setiap sekolah mendaftar sendiri (NPSN), lalu admin sekolah
 *    (kepala sekolah/operator) mengatur data sekolah, password sekolah, dan API key Gemini dari halaman Admin.
 *    Satu password per sekolah dipakai guru dan kepala sekolah (masuk guru maupun halaman Admin).
 *    Sekolah lain tidak perlu membuka Google Sheets / Apps Script.
 *  - Data semua sekolah tersimpan di spreadsheet ini: _SEKOLAH, _GURU (kolom NPSN), _DATA (kolom NPSN).
 *    Password disimpan dalam bentuk acak (hash), API key disimpan di Script Properties per sekolah.
 *  - Setiap guru mendapat SALINAN template (TEMPLATE_URL) di folder sekolahnya; skrip hanya mengganti ISI sel.
 *  - Saran AI memakai API key Gemini MILIK SEKOLAH ITU SENDIRI, sehingga kuota antarsekolah terpisah.
 *    Tanpa key, aplikasi tetap memberi saran dari bank kalimat bawaan.
 *
 * Hemat kuota AI:
 *  - Satu sekolah boleh punya beberapa key; key yang kena batas kuota diistirahatkan otomatis.
 *  - Jawaban AI disimpan 6 jam; "Isi semua catatan" memakai 1 permintaan; mode "berpikir" dimatikan.
 *
 * Pemilik spreadsheet: menu "IDP Guru" → 1. Setup awal, lalu (sekali) 2. Pindahkan data lama.
 */

// ====================== KONFIGURASI DASAR ======================
var SHEET_CFG = '_PENGATURAN';
var SHEET_SEKOLAH = '_SEKOLAH';
var SHEET_GURU = '_GURU';
var SHEET_DATA = '_DATA';

/** Pengaturan global (berlaku untuk semua sekolah), diatur pemilik di sheet _PENGATURAN. */
var DEFAULT_CFG = [
  ['TEMPLATE_URL', '', 'Link Google Sheets template IDP (berisi sheet FORM 1 dan FORM 2)'],
  ['FOLDER_ID', '', 'Folder induk semua sekolah. Diisi otomatis oleh setup()'],
  ['GEMINI_MODEL', '', 'Kosongkan agar model dipilih otomatis (disarankan)'],
  ['KABUPATEN', 'Kendal', 'Isian awal kabupaten saat sekolah mendaftar'],
  ['ATASAN_KS_NAMA', 'SUPARDI, S.Pd., M.Pd.', 'Isian awal atasan Kepala Sekolah saat sekolah mendaftar'],
  ['ATASAN_KS_NIP', '', 'Isian awal NIP atasan Kepala Sekolah'],
  ['ATASAN_KS_JABATAN', 'Kepala Bidang Pembinaan Ketenagaan', 'Isian awal jabatan atasan Kepala Sekolah'],
  ['ATASAN_KS_UNIT', 'Dinas Pendidikan dan Kebudayaan', 'Isian awal unit kerja atasan Kepala Sekolah'],
  ['BATAS_DAFTAR_PER_JAM', '20', 'Maksimal sekolah baru yang boleh mendaftar per jam (mencegah penyalahgunaan)']
];

var KOLOM_SEKOLAH = ['NPSN', 'NAMA_SEKOLAH', 'WILAYAH', 'KABUPATEN', 'TEMPAT', 'NAMA_KS', 'NIP_KS', 'JABATAN_KS',
  'ATASAN_KS_NAMA', 'ATASAN_KS_NIP', 'ATASAN_KS_JABATAN', 'ATASAN_KS_UNIT', 'HASH_PASSWORD',
  'FOLDER_ID', 'AKTIF', 'DIBUAT'];
/** Kolom yang boleh diubah admin sekolah dari halaman Admin. */
var KOLOM_UBAH = ['NAMA_SEKOLAH', 'WILAYAH', 'KABUPATEN', 'TEMPAT', 'NAMA_KS', 'NIP_KS', 'JABATAN_KS',
  'ATASAN_KS_NAMA', 'ATASAN_KS_NIP', 'ATASAN_KS_JABATAN', 'ATASAN_KS_UNIT'];

var CFG_MEMO = null;      // pengaturan global dibaca sekali per permintaan
var SEKOLAH_MEMO = null;  // daftar sekolah dibaca sekali per permintaan

var MANAJERIAL = [
  { nama: 'Integritas', aspek: 'konsistensi bertindak jujur, etis, dan sesuai aturan', def: 'Konsisten berperilaku sesuai nilai, norma, dan etika; jujur dan terbuka.' },
  { nama: 'Kerjasama', aspek: 'kerja sama dan kolaborasi dengan rekan sejawat', def: 'Membangun dan menjaga hubungan kerja yang efektif, mau berbagi dan membantu.' },
  { nama: 'Komunikasi', aspek: 'komunikasi lisan dan tulisan dengan siswa, rekan, dan orang tua', def: 'Menyampaikan dan menerima informasi secara jelas dan santun.' },
  { nama: 'Orientasi pada Hasil', aspek: 'orientasi pada pencapaian target dan mutu pembelajaran', def: 'Berusaha mencapai target, menjaga kualitas kerja, dan terus memperbaiki.' },
  { nama: 'Pelayanan Publik', aspek: 'pelayanan kepada peserta didik dan orang tua', def: 'Melayani siswa dan orang tua secara profesional, adil, dan tidak diskriminatif.' },
  { nama: 'Pengembangan Diri dan Orang Lain', aspek: 'pengembangan diri dan berbagi praktik baik kepada rekan', def: 'Terus belajar dan membantu rekan berkembang (KKG, komunitas belajar).' },
  { nama: 'Mengelola Perubahan', aspek: 'adaptasi terhadap perubahan kurikulum dan teknologi', def: 'Menyesuaikan diri dan mendukung perubahan (kurikulum, digitalisasi).' },
  { nama: 'Pengambilan Keputusan', aspek: 'pengambilan keputusan yang tepat dan tepat waktu dalam tugas', def: 'Mengambil keputusan berdasarkan analisis, data, dan pertimbangan risiko.' }
];

var TEKNIS = [
  { nama: 'Pengelolaan peserta didik yang sulit', aspek: 'pengelolaan peserta didik yang sulit', def: 'Menangani siswa dengan masalah perilaku, emosi, atau motivasi belajar.' },
  { nama: 'Pendekatan pembelajaran yang inovatif yang berpihak pada siswa', aspek: 'pendekatan pembelajaran inovatif yang berpihak pada siswa', def: 'Pembelajaran berpusat pada siswa, berdiferensiasi, PBL/PjBL, pembelajaran mendalam.' },
  { nama: 'Penggunaan TIK yang adaptif dalam pembelajaran', aspek: 'penggunaan TIK yang adaptif dalam pembelajaran', def: 'Memanfaatkan PID, laptop, platform digital, dan aplikasi pembelajaran.' },
  { nama: 'Pembuatan konten pembelajaran yang menarik dan relevan', aspek: 'pembuatan konten pembelajaran yang menarik dan relevan', def: 'Membuat media/bahan ajar visual, video, atau interaktif yang dekat dengan kehidupan siswa.' },
  { nama: 'Karakteristik dan cara belajar peserta didik penyandang disabilitas', aspek: 'pemahaman karakteristik dan cara belajar peserta didik penyandang disabilitas', def: 'Memahami ragam disabilitas dan menyusun akomodasi pembelajaran yang layak.' }
];

var SOSIO = [
  { nama: 'Perekat bangsa', aspek: 'peran sebagai perekat bangsa di sekolah dan masyarakat', def: 'Menghargai keberagaman, menjaga persatuan, dan menjadi teladan di lingkungan.' }
];

var PREDIKAT_GAP = ['Tidak Ada', 'Rendah', 'Sedang', 'Tinggi', 'Sangat Tinggi'];

var JALUR = {
  'Non Klasikal': ['coaching', 'mentoring', 'e learning', 'sosialisasi', 'forum diskusi', 'mandiri', 'forum berbagi', 'Komunitas belajar', 'belajar mandiri'],
  'Klasikal': ['bimtek', 'pelatihan workshop', 'Webinar', 'Seminar', 'lainnya']
};
var TAHUN_RPK = [2026, 2027, 2028, 2029, 2030];

// Contoh kalimat catatan resmi dari sheet "Contoh Catatan" (kompetensi teknis 1-4)
var CONTOH_TEKNIS = [
  ['Paham pendekatan dasar, namun masih membutuhkan pendampingan saat menangani peserta didik dengan gangguan perilaku yang kompleks.',
   'Memahami teori manajemen kelas, tetapi belum mampu mempraktikkan strategi penanganan siswa berkebutuhan khusus/bermasalah secara mandiri.',
   'Jarak kemampuan cukup jauh dalam mengendalikan dinamika kelas; sering kesulitan menghadapi siswa yang terdistraksi atau emosional.',
   'Belum memiliki kompetensi dasar dalam manajemen konflik peserta didik maupun pendekatan psikologis anak.'],
  ['Sudah menerapkan pembelajaran aktif, namun masih butuh arahan untuk merancang diferensiasi pembelajaran sesuai kebutuhan individual siswa.',
   'Memahami konsep pembelajaran berpusat pada siswa (student-centered), tetapi praktik pengajarannya masih dominan metode ceramah/konvensional.',
   'Belum mampu menyusun model pembelajaran variatif (seperti PBL/PJBL) yang mengakomodasi ragam gaya belajar siswa.',
   'Belum memahami konsep dasar pembelajaran berdiferensiasi dan metode pembelajaran inovatif modern.'],
  ['Terbiasa menggunakan perangkat TIK standar (seperti PPT), namun masih memerlukan bimbingan untuk mengintegrasikan platform interaktif (seperti Quizizz/Kahoot).',
   'Memahami fungsi TIK dalam pembelajaran, tetapi belum mampu mengoperasikan atau memanfaatkan media digital secara fleksibel saat mengajar.',
   'Penguasaan teknologi masih sangat terbatas; belum dapat memanfaatkan platform pembelajaran digital (LMS/Google Classroom) secara mandiri.',
   'Tidak memiliki keterampilan dasar pengoperasian komputer/aplikasi pembelajaran digital sama sekali.'],
  ['Mampu membuat bahan ajar visual sederhana, namun masih butuh pengarahan untuk merancang modul interaktif atau video pembelajaran.',
   'Paham konsep materi, tetapi konten yang dibuat masih berupa teks tebal tanpa visualisasi menarik yang relevan dengan kehidupan siswa.',
   'Belum mampu memanfaatkan aplikasi pembuat konten (seperti Canva/editing video) sehingga bahan ajar masih bergantung pada buku teks mutlak.',
   'Belum memiliki kemampuan merancang atau menyusun materi ajar digital/visual mandiri sesuai kebutuhan kurikulum.'],
  ['Mengetahui karakteristik umum ragam disabilitas, namun masih perlu pendampingan dalam menyesuaikan strategi pembelajaran.',
   'Mengetahui karakteristik umum ragam disabilitas, tetapi belum mampu menyusun akomodasi yang layak atau penyesuaian materi pembelajaran secara mandiri.',
   'Pemahaman tentang ragam disabilitas masih terbatas sehingga belum dapat mengidentifikasi kebutuhan belajar peserta didik penyandang disabilitas.',
   'Belum memiliki pengetahuan dasar tentang karakteristik dan cara belajar peserta didik penyandang disabilitas.']
];

// ====================== WEB APP ======================
function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('IDP Guru SD')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('IDP Guru')
    .addItem('1. Setup awal', 'setup')
    .addItem('2. Pindahkan data lama (satu sekolah) ke aplikasi bersama', 'pindahkanDataLama')
    .addItem('3. Buat ulang semua file Excel guru', 'buatUlangSemua')
    .addItem('4. Cek API key semua sekolah', 'cekAIMenu')
    .addItem('5. Atur ulang password sekolah', 'aturUlangPasswordSekolah')
    .addToUi();
}

// ====================== KHUSUS PEMILIK SPREADSHEET ======================
/**
 * Fungsi pemilik hanya boleh dijalankan pemilik spreadsheet, bukan oleh pengunjung Web App
 * (Web App berjalan atas nama pemilik; pengunjung lain terbaca kosong / berbeda).
 */
function hanyaPemilik_() {
  var aktif = '', pemilik = '';
  try { aktif = Session.getActiveUser().getEmail(); pemilik = Session.getEffectiveUser().getEmail(); } catch (e) { }
  if (!aktif || aktif !== pemilik) throw new Error('Hanya pemilik spreadsheet yang boleh menjalankan fungsi ini.');
}

/** Jalankan sekali dari editor Apps Script atau menu "IDP Guru". Aman dijalankan ulang. */
function setup() {
  hanyaPemilik_();
  siapkanSheet_();
  folderInduk_();
  try {
    SpreadsheetApp.getUi().alert('Setup selesai.\n\n• Pastikan TEMPLATE_URL di _PENGATURAN berisi link template IDP.\n' +
      '• Bila sebelumnya aplikasi dipakai satu sekolah, jalankan menu 2 (pindahkan data lama).\n' +
      '• Terbitkan ulang Web App: Terapkan → Kelola deployment → Versi baru.');
  } catch (e) { /* dijalankan dari editor */ }
}

function siapkanSheet_() {
  var ss = SpreadsheetApp.getActive();
  var cfgSh = ss.getSheetByName(SHEET_CFG) || ss.insertSheet(SHEET_CFG);
  if (cfgSh.getLastRow() < 1) {
    cfgSh.getRange(1, 1, 1, 3).setValues([['KUNCI', 'NILAI', 'KETERANGAN']]).setFontWeight('bold');
    cfgSh.setColumnWidth(1, 160); cfgSh.setColumnWidth(2, 380); cfgSh.setColumnWidth(3, 420);
    cfgSh.getRange('B:B').setNumberFormat('@');
  }
  var adaKunci = cfgSh.getDataRange().getValues().map(function (r) { return String(r[0]).trim(); });
  DEFAULT_CFG.forEach(function (r) {
    if (adaKunci.indexOf(r[0]) >= 0) return;
    var row = cfgSh.getLastRow() + 1;
    cfgSh.getRange(row, 2).setNumberFormat('@');
    cfgSh.getRange(row, 1, 1, 3).setValues([r]);
  });
  var sek = ss.getSheetByName(SHEET_SEKOLAH) || ss.insertSheet(SHEET_SEKOLAH);
  sek.getRange(1, 1, 1, KOLOM_SEKOLAH.length).setValues([KOLOM_SEKOLAH]).setFontWeight('bold');
  sek.getRange(1, 1, sek.getMaxRows(), KOLOM_SEKOLAH.length).setNumberFormat('@');
  var guru = ss.getSheetByName(SHEET_GURU) || ss.insertSheet(SHEET_GURU);
  guru.getRange(1, 1, 1, 8).setValues([['NAMA (dengan gelar)', 'NIP', 'JABATAN', 'STATUS (PNS/PPPK)', 'PENDIDIKAN TERAKHIR', 'PERAN (Guru/Kepala Sekolah)', 'JENJANG JF', 'NPSN']]).setFontWeight('bold');
  guru.getRange('B:B').setNumberFormat('@');
  guru.getRange('H:H').setNumberFormat('@');
  var data = ss.getSheetByName(SHEET_DATA) || ss.insertSheet(SHEET_DATA);
  data.getRange(1, 1, 1, 7).setValues([['NAMA', 'TERAKHIR DISIMPAN', 'STATUS', 'LINK FILE', 'FILE ID', 'DATA (JSON – jangan diedit)', 'NPSN']]).setFontWeight('bold');
  data.getRange('G:G').setNumberFormat('@');
  CFG_MEMO = null; SEKOLAH_MEMO = null;
}

function folderInduk_() {
  var cfg = getCfg_();
  if (cfg.FOLDER_ID) { try { var f = DriveApp.getFolderById(cfg.FOLDER_ID); if (!f.isTrashed()) return f; } catch (e) { } }
  var baru = DriveApp.createFolder('IDP Guru SD – Aplikasi Bersama');
  setCfg_('FOLDER_ID', baru.getId());
  return baru;
}

/** Folder Drive milik satu sekolah (dibuat bila belum ada / terhapus). */
function folderSekolah_(s) {
  if (s.FOLDER_ID) { try { var f = DriveApp.getFolderById(s.FOLDER_ID); if (!f.isTrashed()) return f; } catch (e) { } }
  var baru = folderInduk_().createFolder(s.NPSN + ' – ' + s.NAMA_SEKOLAH);
  ubahSekolah_(s.NPSN, { FOLDER_ID: baru.getId() });
  s.FOLDER_ID = baru.getId();
  return baru;
}

/**
 * Sekali saja: data aplikasi lama (satu sekolah, isian di _PENGATURAN) dijadikan sekolah pertama
 * di aplikasi bersama. Guru, isian IDP, file, password, dan API key ikut dipindahkan.
 */
function pindahkanDataLama() {
  hanyaPemilik_();
  var ui = SpreadsheetApp.getUi();
  siapkanSheet_();
  var cfg = getCfg_();
  if (!cfg.NAMA_SEKOLAH) { ui.alert('Tidak ada data lama (NAMA_SEKOLAH di _PENGATURAN kosong).'); return; }
  var r1 = ui.prompt('Pindahkan data ' + cfg.NAMA_SEKOLAH, 'Ketik NPSN ' + cfg.NAMA_SEKOLAH + ' (8 digit):', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  var npsn = r1.getResponseText().replace(/\D/g, '');
  if (npsn.length !== 8) { ui.alert('NPSN harus 8 digit.'); return; }
  if (cariSekolah_(npsn, true)) { ui.alert('NPSN ' + npsn + ' sudah ada di _SEKOLAH. Data lama tidak dipindahkan dua kali.'); return; }
  var pw = cfg.PASSWORD;
  if (!pw) {
    var r2 = ui.prompt('Password sekolah', 'Password lama kosong. Buat password sekolah (min. 6 karakter):', ui.ButtonSet.OK_CANCEL);
    if (r2.getSelectedButton() !== ui.Button.OK) return;
    pw = r2.getResponseText().trim();
  }
  if (pw.length < 6) { ui.alert('Password sekolah minimal 6 karakter.'); return; }

  var folderLama = cfg.FOLDER_ID;
  var induk = DriveApp.createFolder('IDP Guru SD – Aplikasi Bersama');
  setCfg_('FOLDER_ID', induk.getId());
  if (folderLama) { try { DriveApp.getFolderById(folderLama).moveTo(induk); } catch (e) { folderLama = ''; } }

  var s = {};
  KOLOM_SEKOLAH.forEach(function (k) { s[k] = cfg[k] || ''; });
  s.NPSN = npsn; s.KABUPATEN = cfg.KABUPATEN || 'Kendal'; s.TEMPAT = cfg.TEMPAT || s.KABUPATEN;
  s.HASH_PASSWORD = buatHash_(pw);
  s.FOLDER_ID = folderLama; s.AKTIF = 'YA'; s.DIBUAT = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm');
  tambahBarisSekolah_(s);

  var ss = SpreadsheetApp.getActive();
  [[SHEET_GURU, 8], [SHEET_DATA, 7]].forEach(function (x) {
    var sh = ss.getSheetByName(x[0]);
    var n = sh.getLastRow() - 1;
    if (n < 1) return;
    var kol = sh.getRange(2, x[1], n, 1).getValues();
    kol.forEach(function (r) { if (!String(r[0]).trim()) r[0] = npsn; });
    sh.getRange(2, x[1], n, 1).setNumberFormat('@').setValues(kol);
  });

  var props = PropertiesService.getScriptProperties();
  var kunciLama = ((cfg.GEMINI_API_KEY || '') + '\n' + (props.getProperty('GEMINI_API_KEYS') || '')).split(/[\s,;]+/).filter(String);
  simpanKunciSekolah_(npsn, kunciLama.filter(function (k, i) { return kunciLama.indexOf(k) === i; }));
  props.deleteProperty('GEMINI_API_KEYS');
  ['PASSWORD', 'GEMINI_API_KEY'].forEach(function (k) { if (cfg[k] !== undefined) setCfg_(k, ''); });

  ui.alert('Selesai. ' + cfg.NAMA_SEKOLAH + ' (NPSN ' + npsn + ') kini menjadi sekolah pertama di aplikasi bersama.\n\n' +
    '• Guru dan kepala sekolah tetap memakai password yang sama, termasuk untuk halaman Admin Sekolah.\n' +
    '• ' + kunciLama.length + ' API key dipindahkan ke sekolah ini.\n\nTerbitkan ulang Web App: Terapkan → Kelola deployment → Versi baru.');
}

/** Menu: sekolah lupa password → pemilik membuat password baru untuk sekolah itu. */
function aturUlangPasswordSekolah() {
  hanyaPemilik_();
  var ui = SpreadsheetApp.getUi();
  var r1 = ui.prompt('Atur ulang password sekolah', 'NPSN sekolah:', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  var s = cariSekolah_(r1.getResponseText(), true);
  if (!s) { ui.alert('NPSN tidak ditemukan di _SEKOLAH.'); return; }
  var r2 = ui.prompt('Atur ulang password sekolah', 'Password baru untuk ' + s.NAMA_SEKOLAH + ' (min. 6 karakter):', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var pw = r2.getResponseText().trim();
  if (pw.length < 6) { ui.alert('Password minimal 6 karakter.'); return; }
  ubahSekolah_(s.NPSN, { HASH_PASSWORD: buatHash_(pw) });
  CacheService.getScriptCache().remove('gagal_' + hash_('admin:' + s.NPSN));
  ui.alert('Password ' + s.NAMA_SEKOLAH + ' sudah diganti. Kirimkan ke kepala sekolah lewat pesan pribadi.');
}

/** Menu: menulis ulang semua file guru (mis. setelah data kepala sekolah diubah). */
function buatUlangSemua() {
  hanyaPemilik_();
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_DATA);
  var vals = sh.getDataRange().getValues();
  var n = 0;
  for (var r = 1; r < vals.length; r++) {
    var d = JSON.parse(vals[r][5] || '{}');
    if (!d.identitas || validasi_(d).length) continue;
    var s = cariSekolah_(String(vals[r][6]), true);
    if (!s) continue;
    var g = cariGuru_(s, vals[r][0]);
    var fid = siapkanFile_(vals[r][4], g.nama, s);
    tulisFile_(fid, g, d, s);
    sh.getRange(r + 1, 4, 1, 2).setValues([[linkFile_(fid).sheet, fid]]);
    n++;
  }
  SpreadsheetApp.getUi().alert(n + ' file guru telah diperbarui.');
}

// ====================== HALAMAN AWAL ======================
function getInit() {
  return {
    sekolah: semuaSekolah_().filter(aktif_).map(function (s) { return { npsn: s.NPSN, nama: s.NAMA_SEKOLAH, wilayah: s.WILAYAH }; })
      .sort(function (a, b) { return a.nama.localeCompare(b.nama); }),
    manajerial: MANAJERIAL, teknis: TEKNIS, sosio: SOSIO,
    jalur: JALUR, tahun: TAHUN_RPK, predikat: PREDIKAT_GAP,
    kabupaten: getCfg_().KABUPATEN || ''
  };
}

/** Nama guru satu sekolah, untuk pilihan saat masuk. */
function namaGuruSekolah(npsn) {
  var s = cariSekolah_(npsn);
  return daftarGuru_(s).map(function (g) { return g.nama; }).sort();
}

/**
 * Pendaftaran sekolah baru oleh kepala sekolah/operator.
 * f = {npsn, nama, wilayah, kabupaten, tempat, namaKs, nipKs, jabatanKs, password}
 */
function daftarSekolah(f) {
  f = f || {};
  var cfg = getCfg_();
  var npsn = String(f.npsn || '').replace(/\D/g, '');
  var nipKs = String(f.nipKs || '').replace(/\D/g, '');
  var nama = rapikan_(f.nama), namaKs = rapikan_(f.namaKs);
  if (npsn.length !== 8) throw new Error('NPSN harus 8 digit angka (lihat di referensi.data.kemdikbud.go.id).');
  if (nama.length < 5) throw new Error('Nama sekolah wajib diisi.');
  if (namaKs.length < 3) throw new Error('Nama kepala sekolah (dengan gelar) wajib diisi.');
  if (nipKs.length !== 18) throw new Error('NIP kepala sekolah harus 18 digit angka (sekarang ' + nipKs.length + ').');
  var pw = String(f.password || '');
  if (pw.length < 6) throw new Error('Password sekolah minimal 6 karakter.');

  var cache = CacheService.getScriptCache();
  var jumlah = Number(cache.get('daftar_sekolah_jam')) || 0;
  if (jumlah >= (Number(cfg.BATAS_DAFTAR_PER_JAM) || 20)) throw new Error('Pendaftaran sekolah sedang ramai. Coba lagi 1 jam lagi.');

  kunci_(function () {
    SEKOLAH_MEMO = null;
    if (cariSekolah_(npsn, true)) throw new Error('NPSN ' + npsn + ' sudah terdaftar. Bila ini sekolah Anda dan password lupa, hubungi pengelola aplikasi.');
    var kab = rapikan_(f.kabupaten) || cfg.KABUPATEN || '';
    tambahBarisSekolah_({
      NPSN: npsn, NAMA_SEKOLAH: nama, WILAYAH: rapikan_(f.wilayah), KABUPATEN: kab, TEMPAT: rapikan_(f.tempat) || kab,
      NAMA_KS: namaKs, NIP_KS: nipKs, JABATAN_KS: rapikan_(f.jabatanKs) || 'Kepala Sekolah',
      ATASAN_KS_NAMA: cfg.ATASAN_KS_NAMA, ATASAN_KS_NIP: cfg.ATASAN_KS_NIP, ATASAN_KS_JABATAN: cfg.ATASAN_KS_JABATAN, ATASAN_KS_UNIT: cfg.ATASAN_KS_UNIT,
      HASH_PASSWORD: buatHash_(pw), FOLDER_ID: '', AKTIF: 'YA',
      DIBUAT: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm')
    });
  });
  cache.put('daftar_sekolah_jam', String(jumlah + 1), 3600);
  return adminMasuk(npsn, pw);
}

// ====================== ADMIN SEKOLAH ======================
function adminMasuk(npsn, pw) {
  return infoAdmin_(cekAdmin_(npsn, pw));
}

function infoAdmin_(s) {
  var data = {};
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_DATA);
  sh.getDataRange().getValues().slice(1).forEach(function (r) {
    if (String(r[6]) !== s.NPSN) return;
    data[r[0]] = { status: r[2], waktu: r[1] ? Utilities.formatDate(new Date(r[1]), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm') : '', link: r[3] };
  });
  var isian = {};
  KOLOM_UBAH.forEach(function (k) { isian[k] = s[k] || ''; });
  return {
    npsn: s.NPSN, isian: isian,
    kunci: kunciSekolah_(s.NPSN).map(function (k) { return '…' + k.slice(-4); }),
    guru: daftarGuru_(s).map(function (g) {
      var x = data[g.nama] || {};
      return { nama: g.nama, nip: g.nip, peran: g.peran, status: x.status || 'Belum mengisi', waktu: x.waktu || '', link: x.link || '' };
    }).sort(function (a, b) { return a.nama.localeCompare(b.nama); }),
    folder: s.FOLDER_ID ? 'https://drive.google.com/drive/folders/' + s.FOLDER_ID : ''
  };
}

function adminSimpan(npsn, pw, f) {
  var s = cekAdmin_(npsn, pw);
  f = f || {};
  var ubah = {};
  KOLOM_UBAH.forEach(function (k) { if (f[k] !== undefined) ubah[k] = rapikan_(f[k]); });
  ['NIP_KS', 'ATASAN_KS_NIP'].forEach(function (k) {
    if (ubah[k] === undefined) return;
    ubah[k] = ubah[k].replace(/\D/g, '');
    if (ubah[k] && ubah[k].length !== 18) throw new Error(k.replace(/_/g, ' ') + ' harus 18 digit angka.');
  });
  if (ubah.NAMA_SEKOLAH !== undefined && ubah.NAMA_SEKOLAH.length < 5) throw new Error('Nama sekolah wajib diisi.');
  if (ubah.NAMA_KS !== undefined && ubah.NAMA_KS.length < 3) throw new Error('Nama kepala sekolah wajib diisi.');
  var pwBaru = String(f.pwBaru || '');
  if (pwBaru) { if (pwBaru.length < 6) throw new Error('Password sekolah minimal 6 karakter.'); ubah.HASH_PASSWORD = buatHash_(pwBaru); }
  kunci_(function () { ubahSekolah_(s.NPSN, ubah); });
  return infoAdmin_(cariSekolah_(s.NPSN));
}

/** Menambah API key Gemini sekolah: diuji ke Google dulu, lalu disimpan tersembunyi (Script Properties). */
function adminTambahKunci(npsn, pw, kunciBaru) {
  var s = cekAdmin_(npsn, pw);
  var k = String(kunciBaru || '').trim();
  if (k.length < 30 || /\s/.test(k)) throw new Error('Format API key tidak dikenali. Salin ulang key secara utuh dari Google AI Studio.');
  var list = kunciSekolah_(s.NPSN);
  if (list.indexOf(k) >= 0) throw new Error('API key ini sudah tersimpan.');
  if (list.length >= 5) throw new Error('Maksimal 5 API key per sekolah. Hapus salah satu terlebih dahulu.');
  var res = UrlFetchApp.fetch(GEMINI_BASE + 'models?pageSize=1', { muteHttpExceptions: true, headers: { 'x-goog-api-key': k } });
  var kode = res.getResponseCode();
  if (kode === 400 || kode === 401 || kode === 403) throw new Error('API key ditolak Google (HTTP ' + kode + '). Pastikan key disalin utuh dan masih aktif.');
  list.push(k);
  simpanKunciSekolah_(s.NPSN, list);
  var hasil = infoAdmin_(s);
  hasil.info = kode === 200 ? 'API key valid dan tersimpan. Fitur AI sudah aktif untuk ' + s.NAMA_SEKOLAH + '.' :
    'API key tersimpan, tetapi Google menjawab HTTP ' + kode + '. Coba "Tes API key" beberapa saat lagi.';
  return hasil;
}

function adminHapusKunci(npsn, pw, urutan) {
  var s = cekAdmin_(npsn, pw);
  var list = kunciSekolah_(s.NPSN);
  list.splice(Number(urutan), 1);
  simpanKunciSekolah_(s.NPSN, list);
  return infoAdmin_(s);
}

function adminTesKunci(npsn, pw) {
  var s = cekAdmin_(npsn, pw);
  return tesKunci_(s).join('\n');
}

/** Menghapus guru dari daftar sekolah (mis. salah ketik / pindah tugas). File IDP di Drive tidak dihapus. */
function adminHapusGuru(npsn, pw, nama) {
  var s = cekAdmin_(npsn, pw);
  kunci_(function () {
    var ss = SpreadsheetApp.getActive();
    [[SHEET_GURU, 7], [SHEET_DATA, 6]].forEach(function (x) {
      var sh = ss.getSheetByName(x[0]);
      var v = sh.getDataRange().getValues();
      for (var i = v.length - 1; i >= 1; i--) if (String(v[i][0]).trim() === nama && String(v[i][x[1]]) === s.NPSN) sh.deleteRow(i + 1);
    });
  });
  return infoAdmin_(s);
}

// ====================== GURU ======================
function login(npsn, nama, pw) {
  var s = cekGuru_(npsn, nama, pw);
  var g = cariGuru_(s, nama);
  var rec = cariData_(s.NPSN, nama);
  return {
    sekolah: { npsn: s.NPSN, nama: s.NAMA_SEKOLAH, wilayah: s.WILAYAH },
    aiAktif: kunciSekolah_(s.NPSN).length > 0,
    profil: g,
    atasan: atasan_(g, s),
    data: rec ? JSON.parse(rec.json) : null,
    file: rec && rec.fileId ? linkFile_(rec.fileId) : null,
    terakhir: rec ? rec.waktu : ''
  };
}

/**
 * Pendaftaran mandiri oleh guru. f = {peran, nama, nip, jenjang, status, pendidikan}
 * Data langsung ditambahkan ke sheet _GURU, lalu guru otomatis masuk.
 */
function daftar(npsn, f, pw) {
  var s = cariSekolah_(npsn);
  cekPassword_('daftar:' + s.NPSN + ':' + String(f.nip || ''), pw, s.HASH_PASSWORD);
  var isKS = f.peran === 'Kepala Sekolah';
  var nama = rapikan_(f.nama);
  var nip = String(f.nip || '').replace(/\D/g, '');
  if (nama.length < 3) throw new Error('Nama lengkap (dengan gelar) wajib diisi.');
  if (nip.length !== 18) throw new Error('NIP harus 18 digit angka (sekarang ' + nip.length + ' digit).');
  if (['Ahli Pertama', 'Ahli Muda', 'Ahli Madya', 'Ahli Utama'].indexOf(f.jenjang) < 0) throw new Error('Pilih jenjang jabatan.');
  if (['PNS', 'PPPK'].indexOf(f.status) < 0) throw new Error('Pilih status kepegawaian.');
  if (isKS && nip !== String(s.NIP_KS).replace(/\D/g, ''))
    throw new Error('Pendaftaran sebagai Kepala Sekolah hanya untuk NIP kepala sekolah yang tercatat di data sekolah.');
  kunci_(function () {
    var ada = daftarGuru_(s);
    if (isKS && ada.some(function (g) { return g.peran === 'Kepala Sekolah'; }))
      throw new Error('Kepala Sekolah sudah terdaftar. Silakan pilih nama Anda lalu masuk.');
    ada.forEach(function (g) {
      if (g.nama.toLowerCase() === nama.toLowerCase()) throw new Error('Nama "' + g.nama + '" sudah terdaftar. Silakan pilih nama Anda di daftar lalu masuk.');
      if (g.nip === nip) throw new Error('NIP ini sudah terdaftar atas nama "' + g.nama + '". Silakan pilih nama tersebut lalu masuk.');
    });
    var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_GURU);
    var row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, 8).setNumberFormat('@');
    sh.getRange(row, 1, 1, 8).setValues([[nama, nip, isKS ? s.JABATAN_KS : 'Guru ' + f.jenjang, f.status, f.pendidikan || 'S1',
      isKS ? 'Kepala Sekolah' : 'Guru', f.jenjang, s.NPSN]]);
  });
  return login(s.NPSN, nama, pw);
}

/** Menyamakan data di _GURU dengan isian terbaru guru (NIP, jabatan, status, pendidikan). */
function perbaruiGuru_(s, nama, d) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_GURU);
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() !== nama || String(v[i][7]) !== s.NPSN) continue;
    var nip = String(d.identitas.nip || '').replace(/\D/g, '');
    sh.getRange(i + 1, 2).setNumberFormat('@');
    sh.getRange(i + 1, 2, 1, 4).setValues([[nip || v[i][1], d.identitas.jabatan || v[i][2], d.identitas.status || v[i][3], d.kualifikasi.pendidikan || v[i][4]]]);
    if (d.identitas.jenjang) sh.getRange(i + 1, 7).setValue(d.identitas.jenjang);
    var nipKS = String(s.NIP_KS || '').replace(/\D/g, '');
    sh.getRange(i + 1, 6).setValue((nip || String(v[i][1]).replace(/\D/g, '')) === nipKS || /kepala/i.test(v[i][5] || '') ? 'Kepala Sekolah' : 'Guru');
    return;
  }
}

/**
 * Menyimpan isian guru. Kunci (lock) hanya dipakai sebentar saat menulis sheet; pembuatan file
 * (±20 detik) dilakukan di luar kunci, sehingga guru dari banyak sekolah tidak saling menunggu.
 */
function simpan(npsn, nama, pw, data, buatFile) {
  var s = cekGuru_(npsn, nama, pw);
  var masalah = validasi_(data);
  var lengkap = masalah.length === 0;
  if (buatFile && !lengkap) return { ok: false, pesan: 'Belum bisa membuat file:\n• ' + masalah.join('\n• ') };
  kunci_(function () { perbaruiGuru_(s, nama, data); });
  var g = cariGuru_(s, nama);
  var rec = cariData_(s.NPSN, nama);
  var fileId = rec ? rec.fileId : '';
  var hasilFile = null;
  if (buatFile) {
    var cache = CacheService.getScriptCache(), ck = 'buat_' + hash_(s.NPSN + '|' + nama);
    if (cache.get(ck)) throw new Error('File Anda sedang dibuat. Tunggu ±30 detik lalu coba lagi.');
    cache.put(ck, '1', 120);
    try {
      fileId = siapkanFile_(fileId, g.nama, s);
      tulisFile_(fileId, g, data, s);
      hasilFile = linkFile_(fileId);
    } finally { cache.remove(ck); }
  }
  kunci_(function () { simpanData_(s.NPSN, nama, data, lengkap ? (fileId && buatFile ? 'Selesai' : 'Lengkap, file belum dibuat') : 'Draf', fileId); });
  return { ok: true, file: hasilFile || (fileId ? linkFile_(fileId) : null), lengkap: lengkap, masalah: masalah,
           waktu: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm') };
}

/**
 * req.mode = 'catatan'      → {kategori:'m'|'t'|'s', idx, skor, konteks, jabatan}
 * req.mode = 'catatanSemua' → {items:[{kategori, idx, skor, konteks}], jabatan}  (1 permintaan AI)
 * req.mode = 'rencana'      → {items:[{kategori, idx, skor, catatan}], jabatan}
 * Memakai API key milik sekolah guru tersebut.
 */
function saranAI(npsn, nama, pw, req) {
  var s = cekGuru_(npsn, nama, pw);
  var aktif = kunciSekolah_(s.NPSN).length > 0;
  var garam = s.NPSN + '|' + nama;
  var alasan = function (e) { return 'AI sedang tidak tersedia (' + e.message + '), dipakai '; };
  if (req.mode === 'catatan') {
    if (aktif) {
      try { return aiCatatan_(req, s, garam); } catch (e) { return fallbackCatatan_(req, alasan(e) + 'kalimat bawaan.'); }
    }
    return fallbackCatatan_(req, '');
  }
  if (req.mode === 'catatanSemua') {
    if (!(req.items || []).length) throw new Error('Tidak ada catatan yang perlu diisi.');
    if (aktif) {
      try { return aiCatatanSemua_(req, s, garam); } catch (e) { return fallbackCatatanSemua_(req, alasan(e) + 'kalimat bawaan.'); }
    }
    return fallbackCatatanSemua_(req, '');
  }
  if (req.mode === 'rencana') {
    if (aktif) {
      try { return aiRencana_(req, s, garam); } catch (e) { return fallbackRencana_(req, alasan(e) + 'saran bawaan.'); }
    }
    return fallbackRencana_(req, '');
  }
  throw new Error('Mode saran tidak dikenal.');
}

// ====================== VALIDASI ======================
function validasi_(d) {
  var m = [];
  if (!d.identitas || !String(d.identitas.nip || '').replace(/\D/g, '')) m.push('NIP pegawai belum diisi.');
  if (!d.identitas || !d.identitas.jabatan) m.push('Jabatan belum diisi.');
  if (!d.kinerja || !d.kinerja.predikat) m.push('Predikat kinerja belum dipilih.');
  if (!d.kualifikasi || !d.kualifikasi.pendidikan) m.push('Pendidikan terakhir belum dipilih.');
  function cek(list, label, wajibSemua) {
    list.forEach(function (x, i) {
      if (!wajibSemua && !x.pilih) return;
      if (x.skor === null || x.skor === undefined || x.skor === '') m.push(label + ' no. ' + (i + 1) + ': skor GAP belum dipilih.');
      else if (Number(x.skor) > 0 && !String(x.catatan || '').trim()) m.push(label + ' no. ' + (i + 1) + ': catatan justifikasi wajib diisi.');
    });
  }
  cek(d.manajerial || [], 'Manajerial', true);
  var nPilih = (d.teknis || []).filter(function (x) { return x.pilih; }).length;
  if (nPilih !== 4) m.push('Kompetensi teknis harus dipilih tepat 4 dari 5 (sekarang ' + nPilih + ').');
  cek(d.teknis || [], 'Teknis', false);
  cek(d.sosio || [], 'Sosio kultural', true);
  itemGap_(d).forEach(function (it) {
    var r = (d.rencana || {})[it.key] || {};
    if (!r.rekomendasi || !r.jenis || !r.jalur || !(r.tahun || []).length)
      m.push('Rencana pengembangan "' + it.nama + '" belum lengkap (rekomendasi, jenis, jalur, tahun).');
  });
  return m;
}

function itemGap_(d) {
  var out = [];
  (d.manajerial || []).forEach(function (x, i) { if (Number(x.skor) > 0) out.push({ key: 'm' + i, kat: 'm', idx: i, nama: MANAJERIAL[i].nama, skor: Number(x.skor), catatan: x.catatan }); });
  (d.teknis || []).forEach(function (x, i) { if (x.pilih && Number(x.skor) > 0) out.push({ key: 't' + i, kat: 't', idx: i, nama: TEKNIS[i].nama, skor: Number(x.skor), catatan: x.catatan }); });
  (d.sosio || []).forEach(function (x, i) { if (Number(x.skor) > 0) out.push({ key: 's' + i, kat: 's', idx: i, nama: SOSIO[i].nama, skor: Number(x.skor), catatan: x.catatan }); });
  return out;
}

// ====================== PENULISAN FILE (FORMAT SAMA PERSIS TEMPLATE) ======================
function siapkanFile_(fileId, nama, s) {
  if (fileId) {
    try { var f = DriveApp.getFileById(fileId); if (!f.isTrashed()) return fileId; } catch (e) { }
  }
  var tplId = idDariUrl_(getCfg_().TEMPLATE_URL);
  if (!tplId) throw new Error('Template IDP belum diatur oleh pengelola aplikasi.');
  var copy = DriveApp.getFileById(tplId).makeCopy('FORM 1 2 IDP ' + nama, folderSekolah_(s));
  try { copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { }
  return copy.getId();
}

function tulisFile_(fileId, g, d, cfg) {
  var ss = SpreadsheetApp.openById(fileId);
  var f1 = ss.getSheetByName('FORM 1');
  var f2 = ss.getSheetByName('FORM 2');
  if (!f1 || !f2) throw new Error('Template harus berisi sheet "FORM 1" dan "FORM 2".');
  var id = d.identitas;
  if (g.peran === 'Kepala Sekolah') id.jabatan = cfg.JABATAN_KS;
  var nipPeg = String(id.nip || '').replace(/\s/g, '');
  var tgl = cfg.TEMPAT + ', ' + tanggalIndo_(d.tanggal);

  // ---------- FORM 1 ----------
  var at = atasan_(g, cfg);
  f1.getRange('B4').setValue(': ' + at.nama);
  f1.getRange('B5').setValue(': ' + at.nip);
  f1.getRange('B6').setValue(':  ' + at.jabatan);
  f1.getRange('B7').setValue(': ' + at.unit);
  f1.getRange('I4').setValue(': ' + namaKapital_(g.nama));
  f1.getRange('I5').setValue(': ' + nipPeg);
  f1.getRange('I6').setValue(': ' + id.jabatan);
  f1.getRange('I7').setValue(': ' + id.status);

  f1.getRange('B11').setValue('Jabatan Fungsional');
  f1.getRange('H11').setValue('Jabatan Fungsional');
  f1.getRange('B12').setValue(id.jenjang || '');
  f1.getRange('H12').setValue(id.target || '');

  var k = d.kinerja;
  f1.getRange('B17').setValue(k.tahun || 2025);
  f1.getRange('C17').setValue(k.predikat || '');
  f1.getRange('H17').setValue(k.ada ? 'v' : '');
  f1.getRange('I17').setValue(k.ada ? '' : 'v');
  f1.getRange('J17').setValue(k.ket || '');

  var q = d.kualifikasi;
  f1.getRange('B22').setValue(q.syarat || 'S1');
  f1.getRange('C22').setValue(q.pendidikan || '');
  f1.getRange('H22').setValue(q.ada ? 'v' : '');
  f1.getRange('I22').setValue(q.ada ? '' : 'v');
  f1.getRange('J22').setValue(q.ket || '');

  function tulisBaris(row, x, aktif) {
    var cells = ['', '', '', '', ''];
    var note = '';
    if (aktif && x && x.skor !== null && x.skor !== '' && x.skor !== undefined) {
      cells[Number(x.skor)] = 'v';
      note = Number(x.skor) === 0 ? '-' : (x.catatan || '');
    }
    f1.getRange(row, 3, 1, 5).setValues([cells]);
    f1.getRange(row, 8).setValue(note);
  }
  d.manajerial.forEach(function (x, i) { tulisBaris(28 + i, x, true); });
  d.teknis.forEach(function (x, i) { tulisBaris(37 + i, x, !!x.pilih); });
  tulisBaris(43, d.sosio[0], true);

  f1.getRange('I45').setValue(tgl);
  f1.getRange('I50').setValue(at.nama);
  f1.getRange('I51').setValue('NIP. ' + at.nip);

  // ---------- FORM 2 ----------
  f2.getRange('A4').setValue('Nama Atasan : ' + at.nama);
  f2.getRange('A5').setValue('NIP Atasan : ' + at.nip);
  f2.getRange('A6').setValue('Jabatan : ' + at.jabatan);
  f2.getRange('A7').setValue('Unit Kerja : ' + at.unit);

  var AWAL = 11, MAKS = 18; // baris 11 s.d. 28
  f2.getRange(AWAL, 1, MAKS, 21).clearContent();
  f2.getRange(AWAL, 3, MAKS, 1).setNumberFormat('@');

  var items = itemGap_(d);
  var nomorKat = { m: 0, t: 0, s: 0 };
  var rows = [];
  items.forEach(function (it, n) {
    var r = (d.rencana || {})[it.key] || {};
    nomorKat[it.kat]++;
    var label = nomorKat[it.kat] + '. ' + it.nama;
    var row = new Array(21).fill('');
    if (n === 0) { row[0] = 1; row[1] = g.nama; row[2] = nipPeg; row[3] = id.jabatan; row[4] = id.status; }
    row[5] = n + 1;
    row[it.kat === 'm' ? 6 : it.kat === 't' ? 7 : 8] = label;
    row[9] = it.skor;
    row[10] = PREDIKAT_GAP[it.skor];
    row[11] = it.catatan || '';
    row[12] = r.rekomendasi || '';
    row[13] = r.jenis || '';
    row[14] = r.jalur || '';
    TAHUN_RPK.forEach(function (th, j) { if ((r.tahun || []).map(Number).indexOf(th) >= 0) row[15 + j] = 'v'; });
    rows.push(row);
  });
  if (!rows.length) {
    var kosong = new Array(21).fill('');
    kosong[0] = 1; kosong[1] = g.nama; kosong[2] = nipPeg; kosong[3] = id.jabatan; kosong[4] = id.status;
    kosong[6] = '-'; kosong[7] = '-'; kosong[8] = '-';
    rows.push(kosong);
  }
  f2.getRange(AWAL, 1, Math.min(rows.length, MAKS), 21).setValues(rows.slice(0, MAKS));

  f2.getRange('O29').setValue(tgl);
  f2.getRange('O34').setValue(at.nama);
  f2.getRange('O35').setValue('NIP. ' + at.nip);
  SpreadsheetApp.flush();
}

// ====================== AI (GEMINI) ======================
var GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/';
var MODEL_CADANGAN = ['gemini-flash-lite-latest', 'gemini-flash-latest'];
var AI_MAKS_PANGGILAN = 6;      // batas permintaan HTTP ke Google per satu klik guru
var AI_MAKS_WAKTU = 25000;      // ms; lewat dari ini langsung pakai saran bawaan
var AI_SIMPAN_DETIK = 21600;    // jawaban disimpan 6 jam (batas maksimal CacheService)

/** API key milik sekolah (s = objek sekolah). */
function daftarKunci_(s) {
  return kunciSekolah_(s.NPSN);
}

function hash_(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)).slice(0, 22);
}

/** Key yang kena batas kuota / tidak valid "diistirahatkan" sementara agar tidak dicoba terus. */
function istirahatkan_(kunci, model, detik, alasan) {
  CacheService.getScriptCache().put('ai_rehat_' + hash_(kunci + '|' + (model || '*')), alasan || '1', Math.max(30, Math.min(21600, Math.round(detik))));
}
function sedangRehat_(kunci, model) {
  var c = CacheService.getScriptCache();
  return c.get('ai_rehat_' + hash_(kunci + '|*')) || (model ? c.get('ai_rehat_' + hash_(kunci + '|' + model)) : null);
}

/** Urutan key bergiliran supaya beban kuota terbagi rata ke semua key. */
function urutanKunci_(cfg) {
  var semua = daftarKunci_(cfg);
  if (!semua.length) return [];
  var cache = CacheService.getScriptCache();
  var giliran = (Number(cache.get('ai_giliran_' + cfg.NPSN)) || 0) % semua.length;
  cache.put('ai_giliran_' + cfg.NPSN, String(giliran + 1), 21600);
  return semua.slice(giliran).concat(semua.slice(0, giliran)).filter(function (k) { return !sedangRehat_(k); });
}

/** Kuota harian Gemini direset tengah malam waktu Pasifik (± pukul 14.00/15.00 WIB). */
function detikSampaiResetHarian_() {
  var now = new Date();
  var jam = Number(Utilities.formatDate(now, 'America/Los_Angeles', 'H'));
  var mnt = Number(Utilities.formatDate(now, 'America/Los_Angeles', 'm'));
  return (24 * 60 - (jam * 60 + mnt)) * 60 + 120;
}

function lamaRehat_(h) {
  var tunggu = 0, harian = /per ?day|daily/i.test(h.pesan);
  (h.detail || []).forEach(function (d) {
    if (d.retryDelay) tunggu = parseFloat(d.retryDelay) || tunggu;
    (d.violations || []).forEach(function (v) { if (/PerDay/i.test(v.quotaId || '')) harian = true; });
  });
  return harian ? detikSampaiResetHarian_() : Math.max(60, Math.ceil(tunggu) + 5);
}

/**
 * Memanggil Gemini dengan rotasi key + model, tanpa pengulangan yang memboroskan kuota.
 * - 429 (kuota habis)      → pasangan key+model diistirahatkan, lanjut ke model/key berikutnya.
 * - 400/401/403 key salah  → key diistirahatkan 6 jam, lanjut ke key berikutnya.
 * - 500/503/504 (sibuk)    → coba model berikutnya.
 * - 404 (model sudah tidak ada) → daftar model diperbarui sekali.
 * garam: pembeda cache (nama guru) agar guru lain tidak mendapat kalimat yang sama persis.
 */
function panggilGemini_(prompt, cfg, skema, garam) {
  var cache = CacheService.getScriptCache();
  var kunciCache = 'ai_jwb_' + hash_(prompt + '|' + (garam || ''));
  var tersimpan = cache.get(kunciCache);
  if (tersimpan) return JSON.parse(tersimpan);

  var kunciList = urutanKunci_(cfg);
  if (!kunciList.length) throw new Error('semua API key sedang mencapai batas kuota, coba lagi nanti');
  var models = daftarModel_(cfg, kunciList[0], false);
  var mulai = Date.now(), percobaan = 0, galat = '', sudahSegarkan = false;

  for (var a = 0; a < kunciList.length; a++) {
    var kunci = kunciList[a];
    for (var b = 0; b < models.length; b++) {
      if (sedangRehat_(kunci, models[b])) continue;
      if (percobaan >= AI_MAKS_PANGGILAN || Date.now() - mulai > AI_MAKS_WAKTU) throw new Error(galat || 'waktu tunggu habis');
      percobaan++;
      var h = kirimGemini_(models[b], prompt, kunci, skema, false);
      if (h.kode === 400 && !/API.?KEY/i.test(h.pesan)) {          // model tidak mendukung thinking/skema → coba versi polos
        percobaan++;
        h = kirimGemini_(models[b], prompt, kunci, skema, true);
      }
      if (h.kode === 200) {
        var hasil = ambilJson_(h.teks);
        try { cache.put(kunciCache, JSON.stringify(hasil), AI_SIMPAN_DETIK); } catch (e) { /* jawaban terlalu besar untuk cache */ }
        return hasil;
      }
      galat = 'HTTP ' + h.kode + (h.pesan ? ' – ' + h.pesan.slice(0, 120) : '');
      if (h.kode === 429) { istirahatkan_(kunci, models[b], lamaRehat_(h), 'kuota'); continue; }
      if (h.kode === 401 || h.kode === 403 || /API.?KEY/i.test(h.pesan)) { istirahatkan_(kunci, null, 21600, 'key tidak valid'); break; }
      if (h.kode === 404) {                                           // model sudah dihentikan → jangan dipakai lagi
        tandaiModelMati_(models[b]);
        if (!sudahSegarkan) { sudahSegarkan = true; models = daftarModel_(cfg, kunci, true); b = -1; }
        continue;
      }
      if ([500, 503, 504].indexOf(h.kode) >= 0) { Utilities.sleep(600); continue; }
      throw new Error(galat);                                         // kesalahan lain: tidak akan beres dengan ganti key
    }
  }
  throw new Error(galat || 'semua API key sedang mencapai batas kuota');
}

function kirimGemini_(model, prompt, kunci, skema, polos) {
  var gen = { temperature: 0.6, responseMimeType: 'application/json' };
  if (!polos) {
    if (skema) gen.responseSchema = skema;
    if (/gemini-2\.5-flash/i.test(model)) gen.thinkingConfig = { thinkingBudget: 0 };   // tanpa "berpikir": cepat & hemat
    else if (/gemini-[3-9]/i.test(model)) gen.thinkingConfig = { thinkingLevel: 'low' };
  }
  var res = UrlFetchApp.fetch(GEMINI_BASE + 'models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-goog-api-key': kunci },
    payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: gen })
  });
  var h = { kode: res.getResponseCode(), teks: res.getContentText(), pesan: '', detail: [] };
  if (h.kode !== 200) {
    try { var e = JSON.parse(h.teks).error; h.pesan = e.message || ''; h.detail = e.details || []; } catch (x) { }
  }
  return h;
}

function ambilJson_(teksRespons) {
  var j = JSON.parse(teksRespons);
  var c = (j.candidates || [])[0];
  if (!c || !c.content || !c.content.parts) {
    var sebab = c && c.finishReason ? c.finishReason : (j.promptFeedback && j.promptFeedback.blockReason) || '';
    throw new Error('AI tidak memberi jawaban' + (sebab ? ' (' + sebab + ')' : ''));
  }
  var teks = c.content.parts.map(function (p) { return p.thought ? '' : (p.text || ''); }).join('');
  teks = teks.replace(/```(?:json)?/g, '');
  var awal = teks.search(/[\[{]/);
  if (awal < 0) throw new Error('format jawaban AI tidak dikenali');
  return JSON.parse(teks.slice(awal));
}

/**
 * Daftar model berurutan (terbaik dulu), disimpan 3 hari di Script Properties.
 * Model "preview/exp" kuotanya sangat kecil sehingga ditaruh paling belakang; model "pro" tidak dipakai.
 */
function daftarModel_(cfg, kunci, segarkan) {
  var props = PropertiesService.getScriptProperties();
  var list = JSON.parse(props.getProperty('MODEL_DAFTAR') || '[]');
  var umur = Date.now() - Number(props.getProperty('MODEL_WAKTU') || 0);
  if (segarkan || !list.length || umur > 3 * 864e5) {
    try {
      var res = UrlFetchApp.fetch(GEMINI_BASE + 'models?pageSize=1000', { muteHttpExceptions: true, headers: { 'x-goog-api-key': kunci } });
      if (res.getResponseCode() === 200) {
        list = (JSON.parse(res.getContentText()).models || []).filter(function (m) {
          var n = m.name.replace('models/', '');
          return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0 && /gemini/i.test(n) &&
            /flash/i.test(n) && !/(image|tts|audio|live|embed|vision|robotics|computer|native|thinking)/i.test(n);
        }).map(function (m) {
          var n = m.name.replace('models/', '');
          var ver = parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]) || 0;
          // Flash-Lite didahulukan: kuota gratisnya lebih besar & lebih cepat, cukup untuk kalimat pendek IDP.
          // Flash biasa menjadi cadangan. Model preview/exp paling belakang.
          var skor = ver * 100 + (/lite/i.test(n) ? 1000 : 0) - (/(preview|exp)/i.test(n) ? 2000 : 0) - (/latest/i.test(n) ? 1 : 0);
          return { n: n, skor: skor };
        }).sort(function (x, y) { return y.skor - x.skor; }).slice(0, 5).map(function (x) { return x.n; });
        if (list.length) {
          props.setProperty('MODEL_DAFTAR', JSON.stringify(list));
          props.setProperty('MODEL_WAKTU', String(Date.now()));
        }
      }
    } catch (e) { /* jaringan bermasalah: pakai daftar lama/cadangan */ }
  }
  if (!list.length) list = MODEL_CADANGAN.slice();
  if (cfg.GEMINI_MODEL) list = [cfg.GEMINI_MODEL].concat(list.filter(function (m) { return m !== cfg.GEMINI_MODEL; }));
  var mati = JSON.parse(props.getProperty('MODEL_MATI') || '[]');
  var hidup = list.filter(function (m) { return mati.indexOf(m) < 0; });
  return hidup.length ? hidup : list;
}

/** Model yang dijawab 404 ("no longer available") dicatat agar tidak dicoba lagi, termasuk bila tertulis di GEMINI_MODEL. */
function tandaiModelMati_(model) {
  var props = PropertiesService.getScriptProperties();
  var mati = JSON.parse(props.getProperty('MODEL_MATI') || '[]');
  if (mati.indexOf(model) < 0) { mati.push(model); props.setProperty('MODEL_MATI', JSON.stringify(mati.slice(-30))); }
}

/** Dari menu spreadsheet: hasil ditampilkan dalam kotak pesan. */
function cekAIMenu() {
  hanyaPemilik_();
  SpreadsheetApp.getUi().alert(cekAI());
}

/**
 * Pemilik: menguji API key semua sekolah. Jalankan dari editor → hasil di Log eksekusi.
 * (Tanpa kotak pesan, karena dari editor kotak itu muncul di tab spreadsheet dan eksekusi menunggu OK.)
 */
function cekAI() {
  hanyaPemilik_();
  PropertiesService.getScriptProperties().deleteProperty('MODEL_MATI');   // uji ulang dari awal
  var baris = [];
  semuaSekolah_().forEach(function (x) {
    var s = cariSekolah_(x.NPSN, true);
    s.GEMINI_MODEL = getCfg_().GEMINI_MODEL;
    baris.push(s.NAMA_SEKOLAH + ' (' + s.NPSN + '):\n  ' + tesKunci_(s).join('\n  '));
  });
  if (!baris.length) baris.push('Belum ada sekolah terdaftar.');
  Logger.log(baris.join('\n'));
  return baris.join('\n\n');
}

/** Menguji setiap API key satu sekolah; tiap key dicoba ke beberapa model sampai berhasil. */
function tesKunci_(s) {
  var semua = daftarKunci_(s);
  if (!semua.length) return ['Belum ada API key.'];
  var baris = [];
  semua.forEach(function (k, i) {
    var label = 'Key ' + (i + 1) + ' (…' + k.slice(-4) + ')';
    var models = daftarModel_(s, k, false), catatan = [];
    for (var m = 0; m < models.length; m++) {
      var h = kirimGemini_(models[m], 'Balas HANYA JSON: {"ok": true}', k, null, false);
      if (h.kode === 200) { baris.push(label + ': OK – model ' + models[m] + (catatan.length ? ' (dilewati: ' + catatan.join('; ') + ')' : '')); return; }
      if (h.kode === 404) { tandaiModelMati_(models[m]); catatan.push(models[m] + ' sudah tidak tersedia'); continue; }
      if (h.kode === 429) { catatan.push(models[m] + ' kuota habis'); continue; }
      if ([500, 503, 504].indexOf(h.kode) >= 0) { catatan.push(models[m] + ' sibuk'); continue; }
      catatan.push('HTTP ' + h.kode + ' – ' + String(h.pesan).slice(0, 140));
      break;                                                             // key salah dsb.: model lain juga akan gagal
    }
    baris.push(label + ': GAGAL – ' + catatan.join('; '));
  });
  return baris;
}

function kompetensi_(kat, idx) {
  return kat === 'm' ? MANAJERIAL[idx] : kat === 't' ? TEKNIS[idx] : SOSIO[idx];
}
function namaKat_(kat) {
  return kat === 'm' ? 'Kompetensi Manajerial' : kat === 't' ? 'Kompetensi Teknis Guru' : 'Kompetensi Sosial Kultural';
}

/** Data pribadi (NIP/NIK, nomor HP, email) tidak ikut dikirim ke layanan AI. */
function bersihkan_(s) {
  return String(s || '').replace(/\S+@\S+/g, '[email]').replace(/\+?\d[\d\s.-]{7,}\d/g, '[angka]').slice(0, 400);
}

var SKALA_GAP = 'Skala GAP: 0 = Tidak ada GAP (sudah memenuhi standar); 1 = Rendah (mampu, butuh sedikit pendampingan); 2 = Sedang (paham dasar tapi belum mampu praktik mandiri); 3 = Tinggi (jarak kemampuan sangat jauh); 4 = Sangat Tinggi (tidak memiliki kompetensi dasar).';
var GAYA_CATATAN = 'Catatan justifikasi 1 kalimat (maks. 30 kata), bahasa Indonesia baku, objektif, sudut pandang orang ketiga tanpa menyebut nama orang, sesuai tingkat GAP. Contoh gaya: "Memahami konsep pembelajaran berpusat pada siswa, tetapi praktik pengajarannya masih dominan metode ceramah/konvensional."';

function konteksJabatan_(jabatan) {
  return 'Jabatan pegawai: ' + (jabatan || 'Guru') + (/kepala/i.test(jabatan || '') ? ' (kepala SD; nilai kompetensi dalam konteks memimpin sekolah dan membina guru).' : '.');
}

function aiCatatan_(req, cfg, garam) {
  var k = kompetensi_(req.kategori, req.idx);
  var adaSkor = req.skor !== null && req.skor !== '' && req.skor !== undefined;
  var prompt = [
    'Anda membantu kepala sekolah dan guru SD ASN di ' + daerah_(cfg) + ' mengisi Formulir 1 IDP (Identifikasi Kesenjangan Kompetensi).',
    'Kategori: ' + namaKat_(req.kategori) + '. Kompetensi: ' + k.nama + ' (' + k.def + ').',
    konteksJabatan_(req.jabatan),
    SKALA_GAP,
    adaSkor ? 'Skor GAP sudah ditetapkan: ' + req.skor + ' (' + PREDIKAT_GAP[req.skor] + '). Jangan ubah skornya.' : 'Skor belum dipilih: usulkan skor 0-4 yang paling sesuai dari deskripsi kondisi.',
    'Deskripsi kondisi dari guru: ' + (req.konteks ? '"' + bersihkan_(req.konteks) + '"' : '(tidak ada, buat kalimat umum yang wajar sesuai skor)'),
    GAYA_CATATAN + ' Jika skor 0, catatan harus "-".',
    'Balas HANYA JSON: {"skor": angka, "catatan": "..."}'
  ].join('\n');
  var skema = { type: 'OBJECT', properties: { skor: { type: 'INTEGER' }, catatan: { type: 'STRING' } }, required: ['skor', 'catatan'] };
  var o = panggilGemini_(prompt, cfg, skema, garam);
  var skor = adaSkor ? Number(req.skor) : Math.max(0, Math.min(4, Math.round(Number(o.skor) || 0)));
  return { skor: skor, catatan: skor === 0 ? '-' : String(o.catatan || '').trim(), sumber: 'ai', info: '' };
}

/** Semua catatan sekaligus dalam SATU permintaan (hemat kuota ±10x dibanding per kompetensi). */
function aiCatatanSemua_(req, cfg, garam) {
  var daftar = req.items.map(function (it, i) {
    var k = kompetensi_(it.kategori, it.idx);
    return (i + 1) + '. [' + namaKat_(it.kategori) + '] ' + k.nama + ' (' + k.def + ') | GAP ' + it.skor + ' (' + PREDIKAT_GAP[it.skor] + ')' +
      (it.konteks ? ' | Kondisi dari guru: "' + bersihkan_(it.konteks) + '"' : '');
  }).join('\n');
  var prompt = [
    'Anda membantu guru SD ASN di ' + daerah_(cfg) + ' mengisi Formulir 1 IDP (Identifikasi Kesenjangan Kompetensi).',
    konteksJabatan_(req.jabatan),
    SKALA_GAP,
    'Tulis catatan untuk setiap kompetensi berikut. Skor GAP sudah ditetapkan, jangan diubah. Variasikan kalimat antar kompetensi.',
    daftar,
    GAYA_CATATAN,
    'Balas HANYA JSON array berurutan sama dengan daftar: [{"catatan":"..."}]'
  ].join('\n');
  var skema = { type: 'ARRAY', items: { type: 'OBJECT', properties: { catatan: { type: 'STRING' } }, required: ['catatan'] } };
  var arr = panggilGemini_(prompt, cfg, skema, garam);
  var fb = fallbackCatatanSemua_(req, '').hasil;
  var hasil = req.items.map(function (it, i) {
    var c = String(((arr || [])[i] || {}).catatan || '').trim();
    return { catatan: c || fb[i].catatan };
  });
  return { hasil: hasil, sumber: 'ai', info: '' };
}

function aiRencana_(req, cfg, garam) {
  var daftar = req.items.map(function (it, i) {
    var k = kompetensi_(it.kategori, it.idx);
    return (i + 1) + '. [' + namaKat_(it.kategori) + '] ' + k.nama + ' | GAP ' + it.skor + ' (' + PREDIKAT_GAP[it.skor] + ') | Catatan: ' + bersihkan_(it.catatan || '-');
  }).join('\n');
  var prompt = [
    'Anda membantu menyusun Formulir 2 IDP (Inventarisasi dan Arah Pengembangan ASN 5 tahun) untuk ' + (req.jabatan || 'guru') + ' SD di ' + daerah_(cfg) + '.',
    'Dasar: UU 20/2023 Pasal 49 (pembelajaran terintegrasi dengan pekerjaan) dan Peraturan LAN 10/2018 (jenis klasikal & nonklasikal, pola 70-20-10: 70% pengalaman/penugasan di tempat kerja, 20% belajar dari orang lain seperti coaching/mentoring/komunitas, 10% pelatihan formal).',
    'Untuk setiap kesenjangan berikut, buat rekomendasi pengembangan kompetensi yang konkret dan realistis:',
    daftar,
    'Aturan:',
    '- "jenis" hanya "Klasikal" atau "Non Klasikal".',
    '- "jalur" WAJIB salah satu persis dari: Non Klasikal → ' + JALUR['Non Klasikal'].join(', ') + '; Klasikal → ' + JALUR['Klasikal'].join(', ') + '.',
    '- Utamakan Non Klasikal (komunitas belajar, coaching, mentoring, belajar mandiri, forum berbagi). Klasikal (bimtek, pelatihan workshop) hanya untuk GAP 3-4 atau kompetensi yang memang perlu pelatihan formal.',
    '- Rekomendasi 1 kalimat (maks. 25 kata), selaras dengan jalur yang dipilih, menyebut kegiatan nyata yang bisa dipraktikkan di sekolah (misal KKG, komunitas belajar sekolah, IHT, Ruang GTK, coaching kepala sekolah).',
    /kepala/i.test(req.jabatan || '') ? '- Pegawai ini KEPALA SEKOLAH: rujuk kegiatan seperti KKKS, pendampingan pengawas sekolah, Ruang GTK untuk kepala sekolah; jangan sebut "coaching kepala sekolah".' : '- Pegawai ini guru kelas/mapel SD.',
    '- "tahun": array tahun pelaksanaan dari ' + TAHUN_RPK.join(', ') + '. GAP 1-2 cukup 1 tahun, GAP 3-4 bisa 2 tahun berurutan. Sebar agar tidak semua di 2026.',
    'Balas HANYA JSON array berurutan sama dengan daftar: [{"rekomendasi":"...","jenis":"...","jalur":"...","tahun":[2026]}]'
  ].join('\n');
  var skema = { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    rekomendasi: { type: 'STRING' }, jenis: { type: 'STRING' }, jalur: { type: 'STRING' }, tahun: { type: 'ARRAY', items: { type: 'INTEGER' } }
  }, required: ['rekomendasi', 'jenis', 'jalur', 'tahun'] } };
  var arr = panggilGemini_(prompt, cfg, skema, garam);
  var fb = fallbackRencana_(req, '').hasil;
  var hasil = req.items.map(function (it, i) {
    var o = (arr || [])[i] || {};
    var jenis = JALUR[o.jenis] ? o.jenis : fb[i].jenis;
    var jalur = JALUR[jenis].indexOf(o.jalur) >= 0 ? o.jalur : (JALUR[jenis].indexOf(fb[i].jalur) >= 0 ? fb[i].jalur : JALUR[jenis][0]);
    var tahun = (o.tahun || []).map(Number).filter(function (t) { return TAHUN_RPK.indexOf(t) >= 0; });
    return { rekomendasi: String(o.rekomendasi || fb[i].rekomendasi).trim(), jenis: jenis, jalur: jalur, tahun: tahun.length ? tahun : fb[i].tahun };
  });
  return { hasil: hasil, sumber: 'ai', info: '' };
}

// ====================== SARAN BAWAAN (TANPA AI) ======================
function fallbackCatatan_(req, info) {
  var k = kompetensi_(req.kategori, req.idx);
  var skor = (req.skor === null || req.skor === '' || req.skor === undefined) ? 1 : Number(req.skor);
  if (skor === 0) return { skor: 0, catatan: '-', sumber: 'bawaan', info: info };
  var c;
  if (req.kategori === 't') c = CONTOH_TEKNIS[req.idx][skor - 1];
  else {
    var pola = [
      'Sudah menunjukkan ' + k.aspek + ' dengan baik, namun masih memerlukan sedikit pendampingan agar lebih konsisten.',
      'Memahami pentingnya ' + k.aspek + ', tetapi penerapannya dalam tugas sehari-hari belum mandiri dan konsisten.',
      'Penerapan ' + k.aspek + ' masih terbatas sehingga memerlukan pembinaan dan pendampingan yang intensif.',
      'Belum menunjukkan kemampuan dasar dalam ' + k.aspek + ' sehingga perlu pengembangan dari tahap awal.'
    ];
    c = pola[skor - 1];
  }
  return { skor: skor, catatan: c, sumber: 'bawaan', info: info || (req.skor === '' || req.skor === null ? 'Skor belum dipilih; contoh memakai skor 1.' : '') };
}

function fallbackCatatanSemua_(req, info) {
  var hasil = req.items.map(function (it) {
    return { catatan: fallbackCatatan_({ kategori: it.kategori, idx: it.idx, skor: it.skor }, '').catatan };
  });
  return { hasil: hasil, sumber: 'bawaan', info: info };
}

function fallbackRencana_(req, info) {
  var ks = /kepala/i.test(req.jabatan || '');
  var pembimbing = ks ? 'pengawas sekolah/kepala sekolah senior' : 'kepala sekolah/guru senior';
  var forum = ks ? 'KKKS dan forum kepala sekolah' : 'komunitas belajar sekolah dan KKG';
  var hasil = req.items.map(function (it, i) {
    var k = kompetensi_(it.kategori, it.idx);
    var s = Number(it.skor);
    var th = TAHUN_RPK[Math.min(i % 3, 2)];
    if (s <= 1) return { rekomendasi: 'Berbagi praktik baik terkait ' + k.aspek + ' melalui ' + forum + '.', jenis: 'Non Klasikal', jalur: 'Komunitas belajar', tahun: [th] };
    if (s === 2) return { rekomendasi: 'Coaching oleh ' + pembimbing + ' untuk meningkatkan ' + k.aspek + ', disertai belajar mandiri melalui Ruang GTK.', jenis: 'Non Klasikal', jalur: 'coaching', tahun: [th] };
    if (s === 3) return { rekomendasi: 'Mengikuti pelatihan/workshop tentang ' + k.aspek + ' dan menerapkannya di kelas dengan pendampingan.', jenis: 'Klasikal', jalur: 'pelatihan workshop', tahun: [th, th + 1] };
    return { rekomendasi: 'Mengikuti bimtek dasar tentang ' + k.aspek + ', dilanjutkan pendampingan berkala oleh ' + (ks ? 'pengawas sekolah' : 'kepala sekolah') + '.', jenis: 'Klasikal', jalur: 'bimtek', tahun: [th, th + 1] };
  });
  return { hasil: hasil, sumber: 'bawaan', info: info };
}

// ====================== DATA & UTILITAS ======================
/** Atasan langsung: guru → Kepala Sekolah; Kepala Sekolah → Kabid Pembinaan Ketenagaan. */
function atasan_(g, s) {
  if (g.peran === 'Kepala Sekolah')
    return { nama: s.ATASAN_KS_NAMA, nip: s.ATASAN_KS_NIP, jabatan: s.ATASAN_KS_JABATAN, unit: s.ATASAN_KS_UNIT };
  return { nama: s.NAMA_KS, nip: s.NIP_KS, jabatan: s.JABATAN_KS, unit: s.NAMA_SEKOLAH };
}

function daerah_(s) {
  var k = String(s.KABUPATEN || '').trim();
  return k ? (/^(kab|kota)/i.test(k) ? k : 'Kabupaten ' + k) : 'Indonesia';
}

function rapikan_(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); }

/** Kunci tulis sheet bersama. Hanya dipakai untuk penulisan singkat. */
function kunci_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Server sedang sibuk. Coba lagi beberapa detik lagi.');
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------- pengaturan global ----------
function getCfg_() {
  if (CFG_MEMO) return CFG_MEMO;
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_CFG);
  var cfg = {};
  DEFAULT_CFG.forEach(function (r) { cfg[r[0]] = r[1]; });
  if (sh) sh.getDataRange().getValues().slice(1).forEach(function (r) { if (r[0]) cfg[String(r[0]).trim()] = String(r[1]).trim(); });
  CFG_MEMO = cfg;
  return cfg;
}
function setCfg_(kunci, nilai) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_CFG);
  var v = sh.getDataRange().getValues();
  CFG_MEMO = null;
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === kunci) { sh.getRange(i + 1, 2).setNumberFormat('@').setValue(nilai); return; }
  var row = sh.getLastRow() + 1;
  sh.getRange(row, 2).setNumberFormat('@');
  sh.getRange(row, 1, 1, 3).setValues([[kunci, nilai, '']]);
}

// ---------- password (disimpan sebagai hash, bukan teks asli) ----------
function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function buatHash_(pw) {
  var garam = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  return garam + '$' + sha256_(garam + '|' + pw);
}
function cocok_(pw, tersimpan) {
  var p = String(tersimpan || '').split('$');
  return p.length === 2 && sha256_(p[0] + '|' + pw) === p[1];
}

/** 5x salah → dikunci 10 menit (mencegah tebak-tebakan password). */
function cekPassword_(id, pw, tersimpan) {
  if (!tersimpan) throw new Error('Password sekolah belum diatur. Hubungi admin sekolah.');
  var cache = CacheService.getScriptCache();
  var kunci = 'gagal_' + hash_(String(id));
  var gagal = Number(cache.get(kunci)) || 0;
  if (gagal >= 5) throw new Error('Terlalu banyak percobaan password salah. Coba lagi 10 menit lagi.');
  if (!cocok_(String(pw), tersimpan)) {
    cache.put(kunci, String(gagal + 1), 600);
    throw new Error('Password salah.');
  }
}
function cekGuru_(npsn, nama, pw) {
  var s = cariSekolah_(npsn);
  cekPassword_('guru:' + s.NPSN + ':' + nama, pw, s.HASH_PASSWORD);
  cariGuru_(s, nama);
  return s;
}
function cekAdmin_(npsn, pw) {
  var s = cariSekolah_(npsn);
  cekPassword_('admin:' + s.NPSN, pw, s.HASH_PASSWORD);
  return s;
}

// ---------- sekolah ----------
function semuaSekolah_() {
  if (SEKOLAH_MEMO) return SEKOLAH_MEMO;
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_SEKOLAH);
  if (!sh) return (SEKOLAH_MEMO = []);
  var v = sh.getDataRange().getDisplayValues();
  var kepala = v[0];
  SEKOLAH_MEMO = v.slice(1).filter(function (r) { return String(r[0]).trim(); }).map(function (r, i) {
    var s = { _baris: i + 2 };
    kepala.forEach(function (k, j) { if (k) s[k] = String(r[j]).trim(); });
    return s;
  });
  return SEKOLAH_MEMO;
}
function aktif_(s) { return String(s.AKTIF || 'YA').toUpperCase() !== 'TIDAK'; }

/** Mencari sekolah aktif berdasarkan NPSN. bolehKosong = true → hasil null bila tidak ada (tanpa error). */
function cariSekolah_(npsn, bolehKosong) {
  npsn = String(npsn || '').replace(/\D/g, '');
  var s = semuaSekolah_().filter(function (x) { return x.NPSN === npsn; })[0] || null;
  if (bolehKosong) return s;
  if (!s) throw new Error('Sekolah tidak ditemukan. Pilih sekolah Anda dari daftar.');
  if (!aktif_(s)) throw new Error('Sekolah ini sedang dinonaktifkan oleh pengelola aplikasi.');
  var cfg = getCfg_();
  s.GEMINI_MODEL = cfg.GEMINI_MODEL;   // model AI diatur global oleh pemilik
  return s;
}
function tambahBarisSekolah_(s) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_SEKOLAH);
  var row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, KOLOM_SEKOLAH.length).setNumberFormat('@')
    .setValues([KOLOM_SEKOLAH.map(function (k) { return s[k] == null ? '' : String(s[k]); })]);
  SEKOLAH_MEMO = null;
}
function ubahSekolah_(npsn, ubah) {
  SEKOLAH_MEMO = null;
  var s = cariSekolah_(npsn, true);
  if (!s) throw new Error('Sekolah tidak ditemukan.');
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_SEKOLAH);
  Object.keys(ubah).forEach(function (k) {
    var kol = KOLOM_SEKOLAH.indexOf(k);
    if (kol >= 0) sh.getRange(s._baris, kol + 1).setNumberFormat('@').setValue(String(ubah[k]));
  });
  SEKOLAH_MEMO = null;
}

// ---------- API key per sekolah (Script Properties, tidak tampil di sheet) ----------
function kunciSekolah_(npsn) {
  return (PropertiesService.getScriptProperties().getProperty('KUNCI_' + npsn) || '').split(/[\s,;]+/).filter(String);
}
function simpanKunciSekolah_(npsn, list) {
  var props = PropertiesService.getScriptProperties();
  if (list.length) props.setProperty('KUNCI_' + npsn, list.join('\n'));
  else props.deleteProperty('KUNCI_' + npsn);
}

// ---------- guru & isian ----------
function daftarGuru_(s) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_GURU);
  if (!sh) return [];
  var nipKS = String(s.NIP_KS || '').replace(/\D/g, '');
  return sh.getDataRange().getDisplayValues().slice(1).filter(function (r) { return String(r[0]).trim() && String(r[7]).trim() === s.NPSN; }).map(function (r) {
    // Kepala Sekolah dikenali dari NIP (sama dengan NIP_KS) atau kolom PERAN
    var nipBaris = String(r[1]).replace(/\D/g, '');
    var peran = (/kepala/i.test(r[5] || '') || (nipKS && nipBaris === nipKS)) ? 'Kepala Sekolah' : 'Guru';
    var jenjang = r[6] || ((String(r[2]).match(/Ahli (Pertama|Muda|Madya|Utama)/) || [])[0]) || 'Ahli Pertama';
    return { nama: String(r[0]).trim(), nip: String(r[1]).replace(/\s/g, ''), jabatan: r[2], status: r[3] || 'PNS', pendidikan: r[4] || 'S1', peran: peran, jenjang: jenjang };
  });
}
function cariGuru_(s, nama) {
  var g = daftarGuru_(s).filter(function (x) { return x.nama === nama; })[0];
  if (!g) throw new Error('Nama tidak terdaftar di sekolah ini.');
  return g;
}
function cariData_(npsn, nama) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_DATA);
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (v[i][0] === nama && String(v[i][6]) === npsn)
    return { row: i + 1, waktu: v[i][1] ? Utilities.formatDate(new Date(v[i][1]), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm') : '', fileId: v[i][4], json: v[i][5] || 'null' };
  return null;
}
function simpanData_(npsn, nama, data, status, fileId) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_DATA);
  var rec = cariData_(npsn, nama);
  var link = fileId ? 'https://docs.google.com/spreadsheets/d/' + fileId + '/edit' : '';
  var row = [nama, new Date(), status, link, fileId || '', JSON.stringify(data), npsn];
  var baris = rec ? rec.row : sh.getLastRow() + 1;
  sh.getRange(baris, 7).setNumberFormat('@');
  sh.getRange(baris, 1, 1, 7).setValues([row]);
}

function linkFile_(id) {
  var gid1 = '', gid2 = '';
  try {
    var ss = SpreadsheetApp.openById(id);
    gid1 = ss.getSheetByName('FORM 1').getSheetId();
    gid2 = ss.getSheetByName('FORM 2').getSheetId();
  } catch (e) { }
  var base = 'https://docs.google.com/spreadsheets/d/' + id;
  var pdf = base + '/export?format=pdf&gridlines=false&printtitle=false&sheetnames=false&fzr=false&fitw=true&top_margin=0.5&bottom_margin=0.5&left_margin=0.5&right_margin=0.5';
  return {
    sheet: base + '/edit',
    xlsx: base + '/export?format=xlsx',
    pdf1: pdf + '&size=folio&portrait=true&gid=' + gid1 + '&range=A1:L52',
    pdf2: pdf + '&size=A4&portrait=false&gid=' + gid2 + '&range=A1:U36'
  };
}
function idDariUrl_(u) {
  u = String(u || '').trim();
  var m = u.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : (/^[a-zA-Z0-9_-]{20,}$/.test(u) ? u : '');
}
/** "Emma Maratul Uswah, S.Pd." → "EMMA MARATUL USWAH, S.Pd." (gelar tidak diubah) */
function namaKapital_(n) {
  n = String(n || '').trim();
  var i = n.indexOf(',');
  return i < 0 ? n.toUpperCase() : n.slice(0, i).toUpperCase() + n.slice(i);
}
function tanggalIndo_(iso) {
  var b = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var d = iso ? new Date(iso + 'T00:00:00') : new Date();
  if (isNaN(d)) d = new Date();
  return d.getDate() + ' ' + b[d.getMonth()] + ' ' + d.getFullYear();
}
