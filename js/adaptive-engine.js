/**
 * adaptive-engine.js
 * Logika pengontrol lampu lalu lintas:
 * 1. ConventionalController (Fixed Timer Statis)
 * 2. SmartAdaptiveController (Dynamic ATSC + SMP Density + Emergency Override)
 */

class ConventionalController {
  constructor() {
    this.sequence = [DIRECTIONS.NORTH, DIRECTIONS.EAST, DIRECTIONS.SOUTH, DIRECTIONS.WEST];
    this.currentIndex = 0;
    this.state = 'green'; // 'green', 'yellow', 'all-red'
    
    // Konfigurasi waktu statis
    this.fixedGreenDuration = 25; // 25 detik statis
    this.yellowDuration = 3;     // 3 detik kuning
    this.allRedDuration = 1.5;   // 1.5 detik merah bersama

    this.timer = this.fixedGreenDuration;
  }

  getCurrentLane() {
    return this.sequence[this.currentIndex];
  }

  getLightState(direction) {
    if (direction === this.getCurrentLane()) {
      return this.state;
    }
    return 'red';
  }

  update(dt = 1 / 60) {
    this.timer -= dt;

    if (this.timer <= 0) {
      if (this.state === 'green') {
        this.state = 'yellow';
        this.timer = this.yellowDuration;
      } else if (this.state === 'yellow') {
        this.state = 'all-red';
        this.timer = this.allRedDuration;
      } else if (this.state === 'all-red') {
        // Pindah ke lajur berikutnya
        this.currentIndex = (this.currentIndex + 1) % this.sequence.length;
        this.state = 'green';
        this.timer = this.fixedGreenDuration;
      }
    }
  }

  reset() {
    this.currentIndex = 0;
    this.state = 'green';
    this.timer = this.fixedGreenDuration;
  }
}

class SmartAdaptiveController {
  constructor() {
    this.sequence = [DIRECTIONS.NORTH, DIRECTIONS.EAST, DIRECTIONS.SOUTH, DIRECTIONS.WEST];
    this.currentIndex = 0;
    this.state = 'green'; // 'green', 'yellow', 'all-red'

    // Parameter batas keamanan ATSC
    this.tMin = 10;           // Durasi hijau minimum (10 detik)
    this.tMax = 55;           // Durasi hijau maksimum (55 detik)
    this.baseGreen = 22;      // Basis durasi
    this.yellowDuration = 3;  // Waktu kuning transisi
    this.allRedDuration = 1.5;// Merah bersama

    this.timer = this.baseGreen;
    this.currentGreenAllocated = this.baseGreen;

    // Status Prioritas Darurat
    this.isEmergencyActive = false;
    this.emergencyLane = null;
    this.emergencyVehicleId = null;

    // Pelacak starvation (waktu tunggu lajur sejak terakhir hijau)
    this.laneStarvationTimers = {
      [DIRECTIONS.NORTH]: 0,
      [DIRECTIONS.EAST]: 0,
      [DIRECTIONS.SOUTH]: 0,
      [DIRECTIONS.WEST]: 0
    };
  }

  getCurrentLane() {
    return this.sequence[this.currentIndex];
  }

  getLightState(direction) {
    if (direction === this.getCurrentLane()) {
      return this.state;
    }
    return 'red';
  }

  /**
   * Hitung kepadatan SMP (Satuan Mobil Penumpang) per lajur
   */
  calculateLaneSMP(vehicles) {
    const smpStats = {
      [DIRECTIONS.NORTH]: 0,
      [DIRECTIONS.EAST]: 0,
      [DIRECTIONS.SOUTH]: 0,
      [DIRECTIONS.WEST]: 0
    };

    const counts = {
      [DIRECTIONS.NORTH]: 0,
      [DIRECTIONS.EAST]: 0,
      [DIRECTIONS.SOUTH]: 0,
      [DIRECTIONS.WEST]: 0
    };

    vehicles.forEach(v => {
      if (v.isInQueueZone() && !v.hasClearedIntersection) {
        smpStats[v.direction] += v.smp;
        counts[v.direction]++;
      }
    });

    return { smpStats, counts };
  }

  /**
   * Periksa apakah ada ambulans aktif
   */
  checkEmergency(vehicles) {
    const ambulance = vehicles.find(v => v.isEmergency && !v.hasClearedIntersection);
    if (ambulance) {
      this.isEmergencyActive = true;
      this.emergencyLane = ambulance.direction;
      this.emergencyVehicleId = ambulance.id;
      return true;
    }
    this.isEmergencyActive = false;
    this.emergencyLane = null;
    this.emergencyVehicleId = null;
    return false;
  }

