// Synthetic neural signals + a lightweight scrolling oscilloscope.
// Nothing here is real data — it is shaped to *look* like each modality.

const TAU = Math.PI * 2;

function noise() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

export class Gen {
  constructor(type, seed = Math.random()) {
    this.type = type;
    this.t = seed * 100;
    this.ar = 0;
    this.slow = 0;
    this.phase = seed * TAU;
    this.spike = 0;
    this.burst = 0;
    this.second = 0; // secondary trace (HbR for optical)
    this.drive = 0; // external "movement intent" envelope, 0..1
  }

  next(dt) {
    const t = (this.t += dt);
    const ph = this.phase;
    switch (this.type) {
      case 'eeg': {
        this.ar = this.ar * 0.85 + noise() * 0.15;
        const alpha = Math.sin(TAU * 10 * t + ph) * (0.6 + 0.4 * Math.sin(TAU * 0.25 * t));
        return 0.45 * alpha + 0.25 * Math.sin(TAU * 2.5 * t + ph * 2) + 0.45 * this.ar;
      }
      case 'meg': {
        this.ar = this.ar * 0.92 + noise() * 0.08;
        return 0.5 * Math.sin(TAU * 10 * t + ph) * (0.7 + 0.3 * Math.sin(TAU * 0.2 * t)) + 0.2 * Math.sin(TAU * 4 * t) + 0.3 * this.ar;
      }
      case 'hddot': {
        const c = (t % 12) / 12;
        const bump = (x) => (x > 0 && x < 1 ? Math.sin(Math.PI * x) ** 2 : 0);
        this.second = -0.35 * bump((c - 0.1) / 0.5) + 0.03 * noise();
        return 0.75 * bump(c / 0.45) - 0.2 + 0.03 * noise() + 0.06 * Math.sin(TAU * 1.1 * t);
      }
      case 'semg': {
        const env = Math.max(0, Math.sin(TAU * 0.45 * t + ph)) ** 2;
        return env * noise() * 1.1 + noise() * 0.04;
      }
      case 'ecog': {
        this.ar = this.ar * 0.96 + noise() * 0.12;
        const hg = (0.15 + 0.6 * Math.max(0, Math.sin(TAU * 0.3 * t + ph)) ** 4) * noise();
        return this.ar * 1.4 + hg * 0.6;
      }
      case 'seeg': {
        this.ar = this.ar * 0.94 + noise() * 0.12;
        if (Math.random() < dt * 0.5) this.spike = 1;
        const s = this.spike;
        this.spike = Math.max(0, this.spike - dt * 9);
        const shape = s > 0 ? -Math.sin(Math.PI * (1 - s)) * 1.2 * (s > 0.5 ? 1 : -0.5) : 0;
        return this.ar * 1.3 + shape;
      }
      case 'spikes': {
        const v = noise() * 0.1;
        if (this.spike > 0) {
          const s = this.spike--;
          return v + (s === 2 ? -0.95 : 0.45);
        }
        if (Math.random() < dt * 18) this.spike = 2;
        return v;
      }
      case 'neural':
      default: {
        // broadband LFP + spikes + high-gamma, modulated by `drive`
        this.ar = this.ar * 0.95 + noise() * 0.1;
        this.slow = this.slow * 0.995 + noise() * 0.01;
        const d = this.drive;
        const hg = noise() * (0.06 + 0.3 * d);
        let sp = 0;
        if (this.spike > 0) {
          sp = this.spike === 2 ? -0.9 : 0.4;
          this.spike--;
        } else if (Math.random() < dt * (6 + 40 * d)) this.spike = 2;
        return this.ar * 0.9 + this.slow * 3 + hg + sp + 0.15 * Math.sin(TAU * 18 * t + ph) * (1 - d);
      }
    }
  }
}

export class Scope {
  // channels: [{ gen, color, color2? }]
  constructor(canvas, channels, { pxPerSec = 90, gain = 0.4, grid = true, label } = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.channels = channels;
    this.pxPerSec = pxPerSec;
    this.gain = gain;
    this.grid = grid;
    this.label = label;
    this.acc = 0;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const r = this.c.getBoundingClientRect();
    this.w = Math.max(10, Math.floor(r.width));
    this.h = Math.max(10, Math.floor(r.height));
    this.c.width = this.w * dpr;
    this.c.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.buf = this.channels.map(() => new Float32Array(this.w));
    this.buf2 = this.channels.map(() => new Float32Array(this.w));
    this.head = 0;
    this.prefill();
  }

  setChannels(channels) {
    this.channels = channels;
    this.resize();
  }

  // one display column per channel (oversampled so fast events still show)
  column() {
    const sdt = 1 / this.pxPerSec;
    this.channels.forEach((ch, i) => {
      let v = 0;
      let peak = 0;
      for (let s = 0; s < 4; s++) {
        const x = ch.gen.next(sdt / 4);
        v += x;
        if (Math.abs(x) > Math.abs(peak)) peak = x;
      }
      this.buf[i][this.head] = Math.abs(peak) > 0.6 ? peak : v / 4;
      this.buf2[i][this.head] = ch.gen.second;
    });
    this.head = (this.head + 1) % this.w;
  }

  // fill the whole window so traces never start flat
  prefill() {
    for (let k = 0; k < this.w; k++) this.column();
  }

  step(dt) {
    if (!this.w) return;
    this.acc += dt * this.pxPerSec;
    const n = Math.min(this.w, Math.floor(this.acc));
    this.acc -= n;
    for (let k = 0; k < n; k++) this.column();
    this.draw();
  }

  draw() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    if (this.grid) {
      ctx.strokeStyle = 'rgba(120,170,220,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = (w - this.head) % 30; x < w; x += 30) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      ctx.stroke();
    }
    const rows = this.channels.length;
    const rh = h / rows;
    this.channels.forEach((ch, i) => {
      const y0 = rh * (i + 0.5);
      const draw = (buf, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const v = buf[(this.head + x) % w];
          const y = y0 - v * rh * this.gain;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      if (ch.color2) draw(this.buf2[i], ch.color2);
      draw(this.buf[i], ch.color);
    });
    // fade-in edge
    const g = ctx.createLinearGradient(0, 0, 40, 0);
    g.addColorStop(0, 'rgba(7,10,18,1)');
    g.addColorStop(1, 'rgba(7,10,18,0)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 40, h);
    ctx.globalCompositeOperation = 'source-over';
  }
}
