# Panduan Presentasi & Pitching Klien: Lampu Merah Pintar Adaptif (ATSC)

Dokumen ini adalah panduan strategis untuk mempresentasikan sistem **Lampu Merah Pintar Adaptif Berbasis AI** kepada klien, stakeholder pemerintah (Dinas Perhubungan/Dishub), investor, maupun pengembang kawasan (*Smart City Developers*).

---

## 1. Narasi Pembuka (Hook Problem)

> *"Bapak/Ibu sekalian, kemacetan di persimpangan jalan sering kali bukan disebabkan oleh kapasitas jalan yang kurang, melainkan oleh **sistem pengatur lalu lintas yang buta**.*
> 
> *Saat ini, lebih dari 90% lampu merah bekerja dengan **Fixed-Timer (Waktu Statis)**. Hasilnya sering kita jumpai: antrian kendaraan menumpuk ratusan meter di satu arah hanya mendapat lampu hijau 25 detik, sementara dari arah lain yang sepi atau kosong justru mendapat hijau 30 detik tanpa ada kendaraan yang lewat.*
> 
> *Solusi kami menghadirkan **Lampu Merah Pintar Adaptif**: memberikan 'mata' dan 'otak' pada persimpangan melalui integrasi kamera CCTV dan Deep Learning, sehingga durasi lampu hijau secara otomatis menyesuaikan kepadatan antrian riil setiap detiknya."*

---

## 2. Matriks Perbandingan: Konvensional vs Lampu Pintar

| Aspek | Sistem Konvensional (Lama) | Sistem Pintar Adaptif (Solusi Kita) | Dampak Positif |
|---|---|---|---|
| **Input Data** | Timer statis (buta kondisi riil) | CCTV AI Object Detection (YOLO) | Membaca data real-time |
| **Alokasi Durasi** | Kaku (misal fix 30 detik tiap lajur) | Dinamis (10 s/d 55 detik sesuai antrian) | Antrian terurai optimal |
| **Kondisi Jalan Sepi** | Lampu hijau tetap menyala sia-sia | **Early Cutoff:** Langsung alihkan ke lajur lain | Tidak ada waktu terbuang |
| **Bobot Kendaraan** | Dianggap sama rata | Berbasis **Satuan Mobil Penumpang (SMP)** | Akurat untuk lalu lintas Indonesia |
| **Kendaraan Darurat** | Terjebak antrian | **Emergency Override:** Hijau instan untuk ambulans | Penyelamatan nyawa lebih cepat |
| **Infrastruktur** | Perlu pasang sensor aspal mahal | Menggunakan **kamera CCTV yang sudah ada** | Efisiensi biaya instalasi (CAPEX) |

---

## 3. Cara Menjelaskan Logika & Formula Perhitungan ke Klien

Ketika klien menanyakan: *"Bagaimana algoritma menentukan detik lampu hijaunya?"*, gunakan penjelasan bertahap berikut:

### Langkah 1: Pengenalan Satuan Mobil Penumpang (SMP)
Jelaskan bahwa sistem tidak sekadar "menghitung kepala kendaraan", melainkan menghitung **beban ruang jalan**:
- 🏍️ **Sepeda Motor = 0.30 SMP** (ruang kecil, manuver cepat)
- 🚗 **Mobil Pribadi = 1.00 SMP** (standar acuan)
- 🚌 **Bus / Truk = 2.20 SMP** (memakan ruang besar, akselerasi lambat)

$$\text{Beban Kepadatan Lajur } (D_i) = \sum (\text{Jumlah Kendaraan}_k \times \text{Bobot SMP}_k)$$

### Langkah 2: Formula Durasi Hijau Proporsional
Sistem membagi jatah waktu hijau berdasarkan persentase beban antrian:
$$T_{\text{green}, i} = T_{\text{min}} + \left( \frac{D_i}{\sum D} \times (T_{\text{max}} - T_{\text{min}}) \right)$$
- Jika lajur Utara menanggung **75%** dari total antrian persimpangan, maka lajur Utara akan otomatis diberikan alokasi durasi hijau mendekati batas maksimum ($50 - 55\text{ detik}$).
- Lajur lain yang hanya menanggung **10%** antrian hanya akan diberikan batas minimum ($10 - 15\text{ detik}$).

### Langkah 3: Tiga Mekanisme Keamanan & Efisiensi (Safety & Fairness)
1. **Early Green Cutoff:** Jika antrian di lajur hijau sudah habis sebelum timernya selesai, sistem langsung berpindah ke lajur berikutnya. Waktu hijau tidak terbuang kosong.
2. **Starvation Protection:** Lajur yang sepi dijamin tidak akan "dilupakan". Jika sudah menunggu lebih dari 80 detik, lajur tersebut wajib diprioritaskan di siklus berikutnya.
3. **Emergency Override:** Deteksi ambulans atau damkar langsung memotong lampu lain menjadi merah dan memberikan *Green Wave* langsung.

---

## 4. Panduan Live Demo (Simulator Walkthrough)

Gunakan simulator di `http://localhost:3000` dengan alur demo berikut:

1. **Tahap 1 - Demonstrasi Masalah (Preset Pagi Hari):**
   - Pilih preset **"🌅 Pagi Hari (Utara Sangat Padat)"**.
   - Tunjukkan panel kiri (Konvensional): *“Bisa kita lihat, lajur Utara macet parah karena hanya diberi waktu 30 detik yang tidak cukup.”*
   - Tunjukkan panel kanan (Pintar AI): *“Di sistem kita, AI langsung menambah durasi hijau Utara menjadi 45-55 detik, sementara arah Barat/Timur yang sepi hanya diberi 10-12 detik.”*
2. **Tahap 2 - Tunjukkan Bukti Angka (Metrik):**
   - Tunjukkan metrik di bagian atas: *“Rata-rata waktu tunggu pengendara berhasil terpangkas **30% hingga 45%**, dan kapasitas kendaraan yang lolos per jam meningkat drastis.”*
3. **Tahap 3 - Efek WOW (Ambulans Prioritas):**
   - Klik tombol **"🚑 Kirim Ambulans di Lajur Terpadat"**.
   - Tunjukkan bagaimana lampu segera berubah menjadi hijau untuk ambulans dan mengabaikan antrian biasa: *“Ini fitur penyelamat nyawa otomatis tanpa perlu campur tangan manual polisi lalu lintas.”*

---

## 5. Nilai Investasi & Manfaat untuk Klien (Value Proposition)

1. **Hemat Biaya Investasi (Low CAPEX):** Tidak perlu menggali aspal untuk menanam sensor kabel induktif (*inductive loop*). Cukup manfaatkan tiang dan kamera CCTV yang sudah terpasang.
2. **Penurunan Emisi Karbon (Green City Metric):** Mengurangi waktu berhenti *idling* mesin kendaraan, menurunkan konsumsi bahan bakar dan polusi udara di persimpangan kota.
3. **Peningkatan Smart City Index:** Menjadi portofolio kebanggaan bagi pemerintah daerah / dinas perhubungan dalam menerapkan teknologi kecerdasan buatan berbasis solusi nyata.
