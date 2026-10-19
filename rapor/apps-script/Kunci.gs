/**
 * Aplikasi Rapor SD — kunci rapor.
 *
 * Setelah rapor satu rombel pada satu semester final, rapor dikunci: nilai, capaian kokurikuler, ekstrakurikuler,
 * ketidakhadiran, catatan, dan kenaikan rombel itu tidak bisa diubah. Hal yang berlaku untuk seluruh kelas
 * (TP, subdimensi kokurikuler, mapel aktif) dan narasi yang dipakai kelas itu juga terkunci.
 * Karena satu akun dipakai bersama, kunci melindungi dari salah ubah, bukan dari orang yang berniat jahat:
 * kunci bisa dibuka lagi dengan menuliskan alasan, dan semuanya tercatat di Log sekolah.
 * Disimpan di Pengaturan "Rapor Terkunci": entri "tahunAjaran|semester|idRombel|waktu" dipisah titik koma.
 */

var KUNCI_RAPOR = 'Rapor Terkunci';

/** Menulis satu kunci di sheet Pengaturan; baris dibuat bila belum ada (spreadsheet versi lama). */
function aturPengaturan_(ss, kunci, nilai, keterangan) {
  var rows = bacaTabel_(ss, 'Pengaturan'), ada = false;
  rows.forEach(function (r) { if (teks_(r.Kunci) === kunci) { r.Nilai = nilai; ada = true; } });
  if (!ada) rows.push({ Kunci: kunci, Nilai: nilai, Keterangan: keterangan || '' });
  tulisTabel_(ss, 'Pengaturan', rows);
}

function daftarKunci_(ss) {
  return teks_(bacaKunciNilai_(ss, 'Pengaturan')[KUNCI_RAPOR]).split(';').map(teks_).filter(String).map(function (x) {
    var p = x.split('|');
    return { ta: p[0], sem: Number(p[1]), rombel: p[2], waktu: p[3] || '' };
  });
}

function kunciRombel_(ss, ta, sem, rombelId) {
  return daftarKunci_(ss).filter(function (x) { return x.ta === ta && x.sem === sem && x.rombel === rombelId; })[0] || null;
}

/** Rombel kelas ini yang terkunci pada semester itu (sem kosong = semester mana pun). */
function rombelKelasTerkunci_(ss, ta, sem, kelas) {
  var idKelas = {};
  daftarRombel_(ss, ta).forEach(function (r) { if (r.kelas === kelas) idKelas[r.id] = r; });
  return daftarKunci_(ss).filter(function (x) { return x.ta === ta && (!sem || x.sem === sem) && idKelas[x.rombel]; })
    .map(function (x) { return idKelas[x.rombel]; });
}

function pesanTerkunci_(rombel, sem) {
  return 'Rapor ' + labelRombel_(rombel) + ' semester ' + sem + ' sudah dikunci, jadi tidak bisa diubah. ' +
    'Jika memang perlu, buka kunci di menu Cek & Cetak Rapor.';
}

/** Galat bila rapor rombel ini terkunci. */
function cekTerkunci_(ss, ta, sem, rombel) {
  if (kunciRombel_(ss, ta, sem, rombel.id)) throw galatPengguna_(pesanTerkunci_(rombel, sem));
}

/** Galat bila ada rombel kelas ini yang terkunci (untuk TP, subdimensi, mapel: berlaku sekelas). */
function cekKelasTerkunci_(ss, ta, sem, kelas) {
  var r = rombelKelasTerkunci_(ss, ta, sem, kelas)[0];
  if (r) throw galatPengguna_('Ada rapor kelas ' + kelas + ' yang sudah dikunci (' + labelRombel_(r) + (sem ? ' semester ' + sem : '') +
    '). Pengaturan yang berlaku untuk seluruh kelas ' + kelas + ' tidak bisa diubah. Buka kunci di menu Cek & Cetak Rapor jika memang perlu.');
}

function infoKunci_(ss, ta, sem, rombelId) {
  var x = kunciRombel_(ss, ta, sem, rombelId);
  return x ? { waktu: x.waktu } : null;
}

/* ---------- aksi ---------- */

function kunciRapor_(npsn, req) {
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var k = konteksWali_(ss, req || {});
    if (k.galat) return { ok: false, pesan: k.galat };
    if (kunciRombel_(ss, k.ta, k.sem, k.rombel.id)) return { ok: false, pesan: 'Rapor ini sudah terkunci.' };
    var waktu = Utilities.formatDate ? Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm') : new Date().toISOString();
    var semua = daftarKunci_(ss).concat([{ ta: k.ta, sem: k.sem, rombel: k.rombel.id, waktu: waktu }]);
    aturPengaturan_(ss, KUNCI_RAPOR, semua.map(function (x) { return [x.ta, x.sem, x.rombel, x.waktu].join('|'); }).join('; '),
      'Diatur dari menu Cek & Cetak Rapor. Jangan diubah langsung.');
    catatSekolah_(ss, 'kunci rapor', labelRombel_(k.rombel) + ' smt ' + k.sem);
    return { ok: true, terkunci: { waktu: waktu }, pesan: 'Rapor ' + labelRombel_(k.rombel) + ' semester ' + k.sem + ' dikunci. Nilai dan isian rombel ini tidak bisa diubah lagi.' };
  });
}

function bukaKunciRapor_(npsn, req) {
  var alasan = teks_(req && req.alasan);
  if (alasan.length < 5) return { ok: false, pesan: 'Tuliskan alasan membuka kunci (minimal 5 huruf). Alasan dicatat di log sekolah.' };
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var k = konteksWali_(ss, req || {});
    if (k.galat) return { ok: false, pesan: k.galat };
    if (!kunciRombel_(ss, k.ta, k.sem, k.rombel.id)) return { ok: false, pesan: 'Rapor ini tidak sedang terkunci.' };
    var sisa = daftarKunci_(ss).filter(function (x) { return !(x.ta === k.ta && x.sem === k.sem && x.rombel === k.rombel.id); });
    aturPengaturan_(ss, KUNCI_RAPOR, sisa.map(function (x) { return [x.ta, x.sem, x.rombel, x.waktu].join('|'); }).join('; '));
    catatSekolah_(ss, 'buka kunci rapor', labelRombel_(k.rombel) + ' smt ' + k.sem + ' — alasan: ' + alasan.slice(0, 200));
    return { ok: true, terkunci: null, pesan: 'Kunci rapor ' + labelRombel_(k.rombel) + ' semester ' + k.sem + ' dibuka. Jangan lupa mengunci lagi setelah selesai.' };
  });
}
