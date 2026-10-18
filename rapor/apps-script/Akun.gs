/**
 * Aplikasi Rapor SD — akun sekolah: daftar, verifikasi email, masuk, keluar, lupa & ganti kata sandi.
 *
 * Satu sekolah = satu akun (email sekolah + kata sandi khusus aplikasi ini), dipakai bersama semua gurunya.
 * Kata sandi tidak pernah disimpan apa adanya: yang disimpan hanya hash HMAC-SHA256 berulang + garam acak.
 * Token verifikasi dan reset juga hanya disimpan hash-nya.
 */

var ITERASI_HASH = 500;
var BATAS_GAGAL_MASUK = 5;
var MENIT_KUNCI = 15;
var DETIK_SESI = 21600; // 6 jam, batas maksimal CacheService
var JAM_TOKEN = { verifikasi: 48, reset: 1 };
var JAM_TUNGGU_VERIFIKASI = 48; // pendaftaran yang tidak diverifikasi selama ini boleh ditimpa

var STATUS = { menunggu: 'Menunggu verifikasi', aktif: 'Aktif', nonaktif: 'Nonaktif' };

/* ---------- pemeriksaan isian (murni, diuji di tes) ---------- */

function bersihkanEmail_(email) { return String(email || '').trim().toLowerCase(); }

function bersihkanNpsn_(npsn) { return String(npsn || '').trim().toUpperCase(); }

function emailSah_(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 120; }

/** Daftar pesan kesalahan kata sandi (kosong = boleh dipakai). */
function cekSandiBaru_(sandi, ulangi, larangan) {
  var s = String(sandi || '');
  var salah = [];
  if (s.length < 8) salah.push('Kata sandi minimal 8 karakter.');
  if (s.length > 100) salah.push('Kata sandi maksimal 100 karakter.');
  if (s.trim() !== s) salah.push('Kata sandi tidak boleh diawali atau diakhiri spasi.');
  if (/^\d+$/.test(s)) salah.push('Kata sandi jangan hanya angka. Campurkan huruf dan angka.');
  (larangan || []).forEach(function (l) {
    if (l && s.toLowerCase() === String(l).toLowerCase()) salah.push('Kata sandi jangan sama dengan NPSN atau email.');
  });
  if (ulangi !== undefined && s !== String(ulangi || '')) salah.push('Ulangi kata sandi tidak sama.');
  return salah;
}

/** Memeriksa isian formulir daftar. Hasil: daftar pesan kesalahan (kosong = benar). */
function cekPendaftaran_(d) {
  var salah = [];
  var npsn = bersihkanNpsn_(d.npsn);
  var email = bersihkanEmail_(d.email);
  var nama = String(d.nama || '').trim();
  if (!/^[0-9A-Z]{8}$/.test(npsn)) salah.push('NPSN harus 8 karakter (umumnya 8 angka).');
  if (nama.length < 3 || nama.length > 100) salah.push('Nama sekolah wajib diisi (3–100 karakter).');
  if (!emailSah_(email)) salah.push('Alamat email tidak valid.');
  salah = salah.concat(cekSandiBaru_(d.sandi, d.ulangi, [npsn, email]));
  if (d.setuju !== true) salah.push('Centang persetujuan pengelolaan data terlebih dahulu.');
  return salah;
}

/* ---------- hash & token ---------- */

function heks_(bytes) {
  return bytes.map(function (b) { var h = (b < 0 ? b + 256 : b).toString(16); return h.length === 1 ? '0' + h : h; }).join('');
}

function hashSandi_(sandi, garam) {
  var h = String(sandi);
  for (var i = 0; i < ITERASI_HASH; i++) h = heks_(Utilities.computeHmacSha256Signature(h, garam));
  return h;
}

function hashToken_(token) {
  return heks_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token)));
}

function acak_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }

