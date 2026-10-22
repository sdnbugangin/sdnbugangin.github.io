/**
 * APLIKASI PENGISIAN IDP GURU – SD NEGERI BUGANGIN
 * Formulir 1 & 2 Individual Development Plan (Korwilcambiddik Kec. Kendal)
 *
 * Cara kerja:
 *  - File Excel contoh (FORM 1 2 IDP ...) diubah ke Google Sheets → dipakai sebagai TEMPLATE.
 *  - Setiap guru mendapat SALINAN template itu; skrip hanya mengganti ISI sel,
 *    sehingga format, garis, lebar kolom, dan sheet lain tetap sama persis.
 *  - Data isian tersimpan di sheet _DATA agar bisa dibuka dan diedit lagi.
 *  - Saran AI memakai Google Gemini (opsional). Tanpa API key, aplikasi
 *    tetap memberi saran dari bank kalimat bawaan.
 *
 * Hemat kuota AI (versi ini):
 *  - GEMINI_API_KEY boleh berisi BEBERAPA key (pisahkan dengan koma / baris baru).
 *    Key yang kena batas kuota otomatis diistirahatkan dan key berikutnya dipakai —
 *    tidak perlu lagi mengganti key secara manual. Pakai key dari project/email berbeda,
 *    karena kuota gratis dihitung per project Google Cloud, bukan per key.
 *  - Jawaban AI disimpan sementara (6 jam), jadi klik ulang dengan isian sama tidak memakai kuota.
 *  - "Isi semua catatan" memakai 1 permintaan untuk semua kompetensi, bukan 1 per kompetensi.
 *  - Mode "berpikir" (thinking) dimatikan/dikecilkan → jawaban lebih cepat dan hemat token.
 *  - Jalankan cekAI() dari editor untuk melihat status setiap key.
 */

// ====================== KONFIGURASI DASAR ======================
var SHEET_CFG = '_PENGATURAN';
var SHEET_GURU = '_GURU';
var SHEET_DATA = '_DATA';

var DEFAULT_CFG = [
  ['NAMA_KS', 'YOS PUTRA KURNIAWAN, S.Pd.', 'Nama Kepala Sekolah (atasan langsung)'],
  ['NIP_KS', '', 'NIP Kepala Sekolah'],
  ['JABATAN_KS', 'Kepala Sekolah', 'Isi "Plt. Kepala Sekolah" jika berstatus Plt'],
  ['NAMA_SEKOLAH', 'SD Negeri Bugangin', 'Unit kerja / sub unit kerja guru'],
  ['ATASAN_KS_NAMA', 'SUPARDI, S.Pd., M.Pd.', 'Atasan langsung Kepala Sekolah (untuk IDP Kepala Sekolah)'],
  ['ATASAN_KS_NIP', '', 'NIP atasan Kepala Sekolah'],
  ['ATASAN_KS_JABATAN', 'Kepala Bidang Pembinaan Ketenagaan', 'Jabatan atasan Kepala Sekolah'],
  ['ATASAN_KS_UNIT', 'Dinas Pendidikan dan Kebudayaan', 'Unit kerja atasan Kepala Sekolah'],
  ['TEMPAT', 'Kendal', 'Tempat pada bagian tanda tangan'],
  ['PASSWORD', '', 'Password masuk untuk semua guru (wajib diisi)'],
  ['TEMPLATE_URL', '', 'Tempel link Google Sheets hasil konversi Excel contoh IDP'],
  ['FOLDER_ID', '', 'Diisi otomatis oleh setup()'],
  ['GEMINI_API_KEY', '', 'Opsional. Satu atau beberapa API key dari aistudio.google.com, pisahkan dengan koma'],
  ['GEMINI_MODEL', '', 'Kosongkan agar model dipilih otomatis (disarankan)']
];

var CFG_MEMO = null; // pengaturan dibaca sekali per permintaan

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
    .setTitle('IDP Guru – ' + getCfg_().NAMA_SEKOLAH)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('IDP Guru')
    .addItem('1. Setup awal', 'setup')
    .addItem('2. Buat ulang semua file Excel guru', 'buatUlangSemua')
    .addItem('3. Cek status API key AI', 'cekAI')
    .addToUi();
}

