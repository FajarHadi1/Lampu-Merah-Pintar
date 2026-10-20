/**
 * traffic-model.js
 * Model kendaraan, fisika pergerakan, dan perhitungan Satuan Mobil Penumpang (SMP).
 */

const DIRECTIONS = {
  NORTH: 'north', // Datang dari atas menuju ke bawah (Southbound)
  SOUTH: 'south', // Datang dari bawah menuju ke atas (Northbound)
  EAST: 'east',   // Datang dari kanan menuju ke kiri (Westbound)
  WEST: 'west'    // Datang dari kiri menuju ke kanan (Eastbound)
};

const VEHICLE_CONFIGS = {
  motorcycle: {
    type: 'motorcycle',
    label: 'Motor',
    length: 16,
    width: 8,
    maxSpeed: 2.8,
    accel: 0.12,
    decel: 0.18,
    smp: 0.30,
    color: '#38bdf8', // Cyan sky
    confidence: 0.94
  },
  car: {
    type: 'car',
    label: 'Mobil',
    length: 26,
    width: 14,
    maxSpeed: 2.3,
    accel: 0.08,
    decel: 0.15,
    smp: 1.00,
    color: '#fbbf24', // Amber gold
    confidence: 0.98
  },
  bus: {
    type: 'bus',
    label: 'Bus',
    length: 44,
    width: 17,
    maxSpeed: 1.6,
    accel: 0.05,
    decel: 0.12,
    smp: 2.20,
    color: '#a78bfa', // Purple
    confidence: 0.96
  },
  ambulance: {
    type: 'ambulance',
    label: 'Ambulans',
    length: 30,
    width: 15,
    maxSpeed: 3.2,
    accel: 0.15,
    decel: 0.20,
    smp: 1.00,
    isEmergency: true,
    color: '#ef4444', // Red Alert
    confidence: 0.99
  }
};

class Vehicle {
  constructor(id, type, direction, canvasSize = 560) {
    this.id = id;
    const config = VEHICLE_CONFIGS[type] || VEHICLE_CONFIGS.car;
    this.type = config.type;
    this.label = config.label;
    this.length = config.length;
    this.width = config.width;
    this.maxSpeed = config.maxSpeed;
    this.accel = config.accel;
    this.decel = config.decel;
    this.smp = config.smp;
    this.color = config.color;
    this.confidence = config.confidence;
    this.isEmergency = !!config.isEmergency;

    this.direction = direction;
    this.canvasSize = canvasSize;
    this.speed = this.maxSpeed * 0.75;
    this.waitingTime = 0;
    this.isQueued = false;
    this.hasClearedIntersection = false;
    this.sirenPhase = 0;

    // Koordinat pusat jalur (center lane)
    const center = canvasSize / 2;
    const laneOffset = 22; // Jarak dari garis tengah jalan

    // Inisialisasi posisi awal dan garis berhenti (Stop Line)
    switch (direction) {
      case DIRECTIONS.NORTH:
        this.x = center - laneOffset;
        this.y = -this.length;
        this.stopLine = center - 60;
        this.exitThreshold = canvasSize + 50;
        break;
      case DIRECTIONS.SOUTH:
        this.x = center + laneOffset;
        this.y = canvasSize + this.length;
        this.stopLine = center + 60;
        this.exitThreshold = -50;
        break;
      case DIRECTIONS.WEST:
        this.x = -this.length;
        this.y = center + laneOffset;
        this.stopLine = center - 60;
        this.exitThreshold = canvasSize + 50;
        break;
      case DIRECTIONS.EAST:
        this.x = canvasSize + this.length;
        this.y = center - laneOffset;
        this.stopLine = center + 60;
        this.exitThreshold = -50;
        break;
    }
  }

  /**
   * Cek apakah kendaraan berada di dalam zona antrian (sebelum stop line)
   */
  isInQueueZone() {
    const center = this.canvasSize / 2;
    switch (this.direction) {
      case DIRECTIONS.NORTH:
        return this.y >= 0 && this.y <= center - 50;
      case DIRECTIONS.SOUTH:
        return this.y <= this.canvasSize && this.y >= center + 50;
      case DIRECTIONS.WEST:
        return this.x >= 0 && this.x <= center - 50;
      case DIRECTIONS.EAST:
        return this.x <= this.canvasSize && this.x >= center + 50;
      default:
        return false;
    }
  }

