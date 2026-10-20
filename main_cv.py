"""
main_cv.py
Skrip utama eksekusi Computer Vision & Deep Learning (YOLOv8 & YOLOv11)
untuk deteksi antrian kendaraan CCTV dan kalkulasi lampu hijau adaptif.
"""

import os
import sys
import time
import argparse
import cv2
import numpy as np

from ai_engine.config import (
    DEFAULT_MODEL,
    SUPPORTED_MODELS,
    CLASS_COLORS,
    DEFAULT_CONFIDENCE_THRESHOLD
)
from ai_engine.detector import VehicleDetector
from ai_engine.traffic_calculator import AdaptiveTrafficCalculator

def parse_args():
    parser = argparse.ArgumentParser(
        description="Lampu Merah Pintar AI - CCTV Detection & Adaptive ATSC Calculator"
    )
    parser.add_argument(
        '--source',
        type=str,
        default='sample_traffic.mp4',
        help="Path video file, index webcam ('0'), atau RTSP stream URL"
    )
    parser.add_argument(
        '--model',
        type=str,
        default=DEFAULT_MODEL,
        help=f"Nama model YOLO yang digunakan: 'yolo11n.pt', 'yolov8n.pt', dsb. (Default: {DEFAULT_MODEL})"
    )
    parser.add_argument(
        '--output',
        type=str,
        default='output_detected.mp4',
        help="Path file output video hasil anotasi (Default: output_detected.mp4)"
    )
    parser.add_argument(
        '--conf',
        type=float,
        default=DEFAULT_CONFIDENCE_THRESHOLD,
        help="Ambang batas confidence deteksi YOLO (Default: 0.35)"
    )
    parser.add_argument(
        '--max-frames',
        type=int,
        default=0,
        help="Maksimal frame yang diproses (0 = seluruh video)"
    )
    return parser.parse_args()

def draw_hud(frame, model_name, fps, latency_ms, roi_counts, total_smp, green_sec):
    """
    Menggambar panel HUD statistik transparan di pojok frame video.
    """
    h, w, _ = frame.shape
    overlay = frame.copy()
    
    # Background Box HUD Semi-Transparan (Top-Left)
    hud_w, hud_h = 420, 220
    cv2.rectangle(overlay, (20, 20), (20 + hud_w, 20 + hud_h), (12, 16, 26), -1)
    cv2.rectangle(overlay, (20, 20), (20 + hud_w, 20 + hud_h), (56, 189, 248), 1)
    
    # Blending Transparansi
    cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)
    
    # Teks Informasi
    font = cv2.FONT_HERSHEY_SIMPLEX
    
    # Header HUD
    cv2.putText(frame, "LAMPU MERAH PINTAR (ATSC AI ENGINE)", (35, 45),
                font, 0.55, (56, 189, 248), 2)
    cv2.putText(frame, f"Model: {model_name.upper()} | {fps:.1f} FPS ({latency_ms:.1f} ms)", (35, 70),
                font, 0.45, (200, 210, 225), 1)
    
    cv2.line(frame, (35, 82), (20 + hud_w - 20, 82), (80, 90, 110), 1)
    
    # Rincian Kendaraan di Area Antrian
    y_offset = 105
    motor_txt = f"Motor (0.3 SMP): {roi_counts.get('motorcycle', 0)}"
    car_txt = f"Mobil (1.0 SMP): {roi_counts.get('car', 0)}"
    bus_txt = f"Bus/Truk (2.2 SMP): {roi_counts.get('bus', 0) + roi_counts.get('truck', 0)}"
    
    cv2.putText(frame, motor_txt, (35, y_offset), font, 0.48, (248, 189, 56), 1)
    cv2.putText(frame, car_txt, (35, y_offset + 25), font, 0.48, (36, 191, 251), 1)
    cv2.putText(frame, bus_txt, (35, y_offset + 50), font, 0.48, (250, 139, 167), 1)
    
    # Kartu Hasil Rekomendasi Waktu Hijau
    cv2.line(frame, (35, y_offset + 65), (20 + hud_w - 20, y_offset + 65), (80, 90, 110), 1)
    
    score_txt = f"Total Beban Antrian: {total_smp:.1f} SMP"
    cv2.putText(frame, score_txt, (35, y_offset + 88), font, 0.50, (255, 255, 255), 2)
    
    rec_txt = f"REKOMENDASI HIJAU: {green_sec} DETIK"
    cv2.putText(frame, rec_txt, (35, y_offset + 115), font, 0.58, (16, 185, 129), 2)

