// Uji alur masuk, ganti sandi, kunci 15 menit, dan atur ulang oleh guru — memakai tiruan layanan Google.
// Data di sini buatan (bukan data siswa asli). Jalankan: node --test pantau/tes/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function lembar(baris) {
  const sh = {
    v: baris,
    getDataRange: () => ({ getValues: () => sh.v.map(r => r.slice()) }),
    appendRow: r => { sh.v.push(r.slice()); },
    getRange: (b, k, nb, nk) => ({
      setValues: isi => { isi.forEach((r, i) => r.forEach((x, j) => { while (sh.v.length < b + i) sh.v.push([]); sh.v[b - 1 + i][k - 1 + j] = x; })); }
    })
  };
  return sh;
}

function buat() {
  let jam = 0;
  const cache = new Map();
  const rapor = {
    Siswa: lembar([['ID Siswa', 'NISN', 'Nama Lengkap'], ['S1', '0161234567', 'Anak Contoh']])
  };
  const db = {
    'Akun Ortu': lembar([['NISN', 'Hash Sandi', 'Garam', 'Diubah Pada', 'Masuk Terakhir']]),
    Pengaturan: lembar([['Kunci', 'Nilai', 'Keterangan'], ['Batas Tuntas', 70, ''], ['PIN Guru', 'guru123', '']]),
    Log: lembar([['Waktu', 'NISN', 'Aksi']])
  };
  const ss = isi => ({ getSheetByName: n => isi[n] || null });
  const ctx = {
    console,
    CacheService: { getScriptCache: () => ({
      get: k => { const c = cache.get(k); return c && c.s > jam ? c.v : null; },
      put: (k, v, detik) => cache.set(k, { v: String(v), s: jam + detik }),
      remove: k => cache.delete(k)
    }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'DB' }) },
    SpreadsheetApp: { openById: id => (id === 'DB' ? ss(db) : ss(rapor)) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_, s) => Array.from(crypto.createHash('sha256').update(s).digest()).map(b => (b > 127 ? b - 256 : b))
    },
    ContentService: { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Kode.gs'), 'utf8'), ctx);
  const api = req => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(req) } }).t);
  return { api, db, majukan: detik => { jam += detik; } };
}

const NISN = '0161234567';

test('masuk pertama dengan sandi awal wajib ganti sandi sebelum melihat data', () => {
  const g = buat();
  const m = g.api({ aksi: 'masuk', nisn: NISN, sandi: 'muridsuper' });
  assert.equal(m.ok, true);
  assert.equal(m.wajibGanti, true);
  assert.equal(g.api({ aksi: 'ketuntasan', sesi: m.sesi }).wajibGanti, true);
  assert.match(g.api({ aksi: 'gantiSandi', sesi: m.sesi, baru: 'muridsuper', ulangi: 'muridsuper' }).pesan, /sandi awal/);
  assert.equal(g.api({ aksi: 'gantiSandi', sesi: m.sesi, baru: 'rahasia', ulangi: 'rahasia' }).ok, true);
  // hash tersimpan, bukan sandi asli
  const baris = g.db['Akun Ortu'].v[1];
  assert.equal(baris[0], NISN);
  assert.ok(!baris.includes('rahasia'));
  // sandi awal tidak berlaku lagi, sandi baru berlaku tanpa wajib ganti
  assert.equal(g.api({ aksi: 'masuk', nisn: NISN, sandi: 'muridsuper' }).ok, false);
  const m2 = g.api({ aksi: 'masuk', nisn: NISN, sandi: 'rahasia' });
  assert.equal(m2.ok, true);
  assert.equal(m2.wajibGanti, false);
});

test('NISN tidak terdaftar dan sandi salah mendapat pesan yang sama', () => {
  const g = buat();
  assert.equal(g.api({ aksi: 'masuk', nisn: '0000000000', sandi: 'muridsuper' }).pesan, 'NISN atau sandi salah.');
  assert.equal(g.api({ aksi: 'masuk', nisn: NISN, sandi: 'salah' }).pesan, 'NISN atau sandi salah.');
  assert.match(g.api({ aksi: 'masuk', nisn: '123', sandi: 'x' }).pesan, /10 angka/);
});

test('5 kali salah → dikunci 15 menit, sandi benar pun ditolak, lalu terbuka lagi', () => {
  const g = buat();
  for (let i = 0; i < 4; i++) assert.equal(g.api({ aksi: 'masuk', nisn: NISN, sandi: 'salah' }).pesan, 'NISN atau sandi salah.');
  assert.match(g.api({ aksi: 'masuk', nisn: NISN, sandi: 'salah' }).pesan, /15 menit/);
  assert.match(g.api({ aksi: 'masuk', nisn: NISN, sandi: 'muridsuper' }).pesan, /15 menit/);
  g.majukan(15 * 60 + 1);
  assert.equal(g.api({ aksi: 'masuk', nisn: NISN, sandi: 'muridsuper' }).ok, true);
});

test('ganti sandi sukarela memerlukan sandi lama', () => {
  const g = buat();
  const m = g.api({ aksi: 'masuk', nisn: NISN, sandi: 'muridsuper' });
  g.api({ aksi: 'gantiSandi', sesi: m.sesi, baru: 'satu1', ulangi: 'satu1' });
  const m2 = g.api({ aksi: 'masuk', nisn: NISN, sandi: 'satu1' });
  assert.match(g.api({ aksi: 'gantiSandi', sesi: m2.sesi, lama: 'keliru', baru: 'dua2', ulangi: 'dua2' }).pesan, /lama salah/);
  assert.equal(g.api({ aksi: 'gantiSandi', sesi: m2.sesi, lama: 'satu1', baru: 'dua2', ulangi: 'dua2' }).ok, true);
});

test('guru mengatur ulang sandi dengan PIN; PIN salah 5 kali terkunci', () => {
  const g = buat();
  const m = g.api({ aksi: 'masuk', nisn: NISN, sandi: 'muridsuper' });
  g.api({ aksi: 'gantiSandi', sesi: m.sesi, baru: 'lupa1', ulangi: 'lupa1' });
  assert.match(g.api({ aksi: 'guruReset', pin: 'salah', nisn: NISN }).pesan, /PIN Guru salah/);
  const r = g.api({ aksi: 'guruReset', pin: 'guru123', nisn: NISN });
  assert.equal(r.ok, true);
  const m2 = g.api({ aksi: 'masuk', nisn: NISN, sandi: 'muridsuper' });
  assert.equal(m2.ok, true);
  assert.equal(m2.wajibGanti, true);
  for (let i = 0; i < 5; i++) g.api({ aksi: 'guruReset', pin: 'x', nisn: NISN });
  assert.match(g.api({ aksi: 'guruReset', pin: 'guru123', nisn: NISN }).pesan, /Terlalu banyak/);
});

test('sesi habis dan keluar', () => {
  const g = buat();
  const m = g.api({ aksi: 'masuk', nisn: NISN, sandi: 'muridsuper' });
  g.api({ aksi: 'keluar', sesi: m.sesi });
  assert.equal(g.api({ aksi: 'ketuntasan', sesi: m.sesi }).sesiHabis, true);
});
