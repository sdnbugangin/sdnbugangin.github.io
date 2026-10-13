/* Prestasi siswa SD N BUGANGIN — dipakai di beranda dan halaman prestasi/.
   Data diambil dari Apps Script Ruang Guru; hanya prestasi bertanda "Tampilkan di beranda". */
(function () {
  var API = 'https://script.google.com/macros/s/AKfycbyE3fM1cmCXeMsdoygOAP92MIKSngirrd3pOd2U1t4Nr63wAO3lOfEjUyCPBUA7PTor/exec';
  var SIMPAN = 'prestasi-cache';
  var TINGKAT = ['Sekolah', 'Gugus', 'Kecamatan', 'Kabupaten', 'Provinsi', 'Nasional', 'Internasional'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function judulNama(n) { return String(n || '').toLowerCase().replace(/(^|[\s'’-])\S/g, function (c) { return c.toUpperCase(); }); }
  function tgl(t) { var d = new Date(t + 'T00:00:00'); return isNaN(d) ? t : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function foto(id) { return 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(id) + '=w800'; }
  function fotoCadangan(id) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w800'; }

  function kartu(p) {
    var tinggi = TINGKAT.indexOf(p.tingkat) >= 3;
    var gambar = p.foto
      ? '<img src="' + foto(p.foto) + '" alt="Foto prestasi ' + esc(p.cabang) + '" loading="lazy" onerror="if(!this.dataset.c){this.dataset.c=1;this.src=\'' + fotoCadangan(p.foto) + '\'}else{this.parentNode.classList.add(\'tanpa\');this.remove()}">'
      : '';
    return '<article class="prestasi' + (p.foto ? '' : ' tanpa') + '">' +
      '<div class="prestasi-media">' + gambar + '<span class="prestasi-piala" aria-hidden="true">&#127942;</span></div>' +
      '<div class="prestasi-isi">' +
      '<span class="prestasi-lencana' + (tinggi ? ' tinggi' : '') + '">' + esc(p.juara) + ' &middot; Tingkat ' + esc(p.tingkat) + '</span>' +
      '<h3>' + p.siswa.map(function (s) { return esc(judulNama(s.nama)) + (s.kelas ? ' <small>' + esc(s.kelas) + '</small>' : ''); }).join(', ') + '</h3>' +
      '<p class="prestasi-cabang">' + esc(p.cabang) + (p.lomba ? ' &middot; ' + esc(p.lomba) : '') + '</p>' +
      '<p class="prestasi-meta">' + esc(tgl(p.tanggal)) + (p.penyelenggara ? ' &middot; ' + esc(p.penyelenggara) : '') +
      (p.pembimbing ? '<br>Pembimbing: ' + esc(p.pembimbing) : '') + '</p>' +
      '</div></article>';
  }

  function ringkas(list) {
    var th = String(new Date().getFullYear());
    var ini = list.filter(function (p) { return p.tanggal.indexOf(th) === 0; });
    var dasar = ini.length ? ini : list;
    var atas = dasar.filter(function (p) { return TINGKAT.indexOf(p.tingkat) >= 3; }).length;
    return '<b>' + dasar.length + ' prestasi</b> ' + (ini.length ? 'sepanjang ' + th : 'tercatat') +
      (atas ? ' &middot; <b>' + atas + '</b> di tingkat Kabupaten ke atas' : '');
  }

  function bacaCache() { try { return JSON.parse(localStorage.getItem(SIMPAN) || 'null'); } catch (e) { return null; } }
  function tulisCache(d) { try { localStorage.setItem(SIMPAN, JSON.stringify(d)); } catch (e) {} }

  /* panggil(fungsi): fungsi(daftar) dipanggil dengan data tersimpan dulu (kalau ada), lalu data terbaru. */
  function ambil(cb) {
    var lama = bacaCache();
    if (lama && lama.length) cb(lama, true);
    fetch(API + '?aksi=prestasi').then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok || !Array.isArray(d.prestasi)) return;
      tulisCache(d.prestasi);
      cb(d.prestasi, false);
    }).catch(function () { /* tetap tampilkan data tersimpan, atau biarkan tersembunyi */ });
  }

  window.Prestasi = { ambil: ambil, kartu: kartu, ringkas: ringkas, TINGKAT: TINGKAT };
})();