def draw_roi_polygon(frame, roi_coords):
    """
    Menggambar poligon Virtual ROI area antrian dengan efek transparan.
    """
    overlay = frame.copy()
    pts = np.array(roi_coords, np.int32)
    pts = pts.reshape((-1, 1, 2))
    
    # Isi poligon transparan cyan lembut
    cv2.fillPoly(overlay, [pts], (56, 189, 248))
    cv2.addWeighted(overlay, 0.15, frame, 0.85, 0, frame)
    
    # Garis tepi poligon
    cv2.polylines(frame, [pts], isClosed=True, color=(56, 189, 248), thickness=2)
    
    # Label ROI
    lx, ly = roi_coords[0]
    cv2.putText(frame, "[VIRTUAL QUEUE ROI - ZONA ANTRIAN]", (lx + 10, ly + 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (56, 189, 248), 2)

def process_video():
    args = parse_args()
    
    # Periksa input source
    source = args.source
    if source.isdigit():
        source = int(source)
    elif not os.path.exists(source) and not source.startswith(('rtsp://', 'http://', 'https://')):
        print(f"[Error] File video input '{source}' tidak ditemukan!")
        print("💡 Tips: Jalankan 'python3 generate_sample_video.py' terlebih dahulu untuk membuat sampel video.")
        sys.exit(1)

    print(f"============================================================")
    print(f"   LAMPU MERAH PINTAR: COMPUTER VISION & DEEP LEARNING      ")
    print(f"============================================================")
    print(f"• Video Source  : {args.source}")
    print(f"• Model Pilihan : {args.model}")
    print(f"• Output Video  : {args.output}")
    print(f"• Confidence    : {args.conf}")
    print(f"============================================================")

    # Inisialisasi Detector & Traffic Calculator
    detector = VehicleDetector(model_name=args.model, conf_thresh=args.conf)
    calculator = AdaptiveTrafficCalculator()

    # Buka stream video
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"[Error] Gagal membuka video source: {source}")
        sys.exit(1)

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps_in = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

    print(f"[Info] Resolusi Video: {width}x{height} | {fps_in:.1f} FPS | Total: {total_frames} frame")

    # Tentukan Poligon Antrian Virtual ROI (Menyesuaikan dengan resolusi)
    # Default untuk jalan vertikal tengah: x: 380-820, y: 150-490 (sebelum stop line)
    roi_polygon_coords = [
        (int(width * 0.30), int(height * 0.20)),
        (int(width * 0.65), int(height * 0.20)),
        (int(width * 0.65), int(height * 0.68)),
        (int(width * 0.30), int(height * 0.68))
    ]
    detector.set_roi_polygon(roi_polygon_coords)

    # Siapkan VideoWriter untuk output
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(args.output, fourcc, fps_in, (width, height))

    frame_idx = 0
    start_all = time.time()
    
    print("\n[AI Engine] Mulai memproses frame video...")

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if args.max_frames > 0 and frame_idx > args.max_frames:
                break

            # 1. Jalankan Deteksi AI
            detection_res = detector.detect_frame(frame)
            
            roi_counts = detection_res['roi_counts']
            total_smp = detection_res['total_smp']
            emergency = detection_res['emergency_detected']
            latency_ms = detection_res['inference_time_ms']
            current_fps = 1000.0 / max(1.0, latency_ms)

            # 2. Hitung Rekomendasi Durasi Hijau Adaptif
            rec_green_sec = calculator.calculate_green_time(total_smp)

            # 3. Render Visualisasi Anotasi
            # A. Gambar Virtual Poligon Area Antrian
            draw_roi_polygon(frame, roi_polygon_coords)

            # B. Gambar Bounding Box Kendaraan
            for det in detection_res['detections']:
                x1, y1, x2, y2 = det['bbox']
                cls_name = det['class_name']
                conf = det['confidence']
                in_roi = det['in_roi']
                
                # Warna sesuai kelas
                color = CLASS_COLORS.get(cls_name, (200, 200, 200))
                thick = 2 if in_roi else 1

                cv2.rectangle(frame, (x1, y1), (x2, y2), color, thick)

                # Titik Anchor Kontak Roda
                ax, ay = det['anchor_point']
                cv2.circle(frame, (ax, ay), 3, (0, 255, 0) if in_roi else (0, 0, 255), -1)

                # Label Tag
                tag = f"{cls_name.upper()} {conf:.2f} ({det['smp']} SMP)"
                (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
                
                cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw + 6, y1), color, -1)
                cv2.putText(frame, tag, (x1 + 3, y1 - 4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.42, (15, 15, 15), 1)

            # C. Gambar HUD Panel
            draw_hud(frame, args.model, current_fps, latency_ms, roi_counts, total_smp, rec_green_sec)

            # Tulis ke video output
            out.write(frame)

            # Cetak log progress setiap 30 frame
            if frame_idx % 30 == 0 or frame_idx == 1:
                print(f"[Frame {frame_idx:04d}] Antrian: {total_smp:4.1f} SMP | "
                      f"Rekomendasi Hijau: {rec_green_sec:2d}s | "
                      f"Motor: {roi_counts['motorcycle']:2d} | "
                      f"Mobil: {roi_counts['car']:2d} | "
                      f"Bus/Truk: {roi_counts['bus']+roi_counts['truck']:2d} | "
                      f"Latency: {latency_ms:.1f}ms")

    except KeyboardInterrupt:
        print("\n[User Interrupted] Proses dihentikan pengguna.")

    finally:
        cap.release()
        out.release()
        total_time = time.time() - start_all
        avg_fps = frame_idx / max(0.001, total_time)
        print(f"\n============================================================")
        print(f"[Selesai] Total {frame_idx} frame diproses dalam {total_time:.2f} detik.")
        print(f"• Rata-rata Throughput FPS: {avg_fps:.1f} FPS")
        print(f"• Video hasil anotasi tersimpan di: {os.path.abspath(args.output)}")
        print(f"============================================================\n")

if __name__ == '__main__':
    process_video()
