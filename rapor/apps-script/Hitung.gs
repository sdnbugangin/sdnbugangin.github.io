/**
 * Aplikasi Rapor SD (Kurikulum Merdeka) — mesin hitung.
 *
 * Berkas ini hanya berisi perhitungan murni: tidak membaca atau menulis spreadsheet.
 * Semua kasus yang dulu memunculkan #N/A, #VALUE!, atau deskripsi janggal di rapor Excel
 * ditangani di sini dan dilaporkan sebagai peringatan yang bisa dibaca guru.
 * Diuji otomatis lewat rapor/tes/hitung.test.js (jalankan: node --test rapor/tes/*.test.js).
 */

/* ---------- nilai dasar ---------- */

/**
 * Membaca satu isian nilai dari guru.
 * Kosong → { ok: true, nilai: null }. Angka 0 tetap dihitung sebagai nilai 0, bukan kosong.
 * Menerima koma desimal ("85,5"). Di luar 0–100 atau bukan angka → ok: false dengan pesan.
 */
function bacaNilai_(isian) {
  if (isian === null || isian === undefined) return { ok: true, nilai: null };
  if (typeof isian === 'number') {
    if (!isFinite(isian)) return { ok: false, nilai: null, pesan: 'Nilai tidak valid.' };
    return rentangNilai_(isian, String(isian));
  }
  var teks = String(isian).trim();
  if (teks === '' || teks === '-') return { ok: true, nilai: null };
  var baku = teks.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(baku)) return { ok: false, nilai: null, pesan: '"' + teks + '" bukan angka.' };
  return rentangNilai_(Number(baku), teks);
}

function rentangNilai_(n, teks) {
  if (n < 0 || n > 100) return { ok: false, nilai: null, pesan: 'Nilai ' + teks + ' di luar rentang 0–100.' };
  return { ok: true, nilai: n };
}

/** Rata-rata dari nilai yang terisi saja. Tidak ada yang terisi → null (bukan 0, bukan error). */
function rataRata_(daftar) {
  var jumlah = 0, banyak = 0;
  (daftar || []).forEach(function (n) {
    if (typeof n === 'number' && isFinite(n)) { jumlah += n; banyak++; }
  });
  return banyak ? jumlah / banyak : null;
}

/** Pembulatan setengah ke atas yang kebal galat desimal (84,4999999 → 84, 84,5 → 85). */
function bulatkan_(n, desimal) {
  if (n === null || n === undefined) return null;
  var k = Math.pow(10, desimal || 0);
  return Math.round(n * k + 1e-7) / k;
}

/* ---------- aturan sekolah ---------- */

/** Memeriksa bobot nilai rapor. Mengembalikan daftar pesan kesalahan (kosong = benar). */
function cekBobot_(bobot) {
  var salah = [];
  if (!bobot) return ['Bobot nilai belum diatur.'];
  ['lingkup', 'akhir'].forEach(function (k) {
    var v = bobot[k];
    if (typeof v !== 'number' || !isFinite(v) || v < 0 || v > 100) salah.push('Bobot ' + k + ' harus angka 0–100.');
  });
  if (!salah.length && bobot.lingkup + bobot.akhir !== 100) {
    salah.push('Jumlah bobot harus 100%, sekarang ' + (bobot.lingkup + bobot.akhir) + '%.');
  }
  return salah;
}

/** Memeriksa tabel KKTP: urut menurun, tanpa batas ganda, baris terakhir min 0. */
function cekKktp_(kktp) {
  var salah = [];
  if (!kktp || !kktp.length) return ['Tabel KKTP masih kosong.'];
  for (var i = 0; i < kktp.length; i++) {
    var b = kktp[i];
    if (typeof b.min !== 'number' || b.min < 0 || b.min > 100) salah.push('Batas KKTP baris ' + (i + 1) + ' harus angka 0–100.');
    if (!String(b.predikat || '').trim()) salah.push('Predikat KKTP baris ' + (i + 1) + ' masih kosong.');
    if (i > 0 && !(b.min < kktp[i - 1].min)) salah.push('Batas KKTP harus urut menurun dan tidak boleh sama (baris ' + (i + 1) + ').');
  }
  if (kktp[kktp.length - 1].min !== 0) salah.push('Batas KKTP baris terakhir harus 0 agar semua nilai punya predikat.');
  return salah;
}