/** Perbandingan yang waktunya tidak bergantung pada letak karakter pertama yang berbeda. */
function samaPersis_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var beda = 0;
  for (var i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

/* ---------- tabel Sekolah di spreadsheet Pusat ---------- */

function bacaSekolah_() {
  var rows = pusat_().getSheetByName(PUSAT.sekolah).getDataRange().getValues();
  var hasil = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    hasil.push({
      baris: i + 1, npsn: String(r[0]), nama: String(r[1]), email: String(r[2]), hash: String(r[3]), garam: String(r[4]),
      status: String(r[5]), spreadsheet: String(r[6]), terdaftar: r[7], diverifikasi: r[8], masukTerakhir: r[9],
      gagal: Number(r[10]) || 0, terkunciSampai: r[11]
    });
  }
  return hasil;
}

function cariSekolah_(kunci, nilai) {
  var semua = bacaSekolah_();
  for (var i = 0; i < semua.length; i++) if (semua[i][kunci] === nilai) return semua[i];
  return null;
}

function tulisKolom_(baris, nama, nilai) {
  pusat_().getSheetByName(PUSAT.sekolah).getRange(baris, KOLOM_SEKOLAH.indexOf(nama) + 1).setValue(nilai);
}

function ringkasSekolah_(npsn) {
  var s = cariSekolah_('npsn', npsn);
  if (!s) return null;
  return { npsn: s.npsn, nama: s.nama, email: s.email };
}

function kedaluwarsaMenunggu_(s) {
  return s.status === STATUS.menunggu &&
    new Date().getTime() - new Date(s.terdaftar).getTime() > JAM_TUNGGU_VERIFIKASI * 3600000;
}

/* ---------- token verifikasi / reset ---------- */

function buatToken_(npsn, jenis) {
  var token = acak_();
  var sampai = new Date(new Date().getTime() + JAM_TOKEN[jenis] * 3600000);
  pusat_().getSheetByName(PUSAT.token).appendRow([hashToken_(token), npsn, jenis, sampai, '']);
  return token;
}

/** Mencari token yang sah. Tidak menandainya terpakai. */
function cariToken_(token, jenis) {
  if (!token || String(token).length < 32) return null;
  var hash = hashToken_(token);
  var sh = pusat_().getSheetByName(PUSAT.token);
  var rows = sh.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (!samaPersis_(rows[i][0], hash) || rows[i][2] !== jenis) continue;
    return {
      baris: i + 1, npsn: String(rows[i][1]), dipakai: !!rows[i][4],
      kedaluwarsa: new Date(rows[i][3]).getTime() < new Date().getTime()
    };
  }
  return null;
}

function pakaiToken_(t) { pusat_().getSheetByName(PUSAT.token).getRange(t.baris, 5).setValue(new Date()); }

/** Mematikan token lama yang belum terpakai (mis. tautan reset sebelumnya). */
function matikanToken_(npsn, jenis) {
  var sh = pusat_().getSheetByName(PUSAT.token);
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === npsn && rows[i][2] === jenis && !rows[i][4]) sh.getRange(i + 1, 5).setValue('dibatalkan');
  }
}

/* ---------- email ---------- */

function kirimEmail_(ke, judul, paragraf, tautan, teksTombol) {
  var p = pengaturanPusat_();
  var html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#16202a;max-width:520px">' +
    paragraf.map(function (x) { return '<p>' + x + '</p>'; }).join('') +
    '<p><a href="' + tautan + '" style="display:inline-block;background:#d71920;color:#fff;padding:12px 20px;' +
    'border-radius:10px;text-decoration:none;font-weight:bold">' + teksTombol + '</a></p>' +
    '<p style="font-size:13px;color:#64748b">Jika tombol tidak bisa diklik, salin alamat ini ke browser:<br>' + tautan + '</p>' +
    '<p style="font-size:13px;color:#64748b">Abaikan email ini jika Anda tidak merasa melakukannya.</p></div>';
  MailApp.sendEmail({ to: ke, subject: p.namaAplikasi + ' — ' + judul, htmlBody: html, name: p.namaAplikasi });
}

function escHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- daftar & verifikasi ---------- */

