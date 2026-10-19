/**
 * Aplikasi Rapor SD — uji beban di server Google yang sebenarnya.
 *
 * Cara pakai (pengelola): di editor Apps Script pilih fungsi "ujiBeban" lalu klik Jalankan. Selesai ±2–4 menit.
 * Aktifkan dulu layanan lanjutan "Google Sheets API" (Layanan + → Google Sheets API → Tambahkan) agar baca sekaligus dipakai.
 * Yang dilakukan:
 *   1. membuat sekolah uji sementara (status "uji", tidak bisa dipakai masuk) di folder Data Sekolah;
 *   2. mengisi 6 kelas × 2 rombel × 32 siswa = 384 siswa, TP, dan nilai SATU TAHUN penuh (dua semester);
 *   3. mengukur waktu operasi yang dipakai guru sehari-hari;
 *   4. mencatat hasil ke sheet Log di spreadsheet Pusat (aksi "uji beban") dan ke log eksekusi;
 *   5. menghapus sekolah uji (baris Pusat dan spreadsheet-nya dibuang ke sampah), juga bila uji gagal di tengah.
 */

function ujiBeban() {
  var npsn = 'UJI' + new Date().getTime();
  var id = null, hasil = [], mulaiSemua = new Date().getTime();
  var catat = function (teks) { Logger.log(teks); hasil.push(teks); catatPusat_(npsn, 'uji beban', teks); };
  try {
    id = buatSpreadsheetSekolah_({ npsn: npsn, nama: 'SEKOLAH UJI BEBAN', email: 'uji@contoh.invalid', tp: [] });
    pusat_().getSheetByName(PUSAT.sekolah).appendRow([npsn, 'SEKOLAH UJI BEBAN', '', '', '', 'uji', id, new Date(), '', '', 0, '']);
    catat('mulai: spreadsheet uji dibuat (' + detik_(mulaiSemua) + ' dtk)');
    isiSekolahUji_(npsn, catat);

    siapkanPermintaan_('');
    var ss = bukaSekolah_(npsn), ta = aturSekolah_(ss).tahunAjaran;
    var rombel = daftarRombel_(ss, ta).filter(function (r) { return r.kelas === 5; })[0];

    // Uji selalu mencoba ulang Sheets API (penolakan lama yang diingat 1 jam dihapus dulu).
    CacheService.getScriptCache().remove('sheetsapi:mati');
    // Rincian biaya dasar, agar jelas bagian mana yang lambat.
    var t0 = new Date().getTime();
    var ssBaru = SpreadsheetApp.openById(ss.getId());
    catat('rincian: buka spreadsheet ' + detik_(t0) + ' dtk');
    t0 = new Date().getTime(); ssBaru.getSheetByName('Pengaturan').getDataRange().getValues();
    catat('rincian: baca 1 sheet kecil ' + detik_(t0) + ' dtk');
    t0 = new Date().getTime(); var n = ssBaru.getSheetByName('Nilai').getDataRange().getValues().length;
    catat('rincian: baca sheet Nilai ' + (n - 1) + ' baris ' + detik_(t0) + ' dtk');
    ISI_SHEET_ = {}; t0 = new Date().getTime();
    var api = bacaSekaligus_(ssBaru, BACA_PER_AKSI_.nilaiRombel);
    catat(api ? 'rincian: baca 8 sheet sekaligus (' + CARA_BACA_SEKALIGUS_ + ') ' + detik_(t0) + ' dtk'
      : 'rincian: baca sekaligus TIDAK dipakai — ' + GALAT_BACA_SEKALIGUS_ + '. Memakai cara biasa.');

    var ukur = function (nama, aksi, fn) {
      siapkanPermintaan_(aksi);
      var t = new Date().getTime(), h = fn();
      if (h && h.ok === false) throw new Error(nama + ': ' + h.pesan);
      catat(nama + ': ' + detik_(t) + ' dtk');
      return h;
    };
    ukur('buka data sekolah', 'dataSekolah', function () { return dataSekolah_(npsn); });
    var layar = ukur('buka layar nilai MTK 5A', 'nilaiRombel', function () { return nilaiRombel_(npsn, { rombel: rombel.id, mapel: 'MTK', semester: 1 }); });
    var nilai = {};
    layar.siswa.forEach(function (s, i) { nilai[s.id] = { TES: 80 }; layar.tp.forEach(function (t) { nilai[s.id][t.kode] = 60 + (i % 40); }); });
    ukur('simpan nilai MTK 5A (32 siswa berubah)', 'simpanNilai', function () { return simpanNilai_(npsn, { rombel: rombel.id, mapel: 'MTK', varian: '', semester: 1, nilai: nilai }); });
    nilai[layar.siswa[0].id].TES = 81;
    ukur('simpan nilai MTK 5A (1 angka berubah)', 'simpanNilai', function () { return simpanNilai_(npsn, { rombel: rombel.id, mapel: 'MTK', varian: '', semester: 1, nilai: nilai }); });
    ukur('buka kokurikuler 5A', 'kokRombel', function () { return kokRombel_(npsn, { rombel: rombel.id, semester: 1 }); });
    ukur('buka wali kelas 5A', 'waliRombel', function () { return waliRombel_(npsn, { rombel: rombel.id, semester: 1 }); });
    var presensi = {};
    layar.siswa.forEach(function (s) { presensi[s.id] = { sakit: 1, izin: 0, alpa: 0, catatan: 'Tingkatkan semangat belajar.' }; });
    ukur('simpan ketidakhadiran 5A', 'simpanPresensi', function () { return simpanPresensi_(npsn, { rombel: rombel.id, semester: 1, presensi: presensi }); });
    ukur('buka TP kelas 5', 'tpKelas', function () { return tpKelas_(npsn, 5, 1); });
    ukur('cek & cetak rapor 5A (rekap)', 'rekapRombel', function () { return rekapRombel_(npsn, { rombel: rombel.id, semester: 1 }); });
    ukur('kunci lalu buka kunci 5A', 'kunciRapor', function () {
      kunciRapor_(npsn, { rombel: rombel.id, semester: 1 });
      return bukaKunciRapor_(npsn, { rombel: rombel.id, semester: 1, alasan: 'uji beban' });
    });
    catat('SELESAI: semua operasi berhasil. Total ' + detik_(mulaiSemua) + ' dtk.');
  } catch (e) {
    catat('GAGAL: ' + e.message);
    throw e;
  } finally {
    hapusSekolahUji_(npsn, id);
  }
  return hasil.join('\n');
}