  /**
   * Kalkulasi durasi hijau secara dinamis berdasarkan densitas SMP
   */
  calculateDynamicGreen(lane, smpStats) {
    const currentSMP = smpStats[lane] || 0;
    const totalSMP = Object.values(smpStats).reduce((a, b) => a + b, 0);

    if (totalSMP === 0 || currentSMP === 0) {
      return this.tMin;
    }

    // Formula Proporsional SMP:
    // T_green = clamp(tMin + (currentSMP / totalSMP) * 45, tMin, tMax)
    const ratio = currentSMP / Math.max(1, totalSMP);
    let calculated = Math.round(this.tMin + (ratio * (this.tMax - this.tMin) * 1.4));

    // Periksa apakah lajur ini sudah mengalami starvation
    if (this.laneStarvationTimers[lane] > 80) {
      calculated = Math.max(calculated, 30); // Beri bonus durasi jika lama antri
    }

    return Math.min(this.tMax, Math.max(this.tMin, calculated));
  }

  /**
   * Pilih lajur berikutnya berdasarkan kombinasi antrian terberat & rotasi adil
   */
  selectNextLane(smpStats) {
    // 1. Jika ada lajur yang mengalami starvation ekstrem (>90s), prioritaskan dulu
    for (const dir of this.sequence) {
      if (this.laneStarvationTimers[dir] >= 90 && smpStats[dir] > 0) {
        return this.sequence.indexOf(dir);
      }
    }

    // 2. Normal cyclic sequence
    return (this.currentIndex + 1) % this.sequence.length;
  }

  update(dt = 1 / 60, vehicles = []) {
    // Update starvation timers untuk lajur yang sedang lampu merah
    this.sequence.forEach(dir => {
      if (dir !== this.getCurrentLane()) {
        this.laneStarvationTimers[dir] += dt;
      } else {
        this.laneStarvationTimers[dir] = 0; // Reset saat hijau
      }
    });

    const hasEmergency = this.checkEmergency(vehicles);

    // ==========================================
    // EMERGENCY OVERRIDE LOGIC
    // ==========================================
    if (hasEmergency && this.emergencyLane) {
      if (this.getCurrentLane() !== this.emergencyLane) {
        // Segera potong fase lajur lain ke kuning darurat
        if (this.state === 'green') {
          this.state = 'yellow';
          this.timer = Math.min(this.timer, 1.8); // percepat transisi
        } else if (this.state === 'all-red') {
          // Langsung beri hijau ke lajur ambulans
          this.currentIndex = this.sequence.indexOf(this.emergencyLane);
          this.state = 'green';
          this.timer = 30; // Beri waktu sampai ambulans lewat
        }
      } else {
        // Ambulans sudah di lajur yang hijau -> pastikan tetap hijau
        this.state = 'green';
        if (this.timer < 10) this.timer = 15;
      }
    }

    // Update timer normal
    this.timer -= dt;

    // ==========================================
    // EARLY GREEN CUTOFF (PENGHEMATAN WAKTU HIJAU)
    // Jika lajur aktif antriannya sudah 0 dan sudah melewati tMin,
    // segera transisikan ke kuning untuk memberi giliran lajur lain!
    // ==========================================
    if (this.state === 'green' && !hasEmergency) {
      const { counts } = this.calculateLaneSMP(vehicles);
      const activeQueueCount = counts[this.getCurrentLane()];
      const elapsedGreen = this.currentGreenAllocated - this.timer;

      if (activeQueueCount === 0 && elapsedGreen >= this.tMin && this.timer > 3) {
        // Antrian sudah habis! Percepat transisi kuning
        this.state = 'yellow';
        this.timer = this.yellowDuration;
      }
    }

    // Pergantian fase otomatis saat timer habis
    if (this.timer <= 0) {
      if (this.state === 'green') {
        this.state = 'yellow';
        this.timer = this.yellowDuration;
      } else if (this.state === 'yellow') {
        this.state = 'all-red';
        this.timer = this.allRedDuration;
      } else if (this.state === 'all-red') {
        const { smpStats } = this.calculateLaneSMP(vehicles);

        // Tentukan lajur berikutnya
        if (hasEmergency && this.emergencyLane) {
          this.currentIndex = this.sequence.indexOf(this.emergencyLane);
        } else {
          this.currentIndex = this.selectNextLane(smpStats);
        }

        const nextLane = this.getCurrentLane();
        this.state = 'green';
        this.currentGreenAllocated = this.calculateDynamicGreen(nextLane, smpStats);
        this.timer = this.currentGreenAllocated;
      }
    }
  }

  reset() {
    this.currentIndex = 0;
    this.state = 'green';
    this.timer = this.baseGreen;
    this.currentGreenAllocated = this.baseGreen;
    this.isEmergencyActive = false;
    this.emergencyLane = null;
    this.emergencyVehicleId = null;
    this.sequence.forEach(dir => this.laneStarvationTimers[dir] = 0);
  }
}