function daftar_(d) {
  if (!pengaturanPusat_().daftarDibuka) return { ok: false, pesan: 'Pendaftaran sekolah baru sedang ditutup.' };
  var salah = cekPendaftaran_(d);
  if (salah.length) return { ok: false, salah: salah, pesan: salah[0] };
  if (MailApp.getRemainingDailyQuota() < 1) {
    return { ok: false, pesan: 'Kuota email harian aplikasi sudah habis. Silakan daftar lagi besok.' };
  }
  var npsn = bersihkanNpsn_(d.npsn), email = bersihkanEmail_(d.email), nama = String(d.nama).trim();

  var token = denganKunci_(function () {
    var semua = bacaSekolah_();
    var lama = null;
    // dari bawah ke atas, agar menghapus baris tidak menggeser nomor baris yang belum diperiksa
    for (var i = semua.length - 1; i >= 0; i--) {
      var s = semua[i];
      if (s.npsn !== npsn && s.email !== email) continue;
      if (!kedaluwarsaMenunggu_(s)) {
        if (s.npsn === npsn) {
          return { gagal: s.status === STATUS.menunggu
            ? 'NPSN ini sudah didaftarkan dan menunggu verifikasi email. Periksa kotak masuk (dan folder spam) email sekolah.'
            : 'NPSN ini sudah terdaftar. Gunakan menu Masuk atau Lupa kata sandi.' };
        }
        return { gagal: 'Email ini sudah dipakai sekolah lain. Satu email hanya untuk satu sekolah.' };
      }
      if (s.npsn === npsn) lama = s;
      else hapusBarisSekolah_(s.baris); // pendaftaran kedaluwarsa dengan email yang sama: dibuang
    }
    var garam = acak_();
    var baris = [npsn, nama, email, hashSandi_(d.sandi, garam), garam, STATUS.menunggu, '', new Date(), '', '', 0, ''];
    if (lama) {
      var segar = cariSekolah_('npsn', npsn); // baris bisa bergeser setelah penghapusan di atas
      pusat_().getSheetByName(PUSAT.sekolah).getRange(segar.baris, 1, 1, baris.length).setValues([baris]);
      matikanToken_(npsn, 'verifikasi');
    } else {
      pusat_().getSheetByName(PUSAT.sekolah).appendRow(baris);
    }
    return { token: buatToken_(npsn, 'verifikasi') };
  });
  if (token.gagal) return { ok: false, pesan: token.gagal };

  kirimEmail_(email, 'Verifikasi pendaftaran ' + nama, [
    'Yth. Operator <b>' + escHtml_(nama) + '</b> (NPSN ' + npsn + '),',
    'Terima kasih telah mendaftar. Klik tombol di bawah untuk mengaktifkan akun sekolah. ' +
    'Spreadsheet rapor sekolah akan dibuat otomatis setelah akun aktif.',
    'Tautan berlaku ' + JAM_TOKEN.verifikasi + ' jam.'
  ], pengaturanPusat_().alamat + '?verifikasi=' + token.token, 'Aktifkan Akun Sekolah');
  catatPusat_(npsn, 'daftar', nama + ' / ' + email);
  return { ok: true, pesan: 'Pendaftaran tersimpan. Kami mengirim tautan aktivasi ke ' + email +
    '. Buka email itu (periksa juga folder spam) untuk mengaktifkan akun.' };
}

function hapusBarisSekolah_(baris) { pusat_().getSheetByName(PUSAT.sekolah).deleteRow(baris); }