/** Jalankan sekali dari editor Apps Script atau menu "IDP Guru". */
function setup() {
  var ss = SpreadsheetApp.getActive();
  var cfgSh = ss.getSheetByName(SHEET_CFG) || ss.insertSheet(SHEET_CFG);
  if (cfgSh.getLastRow() < 1) {
    cfgSh.getRange(1, 1, 1, 3).setValues([['KUNCI', 'NILAI', 'KETERANGAN']]).setFontWeight('bold');
    cfgSh.setColumnWidth(1, 160); cfgSh.setColumnWidth(2, 380); cfgSh.setColumnWidth(3, 420);
    cfgSh.getRange('B:B').setNumberFormat('@');
  }
  // tambahkan kunci yang belum ada (aman dijalankan ulang; nilai yang sudah diisi tidak diubah)
  var adaKunci = cfgSh.getDataRange().getValues().map(function (r) { return String(r[0]).trim(); });
  DEFAULT_CFG.forEach(function (r) {
    if (adaKunci.indexOf(r[0]) >= 0) return;
    var row = cfgSh.getLastRow() + 1;
    cfgSh.getRange(row, 2).setNumberFormat('@');
    cfgSh.getRange(row, 1, 1, 3).setValues([r]);
  });
  var guru = ss.getSheetByName(SHEET_GURU) || ss.insertSheet(SHEET_GURU);
  guru.getRange(1, 1, 1, 7).setValues([['NAMA (dengan gelar)', 'NIP', 'JABATAN', 'STATUS (PNS/PPPK)', 'PENDIDIKAN TERAKHIR', 'PERAN (Guru/Kepala Sekolah)', 'JENJANG JF']]).setFontWeight('bold');
  guru.getRange('B:B').setNumberFormat('@');
  guru.setColumnWidths(1, 7, 190);
  var data = ss.getSheetByName(SHEET_DATA) || ss.insertSheet(SHEET_DATA);
  if (data.getLastRow() < 1) {
    data.getRange(1, 1, 1, 6).setValues([['NAMA', 'TERAKHIR DISIMPAN', 'STATUS', 'LINK FILE', 'FILE ID', 'DATA (JSON – jangan diedit)']]).setFontWeight('bold');
  }
  var cfg = getCfg_();
  if (!cfg.FOLDER_ID) {
    var folder = DriveApp.createFolder('IDP Guru ' + cfg.NAMA_SEKOLAH + ' 2026');
    setCfg_('FOLDER_ID', folder.getId());
  }
  try {
    SpreadsheetApp.getUi().alert('Setup selesai.\n\n1) Isi daftar guru di sheet _GURU.\n2) Tempel link template di _PENGATURAN baris TEMPLATE_URL.\n3) (Opsional) isi GEMINI_API_KEY — boleh beberapa key dipisah koma.\n4) Deploy sebagai Web App.');
  } catch (e) { /* dijalankan dari editor */ }
}

// ====================== FUNGSI YANG DIPANGGIL HALAMAN ======================
function getInit() {
  var cfg = getCfg_();
  return {
    sekolah: cfg.NAMA_SEKOLAH,
    ks: cfg.NAMA_KS,
    guru: daftarGuru_().map(function (g) { return g.nama; }),
    manajerial: MANAJERIAL, teknis: TEKNIS, sosio: SOSIO,
    jalur: JALUR, tahun: TAHUN_RPK, predikat: PREDIKAT_GAP,
    aiAktif: daftarKunci_(cfg).length > 0
  };
}

function login(nama, pw) {
  cekLogin_(nama, pw);
  var g = cariGuru_(nama);
  var rec = cariData_(nama);
  return {
    profil: g,
    atasan: atasan_(g, getCfg_()),
    data: rec ? JSON.parse(rec.json) : null,
    file: rec && rec.fileId ? linkFile_(rec.fileId) : null,
    terakhir: rec ? rec.waktu : ''
  };
}

/**
 * Pendaftaran mandiri oleh guru. f = {nama, nip, jenjang, status, pendidikan}
 * Data langsung ditambahkan ke sheet _GURU, lalu guru otomatis masuk.
 */
