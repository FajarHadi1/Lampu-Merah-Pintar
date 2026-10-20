"""
traffic_calculator.py
Modul kalkulasi alokasi durasi hijau adaptif (ATSC)
berbasis Satuan Mobil Penumpang (SMP) dan batasan keselamatan.
"""

from .config import SMP_WEIGHTS, TRAFFIC_SIGNAL_BOUNDS

class AdaptiveTrafficCalculator:
    def __init__(self, t_min=None, t_max=None):
        bounds = TRAFFIC_SIGNAL_BOUNDS
        self.t_min = t_min or bounds['T_MIN']
        self.t_max = t_max or bounds['T_MAX']
        self.yellow_time = bounds['T_YELLOW']
        self.all_red_time = bounds['T_ALL_RED']

    def calculate_smp(self, vehicle_counts: dict) -> float:
        """
        Menghitung total beban SMP dari dictionary jumlah kendaraan.
        Contoh input: {'motorcycle': 10, 'car': 3, 'bus': 1}
        """
        total_smp = 0.0
        for v_type, count in vehicle_counts.items():
            weight = SMP_WEIGHTS.get(v_type, 1.0)
            total_smp += count * weight
        return round(total_smp, 2)

    def calculate_green_time(self, lane_smp: float, total_intersection_smp: float = None) -> int:
        """
        Menghitung rekomendasi durasi lampu hijau (detik) secara proporsional.
        Jika total_intersection_smp tidak disediakan, mengestimasi secara non-linear dari lane_smp.
        """
        if lane_smp <= 0:
            return self.t_min

        if total_intersection_smp and total_intersection_smp > 0:
            # Formula Multi-Lajur:
            ratio = lane_smp / max(1.0, total_intersection_smp)
            calculated = self.t_min + (ratio * (self.t_max - self.t_min) * 1.5)
        else:
            # Formula Single Camera / Independent Estimation:
            # Kurva logaritmik halus: 0 SMP -> T_min (10s), 15+ SMP -> T_max (50-60s)
            scale = min(1.0, lane_smp / 18.0)
            calculated = self.t_min + (scale * (self.t_max - self.t_min))

        # Clamp batas aman keselamatan
        green_duration = int(round(max(self.t_min, min(self.t_max, calculated))))
        return green_duration

    def check_early_cutoff(self, current_queue_smp: float, elapsed_green: float) -> bool:
        """
        Mendeteksi apakah antrian sudah habis (0) dan waktu hijau sudah melampaui T_min,
        sehingga fase lampu bisa dipotong lebih awal untuk menghemat waktu.
        """
        return (current_queue_smp <= 0.0) and (elapsed_green >= self.t_min)

    def format_telemetry(self, vehicle_counts: dict, total_smp: float, green_sec: int, emergency: bool = False) -> dict:
        """
        Format data telemetri yang siap dikirimkan ke REST API, MQTT, atau Web Dashboard.
        """
        return {
            "vehicle_counts": vehicle_counts,
            "total_smp": total_smp,
            "recommended_green_seconds": green_sec,
            "emergency_override": emergency,
            "guardrails": {
                "t_min": self.t_min,
                "t_max": self.t_max
            }
        }
