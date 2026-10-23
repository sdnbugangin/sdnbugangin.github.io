// Tiruan layanan Google Apps Script di memori untuk menguji aplikasi IDP (idp/apps-script/Kode.gs).
// Hanya meniru metode yang dipakai Kode.gs; metode format (setFontWeight, dll.) diterima tanpa efek.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function tanpaEfek(target) {
  const p = new Proxy(target, { get: (t, k) => (k in t ? t[k] : () => p) });
  return p;
}

class Sheet {
  constructor(nama) { this.nama = nama; this.data = []; this.format = {}; }
  getName() { return this.nama; }
  setName(n) { this.nama = n; return this; }
  getSheetId() { return this.nama.length; }
  getLastRow() {
    for (let i = this.data.length; i > 0; i--) if ((this.data[i - 1] || []).some((x) => x !== '' && x !== undefined)) return i;
    return 0;
  }
  getMaxRows() { return 1000; }
  getLastColumn() { return Math.max(0, ...this.data.map((r) => r.length)); }
  setColumnWidth() { return this; }
  setColumnWidths() { return this; }
  appendRow(r) { this.data[this.getLastRow()] = r.slice(); return this; }
  deleteRow(n) { this.data.splice(n - 1, 1); }
  getDataRange() {
    const akhir = this.getLastRow();
    const lebar = Math.max(1, ...this.data.slice(0, akhir).map((r) => r.length));
    return this.getRange(1, 1, Math.max(akhir, 1), lebar);
  }
  getRange(baris, kolom, banyak = 1, lebar = 1) {
    const sh = this;
    if (typeof baris === 'string') {
      const m = baris.match(/^([A-Z])(\d*)(?::([A-Z])(\d*))?$/);
      kolom = m[1].charCodeAt(0) - 64;
      baris = m[2] ? Number(m[2]) : 1;
      banyak = m[2] ? 1 : 1000;
      lebar = m[3] ? m[3].charCodeAt(0) - 64 - kolom + 1 : 1;
    }
    const r = {
      getValues() {
        const hasil = [];
        for (let i = 0; i < banyak; i++) {
          const row = sh.data[baris - 1 + i] || [];
          hasil.push(Array.from({ length: lebar }, (_, j) => (row[kolom - 1 + j] === undefined ? '' : row[kolom - 1 + j])));
        }
        return hasil;
      },
      getDisplayValues() { return r.getValues().map((row) => row.map((x) => (x instanceof Date ? x.toISOString() : String(x)))); },
      setValues(v) {
        if (v.length !== banyak || v.some((x) => x.length !== lebar)) throw new Error('Ukuran data tidak cocok dengan rentang.');
        v.forEach((row, i) => row.forEach((x, j) => r._tulis(i, j, x)));
        return r.__diri;
      },
      setValue(x) { r._tulis(0, 0, x); return r.__diri; },
      clearContent() { for (let i = 0; i < banyak; i++) for (let j = 0; j < lebar; j++) r._tulis(i, j, ''); return r.__diri; },
      setNumberFormat(f) {
        for (let i = 0; i < Math.min(banyak, 60); i++) for (let j = 0; j < lebar; j++) sh.format[(baris + i) + ':' + (kolom + j)] = f;
        if (banyak > 60) for (let j = 0; j < lebar; j++) sh.format['*:' + (kolom + j)] = f;
        return r.__diri;
      },
      _tulis(i, j, x) {
        const b = baris - 1 + i, k = kolom - 1 + j;
        while (sh.data.length <= b) sh.data.push([]);
        // Seperti Google Sheets: teks berupa angka berubah jadi angka, kecuali selnya berformat teks.
        const teks = sh.format[(b + 1) + ':' + (k + 1)] === '@' || sh.format['*:' + (k + 1)] === '@';
        if (typeof x === 'string' && /^\d+(\.\d+)?$/.test(x) && !teks) x = Number(x);
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
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
}

/** gemini(url, kunci) → { kode, isi } menentukan jawaban tiruan layanan Gemini. */
function buatGas({ pemilik = 'pemilik@gmail.com', pengunjung = '', gemini } = {}) {
  let nomor = 0;
  const berkas = {};
  const folder = {};
  const cache = new Map();
  const props = {};
  const panggilan = [];
  const pusat = new Spreadsheet('pusat', 'APLIKASI IDP');
  const tpl = new Spreadsheet('TEMPLATE_IDP_1234567890abc', 'TEMPLATE');
  tpl.sheets = [new Sheet('FORM 1'), new Sheet('FORM 2')];
  berkas[tpl.id] = { ss: tpl, sampah: false };
  const sesi = { aktif: pengunjung };
  const objekFolder = (id) => ({
    getId: () => id, isTrashed: () => false,
    createFolder: (nama) => buatFolder(nama, id),
    moveTo: (f) => { folder[id].induk = f.getId(); }
  });
  const buatFolder = (nama, induk) => { const id = 'folder' + (++nomor); folder[id] = { nama, induk }; return objekFolder(id); };
  const jawabGemini = gemini || ((url) => (url.includes(':generateContent')
    ? { kode: 200, isi: { candidates: [{ content: { parts: [{ text: '[{"catatan":"Catatan dari AI."}]' }] } }] } }
    : { kode: 200, isi: { models: [{ name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] }] } }));

  const gas = {
    SpreadsheetApp: {
      getActive: () => pusat,
      openById: (id) => { if (!berkas[id]) throw new Error('Tidak ditemukan: ' + id); return berkas[id].ss; },
      flush: () => {},
      getUi: () => { throw new Error('Tidak ada UI'); }
    },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 },
      createFolder: (nama) => buatFolder(nama, 'akar'),
      getFolderById: (id) => { if (!folder[id]) throw new Error('Folder tidak ditemukan: ' + id); return objekFolder(id); },
      getFileById: (id) => {
        if (!berkas[id]) throw new Error('Berkas tidak ditemukan: ' + id);
        return {
          isTrashed: () => berkas[id].sampah,
          makeCopy: (nama, f) => {
            const salin = new Spreadsheet('ss' + (++nomor), nama);
            salin.sheets = berkas[id].ss.sheets.map((sh) => { const b = new Sheet(sh.nama); b.data = sh.data.map((r) => r.slice()); return b; });
            berkas[salin.id] = { ss: salin, sampah: false, folder: f.getId() };
            return { getId: () => salin.id, setSharing: () => {} };
          }
        };
      }
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => { cache.set(k, String(v)); },
        remove: (k) => { cache.delete(k); }
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = String(v); },
        deleteProperty: (k) => { delete props[k]; }
      })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    Session: {
      getActiveUser: () => ({ getEmail: () => sesi.aktif }),
      getEffectiveUser: () => ({ getEmail: () => pemilik })
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256', MD5: 'md5' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, teks) => [...crypto.createHash(alg).update(teks, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes.map((b) => (b < 0 ? b + 256 : b))).toString('base64url'),
      getUuid: () => crypto.randomUUID(),
      sleep: () => {},
      formatDate: (d, zona, pola) => (pola === 'H' ? '10' : pola === 'm' ? '0' : new Date(d).toISOString())
    },
    Logger: { log: () => {} },
    UrlFetchApp: {
      fetch: (url, o) => {
        const kunci = o.headers['x-goog-api-key'];
        panggilan.push({ url, kunci });
        const j = jawabGemini(url, kunci);
        return { getResponseCode: () => j.kode, getContentText: () => JSON.stringify(j.isi) };
      }
    },
    HtmlService: {}
  };
  const ctx = vm.createContext({ ...gas, console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Kode.gs'), 'utf8'), ctx, { filename: 'Kode.gs' });
  /** Panggilan dari halaman Web App: hasil diubah ke JSON seperti google.script.run. */
  const panggil = (fn, ...args) => {
    ctx.CFG_MEMO = null; ctx.SEKOLAH_MEMO = null;   // tiap panggilan = eksekusi baru
    return JSON.parse(JSON.stringify(ctx[fn](...args)));
  };
  return { ctx, pusat, tpl, berkas, folder, props, cache, sesi, panggilan, panggil };
}

module.exports = { buatGas };