function daftar(f, pw) {
  var cfg = getCfg_();
  cekPassword_('daftar:' + String(f.nip || ''), pw);
  var isKS = f.peran === 'Kepala Sekolah';
  var nama = String(f.nama || '').replace(/\s+/g, ' ').trim();
  var nip = String(f.nip || '').replace(/\D/g, '');
  if (nama.length < 3) throw new Error('Nama lengkap (dengan gelar) wajib diisi.');
  if (nip.length !== 18) throw new Error('NIP harus 18 digit angka (sekarang ' + nip.length + ' digit).');
  if (['Ahli Pertama', 'Ahli Muda', 'Ahli Madya', 'Ahli Utama'].indexOf(f.jenjang) < 0) throw new Error('Pilih jenjang jabatan.');
  if (['PNS', 'PPPK'].indexOf(f.status) < 0) throw new Error('Pilih status kepegawaian.');
  if (isKS && nip !== String(cfg.NIP_KS).replace(/\D/g, ''))
    throw new Error('Pendaftaran sebagai Kepala Sekolah hanya untuk NIP kepala sekolah yang tercatat di pengaturan.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ada = daftarGuru_();
    if (isKS && ada.some(function (g) { return g.peran === 'Kepala Sekolah'; }))
      throw new Error('Kepala Sekolah sudah terdaftar. Silakan pilih nama Anda lalu masuk.');
    ada.forEach(function (g) {
      if (g.nama.toLowerCase() === nama.toLowerCase()) throw new Error('Nama "' + g.nama + '" sudah terdaftar. Silakan pilih nama Anda di daftar lalu masuk.');
      if (g.nip === nip) throw new Error('NIP ini sudah terdaftar atas nama "' + g.nama + '". Silakan pilih nama tersebut lalu masuk.');
    });
    var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_GURU);
    var row = sh.getLastRow() + 1;
    sh.getRange(row, 2).setNumberFormat('@');
    sh.getRange(row, 1, 1, 7).setValues([[nama, nip, isKS ? cfg.JABATAN_KS : 'Guru ' + f.jenjang, f.status, f.pendidikan || 'S1',
      isKS ? 'Kepala Sekolah' : 'Guru', f.jenjang]]);
  } finally {
    lock.releaseLock();
  }
  return login(nama, pw);
}

/** Menyamakan data di _GURU dengan isian terbaru guru (NIP, jabatan, status, pendidikan). */
function perbaruiGuru_(nama, d) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_GURU);
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() !== nama) continue;
    var nip = String(d.identitas.nip || '').replace(/\D/g, '');
    sh.getRange(i + 1, 2).setNumberFormat('@');
    sh.getRange(i + 1, 2, 1, 4).setValues([[nip || v[i][1], d.identitas.jabatan || v[i][2], d.identitas.status || v[i][3], d.kualifikasi.pendidikan || v[i][4]]]);
    if (d.identitas.jenjang) sh.getRange(i + 1, 7).setValue(d.identitas.jenjang);
    var nipKS = String(getCfg_().NIP_KS || '').replace(/\D/g, '');
    sh.getRange(i + 1, 6).setValue((nip || String(v[i][1]).replace(/\D/g, '')) === nipKS || /kepala/i.test(v[i][5] || '') ? 'Kepala Sekolah' : 'Guru');
    return;
  }
}

function simpan(nama, pw, data, buatFile) {
  cekLogin_(nama, pw);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var cfg = getCfg_();
    perbaruiGuru_(nama, data);
    var g = cariGuru_(nama);
    var masalah = validasi_(data);
    var lengkap = masalah.length === 0;
    if (buatFile && !lengkap) {
      return { ok: false, pesan: 'Belum bisa membuat file:\n• ' + masalah.join('\n• ') };
    }
    var rec = cariData_(nama);
    var fileId = rec ? rec.fileId : '';
    var hasilFile = null;
    if (buatFile) {
      fileId = siapkanFile_(fileId, g.nama, cfg);
      tulisFile_(fileId, g, data, cfg);
      hasilFile = linkFile_(fileId);
    }
    simpanData_(nama, data, lengkap ? (fileId && buatFile ? 'Selesai' : 'Lengkap, file belum dibuat') : 'Draf', fileId);
    return { ok: true, file: hasilFile || (fileId ? linkFile_(fileId) : null), lengkap: lengkap, masalah: masalah,
             waktu: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm') };
  } finally {
    lock.releaseLock();
  }
}

/**
 * req.mode = 'catatan'      → {kategori:'m'|'t'|'s', idx, skor, konteks, jabatan}
 * req.mode = 'catatanSemua' → {items:[{kategori, idx, skor, konteks}], jabatan}  (1 permintaan AI)
 * req.mode = 'rencana'      → {items:[{kategori, idx, skor, catatan}], jabatan}
 */
