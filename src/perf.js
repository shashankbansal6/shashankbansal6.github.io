// Adaptive render scale. A phone that cannot hold ~40 fps at the starting pixel ratio steps down a quarter at a
// time (never back up, so it cannot flip-flop) until it can, which keeps scrolling and touch responsive.
// Call the returned function once per animation frame with the rAF timestamp.
export function adaptiveScale({ start, min = 1, apply }) {
  let q = start, last = 0, sum = 0, n = 0, warm = 45; // ignore the first frames: shaders compile, textures upload
  return (time) => {
    const dt = time - last;
    last = time;
    if (dt <= 0 || dt > 120) { sum = 0; n = 0; return; } // a tab switch or a stall is not a measurement
    if (warm > 0) { warm--; return; }
    sum += dt; n++;
    if (n < 40) return;
    const avg = sum / n;
    sum = 0; n = 0;
    if (avg > 26 && q - 0.25 >= min - 1e-6) { q -= 0.25; warm = 20; apply(q); }
  };
}