/** Baris KKTP untuk sebuah nilai. Nilai kosong → null. */
function barisKktp_(nilai, kktp) {
  if (nilai === null || nilai === undefined) return null;
  for (var i = 0; i < kktp.length; i++) if (nilai >= kktp[i].min) return kktp[i];
  return kktp[kktp.length - 1];
}

/* ---------- nilai satu mapel ---------- */

/**
 * Menghitung nilai rapor satu siswa untuk satu mapel.
 *
 * isian = {
 *   tp:  [{ kode: 'TP1', materi: 'Keliling dan Luas Bangun Datar', nilai: 85 }, ...]  // sumatif lingkup materi
 *   akhir: [80, 90]                                                                 // sumatif akhir semester (mis. teori, praktik)
 * }
 * aturan = { bobot, kktp, deskripsi, panggilan }
 *
 * Hasil selalu berbentuk sama, tidak pernah melempar error karena isian kosong:
 * { nilai, nilaiLingkup, nilaiAkhir, predikat, lengkap, peringatan[], tertinggi, terendah,
 *   deskripsiTinggi, deskripsiRendah, salah[] }
 * "salah" berisi isian yang ditolak (bukan angka / di luar 0–100); isian itu tidak ikut dihitung.
 */
function hitungNilaiMapel_(isian, aturan) {
  aturan = aturan || {};
  var bobot = aturan.bobot || BOBOT_BAWAAN;
  var kktp = aturan.kktp || KKTP_BAWAAN;
  var gaya = aturan.deskripsi || DESKRIPSI_BAWAAN;
  var hasil = {
    nilai: null, nilaiLingkup: null, nilaiAkhir: null, predikat: '', lengkap: false,
    peringatan: [], salah: [], tertinggi: null, terendah: null, deskripsiTinggi: '', deskripsiRendah: ''
  };

  var tp = [];
  ((isian && isian.tp) || []).forEach(function (t, i) {
    var b = bacaNilai_(t && t.nilai);
    var kode = (t && t.kode) || ('TP' + (i + 1));
    if (!b.ok) { hasil.salah.push(kode + ': ' + b.pesan); return; }
    if (b.nilai === null) return;
    var materi = String((t && t.materi) || '').trim();
    if (!materi) hasil.peringatan.push(kode + ' belum punya lingkup materi, sehingga tidak bisa masuk deskripsi.');
    tp.push({ kode: kode, materi: materi, nilai: b.nilai });
  });

  var akhir = [];
  ((isian && isian.akhir) || []).forEach(function (n, i) {
    var b = bacaNilai_(n);
    if (!b.ok) { hasil.salah.push('Sumatif akhir ' + (i + 1) + ': ' + b.pesan); return; }
    if (b.nilai !== null) akhir.push(b.nilai);
  });

  hasil.nilaiLingkup = bulatkan_(rataRata_(tp.map(function (t) { return t.nilai; })), 2);
  hasil.nilaiAkhir = bulatkan_(rataRata_(akhir), 2);

  var adaL = hasil.nilaiLingkup !== null, adaA = hasil.nilaiAkhir !== null;
  if (adaL && adaA) {
    hasil.nilai = bulatkan_((rataRata_(tp.map(function (t) { return t.nilai; })) * bobot.lingkup +
      rataRata_(akhir) * bobot.akhir) / 100, 0);
    hasil.lengkap = true;
  } else if (adaL || adaA) {
    // Nilai sementara agar guru bisa melihat perkembangan; rapor tidak boleh dicetak sebelum lengkap.
    hasil.nilai = bulatkan_(adaL ? rataRata_(tp.map(function (t) { return t.nilai; })) : rataRata_(akhir), 0);
    hasil.peringatan.push(adaL ? 'Nilai sumatif akhir semester belum diisi (nilai masih sementara).'
      : 'Nilai sumatif lingkup materi belum diisi (nilai masih sementara).');
  } else {
    hasil.peringatan.push('Belum ada nilai yang diisi.');
  }
  if (hasil.salah.length) hasil.lengkap = false;

  var baris = barisKktp_(hasil.nilai, kktp);
  hasil.predikat = baris ? baris.predikat : '';

  var bermateri = tp.filter(function (t) { return t.materi; });
  if (bermateri.length) {
    var tinggi = bermateri[0], rendah = bermateri[0];
    bermateri.forEach(function (t) {
      if (t.nilai > tinggi.nilai) tinggi = t;
      if (t.nilai < rendah.nilai) rendah = t;
    });
    hasil.tertinggi = tinggi;
    hasil.deskripsiTinggi = kalimatCapaian_(gaya, kktp, aturan.panggilan, [tinggi], 'tinggi');
    // Satu TP saja, atau semua TP bernilai sama: tidak ada "terendah" yang bermakna.
    if (rendah.nilai < tinggi.nilai) {
      hasil.terendah = rendah;
      hasil.deskripsiRendah = kalimatCapaian_(gaya, kktp, aturan.panggilan, [rendah], 'rendah');
    }
  }
  return hasil;
}