function saranAI(nama, pw, req) {
  cekLogin_(nama, pw);
  var cfg = getCfg_();
  var aktif = daftarKunci_(cfg).length > 0;
  var alasan = function (e) { return 'AI sedang tidak tersedia (' + e.message + '), dipakai '; };
  if (req.mode === 'catatan') {
    if (aktif) {
      try { return aiCatatan_(req, cfg, nama); } catch (e) { return fallbackCatatan_(req, alasan(e) + 'kalimat bawaan.'); }
    }
    return fallbackCatatan_(req, '');
  }
  if (req.mode === 'catatanSemua') {
    if (!(req.items || []).length) throw new Error('Tidak ada catatan yang perlu diisi.');
    if (aktif) {
      try { return aiCatatanSemua_(req, cfg, nama); } catch (e) { return fallbackCatatanSemua_(req, alasan(e) + 'kalimat bawaan.'); }
    }
    return fallbackCatatanSemua_(req, '');
  }
  if (req.mode === 'rencana') {
    if (aktif) {
      try { return aiRencana_(req, cfg, nama); } catch (e) { return fallbackRencana_(req, alasan(e) + 'saran bawaan.'); }
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
function siapkanFile_(fileId, nama, cfg) {
  if (fileId) {
    try { var f = DriveApp.getFileById(fileId); if (!f.isTrashed()) return fileId; } catch (e) { }
  }
  var tplId = idDariUrl_(cfg.TEMPLATE_URL);
  if (!tplId) throw new Error('TEMPLATE_URL di sheet _PENGATURAN belum diisi. Hubungi kepala sekolah.');
  var folder = DriveApp.getFolderById(cfg.FOLDER_ID);
  var copy = DriveApp.getFileById(tplId).makeCopy('FORM 1 2 IDP ' + nama, folder);
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

/** Menu: menulis ulang semua file guru (mis. setelah data KS di _PENGATURAN diubah). */
function buatUlangSemua() {
  var cfg = getCfg_();
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_DATA);
  var vals = sh.getDataRange().getValues();
  var n = 0;
  for (var r = 1; r < vals.length; r++) {
    var d = JSON.parse(vals[r][5] || '{}');
    if (!d.identitas || validasi_(d).length) continue;
    var g = cariGuru_(vals[r][0]);
    var fid = siapkanFile_(vals[r][4], g.nama, cfg);
    tulisFile_(fid, g, d, cfg);
    sh.getRange(r + 1, 4, 1, 2).setValues([[linkFile_(fid).sheet, fid]]);
    n++;
  }
  SpreadsheetApp.getUi().alert(n + ' file guru telah diperbarui.');
}

// ====================== AI (GEMINI) ======================
var GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/';
var MODEL_CADANGAN = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
var AI_MAKS_PANGGILAN = 6;      // batas permintaan HTTP ke Google per satu klik guru
var AI_MAKS_WAKTU = 25000;      // ms; lewat dari ini langsung pakai saran bawaan
var AI_SIMPAN_DETIK = 21600;    // jawaban disimpan 6 jam (batas maksimal CacheService)

/** Semua API key: dari sel GEMINI_API_KEY dan/atau Script Properties "GEMINI_API_KEYS". */
function daftarKunci_(cfg) {
  var teks = (cfg.GEMINI_API_KEY || '') + '\n' + (PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEYS') || '');
  var out = [];
  teks.split(/[\s,;]+/).forEach(function (k) { if (k && out.indexOf(k) < 0) out.push(k); });
  return out;
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
  var giliran = (Number(cache.get('ai_giliran')) || 0) % semua.length;
  cache.put('ai_giliran', String(giliran + 1), 21600);
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
          var skor = ver * 100 - (/lite/i.test(n) ? 10 : 0) - (/(preview|exp)/i.test(n) ? 200 : 0) - (/latest/i.test(n) ? 1 : 0);
          return { n: n, skor: skor };
        }).sort(function (x, y) { return y.skor - x.skor; }).slice(0, 4).map(function (x) { return x.n; });
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

/** Jalankan dari editor / menu: menguji setiap API key satu per satu. Lihat hasilnya di Log eksekusi. */
function cekAI() {
  var cfg = getCfg_();
  var semua = daftarKunci_(cfg);
  var baris = [];
  if (!semua.length) baris.push('GEMINI_API_KEY belum diisi di _PENGATURAN.');
  PropertiesService.getScriptProperties().deleteProperty('MODEL_MATI');   // uji ulang dari awal
  semua.forEach(function (k, i) {
    var label = 'Key ' + (i + 1) + ' (…' + k.slice(-4) + ')';
    var models = daftarModel_(cfg, k, i === 0), catatan = [];
    for (var m = 0; m < models.length; m++) {                            // coba model satu per satu sampai berhasil
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
  if (cfg.GEMINI_MODEL && JSON.parse(PropertiesService.getScriptProperties().getProperty('MODEL_MATI') || '[]').indexOf(cfg.GEMINI_MODEL) >= 0)
    baris.push('PERHATIAN: GEMINI_MODEL di _PENGATURAN berisi "' + cfg.GEMINI_MODEL + '" yang sudah tidak tersedia. Kosongkan sel tersebut agar model dipilih otomatis.');
  baris.push('Urutan model: ' + daftarModel_(cfg, semua[0] || '', false).join(', '));
  Logger.log(baris.join('\n'));
  try { SpreadsheetApp.getUi().alert(baris.join('\n\n')); } catch (e) { /* dijalankan dari editor */ }
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
    'Anda membantu kepala sekolah dan guru SD ASN di Kabupaten Kendal mengisi Formulir 1 IDP (Identifikasi Kesenjangan Kompetensi).',
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
    'Anda membantu guru SD ASN di Kabupaten Kendal mengisi Formulir 1 IDP (Identifikasi Kesenjangan Kompetensi).',
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
    'Anda membantu menyusun Formulir 2 IDP (Inventarisasi dan Arah Pengembangan ASN 5 tahun) untuk ' + (req.jabatan || 'guru') + ' SD di Kabupaten Kendal.',
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
function atasan_(g, cfg) {
  if (g.peran === 'Kepala Sekolah')
    return { nama: cfg.ATASAN_KS_NAMA, nip: cfg.ATASAN_KS_NIP, jabatan: cfg.ATASAN_KS_JABATAN, unit: cfg.ATASAN_KS_UNIT };
  return { nama: cfg.NAMA_KS, nip: cfg.NIP_KS, jabatan: cfg.JABATAN_KS, unit: cfg.NAMA_SEKOLAH };
}

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
  for (var i = 1; i < v.length; i++) if (v[i][0] === kunci) { sh.getRange(i + 1, 2).setValue(nilai); return; }
  sh.appendRow([kunci, nilai, '']);
}
/** Password dicek dengan batas: 5x salah → akun dikunci 10 menit (mencegah tebak-tebakan password). */
function cekPassword_(id, pw) {
  var cfg = getCfg_();
  if (!cfg.PASSWORD) throw new Error('Password belum diatur di _PENGATURAN. Hubungi kepala sekolah.');
  var cache = CacheService.getScriptCache();
  var kunci = 'gagal_' + hash_(String(id));
  var gagal = Number(cache.get(kunci)) || 0;
  if (gagal >= 5) throw new Error('Terlalu banyak percobaan password salah. Coba lagi 10 menit lagi.');
  if (String(pw) !== cfg.PASSWORD) {
    cache.put(kunci, String(gagal + 1), 600);
    throw new Error('Password salah.');
  }
}
function cekLogin_(nama, pw) {
  cekPassword_('login:' + nama, pw);
  cariGuru_(nama);
}
function daftarGuru_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_GURU);
  if (!sh) return [];
  var nipKS = String(getCfg_().NIP_KS || '').replace(/\D/g, '');
  return sh.getDataRange().getDisplayValues().slice(1).filter(function (r) { return String(r[0]).trim(); }).map(function (r) {
    // Kepala Sekolah dikenali dari NIP (sama dengan NIP_KS) atau kolom PERAN
    var nipBaris = String(r[1]).replace(/\D/g, '');
    var peran = (/kepala/i.test(r[5] || '') || (nipKS && nipBaris === nipKS)) ? 'Kepala Sekolah' : 'Guru';
    var jenjang = r[6] || ((String(r[2]).match(/Ahli (Pertama|Muda|Madya|Utama)/) || [])[0]) || 'Ahli Pertama';
    return { nama: String(r[0]).trim(), nip: String(r[1]).replace(/\s/g, ''), jabatan: r[2], status: r[3] || 'PNS', pendidikan: r[4] || 'S1', peran: peran, jenjang: jenjang };
  });
}
function cariGuru_(nama) {
  var g = daftarGuru_().filter(function (x) { return x.nama === nama; })[0];
  if (!g) throw new Error('Nama tidak terdaftar.');
  return g;
}
function cariData_(nama) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_DATA);
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (v[i][0] === nama)
    return { row: i + 1, waktu: v[i][1] ? Utilities.formatDate(new Date(v[i][1]), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm') : '', fileId: v[i][4], json: v[i][5] || 'null' };
  return null;
}
function simpanData_(nama, data, status, fileId) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_DATA);
  var rec = cariData_(nama);
  var link = fileId ? linkFile_(fileId).sheet : '';
  var row = [nama, new Date(), status, link, fileId || '', JSON.stringify(data)];
  if (rec) sh.getRange(rec.row, 1, 1, 6).setValues([row]);
  else sh.appendRow(row);
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
