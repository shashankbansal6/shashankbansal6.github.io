import '../../src/fonts.css';
import '../../src/menu.css';
import 'lenis/dist/lenis.css';
import '../../src/styles.css';
import '../../src/watercolor.css';
import '../learn.css';
import '../dive.css';
import '../world.css';
import { startWorld } from '../world.js';
import { sensorWorld } from '../worlds.js';
import { initDive } from '../dive.js';
import { WIDGETS, CAPTIONS } from '../sensor-widgets.js';
import { SENSOR_BEATS } from '../content.js';
import { worldSwitch, worldsNext, initDock } from '../worlds-nav.js';

const $ = (s, r = document) => r.querySelector(s);
$('#w-switch').innerHTML = worldSwitch('sensor');
$('#next').innerHTML = worldsNext('sensor');
initDock('sensor');
const world = sensorWorld($('#world'));
let dive = null;
const ctl = startWorld({
  onResize: () => { world.resize(); dive?.resize(); },
  onFrame: (dt, scroll) => {
    const p = dive?.step(dt, scroll);
    world.draw(dt, scroll, p == null ? 0 : 0.7);
  },
});
dive = initDive($('#dive'), { beats: SENSOR_BEATS, widgets: WIDGETS, captions: CAPTIONS, label: 'SENSOR', mobile: ctl.mobile, scrollToY: ctl.scrollToY });
dive.resize();
$('#w-steps').innerHTML = SENSOR_BEATS.map((b, i) => `<li><button type="button" data-i="${i}"><span>${i + 1}</span>${b.step}</button></li>`).join('');
$('#w-steps').addEventListener('click', (e) => {
  const i = e.target.closest('button')?.dataset.i;
  if (i == null) return;
  const track = $('.dive-track');
  const span = (track.offsetHeight - innerHeight) / SENSOR_BEATS.length;
  ctl.scrollToY(track.getBoundingClientRect().top + scrollY + +i * span + span * 0.5);
});
const at = new URLSearchParams(location.search).get('at');
if (at != null && !Number.isNaN(Number(at))) {
  const go = () => { const track = $('.dive-track'); const span = (track.offsetHeight - innerHeight) / SENSOR_BEATS.length; window.scrollTo(0, track.getBoundingClientRect().top + scrollY + Number(at) * span + span * 0.5); };
  setTimeout(go, 150); document.fonts?.ready.then(() => setTimeout(go, 100));
}
