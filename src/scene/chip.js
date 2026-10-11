// The recording chip: a die with a dense pixel-pitched channel array and the
// supporting blocks around it. Blocks are hoverable.
import * as THREE from 'three';
import { CHIP, CHIP_BLOCKS } from '../config.js';
import { Layer, additive, lineMat, flowLines, COLORS } from './materials.js';
import { rng } from '../lib/math.js';
import { tint, WATERCOLOR, PAPER, themed } from '../theme.js';

const Y = new THREE.Vector3(0, 1, 0);
export const DIE_SIZE = 0.24; // world units

function rectBox(rect, h, y = 0) {
  const [x0, z0, x1, z1] = rect;
  const g = new THREE.BoxGeometry(x1 - x0, h, z1 - z0);
  g.translate((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2);
  return g;
}

function rectOutline(rect, y) {
  const [x0, z0, x1, z1] = rect;
  return new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x0, y, z0), new THREE.Vector3(x1, y, z0), new THREE.Vector3(x1, y, z1),
    new THREE.Vector3(x0, y, z1), new THREE.Vector3(x0, y, z0),
  ]);
}

export function buildChip(anchor) {
  const L = new Layer('chip');
  const die = new THREE.Group();
  die.position.copy(anchor.p);
  die.quaternion.setFromUnitVectors(Y, anchor.n);
  die.scale.setScalar(DIE_SIZE);
  L.group.add(die);
  const rand = rng(3);

  // substrate (opaque so the die reads as a solid object)
  const subMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.94 });
  themed(() => subMat.color.set(WATERCOLOR ? '#e6dcc8' : '#060a14'));
  const sub = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 1).translate(0, -0.03, 0), subMat);
  die.add(sub);
  L.add(sub);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(sub.geometry), lineMat(COLORS.cyan, 0.7));
  die.add(edges);
  L.add(edges);

  // faint metal-layer grid
  const grid = [];
  for (let k = -0.5; k <= 0.5001; k += 0.025) {
    grid.push(new THREE.Vector3(k, 0.001, -0.5), new THREE.Vector3(k, 0.001, 0.5));
    grid.push(new THREE.Vector3(-0.5, 0.001, k), new THREE.Vector3(0.5, 0.001, k));
  }
  const gridLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grid), lineMat('#2a4a6a', 0.25));
  die.add(gridLines);
  L.add(gridLines);

  // bond pads
  const pads = [];
  for (let k = 0; k < 26; k++) {
    const a = -0.46 + (k / 25) * 0.92;
    pads.push([a, -0.485], [a, 0.485], [-0.485, a], [0.485, a]);
  }
  const padMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.01, 0.018), additive('#e0b86a', 0.55), pads.length);
  const m = new THREE.Matrix4();
  pads.forEach(([x, z], i) => padMesh.setMatrixAt(i, m.makeTranslation(x, 0.005, z)));
  die.add(padMesh);
  L.add(padMesh);

  // channel array: sqrt(channels)² tiles, one per AFE+ADC pixel
  const arr = CHIP_BLOCKS.find((b) => b.id === 'array').rect;
  const side = Math.round(Math.sqrt(CHIP.channels));
  const pitchX = (arr[2] - arr[0]) / side;
  const pitchZ = (arr[3] - arr[1]) / side;
  const tileGeo = new THREE.BoxGeometry(pitchX * 0.78, 0.008, pitchZ * 0.78);
  const tileMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 });
  tileMat.userData.base = 1;
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, side * side);
  const tilePos = [];
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      const x = arr[0] + (i + 0.5) * pitchX;
      const z = arr[1] + (j + 0.5) * pitchZ;
      tiles.setMatrixAt(j * side + i, m.makeTranslation(x, 0.004, z));
      tilePos.push([x, z]);
    }
  }
  const base = new THREE.Color();
  const hot = new THREE.Color();
  const white = new THREE.Color();
  themed(() => {
    base.set(WATERCOLOR ? '#d3c7b1' : '#0d2236');
    hot.set(tint(COLORS.cyan));
    white.set(WATERCOLOR ? '#1f3550' : '#ffffff');
  });
  const col = new THREE.Color();
  for (let k = 0; k < side * side; k++) tiles.setColorAt(k, base);
  die.add(tiles);
  L.add(tiles);
  const activity = new Float32Array(side * side);

  // functional blocks
  const picks = [];
  const blockMats = {};
  for (const b of CHIP_BLOCKS) {
    let mat = null;
    if (b.id !== 'array') {
      mat = additive(b.color, 0.12);
      const mesh = new THREE.Mesh(rectBox(b.rect, 0.012), mat);
      die.add(mesh);
      L.add(mesh);
      // "standard cells" inside the block
      const [x0, z0, x1, z1] = b.rect;
      const n = Math.floor(((x1 - x0) * (z1 - z0)) * 2200);
      const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), additive(b.color, 0.35), n);
      for (let k = 0; k < n; k++) {
        const w = 0.004 + rand() * 0.012, d = 0.004 + rand() * 0.006;
        m.compose(
          new THREE.Vector3(x0 + 0.01 + rand() * (x1 - x0 - 0.02), 0.014, z0 + 0.01 + rand() * (z1 - z0 - 0.02)),
          new THREE.Quaternion(),
          new THREE.Vector3(w, 0.004, d),
        );
        cells.setMatrixAt(k, m);
      }
      die.add(cells);
      L.add(cells);
    }
    const outlineMat = lineMat(b.color, 0.7);
    const outline = new THREE.Line(rectOutline(b.rect, 0.02), outlineMat);
    die.add(outline);
    L.add(outline);
    const pick = new THREE.Mesh(rectBox(b.rect, 0.04), new THREE.MeshBasicMaterial({ visible: false }));
    pick.userData.block = b;
    die.add(pick);
    picks.push(pick);
    blockMats[b.id] = { fill: mat, outline: outlineMat };
  }

  // data routing: array → DSP → RF, power rails from PMU
  const routes = [];
  for (let k = 0; k < 12; k++) {
    const x = arr[0] + 0.03 + k * 0.05;
    routes.push([new THREE.Vector3(x, 0.022, arr[3]), new THREE.Vector3(x, 0.022, 0.3)]);
  }
  for (let k = 0; k < 5; k++) {
    const z = 0.31 + k * 0.025;
    routes.push([new THREE.Vector3(0.3, 0.022, z), new THREE.Vector3(0.335, 0.022, z)]);
    routes.push([new THREE.Vector3(-0.33, 0.022, -0.3 + k * 0.14), new THREE.Vector3(arr[0], 0.022, -0.3 + k * 0.14)]);
  }
  const flow = flowLines(routes, { color: COLORS.cyan, opacity: 0.8, speed: 1.2, freq: 30 });
  die.add(flow);
  L.add(flow);

  // draw the die after the additive scenery so it occludes it cleanly
  die.traverse((o) => (o.renderOrder = 5));

  let hovered = null;
  const _w = new THREE.Vector3();

  return {
    layer: L,
    die,
    picks,
    hover(id) {
      if (hovered === id) return;
      hovered = id;
      for (const [k, mats] of Object.entries(blockMats)) {
        const on = k === id;
        if (mats.fill) mats.fill.userData.base = on ? 0.4 : 0.12;
        mats.outline.userData.base = on ? 1 : 0.7;
      }
      L.value = -1; // force re-apply
    },
    blockCenterWorld(id) {
      const [x0, z0, x1, z1] = CHIP_BLOCKS.find((b) => b.id === id).rect;
      return die.localToWorld(_w.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2)).clone();
    },
    // `burst` lights a wave across the array (e.g. when a pulse arrives)
    update(dt, rate = 1) {
      if (!L.group.visible) return;
      const n = activity.length;
      const spikes = Math.floor(n * 0.004 * rate + Math.random());
      for (let s = 0; s < spikes; s++) activity[(Math.random() * n) | 0] = 1;
      const decay = Math.exp(-dt * 5);
      const t = performance.now() / 1000;
      for (let k = 0; k < n; k++) {
        activity[k] *= decay;
        const [x, z] = tilePos[k];
        const wave = Math.max(0, Math.sin(x * 9 - t * 3.2 + Math.sin(z * 6) * 0.6)) ** 12 * 0.35 * rate;
        const a = Math.min(1, activity[k] + wave);
        col.copy(base).lerp(hot, Math.min(1, a * 1.4));
        if (a > 0.7) col.lerp(white, (a - 0.7) * 2);
        tiles.setColorAt(k, col);
      }
      tiles.instanceColor.needsUpdate = true;
    },
  };
}
