/**
 * app.js
 * Orkestrator utama: sinkronisasi simulasi side-by-side,
 * kontrol interaktif UI, penghitungan metrik real-time.
 */

// Inisialisasi Kontroler & Canvas
const convController = new ConventionalController();
const smartController = new SmartAdaptiveController();

const convCanvas = new SimulationCanvas('canvas-conventional', false);
const smartCanvas = new SimulationCanvas('canvas-adaptive', true);

// Array Kendaraan (Simpan terpisah untuk masing-masing sistem, namun di-spawn secara identik)
let convVehicles = [];
let smartVehicles = [];

let vehicleIdCounter = 1;
let isPaused = false;
let animationFrameId = null;

// Metrik Statistik
const stats = {
  conv: { throughput: 0, totalWait: 0, waitCount: 0, maxQueue: 0 },
  smart: { throughput: 0, totalWait: 0, waitCount: 0, maxQueue: 0 }
};

// Parameter Kepadatan (0 - 100%)
const spawnRates = {
  [DIRECTIONS.NORTH]: 85,
  [DIRECTIONS.SOUTH]: 40,
  [DIRECTIONS.EAST]: 15,
  [DIRECTIONS.WEST]: 20
};

// Pengatur waktu spawn otomatis per lajur (dalam frame ticks)
const spawnTimers = {
  [DIRECTIONS.NORTH]: 0,
  [DIRECTIONS.SOUTH]: 0,
  [DIRECTIONS.EAST]: 0,
  [DIRECTIONS.WEST]: 0
};

// ============================================================================
// UI DOM Elements
// ============================================================================
const dom = {
  // HUD Timers & Phases
  convLane: document.getElementById('conv-active-lane'),
  convTimer: document.getElementById('conv-timer'),
  smartLane: document.getElementById('smart-active-lane'),
  smartTimer: document.getElementById('smart-timer'),
  smartDynamicStatus: document.getElementById('smart-dynamic-status'),
  ambulanceAlert: document.getElementById('ambulance-alert-badge'),

  // Metrics
  convThroughput: document.getElementById('conv-throughput'),
  convAvgWait: document.getElementById('conv-avg-wait'),
  convMaxQueue: document.getElementById('conv-max-queue'),
  smartThroughput: document.getElementById('smart-throughput'),
  smartAvgWait: document.getElementById('smart-avg-wait'),
  smartCurrentSMP: document.getElementById('smart-current-smp'),

  // Global Banner
  globalEfficiency: document.getElementById('global-efficiency'),
  globalThroughputDiff: document.getElementById('global-throughput-diff'),

  // Sliders
  sliderNorth: document.getElementById('slider-north'),
  sliderSouth: document.getElementById('slider-south'),
  sliderEast: document.getElementById('slider-east'),
  sliderWest: document.getElementById('slider-west'),
  valRateNorth: document.getElementById('val-rate-north'),
  valRateSouth: document.getElementById('val-rate-south'),
  valRateEast: document.getElementById('val-rate-east'),
  valRateWest: document.getElementById('val-rate-west'),

  // Buttons & Toggles
  btnSpawnAmbulance: document.getElementById('btn-spawn-ambulance'),
  toggleYolo: document.getElementById('toggle-yolo-overlay'),
  btnPause: document.getElementById('btn-pause-toggle'),
  btnReset: document.getElementById('btn-reset-sim'),
  presetButtons: document.querySelectorAll('.btn-preset'),

  // Dev Hub Modal Elements
  btnOpenDevHub: document.getElementById('btn-open-devhub'),
  btnCloseDevHub: document.getElementById('btn-close-devhub'),
  modalDevHub: document.getElementById('modal-devhub'),
  modalTabs: document.querySelectorAll('.modal-tab'),
  tabPanes: document.querySelectorAll('.tab-pane')
};

