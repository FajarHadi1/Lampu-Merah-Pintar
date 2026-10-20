# Rancang Bangun Sistem Lampu Merah Pintar Adaptif (Smart Adaptive Traffic Light)
*Berbasis Computer Vision & Deep Learning*

---

## 1. Latar Belakang & Rumusan Masalah

### 1.1 Masalah Utama (Fixed-Time Traffic Control)
Pada sistem lampu lalu lintas konvensional, pergantian lampu merah ke hijau bekerja menggunakan **pewaktu statis (fixed timer)**:
- Jalur yang sedang padat antriannya sering kali hanya mendapat durasi hijau singkat (misal 30 detik), sehingga antrian tidak terurai.
- Jalur yang sepi atau kosong tetap mendapatkan durasi hijau penuh, membuang-buang waktu siklus secara sia-sia.
- Terjadi ketimpangan antrian (*traffic imbalance*), peningkatan emisi gas buang kendaraan, pemborosan bahan bakar, dan frustrasi pengendara.

### 1.2 Solusi yang Diajukan
Mengembangkan sistem **Adaptive Traffic Signal Control (ATSC)** cerdas yang memanfaatkan umpan kamera CCTV di persimpangan. Menggunakan algoritma **Deep Learning (Computer Vision)** untuk mendeteksi panjang antrian dan densitas kendaraan secara *real-time*, lalu secara dinamis menyesuaikan durasi lampu hijau dan merah sesuai kebutuhan aktual setiap lajur.

---

## 2. Arsitektur Sistem (End-to-End)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           1. INPUT DATA                                 │
│          Kamera CCTV Persimpangan (RTSP Stream / Video 4 Arah)          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               2. PERCEPTION LAYER (Deep Learning & CV)                  │
│  ┌─────────────────────────┐              ┌──────────────────────────┐  │
│  │ YOLOv8 / YOLOv11 Model  │              │ Emergency Detector       │  │
│  │ (Motor, Mobil, Bus, dll)│              │ (Ambulans / Damkar)      │  │
│  └───────────┬─────────────┘              └────────────┬─────────────┘  │
│              │                                         │                │
│              ▼                                         │                │
│  ┌─────────────────────────┐                           │                │
│  │ Virtual ROI (Polygon)   │                           │                │
│  │ Filter hanya di antrian │                           │                │
│  └───────────┬─────────────┘                           │                │
│              │                                         │                │
│              ▼                                         │                │
│  ┌─────────────────────────┐                           │                │
│  │ Pembobotan Nilai SMP    │                           │                │
│  │ (Motor:0.3, Mobil:1.0)  │                           │                │
│  └───────────┬─────────────┘                           │                │
└──────────────┼─────────────────────────────────────────┼────────────────┘
               │ Skor Beban Densitas                     │ Sinyal Darurat
               ▼                                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│            3. DECISION ENGINE (Adaptive Traffic Controller)             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ • Emergency Override: Jika ambulans terdeteksi -> Beri Green Wave │  │
