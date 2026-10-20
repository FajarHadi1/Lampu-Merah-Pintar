# Developer & Engineering Hub: Lampu Merah Pintar Adaptif (ATSC)
*Dokumentasi Teknis, Arsitektur Sistem, Komparasi AI Model, & Panduan Integrasi Hardware*

---

## 1. Arsitektur Komputasi Sistem (Edge & Cloud)

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

## 2. Komparasi Teknis AI Model: YOLOv8 vs YOLOv11

Sistem ini dirancang secara modular agar kompatibel dengan dua generasi model deteksi objek dari Ultralytics:

| Parameter Teknis | YOLOv8 Nano (`yolov8n.pt`) | YOLOv11 Nano (`yolo11n.pt`) | Analisis untuk Lampu Lalu Lintas |
|---|---|---|---|
| **Rilis Resmi** | Januari 2023 | Oktober 2024 | YOLOv11 membawa optimasi arsitektur terbaru |
| **Jumlah Parameter** | 3.2 Juta | 2.6 Juta *(~19% lebih sedikit)* | V11 lebih hemat memori VRAM/RAM edge device |
| **Beban Komputasi** | 8.7 GFLOPs | 6.5 GFLOPs *(~25% lebih ringan)* | V11 menghemat daya pemrosesan edge |
| **Akurasi (COCO mAP50-95)**| 37.3% | 39.5% *(+2.2% peningkatan)* | V11 lebih tajam mendeteksi motor di kejauhan |
| **Arsitektur Backbone** | C2f (Cross Stage Partial) | C3k2 + C2PSA (Spatial Attention) | V11 lebih unggul saat kendaraan saling tumpuk |
| **Kompatibilitas Ekspor**| Sangat Tinggi (TensorRT/ONNX/TFLite) | Tinggi (Didukung resmi Ultralytics) | Keduanya siap deploy ke industri |

---

## 3. Formulasi Matematika & Algoritma ATSC

### 3.1 Perhitungan Beban Kepadatan Satuan Mobil Penumpang (SMP)
Setiap kendaraan yang terdeteksi diuji apakah koordinat titik kontak roda (*bottom center anchor point*) berada di dalam poligon virtual antrian:

$$(x_{\text{anchor}}, y_{\text{anchor}}) = \left( x_{\min} + \frac{x_{\max} - x_{\min}}{2}, \; y_{\max} \right)$$

$$\text{Jika } (x_{\text{anchor}}, y_{\text{anchor}}) \in \text{Polygon}_{\text{queue}}, \text{ maka masukkan ke perhitungan:}$$

$$D_i = \sum_{k \in K} (N_{i,k} \times W_k)$$

*Matriks Pembobotan Nasional:*
- $W_{\text{motorcycle}} = 0.30$
- $W_{\text{car}} = 1.00$
- $W_{\text{bus}} = 2.20$
- $W_{\text{truck}} = 2.20$

### 3.2 Alokasi Waktu Hijau Proporsional ($T_{\text{green}}$)
$$T_{\text{green}, i} = \text{clamp}\left( T_{\min} + \frac{D_i}{\sum_{j=1}^{M} D_j} \times (T_{\max} - T_{\min}), \; T_{\min}, \; T_{\max} \right)$$

*Nilai Batasan Keamanan:*
- $T_{\min} = 10\text{ detik}$
- $T_{\max} = 60\text{ detik}$
- $T_{\text{yellow}} = 3\text{ detik}$
- $T_{\text{all-red}} = 1.5\text{ detik}$

---

## 4. Spesifikasi Rekomendasi Hardware & CCTV

### 4.1 Kamera CCTV (Traffic Monitoring Camera)
- **Resolusi:** 1080p (1920x1080) @ 25-30 FPS.
- **Protokol:** RTSP (`rtsp://user:pass@ip:554/stream1`) & ONVIF Profile S.
- **Fitur Optik Wajib:**
  - **WDR (Wide Dynamic Range) $\ge$ 120 dB:** Menghilangkan silau lampu sorot mobil di malam hari dan terik matahari siang.
  - **IR Night Vision:** Jangkauan minimal 50 meter.
  - **Lensa Varifocal 2.8 - 12 mm:** Untuk mendapatkan sudut pandang zona antrian yang pas.

### 4.2 Edge Computing Node (Di Gardu Kontrol Persimpangan)
- **Opsi Standar Industri:** **NVIDIA Jetson Orin Nano (8GB)**
  - Menggunakan TensorRT FP16 / INT8 inferensi $\ge$ 45 FPS.
  - Konsumsi daya rendah: 7W - 15W.
- **Opsi Alternatif Hemat Biaya:** **Mini PC Intel N100 / Core i3** (OpenVINO) atau **Raspberry Pi 5 (8GB)** (NCNN / ONNX Runtime).

### 4.3 Controller Interface (Actuator)
- Menggunakan modul **Modbus RTU RS485 Relay** atau **GPIO Optocoupler Isolated Relay** yang terhubung langsung ke panel sakelar lampu lalu lintas eksisting (Fail-safe: jika komputer mati, sistem lampu otomatis fallback ke mode fixed-timer analog standar).

---

## 5. Skema Data Telemetri JSON & API

Setiap siklus frame/detik, engine menghasilkan telemetri JSON yang dapat dikirimkan ke WebSocket dashboard atau broker MQTT (`topic: traffic/intersection_01/telemetry`):

```json
{
  "timestamp": "2026-09-03T07:40:00.124Z",
  "intersection_id": "SIMPANG_DAGO_01",
  "model_used": "yolo11n.pt",
  "inference_latency_ms": 11.4,
  "fps": 34.2,
  "lanes": {
    "north": {
      "vehicles": { "motorcycle": 14, "car": 5, "bus": 1, "truck": 0 },
      "total_smp": 11.4,
      "calculated_green_duration": 42
    },
    "south": {
      "vehicles": { "motorcycle": 6, "car": 2, "bus": 0, "truck": 0 },
      "total_smp": 3.8,
      "calculated_green_duration": 18
    },
    "east": {
      "vehicles": { "motorcycle": 2, "car": 1, "bus": 0, "truck": 0 },
      "total_smp": 1.6,
      "calculated_green_duration": 12
    },
    "west": {
      "vehicles": { "motorcycle": 4, "car": 1, "bus": 0, "truck": 0 },
      "total_smp": 2.2,
      "calculated_green_duration": 14
    }
  },
  "emergency_detected": false,
  "active_phase": {
    "lane": "north",
    "state": "green",
    "time_remaining": 28.5
  }
}
```

---

## 6. Cheatsheet CLI Eksekusi Sistem

### Menjalankan Pipeline dengan YOLOv11 (Generasi Baru):
```bash
python3 main_cv.py --source video_cctv.mp4 --model yolo11n.pt --output hasil_yolo11.mp4
```

### Menjalankan Pipeline dengan YOLOv8:
```bash
python3 main_cv.py --source video_cctv.mp4 --model yolov8n.pt --output hasil_yolov8.mp4
```

### Menghubungkan ke Kamera CCTV Langsung (RTSP):
```bash
python3 main_cv.py --source "rtsp://admin:pass@192.168.1.100:554/stream" --model yolo11n.pt
```

### Menggunakan Webcam Lokal untuk Uji Coba:
```bash
python3 main_cv.py --source 0 --model yolo11n.pt
```