// ============================================================================
// Vehicle Spawning Logic (Sinkron 1-to-1)
// ============================================================================
function getRandomVehicleType() {
  const rand = Math.random();
  // Komposisi lalu lintas Indonesia: ~65% motor, ~25% mobil, ~10% bus/truk
  if (rand < 0.65) return 'motorcycle';
  if (rand < 0.90) return 'car';
  return 'bus';
}

function spawnVehicleInBoth(type, direction) {
  const id1 = vehicleIdCounter++;
  const id2 = vehicleIdCounter++;

  // Buat dua entitas kendaraan yang identik
  const vConv = new Vehicle(id1, type, direction);
  const vSmart = new Vehicle(id2, type, direction);

  convVehicles.push(vConv);
  smartVehicles.push(vSmart);
}

function handleSpawning() {
  Object.entries(spawnRates).forEach(([direction, rate]) => {
    if (rate <= 0) return;

    spawnTimers[direction]++;
    // Semakin tinggi rate (0-100), semakin cepat interval spawn (frame ticks)
    // Range interval: 35 frames (sangat ramai) s/d 260 frames (sepi)
    const spawnThreshold = Math.max(30, Math.floor(260 - (rate / 100) * 225));

    if (spawnTimers[direction] >= spawnThreshold) {
      spawnTimers[direction] = 0;
      const type = getRandomVehicleType();
      spawnVehicleInBoth(type, direction);
    }
  });
}

// ============================================================================
// Simulation Tick Update
// ============================================================================
function updateSimulation() {
  if (isPaused) return;

  // 1. Update Spawning
  handleSpawning();

  // 2. Update Controllers
  const dt = 1 / 60;
  convController.update(dt);
  smartController.update(dt, smartVehicles);

  // 3. Update Fisika Kendaraan Konvensional
  updateVehicleSet(convVehicles, convController, stats.conv);

  // 4. Update Fisika Kendaraan Adaptif
  updateVehicleSet(smartVehicles, smartController, stats.smart);

  // 5. Update UI DOM & Statistik
  updateUI();

  // 6. Render Canvas
  convCanvas.render(convController, convVehicles);
  smartCanvas.render(smartController, smartVehicles);

  animationFrameId = requestAnimationFrame(updateSimulation);
}

function updateVehicleSet(vehicleList, controller, statTracker) {
  // Sort kendaraan berdasarkan jarak perjalanan agar deteksi tabrakan depan akurat
  const lanes = {
    [DIRECTIONS.NORTH]: [],
    [DIRECTIONS.SOUTH]: [],
    [DIRECTIONS.EAST]: [],
    [DIRECTIONS.WEST]: []
  };

  vehicleList.forEach(v => lanes[v.direction].push(v));

  // Sort per lajur (terdepan lebih dulu)
  lanes[DIRECTIONS.NORTH].sort((a, b) => b.y - a.y);
  lanes[DIRECTIONS.SOUTH].sort((a, b) => a.y - b.y);
  lanes[DIRECTIONS.WEST].sort((a, b) => b.x - a.x);
  lanes[DIRECTIONS.EAST].sort((a, b) => a.x - b.x);

  let currentQueueCount = 0;

  // Update setiap kendaraan dengan acuan kendaraan di depannya
  Object.values(lanes).forEach(laneVehicles => {
    laneVehicles.forEach((v, idx) => {
      const frontVehicle = idx > 0 ? laneVehicles[idx - 1] : null;
      const lightState = controller.getLightState(v.direction);
      v.update(lightState, frontVehicle);

      if (v.isQueued) currentQueueCount++;
    });
  });

  statTracker.maxQueue = Math.max(statTracker.maxQueue, currentQueueCount);

  // Hapus kendaraan yang sudah keluar canvas dan catat metrik
  for (let i = vehicleList.length - 1; i >= 0; i--) {
    const v = vehicleList[i];
    if (v.hasExited()) {
      statTracker.throughput++;
      if (v.waitingTime > 0) {
        statTracker.totalWait += v.waitingTime;
        statTracker.waitCount++;
      }
      vehicleList.splice(i, 1);
    }
  }
}

