"""
config.py
Konfigurasi terpusat sistem deteksi AI, parameter bobot SMP,
dan batasan waktu lampu lalu lintas adaptif (ATSC).
"""

# Pilihan Model yang didukung
SUPPORTED_MODELS = {
    'yolo11n': 'yolo11n.pt',   # YOLOv11 Nano (Default - Generasi Terbaru)
    'yolov8n': 'yolov8n.pt',   # YOLOv8 Nano (Battle-tested)
    'yolo11s': 'yolo11s.pt',   # YOLOv11 Small (Akurasi lebih tinggi)
    'yolov8s': 'yolov8s.pt'    # YOLOv8 Small
}

DEFAULT_MODEL = 'yolo11n.pt'

# Pemetaan ID Kelas COCO Dataset ke Kategori Kendaraan
# 2: car, 3: motorcycle, 5: bus, 7: truck
COCO_VEHICLE_CLASSES = {
    2: 'car',
    3: 'motorcycle',
    5: 'bus',
    7: 'truck'
}

# Pembobotan Satuan Mobil Penumpang (SMP / PCU) Standar Indonesia
SMP_WEIGHTS = {
    'motorcycle': 0.30,
    'car': 1.00,
    'bus': 2.20,
    'truck': 2.20,
    'ambulance': 1.00  # Ambulans diproses khusus dengan prioritas darurat
}

# Warna Bounding Box (Format BGR OpenCV)
CLASS_COLORS = {
    'motorcycle': (248, 189, 56),  # Sky Cyan
    'car': (36, 191, 251),         # Amber Gold
    'bus': (250, 139, 167),        # Purple
    'truck': (200, 100, 250),      # Violet
    'ambulance': (68, 68, 239)     # Bright Red
}

# Parameter Waktu Lampu Lalu Lintas Adaptif (Detik)
TRAFFIC_SIGNAL_BOUNDS = {
    'T_MIN': 10,       # Durasi hijau minimum
    'T_MAX': 60,       # Durasi hijau maksimum
    'T_YELLOW': 3,     # Transisi kuning
    'T_ALL_RED': 1.5,  # Merah bersama untuk membersihkan persimpangan
    'BASE_CYCLE': 100  # Total perkiraan siklus persimpangan
}

# Ambang Batas Deteksi YOLO
DEFAULT_CONFIDENCE_THRESHOLD = 0.40
DEFAULT_IOU_THRESHOLD = 0.45