function detik_(sejak) { return Math.round((new Date().getTime() - sejak) / 100) / 10; }

/** 384 siswa, TP 4 per mapel/varian, dan nilai dua semester, ditulis sekaligus (bukan lewat layar) agar cepat. */
function isiSekolahUji_(npsn, catat) {
  var t = new Date().getTime();
  var ss = bukaSekolah_(npsn);
  simpanProfil_(npsn, {}, 1, ['Seni Musik', 'Seni Rupa']);
  for (var k = 1; k <= 6; k++) {
    ['A', 'B'].forEach(function (n) {
      ISI_SHEET_ = {};
      var r = simpanRombel_(npsn, { kelas: k, nama: n, wali: 'Guru ' + k + n });
      if (!r.ok) throw new Error('rombel: ' + r.pesan);
      var siswa = [];
      for (var i = 0; i < 32; i++) {
        siswa.push({ nama: 'SISWA ' + k + n + ' ' + (i + 1), jk: i % 2 ? 'L' : 'P', agama: i % 8 === 3 ? 'Kristen' : 'Islam',
          seni: i % 3 ? 'Musik' : 'Musik, Rupa', nisn: String(3000000000 + k * 1000 + (n === 'B' ? 500 : 0) + i) });
      }
      var s = simpanSiswa_(npsn, r.rombel.id, siswa, 32);
      if (!s.ok) throw new Error('siswa: ' + s.pesan);
    });
  }
  catat('isi rombel & 384 siswa: ' + detik_(t) + ' dtk');

  t = new Date().getTime();
  ISI_SHEET_ = {};
  var ta = aturSekolah_(ss).tahunAjaran;
  var tp = [], tpPer = {};
  for (var kelas = 1; kelas <= 6; kelas++) {
    mapelAktifKelas_(ss, ta, kelas).forEach(function (m) {
      var varian = m.jenis === 'agama' ? ['Islam', 'Kristen'] : m.jenis === 'seni' ? ['Seni Musik', 'Seni Rupa'] : [''];
      [1, 2].forEach(function (sem) {
        var no = 0;
        varian.forEach(function (v) {
          var kode = [];
          for (var x = 1; x <= 4; x++) {
            no++;
            kode.push('TP' + no);
            tp.push({ 'Tahun Ajaran': ta, Semester: sem, Kelas: kelas, 'Kode Mapel': m.kode, Varian: v, 'Kode TP': 'TP' + no,
              'Lingkup Materi': 'materi ' + x, 'Tujuan Pembelajaran': 'Peserta didik mampu memahami materi ' + x + ' ' + m.nama });
          }
          tpPer[kelas + '|' + sem + '|' + m.kode + '|' + v] = kode;
        });
      });
    });
  }
  tulisTabel_(ss, 'Tujuan Pembelajaran', tp);

  var nilai = [], waktu = new Date();
  daftarRombel_(ss, ta).forEach(function (r) {
    var mapel = mapelAktifKelas_(ss, ta, r.kelas);
    siswaUrut_(ss, ta, r.id).forEach(function (s, i) {
      [1, 2].forEach(function (sem) {
        mapel.forEach(function (m) {
          var varian = m.jenis === 'agama' ? [s.agama] : m.jenis === 'seni' ? s.seni : [''];
          varian.forEach(function (v) {
            (tpPer[r.kelas + '|' + sem + '|' + m.kode + '|' + v] || []).forEach(function (kode, j) {
              nilai.push({ 'Tahun Ajaran': ta, Semester: sem, 'ID Siswa': s.id, 'Kode Mapel': m.kode, Jenis: 'TP', Kode: kode,
                Nilai: 65 + ((i + j * 7) % 35), 'Diubah Pada': waktu });
            });
            nilai.push({ 'Tahun Ajaran': ta, Semester: sem, 'ID Siswa': s.id, 'Kode Mapel': m.kode, Jenis: 'SAS', Kode: kodeSas_(v, 'TES'),
              Nilai: 70 + (i % 25), 'Diubah Pada': waktu });
          });
        });
      });
    });
  });
  tulisTabel_(ss, 'Nilai', nilai);
  catat('isi ' + tp.length + ' TP dan ' + nilai.length + ' nilai (1 tahun): ' + detik_(t) + ' dtk');
}

function hapusSekolahUji_(npsn, id) {
  try {
    var sh = pusat_().getSheetByName(PUSAT.sekolah), rows = sh.getDataRange().getValues();
    for (var i = rows.length - 1; i >= 1; i--) if (String(rows[i][0]) === npsn) sh.deleteRow(i + 1);
  } catch (e) { Logger.log('gagal menghapus baris uji: ' + e.message); }
  try { if (id) DriveApp.getFileById(id).setTrashed(true); } catch (e2) { Logger.log('gagal membuang spreadsheet uji: ' + e2.message); }
}
