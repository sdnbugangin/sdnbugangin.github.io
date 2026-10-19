/**
 * Aplikasi Rapor SD (Kurikulum Merdeka) — data referensi bawaan.
 *
 * Semua nilai di sini hanyalah BAWAAN untuk sekolah yang baru mendaftar.
 * Setelah terdaftar, setiap sekolah mengubah pengaturannya sendiri di spreadsheet sekolah,
 * bukan di kode ini.
 */

var FASE_KELAS = { 1: 'A', 2: 'A', 3: 'B', 4: 'B', 5: 'C', 6: 'C' };

var ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

var SEMESTER = { 1: 'Ganjil', 2: 'Genap' };

/* Bobot nilai rapor dalam persen. Jumlahnya wajib 100. */
var BOBOT_BAWAAN = { lingkup: 50, akhir: 50 };

/*
 * Kriteria Ketercapaian Tujuan Pembelajaran (KKTP), urut dari batas tertinggi.
 * Nilai >= min masuk ke baris itu. Baris terakhir wajib min 0.
 */
var KKTP_BAWAAN = [
  { min: 88, predikat: 'Sangat baik', kalimat: 'menunjukkan penguasaan yang sangat baik dalam' },
  { min: 74, predikat: 'Baik', kalimat: 'menunjukkan penguasaan yang baik dalam' },
  { min: 60, predikat: 'Cukup', kalimat: 'menunjukkan penguasaan yang cukup dalam' },
  { min: 0, predikat: 'Perlu bimbingan', kalimat: 'perlu bimbingan dalam' }
];

/*
 * Kalimat deskripsi capaian.
 * mode "tetap"    : TP tertinggi selalu memakai kalimatTinggi, TP terendah selalu kalimatRendah
 *                   (sama seperti rapor Excel lama).
 * mode "predikat" : kalimat diambil dari baris KKTP sesuai nilai TP masing-masing.
 */
var DESKRIPSI_BAWAAN = {
  mode: 'tetap',
  kalimatTinggi: 'menunjukkan penguasaan yang sangat baik dalam',
  kalimatRendah: 'perlu pendampingan dalam',
  pakaiPanggilan: true
};

var AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu', 'Kepercayaan terhadap Tuhan YME'];

/* Ejaan lain yang sering dipakai di data siswa, diarahkan ke nama baku di AGAMA. */
var ALIAS_AGAMA = {
  'islam': 'Islam',
  'kristen': 'Kristen', 'kristen protestan': 'Kristen', 'protestan': 'Kristen',
  'katolik': 'Katolik', 'katholik': 'Katolik', 'kristen katolik': 'Katolik',
  'hindu': 'Hindu',
  'buddha': 'Buddha', 'budha': 'Buddha', 'budhha': 'Buddha',
  'khonghucu': 'Khonghucu', 'konghucu': 'Khonghucu', 'kong hu cu': 'Khonghucu', 'konghuchu': 'Khonghucu',
  'kepercayaan': 'Kepercayaan terhadap Tuhan YME', 'aliran kepercayaan': 'Kepercayaan terhadap Tuhan YME',
  'kepercayaan terhadap tuhan yme': 'Kepercayaan terhadap Tuhan YME',
  'kepercayaan terhadap tuhan yang maha esa': 'Kepercayaan terhadap Tuhan YME'
};

var PILIHAN_SENI = ['Seni Musik', 'Seni Rupa', 'Seni Tari', 'Seni Teater'];

/*
 * Struktur mata pelajaran SD Kurikulum Merdeka.
 * kelas      : kelas yang memuat mapel ini.
 * jenis      : "umum", "agama" (nilai dari mapel agama siswa), "seni" (nilai dari seni pilihan siswa),
 *              "mulok" (diisi sekolah).
 * aktifBawaan: kelas yang langsung aktif untuk sekolah baru. Mapel yang tidak tercantum bisa
 *              diaktifkan sekolah sendiri.
 * pilihan    : true = boleh diaktifkan/dinonaktifkan sekolah (mis. belum mengajarkan Bahasa Inggris).
 *              Mapel lain wajib dan selalu aktif di kelas yang memuatnya.
 */
