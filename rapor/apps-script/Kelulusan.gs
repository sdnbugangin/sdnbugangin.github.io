/**
 * Aplikasi Rapor SD — transkrip nilai dan Surat Keterangan Lulus (SKL) kelas 6.
 *
 * Nilai tiap mapel = rata-rata nilai rapor (yang tercetak, sudah dibulatkan) kelas 5 semester 1 dan 2,
 * kelas 6 semester 1 dan 2, ditambah nilai praktik bila ada; dua desimal. Rata-rata = rata-rata nilai mapel.
 * Nilai rapor diambil otomatis dari aplikasi (kelas 5 dari tahun ajaran sebelumnya, termasuk Arsip Nilai);
 * setiap angka bisa diisi/ditimpa manual (mis. tahun pertama memakai aplikasi). Isian manual, nomor ijazah,
 * pengaturan surat, dan logo kop disimpan di sheet "Kelulusan" (Tahun Ajaran, ID Siswa, Kunci, Nilai).
 * Baris pengaturan memakai ID Siswa kosong; logo dan kop memakai Tahun Ajaran "*" (berlaku tiap tahun).
 */

var KOLOM_LULUS = ['5-1', '5-2', '6-1', '6-2', 'PRAKTIK'];
var JUDUL_KOLOM_LULUS = { '5-1': 'Kelas 5 Smt 1', '5-2': 'Kelas 5 Smt 2', '6-1': 'Kelas 6 Smt 1', '6-2': 'Kelas 6 Smt 2', PRAKTIK: 'Praktik' };
/* Urutan baris transkrip (sama dengan master); BING dan KKA hanya bila dicentang sekolah. */
var URUT_TRANSKRIP = ['PAB', 'PP', 'BIND', 'MTK', 'IPAS', 'PJOK', 'SENI', 'BING', 'KKA'];
var ATUR_LULUS = {
  kop1: { tahunan: true, judul: 'Kop baris 1 (instansi)' },
  tempat: { tahunan: true, judul: 'Tempat surat' },
  mapelTambahan: { tahunan: true, judul: 'Mapel tambahan' },
  logoPemda: { tahunan: true, judul: 'Logo pemerintah daerah' },
  logoSekolah: { tahunan: true, judul: 'Logo sekolah' },
  nomorTranskrip: { judul: 'Nomor transkrip pertama' },
  nomorSkl: { judul: 'Nomor SKL pertama' },
  nomorSk: { judul: 'Nomor SK kelulusan' },
  tanggalLulus: { judul: 'Tanggal kelulusan' },
  tanggalTranskrip: { judul: 'Tanggal transkrip' }
};
var MAKS_LOGO = 48000; // karakter data URI; satu sel Google Sheets maksimal 50.000

/** "2026/2027" → "2025/2026". */
function tahunAjaranSebelum_(ta) {
  var m = teks_(ta).match(/^(\d{4})\/(\d{4})$/);
  return m ? (Number(m[1]) - 1) + '/' + m[1] : '';
}

/** Nomor ke-i dari nomor pertama: angka terakhir dinaikkan, nol di depan dipertahankan ("400.3.11/060/SD" → ".../061/SD"). */
function nomorKe_(awal, i) {
  var s = teks_(awal);
  var m = s.match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return s;
  var n = String(Number(m[2]) + i);
  while (n.length < m[2].length) n = '0' + n;
  return m[1] + n + m[3];
}

/** "85.3125" → 85.31; kosong → null. */
function duaDesimal_(v) { return v === null || v === undefined || v === '' ? null : Math.round(Number(v) * 100 + 1e-9) / 100; }

/* ---------- baca ---------- */

function bacaKelulusan_(ss, ta) {
  pastikanSheet_(ss, 'Kelulusan');
  var atur = {}, siswa = {};
  bacaTabel_(ss, 'Kelulusan').forEach(function (r) {
    var t = teks_(r['Tahun Ajaran']), id = teks_(r['ID Siswa']), k = teks_(r.Kunci), v = r.Nilai === undefined ? '' : String(r.Nilai);
    if (!id && (t === '*' || t === ta)) { if (t === ta || atur[k] === undefined) atur[k] = v; return; }
    if (t !== ta || !id) return;
    (siswa[id] = siswa[id] || {})[k] = v;
  });
  return { atur: atur, siswa: siswa };
}

