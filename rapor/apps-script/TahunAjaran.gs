/**
 * Aplikasi Rapor SD — pindah ke tahun ajaran baru (kenaikan kelas tahunan).
 *
 * Dijalankan operator sekali setahun, di semester 2 setelah keputusan naik/tinggal/lulus semua siswa diisi.
 *   1. cadangan: salinan spreadsheet sekolah di folder "Rapor SD/Cadangan" (gagal mencadangkan = batal);
 *   2. rombel tahun baru dengan susunan yang sama per kelas (nama, wali kelas, NIP ikut);
 *   3. siswa naik → rombel kelas berikutnya (akhiran nama sama: 4A → 5A), tinggal → rombel yang sama,
 *      kelas 6 lulus → status "Lulus" (tidak masuk rombel), tidak lulus → tetap kelas 6;
 *   4. mapel aktif, TP (semester 1 dan 2), dan subdimensi kokurikuler disalin sebagai titik awal;
 *   5. nilai tahun lalu dipindah ke sheet "Arsip Nilai" agar sheet Nilai tetap kecil dan cepat;
 *   6. Pengaturan: tahun ajaran baru, semester 1.
 * Kelas 1 tahun baru tetap kosong untuk diisi siswa baru.
 */

/** "2026/2027" → "2027/2028"; format lain → ''. */
function tahunAjaranBerikut_(ta) {
  var m = teks_(ta).match(/^(\d{4})\/(\d{4})$/);
  return m && Number(m[2]) === Number(m[1]) + 1 ? m[2] + '/' + (Number(m[2]) + 1) : '';
}

/** Akhiran nama rombel setelah nomor kelas: "5A" → "A", "5" → "", nama bebas ("Melati") → null. */
function akhiranRombel_(r) {
  var n = String(r.nama), k = String(r.kelas);
  return n.indexOf(k) === 0 ? n.slice(k.length) : null;
}

/**
 * Rombel tujuan siswa yang naik dari rombel r: di kelas berikutnya, akhiran sama; bila tidak ada, satu-satunya
 * rombel kelas itu; bila tidak ada juga, rombel pada urutan yang sama (atau yang terakhir).
 * Hasil: rombel tahun baru (objek dari daftar) atau { baru: true, kelas, nama } bila kelas itu belum punya rombel.
 */
function tujuanNaik_(r, rombelKelas, urutan) {
  var kelas = r.kelas + 1, ada = rombelKelas[kelas] || [];
  var akhir = akhiranRombel_(r);
  if (!ada.length) return { baru: true, kelas: kelas, nama: akhir === null ? r.nama : kelas + akhir };
  var sama = ada.filter(function (x) { return akhir !== null && akhiranRombel_(x) === akhir; })[0];
  if (sama) return sama;
  if (ada.length === 1) return ada[0];
  return ada[Math.min(urutan, ada.length - 1)];
}

/**
 * Rencana pindah tahun ajaran (tanpa mengubah apa pun). Hasil:
 * { taLama, taBaru, salah[], peringatan[], rombel: [{ kelas, nama, wali, nip, idLama, siswa: [{ id, nama, asal, seni, status }] }],
 *   lulus: [{ id, nama, asal }], ringkas: { naik, tinggal, lulus, tidakLulus } }
 */
