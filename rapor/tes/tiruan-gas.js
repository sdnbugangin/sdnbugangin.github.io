// Tiruan layanan Google Apps Script di memori, cukup untuk menguji alur akun dan pembuatan spreadsheet.
// Hanya meniru metode yang dipakai berkas .gs; metode format (setFontWeight, dll.) diterima tanpa efek.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BERKAS_GS = ['Referensi.gs', 'Narasi.gs', 'Hitung.gs', 'Kode.gs', 'Akun.gs', 'Sekolah.gs', 'Data.gs', 'Tp.gs', 'Nilai.gs', 'Kokurikuler.gs'];
const MAKS_BARIS = 1000;

function tanpaEfek(target) {
  const p = new Proxy(target, { get: (t, k) => (k in t ? t[k] : () => p) });
  return p;
}

class Sheet {
  constructor(nama) { this.nama = nama; this.data = []; this.format = {}; this.maks = MAKS_BARIS; }
  getName() { return this.nama; }
  setName(n) { this.nama = n; return this; }
  getLastRow() {
    for (let i = this.data.length; i > 0; i--) if ((this.data[i - 1] || []).some((x) => x !== '' && x !== undefined)) return i;
    return 0;
  }
  getMaxRows() { return this.maks; }
  insertRowsAfter(_, banyak) { this.maks += banyak; }
  appendRow(r) { this.data[this.getLastRow()] = r.slice(); return this; } // seperti Sheets: setelah baris berisi terakhir
  deleteRow(n) { this.data.splice(n - 1, 1); }
  setFrozenRows() { return this; }
  getDataRange() {
    const akhir = this.getLastRow();
    const lebar = Math.max(0, ...this.data.slice(0, akhir).map((r) => r.length));
    return this.getRange(1, 1, Math.max(akhir, 1), Math.max(lebar, 1));
  }
  getRange(baris, kolom, banyak = 1, lebar = 1) {
    const sh = this;
    const r = {
      getValues() {
        const hasil = [];
        for (let i = 0; i < banyak; i++) {
          const row = sh.data[baris - 1 + i] || [];
          hasil.push(Array.from({ length: lebar }, (_, j) => (row[kolom - 1 + j] === undefined ? '' : row[kolom - 1 + j])));
        }
        return hasil;
      },
      setValues(v) {
        if (v.length !== banyak || v.some((x) => x.length !== lebar)) throw new Error('Ukuran data tidak cocok dengan rentang.');
        v.forEach((row, i) => row.forEach((x, j) => r._tulis(i, j, x)));
        return r.__diri;
      },
      setValue(x) { r._tulis(0, 0, x); return r.__diri; },
      clearContent() {
        for (let i = 0; i < banyak; i++) for (let j = 0; j < lebar; j++) r._tulis(i, j, '');
        return r.__diri;
      },
      setNumberFormat(f) {
        for (let i = 0; i < banyak; i++) for (let j = 0; j < lebar; j++) sh.format[(baris + i) + ':' + (kolom + j)] = f;
        return r.__diri;
      },
      _tulis(i, j, x) {
        const b = baris - 1 + i, k = kolom - 1 + j;
        while (sh.data.length <= b) sh.data.push([]);
        // Seperti Google Sheets: teks berupa angka berubah jadi angka, kecuali kolomnya berformat teks.
        if (typeof x === 'string' && /^\d+(\.\d+)?$/.test(x) && sh.format[(b + 1) + ':' + (k + 1)] !== '@') x = Number(x);
        sh.data[b][k] = x;
      }
    };
    r.__diri = tanpaEfek(r);
    return r.__diri;
  }
}

class Spreadsheet {
  constructor(id, nama) { this.id = id; this.nama = nama; this.sheets = [new Sheet('Sheet1')]; }
  getId() { return this.id; }
  getName() { return this.nama; }
  getSheets() { return this.sheets.slice(); }
  getSheetByName(n) { return this.sheets.find((s) => s.nama === n) || null; }
  insertSheet(n) {
    if (this.getSheetByName(n)) throw new Error('Sheet sudah ada: ' + n);
    const s = new Sheet(n); this.sheets.push(s); return s;
  }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
}