// ============================================================================
// UI Updates & Metrics Display
// ============================================================================
function updateUI() {
  const laneNames = {
    [DIRECTIONS.NORTH]: 'UTARA',
    [DIRECTIONS.SOUTH]: 'SELATAN',
    [DIRECTIONS.EAST]: 'TIMUR',
    [DIRECTIONS.WEST]: 'BARAT'
  };

  // 1. HUD Konvensional
  dom.convLane.textContent = laneNames[convController.getCurrentLane()];
  dom.convTimer.textContent = Math.ceil(convController.timer);

  // 2. HUD Smart Adaptif
  const activeSmartLane = smartController.getCurrentLane();
  dom.smartLane.textContent = laneNames[activeSmartLane];
  dom.smartTimer.textContent = Math.ceil(smartController.timer);

  // Status Badge Adaptif
  if (smartController.isEmergencyActive) {
    dom.ambulanceAlert.classList.remove('hidden');
    dom.smartDynamicStatus.textContent = '🚨 OVERRIDE AMBULANS';
    dom.smartDynamicStatus.className = 'canvas-badge badge-red';
  } else {
    dom.ambulanceAlert.classList.add('hidden');
    dom.smartDynamicStatus.textContent = `Alokasi: ${smartController.currentGreenAllocated}s (SMP)`;
    dom.smartDynamicStatus.className = 'canvas-badge badge-green';
  }

  // Hitung SMP saat ini di lajur aktif
  const { smpStats } = smartController.calculateLaneSMP(smartVehicles);
  dom.smartCurrentSMP.textContent = (smpStats[activeSmartLane] || 0).toFixed(1);

  // 3. Metrik Angka
  dom.convThroughput.textContent = stats.conv.throughput;
  dom.smartThroughput.textContent = stats.smart.throughput;

  const convAvg = stats.conv.waitCount > 0 ? (stats.conv.totalWait / stats.conv.waitCount) : 0;
  const smartAvg = stats.smart.waitCount > 0 ? (stats.smart.totalWait / stats.smart.waitCount) : 0;

  dom.convAvgWait.textContent = `${convAvg.toFixed(1)}s`;
  dom.smartAvgWait.textContent = `${smartAvg.toFixed(1)}s`;
  dom.convMaxQueue.textContent = stats.conv.maxQueue;

  // 4. Global Banner Efficiency
  if (convAvg > 0) {
    const efficiency = Math.max(0, ((convAvg - smartAvg) / convAvg) * 100);
    dom.globalEfficiency.textContent = `+${efficiency.toFixed(0)}% Lebih Cepat`;
  } else {
    dom.globalEfficiency.textContent = `Mengumpulkan Data...`;
  }

  const diffThroughput = stats.smart.throughput - stats.conv.throughput;
  dom.globalThroughputDiff.textContent = `${diffThroughput >= 0 ? '+' : ''}${diffThroughput} Kendaraan`;
}