function rencanaTaBaru_(ss) {
  var atur = aturSekolah_(ss), ta = atur.tahunAjaran, taBaru = tahunAjaranBerikut_(ta);
  var salah = [], peringatan = [];
  if (!taBaru) salah.push('Tahun ajaran "' + ta + '" di Pengaturan tidak dikenali (seharusnya seperti 2026/2027).');
  if (atur.semester !== 2) salah.push('Tahun ajaran baru hanya bisa dimulai di semester 2 (Genap), setelah keputusan kenaikan kelas diisi. Semester sekarang: ' + atur.semester + '.');

  var rombelLama = daftarRombel_(ss, ta);
  var rombelKelas = {}, urutKelas = {};
  rombelLama.forEach(function (r) {
    (rombelKelas[r.kelas] = rombelKelas[r.kelas] || []).push(r);
  });
  Object.keys(rombelKelas).forEach(function (k) { rombelKelas[k].forEach(function (r, i) { urutKelas[r.id] = i; }); });

  var keputusan = {};
  bacaTabel_(ss, 'Kenaikan').forEach(function (r) {
    if (teks_(r['Tahun Ajaran']) === ta) keputusan[teks_(r['ID Siswa'])] = keputusanNaik_(r.Keputusan) || '';
  });

  // rombel tahun baru: susunan sama per kelas
  var baru = [], perId = {}, perNama = {};
  rombelLama.forEach(function (r) {
    var x = { kelas: r.kelas, nama: r.nama, wali: r.wali, nip: r.nip, idLama: r.id, siswa: [] };
    baru.push(x); perId[r.id] = x; perNama[r.kelas + '|' + r.nama] = x;
  });
  var tambahan = function (t) {
    var kunci = t.kelas + '|' + t.nama;
    if (!perNama[kunci]) {
      perNama[kunci] = { kelas: t.kelas, nama: t.nama, wali: '', nip: '', idLama: '', siswa: [] };
      baru.push(perNama[kunci]);
      peringatan.push('Rombel ' + labelRombel_(t) + ' dibuat baru untuk siswa yang naik dari kelas ' + (t.kelas - 1) + '. Isi wali kelasnya.');
    }
    return perNama[kunci];
  };

  var lulus = [], ringkas = { naik: 0, tinggal: 0, lulus: 0, tidakLulus: 0 }, belum = [];
  rombelLama.forEach(function (r) {
    siswaUrut_(ss, ta, r.id).forEach(function (s) {
      var k = keputusan[s.id], data = { id: s.id, nama: s.nama, asal: labelRombel_(r), seni: s.seni.join(', ') };
      if (!k) { belum.push(s.nama + ' (' + labelRombel_(r) + ')'); return; }
      if (k === 'tinggal') {
        perId[r.id].siswa.push(Object.assign(data, { status: 'tinggal' }));
        ringkas[r.kelas === 6 ? 'tidakLulus' : 'tinggal']++;
      } else if (r.kelas === 6) {
        lulus.push(data); ringkas.lulus++;
      } else {
        var t = tujuanNaik_(r, rombelKelas, urutKelas[r.id]);
        var tujuan = t.baru ? tambahan(t) : perId[t.id];
        tujuan.siswa.push(Object.assign(data, { status: 'naik' }));
        ringkas.naik++;
      }
    });
  });
  if (belum.length) {
    salah.push(belum.length + ' siswa belum punya keputusan naik/tinggal kelas (isi di menu Wali Kelas → Kenaikan): ' +
      belum.slice(0, 8).join(', ') + (belum.length > 8 ? ', dan lainnya' : '') + '.');
  }
  if (!rombelLama.length) salah.push('Belum ada rombel di tahun ajaran ' + ta + '.');
  var terkunci = daftarKunci_(ss).filter(function (x) { return x.ta === ta && x.sem === 2; }).length;
  if (rombelLama.length && terkunci < rombelLama.length) {
    peringatan.push((rombelLama.length - terkunci) + ' rombel belum mengunci rapor semester 2. Sebaiknya kunci dulu setelah rapor dibagikan.');
  }
  baru.sort(function (a, b) { return a.kelas - b.kelas || (a.nama < b.nama ? -1 : a.nama > b.nama ? 1 : 0); });
  return { taLama: ta, taBaru: taBaru, salah: salah, peringatan: peringatan, rombel: baru, lulus: lulus, ringkas: ringkas };
}

/** Sheet yang belum ada di spreadsheet versi lama (mis. Arsip Nilai) dibuat dengan judul dan format teksnya. */
function pastikanSheet_(ss, nama) {
  if (ss.getSheetByName(nama)) return;
  var st = strukturSheet_(nama), sh = ss.insertSheet(nama);
  sh.getRange(1, 1, 1, st.kolom.length).setValues([st.kolom]).setFontWeight('bold').setBackground('#12314f').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  formatTeks_(sh, st, 2);
}

/* ---------- aksi ---------- */

function taBaruPratinjau_(npsn) {
  var ss = bukaSekolah_(npsn);
  var r = rencanaTaBaru_(ss);
  return {
    ok: true, taLama: r.taLama, taBaru: r.taBaru, salah: r.salah, peringatan: r.peringatan, ringkas: r.ringkas,
    rombel: r.rombel.map(function (x) {
      return { kelas: x.kelas, nama: x.nama, label: labelRombel_(x), wali: x.wali, jumlah: x.siswa.length,
        naik: x.siswa.filter(function (s) { return s.status === 'naik'; }).length,
        tinggal: x.siswa.filter(function (s) { return s.status === 'tinggal'; }).length,
        asal: x.siswa.reduce(function (o, s) { if (s.status === 'naik') o[s.asal] = (o[s.asal] || 0) + 1; return o; }, {}) };
    }),
    lulus: r.lulus.map(function (s) { return s.nama + ' (' + s.asal + ')'; })
  };
}