/**
 * Nilai rapor tercetak satu tahun ajaran-semester untuk siswa kelas tertentu: { idSiswa: { kodeMapel: nilai } }.
 * Hanya nilai yang lengkap (TP dan sumatif akhir) yang dipakai. nilaiBaris = baris sheet Nilai + Arsip Nilai.
 */
function nilaiRaporTahun_(ss, ta, kelas, sem, nilaiBaris, aturan) {
  var hasil = {}, siswa = [];
  daftarRombel_(ss, ta).filter(function (r) { return r.kelas === kelas; }).forEach(function (r) {
    siswa = siswa.concat(siswaUrut_(ss, ta, r.id));
  });
  if (!siswa.length) return hasil;
  var kenal = {};
  siswa.forEach(function (s) { kenal[s.id] = true; });
  var mapel = mapelAktifKelas_(ss, ta, kelas);
  var tpPer = {};
  bacaTabel_(ss, 'Tujuan Pembelajaran').forEach(function (r) {
    if (teks_(r['Tahun Ajaran']) !== ta || Number(r.Semester) !== sem || Number(r.Kelas) !== kelas || !teks_(r['Tujuan Pembelajaran'])) return;
    var kunci = teks_(r['Kode Mapel']) + '|' + teks_(r.Varian);
    (tpPer[kunci] = tpPer[kunci] || []).push(barisTp_(r));
  });
  var nilai = {};
  nilaiBaris.forEach(function (n) {
    var id = teks_(n['ID Siswa']);
    if (!kenal[id] || teks_(n['Tahun Ajaran']) !== ta || Number(n.Semester) !== sem) return;
    var per = (nilai[id] = nilai[id] || {});
    (per[teks_(n['Kode Mapel'])] = per[teks_(n['Kode Mapel'])] || {})[teks_(n.Jenis) + '|' + teks_(n.Kode)] = n.Nilai;
  });
  siswa.forEach(function (s) {
    hasil[s.id] = {};
    mapel.forEach(function (m) {
      var h = nilaiMapelSiswa_(m, s, (nilai[s.id] || {})[m.kode], tpPer, aturan);
      if (h.lengkap && h.nilai !== null) hasil[s.id][m.kode] = h.nilai;
    });
  });
  return hasil;
}

/** Mapel yang tercantum di transkrip kelas 6: urutan master, lalu muatan lokal yang aktif di kelas 6. */
function mapelTranskrip_(ss, ta, atur) {
  var tambahan = teks_(atur.mapelTambahan).split(',').map(teks_);
  var aktif = mapelAktifKelas_(ss, ta, 6);
  var per = {};
  aktif.forEach(function (m) { per[m.kode] = m; });
  var hasil = [];
  URUT_TRANSKRIP.forEach(function (kode) {
    if ((kode === 'BING' || kode === 'KKA') && tambahan.indexOf(kode) < 0) return;
    var m = per[kode] || mapelBawaan_(kode);
    if (!m) return;
    if ((kode === 'BING' || kode === 'KKA') && !per[kode]) return; // dicentang tetapi tidak diajarkan di kelas 6
    hasil.push({ kode: kode, nama: m.nama, jenis: m.jenis });
  });
  aktif.filter(function (m) { return m.jenis === 'mulok'; }).forEach(function (m) {
    hasil.push({ kode: m.kode, nama: 'Muatan Lokal: ' + m.nama, jenis: 'mulok' });
  });
  return hasil;
}

/**
 * Data transkrip/SKL seluruh siswa kelas 6 tahun ini (nomor berurutan lintas rombel kelas 6).
 * Hasil: { atur, mapel, siswa: [{ id, rombel, no, nama, ..., status, ijazah, nilai: { kode: { auto, manual, akhir } }, rata, jumlah,
 *          nomorTranskrip, nomorSkl, peringatan[] }] }
 */