│  │ • Adaptive Timing: Hitung durasi T_green proporsional densitas    │  │
│  │ • Safety Guard: Batas T_min (15s), T_max (90s), Yellow, All-Red   │  │
│  └───────────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
┌──────────────────────────────────────┐┌─────────────────────────────────┐
│       4A. ACTUATOR / KONTROLER       ││      4B. MONITORING DASHBOARD   │
│  - Kirim sinyal ke Lampu (Merah/Ijo) ││  - Streaming CCTV + Bounding Box│
│  - MQTT / Microcontroller / Hardware ││  - Grafik antrian & timer aktif │
└──────────────────────────────────────┘└─────────────────────────────────┘
```


---

## 3. Rincian Komponen Teknis

### 3.1 Perception Layer (Deep Learning & Computer Vision)

1. **Model Deteksi Objek:**
   - Arsitektur: **YOLOv8 / YOLOv11** (varian `nano` atau `small` untuk inferensi real-time berkecepatan tinggi >30 FPS pada edge device).
   - Deteksi multikelas:
     - Sepeda Motor (`motorcycle`)
     - Mobil Pribadi (`car`)
     - Angkutan Umum / Bus (`bus`)
     - Truk (`truck`)
     - Kendaraan Darurat (`ambulance`, `fire_truck`)

2. **Region of Interest (ROI) Virtual Polygon:**
   - Setiap arah persimpangan (Utara, Selatan, Timur, Barat) memiliki zona poligon virtual yang menandai antrian sebelum garis berhenti (*stop line*).
   - Hanya kendaraan yang berada di dalam area poligon antrian yang dihitung dalam kepadatan siklus.

3. **Matriks Satuan Mobil Penumpang (SMP / Passenger Car Unit):**
   Karakteristik lalu lintas di Indonesia sangat didominasi oleh sepeda motor. Menghitung jumlah kepala kendaraan saja akan bias (100 motor tidak sama ruangnya dengan 100 mobil). Maka diterapkan koefisien SMP:

| Jenis Kendaraan | Bobot SMP (PCU) | Keterangan |
|---|---|---|
| Sepeda Motor | 0.25 - 0.40 | Luas jalan kecil, akselerasi awal cepat |
| Mobil Pribadi / Taksi | 1.00 | Standar acuan dasar |
| Angkutan Umum / Minibus | 1.20 - 1.50 | Sering berhenti/manuver |
| Bus Besar / Truk | 2.00 - 2.50 | Panjang kendaraan besar, akselerasi lambat |

**Formula Beban Kepadatan Lajur ($D_i$):**
$$D_i = \sum_{k \in \text{classes}} (N_{i,k} \times W_k)$$
*Di mana:*
- $D_i$: Total skor kepadatan lajur ke-$i$
- $N_{i,k}$: Jumlah kendaraan kelas $k$ yang berada dalam zona antrian lajur $i$
- $W_k$: Bobot SMP untuk kendaraan kelas $k$

---

### 3.2 Decision Engine (Logika Pengatur Durasi Hijau)

Algoritma mengalokasikan durasi hijau secara proporsional terhadap kepadatan antrian dengan batasan keselamatan (*safety bounds*).

#### Formula Durasi Hijau Dinamis ($T_{\text{green}, i}$):
$$T_{\text{green}, i} = \text{clamp}\left( T_{\text{base}} \times \frac{D_i}{\sum_{j=1}^{M} D_j} \times C_{\text{cycle}}, \; T_{\text{min}}, \; T_{\text{max}} \right)$$

*Batasan Parameter:*
- **$T_{\text{min}}$ (Green Minimal):** 10 - 15 detik (waktu minimum agar antrian terdepan sempat bereaksi dan berjalan).
- **$T_{\text{max}}$ (Green Maksimal):** 60 - 90 detik (mencegah *starvation*, memastikan lajur lain tidak menunggu melebihi ambang batas toleransi).
- **$T_{\text{yellow}}$ (Kuning Transisi):** 3 - 4 detik (waktu pembersihan persimpangan).
- **$T_{\text{all-red}}$ (Merah Bersama):** 1 - 2 detik (memastikan persimpangan benar-benar kosong sebelum lajur berikutnya hijau).

#### Emergency Vehicle Override:
- Jika terdeteksi ambulans atau mobil pemadam kebakaran pada lajur $i$:
  1. Segera persiapkan transisi kuning lajur aktif saat ini.
  2. Berikan lampu hijau langsung (*immediate green wave*) pada lajur kendaraan darurat sampai kendaraan tersebut melewati garis *stop line*.

---

## 4. Penanganan Edge Cases & Resiko Lapangan

1. **Oklusi & Kepadatan Tinggi (Kendaraan Saling Menutupi):**
   - *Solusi:* Memanfaatkan kombinasi Object Detection dengan pelacakan (*ByteTrack / DeepSORT*) dan analisis *optical flow* densitas area jika terjadi kemacetan total.
2. **Pencahayaan Buruk & Cuaca (Malam Hari / Hujan Lebat):**
   - *Solusi:* Augmentasi data training (kondisi hujan, pantulan genangan air, silau lampu malam) serta kamera CCTV dengan fitur WDR (*Wide Dynamic Range*) dan *IR Night Vision*.
3. **Starvation Protection (Lajur Sepi Terabaikan):**
   - *Solusi:* Menerapkan penalti waktu tunggu (*Waiting Time Escalator*). Jika suatu lajur sudah menunggu lebih dari $W_{\text{threshold}}$ (misal 120 detik), lajur tersebut otomatis diprioritaskan pada siklus berikutnya terlepas dari kepadatan lajurnya yang rendah.

---

## 5. Rencana Tahapan Pengembangan (Roadmap)

```text
[Fase 1: Proof of Concept]
  ├── Pengumpulan video sampel CCTV persimpangan (4 arah)
  ├── Pipeline YOLOv8 + Virtual Polygon ROI Counter
  └── Script kalkulasi durasi lampu adaptif (CLI / Output Log)

[Fase 2: Interactive Simulator & Dashboard]
  ├── Simulator visualisasi persimpangan (Traffic Simulator 4 Arah)
  ├── Perbandingan Side-by-Side: Fixed-Time vs Smart-Adaptive
  ├── Dashboard metrik: Rata-rata waktu tunggu, emisi tereduksi, throughput kendaraan
  └── Simulasi skenario ambulans (Emergency Priority Override)

[Fase 3: Edge Deployment & Hardware Integration]
  ├── Optimasi model ke format ONNX / TensorRT untuk inferensi ringan
  ├── Integrasi controller mikro (ESP32 / Raspberry Pi / Relay Modbus)
  └── Integrasi protokol MQTT / REST API untuk Smart City ITS (Intelligent Transportation System)
```

---

## 6. Rekomendasi Tech Stack

- **Computer Vision & AI:** Python, OpenCV, Ultralytics YOLOv8/YOLOv11, PyTorch.
- **Tracking & Geometry:** Shapely (untuk kalkulasi poligon ROI), ByteTrack.
- **Backend & Controller API:** FastAPI / WebSockets (untuk streaming data real-time).
- **Frontend / Dashboard Visualizer:** Web-based (HTML5 Canvas / React, Tailwind/Vanilla CSS modern) untuk visualisasi pergerakan mobil dan lampu.
- **Simulator Kendaraan (Opsional Lanjutan):** Eclipse SUMO (*Simulation of Urban MObility*) via Traci library.
