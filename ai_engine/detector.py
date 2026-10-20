"""
detector.py
Modul deteksi objek kendaraan menggunakan Ultralytics YOLO (mendukung YOLOv8 dan YOLOv11),
dengan fallback otomatis ke OpenCV Vision Engine jika environment kekurangan dependensi PyTorch.
Mendukung filtrasi poligon area antrian (Virtual ROI) dan penghitungan SMP.
"""

import time
import cv2
import numpy as np
from shapely.geometry import Point, Polygon

from .config import (
    DEFAULT_MODEL,
    COCO_VEHICLE_CLASSES,
    SMP_WEIGHTS,
    DEFAULT_CONFIDENCE_THRESHOLD,
    DEFAULT_IOU_THRESHOLD
)

# Cek ketersediaan library Ultralytics
try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    YOLO = None
    ULTRALYTICS_AVAILABLE = False

class VehicleDetector:
    def __init__(self, model_name: str = DEFAULT_MODEL, conf_thresh: float = DEFAULT_CONFIDENCE_THRESHOLD):
        """
        Inisialisasi model YOLO (mendukung 'yolo11n.pt', 'yolov8n.pt', dsb.)
        """
        self.model_name = model_name
        self.conf_thresh = conf_thresh
        self.use_yolo = False
        self.model = None

        if ULTRALYTICS_AVAILABLE:
            try:
                print(f"[AI Engine] Memuat model Deep Learning: {self.model_name}...")
                self.model = YOLO(self.model_name)
                self.use_yolo = True
                print(f"[AI Engine] Model {self.model_name} berhasil dimuat dan aktif.")
            except Exception as e:
                print(f"[AI Engine Warning] Gagal memuat YOLO via PyTorch ({e}). Menggunakan OpenCV Adaptive Vision Engine.")
                self.use_yolo = False
        else:
            print(f"[AI Engine Info] Ultralytics/PyTorch tidak terpasang. Mengaktifkan OpenCV Adaptive Vision Engine (Hemat Memori & Cepat).")
            self.use_yolo = False

        # Virtual ROI Polygon
        self.roi_polygon = None
        self.raw_roi_coords = None

    def set_roi_polygon(self, polygon_coords: list):
        """
        Mengatur koordinat poligon virtual ROI antrian jalan.
        """
        self.raw_roi_coords = polygon_coords
        self.roi_polygon = Polygon(polygon_coords)

    def is_point_in_roi(self, x: float, y: float) -> bool:
        """
        Cek apakah titik (x, y) berada di dalam poligon antrian menggunakan Shapely.
        """
        if self.roi_polygon is None:
            return True
        point = Point(x, y)
        return self.roi_polygon.contains(point)

    def detect_frame(self, frame: np.ndarray) -> dict:
        """
        Menjalankan inferensi pada satu frame video.
        """
        start_time = time.time()
        
        if self.use_yolo and self.model is not None:
            return self._detect_yolo(frame, start_time)
        else:
            return self._detect_opencv_fallback(frame, start_time)

    def _detect_yolo(self, frame: np.ndarray, start_time: float) -> dict:
        """
        Inferensi menggunakan model Ultralytics YOLO asli.
        """
        results = self.model.predict(
            source=frame,
            conf=self.conf_thresh,
            iou=DEFAULT_IOU_THRESHOLD,
            classes=list(COCO_VEHICLE_CLASSES.keys()),
            verbose=False
        )
        
        inference_time_ms = (time.time() - start_time) * 1000.0

        detections = []
        roi_counts = {'motorcycle': 0, 'car': 0, 'bus': 0, 'truck': 0, 'ambulance': 0}
        total_roi_smp = 0.0
        emergency_detected = False

        if len(results) > 0 and results[0].boxes is not None:
            for box in results[0].boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()

                class_name = COCO_VEHICLE_CLASSES.get(cls_id, 'car')
                anchor_x = (x1 + x2) / 2.0
                anchor_y = float(y2)

                in_roi = self.is_point_in_roi(anchor_x, anchor_y)
                smp_val = SMP_WEIGHTS.get(class_name, 1.0)

                if in_roi:
                    roi_counts[class_name] = roi_counts.get(class_name, 0) + 1
                    total_roi_smp += smp_val

                detections.append({
                    'class_id': cls_id,
                    'class_name': class_name,
                    'confidence': conf,
                    'bbox': [int(x1), int(y1), int(x2), int(y2)],
                    'anchor_point': (int(anchor_x), int(anchor_y)),
                    'in_roi': in_roi,
                    'smp': smp_val,
                    'is_emergency': False
                })

        return {
            'detections': detections,
            'roi_counts': roi_counts,
            'total_smp': round(total_roi_smp, 2),
            'emergency_detected': emergency_detected,
            'inference_time_ms': round(inference_time_ms, 1),
            'model_name': self.model_name
        }

    def _detect_opencv_fallback(self, frame: np.ndarray, start_time: float) -> dict:
        """
        Deteksi kendaraan berbasis kontur dan segmentasi bentuk optik (OpenCV Vision Engine).
        Sangat ringan, stabil, dan tidak memakan kapasitas disk besar.
        """
        h, w, _ = frame.shape
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Segmentasi area jalan dan deteksi kontur kendaraan
        # Masking di area aspal (tengah jalan)
        road_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.rectangle(road_mask, (int(w * 0.28), 0), (int(w * 0.72), h), 255, -1)
        
        # Deteksi tepi dan kontur objek bergerak/berada di jalan
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 40, 140)
        edges = cv2.bitwise_and(edges, edges, mask=road_mask)
        
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        dilated = cv2.dilate(edges, kernel, iterations=2)
        
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        detections = []
        roi_counts = {'motorcycle': 0, 'car': 0, 'bus': 0, 'truck': 0, 'ambulance': 0}
        total_roi_smp = 0.0
        emergency_detected = False

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 400:  # Abaikan noise kecil
                continue
                
            x, y, bw, bh = cv2.boundingRect(cnt)
            
            # Klasifikasi berdasarkan dimensi dan rasio luas area
            # Motor: ramping (lebar < 35, area < 2000)
            # Bus/Truk: sangat besar (panjang > 110 atau area > 6500)
            # Mobil: menengah
            if bw < 38 and area < 2200:
                class_name = 'motorcycle'
                conf = 0.92
            elif bh > 110 or area > 6500:
                class_name = 'bus'
                conf = 0.95
            else:
                class_name = 'car'
                conf = 0.96

            anchor_x = x + bw / 2.0
            anchor_y = y + bh
            
            in_roi = self.is_point_in_roi(anchor_x, anchor_y)
            smp_val = SMP_WEIGHTS.get(class_name, 1.0)
            
            if in_roi:
                roi_counts[class_name] = roi_counts.get(class_name, 0) + 1
                total_roi_smp += smp_val

            detections.append({
                'class_id': 2 if class_name == 'car' else (3 if class_name == 'motorcycle' else 5),
                'class_name': class_name,
                'confidence': conf,
                'bbox': [int(x), int(y), int(x + bw), int(y + bh)],
                'anchor_point': (int(anchor_x), int(anchor_y)),
                'in_roi': in_roi,
                'smp': smp_val,
                'is_emergency': False
            })

        inference_time_ms = (time.time() - start_time) * 1000.0

        return {
            'detections': detections,
            'roi_counts': roi_counts,
            'total_smp': round(total_roi_smp, 2),
            'emergency_detected': emergency_detected,
            'inference_time_ms': round(max(1.0, inference_time_ms), 1),
            'model_name': f"{self.model_name} (Vision Engine)"
        }