var MAPEL_BAWAAN = [
  { kode: 'PAB', nama: 'Pendidikan Agama dan Budi Pekerti', jenis: 'agama', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [1, 2, 3, 4, 5, 6] },
  { kode: 'PP', nama: 'Pendidikan Pancasila', jenis: 'umum', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [1, 2, 3, 4, 5, 6] },
  { kode: 'BIND', nama: 'Bahasa Indonesia', jenis: 'umum', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [1, 2, 3, 4, 5, 6] },
  { kode: 'MTK', nama: 'Matematika', jenis: 'umum', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [1, 2, 3, 4, 5, 6] },
  { kode: 'IPAS', nama: 'Ilmu Pengetahuan Alam dan Sosial', jenis: 'umum', kelas: [3, 4, 5, 6], aktifBawaan: [3, 4, 5, 6] },
  { kode: 'SENI', nama: 'Seni dan Budaya', jenis: 'seni', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [1, 2, 3, 4, 5, 6] },
  { kode: 'PJOK', nama: 'Pendidikan Jasmani, Olahraga, dan Kesehatan', jenis: 'umum', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [1, 2, 3, 4, 5, 6] },
  { kode: 'BING', nama: 'Bahasa Inggris', jenis: 'umum', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [3, 4, 5, 6], pilihan: true },
  { kode: 'KKA', nama: 'Koding dan Kecerdasan Artifisial', jenis: 'umum', kelas: [5, 6], aktifBawaan: [], pilihan: true },
  { kode: 'MULOK1', nama: 'Muatan Lokal 1', jenis: 'mulok', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [], pilihan: true },
  { kode: 'MULOK2', nama: 'Muatan Lokal 2', jenis: 'mulok', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [], pilihan: true }
];

/* Rapor Excel lama menyediakan sampai 7 muatan lokal. */
var MAKS_MULOK = 7;

/** Mapel bawaan berdasarkan kode; muatan lokal tambahan (MULOK3, MULOK4, …) mengikuti MULOK1. */
function mapelBawaan_(kode) {
  for (var i = 0; i < MAPEL_BAWAAN.length; i++) if (MAPEL_BAWAAN[i].kode === kode) return MAPEL_BAWAAN[i];
  var m = /^MULOK(\d+)$/.exec(kode);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= MAKS_MULOK) {
    return { kode: kode, nama: 'Muatan Lokal ' + m[1], jenis: 'mulok', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [], pilihan: true };
  }
  return null;
}

/*
 * Kode mapel dan judul pada format impor TP e-Rapor Kemendikdasmen (berkas "f_tp (…).xlsx", jenjang SD).
 * Diambil dari template resmi yang dikirim sekolah. Mapel yang belum tercantum tetap bisa diunduh,
 * tetapi kode e-Rapor di sel C2 masih kosong dan harus diisi sendiri.
 */
var KODE_ERAPOR = {
  BIND: { kode: '300110000', nama: 'BAHASA INDONESIA', berkas: 'Bahasa Indonesia' },
  BING: { kode: '300210000', nama: 'BAHASA INGGRIS', berkas: 'Bahasa Inggris' },
  MTK: { kode: '401000000', nama: 'MATEMATIKA (UMUM)', berkas: 'Matematika (Umum)' },
  IPAS: { kode: '401900000', nama: 'ILMU PENGETAHUAN ALAM DAN SOSIAL (IPAS)', berkas: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)' },
  SENI: { kode: '843020100', nama: 'SENI BUDAYA', berkas: 'Seni Budaya' }
};

/* Panjang maksimal satu TP di e-Rapor. */
var MAKS_KARAKTER_TP = 100;

/* Capaian kokurikuler, urut dari tertinggi. */
var LEVEL_KOKURIKULER = ['Mahir', 'Cakap', 'Berkembang'];
