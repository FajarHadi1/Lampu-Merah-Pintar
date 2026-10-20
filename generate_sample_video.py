"""
generate_sample_video.py
Skrip pembuat video sintetis lalu lintas CCTV persimpangan jalan (MP4).
Menghasilkan video pengujian dengan antrian motor, mobil, bus, dan ambulans.
"""

import cv2
import numpy as np

def create_sample_traffic_video(output_path='sample_traffic.mp4', duration_sec=10, fps=30):
    width, height = 1280, 720
    total_frames = duration_sec * fps
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    print(f"[Generator] Membuat video uji coba '{output_path}' ({width}x{height} @ {fps}fps, {duration_sec} detik)...")
    
    # Konfigurasi Kendaraan Uji Coba:
    # [type, x, y, speed, target_stop_y, length, width, color_bgr]
    vehicles = [
        # Antrian Depan (Dekat Stop Line y=480)
        {'type': 'car', 'x': 480, 'y': 100, 'speed': 4.0, 'stop_y': 440, 'len': 85, 'w': 48, 'col': (36, 191, 251)},
        {'type': 'motorcycle', 'x': 550, 'y': 80, 'speed': 4.5, 'stop_y': 430, 'len': 50, 'w': 24, 'col': (248, 189, 56)},
        {'type': 'motorcycle', 'x': 585, 'y': 60, 'speed': 4.6, 'stop_y': 420, 'len': 50, 'w': 24, 'col': (248, 189, 56)},
        
        # Antrian Tengah
        {'type': 'car', 'x': 480, 'y': -30, 'speed': 4.2, 'stop_y': 340, 'len': 85, 'w': 48, 'col': (40, 200, 100)},
        {'type': 'bus', 'x': 680, 'y': -80, 'speed': 3.2, 'stop_y': 400, 'len': 150, 'w': 60, 'col': (250, 139, 167)},
        {'type': 'motorcycle', 'x': 560, 'y': -50, 'speed': 4.4, 'stop_y': 350, 'len': 50, 'w': 24, 'col': (248, 189, 56)},
        
        # Antrian Belakang
        {'type': 'car', 'x': 480, 'y': -160, 'speed': 4.0, 'stop_y': 240, 'len': 85, 'w': 48, 'col': (220, 150, 40)},
        {'type': 'car', 'x': 580, 'y': -190, 'speed': 4.1, 'stop_y': 260, 'len': 85, 'w': 48, 'col': (200, 200, 220)},
        {'type': 'motorcycle', 'x': 660, 'y': -220, 'speed': 4.5, 'stop_y': 220, 'len': 50, 'w': 24, 'col': (248, 189, 56)},
    ]

    for f in range(total_frames):
        # 1. Background Rumput / Trotoar
        frame = np.full((height, width, 3), (25, 35, 45), dtype=np.uint8)
        
        # 2. Jalan Aspal 3 Lajur (x: 400 s/d 800)
        cv2.rectangle(frame, (400, 0), (800, height), (40, 44, 52), -1)
        
        # Marka Tepi Solid Putih
        cv2.line(frame, (400, 0), (400, height), (240, 240, 240), 3)
        cv2.line(frame, (800, 0), (800, height), (240, 240, 240), 3)
        
        # Marka Tengah Putus-Putus
        dash_len = 25
        for y_dash in range(0, height, dash_len * 2):
            cv2.line(frame, (533, y_dash), (533, y_dash + dash_len), (240, 240, 240), 2)
            cv2.line(frame, (666, y_dash), (666, y_dash + dash_len), (240, 240, 240), 2)
            
        # Garis Stop Line Putih Tebal di y=500
        cv2.line(frame, (400, 500), (800, 500), (255, 255, 255), 6)
        
        # Zebra Cross (y: 510 s/d 550)
        for zx in range(410, 790, 30):
            cv2.rectangle(frame, (zx, 515), (zx + 18, 555), (200, 200, 200), -1)
            
        # Lampu Lalu Lintas Fisik di Kanan Jalan (x=820, y=470)
        cv2.rectangle(frame, (820, 460), (850, 550), (20, 20, 20), -1)
        # Lampu Merah Menyala
        cv2.circle(frame, (835, 480), 8, (0, 0, 255), -1)
        cv2.circle(frame, (835, 505), 8, (30, 40, 60), -1)
        cv2.circle(frame, (835, 530), 8, (20, 60, 30), -1)
        
        # 3. Update & Gambar Kendaraan
        for v in vehicles:
            # Gerak maju sampai batas stop line antrian
            if v['y'] < v['stop_y']:
                dist = v['stop_y'] - v['y']
                speed = min(v['speed'], max(0.5, dist * 0.08))
                v['y'] += speed
                
            vx = int(v['x'])
            vy = int(v['y'])
            v_len = v['len']
            v_w = v['w']
            
            # Bounding box kendaraan
            x1 = vx - v_w // 2
            y1 = vy - v_len // 2
            x2 = vx + v_w // 2
            y2 = vy + v_len // 2
            
            # Gambar bodi kendaraan
            cv2.rectangle(frame, (x1, y1), (x2, y2), v['col'], -1)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (20, 20, 20), 2)
            
            # Kaca Depan (Windshield)
            glass_y1 = y2 - int(v_len * 0.25)
            glass_y2 = y2 - int(v_len * 0.1)
            cv2.rectangle(frame, (x1 + 4, glass_y1), (x2 - 4, glass_y2), (30, 30, 30), -1)
            
            # Lampu Depan (Headlights)
            cv2.circle(frame, (x1 + 5, y2 - 2), 3, (255, 255, 200), -1)
            cv2.circle(frame, (x2 - 5, y2 - 2), 3, (255, 255, 200), -1)

        # Label Watermark CCTV
        cv2.putText(frame, "SIMULASI CCTV PERSIMPANGAN 1080p - CAM_NORTH_01", (30, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 220, 255), 2)
        cv2.putText(frame, f"FRAME: {f:04d} | LIVE FEED", (30, 70),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (150, 255, 150), 2)

        out.write(frame)

    out.release()
    print(f"[Generator] Selesai! Video sampel tersimpan di '{output_path}'.")

if __name__ == '__main__':
    create_sample_traffic_video()