  /**
   * Update fisika pergerakan dan antrian
   */
  update(lightState, frontVehicle) {
    if (this.isEmergency) {
      this.sirenPhase += 0.2;
    }

    const isLightGreen = (lightState === 'green');
    let targetSpeed = this.maxSpeed;
    const minGap = this.type === 'motorcycle' ? 8 : 14;

    // Periksa jarak ke garis stop jika lampu bukan hijau
    let distanceToStop = Infinity;
    switch (this.direction) {
      case DIRECTIONS.NORTH:
        if (this.y < this.stopLine) distanceToStop = this.stopLine - (this.y + this.length / 2);
        break;
      case DIRECTIONS.SOUTH:
        if (this.y > this.stopLine) distanceToStop = (this.y - this.length / 2) - this.stopLine;
        break;
      case DIRECTIONS.WEST:
        if (this.x < this.stopLine) distanceToStop = this.stopLine - (this.x + this.length / 2);
        break;
      case DIRECTIONS.EAST:
        if (this.x > this.stopLine) distanceToStop = (this.x - this.length / 2) - this.stopLine;
        break;
    }

    // Jika lampu merah/kuning dan belum lewat stop line
    if (!isLightGreen && distanceToStop > 0 && distanceToStop < 130) {
      targetSpeed = Math.min(targetSpeed, Math.max(0, (distanceToStop / 130) * this.maxSpeed));
      if (distanceToStop <= 4) targetSpeed = 0;
    }

    // Periksa jarak ke kendaraan di depan
    if (frontVehicle) {
      let distanceToFront = Infinity;
      switch (this.direction) {
        case DIRECTIONS.NORTH:
          distanceToFront = (frontVehicle.y - frontVehicle.length / 2) - (this.y + this.length / 2);
          break;
        case DIRECTIONS.SOUTH:
          distanceToFront = (this.y - this.length / 2) - (frontVehicle.y + frontVehicle.length / 2);
          break;
        case DIRECTIONS.WEST:
          distanceToFront = (frontVehicle.x - frontVehicle.length / 2) - (this.x + this.length / 2);
          break;
        case DIRECTIONS.EAST:
          distanceToFront = (this.x - this.length / 2) - (frontVehicle.x + frontVehicle.length / 2);
          break;
      }

      if (distanceToFront > 0 && distanceToFront < 100) {
        const safeSpeed = Math.max(0, ((distanceToFront - minGap) / 90) * frontVehicle.speed);
        targetSpeed = Math.min(targetSpeed, safeSpeed);
      } else if (distanceToFront <= minGap) {
        targetSpeed = 0;
      }
    }

    // Terapkan akselerasi / deselerasi
    if (this.speed < targetSpeed) {
      this.speed = Math.min(this.speed + this.accel, targetSpeed);
    } else if (this.speed > targetSpeed) {
      this.speed = Math.max(this.speed - this.decel, targetSpeed);
    }

    // Update posisi
    switch (this.direction) {
      case DIRECTIONS.NORTH: this.y += this.speed; break;
      case DIRECTIONS.SOUTH: this.y -= this.speed; break;
      case DIRECTIONS.WEST:  this.x += this.speed; break;
      case DIRECTIONS.EAST:  this.x -= this.speed; break;
    }

    // Hitung waktu tunggu jika kecepatan sangat rendah saat mengantri
    if (this.speed < 0.2 && this.isInQueueZone()) {
      this.waitingTime += 1 / 60; // Asumsi 60 FPS
      this.isQueued = true;
    } else if (this.speed >= 1.0) {
      this.isQueued = false;
    }

    // Deteksi apakah sudah melewati persimpangan
    const center = this.canvasSize / 2;
    if (!this.hasClearedIntersection) {
      switch (this.direction) {
        case DIRECTIONS.NORTH: if (this.y > center + 60) this.hasClearedIntersection = true; break;
        case DIRECTIONS.SOUTH: if (this.y < center - 60) this.hasClearedIntersection = true; break;
        case DIRECTIONS.WEST:  if (this.x > center + 60) this.hasClearedIntersection = true; break;
        case DIRECTIONS.EAST:  if (this.x < center - 60) this.hasClearedIntersection = true; break;
      }
    }
  }

  /**
   * Cek apakah kendaraan sudah keluar jauh dari canvas
   */
  hasExited() {
    switch (this.direction) {
      case DIRECTIONS.NORTH: return this.y > this.exitThreshold;
      case DIRECTIONS.SOUTH: return this.y < this.exitThreshold;
      case DIRECTIONS.WEST:  return this.x > this.exitThreshold;
      case DIRECTIONS.EAST:  return this.x < this.exitThreshold;
      default: return false;
    }
  }
}
