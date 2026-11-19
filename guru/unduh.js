/* Unduhan Word (.docx) dan Excel (.xlsx) ukuran A4 mendatar untuk Promes dan Jurnal.
   Berkas dirakit di peramban guru (pustaka docx dan ExcelJS dimuat saat tombol ditekan),
   jadi tidak ada data yang dikirim ke pihak lain. */
(function () {
  const PUSTAKA = {
    docx: 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js',
    ExcelJS: 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
  };
  const BLN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const tglPanjang = iso => { const p = String(iso).split('-'); return p.length === 3 ? +p[2] + ' ' + BLN[+p[1] - 1] + ' ' + p[0] : String(iso || ''); };
  const tglPendek = iso => { const p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || ''); };
  const hariIni = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  function muat(nama) {
    if (window[nama]) return Promise.resolve(window[nama]);
    return new Promise((ok, gagal) => {
      const s = document.createElement('script');
      s.src = PUSTAKA[nama]; s.onload = () => ok(window[nama]);
      s.onerror = () => gagal(new Error('Gagal memuat pembuat berkas. Periksa sinyal internet lalu coba lagi.'));
      document.head.appendChild(s);
    });
  }
  function simpan(blob, nama) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nama;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function tahunPelajaran(baris) {
    const t = (baris.find(b => b.tanggal) || {}).tanggal || hariIni();
    const y = +t.slice(0, 4), m = +t.slice(5, 7);
    return m >= 7 ? y + '/' + (y + 1) : (y - 1) + '/' + y;
  }

  /* ---------- kop SD N Bugangin (dipakai semua dokumen) ---------- */
  let GAMBAR_KOP = null;
  async function gambarKop() {
    if (GAMBAR_KOP) return GAMBAR_KOP;
    const ambil = async u => new Uint8Array(await (await fetch(u)).arrayBuffer());
    GAMBAR_KOP = {kiri: await ambil('kop-kendal.png'), kanan: await ambil('kop-sekolah.png')};
    return GAMBAR_KOP;
  }
  // Kop Word: logo Kabupaten Kendal kiri, logo sekolah kanan, garis ganda di bawah. W = lebar isi halaman (twip).
  async function kopWord(d, W) {
    const g = await gambarKop(), tanpa = {style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF'}, nol = {top: tanpa, bottom: tanpa, left: tanpa, right: tanpa};
    const w = [Math.round(W * 0.15), Math.round(W * 0.70)]; w.push(W - w[0] - w[1]);
    const gb = (data, cx, cy) => new d.Paragraph({alignment: d.AlignmentType.CENTER, children: [new d.ImageRun({data, transformation: {width: cx, height: cy}})]});
    const br = (t, sz, b) => new d.Paragraph({alignment: d.AlignmentType.CENTER, spacing: {after: 0}, children: [new d.TextRun({text: t, size: sz, bold: !!b, font: 'Arial'})]});
    const sel = (children, i) => new d.TableCell({width: {size: w[i], type: d.WidthType.DXA}, borders: nol, verticalAlign: d.VerticalAlign.CENTER, children});
    return [new d.Table({width: {size: W, type: d.WidthType.DXA}, columnWidths: w, layout: d.TableLayoutType.FIXED,
      borders: {top: tanpa, left: tanpa, right: tanpa, insideHorizontal: tanpa, insideVertical: tanpa, bottom: {style: d.BorderStyle.THICK_THIN_SMALL_GAP, size: 18, color: '000000'}},
      rows: [new d.TableRow({children: [sel([gb(g.kiri, 60, 79)], 0),
        sel([br('PEMERINTAH KABUPATEN KENDAL', 24), br('SD N BUGANGIN', 32, true), br('Jl. Soekarno-Hatta No. 395A, Bugangin, Kendal 51314', 20),
          br('Laman: sdnbugangin.github.io, Pos-el: sdn.bugangin@gmail.com', 20)], 1), sel([gb(g.kanan, 76, 67)], 2)]})]}),
      new d.Paragraph({spacing: {after: 80}, children: []})];
  }
  // Kop Excel di baris 1-4 (logo di kolom pertama dan terakhir).
  async function kopExcel(wb, ws, n) {
    const g = await gambarKop(), akhir = ws.getColumn(n).letter;
    ws.addImage(wb.addImage({buffer: g.kiri, extension: 'png'}), {tl: {col: 0.1, row: 0.1}, ext: {width: 45, height: 59}});
    ws.addImage(wb.addImage({buffer: g.kanan, extension: 'png'}), {tl: {col: n - 1 + 0.1, row: 0.1}, ext: {width: 57, height: 50}});
    [['PEMERINTAH KABUPATEN KENDAL', 11, false], ['SD N BUGANGIN', 14, true], ['Jl. Soekarno-Hatta No. 395A, Bugangin, Kendal 51314', 9, false],
      ['Laman: sdnbugangin.github.io, Pos-el: sdn.bugangin@gmail.com', 9, false]].forEach(([t, sz, b], i) => {
      ws.mergeCells('B' + (i + 1) + ':' + ws.getColumn(n - 1).letter + (i + 1));
      const c = ws.getCell('B' + (i + 1)); c.value = t; c.font = {name: 'Arial', size: sz, bold: b}; c.alignment = {horizontal: 'center'};
    });
    for (let i = 1; i <= n; i++) ws.getCell(4, i).border = {bottom: {style: 'double', color: {argb: 'FF000000'}}};
    return 5;   // baris kosong pemisah; isi dimulai baris 6
  }

  /* ---------- isi dokumen ---------- */
  // Bentuk umum: {judul, info:[[label, isi]], kolom:[{judul, lebar}], baris:[[...]], ttd:{tempat, tanggal, kepala, guru, labelGuru}, berkas}
  function isiPromes(P) {
    const baris = P.baris.map((b, i) => [String(i + 1), b.minggu, b.hari + ', ' + tglPendek(b.tanggal), String(b.jp), b.jenis,
      b.materi ? (b.materiNo ? b.materiNo + '. ' : '') + b.materi : '', b.noTP || '',
      b.jenis === 'Belajar' ? b.tp : b.jenis === 'Ulangan' ? 'Ulangan akhir materi dan pembahasan soal' : 'Cadangan / pengayaan / remedial',
      b.pertemuan || '', b.rpp ? '✓' : '', [b.jurnal ? '✓' : '', b.terlaksana || ''].filter(String).join(' ')]);
    const smt = (P.baris[0] || {}).smt || '';
    return {
      judul: 'PROGRAM SEMESTER (PROMES)',
      info: [['Satuan Pendidikan', 'SD Negeri Bugangin'], ['Mata Pelajaran', P.mapel], ['Kelas / Semester', P.kelas + ' / ' + smt],
        ['Tahun Pelajaran', tahunPelajaran(P.baris)], ['Jumlah Pertemuan', P.baris.length + ' pertemuan (' +
          P.baris.filter(b => b.jenis === 'Ulangan').length + ' kali ulangan akhir materi)']],
      kolom: [{judul: 'No', lebar: 4}, {judul: 'Minggu', lebar: 6}, {judul: 'Hari, Tanggal', lebar: 13}, {judul: 'JP', lebar: 4},
        {judul: 'Jenis', lebar: 8}, {judul: 'Materi (TP Rapor)', lebar: 20}, {judul: 'No TP', lebar: 7},
        {judul: 'Tujuan Pembelajaran / Kegiatan', lebar: 32}, {judul: 'Pertemuan', lebar: 8}, {judul: 'RPP', lebar: 5}, {judul: 'Jurnal', lebar: 10}],
      baris,
      ttd: {tanggal: hariIni(), kepala: P.kepala || {}, guru: P.guru || {}, labelGuru: /PAI/.test(P.mapel) ? 'Guru PAI dan Budi Pekerti' : 'Guru Kelas ' + P.kelas},
      berkas: 'Promes ' + P.mapel + ' Kelas ' + P.kelas + ' Semester ' + smt
    };
  }
  function isiJurnal(J) {
    const baris = J.baris.map((b, i) => [String(i + 1), b.hari + ', ' + tglPendek(b.tanggal), b.jamKe || '', (J.kelas ? '' : 'Kelas ' + b.kelas + ' · ') + b.kegiatan,
      [b.materi, b.tp].filter(String).join(' — '), b.uraian || '', b.pelaksanaan || '', String(b.tidakHadir || '0'),
      (b.diajarOleh || '') + (b.pengganti ? ' (pengganti)' : ''), b.catatan || '']);
    const guruUtama = J.pai ? J.guruSaya : (J.baris.find(b => !b.pengganti) || J.baris[0] || {}).guru || '';
    return {
      judul: 'JURNAL MENGAJAR HARIAN',
      info: [['Satuan Pendidikan', 'SD Negeri Bugangin']].concat(J.pai ? [['Mata Pelajaran', 'PAI dan Budi Pekerti']] : []).concat([['Kelas', J.kelas || 'I–VI']]).concat([ ['Periode', tglPanjang(J.dari) + ' s.d. ' + tglPanjang(J.sampai)],
        ['Tahun Pelajaran', tahunPelajaran(J.baris)], ['Jumlah Catatan', J.baris.length + ' kegiatan']]),
      kolom: [{judul: 'No', lebar: 4}, {judul: 'Hari, Tanggal', lebar: 12}, {judul: 'Jam', lebar: 5}, {judul: 'Mapel / Kegiatan', lebar: 12},
        {judul: 'Materi / TP', lebar: 24}, {judul: 'Uraian Kegiatan', lebar: 24}, {judul: 'Pelaksanaan', lebar: 9},
        {judul: 'Tidak Hadir', lebar: 6}, {judul: 'Guru', lebar: 13}, {judul: 'Catatan', lebar: 12}],
      baris,
      ttd: {tanggal: J.sampai || hariIni(), kepala: J.kepala || {}, guru: {nama: guruUtama, nip: (J.nip || {})[guruUtama] || ''},
        labelGuru: J.pai ? 'Guru PAI dan Budi Pekerti' : 'Guru Kelas ' + J.kelas},
      berkas: 'Jurnal ' + (J.pai ? 'PAI ' : '') + 'Kelas ' + (J.kelas || 'I-VI') + ' ' + tglPendek(J.dari).replace(/\//g, '-') + ' sd ' + tglPendek(J.sampai).replace(/\//g, '-')
    };
  }

  /* ---------- Word ---------- */
  async function keWord(D) {
    const d = await muat('docx');
    const huruf = 'Times New Roman';
    const teks = (t, o = {}) => new d.Paragraph({alignment: o.tengah ? d.AlignmentType.CENTER : d.AlignmentType.LEFT, spacing: {after: o.jarak || 0},
      children: [new d.TextRun({text: String(t == null ? '' : t), bold: !!o.tebal, size: o.ukuran || 20, font: huruf})]});
    const garis = {style: d.BorderStyle.SINGLE, size: 4, color: '000000'};
    const tanpa = {style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF'};
    const total = D.kolom.reduce((a, k) => a + k.lebar, 0), lebarHalaman = 16838 - 2 * 720;
    const sel = (t, o = {}) => new d.TableCell({
      width: {size: o.lebar, type: d.WidthType.DXA}, shading: o.kepala ? {fill: 'D9EAD3', type: d.ShadingType.CLEAR, color: 'auto'} : undefined,
      borders: o.tanpaGaris ? {top: tanpa, bottom: tanpa, left: tanpa, right: tanpa} : {top: garis, bottom: garis, left: garis, right: garis},
      margins: {top: 40, bottom: 40, left: 60, right: 60},
      children: String(t == null ? '' : t).split('\n').map(x => teks(x, {tebal: o.kepala, ukuran: o.ukuran || 18, tengah: o.kepala}))
    });
    const lebar = D.kolom.map(k => Math.round(k.lebar / total * lebarHalaman));
    const tabel = new d.Table({
      width: {size: lebarHalaman, type: d.WidthType.DXA}, columnWidths: lebar, layout: d.TableLayoutType.FIXED,
      rows: [new d.TableRow({tableHeader: true, children: D.kolom.map((k, i) => sel(k.judul, {kepala: true, lebar: lebar[i]}))})]
        .concat(D.baris.map(r => new d.TableRow({cantSplit: true, children: r.map((v, i) => sel(v, {lebar: lebar[i]}))})))
    });
    const info = new d.Table({
      width: {size: 9000, type: d.WidthType.DXA}, columnWidths: [2600, 6400],
      rows: D.info.map(([a, b]) => new d.TableRow({children: [sel(a, {lebar: 2600, tanpaGaris: true, ukuran: 20}), sel(': ' + b, {lebar: 6400, tanpaGaris: true, ukuran: 20})]}))
    });
    const t = D.ttd, sepertiga = Math.round(lebarHalaman * 0.36), tengahW = lebarHalaman - 2 * sepertiga;
    const kiri = 'Mengetahui,\nKepala SD Negeri Bugangin\n\n\n\n' + (t.kepala.nama || '..............................') + (t.kepala.nip ? '\nNIP. ' + t.kepala.nip : '');
    const kanan = 'Bugangin, ' + tglPanjang(t.tanggal) + '\n' + t.labelGuru + '\n\n\n\n' + (t.guru.nama || '..............................') + (t.guru.nip ? '\nNIP. ' + t.guru.nip : '');
    const ttd = new d.Table({
      width: {size: lebarHalaman, type: d.WidthType.DXA}, columnWidths: [sepertiga, tengahW, sepertiga],
      rows: [new d.TableRow({cantSplit: true, children: [sel(kiri, {lebar: sepertiga, tanpaGaris: true, ukuran: 22}), sel('', {lebar: tengahW, tanpaGaris: true}),
        sel(kanan, {lebar: sepertiga, tanpaGaris: true, ukuran: 22})]})]
    });
    const doc = new d.Document({
      styles: {default: {document: {run: {font: huruf}}}},
      sections: [{
        properties: {page: {size: {orientation: d.PageOrientation.LANDSCAPE, width: 11906, height: 16838}, margin: {top: 720, bottom: 720, left: 720, right: 720}}},
        children: [...(await kopWord(d, lebarHalaman)), teks(D.judul, {tebal: true, tengah: true, ukuran: 28, jarak: 120}), info, teks('', {jarak: 120}), tabel, teks('', {jarak: 240}), ttd]
      }]
    });
    simpan(await d.Packer.toBlob(doc), D.berkas + '.docx');
  }

  /* ---------- Excel ---------- */
  async function keExcel(D) {
    const E = await muat('ExcelJS');
    const wb = new E.Workbook(); wb.creator = 'Dashboard Guru SD N Bugangin';
    const ws = wb.addWorksheet(D.judul.slice(0, 28), {
      pageSetup: {paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: {left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2}, horizontalCentered: true},
      headerFooter: {oddFooter: '&L' + D.berkas + '&RHalaman &P dari &N'}
    });
    const n = D.kolom.length, garis = {style: 'thin', color: {argb: 'FF000000'}};
    ws.columns = D.kolom.map(k => ({width: Math.max(5, k.lebar * 1.15)}));
    const akhir = ws.getColumn(n).letter, o = await kopExcel(wb, ws, n);
    ws.mergeCells('A' + (o + 1) + ':' + akhir + (o + 1));
    Object.assign(ws.getCell('A' + (o + 1)), {value: D.judul});
    ws.getCell('A' + (o + 1)).font = {name: 'Times New Roman', bold: true, size: 14}; ws.getCell('A' + (o + 1)).alignment = {horizontal: 'center'};
    D.info.forEach(([a, b], i) => {
      const r = ws.getRow(o + 3 + i);
      r.getCell(1).value = a; ws.mergeCells(o + 3 + i, 1, o + 3 + i, 3);
      r.getCell(4).value = ': ' + b; ws.mergeCells(o + 3 + i, 4, o + 3 + i, Math.min(n, 9));
      r.font = {name: 'Times New Roman', size: 11};
    });
    const awal = o + 4 + D.info.length;
    const kepala = ws.getRow(awal);
    D.kolom.forEach((k, i) => { kepala.getCell(i + 1).value = k.judul; });
    kepala.eachCell(c => { c.font = {name: 'Times New Roman', bold: true, size: 10}; c.alignment = {horizontal: 'center', vertical: 'middle', wrapText: true};
      c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFD9EAD3'}}; c.border = {top: garis, bottom: garis, left: garis, right: garis}; });
    D.baris.forEach((r, j) => {
      const row = ws.getRow(awal + 1 + j);
      r.forEach((v, i) => { row.getCell(i + 1).value = v; });
      row.eachCell({includeEmpty: true}, c => { c.font = {name: 'Times New Roman', size: 10}; c.alignment = {vertical: 'top', wrapText: true};
        c.border = {top: garis, bottom: garis, left: garis, right: garis}; });
    });
    ws.pageSetup.printTitlesRow = awal + ':' + awal;
    const t = D.ttd, mulaiTtd = awal + D.baris.length + 2, tengah = Math.max(n - 2, Math.ceil(n / 2) + 2);
    const kiri = ['Mengetahui,', 'Kepala SD Negeri Bugangin', '', '', '', t.kepala.nama || '..............................', t.kepala.nip ? 'NIP. ' + t.kepala.nip : ''];
    const kanan = ['Bugangin, ' + tglPanjang(t.tanggal), t.labelGuru, '', '', '', t.guru.nama || '..............................', t.guru.nip ? 'NIP. ' + t.guru.nip : ''];
    kiri.forEach((v, i) => {
      const row = ws.getRow(mulaiTtd + i);
      row.getCell(2).value = v; row.getCell(tengah).value = kanan[i];
      row.font = {name: 'Times New Roman', size: 11, bold: i === 5};
    });
    simpan(new Blob([await wb.xlsx.writeBuffer()], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), D.berkas + '.xlsx');
  }

  async function jalankan(tombol, buatIsi, format) {
    const lama = tombol.textContent;
    try {
      tombol.disabled = true; tombol.textContent = 'Menyiapkan berkas…';
      const D = buatIsi();
      if (!D) return;
      if (format === 'docx') await keWord(D); else await keExcel(D);
    } catch (e) { alert(e.message || 'Berkas gagal dibuat.'); }
    finally { tombol.disabled = false; tombol.textContent = lama; }
  }

  window.UnduhGuru = {isiPromes, isiJurnal, keWord, keExcel, jalankan, muat, simpan, kopWord, tglPanjang, tglPendek, hariIni};
})();