function buatGas() {
  let nomor = 0;
  const berkas = {};
  const cache = new Map();
  const surat = [];
  // Google Drive tiruan: folder (id → { nama, induk, sampah }) dan letak tiap berkas (id → id folder induk).
  const folder = {};
  const lokasi = { pusat: 'akar' };
  let nomorFolder = 0;
  const objekFolder = (id) => ({
    getId: () => id,
    getName: () => folder[id].nama,
    isTrashed: () => folder[id].sampah,
    createFolder: (nama) => buatFolder(nama, id),
    moveTo: (f) => { folder[id].induk = f.getId(); }
  });
  const buatFolder = (nama, induk) => {
    const id = 'folder' + (++nomorFolder);
    folder[id] = { nama, induk, sampah: false };
    return objekFolder(id);
  };
  const pusat = new Spreadsheet('pusat', 'Rapor SD - Pusat');
  const jam = { sekarang: Date.UTC(2026, 9, 18, 3, 0, 0) };

  const NativeDate = Date;
  class TiruanDate extends NativeDate {
    constructor(...a) { if (a.length) super(...a); else super(jam.sekarang); }
    static now() { return jam.sekarang; }
  }

  const gas = {
    Date: TiruanDate,
    SpreadsheetApp: {
      getActive: () => pusat,
      create: (nama) => {
        const ss = new Spreadsheet('ss' + (++nomor), nama);
        berkas[ss.id] = { ss, sampah: false };
        lokasi[ss.id] = 'akar'; // seperti Google: berkas baru selalu di akar Drive
        return ss;
      },
      openById: (id) => { if (!berkas[id]) throw new Error('Tidak ditemukan: ' + id); return berkas[id].ss; }
    },
    DriveApp: {
      createFolder: (nama) => buatFolder(nama, 'akar'),
      getFolderById: (id) => { if (!folder[id]) throw new Error('Folder tidak ditemukan: ' + id); return objekFolder(id); },
      getFileById: (id) => {
        if (!(id in lokasi)) throw new Error('Berkas tidak ditemukan: ' + id);
        return {
          moveTo: (f) => { if (gas.DriveApp.gagalPindah) throw new Error('Gagal memindah'); lokasi[id] = f.getId(); },
          setTrashed: (v) => { if (berkas[id]) berkas[id].sampah = v; }
        };
      }
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => { const v = cache.get(k); return v && v.sampai > jam.sekarang ? v.isi : null; },
        put: (k, isi, detik) => { cache.set(k, { isi: String(isi), sampai: jam.sekarang + detik * 1000 }); },
        remove: (k) => { cache.delete(k); }
      })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    MailApp: {
      kuota: 100,
      getRemainingDailyQuota() { return this.kuota; },
      sendEmail(o) { this.kuota--; surat.push(o); }
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, teks) => [...crypto.createHash(alg).update(teks, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
      base64Encode: (bytes) => Buffer.from(bytes.map((b) => (b < 0 ? b + 256 : b))).toString('base64'),
      computeHmacSha256Signature: (teks, kunci) =>
        [...crypto.createHmac('sha256', kunci).update(teks, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
      getUuid: () => crypto.randomUUID()
    },
    ScriptApp: { getOAuthToken: () => 'token-tiruan' },
    UrlFetchApp: {
      fetch: (url, o) => {
        const m = url.match(/spreadsheets\/d\/([^/]+)\/export\?format=xlsx$/);
        const ada = m && berkas[m[1]] && o.headers.Authorization === 'Bearer token-tiruan';
        return {
          getResponseCode: () => (ada ? 200 : 404),
          getBlob: () => ({ getBytes: () => [...Buffer.from('xlsx:' + (m && m[1]))] })
        };
      }
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t) => ({ setMimeType: () => ({ isi: JSON.parse(t) }) })
    }
  };

  const ctx = vm.createContext({ ...gas, console });
  for (const f of BERKAS_GS) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', f), 'utf8'), ctx, { filename: f });
  }
  /** Isi akar Drive yang bukan sampah: harus hanya folder utama. */
  const isiAkar = () => [
    ...Object.entries(folder).filter(([, f]) => f.induk === 'akar' && !f.sampah).map(([, f]) => '📁 ' + f.nama),
    ...Object.entries(lokasi).filter(([id, l]) => l === 'akar' && !(berkas[id] && berkas[id].sampah)).map(([id]) => '📄 ' + id)
  ];
  return { ctx, pusat, berkas, cache, surat, jam, folder, lokasi, isiAkar, MailApp: gas.MailApp, DriveApp: gas.DriveApp };
}

/**
 * Sekolah yang sudah daftar, aktif, dan masuk. g.minta(req) mengirim permintaan dengan sesi sekolah itu.
 * Bila g sudah ada (mis. untuk sekolah kedua di Pusat yang sama), sekolah baru didaftarkan di g itu.
 */
function sekolahAktif(data, g) {
  data = data || { npsn: '20321653', nama: 'SD N BUGANGIN', email: 'sdnbugangin@gmail.com', sandi: 'rapor2026', ulangi: 'rapor2026', setuju: true };
  if (!g) { g = buatGas(); g.ctx.siapkan(); }
  const panggil = (req) => JSON.parse(JSON.stringify(g.ctx.layani_(req)));
  panggil({ aksi: 'daftar', data });
  const token = g.surat.at(-1).htmlBody.match(/\?verifikasi=([0-9a-f]+)/)[1];
  panggil({ aksi: 'verifikasi', token });
  const { sesi } = panggil({ aksi: 'masuk', email: data.email, sandi: data.sandi });
  const id = g.pusat.getSheetByName('Sekolah').data.find((r) => r[0] === data.npsn)[6];
  return {
    ...g,
    minta: (req) => panggil({ sesi, ...req }),
    ss: g.berkas[id].ss,
    isi(nama) { return this.ss.getSheetByName(nama).data.slice(1).filter((r) => r.some((x) => x !== '' && x !== undefined)); }
  };
}

module.exports = { buatGas, sekolahAktif, BERKAS_GS };