function verifikasi_(token) {
  var t = cariToken_(token, 'verifikasi');
  if (!t) return { ok: false, pesan: 'Tautan aktivasi tidak dikenal. Pastikan tautan disalin lengkap.' };
  var s = cariSekolah_('npsn', t.npsn);
  if (!s) return { ok: false, pesan: 'Pendaftaran sekolah tidak ditemukan. Silakan daftar ulang.' };
  if (s.status === STATUS.aktif) return { ok: true, sudahAktif: true, pesan: 'Akun sekolah sudah aktif. Silakan masuk.' };
  if (t.dipakai) return { ok: false, pesan: 'Tautan ini sudah tidak berlaku. Gunakan tautan di email terbaru.' };
  if (t.kedaluwarsa) return { ok: false, pesan: 'Tautan aktivasi sudah kedaluwarsa. Silakan daftar ulang.' };

  // Spreadsheet dibuat di luar kunci (butuh beberapa detik), lalu dicatat di dalam kunci.
  var id = buatSpreadsheetSekolah_({ npsn: s.npsn, nama: s.nama, email: s.email });
  var hasil = denganKunci_(function () {
    var segar = cariSekolah_('npsn', t.npsn);
    if (segar && segar.status === STATUS.aktif) return 'sudah';
    tulisKolom_(segar.baris, 'ID Spreadsheet', id);
    tulisKolom_(segar.baris, 'Status', STATUS.aktif);
    tulisKolom_(segar.baris, 'Diverifikasi Pada', new Date());
    pakaiToken_(t);
    return 'baru';
  });
  if (hasil === 'sudah') {
    DriveApp.getFileById(id).setTrashed(true); // permintaan ganda: spreadsheet kedua dibuang
    return { ok: true, sudahAktif: true, pesan: 'Akun sekolah sudah aktif. Silakan masuk.' };
  }
  catatPusat_(s.npsn, 'verifikasi', id);
  return { ok: true, pesan: 'Akun ' + s.nama + ' sudah aktif dan spreadsheet sekolah sudah dibuat. Silakan masuk.' };
}

/* ---------- masuk & sesi ---------- */

function masuk_(email, sandi) {
  email = bersihkanEmail_(email);
  var umum = { ok: false, pesan: 'Email atau kata sandi salah.' };
  if (!emailSah_(email) || !sandi) return umum;
  return denganKunci_(function () {
    var s = cariSekolah_('email', email);
    if (!s) return umum;
    if (s.terkunciSampai && new Date(s.terkunciSampai).getTime() > new Date().getTime()) {
      return { ok: false, pesan: 'Terlalu banyak percobaan salah. Akun dikunci sementara, coba lagi ' + MENIT_KUNCI + ' menit lagi.' };
    }
    if (!samaPersis_(hashSandi_(sandi, s.garam), s.hash)) {
      var gagal = s.gagal + 1;
      tulisKolom_(s.baris, 'Gagal Masuk', gagal >= BATAS_GAGAL_MASUK ? 0 : gagal);
      if (gagal >= BATAS_GAGAL_MASUK) {
        tulisKolom_(s.baris, 'Terkunci Sampai', new Date(new Date().getTime() + MENIT_KUNCI * 60000));
        catatPusat_(s.npsn, 'dikunci', BATAS_GAGAL_MASUK + ' kali salah kata sandi');
      }
      return umum;
    }
    if (s.status === STATUS.menunggu) {
      return { ok: false, pesan: 'Akun belum aktif. Klik tautan aktivasi yang dikirim ke ' + s.email + '.' };
    }
    if (s.status !== STATUS.aktif) return { ok: false, pesan: 'Akun sekolah ini dinonaktifkan. Hubungi pengelola aplikasi.' };
    if (s.gagal) tulisKolom_(s.baris, 'Gagal Masuk', 0);
    tulisKolom_(s.baris, 'Masuk Terakhir', new Date());
    var sesi = acak_();
    CacheService.getScriptCache().put('sesi:' + hashToken_(sesi), isiSesi_(s), DETIK_SESI);
    return { ok: true, sesi: sesi, sekolah: ringkasSekolah_(s.npsn) };
  });
}

/* Isi sesi memuat sidik garam kata sandi: begitu kata sandi diganti, semua sesi lama otomatis tidak berlaku. */
function isiSesi_(s) { return s.npsn + '|' + s.garam.slice(0, 16); }

/** Sesi yang masih berlaku → { npsn }. Setiap dipakai, masa berlakunya diperpanjang. */
function bacaSesi_(sesi) {
  if (!sesi || String(sesi).length < 32) return null;
  var kunci = 'sesi:' + hashToken_(sesi);
  var cache = CacheService.getScriptCache();
  var isi = cache.get(kunci);
  if (!isi) return null;
  var s = cariSekolah_('npsn', String(isi).split('|')[0]);
  if (!s || s.status !== STATUS.aktif || isi !== isiSesi_(s)) { cache.remove(kunci); return null; }
  cache.put(kunci, isi, DETIK_SESI);
  return { npsn: s.npsn };
}