/**
 * Satu kalimat deskripsi untuk satu TP atau beberapa TP sekaligus (mis. dari beberapa seni).
 * TP dengan kalimat pembuka yang sama digabung: "… sangat baik dalam A dan B".
 * Pada mode predikat, kalimat pembuka yang berbeda menjadi anak kalimat: "… sangat baik dalam A dan … baik dalam B".
 */
function kalimatCapaian_(gaya, kktp, panggilan, daftarTp, arah) {
  var kelompok = [];
  daftarTp.forEach(function (tp) {
    var kalimat = String((gaya.mode === 'predikat'
      ? barisKktp_(tp.nilai, kktp).kalimat
      : (arah === 'tinggi' ? gaya.kalimatTinggi : gaya.kalimatRendah)) || '').trim();
    var materi = tp.materi.replace(/[.\s]+$/, '');
    var ada = kelompok.filter(function (k) { return k.kalimat === kalimat; })[0];
    if (ada) { if (ada.materi.indexOf(materi) < 0) ada.materi.push(materi); }
    else kelompok.push({ kalimat: kalimat, materi: [materi] });
  });
  var isi = gabungDaftar_(kelompok.map(function (k, i) {
    return (i === 0 ? k.kalimat : hurufKecilAwal_(k.kalimat)) + ' ' + gabungDaftar_(k.materi);
  }));
  var nama = String(panggilan || '').trim();
  var awal = gaya.pakaiPanggilan && nama ? 'Ananda ' + nama + ' ' + hurufKecilAwal_(isi) : hurufBesarAwal_(isi);
  return awal + '.';
}

/** ['a'] → 'a'; ['a','b'] → 'a dan b'; ['a','b','c'] → 'a, b, dan c'. */
function gabungDaftar_(daftar) {
  if (daftar.length <= 1) return daftar.join('');
  return daftar.slice(0, -1).join(', ') + (daftar.length > 2 ? ',' : '') + ' dan ' + daftar[daftar.length - 1];
}

/**
 * Nilai satu baris rapor yang terdiri dari beberapa bagian, mis. Seni dan Budaya untuk siswa yang
 * mengikuti Seni Musik dan Seni Rupa. Setiap bagian dihitung seperti mapel biasa (bobot, KKTP), lalu:
 * - nilai rapor = rata-rata nilai tiap bagian (sama seperti rapor Excel lama);
 * - deskripsi tertinggi/terendah = TP tertinggi/terendah tiap bagian, digabung dalam satu kalimat.
 *
 * bagian = [{ nama: 'Seni Musik', isian: { tp: [...], akhir: [...] } }, ...]
 * Hasil berbentuk sama dengan hitungNilaiMapel_, ditambah rincian[] per bagian.
 */
