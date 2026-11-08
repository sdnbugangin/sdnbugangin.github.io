// Uji fitur Tumbuh Kembang di Super Admin, memakai tiruan layanan Google. Data di sini buatan.
// Jalankan dari akar repo: node --test super-admin/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const K = require('../apps-script/Kode.gs');

function lembar(nama, v) {
  const sh = {
    nama, v,
    getLastRow: () => sh.v.length,
    getDataRange: () => ({ getValues: () => sh.v.map(r => r.slice()) }),
    appendRow: r => { sh.v.push(r.map(x => (typeof x === 'string' && x.startsWith("'") ? x.slice(1) : x))); },
    deleteRow: n => { sh.v.splice(n - 1, 1); },
    setFrozenRows() {},
    getRange: (b, k, nb, nk) => {
      const rng = {
        setValues: isi => { isi.forEach((r, i) => r.forEach((x, j) => { while (sh.v.length < b + i) sh.v.push([]); sh.v[b - 1 + i][k - 1 + j] = typeof x === 'string' && x.startsWith("'") ? x.slice(1) : x; })); return rng; },
        setValue: x => rng.setValues([[x]]),
        setFontWeight: () => rng, setBackground: () => rng, setFontColor: () => rng
      };
      return rng;
    }
  };
  return sh;
}

function buat(sekarang = '2026-11-05T09:00:00+07:00') {
  const aktif = {
    Pengaturan: lembar('Pengaturan', [['Kunci', 'Nilai', 'Keterangan'], ['Password Bantuan', 'rahasia', ''], ['ID Spreadsheet Presensi', 'PRES', '']]),
    'Log Perubahan': lembar('Log Perubahan', [['Waktu', 'Oleh', 'Aksi', 'ID Siswa', 'Nama Siswa', 'Rincian']])
  };
  const presensi = {
    'Master Siswa': lembar('Master Siswa', [['ID Siswa', 'Kelas', 'No Urut Abjad', 'Nama Lengkap', 'Status Aktif'],
      ['P1', '4', 2, 'Anak Dua', 'Aktif'], ['P2', '4', 1, 'Anak Satu', 'Aktif'], ['P3', '4', 3, 'Anak Pindah', 'Pindah'], ['P4', '5', 1, 'Anak Kelas Lima', 'Aktif']])
  };
  const ssAktif = {
    getSheetByName: n => aktif[n] || null,
    insertSheet: n => (aktif[n] = lembar(n, [])),
    getSheets: () => Object.values(aktif)
  };
  const AsliDate = Date;
  class TiruDate extends AsliDate { constructor(...a) { super(...(a.length ? a : [sekarang])); } static now() { return new AsliDate(sekarang).getTime(); } }
  const ctx = {
    console, Date: TiruDate,
    SpreadsheetApp: { getActive: () => ssAktif, openById: () => ({ getSheetByName: n => presensi[n] || null }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: d => new AsliDate(d).toISOString().slice(0, 10) },
    ContentService: { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Kode.gs'), 'utf8'), ctx);
  const api = req => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ sandi: 'rahasia', oleh: 'Bu Guru', ...req }) } }).t);
  return { api, aktif };
}

test('tahun ajaran dan daftar bulannya', () => {
  assert.equal(K.tahunAjaranDari_(new Date(2026, 10, 5)), '2026/2027');
  assert.equal(K.tahunAjaranDari_(new Date(2027, 2, 1)), '2026/2027');
  assert.equal(K.tahunAjaranDari_(new Date(2027, 6, 1)), '2027/2028');
  const b = K.bulanTahunAjaran_('2026/2027');
  assert.equal(b.length, 12);
  assert.equal(b[0], '2026-07');
  assert.equal(b[5], '2026-12');
  assert.equal(b[6], '2027-01');
  assert.equal(b[11], '2027-06');
});