function taBaruJalankan_(npsn, konfirmasi) {
  var ss = bukaSekolah_(npsn);
  return denganKunci_(function () {
    var r = rencanaTaBaru_(ss);
    if (r.salah.length) return { ok: false, salah: r.salah, pesan: r.salah[0] };
    if (teks_(konfirmasi).toUpperCase() !== 'MULAI ' + r.taBaru) {
      return { ok: false, pesan: 'Ketik MULAI ' + r.taBaru + ' untuk memastikan.' };
    }

    // 1. cadangan dulu; gagal = tidak ada yang diubah
    var cadangan;
    try {
      cadangan = DriveApp.getFileById(ss.getId()).makeCopy(ss.getName() + ' — cadangan sebelum ' + r.taBaru.replace('/', '-'),
        folderBagian_('Folder Cadangan', 'Cadangan'));
    } catch (e) {
      return { ok: false, pesan: 'Cadangan spreadsheet gagal dibuat, jadi tahun ajaran tidak diubah. Coba lagi nanti. (' + e.message + ')' };
    }

    var ta = r.taLama, taBaru = r.taBaru;
    // 2–3. rombel dan anggota tahun baru
    var semuaRombel = bacaTabel_(ss, 'Rombel'), dipakai = {};
    semuaRombel.forEach(function (x) { dipakai[teks_(x['ID Rombel'])] = true; });
    var anggota = bacaTabel_(ss, 'Anggota Rombel').filter(function (a) { return teks_(a['Tahun Ajaran']) !== taBaru; });
    r.rombel.forEach(function (x) {
      var id = idBaru_('R', dipakai);
      dipakai[id] = true;
      semuaRombel.push({ 'ID Rombel': id, 'Tahun Ajaran': taBaru, Kelas: x.kelas, 'Nama Rombel': x.nama, 'Wali Kelas': x.wali,
        'NIP Wali Kelas': x.nip, 'Jumlah Siswa': x.siswa.length || '' });
      x.siswa.forEach(function (s, i) {
        anggota.push({ 'Tahun Ajaran': taBaru, 'ID Rombel': id, 'ID Siswa': s.id, 'No Urut': i + 1, 'Seni Pilihan': s.seni });
      });
    });
    tulisTabel_(ss, 'Rombel', semuaRombel);
    tulisTabel_(ss, 'Anggota Rombel', anggota);
    var idLulus = {};
    r.lulus.forEach(function (s) { idLulus[s.id] = true; });
    var siswa = bacaTabel_(ss, 'Siswa');
    siswa.forEach(function (s) {
      if (idLulus[teks_(s['ID Siswa'])]) { s.Status = 'Lulus'; s['Keterangan Status'] = 'Lulus tahun ajaran ' + ta; }
    });
    tulisTabel_(ss, 'Siswa', siswa);

    // 4. salin pengaturan kelas sebagai titik awal (bila tahun baru belum punya)
    [['Mapel Aktif'], ['Tujuan Pembelajaran'], ['Kokurikuler']].forEach(function (x) {
      var semua = bacaTabel_(ss, x[0]);
      if (semua.some(function (row) { return teks_(row['Tahun Ajaran']) === taBaru; })) return;
      semua.filter(function (row) { return teks_(row['Tahun Ajaran']) === ta; }).forEach(function (row) {
        var salin = {};
        Object.keys(row).forEach(function (k) { salin[k] = row[k]; });
        salin['Tahun Ajaran'] = taBaru;
        semua.push(salin);
      });
      tulisTabel_(ss, x[0], semua);
    });

    // 5. arsip nilai tahun-tahun sebelumnya
    pastikanSheet_(ss, 'Arsip Nilai');
    var nilai = bacaTabel_(ss, 'Nilai');
    var pindah = nilai.filter(function (n) { return teks_(n['Tahun Ajaran']) !== taBaru; });
    if (pindah.length) {
      tulisTabel_(ss, 'Arsip Nilai', bacaTabel_(ss, 'Arsip Nilai').concat(pindah));
      tulisTabel_(ss, 'Nilai', nilai.filter(function (n) { return teks_(n['Tahun Ajaran']) === taBaru; }));
    }

    // 6. pengaturan
    var atur = bacaTabel_(ss, 'Pengaturan');
    atur.forEach(function (x) {
      if (teks_(x.Kunci) === 'Tahun Ajaran') x.Nilai = taBaru;
      if (teks_(x.Kunci) === 'Semester') x.Nilai = 1;
    });
    tulisTabel_(ss, 'Pengaturan', atur);

    catatSekolah_(ss, 'tahun ajaran baru', ta + ' → ' + taBaru + ': naik ' + r.ringkas.naik + ', tinggal ' + r.ringkas.tinggal +
      ', lulus ' + r.ringkas.lulus + ', tidak lulus ' + r.ringkas.tidakLulus + '; ' + pindah.length + ' nilai diarsipkan; cadangan ' + cadangan.getId());
    return {
      ok: true, taBaru: taBaru, ringkas: r.ringkas,
      pesan: 'Tahun ajaran ' + taBaru + ' semester 1 dimulai. ' + r.ringkas.naik + ' siswa naik kelas, ' + r.ringkas.tinggal + ' tinggal kelas, ' +
        r.ringkas.lulus + ' lulus. Cadangan data lama tersimpan di folder Rapor SD/Cadangan. Isi siswa baru kelas 1 dan periksa wali kelas setiap rombel.'
    };
  });
}