// ============================================================================
// Event Listeners & Kontrol Pengguna
// ============================================================================
function setupEventListeners() {
  // Sliders
  const setupSlider = (slider, display, dir) => {
    slider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      spawnRates[dir] = val;
      let label = 'Rendah';
      if (val > 70) label = 'Sangat Padat';
      else if (val > 45) label = 'Sedang';
      else if (val <= 10) label = 'Sepi';
      display.textContent = `${label} (${val}%)`;
    });
  };

  setupSlider(dom.sliderNorth, dom.valRateNorth, DIRECTIONS.NORTH);
  setupSlider(dom.sliderSouth, dom.valRateSouth, DIRECTIONS.SOUTH);
  setupSlider(dom.sliderEast, dom.valRateEast, DIRECTIONS.EAST);
  setupSlider(dom.sliderWest, dom.valRateWest, DIRECTIONS.WEST);

  // Presets
  const presets = {
    morning: { north: 85, south: 40, east: 15, west: 20 },
    balanced: { north: 45, south: 45, east: 45, west: 45 },
    evening: { north: 20, south: 80, east: 75, west: 25 },
    night: { north: 10, south: 10, east: 10, west: 10 }
  };

  dom.presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const scenario = btn.dataset.scenario;
      const config = presets[scenario];
      if (config) {
        dom.sliderNorth.value = config.north;
        dom.sliderSouth.value = config.south;
        dom.sliderEast.value = config.east;
        dom.sliderWest.value = config.west;

        dom.sliderNorth.dispatchEvent(new Event('input'));
        dom.sliderSouth.dispatchEvent(new Event('input'));
        dom.sliderEast.dispatchEvent(new Event('input'));
        dom.sliderWest.dispatchEvent(new Event('input'));
      }
    });
  });

  // Tombol Kirim Ambulans
  dom.btnSpawnAmbulance.addEventListener('click', () => {
    // Cari lajur terpadat atau default ke Utara
    const { smpStats } = smartController.calculateLaneSMP(smartVehicles);
    let targetLane = DIRECTIONS.NORTH;
    let maxSmp = -1;

    Object.entries(smpStats).forEach(([dir, smp]) => {
      if (smp > maxSmp) {
        maxSmp = smp;
        targetLane = dir;
      }
    });

    spawnVehicleInBoth('ambulance', targetLane);
  });

  // Toggle YOLO CCTV Overlay
  dom.toggleYolo.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    convCanvas.setCctvOverlay(isChecked);
    smartCanvas.setCctvOverlay(isChecked);
  });

  // Pause / Play
  dom.btnPause.addEventListener('click', () => {
    isPaused = !isPaused;
    dom.btnPause.textContent = isPaused ? '▶️ Lanjutkan' : '⏸️ Jeda Simulasi';
    if (!isPaused) {
      animationFrameId = requestAnimationFrame(updateSimulation);
    }
  });

  // Reset
  dom.btnReset.addEventListener('click', () => {
    convVehicles = [];
    smartVehicles = [];
    convController.reset();
    smartController.reset();

    stats.conv = { throughput: 0, totalWait: 0, waitCount: 0, maxQueue: 0 };
    stats.smart = { throughput: 0, totalWait: 0, waitCount: 0, maxQueue: 0 };

    updateUI();
  });

  // Dev Hub Modal Open/Close & Tabs Navigation
  if (dom.btnOpenDevHub && dom.modalDevHub) {
    dom.btnOpenDevHub.addEventListener('click', () => {
      dom.modalDevHub.classList.remove('hidden');
    });

    if (dom.btnCloseDevHub) {
      dom.btnCloseDevHub.addEventListener('click', () => {
        dom.modalDevHub.classList.add('hidden');
      });
    }

    dom.modalDevHub.addEventListener('click', (e) => {
      if (e.target === dom.modalDevHub) {
        dom.modalDevHub.classList.add('hidden');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !dom.modalDevHub.classList.contains('hidden')) {
        dom.modalDevHub.classList.add('hidden');
      }
    });

    dom.modalTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        dom.modalTabs.forEach(t => t.classList.remove('active'));
        dom.tabPanes.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetId = tab.dataset.tab;
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add('active');
      });
    });
  }
}

// Inisialisasi awal
setupEventListeners();
// Trigger initial slider values
dom.sliderNorth.dispatchEvent(new Event('input'));
dom.sliderSouth.dispatchEvent(new Event('input'));
dom.sliderEast.dispatchEvent(new Event('input'));
dom.sliderWest.dispatchEvent(new Event('input'));

// Jalankan Loop Simulasi
animationFrameId = requestAnimationFrame(updateSimulation);