function dataKelulusan_(ss) {
  var atur = aturSekolah_(ss), ta = atur.tahunAjaran, taLalu = tahunAjaranSebelum_(ta);
  var simpan = bacaKelulusan_(ss, ta);
  var aturan = aturanNilai_(ss);
  var mapel = mapelTranskrip_(ss, ta, simpan.atur);
  pastikanSheet_(ss, 'Arsip Nilai');
  var baris = bacaTabel_(ss, 'Nilai').concat(bacaTabel_(ss, 'Arsip Nilai'));
  var auto = {
    '5-1': nilaiRaporTahun_(ss, taLalu, 5, 1, baris, aturan), '5-2': nilaiRaporTahun_(ss, taLalu, 5, 2, baris, aturan),
    '6-1': nilaiRaporTahun_(ss, ta, 6, 1, baris, aturan), '6-2': nilaiRaporTahun_(ss, ta, 6, 2, baris, aturan)
  };
  var identitas = {};
  bacaTabel_(ss, 'Siswa').forEach(function (r) { identitas[teks_(r['ID Siswa'])] = siswaDariBaris_(r); });
  var keputusan = {};
  bacaTabel_(ss, 'Kenaikan').forEach(function (r) {
    if (teks_(r['Tahun Ajaran']) === ta) keputusan[teks_(r['ID Siswa'])] = keputusanNaik_(r.Keputusan) || '';
  });

  var siswa = [], urutLulus = 0;
  daftarRombel_(ss, ta).filter(function (r) { return r.kelas === 6; }).forEach(function (r) {
    siswaUrut_(ss, ta, r.id).forEach(function (s) {
      var I = identitas[s.id] || {}, isi = simpan.siswa[s.id] || {}, peringatan = [];
      var nilai = {}, akhirSemua = [];
      mapel.forEach(function (m) {
        var n = { auto: {}, manual: {}, akhir: null };
        var dipakai = [];
        KOLOM_LULUS.forEach(function (kol) {
          var a = kol === 'PRAKTIK' ? null : (auto[kol][s.id] || {})[m.kode];
          if (a !== undefined && a !== null) n.auto[kol] = a;
          var mn = isi['nilai:' + m.kode + ':' + kol];
          if (mn !== undefined && mn !== '') n.manual[kol] = Number(mn);
          var v = n.manual[kol] !== undefined ? n.manual[kol] : n.auto[kol];
          if (v !== undefined && v !== null) dipakai.push(v);
          else if (kol !== 'PRAKTIK') peringatan.push(m.nama + ': nilai ' + JUDUL_KOLOM_LULUS[kol].toLowerCase() + ' belum ada.');
        });
        n.akhir = dipakai.length ? duaDesimal_(rataRata_(dipakai)) : null;
        if (n.akhir !== null) akhirSemua.push(n.akhir);
        nilai[m.kode] = n;
      });
      var status = keputusan[s.id] === 'naik' ? 'LULUS' : keputusan[s.id] === 'tinggal' ? 'TIDAK LULUS' : '';
      if (!status) peringatan.unshift('Keputusan kelulusan belum diisi (Wali Kelas → Kelulusan).');
      if (!isi.ijazah) peringatan.push('Nomor ijazah belum diisi.');
      var x = {
        id: s.id, rombel: labelRombel_(r), no: s.no, nama: s.nama, nis: teks_(I.nis), nisn: teks_(I.nisn), agama: s.agama,
        namaAgama: namaMapelAgama_(s.agama),
        ttl: [teks_(I.tempatLahir), tanggalPanjang_(I.tanggalLahir)].filter(String).join(', '),
        status: status, ijazah: teks_(isi.ijazah), nilai: nilai,
        jumlah: akhirSemua.length ? duaDesimal_(akhirSemua.reduce(function (p, q) { return p + q; }, 0)) : null,
        rata: akhirSemua.length === mapel.length && mapel.length ? duaDesimal_(rataRata_(akhirSemua)) : null,
        peringatan: peringatan
      };
      if (status !== 'TIDAK LULUS') {
        x.nomorTranskrip = simpan.atur.nomorTranskrip ? nomorKe_(simpan.atur.nomorTranskrip, urutLulus) : '';
        x.nomorSkl = simpan.atur.nomorSkl ? nomorKe_(simpan.atur.nomorSkl, urutLulus) : '';
        urutLulus++;
      }
      siswa.push(x);
    });
  });
  return { ta: ta, taLalu: taLalu, atur: simpan.atur, mapel: mapel, siswa: siswa };
}