test('pemeriksaan isian berat dan tinggi', () => {
  assert.deepEqual(K.cekUkur_({ bb: '25,5', tb: '128' }, null), { bb: 25.5, tb: 128, salah: '', peringatan: '' });
  assert.equal(K.cekUkur_({ bb: '', tb: '' }, null).bb, null);
  assert.match(K.cekUkur_({ bb: '25', tb: '' }, null).salah, /keduanya/);
  assert.match(K.cekUkur_({ bb: 'dua', tb: '120' }, null).salah, /bukan angka/);
  assert.match(K.cekUkur_({ bb: '250', tb: '120' }, null).salah, /kewajaran/);
  assert.match(K.cekUkur_({ bb: '25', tb: '12' }, null).salah, /kewajaran/);
  assert.match(K.cekUkur_({ bb: '25', tb: '118' }, { bb: 25, tb: 125 }).peringatan, /tinggi turun/);
  assert.match(K.cekUkur_({ bb: '32', tb: '126' }, { bb: 25, tb: 125 }).peringatan, /lebih dari 5 kg/);
  assert.equal(K.cekUkur_({ bb: '26', tb: '126' }, { bb: 25, tb: 125 }).peringatan, '');
});

test('guru membuka kelas: siswa aktif urut absen, bulan tidak boleh di masa depan', () => {
  const g = buat();
  const r = g.api({ aksi: 'tumbuhKelas', kelas: '4', bulan: '2027-01' });
  assert.equal(r.ok, true);
  assert.equal(r.tahunAjaran, '2026/2027');
  assert.equal(r.bulan, '2026-11');
  assert.deepEqual(r.bulanPilihan, ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  assert.deepEqual(r.siswa.map(s => s.nama), ['Anak Satu', 'Anak Dua']);
});

test('simpan, ubah, kosongkan, dan bulan sebelumnya tampil sebagai pembanding', () => {
  const g = buat();
  let r = g.api({ aksi: 'simpanTumbuh', kelas: '4', bulan: '2026-10', tanggal: '2026-10-06', isian: { P1: { bb: '25', tb: '125' }, P2: { bb: '30,5', tb: '130' } } });
  assert.equal(r.ok, true, r.pesan);
  assert.equal(r.jumlah, 2);
  const sh = g.aktif['Tumbuh Kembang'];
  assert.deepEqual([...sh.v[0]], ['ID Siswa', 'Kelas', 'Nama Siswa', 'Tahun Ajaran', 'Bulan', 'Tanggal Ukur', 'Berat (kg)', 'Tinggi (cm)', 'Dicatat Oleh', 'Dicatat Pada']);
  assert.equal(sh.v.length, 3);

  r = g.api({ aksi: 'simpanTumbuh', kelas: '4', bulan: '2026-11', tanggal: '2026-11-03', isian: { P1: { bb: '25,8', tb: '125,5' }, P2: { bb: '', tb: '' } } });
  assert.equal(r.jumlah, 1);
  const buka = g.api({ aksi: 'tumbuhKelas', kelas: '4', bulan: '2026-11' });
  const p1 = buka.siswa.find(s => s.id === 'P1'), p2 = buka.siswa.find(s => s.id === 'P2');
  assert.deepEqual(p1.nilai, { bb: 25.8, tb: 125.5 });
  assert.deepEqual(p1.lalu, { bulan: '2026-10', bb: 25, tb: 125 });
  assert.equal(p2.nilai, null);
  assert.equal(buka.tanggal, '2026-11-03');
  assert.equal(buka.terisi['2026-10'], 2);

  // ubah: baris yang sama ditimpa, bukan ditambah
  g.api({ aksi: 'simpanTumbuh', kelas: '4', bulan: '2026-11', tanggal: '2026-11-03', isian: { P1: { bb: '26', tb: '126' } } });
  assert.equal(sh.v.length, 4);
  // kosongkan: baris dihapus
  g.api({ aksi: 'simpanTumbuh', kelas: '4', bulan: '2026-11', tanggal: '2026-11-03', isian: {} });
  assert.equal(sh.v.length, 3);
  assert.equal(g.aktif['Log Perubahan'].v.at(-1)[2], 'Tumbuh kembang');
});

test('satu isian salah → tidak ada yang tersimpan; peringatan tetap tersimpan', () => {
  const g = buat();
  let r = g.api({ aksi: 'simpanTumbuh', kelas: '4', bulan: '2026-11', tanggal: '2026-11-03', isian: { P1: { bb: '25', tb: '125' }, P2: { bb: '300', tb: '130' } } });
  assert.equal(r.ok, false);
  assert.match(r.pesan, /Anak Satu: berat badan 300/);
  assert.equal(g.aktif['Tumbuh Kembang'].v.length, 1);
  g.api({ aksi: 'simpanTumbuh', kelas: '4', bulan: '2026-10', tanggal: '2026-10-06', isian: { P1: { bb: '25', tb: '125' } } });
  r = g.api({ aksi: 'simpanTumbuh', kelas: '4', bulan: '2026-11', tanggal: '2026-11-03', isian: { P1: { bb: '25', tb: '120' } } });
  assert.equal(r.ok, true);
  assert.match(r.peringatan[0], /Anak Dua: tinggi turun/);
});

test('bulan dan tanggal yang tidak sah ditolak; nama guru wajib', () => {
  const g = buat();
  assert.match(g.api({ aksi: 'simpanTumbuh', kelas: '4', bulan: '2026-12', tanggal: '2026-12-01', isian: {} }).pesan, /Bulan tidak sah/);
  assert.match(g.api({ aksi: 'simpanTumbuh', kelas: '4', bulan: '2026-06', tanggal: '2026-06-01', isian: {} }).pesan, /Bulan tidak sah/);
  assert.match(g.api({ aksi: 'simpanTumbuh', kelas: '4', bulan: '2026-11', tanggal: '2026-10-30', isian: {} }).pesan, /Tanggal ukur/);
  assert.match(g.api({ aksi: 'simpanTumbuh', kelas: '9', bulan: '2026-11', tanggal: '2026-11-03', isian: {} }).pesan, /Kelas tidak ditemukan/);
  assert.match(g.api({ aksi: 'simpanTumbuh', oleh: '', kelas: '4', bulan: '2026-11', tanggal: '2026-11-03', isian: {} }).pesan, /nama Anda/);
});

test('tanpa kata sandi tidak bisa membaca atau menyimpan', () => {
  const g = buat();
  const ctxApi = req => g.api({ ...req, sandi: 'salah' });
  assert.equal(ctxApi({ aksi: 'tumbuhKelas', kelas: '4' }).sandiSalah, true);
});

// Titik dari tabel resmi WHO 2007 (kolom -3 SD, -2 SD, median, +2 SD, +3 SD) untuk beberapa umur.
const TITIK_WHO = [
  ["imtL", 61, 12.118, 13.031, 15.264, 18.259, 20.166],
  ["imtL", 90, 12.319, 13.221, 15.602, 19.328, 22.147],
  ["imtL", 120, 12.775, 13.735, 16.443, 21.4, 26.073],
  ["imtL", 150, 13.588, 14.684, 17.87, 24.165, 30.854],
  ["imtL", 180, 14.708, 16.011, 19.774, 26.969, 34.081],
  ["imtL", 228, 15.855, 17.554, 22.188, 29.716, 35.516],
  ["imtP", 61, 11.77, 12.748, 15.244, 18.858, 21.34],
  ["imtP", 90, 11.803, 12.795, 15.524, 20.149, 23.994],
  ["imtP", 120, 12.378, 13.47, 16.613, 22.57, 28.378],
  ["imtP", 150, 13.379, 14.663, 18.399, 25.596, 32.708],
  ["imtP", 180, 14.362, 15.871, 20.212, 28.224, 35.538],
  ["imtP", 228, 14.724, 16.497, 21.427, 29.67, 36.179],
  ["tbL", 61, 96.49, 101.082, 110.265, 119.448, 124.039],
  ["tbL", 90, 108.135, 113.602, 124.536, 135.47, 140.938],
  ["tbL", 120, 118.658, 125.032, 137.78, 150.527, 156.901],
  ["tbL", 150, 130.66, 137.921, 152.442, 166.964, 174.225],
  ["tbL", 180, 145.545, 153.35, 168.958, 184.566, 192.371],
  ["tbL", 228, 154.648, 161.947, 176.543, 191.14, 198.438],
  ["tbP", 61, 95.282, 100.055, 109.602, 119.148, 123.921],
  ["tbP", 90, 106.762, 112.396, 123.665, 134.933, 140.567],
  ["tbP", 120, 119.446, 125.843, 138.636, 151.43, 157.826],
  ["tbP", 150, 133.292, 140.196, 154.004, 167.812, 174.716],
  ["tbP", 180, 141.032, 147.911, 161.669, 175.427, 182.306],
  ["tbP", 228, 143.532, 150.073, 163.155, 176.237, 182.777]
];

test('skor-z sesuai tabel WHO 2007 (IMT/U dan TB/U, laki-laki dan perempuan)', () => {
  for (const [kunci, bulan, sd3n, sd2n, sd0, sd2, sd3] of TITIK_WHO) {
    const [l, m, s] = K.lms_(kunci, bulan), batasi = kunci.startsWith('imt');
    [[sd3n, -3], [sd2n, -2], [sd0, 0], [sd2, 2], [sd3, 3]].forEach(([x, z]) =>
      assert.ok(Math.abs(K.skorZ_(x, l, m, s, batasi) - z) < 0.01, `${kunci} bulan ${bulan}: ${x} harus z=${z}`));
  }
});

test('umur bulan penuh dan kategori status gizi', () => {
  assert.equal(K.umurBulan_('2016-11-04', '2026-11-03'), 119);
  assert.equal(K.umurBulan_('2016-11-03', '2026-11-03'), 120);
  // laki-laki 120 bulan: median IMT 16,4 → gizi baik; tinggi median 137,8 cm
  let st = K.statusGizi_({ jk: 'L', lahir: '2016-11-03' }, '2026-11-03', 31.1, 137.8);
  assert.equal(st.umurBulan, 120);
  assert.equal(st.gizi, 'Gizi baik');
  assert.equal(st.tinggi, 'Normal');
  // anak yang sama, berat jauh lebih besar → obesitas; jauh lebih kecil → gizi kurang/buruk
  assert.equal(K.statusGizi_({ jk: 'L', lahir: '2016-11-03' }, '2026-11-03', 50, 137.8).gizi, 'Obesitas');
  assert.match(K.statusGizi_({ jk: 'L', lahir: '2016-11-03' }, '2026-11-03', 22, 137.8).gizi, /Gizi (kurang|buruk)/);
  // tinggi di bawah -2 SD → pendek
  assert.match(K.statusGizi_({ jk: 'P', lahir: '2016-11-03' }, '2026-11-03', 22, 120).tinggi, /pendek/i);
  // data tidak lengkap / di luar umur 5–19 tahun
  assert.equal(K.statusGizi_(undefined, '2026-11-03', 30, 130), null);
  assert.equal(K.statusGizi_({ jk: 'P', lahir: '2022-01-01' }, '2026-11-03', 18, 105).diLuarUmur, true);
});

test('kelas yang dibuka menampilkan status gizi dan rekap sekolah', () => {
  const g = buat();
  g.aktif['Data Lahir Siswa'] = lembar('Data Lahir Siswa', [['ID Siswa', 'Nama Siswa', 'Jenis Kelamin', 'Tanggal Lahir'],
    ['P1', 'Anak Dua', 'L', '2016-11-03'], ['P2', 'Anak Satu', 'P', '03/11/2016']]);
  g.api({ aksi: 'simpanTumbuh', kelas: '4', bulan: '2026-11', tanggal: '2026-11-03', isian: { P1: { bb: '31,1', tb: '137,8' }, P2: { bb: '50', tb: '138' } } });
  g.api({ aksi: 'simpanTumbuh', kelas: '5', bulan: '2026-11', tanggal: '2026-11-03', isian: { P4: { bb: '35', tb: '140' } } });
  const r = g.api({ aksi: 'tumbuhKelas', kelas: '4', bulan: '2026-11' });
  const p1 = r.siswa.find(s => s.id === 'P1'), p2 = r.siswa.find(s => s.id === 'P2');
  assert.equal(p1.status.gizi, 'Gizi baik');
  assert.equal(p2.status.gizi, 'Obesitas');
  assert.equal(p2.adaLahir, true);
  assert.deepEqual(r.rekap['4'].gizi, { 'Gizi baik': 1, Obesitas: 1 });
  assert.equal(r.rekap['5'].diukur, 1);
  assert.equal(r.rekap['5'].tanpaLahir, 1);
});
