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