/* ---------- aksi ---------- */

function lulusData_(npsn) {
  var ss = bukaSekolah_(npsn);
  var d = dataKelulusan_(ss);
  var profil = {};
  profilLengkap_(bacaTabel_(ss, 'Profil Sekolah')).forEach(function (r) { profil[teks_(r.Kunci)] = teks_(r.Nilai); });
  var umum = [];
  ['nomorTranskrip', 'nomorSkl', 'nomorSk', 'tanggalLulus', 'tanggalTranskrip'].forEach(function (k) {
    if (!d.atur[k]) umum.push(ATUR_LULUS[k].judul + ' belum diisi.');
  });
  if (!profil['Kepala Sekolah']) umum.push('Profil sekolah: Kepala Sekolah belum diisi.');
  return {
    ok: true, tahunAjaran: d.ta, tahunLalu: d.taLalu, atur: d.atur, mapel: d.mapel, siswa: d.siswa, kolom: KOLOM_LULUS, judulKolom: JUDUL_KOLOM_LULUS,
    adaKelas6: d.siswa.length > 0, masalahUmum: umum,
    mapelPilihan: mapelAktifKelas_(ss, d.ta, 6).filter(function (m) { return m.kode === 'BING' || m.kode === 'KKA'; }),
    sekolah: {
      nama: profil['Nama Sekolah'] || '', npsn: profil.NPSN || '', jalan: profil.Alamat || '', desa: profil['Desa/Kelurahan'] || '',
      kecamatan: profil.Kecamatan || '', kabupaten: profil['Kabupaten/Kota'] || '', provinsi: profil.Provinsi || '', kodePos: profil['Kode Pos'] || '',
      telepon: profil.Telepon || '', website: profil.Website || '', email: profil.Email || '',
      kepala: profil['Kepala Sekolah'] || '', nipKepala: profil['NIP Kepala Sekolah'] || ''
    },
    tanggalLulusPanjang: tanggalPanjang_(d.atur.tanggalLulus), tanggalTranskripPanjang: tanggalPanjang_(d.atur.tanggalTranskrip)
  };
}

/** Pengaturan surat dan logo. atur = { kop1, tempat, mapelTambahan: ['BING'], nomorTranskrip, ..., logoPemda, logoSekolah }. */
function simpanAturLulus_(npsn, atur) {
  atur = atur && typeof atur === 'object' ? atur : {};
  var salah = [], bersih = {};
  Object.keys(atur).forEach(function (k) {
    if (!ATUR_LULUS[k]) return;
    var v = atur[k];
    if (k === 'mapelTambahan') {
      v = (Array.isArray(v) ? v : []).map(function (x) { return teks_(x).toUpperCase(); }).filter(function (x) { return x === 'BING' || x === 'KKA'; }).join(',');
    } else if (k === 'logoPemda' || k === 'logoSekolah') {
      v = String(v || '');
      if (v && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(v)) salah.push(ATUR_LULUS[k].judul + ': berkas harus gambar PNG atau JPG.');
      else if (v.length > MAKS_LOGO) salah.push(ATUR_LULUS[k].judul + ': gambar terlalu besar. Pilih gambar yang lebih kecil.');
    } else if (k === 'tanggalLulus' || k === 'tanggalTranskrip') {
      v = teks_(v);
      if (v && !normalisasiTanggal_(v)) salah.push(ATUR_LULUS[k].judul + ' tidak valid.');
      else v = v ? normalisasiTanggal_(v) : '';
    } else {
      v = teks_(v);
      if (v.length > 150) salah.push(ATUR_LULUS[k].judul + ' terlalu panjang.');
      if ((k === 'nomorTranskrip' || k === 'nomorSkl') && v && !/\d/.test(v)) salah.push(ATUR_LULUS[k].judul + ' harus memuat angka urut, misalnya 400.3.11/060/SD.');
    }
    bersih[k] = v;
  });
  if (salah.length) return { ok: false, salah: salah, pesan: salah[0] };
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    pastikanSheet_(ss, 'Kelulusan');
    var ta = aturSekolah_(ss).tahunAjaran;
    var semua = bacaTabel_(ss, 'Kelulusan');
    Object.keys(bersih).forEach(function (k) {
      var t = ATUR_LULUS[k].tahunan ? '*' : ta;
      var r = semua.filter(function (x) { return teks_(x['Tahun Ajaran']) === t && !teks_(x['ID Siswa']) && teks_(x.Kunci) === k; })[0];
      if (r) r.Nilai = bersih[k];
      else semua.push({ 'Tahun Ajaran': t, 'ID Siswa': '', Kunci: k, Nilai: bersih[k] });
    });
    tulisTabel_(ss, 'Kelulusan', semua);
    catatSekolah_(ss, 'pengaturan kelulusan', Object.keys(bersih).join(', '));
    return { ok: true, pesan: 'Pengaturan transkrip dan SKL tersimpan.' };
  });
}