function keluar_(sesi) {
  CacheService.getScriptCache().remove('sesi:' + hashToken_(sesi));
  return { ok: true };
}

/* ---------- kata sandi ---------- */

function lupaSandi_(email) {
  email = bersihkanEmail_(email);
  var jawab = { ok: true, pesan: 'Jika email itu terdaftar, tautan untuk membuat kata sandi baru sudah dikirim. ' +
    'Periksa kotak masuk dan folder spam. Tautan berlaku ' + JAM_TOKEN.reset + ' jam.' };
  if (!emailSah_(email)) return { ok: false, pesan: 'Alamat email tidak valid.' };
  var s = cariSekolah_('email', email);
  if (!s || s.status !== STATUS.aktif) return jawab; // jawaban sama agar email terdaftar tidak bisa ditebak
  if (MailApp.getRemainingDailyQuota() < 1) return { ok: false, pesan: 'Kuota email harian aplikasi habis. Coba lagi besok.' };
  var token = denganKunci_(function () {
    matikanToken_(s.npsn, 'reset');
    return buatToken_(s.npsn, 'reset');
  });
  kirimEmail_(s.email, 'Buat kata sandi baru', [
    'Yth. Operator <b>' + escHtml_(s.nama) + '</b>,',
    'Ada permintaan membuat kata sandi baru untuk akun rapor sekolah Anda. Klik tombol di bawah untuk melanjutkan.'
  ], pengaturanPusat_().alamat + '?reset=' + token, 'Buat Kata Sandi Baru');
  catatPusat_(s.npsn, 'lupa sandi', '');
  return jawab;
}

function resetSandi_(token, sandi, ulangi) {
  var t = cariToken_(token, 'reset');
  if (!t || t.dipakai || t.kedaluwarsa) {
    return { ok: false, pesan: 'Tautan sudah tidak berlaku. Minta tautan baru lewat menu Lupa kata sandi.' };
  }
  var s = cariSekolah_('npsn', t.npsn);
  if (!s || s.status !== STATUS.aktif) return { ok: false, pesan: 'Akun sekolah tidak aktif.' };
  var salah = cekSandiBaru_(sandi, ulangi, [s.npsn, s.email]);
  if (salah.length) return { ok: false, salah: salah, pesan: salah[0] };
  denganKunci_(function () {
    simpanSandi_(s, sandi);
    pakaiToken_(t);
  });
  catatPusat_(s.npsn, 'reset sandi', '');
  return { ok: true, pesan: 'Kata sandi baru tersimpan. Silakan masuk.' };
}

function gantiSandi_(npsn, lama, baru, ulangi) {
  var s = cariSekolah_('npsn', npsn);
  if (!samaPersis_(hashSandi_(lama || '', s.garam), s.hash)) return { ok: false, pesan: 'Kata sandi lama salah.' };
  var salah = cekSandiBaru_(baru, ulangi, [s.npsn, s.email]);
  if (lama === baru) salah.push('Kata sandi baru harus berbeda dari yang lama.');
  if (salah.length) return { ok: false, salah: salah, pesan: salah[0] };
  denganKunci_(function () { simpanSandi_(s, baru); });
  catatPusat_(s.npsn, 'ganti sandi', '');
  // Semua perangkat lain otomatis keluar; perangkat ini diberi sesi baru agar tidak ikut keluar.
  var sesi = acak_();
  CacheService.getScriptCache().put('sesi:' + hashToken_(sesi), isiSesi_(cariSekolah_('npsn', s.npsn)), DETIK_SESI);
  return { ok: true, sesi: sesi, pesan: 'Kata sandi sudah diganti dan semua perangkat lain otomatis keluar. ' +
    'Beritahukan kata sandi baru kepada guru di sekolah Anda.' };
}

function simpanSandi_(s, sandi) {
  var garam = acak_();
  tulisKolom_(s.baris, 'Garam', garam);
  tulisKolom_(s.baris, 'Hash Sandi', hashSandi_(sandi, garam));
  tulisKolom_(s.baris, 'Gagal Masuk', 0);
  tulisKolom_(s.baris, 'Terkunci Sampai', '');
}
