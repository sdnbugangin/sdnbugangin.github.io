/* Kabar Sekolah SD N BUGANGIN — dipakai di beranda dan halaman kabar/.
   Data diambil dari Apps Script Ruang Super Admin; hanya artikel bertanda "Terbitkan". */
(function () {
  var API = 'https://script.google.com/macros/s/AKfycbyE3fM1cmCXeMsdoygOAP92MIKSngirrd3pOd2U1t4Nr63wAO3lOfEjUyCPBUA7PTor/exec';
  var SIMPAN = 'kabar-cache';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tgl(t) { var d = new Date(t + 'T00:00:00'); return isNaN(d) ? t : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function foto(id, w) { return 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(id) + '=w' + (w || 900); }
  function fotoCadangan(id, w) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (w || 900); }
  function img(id, w, alt) {
    return '<img src="' + foto(id, w) + '" alt="' + esc(alt || '') + '" loading="lazy" onerror="if(!this.dataset.c){this.dataset.c=1;this.src=\'' + fotoCadangan(id, w) + '\'}else{this.remove()}">';
  }
  function ringkas(isi, n) {
    var t = String(isi || '').replace(/\s+/g, ' ').replace(/^Kendal, [^—]+—\s*/, '').trim();
    return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
  }
  function paragraf(isi) {
    return String(isi || '').split(/\n\s*\n|\r?\n/).map(function (p) { return p.trim(); }).filter(Boolean)
      .map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
  }

  function kartu(k, href) {
    return '<a class="kabar" href="' + href + '?id=' + encodeURIComponent(k.id) + '">' +
      '<div class="kabar-media">' + (k.foto && k.foto[0] ? img(k.foto[0], 700, k.judul) : '') + '<span aria-hidden="true">&#128240;</span></div>' +
      '<div class="kabar-isi"><span class="kabar-tgl">' + esc(tgl(k.tanggal)) + '</span><h3>' + esc(k.judul) + '</h3>' +
      '<p>' + esc(ringkas(k.isi, 140)) + '</p><span class="kabar-baca">Baca selengkapnya &rarr;</span></div></a>';
  }

  function artikel(k) {
    var f = k.foto || [];
    return '<article class="kabar-artikel"><p class="kabar-tgl">' + esc(tgl(k.tanggal)) + (k.penulis ? ' &middot; Ditulis oleh ' + esc(k.penulis) : '') + '</p>' +
      '<h1>' + esc(k.judul) + '</h1>' +
      (f[0] ? '<figure class="kabar-utama">' + img(f[0], 1200, k.judul) + '</figure>' : '') +
      '<div class="kabar-teks">' + paragraf(k.isi) + '</div>' +
      (f.length > 1 ? '<div class="kabar-galeri">' + f.slice(1).map(function (id) { return '<a href="' + foto(id, 1600) + '" target="_blank" rel="noopener">' + img(id, 600, 'Foto kegiatan') + '</a>'; }).join('') + '</div>' : '') +
      '</article>';
  }

  function bacaCache() { try { return JSON.parse(localStorage.getItem(SIMPAN) || 'null'); } catch (e) { return null; } }
  function tulisCache(d) { try { localStorage.setItem(SIMPAN, JSON.stringify(d)); } catch (e) {} }

  function ambil(cb) {
    var lama = bacaCache();
    if (lama && lama.length) cb(lama, true);
    fetch(API + '?aksi=kabar').then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok || !Array.isArray(d.kabar)) return;
      tulisCache(d.kabar);
      cb(d.kabar, false);
    }).catch(function () {});
  }

  window.Kabar = { ambil: ambil, kartu: kartu, artikel: artikel, ringkas: ringkas };
})();