/**
 * Nilai manual dan nomor ijazah. isian = { idSiswa: { ijazah: '...', nilai: { MTK: { '5-1': '80', PRAKTIK: '' } } } }.
 * Kosong = memakai nilai dari aplikasi (atau tidak ada untuk praktik). Semua diperiksa dulu.
 */
function simpanLulus_(npsn, isian) {
  isian = isian && typeof isian === 'object' ? isian : {};
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var d = dataKelulusan_(ss);
    var kenal = {}, kodeMapel = {};
    d.siswa.forEach(function (s) { kenal[s.id] = s; });
    d.mapel.forEach(function (m) { kodeMapel[m.kode] = m; });
    var salah = [], baru = [];
    Object.keys(isian).forEach(function (id) {
      var s = kenal[id];
      if (!s) { salah.push('Ada siswa yang bukan kelas 6 tahun ini. Muat ulang halaman.'); return; }
      var x = isian[id] || {};
      var ij = teks_(x.ijazah);
      if (ij.length > 60) salah.push(s.nama + ': nomor ijazah terlalu panjang.');
      else if (ij) baru.push({ 'Tahun Ajaran': d.ta, 'ID Siswa': id, Kunci: 'ijazah', Nilai: ij });
      Object.keys(x.nilai || {}).forEach(function (kode) {
        if (!kodeMapel[kode]) return;
        KOLOM_LULUS.forEach(function (kol) {
          var b = bacaNilai_((x.nilai[kode] || {})[kol]);
          if (!b.ok) salah.push(s.nama + ' — ' + kodeMapel[kode].nama + ' (' + JUDUL_KOLOM_LULUS[kol] + '): ' + b.pesan);
          else if (b.nilai !== null) baru.push({ 'Tahun Ajaran': d.ta, 'ID Siswa': id, Kunci: 'nilai:' + kode + ':' + kol, Nilai: String(b.nilai) });
        });
      });
    });
    if (salah.length) return { ok: false, salah: salah, pesan: salah[0] };
    var ubah = {};
    Object.keys(isian).forEach(function (id) { ubah[id] = isian[id] || {}; });
    var diLingkup = function (r) {
      var id = teks_(r['ID Siswa']), k = teks_(r.Kunci), x = ubah[id];
      if (!x || teks_(r['Tahun Ajaran']) !== d.ta) return false;
      if (k === 'ijazah') return x.ijazah !== undefined;
      var m = k.match(/^nilai:([^:]+):/);
      return !!(m && x.nilai && x.nilai[m[1]] !== undefined);
    };
    tulisTabel_(ss, 'Kelulusan', gantiDiTempat_(bacaTabel_(ss, 'Kelulusan'), diLingkup,
      function (r) { return teks_(r['ID Siswa']) + '|' + teks_(r.Kunci); }, baru));
    catatSekolah_(ss, 'simpan kelulusan', Object.keys(isian).length + ' siswa');
    var hasil = lulusData_(npsn);
    hasil.pesan = 'Data transkrip dan SKL tersimpan.';
    return hasil;
  });
}
