/* Instrumen kokurikuler siap cetak (Word A4 tegak, berkop SD N Bugangin):
   F7 surat orang tua, F8 catatan anekdot, F9 jurnal 7 KAIH, F10 penilaian diri, kartu prestasi mengaji, F12 evaluasi.
   Dirakit di peramban guru; nama murid hanya dari server sekolah dan tidak dikirim ke pihak lain. */
(function () {
  const U = () => window.UnduhGuru;
  const TEMA = 'Aku Sehat, Cerdas, dan Gemar Mengaji';
  const KEGIATAN = [
    ['Mengaji, Salat Duha, dan Yasinan', 'Hubungan dengan Tuhan Yang Maha Esa', 'Keimanan dan Ketakwaan terhadap Tuhan YME'],
    ['Literasi pagi', 'Membaca', 'Komunikasi'],
    ['Numerasi pagi', 'Penyelesaian Masalah', 'Penalaran Kritis'],
    ['Senam Anak Indonesia Hebat', 'Kebugaran, kesehatan fisik, dan kesehatan mental', 'Kesehatan'],
    ['Pembiasaan pagi (piket, makan bersama)', 'Bertanggung Jawab', 'Kemandirian']
  ];
  const PERNYATAAN = [
    'Aku mengaji dan berdoa dengan tertib dan sungguh-sungguh.',
    'Aku ikut salat duha dan yasinan bersama teman dengan tertib.',
    'Aku membaca buku dengan tekun dan bisa menceritakan isinya.',
    'Aku mencoba berbagai cara saat menyelesaikan soal cerita.',
    'Aku ikut senam dengan semangat sampai selesai.',
    'Aku menyelesaikan tugas piketku tanpa disuruh.',
    'Aku menaati kesepakatan kelas.'
  ];
  const W = 11906 - 2 * 1000;   // lebar isi A4 tegak (twip)

  async function rakit(judulBerkas, halaman) {
    const u = U(), d = await u.muat('docx');
    const isi = [];
    for (const buat of halaman) isi.push({
      properties: {page: {size: {width: 11906, height: 16838}, margin: {top: 800, bottom: 800, left: 1000, right: 1000}}},
      children: [...(await u.kopWord(d, W)), ...buat(alat(d))]
    });
    const doc = new d.Document({styles: {default: {document: {run: {font: 'Times New Roman', size: 22}}}}, sections: isi});
    u.simpan(await d.Packer.toBlob(doc), judulBerkas + '.docx');
  }

  // Pembantu kecil di atas pustaka docx.
  function alat(d) {
    const garis = {style: d.BorderStyle.SINGLE, size: 4, color: '000000'}, tanpa = {style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF'};
    const p = (t, o = {}) => new d.Paragraph({alignment: o.tengah ? d.AlignmentType.CENTER : o.kanan ? d.AlignmentType.RIGHT : o.rata ? d.AlignmentType.JUSTIFIED : d.AlignmentType.LEFT,
      spacing: {after: o.jarak == null ? 60 : o.jarak, line: o.baris || 276}, indent: o.menjorok ? {left: o.menjorok} : undefined,
      children: [].concat(t).map(x => typeof x === 'string' ? new d.TextRun({text: x, bold: !!o.tebal, italics: !!o.miring, size: o.ukuran || 22}) : x)});
    const r = (t, o = {}) => new d.TextRun({text: t, bold: !!o.tebal, italics: !!o.miring, size: o.ukuran || 22});
    const sel = (t, o = {}) => new d.TableCell({
      width: {size: o.lebar, type: d.WidthType.DXA}, columnSpan: o.gabung, verticalAlign: o.tengahV ? d.VerticalAlign.CENTER : undefined,
      shading: o.kepala ? {fill: 'D9EAD3', type: d.ShadingType.CLEAR, color: 'auto'} : undefined,
      borders: o.tanpaGaris ? {top: tanpa, bottom: tanpa, left: tanpa, right: tanpa} : {top: garis, bottom: garis, left: garis, right: garis},
      margins: {top: 50, bottom: 50, left: 80, right: 80},
      children: String(t == null ? '' : t).split('\n').map(x => p(x, {tebal: o.kepala || o.tebal, tengah: o.kepala || o.tengah, ukuran: o.ukuran || 20, jarak: 0}))
    });
    // tabel: kolom = [[judul, lebar%]], baris = [[...]], o.tinggi = tinggi baris isi (twip)
    const tabel = (kolom, baris, o = {}) => {
      const lb = kolom.map(k => Math.round(k[1] / 100 * W));
      return new d.Table({width: {size: W, type: d.WidthType.DXA}, columnWidths: lb, layout: d.TableLayoutType.FIXED,
        rows: [new d.TableRow({tableHeader: true, children: kolom.map((k, i) => sel(k[0], {kepala: true, lebar: lb[i]}))})].concat(baris.map(b =>
          new d.TableRow({cantSplit: true, height: o.tinggi ? {value: o.tinggi, rule: d.HeightRule.ATLEAST} : undefined,
            children: b.map((v, i) => sel(v, {lebar: lb[i], tengah: (o.tengahKolom || []).includes(i), tengahV: true, ukuran: o.ukuran}))})))});
    };
    // kotak isian bergaris (judul + ruang tulis)
    const kotak = (judul, tinggi) => new d.Table({width: {size: W, type: d.WidthType.DXA}, columnWidths: [W],
      rows: [new d.TableRow({height: {value: tinggi || 900, rule: d.HeightRule.ATLEAST}, children: [sel(judul, {lebar: W, tebal: true})]})]});
    // tanda tangan dua kolom berjauhan (kiri - kosong - kanan)
    const ttd = (kiri, kanan) => {
      const a = Math.round(W * 0.4), b = W - 2 * a;
      return new d.Table({width: {size: W, type: d.WidthType.DXA}, columnWidths: [a, b, a],
        rows: [new d.TableRow({cantSplit: true, children: [sel(kiri, {lebar: a, tanpaGaris: true, ukuran: 22}), sel('', {lebar: b, tanpaGaris: true}), sel(kanan, {lebar: a, tanpaGaris: true, ukuran: 22})]})]});
    };
    const judul = (t, kode) => p([r(t, {tebal: true, ukuran: 26}), r(kode ? '   (' + kode + ')' : '', {ukuran: 18})], {tengah: true, jarak: 160});
    const spasi = n => p('', {jarak: n || 120});
    return {d, p, r, sel, tabel, kotak, ttd, judul, spasi};
  }

  const titik = '..............................';
  const blokTtd = (jabatan, o) => jabatan + '\n\n\n\n' + (o && o.nama || titik) + (o && o.nip ? '\nNIP. ' + o.nip : '');
  const tglHariIni = () => U().tglPanjang(U().hariIni());
  const periode = smt => String(smt) === '2' ? 'Januari s.d. Juni 2027' : 'Juli s.d. Desember 2026';

  /* ---------- F7 Surat pemberitahuan dan dukungan orang tua (satu halaman per murid) ---------- */
  function f7(R) {
    return R.murid.map(nama => a => [
      a.p('Bugangin, ' + tglHariIni(), {kanan: true}),
      a.p('Yth. Bapak/Ibu Orang Tua/Wali dari Ananda ' + nama), a.p('Kelas ' + R.kelas + ' SD N Bugangin'), a.p('di tempat', {jarak: 160}),
      a.p('Dengan hormat,'),
      a.p('Dalam rangka menguatkan karakter dan kompetensi murid, Kelas ' + R.kelas + ' melaksanakan kegiatan kokurikuler dengan tema "' + TEMA +
        '" sepanjang semester ' + R.semester + ' (' + periode(R.semester) + '). Kegiatan berlangsung rutin setiap pagi di sekolah sesuai jadwal.', {rata: true}),
      a.p('Dalam kegiatan ini, Ananda akan:'),
      ...KEGIATAN.map(k => a.p('•  ' + k[0] + ' — melatih ' + k[1].toLowerCase() + ';', {menjorok: 360, jarak: 20})),
      a.p('Kami mohon dukungan Bapak/Ibu untuk:', {jarak: 40}),
      ...['☐ mendampingi Ananda mengaji, beribadah, dan membaca di rumah serta menandatangani jurnal kebiasaan setiap hari;',
        '☐ membiasakan Ananda bangun pagi, sarapan, dan berangkat tepat waktu;',
        '☐ menyiapkan perlengkapan ibadah dan pakaian olahraga pada hari yang dijadwalkan;',
        '☐ hadir pada gelar karya/pentas hasil kegiatan (waktu akan diberitahukan);',
        '☐ berbagi keahlian sebagai narasumber (bila berkenan) di bidang: ' + titik + ' .'].map(t => a.p(t, {menjorok: 360, jarak: 20})),
      a.p('Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.', {jarak: 160}),
      a.ttd(blokTtd('Mengetahui,\nKepala SD N Bugangin', R.kepala), blokTtd('\nGuru Kelas ' + R.kelas, R.wali)),
      a.spasi(200),
      a.p('✂ - - - - - - - - - - - - - - - - - - Potong dan kembalikan kepada guru kelas - - - - - - - - - - - - - - - - - -', {tengah: true, ukuran: 18, jarak: 160}),
      a.p('Saya, orang tua/wali dari ' + nama + ' Kelas ' + R.kelas + ', ☐ mendukung  ☐ mengizinkan Ananda mengikuti kegiatan kokurikuler tersebut, dan bersedia:  ' +
        '☐ mendampingi di rumah  ☐ menyiapkan perlengkapan  ☐ hadir pada gelar karya  ☐ menjadi narasumber.', {rata: true, jarak: 120}),
      a.ttd('', 'Bugangin, ' + titik + '\nOrang tua/wali,\n\n\n\n' + titik)
    ]);
  }

  /* ---------- F8 Catatan anekdot (terisi dari catatan guru di kartu kegiatan) ---------- */
  function f8(R) {
    const isi = R.anekdot.map(x => [U().tglPendek(x.tanggal), x.murid, x.subdimensi + ' (' + x.level + ')', x.catatan, '']);
    const kosong = Math.max(8, 20 - isi.length);
    for (let i = 0; i < kosong; i++) isi.push(['', '', '', '', '']);
    return [a => [
      a.judul('CATATAN ANEKDOT', 'F8'),
      a.p('Kelas: ' + R.kelas + '     Semester: ' + R.semester + '     Tema: ' + TEMA),
      a.p('Subdimensi yang diamati: ' + KEGIATAN.map(k => k[1]).join('; ') + '.', {ukuran: 20}),
      a.p('Tulis peristiwa apa adanya (apa yang dilakukan/dikatakan murid), bukan penilaian.', {miring: true, ukuran: 20, jarak: 120}),
      a.tabel([['Tanggal', 11], ['Nama murid', 19], ['Subdimensi', 18], ['Peristiwa yang teramati', 32], ['Tindak lanjut/umpan balik', 20]], isi, {tinggi: 560}),
      a.spasi(240),
      a.ttd(blokTtd('Mengetahui,\nKepala SD N Bugangin', R.kepala), 'Bugangin, ' + tglHariIni() + '\n' + blokTtd('Guru Kelas ' + R.kelas, R.wali))
    ]];
  }

  /* ---------- F9 Jurnal kebiasaanku (7 KAIH), satu halaman per murid ---------- */
  function f9(R, o) {
    const hari = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    return R.murid.map(nama => a => [
      a.judul('JURNAL KEBIASAANKU (Gerakan 7 KAIH)', 'F9'),
      a.p('Nama: ' + nama + '     Kelas: ' + R.kelas),
      a.p('Kebiasaan yang kulatih: ' + (o.kebiasaan || titik) + '     Minggu ke-: ' + (o.minggu || '......'), {jarak: 120}),
      a.tabel([['Hari', 13], ['Tanggal', 15], ['Yang kulakukan hari ini', 42], ['Aku melakukannya', 15], ['Paraf orang tua', 15]],
        hari.map(h => [h, '', '', '☺ / ☹', '']), {tinggi: 640, tengahKolom: [3]}),
      a.spasi(),
      a.p('Refleksi akhir minggu (ditulis atau digambar)', {tebal: true}),
      a.kotak('Minggu ini aku berhasil …', 900), a.kotak('Yang masih sulit …', 900), a.kotak('Minggu depan aku akan …', 900),
      a.p(['I', 'II'].includes(R.kelas) ? 'Untuk Kelas I–II, kolom "Yang kulakukan" boleh diisi gambar atau stiker.' : 'Contoh: "Bangun pagi" → tulis jam bangun; "Beribadah" → ibadah/surat yang dibaca; "Gemar belajar" → judul buku yang dibaca.',
        {miring: true, ukuran: 18})
    ]);
  }

  /* ---------- F10 Penilaian diri murid, satu halaman per murid ---------- */
  function f10(R) {
    return R.murid.map(nama => a => [
      a.judul('PENILAIAN DIRI MURID', 'F10'),
      a.p('Nama: ' + nama + '     Kelas: ' + R.kelas + '     Semester: ' + R.semester),
      a.p('Tema: ' + TEMA),
      a.p('Beri tanda centang (✓) pada wajah yang paling sesuai.  ☺ = sudah bisa sendiri · 😐 = bisa dengan bantuan · ☹ = masih belajar', {ukuran: 20, jarak: 120}),
      a.tabel([['No', 7], ['Pernyataan', 63], ['☺', 10], ['😐', 10], ['☹', 10]], PERNYATAAN.map((t, i) => [String(i + 1), t, '', '', '']), {tinggi: 480, tengahKolom: [0]}),
      a.spasi(),
      a.kotak('Yang paling aku sukai dari kegiatan ini', 1000), a.kotak('Hal baru yang aku pelajari', 1000), a.kotak('Yang ingin aku perbaiki', 1000),
      a.p(['I', 'II'].includes(R.kelas) ? 'Untuk Kelas I–II, guru membacakan pernyataan satu per satu; bagian bawah boleh diisi gambar.' : '', {miring: true, ukuran: 18})
    ]);
  }

  /* ---------- Kartu prestasi mengaji, satu halaman per murid ---------- */
  function kartuMengaji(R) {
    const baris = Array.from({length: 18}, (_, i) => [String(i + 1), '', '', '', '', '']);
    return R.murid.map(nama => a => [
      a.judul('KARTU PRESTASI MENGAJI'),
      a.p('Nama: ' + nama + '     Kelas: ' + R.kelas + '     Semester: ' + R.semester + ' (' + periode(R.semester) + ')', {jarak: 120}),
      a.tabel([['No', 6], ['Tanggal', 14], ['Jilid / Surat', 22], ['Halaman / Ayat', 16], ['Keterangan\n(Lancar / Ulang)', 22], ['Paraf Guru', 20]], baris, {tinggi: 460, tengahKolom: [0]}),
      a.spasi(200),
      a.ttd('Orang tua/wali,\n\n\n\n' + titik, blokTtd('Guru Kelas ' + R.kelas, R.wali))
    ]);
  }

  /* ---------- F12 Instrumen evaluasi kegiatan (satu halaman per kegiatan) ---------- */
  function f12(R, ringkas) {
    const persen = sub => {
      const c = ringkas && ringkas.sebaran && ringkas.sebaran[sub]; if (!c) return '…… %';
      const n = c.Berkembang + c.Cakap + c.Mahir; return n ? Math.round((c.Cakap + c.Mahir) / n * 100) + ' %' : '…… %';
    };
    return KEGIATAN.map(k => a => [
      a.judul('INSTRUMEN EVALUASI KEGIATAN KOKURIKULER', 'F12'),
      a.p('Kegiatan: ' + k[0] + '     Kelas: ' + R.kelas + '     Semester: ' + R.semester),
      a.p('Dimensi/subdimensi: ' + k[2] + ' — ' + k[1]),
      a.p('Evaluator: ' + titik + '     Tanggal: ' + titik, {jarak: 120}),
      a.tabel([['Komponen', 12], ['Butir pertanyaan', 36], ['Teknik', 15], ['Responden', 13], ['Ya/Tidak', 9], ['Catatan', 15]], [
        ['Masukan', 'Ada perencanaan (F5) yang memuat A–H dan asesmen', 'Studi dokumen', 'Koordinator', '', ''],
        ['', 'Sumber daya sekolah dan mitra dimanfaatkan optimal', 'Wawancara, observasi', 'Koordinator', '', ''],
        ['', 'Guru/narasumber memiliki kompetensi yang relevan', 'Wawancara', 'Koordinator', '', ''],
        ['Proses', 'Melibatkan seluruh murid', 'Observasi', 'Murid', '', ''],
        ['', 'Murid mengikuti kegiatan dengan antusias dan senang', 'Wawancara, observasi', 'Murid', '', ''],
        ['', 'Kegiatan sesuai jadwal (F6)', 'Studi dokumen', 'Guru kelas', '', ''],
        ['', 'Ada tahap memahami, mengaplikasi, dan merefleksi', 'Observasi, dokumen', 'Guru kelas', '', ''],
        ['Keluaran', persen(k[1]) + ' murid mencapai tahap Cakap/Mahir pada subdimensi ' + k[1], 'Studi dokumen (F11)', 'Guru kelas', '', ''],
        ['', 'Karya/aksi murid terwujud dan dipublikasikan', 'Dokumentasi', 'Guru kelas', '', ''],
        ['Hasil', 'Kebiasaan/perilaku bertahan setelah kegiatan selesai', 'Kuesioner', 'Orang tua', '', ''],
        ['', 'Ada perubahan nyata di sekolah/lingkungan', 'Observasi', 'Kepala sekolah', '', '']
      ], {ukuran: 18}),
      a.spasi(60),
      a.p('Keputusan dan tindak lanjut', {tebal: true}),
      a.kotak('Keputusan:   ☐ Lanjutkan   ☐ Lanjutkan dengan perbaikan   ☐ Ganti kegiatan lain', 300),
      a.kotak('Kekuatan', 440), a.kotak('Kelemahan/hambatan', 440), a.kotak('Rencana tindak lanjut', 440),
      a.spasi(80),
      a.ttd(blokTtd('Mengetahui,\nKepala SD N Bugangin', R.kepala), 'Bugangin, ' + titik + '\n' + blokTtd('Evaluator', null))
    ]);
  }

  const JENIS = {
    f7: ['F7 Surat Orang Tua', f7], f8: ['F8 Catatan Anekdot', f8], f9: ['F9 Jurnal 7 KAIH', f9],
    f10: ['F10 Penilaian Diri', f10], mengaji: ['Kartu Prestasi Mengaji', kartuMengaji], f12: ['F12 Evaluasi Kegiatan', f12]
  };
  // R = jawaban aksi instrumenKoku; tambahan = opsi (kebiasaan/minggu untuk F9, ringkasan untuk F12)
  async function buat(jenis, R, tambahan) {
    const [nama, fn] = JENIS[jenis];
    if (['f7', 'f9', 'f10', 'mengaji'].includes(jenis) && !R.murid.length) throw new Error('Daftar murid kelas ini belum tersedia di rapor.');
    await rakit(nama + ' Kelas ' + R.kelas + ' Semester ' + R.semester, fn(R, tambahan || {}));
  }
  window.InstrumenKoku = {buat, JENIS};
})();
