# 🚦 Smart Adaptive Traffic Light System (ATSC)
> **Sistem Pengendalian Lampu Lalu Lintas Cerdas Berbasis Computer Vision (YOLOv8/v11), Satuan Mobil Penumpang (SMP), dan Prioritas Kendaraan Darurat.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.9+](https://img.shields.io/badge/Python-3.9%2B-brightgreen.svg)](https://python.org)
[![YOLO: v8 / v11](https://img.shields.io/badge/AI_Engine-YOLOv8%20%2F%20YOLOv11-orange.svg)](https://github.com/ultralytics/ultralytics)
[![Dashboard: Vanilla JS Canvas](https://img.shields.io/badge/Dashboard-HTML5%20%2F%20Canvas-informational.svg)](index.html)

---

## 📌 Ringkasan Proyek

Kemacetan di persimpangan jalan perkotaan sering kali diperparah oleh lampu lalu lintas konvensional yang bekerja secara **kaku (timer statis)** tanpa memedulikan volume antrian riil di setiap ruas jalan. 

**Smart Adaptive Traffic Light System** hadir sebagai solusi modern:
1. **Computer Vision (YOLOv8/v11):** Mendeteksi jenis kendaraan (motor, mobil, bus, truk) secara real-time dari kamera CCTV.
2. **Formula SMP (Satuan Mobil Penumpang):** Menghitung beban kepadatan jalan berbasis standar kapasitas jalan nasional, bukan sekadar jumlah unit kendaraan.
3. **Adaptive Timing System (ATSC):** Mengalokasikan durasi lampu hijau secara proporsional sesuai rasio kepadatan jalan secara dinamis.
4. **Emergency Vehicle Preemption (EVP):** Memberikan lampu hijau prioritas instan jika ambulans atau kendaraan darurat terdeteksi.
5. **Interactive Simulation Hub:** Dashboard berbasis web interaktif dengan visualisasi persimpangan 4-arah, mode manual, dan simulasi skenario lalu lintas nyata.

---

## 🏗️ Arsitektur Sistem

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          EDGE COMPUTING NODE                           │
│           (NVIDIA Jetson Orin Nano / Raspberry Pi 5 / Mini PC)         │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │   CCTV RTSP Stream    │             │   Inference Engine         │  │
│  │   H.264 / H.265 1080p ├────────────►│   YOLOv11n / YOLOv8n       │  │
│  └───────────────────────┘             └─────────────┬──────────────┘  │
│                                                      │                 │
│                                                      ▼                 │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │   Actuator Controller │◄────────────┤   Decision Engine (ATSC)   │  │
│  │   Relay RS485 / GPIO  │  Trigger    │   SMP Scoring & Guardrails │  │
│  └───────────┬───────────┘             └─────────────┬──────────────┘  │
└──────────────┼───────────────────────────────────────┼─────────────────┘
               │                                       │ MQTT / WebSocket
               ▼                                       ▼
    ┌──────────────────────┐              ┌────────────────────────────┐
    │  Traffic Light Unit  │              │   Central Monitoring Hub   │
    │  (Fisik Persimpangan)│              │   (Web Dashboard & Cloud)  │
    └──────────────────────┘              └────────────────────────────┘
```

---

## 🚀 Fitur Utama

- 🧠 **Dual AI Backbone:** Mendukung model ultra-ringan **YOLOv8 Nano** dan **YOLOv11 Nano** dengan spatial attention untuk akurasi optimal di kondisi jalan padat.
- 📐 **Virtual Queue Polygon (ROI):** Penghitungan beban antrian kendaraan hanya di dalam zona antrian aktif (*bounding box anchor point*), memfilter kendaraan di jalur seberang.
- ⚖️ **Dynamic Green-Split Calculator:** Menjamin batas keselamatan (`Min Green = 10s`, `Max Green = 60s`, `Yellow = 3s`, `All-Red = 2s`).
- 🚑 **Instant Emergency Preemption:** Interupsi fase lampu otomatis ketika ambulans terdeteksi demi menyelamatkan nyawa.
- 📊 **Web Dashboard Real-Time:** Simulasi canvas 60 FPS, kontrol kepadatan per arah, pemantauan status fase, dan ekspor data analitik.

---

## 📁 Struktur Repositori

```bash
lampu-merah-pintar/
├── ai_engine/                    # Modul inferensi AI & Kalkulasi ATSC
│   ├── __init__.py
│   ├── config.py                 # Parameter konfigurasi, ROI, & bobot SMP
│   ├── detector.py               # Engine deteksi YOLOv8 / YOLOv11
│   └── traffic_calculator.py     # Algoritma perhitungan durasi adaptif & EVP
├── js/                           # Frontend Logic & Simulasi Interaktif
│   ├── adaptive-engine.js        # Controller logika state mesin lampu
│   ├── app.js                    # Inisialisasi UI & event listener
│   ├── simulation-canvas.js      # Render visual canvas persimpangan 4-arah
│   └── traffic-model.js          # Generator data kendaraan simulasi
├── index.html                    # Halaman Dashboard & Simulasi
├── style.css                     # Desain UI modern (Dark Glassmorphism)
├── main_cv.py                    # Script pemrosesan video pipeline AI
├── generate_sample_video.py      # Generator video sintetis lalu lintas untuk testing
├── requirements.txt              # Daftar dependensi Python
├── DEV_HUB.md                    # Dokumentasi teknis engineering & integrasi edge
├── RANCANGAN_SISTEM.md           # Dokumen perancangan teknis arsitektur
└── PANDUAN_PRESENTASI_CLIENT.md  # Panduan demonstrasi & pitch sistem ke stakeholder
```

---

## 🛠️ Panduan Instalasi & Menjalankan

### 1. Menjalankan Dashboard Simulasi Web (Tanpa Backend Python)
Dashboard web sepenuhnya independen dan dapat langsung dijalankan melalui browser:
- Buka file `index.html` langsung di browser, atau
- Gunakan VSCode Live Server / python simple server:
  ```bash
  python3 -m http.server 8000
  ```
  Lalu akses `http://localhost:8000`.

---

### 2. Menjalankan Pipeline Computer Vision (Python)

#### Prasyarat
- Python 3.9+
- Webcam, file video, atau IP Camera RTSP

#### Langkah Instalasi
```bash
# Clone repositori
git clone https://github.com/FajarHadi1/Lampu-Merah-Pintar.git
cd Lampu-Merah-Pintar

# Buat virtual environment
python3 -m venv venv
source venv/bin/activate  # Untuk macOS/Linux
# venv\Scripts\activate   # Untuk Windows

# Install dependensi
pip install -r requirements.txt
```

#### Menjalankan Deteksi AI
```bash
# 1. (Opsional) Buat video simulasi lalu lintas jika belum ada rekaman CCTV
python generate_sample_video.py

# 2. Jalankan deteksi lalu lintas dengan AI
python main_cv.py
```

---

## 📊 Matriks Pembobotan SMP (Satuan Mobil Penumpang)

| Jenis Kendaraan | Bobot SMP ($W_k$) | Keterangan |
|---|---|---|
| 🏍️ Sepeda Motor (`motorcycle`) | **0.25** | Luas area jalan kecil, akselerasi cepat |
| 🚗 Mobil Pribadi (`car`) | **1.00** | Standar satuan referensi (1.0 SMP) |
| 🚐 Angkot / Minibus (`van`) | **1.20** | Dimensi lebih panjang |
| 🚌 Bus Besar (`bus`) | **2.50** | Dimensi besar, manuver lambat |
| 🚚 Truk Logistik (`truck`) | **3.00** | Beban tinggi, inersia pengereman panjang |
| 🚑 Ambulans (`emergency`) | **PRIORITAS TINGGI** | Interupsi fase (Preemption) instan |

---

## 📚 Dokumentasi Lanjutan

- [Engineering Dev Hub & Edge Guide](DEV_HUB.md): Spesifikasi hardware Jetson/Raspberry Pi, komparasi YOLO, dan integrasi relay GPIO.
- [Rancangan Sistem Detail](RANCANGAN_SISTEM.md): Analisis kebutuhan, arsitektur data, dan guardrails keselamatan lalu lintas.
- [Panduan Presentasi Stakeholder](PANDUAN_PRESENTASI_CLIENT.md): Panduan demo untuk Dishub, Pemda, atau Smart City investor.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE). Bebas digunakan untuk riset, edukasi, maupun implementasi smart city komersial.