function hitungNilaiGabungan_(bagian, aturan) {
  aturan = aturan || {};
  var kktp = aturan.kktp || KKTP_BAWAAN;
  var gaya = aturan.deskripsi || DESKRIPSI_BAWAAN;
  var hasil = {
    nilai: null, nilaiLingkup: null, nilaiAkhir: null, predikat: '', lengkap: false,
    peringatan: [], salah: [], tertinggi: null, terendah: null, deskripsiTinggi: '', deskripsiRendah: '', rincian: []
  };
  if (!bagian || !bagian.length) {
    hasil.peringatan.push('Belum ada pilihan (mis. seni) untuk siswa ini.');
    return hasil;
  }
  var lengkap = true, tinggi = [], rendah = [], nilai = [];
  bagian.forEach(function (b) {
    var h = hitungNilaiMapel_(b.isian, aturan);
    hasil.rincian.push({ nama: b.nama, hasil: h });
    h.peringatan.forEach(function (x) { hasil.peringatan.push(b.nama + ': ' + x); });
    h.salah.forEach(function (x) { hasil.salah.push(b.nama + ': ' + x); });
    if (!h.lengkap) lengkap = false;
    if (h.nilai !== null) nilai.push(h.nilai);
    if (h.tertinggi) tinggi.push(h.tertinggi);
    if (h.terendah) rendah.push(h.terendah);
  });
  hasil.nilai = bulatkan_(rataRata_(nilai), 0);
  hasil.lengkap = lengkap && nilai.length === bagian.length;
  var baris = barisKktp_(hasil.nilai, kktp);
  hasil.predikat = baris ? baris.predikat : '';
  if (tinggi.length) hasil.deskripsiTinggi = kalimatCapaian_(gaya, kktp, aturan.panggilan, tinggi, 'tinggi');
  if (rendah.length) hasil.deskripsiRendah = kalimatCapaian_(gaya, kktp, aturan.panggilan, rendah, 'rendah');
  return hasil;
}

/** "Seni Musik, Seni Rupa" → ['Seni Musik', 'Seni Rupa']. */
function pecahSeni_(seni) {
  return String(seni || '').split(',').map(function (x) { return x.trim(); }).filter(String);
}

