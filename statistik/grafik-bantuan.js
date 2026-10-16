/* Grafik "Bantuan Pendidikan Tersalurkan" di beranda.
   Data ringkas per tahun dari Apps Script (tanpa nama). Jumlah siswa di bawah batas samaran
   tidak dikirim server; di sini ditulis "< 3" dan batangnya digambar bertekstur setinggi tetap. */
(function () {
  var API = 'https://script.google.com/macros/s/AKfycbyE3fM1cmCXeMsdoygOAP92MIKSngirrd3pOd2U1t4Nr63wAO3lOfEjUyCPBUA7PTor/exec';
  var SIMPAN = 'grafik-bantuan-cache';
  var JENIS = [
    { j: 'PIP', label: 'PIP', ikon: '🎓', warna: 'var(--gb-1)' },
    { j: 'BAZNAS', label: 'BAZNAS', ikon: '💚', warna: 'var(--gb-2)' },
    { j: 'Santunan Yatim Piatu', label: 'Santunan Yatim Piatu', ikon: '🤲', warna: 'var(--gb-3)' }
  ];
  var TAHUN = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rp(n) { return 'Rp' + Number(n || 0).toLocaleString('id-ID'); }
  function teksSiswa(d, batas) { return !d ? '0' : d.kecil ? '< ' + batas : String(d.siswa); }
  function cari(data, th, j) { return data.filter(function (d) { return d.tahun === th && d.jenis === j; })[0]; }

  function tiles(g, th) {
    return JENIS.map(function (x) {
      var d = cari(g.data, th, x.j);
      return '<div class="gb-tile"><div class="gb-tile-h"><span class="gb-dot" style="background:' + x.warna + '"></span>' + x.ikon + ' ' + esc(x.label) + '</div>' +
        '<div class="gb-num">' + esc(teksSiswa(d, g.batasSamaran)) + ' <small>siswa</small></div>' +
        '<div class="gb-dana">' + (d ? '<b>' + rp(d.dana) + '</b> tersalurkan' : 'Belum ada penyaluran') + ' &middot; ' + th + '</div></div>';
    }).join('');
  }

  function chart(g) {
    var tahun = uniq(g.data.map(function (d) { return d.tahun; })).sort();
    var maxN = Math.max(g.batasSamaran, Math.max.apply(null, g.data.map(function (d) { return d.siswa || 0; })));
    var bar = 24, gap = 2, grup = JENIS.length * bar + (JENIS.length - 1) * gap, sela = 56;
    var kiri = 8, atas = 26, tinggi = 170, bawah = 28;
    var lebar = Math.max(320, kiri * 2 + tahun.length * grup + (tahun.length + 1) * sela);
    var h = atas + tinggi + bawah, base = atas + tinggi;
    var out = ['<svg viewBox="0 0 ' + lebar + ' ' + h + '" role="img" aria-label="Grafik jumlah siswa penerima bantuan per tahun">',
      '<defs>' + JENIS.map(function (x, i) { return '<pattern id="gb-tekstur-' + i + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff"/><rect width="3" height="6" style="fill:' + x.warna + '"/></pattern>'; }).join('') + '</defs>'];
    // garis bantu tipis (resesif)
    [0.5, 1].forEach(function (f) { var y = base - tinggi * f; out.push('<line x1="0" x2="' + lebar + '" y1="' + y + '" y2="' + y + '" stroke="var(--gb-grid)" stroke-width="1" stroke-dasharray="3 4"/>'); });
    var mulai = (lebar - (tahun.length * grup + (tahun.length - 1) * sela)) / 2;
    tahun.forEach(function (th, ti) {
      var x0 = mulai + ti * (grup + sela);
      JENIS.forEach(function (x, ji) {
        var d = cari(g.data, th, x.j), bx = x0 + ji * (bar + gap);
        var tinggiBar = !d ? 0 : d.kecil ? 16 : Math.max(4, tinggi * d.siswa / maxN);
        var y = base - tinggiBar, label = teksSiswa(d, g.batasSamaran);
        if (tinggiBar) {
          var r = Math.min(4, tinggiBar / 2);
          var path = 'M' + bx + ',' + base + 'V' + (y + r) + 'Q' + bx + ',' + y + ' ' + (bx + r) + ',' + y + 'H' + (bx + bar - r) + 'Q' + (bx + bar) + ',' + y + ' ' + (bx + bar) + ',' + (y + r) + 'V' + base + 'Z';
          out.push(d.kecil
            ? '<path d="' + path + '" fill="url(#gb-tekstur-' + ji + ')" style="stroke:' + x.warna + '" stroke-width="1.5"/>'
            : '<path d="' + path + '" fill="' + x.warna + '"/>');
        }
        out.push('<text x="' + (bx + bar / 2) + '" y="' + (y - 6) + '" text-anchor="middle" font-size="12" font-weight="800" fill="var(--gb-ink)">' + esc(label) + '</text>');
        var info = x.label + ' · ' + th + '|' + (d ? (d.kecil ? 'kurang dari ' + g.batasSamaran + ' siswa' : d.siswa + ' siswa') + ' · ' + rp(d.dana) : 'belum ada penyaluran');
        out.push('<rect class="gb-hit" tabindex="0" x="' + (bx - 1) + '" y="' + atas + '" width="' + (bar + 2) + '" height="' + tinggi + '" data-info="' + esc(info) + '" data-x="' + (bx + bar / 2) + '" data-y="' + y + '"><title>' + esc(info.replace('|', ': ')) + '</title></rect>');
      });
      out.push('<text x="' + (x0 + grup / 2) + '" y="' + (base + 19) + '" text-anchor="middle" font-size="13" font-weight="700" fill="var(--gb-ink2)">' + th + '</text>');
    });
    out.push('<line x1="0" x2="' + lebar + '" y1="' + base + '" y2="' + base + '" stroke="#cfc6b2" stroke-width="1"/>');
    out.push('</svg>');
    return { svg: out.join(''), lebar: lebar, h: h };
  }

  function tabel(g) {
    return '<table class="gb-table"><thead><tr><th>Tahun</th><th>Jenis bantuan</th><th class="n">Jumlah siswa</th><th class="n">Total dana</th></tr></thead><tbody>' +
      g.data.slice().sort(function (a, b) { return b.tahun - a.tahun; }).map(function (d) {
        return '<tr><td>' + d.tahun + '</td><td>' + esc(d.jenis) + '</td><td class="n">' + esc(teksSiswa(d, g.batasSamaran)) + '</td><td class="n">' + rp(d.dana) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  function render(g) {
    var sec = document.getElementById('grafik-bantuan');
    if (!sec) return;
    if (!g || !g.tampil || !g.data || !g.data.length) { sec.hidden = true; return; }
    var tahun = uniq(g.data.map(function (d) { return d.tahun; })).sort();
    if (TAHUN === null || tahun.indexOf(TAHUN) < 0) TAHUN = tahun[tahun.length - 1];
    var c = chart(g);
    sec.innerHTML =
      '<div class="section-head"><div><h2>Bantuan Pendidikan Tersalurkan</h2><p>Keterbukaan informasi bantuan yang diterima siswa SD N BUGANGIN.</p></div>' +
      (tahun.length > 1 ? '<div class="gb-years">' + tahun.map(function (t) { return '<button type="button" data-th="' + t + '" class="' + (t === TAHUN ? 'on' : '') + '">' + t + '</button>'; }).join('') + '</div>' : '') + '</div>' +
      '<div class="gb"><div class="gb-tiles">' + tiles(g, TAHUN) + '</div>' +
      '<div class="gb-card"><div class="gb-card-h"><h3>Jumlah siswa penerima per tahun</h3><div class="gb-legend">' +
      JENIS.map(function (x) { return '<span><i class="gb-dot" style="background:' + x.warna + '"></i>' + esc(x.label) + '</span>'; }).join('') + '</div></div>' +
      '<div class="gb-chart" style="max-width:' + Math.max(c.lebar, 420) + 'px;margin:0 auto">' + c.svg + '<div class="gb-tip" hidden></div></div>' +
      '<div class="gb-tabel" hidden>' + tabel(g) + '</div>' +
      '<div class="gb-foot"><span>Tanpa nama siswa. Jumlah di bawah ' + g.batasSamaran + ' siswa ditulis &ldquo;&lt; ' + g.batasSamaran + '&rdquo; untuk melindungi privasi.</span><button type="button" class="gb-tabel-btn">Lihat tabel</button></div>' +
      '</div></div>';
    sec.hidden = false;
    pasang(sec, g);
  }

  function pasang(sec, g) {
    var tip = sec.querySelector('.gb-tip'), wadah = sec.querySelector('.gb-chart'), svg = wadah.querySelector('svg');
    function tunjuk(el) {
      var p = el.getAttribute('data-info').split('|'), skala = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      tip.innerHTML = '<b>' + esc(p[0]) + '</b>' + esc(p[1]);
      tip.style.left = (Number(el.getAttribute('data-x')) * skala) + 'px';
      tip.style.top = (Number(el.getAttribute('data-y')) * skala - 14) + 'px';
      tip.hidden = false;
    }
    sec.querySelectorAll('.gb-hit').forEach(function (el) {
      el.addEventListener('mouseenter', function () { tunjuk(el); });
      el.addEventListener('focus', function () { tunjuk(el); });
      el.addEventListener('click', function () { tunjuk(el); });
      el.addEventListener('mouseleave', function () { tip.hidden = true; });
      el.addEventListener('blur', function () { tip.hidden = true; });
    });
    var btn = sec.querySelector('.gb-tabel-btn'), tb = sec.querySelector('.gb-tabel');
    btn.addEventListener('click', function () { tb.hidden = !tb.hidden; btn.textContent = tb.hidden ? 'Lihat tabel' : 'Sembunyikan tabel'; });
    sec.querySelectorAll('.gb-years [data-th]').forEach(function (b) {
      b.addEventListener('click', function () { TAHUN = Number(b.getAttribute('data-th')); render(g); });
    });
  }

  function bacaCache() { try { return JSON.parse(localStorage.getItem(SIMPAN) || 'null'); } catch (e) { return null; } }
  function tulisCache(d) { try { localStorage.setItem(SIMPAN, JSON.stringify(d)); } catch (e) {} }

  var lama = bacaCache();
  if (lama) render(lama);
  fetch(API + '?aksi=grafikBantuan').then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.ok) return;
    tulisCache(d);
    render(d);
  }).catch(function () {});
})();
