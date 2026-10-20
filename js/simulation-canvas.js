/**
 * simulation-canvas.js
 * Visualizer & Rendering Engine untuk persimpangan jalan 4 arah,
 * lampu lalu lintas LED, kendaraan bergerak, dan overlay CCTV YOLO mode.
 */

class SimulationCanvas {
  constructor(canvasId, isSmart = false) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.size = this.canvas.width; // 560
    this.center = this.size / 2;
    this.isSmart = isSmart;

    this.roadWidth = 100;
    this.showCctvOverlay = true;

    // Koordinat Lampu Lalu Lintas untuk 4 Arah
    // [x, y, orientasi: 'h'/'v', label]
    this.trafficLightPositions = {
      [DIRECTIONS.NORTH]: { x: this.center - 68, y: this.center - 75, dir: 'north' },
      [DIRECTIONS.SOUTH]: { x: this.center + 68, y: this.center + 75, dir: 'south' },
      [DIRECTIONS.WEST]:  { x: this.center - 75, y: this.center + 68, dir: 'west' },
      [DIRECTIONS.EAST]:  { x: this.center + 75, y: this.center - 68, dir: 'east' }
    };
  }

  setCctvOverlay(enabled) {
    this.showCctvOverlay = enabled;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.size, this.size);
  }

  /**
   * Gambar struktur jalan aspal, marka, dan zebra cross
   */
  drawIntersection() {
    const ctx = this.ctx;
    const c = this.center;
    const rw = this.roadWidth;
    const half = rw / 2;

    // 1. Background Grass / Ground
    ctx.fillStyle = '#0a101d';
    ctx.fillRect(0, 0, this.size, this.size);

    // 2. Asphalt Roads
    ctx.fillStyle = '#1e2538';
    // Jalan Vertikal (North - South)
    ctx.fillRect(c - half, 0, rw, this.size);
    // Jalan Horizontal (West - East)
    ctx.fillRect(0, c - half, this.size, rw);

    // 3. Marka Batas Bahu Jalan (Solid white border lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;

    // Corner lines
    ctx.beginPath();
    // Top-Left corner
    ctx.moveTo(c - half, 0); ctx.lineTo(c - half, c - half); ctx.lineTo(0, c - half);
    // Top-Right corner
    ctx.moveTo(c + half, 0); ctx.lineTo(c + half, c - half); ctx.lineTo(this.size, c - half);
    // Bottom-Left corner
    ctx.moveTo(0, c + half); ctx.lineTo(c - half, c + half); ctx.lineTo(c - half, this.size);
    // Bottom-Right corner
    ctx.moveTo(this.size, c + half); ctx.lineTo(c + half, c + half); ctx.lineTo(c + half, this.size);
    ctx.stroke();

    // 4. Marka Tengah Putus-Putus (Center Dashed Lines)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);

    // North
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, c - half - 15); ctx.stroke();
    // South
    ctx.beginPath(); ctx.moveTo(c, c + half + 15); ctx.lineTo(c, this.size); ctx.stroke();
    // West
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(c - half - 15, c); ctx.stroke();
    // East
    ctx.beginPath(); ctx.moveTo(c + half + 15, c); ctx.lineTo(this.size, c); ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // 5. Garis Berhenti (Stop Lines)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;

    // North Stop Line
    ctx.beginPath(); ctx.moveTo(c - half, c - half - 10); ctx.lineTo(c, c - half - 10); ctx.stroke();
    // South Stop Line
    ctx.beginPath(); ctx.moveTo(c, c + half + 10); ctx.lineTo(c + half, c + half + 10); ctx.stroke();
    // West Stop Line
    ctx.beginPath(); ctx.moveTo(c - half - 10, c); ctx.lineTo(c - half - 10, c + half); ctx.stroke();
    // East Stop Line
    ctx.beginPath(); ctx.moveTo(c + half + 10, c - half); ctx.lineTo(c + half + 10, c); ctx.stroke();

    // 6. Zebra Cross
    this.drawZebraCross(c - half, c - half - 8, rw, 6, 'h');
    this.drawZebraCross(c - half, c + half + 2, rw, 6, 'h');
    this.drawZebraCross(c - half - 8, c - half, 6, rw, 'v');
    this.drawZebraCross(c + half + 2, c - half, 6, rw, 'v');
  }

  drawZebraCross(x, y, w, h, orientation) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    const stripes = 5;
    if (orientation === 'h') {
      const stripeW = w / (stripes * 2);
      for (let i = 0; i < stripes; i++) {
        ctx.fillRect(x + i * stripeW * 2, y, stripeW, h);
      }
    } else {
      const stripeH = h / (stripes * 2);
      for (let i = 0; i < stripes; i++) {
        ctx.fillRect(x, y + i * stripeH * 2, w, stripeH);
      }
    }
  }

  /**
   * Gambar Lampu Lalu Lintas LED 3 Warna
   */
  drawTrafficLights(controller) {
    const ctx = this.ctx;

    Object.entries(this.trafficLightPositions).forEach(([lane, pos]) => {
      const lightState = controller.getLightState(lane);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Casing Lampu
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, -10, -22, 20, 44, 5, true, true);

      // 3 Lensa Lampu (Red, Amber, Green)
      const colors = ['red', 'amber', 'green'];
      const positions = [-13, 0, 13];

      colors.forEach((col, idx) => {
        const y = positions[idx];
        const isActive = (lightState === col);

        ctx.beginPath();
        ctx.arc(0, y, 4.5, 0, Math.PI * 2);

        if (isActive) {
          if (col === 'red') {
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 12;
          } else if (col === 'amber') {
            ctx.fillStyle = '#f59e0b';
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 12;
          } else {
            ctx.fillStyle = '#10b981';
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 14;
          }
        } else {
          ctx.shadowBlur = 0;
          if (col === 'red') ctx.fillStyle = '#450a0a';
          else if (col === 'amber') ctx.fillStyle = '#451a03';
          else ctx.fillStyle = '#064e3b';
        }
        ctx.fill();
      });

      ctx.restore();
    });
  }

  /**
   * Gambar Virtual ROI Queue Zone (Khusus Tampilan CCTV)
   */
  drawQueueROI(vehicles) {
    if (!this.showCctvOverlay) return;

    const ctx = this.ctx;
    const c = this.center;
    const rw = this.roadWidth;
    const half = rw / 2;

    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    // Poligon Area Antrian 4 Arah
    const zones = [
      { name: 'ROI_NORTH', x: c - half, y: 15, w: half, h: c - half - 25, color: '#38bdf8' },
      { name: 'ROI_SOUTH', x: c, y: c + half + 10, w: half, h: this.size - c - half - 25, color: '#38bdf8' },
      { name: 'ROI_WEST',  x: 15, y: c, w: c - half - 25, h: half, color: '#38bdf8' },
      { name: 'ROI_EAST',  x: c + half + 10, y: c - half, w: this.size - c - half - 25, h: half, color: '#38bdf8' }
    ];

    zones.forEach(z => {
      ctx.strokeStyle = z.color;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.04)';
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      ctx.fillRect(z.x, z.y, z.w, z.h);

      // Label ROI
      ctx.font = '9px JetBrains Mono';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.fillText(`[${z.name}]`, z.x + 4, z.y + 12);
    });

    ctx.restore();
  }

  /**
   * Gambar Kendaraan + Efek Bounding Box AI
   */
  drawVehicles(vehicles) {
    const ctx = this.ctx;

    vehicles.forEach(v => {
      ctx.save();
      ctx.translate(v.x, v.y);

      // Rotasi sesuai arah gerak
      let angle = 0;
      switch (v.direction) {
        case DIRECTIONS.NORTH: angle = Math.PI / 2; break;     // Hadap bawah
        case DIRECTIONS.SOUTH: angle = -Math.PI / 2; break;    // Hadap atas
        case DIRECTIONS.WEST:  angle = 0; break;                // Hadap kanan
        case DIRECTIONS.EAST:  angle = Math.PI; break;         // Hadap kiri
      }
      ctx.rotate(angle);

      // 1. Gambar Body Kendaraan
      ctx.fillStyle = v.color;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;

      if (v.type === 'motorcycle') {
        // Motor: Ramping
        this.roundRect(ctx, -v.length / 2, -v.width / 2, v.length, v.width, 3, true, false);
        // Stang & Pengendara
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-2, -v.width / 2, 4, v.width);
      } else if (v.type === 'bus') {
        // Bus: Kotak panjang dengan kaca
        this.roundRect(ctx, -v.length / 2, -v.width / 2, v.length, v.width, 5, true, false);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(v.length / 2 - 8, -v.width / 2 + 2, 5, v.width - 4); // Kaca depan
      } else if (v.type === 'ambulance') {
        // Ambulans: Putih/Merah dengan sirine kedip
        ctx.fillStyle = '#ffffff';
        this.roundRect(ctx, -v.length / 2, -v.width / 2, v.length, v.width, 4, true, false);
        // Garis merah
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-v.length / 2, -2, v.length, 4);

        // Lampu Sirine Kedip (Strobe effect)
        const isBlinkRed = Math.sin(v.sirenPhase) > 0;
        ctx.fillStyle = isBlinkRed ? '#ef4444' : '#3b82f6';
        ctx.shadowColor = isBlinkRed ? '#ef4444' : '#3b82f6';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Mobil Standar
        this.roundRect(ctx, -v.length / 2, -v.width / 2, v.length, v.width, 4, true, false);
        // Windshield
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(v.length / 2 - 8, -v.width / 2 + 2, 5, v.width - 4);
      }

      ctx.restore();

      // 2. Gambar AI Bounding Box (YOLO Mode) jika diaktifkan
      if (this.showCctvOverlay && v.isInQueueZone()) {
        ctx.save();
        const bboxPad = 3;
        const bx = v.x - v.length / 2 - bboxPad;
        const by = v.y - v.width / 2 - bboxPad;
        const bw = v.length + bboxPad * 2;
        const bh = v.width + bboxPad * 2;

        ctx.strokeStyle = v.isEmergency ? '#ef4444' : '#10b981';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, bh);

        // Tag label YOLO
        ctx.font = '8px JetBrains Mono';
        const tagText = `${v.label} ${v.confidence}`;
        const textWidth = ctx.measureText(tagText).width;

        ctx.fillStyle = v.isEmergency ? 'rgba(239, 68, 68, 0.85)' : 'rgba(16, 185, 129, 0.85)';
        ctx.fillRect(bx, by - 12, textWidth + 6, 12);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(tagText, bx + 3, by - 3);
        ctx.restore();
      }
    });
  }

  /**
   * Helper fungsi rounded rectangle
   */
  roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  /**
   * Render seluruh frame
   */
  render(controller, vehicles) {
    this.clear();
    this.drawIntersection();
    this.drawQueueROI(vehicles);
    this.drawVehicles(vehicles);
    this.drawTrafficLights(controller);
  }
}
