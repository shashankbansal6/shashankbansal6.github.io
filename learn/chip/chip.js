import '../../src/fonts.css';
import '../../src/menu.css';
import 'lenis/dist/lenis.css';
import '../../src/styles.css';
import '../../src/watercolor.css';
import '../learn.css';
import '../dive.css';
import '../world.css';
import { startWorld } from '../world.js';
import { chipWorld } from '../worlds.js';
import { initDive } from '../dive.js';
import { WIDGETS, CAPTIONS, chainStrip } from '../chip-widgets.js';
import { CHIP_BEATS } from '../content.js';
import { worldSwitch, worldsNext, initDock } from '../worlds-nav.js';

const $ = (s, r = document) => r.querySelector(s);
$('#w-switch').innerHTML = worldSwitch('chip');
$('#next').innerHTML = worldsNext('chip');
initDock('chip');
const world = chipWorld($('#world'));
let dive = null;
const ctl = startWorld({
  onResize: () => { world.resize(); dive?.resize(); },
  onFrame: (dt, scroll) => {
    const p = dive?.step(dt, scroll);
    world.draw(dt, scroll, p == null ? 0 : 0.6);
  },
});
dive = initDive($('#dive'), { beats: CHIP_BEATS, widgets: WIDGETS, captions: CAPTIONS, label: 'CHIP', strip: chainStrip, stripFrom: 1, scrollToY: ctl.scrollToY });
dive.resize();
$('#w-steps').innerHTML = CHIP_BEATS.map((b, i) => `<li><button type="button" data-i="${i}"><span>${i + 1}</span>${b.step}</button></li>`).join('');
$('#w-steps').addEventListener('click', (e) => {
  const i = e.target.closest('button')?.dataset.i;
  if (i != null) dive.jump(+i);
});
// deep link: ?at=2 opens the third step
const at = new URLSearchParams(location.search).get('at');
if (at != null && !Number.isNaN(Number(at))) {
  const go = () => window.scrollTo(0, dive.y(Number(at)));
  setTimeout(go, 150); document.fonts?.ready.then(() => setTimeout(go, 100));
}
