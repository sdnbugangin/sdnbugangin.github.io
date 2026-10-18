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
 */
var MAPEL_BAWAAN = [
  { kode: 'PAB', nama: 'Pendidikan Agama dan Budi Pekerti', jenis: 'agama', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [1, 2, 3, 4, 5, 6] },
  { kode: 'PP', nama: 'Pendidikan Pancasila', jenis: 'umum', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [1, 2, 3, 4, 5, 6] },
  { kode: 'BIND', nama: 'Bahasa Indonesia', jenis: 'umum', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [1, 2, 3, 4, 5, 6] },
  { kode: 'MTK', nama: 'Matematika', jenis: 'umum', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [1, 2, 3, 4, 5, 6] },
  { kode: 'IPAS', nama: 'Ilmu Pengetahuan Alam dan Sosial', jenis: 'umum', kelas: [3, 4, 5, 6], aktifBawaan: [3, 4, 5, 6] },
  { kode: 'SENI', nama: 'Seni dan Budaya', jenis: 'seni', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [1, 2, 3, 4, 5, 6] },
  { kode: 'PJOK', nama: 'Pendidikan Jasmani, Olahraga, dan Kesehatan', jenis: 'umum', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [1, 2, 3, 4, 5, 6] },
  { kode: 'BING', nama: 'Bahasa Inggris', jenis: 'umum', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [3, 4, 5, 6] },
  { kode: 'KKA', nama: 'Koding dan Kecerdasan Artifisial', jenis: 'umum', kelas: [5, 6], aktifBawaan: [] },
  { kode: 'MULOK1', nama: 'Muatan Lokal 1', jenis: 'mulok', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [] },
  { kode: 'MULOK2', nama: 'Muatan Lokal 2', jenis: 'mulok', kelas: [1, 2, 3, 4, 5, 6], aktifBawaan: [] }
];

/* Capaian kokurikuler, urut dari tertinggi. */
var LEVEL_KOKURIKULER = ['Mahir', 'Cakap', 'Berkembang'];