function hurufBesarAwal_(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function hurufKecilAwal_(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

/* ---------- kokurikuler ---------- */

/**
 * Deskripsi kokurikuler satu siswa.
 * capaian = [{ dimensi: 'Kolaborasi', subdimensi: 'Kerjasama', level: 'Cakap' }, ...]
 * narasi  = { 'Kerjasama': { 'Mahir': '...', 'Cakap': '...', 'Berkembang': '...' }, ... }
 * Hasil: { teks, peringatan[] }. Tidak pernah menghasilkan error, berapa pun dimensi yang terisi.
 */
function deskripsiKokurikuler_(panggilan, capaian, narasi) {
  var peringatan = [];
  var nama = String(panggilan || '').trim();
  var awal = nama ? 'Ananda ' + nama : 'Ananda';
  var terisi = [];
  (capaian || []).forEach(function (c) {
    if (!c || !String(c.level || '').trim()) return;
    var level = String(c.level).trim();
    var urut = LEVEL_KOKURIKULER.indexOf(level);
    if (urut < 0) { peringatan.push('Capaian "' + level + '" pada ' + c.dimensi + ' tidak dikenal.'); return; }
    var teks = narasi && narasi[c.subdimensi] && narasi[c.subdimensi][level];
    if (!teks) peringatan.push('Narasi untuk ' + c.subdimensi + ' (' + level + ') belum ada di Master Narasi.');
    terisi.push({ dimensi: c.dimensi, narasi: String(teks || '').trim().replace(/[.\s]+$/, ''), skor: LEVEL_KOKURIKULER.length - urut });
  });

  if (!terisi.length) {
    peringatan.push('Capaian kokurikuler belum diisi.');
    return { teks: '', peringatan: peringatan };
  }

  var tinggi = terisi[0], rendah = terisi[0];
  terisi.forEach(function (t) {
    if (t.skor > tinggi.skor) tinggi = t;
    if (t.skor < rendah.skor) rendah = t;
  });

  var teks = awal + ' sudah baik dalam dimensi profil ' + tinggi.dimensi +
    (tinggi.narasi ? ', salah satunya mampu ' + tinggi.narasi : '');
  if (rendah !== tinggi && rendah.skor < tinggi.skor) {
    teks += ', dan masih perlu bimbingan dalam dimensi profil ' + rendah.dimensi +
      (rendah.narasi ? ' agar dapat ' + rendah.narasi : '');
  }
  return { teks: teks + '.', peringatan: peringatan };
}

/* ---------- rekap kelas ---------- */

/**
 * Peringkat kelas. daftar = [{ id, jumlah }]. Jumlah sama → peringkat sama (1, 2, 2, 4).
 * Siswa yang jumlahnya kosong tidak diberi peringkat. Hasil: { id: peringkat }.
 */
function peringkat_(daftar) {
  var ada = (daftar || []).filter(function (d) { return typeof d.jumlah === 'number' && isFinite(d.jumlah); });
  ada.sort(function (a, b) { return b.jumlah - a.jumlah; });
  var hasil = {};
  ada.forEach(function (d, i) {
    hasil[d.id] = (i > 0 && Math.abs(d.jumlah - ada[i - 1].jumlah) < 1e-9) ? hasil[ada[i - 1].id] : i + 1;
  });
  return hasil;
}

/* ---------- kelas, fase, kenaikan ---------- */

function cekKelas_(kelas) {
  var k = Number(kelas);
  if (!(k >= 1 && k <= 6 && Math.floor(k) === k)) throw new Error('Kelas harus 1 sampai 6, bukan "' + kelas + '".');
  return k;
}

function faseKelas_(kelas) { return FASE_KELAS[cekKelas_(kelas)]; }

/**
 * Keterangan kenaikan/kelulusan di rapor.
 * Semester 1: tidak ada keterangan (tampil = false).
 * Semester 2: kelas 1–5 → naik/tinggal kelas, kelas 6 → lulus/tidak lulus.
 * status: 'naik' | 'tinggal' (untuk kelas 6: 'naik' berarti lulus).
 */
function keteranganKenaikan_(kelas, semester, status) {
  var k = cekKelas_(kelas);
  var s = Number(semester);
  if (s !== 1 && s !== 2) throw new Error('Semester harus 1 atau 2, bukan "' + semester + '".');
  if (s === 1) return { tampil: false, teks: '', peringatan: [] };
  var st = String(status || '').trim().toLowerCase();
  if (st !== 'naik' && st !== 'tinggal') {
    return { tampil: true, teks: '', peringatan: ['Keputusan ' + (k === 6 ? 'kelulusan' : 'kenaikan kelas') + ' belum diisi.'] };
  }
  var teks;
  if (k === 6) teks = st === 'naik' ? 'LULUS' : 'TIDAK LULUS';
  else teks = st === 'naik' ? 'Naik ke kelas ' + ROMAWI[k + 1] + ' (' + angkaKata_(k + 1) + ')'
    : 'Tinggal di kelas ' + ROMAWI[k] + ' (' + angkaKata_(k) + ')';
  return { tampil: true, teks: teks, peringatan: [] };
}

function angkaKata_(n) { return ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam'][n]; }

/* ---------- data siswa ---------- */

function normalisasiAgama_(isian) {
  var kunci = String(isian || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return ALIAS_AGAMA[kunci] || null;
}

/**
 * Memeriksa daftar siswa sebelum disimpan.
 * siswa = [{ nama, nisn, nis, jk, agama, seni }]; aturan = { seniDitawarkan: [...] }
 * Hasil: daftar pesan kesalahan berisi nomor baris (mulai 1). Kosong = semua benar.
 */
function cekDaftarSiswa_(siswa, aturan) {
  var salah = [];
  var nisnDipakai = {}, nisDipakai = {};
  var seni = (aturan && aturan.seniDitawarkan) || PILIHAN_SENI;
  (siswa || []).forEach(function (s, i) {
    var baris = 'Baris ' + (i + 1) + (s && s.nama ? ' (' + String(s.nama).trim() + ')' : '') + ': ';
    if (!s || !String(s.nama || '').trim()) { salah.push(baris + 'nama siswa kosong.'); return; }
    var nisn = String(s.nisn || '').trim();
    if (nisn) {
      if (!/^\d{10}$/.test(nisn)) salah.push(baris + 'NISN harus 10 digit angka.');
      else if (nisnDipakai[nisn]) salah.push(baris + 'NISN sama dengan baris ' + nisnDipakai[nisn] + '.');
      else nisnDipakai[nisn] = i + 1;
    }
    var nis = String(s.nis || '').trim();
    if (nis) {
      if (nisDipakai[nis]) salah.push(baris + 'NIS sama dengan baris ' + nisDipakai[nis] + '.');
      else nisDipakai[nis] = i + 1;
    }
    var jk = String(s.jk || '').trim().toUpperCase();
    if (jk !== 'L' && jk !== 'P') salah.push(baris + 'jenis kelamin harus L atau P.');
    if (!normalisasiAgama_(s.agama)) salah.push(baris + 'agama "' + (s.agama || '') + '" tidak dikenal.');
    pecahSeni_(s.seni).forEach(function (x) {
      if (seni.indexOf(x) < 0) salah.push(baris + 'seni pilihan "' + x + '" tidak ditawarkan sekolah.');
    });
  });
  return salah;
}
