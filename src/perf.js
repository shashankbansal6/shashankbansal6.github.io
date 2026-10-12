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

// Building a scene is a few long steps. Hand the main thread back between them, so a tap or a scroll that arrives
// meanwhile is answered at once instead of after the whole build.
export const yieldToMain = () => (globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0)));

// Compile every shader in the scene, including the layers that are still hidden, before the first frame: in the
// background where the browser can (KHR_parallel_shader_compile), and never in the middle of a scroll into a later
// chapter. Programs depend on where they draw, so compile against the composer's buffer when there is one.
export function precompile(renderer, scene, camera, composer) {
  renderer.setRenderTarget(composer ? composer.readBuffer : null);
  let done;
  try { done = renderer.compileAsync(scene, camera); } catch { done = Promise.resolve(); }
  renderer.setRenderTarget(null);
  return Promise.race([done.catch(() => {}), new Promise((r) => setTimeout(r, 2000))]);
}
