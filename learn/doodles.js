// Small stick-figure comics for the Learn pages, one per beat that has a `comic`. Plain SVG in the ink colour of
// the card, a slight wobble (an SVG displacement filter) so the lines look drawn by hand, and a handwritten face.
import { esc } from './refs.js';

const W = 320, H = 180;
let uid = 0;

// a stick figure with its head at (x, y); arms and legs are [dx, dy] ends from the shoulder and the hip
function guy(x, y, { arms = [[-13, 18], [13, 18]], legs = [[-9, 26], [9, 26]], k = 1 } = {}) {
  const r = 8 * k, sh = y + r + 7 * k, hip = y + r + 30 * k;
  const limb = (ox, oy, [dx, dy]) => `M${ox} ${oy}l${dx * k} ${dy * k}`;
  return `<circle cx="${x}" cy="${y}" r="${r}"/><path d="M${x} ${y + r}V${hip}${arms.map((a) => limb(x, sh, a)).join('')}${legs.map((l) => limb(x, hip, l)).join('')}"/>`;
}
// a speech bubble: box at (x, y), lines of text, and a tail pointing at (tx, ty)
function say(x, y, w, lines, tx, ty, size = 14) {
  const h = lines.length * (size + 2) + 10;
  const cx = x + w / 2, cy = y + h;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" class="fill"/><path d="M${cx - 6} ${cy}L${tx} ${ty}L${cx + 6} ${cy}"/>`
    + lines.map((t, i) => `<text x="${cx}" y="${y + 8 + size * 0.85 + i * (size + 2)}" font-size="${size}" text-anchor="middle">${t}</text>`).join('');
}
const txt = (x, y, t, size = 14, anchor = 'middle', cls = '') => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}"${cls ? ` class="${cls}"` : ''}>${t}</text>`;

const COMICS = {
  // EEG as a football match heard from outside the stadium
  eeg: {
    caption: 'EEG is like listening to a football match from the car park. You can tell when someone scores, but not who.',
    art: () => `
      <ellipse cx="100" cy="98" rx="84" ry="48"/><ellipse cx="100" cy="98" rx="56" ry="26"/>
      <path d="M28 82l-8-8M48 62l-5-10M100 50v-12M152 62l5-10M172 82l8-8"/>
      ${txt(100, 104, 'ROAAAR', 17, 'middle', 'accent')}
      ${guy(262, 92, { arms: [[-11, -6], [10, 18]] })}
      <path d="M244 92q-6-5 0-10"/>
      ${say(206, 22, 104, ['Someone scored!'], 254, 76)}
      <path d="M215 154H312"/>`,
  },
  // Penfield's homunculus, offended
  homunculus: {
    caption: 'Penfield’s map of the body, drawn as a person. The hands and lips get the most cortex.',
    art: () => `
      <circle cx="104" cy="56" r="24"/><circle cx="96" cy="50" r="1.6" class="dot"/><circle cx="112" cy="50" r="1.6" class="dot"/>
      <ellipse cx="104" cy="70" rx="15" ry="6.5" class="accentfill"/>
      <path d="M104 80V122M104 92L70 104M104 92L138 104M104 122L96 150M104 122L112 150"/>
      <circle cx="58" cy="108" r="14"/><path d="M47 99l-9-7M45 106l-11-1M46 114l-9 5M54 95l-3-10"/>
      <circle cx="150" cy="108" r="14"/><path d="M161 99l9-7M163 106l11-1M162 114l9 5M154 95l3-10"/>
      <ellipse cx="91" cy="152" rx="9" ry="3.5"/><ellipse cx="117" cy="152" rx="9" ry="3.5"/>
      ${say(172, 8, 142, ['I prefer', '“well-proportioned”.'], 130, 54)}`,
  },
  // the population vector as an election
  vote: {
    caption: 'Every neuron gets a vote on where the hand goes. Unlike most elections, turnout is 100%.',
    art: () => {
      const arrow = (x, y, a) => {
        const dx = Math.cos(a) * 9, dy = -Math.sin(a) * 9;
        const hx = x + dx, hy = y + dy, b = a + Math.PI;
        const w = (s) => `${hx + Math.cos(b + s) * 6} ${hy - Math.sin(b + s) * 6}`;
        return `<path d="M${x - dx} ${y - dy}L${hx} ${hy}M${w(0.5)}L${hx} ${hy}L${w(-0.5)}"/>`;
      };
      const cell = (x, a) => `
        <rect x="${x - 17}" y="70" width="34" height="26" rx="3" class="fill"/>${arrow(x, 83, a)}<path d="M${x} 96V118"/>
        <circle cx="${x}" cy="132" r="14"/><circle cx="${x - 5}" cy="129" r="1.5" class="dot"/><circle cx="${x + 5}" cy="129" r="1.5" class="dot"/>
        <path d="M${x - 10} 142l-8 14M${x + 10} 142l8 14M${x - 3} 146l-2 12M${x + 3} 146l2 12"/>`;
      return `${cell(46, 0.8)}${cell(116, 0.3)}${cell(186, 1.2)}${cell(262, Math.PI)}
        ${say(194, 14, 116, ['Left. Out of spite.'], 252, 68)}`;
    },
  },
  // Hubel and Wiesel's cat and the edge of the slide
  hubel: {
    caption: 'Hubel and Wiesel found edge detectors partly by luck, when the edge of a glass slide swept across the screen. One neuron went wild.',
    art: () => `
      <ellipse cx="74" cy="128" rx="34" ry="19"/><circle cx="110" cy="102" r="16"/>
      <path d="M99 91l2-15 9 10M112 87l8-13 3 16"/><circle cx="106" cy="100" r="1.6" class="dot"/><circle cx="117" cy="100" r="1.6" class="dot"/>
      <path d="M126 106l10-2M126 110l10 2M42 124q-24-10-14-34M54 144v14M66 146v12M86 146v12M98 142v14"/>
      <path d="M110 86V54Q110 32 84 32H72"/><rect x="40" y="20" width="32" height="24" rx="3"/><path d="M48 26v12M56 28v8M64 26v12"/>
      ${txt(60, 70, 'pop! pop! pop!', 15, 'middle', 'accent')}
      <rect x="178" y="30" width="126" height="92" rx="3"/><path d="M200 108L282 46" stroke-width="7"/>
      <path d="M170 134L312 134"/>`,
  },
  // a speech decoder versus phone autocorrect
  speech: {
    caption: 'Decoders that read attempted speech from the cortex keep getting better. Some days they beat my phone’s autocorrect.',
    art: () => `
      ${guy(40, 74, { arms: [[-10, 18], [10, 18]] })}<rect x="34" y="58" width="12" height="6"/>
      <path d="M46 61Q74 46 92 70"/>
      <rect x="92" y="46" width="118" height="72" rx="4"/>${txt(151, 80, 'I’d like', 15)}${txt(151, 98, 'a coffee.', 15)}
      ${txt(151, 140, 'decoder', 13, 'middle', 'muted')}
      <rect x="240" y="40" width="52" height="88" rx="8"/><path d="M256 46h20"/>
      ${txt(266, 78, 'I’d like', 13)}${txt(266, 94, 'a coffin.', 13, 'middle', 'accent')}
      ${txt(266, 150, 'autocorrect', 13, 'middle', 'muted')}`,
  },
  // the extracellular field: loud close up, a whisper further away
  field: {
    caption: 'Right next to a neuron a spike is loud. A couple of hundred micrometres away it’s a whisper.',
    art: () => `
      <path d="M40 100l-12-30M44 96l14-26M38 110l-14 18M48 112l10 30M50 104l40 4"/><circle cx="42" cy="104" r="13" class="accentfill"/>
      ${guy(112, 84, { arms: [[-13, -8], [12, 18]] })}
      ${say(74, 16, 84, ['SPIKE!'], 106, 70, 18)}
      ${guy(276, 84, { arms: [[-11, -6], [10, 18]] })}<path d="M258 84q-6-5 0-10"/>
      ${say(240, 30, 62, ['…hm?'], 270, 68, 12)}
      <path d="M112 156H276M112 150v12M276 150v12"/>${txt(194, 150, '200 µm', 13, 'middle', 'muted')}`,
  },
  // a fork in a jelly brain
  jelly: {
    caption: 'A silicon probe is millions of times stiffer than the brain. From the brain’s side it feels a bit like this.',
    art: () => `
      <ellipse cx="128" cy="152" rx="96" ry="12"/>
      <path d="M52 150Q56 72 128 70Q200 72 204 150"/>
      <path d="M78 120q16-14 30 0t30 0M92 98q14-10 26 0t26 0M74 140q22-10 44 0" class="muted"/>
      <circle cx="116" cy="112" r="1.8" class="dot"/><circle cx="138" cy="112" r="1.8" class="dot"/><ellipse cx="127" cy="126" rx="4" ry="5"/>
      <path d="M42 108q-8-12 0-24M214 108q8-12 0-24"/>
      <path d="M262 74L198 106M198 102l-12 6M200 106l-12 6M202 110l-12 6M196 101l7 13"/>
      ${guy(282, 54, { arms: [[-19, 12], [12, 18]], k: 1.15 })}
      ${say(40, 14, 54, ['ow.'], 98, 70)}`,
  },
  // Stevenson & Kording's curve, and the one that does not grow
  graph: {
    caption: 'The number of neurons we can record at once doubles about every seven years. Some things don’t.',
    art: () => `
      <path d="M44 16V150H306"/>
      <path d="M48 146C150 144 226 128 300 22" class="accent" stroke-width="2.6"/>
      <path d="M48 124C120 122 220 124 300 121"/>
      ${txt(234, 40, 'neurons recorded', 13, 'end', 'accent')}
      ${txt(172, 116, 'grad students to analyse them', 13)}
      ${txt(48, 168, '1950', 12, 'start', 'muted')}${txt(306, 168, 'today', 12, 'end', 'muted')}
      <text x="30" y="84" font-size="12" text-anchor="middle" transform="rotate(-90 30 84)" class="muted">how many</text>`,
  },
  // the noise–power trade-off at a shop counter
  shop: {
    caption: 'Halving an amplifier’s noise costs four times the power. No discounts, and the returns are strictly diminishing.',
    art: () => `
      <rect x="168" y="12" width="140" height="44" rx="3"/>${txt(238, 30, '½ the noise', 15)}${txt(238, 48, '= 4× the power', 15, 'middle', 'accent')}
      ${guy(254, 82, { arms: [[-12, 14], [12, 14]] })}
      <rect x="182" y="108" width="132" height="54" class="fill"/>
      ${guy(70, 92, { arms: [[16, 4], [-12, 18]] })}
      ${say(14, 22, 132, ['Can I pay', 'in microwatts?'], 76, 78)}
      <path d="M10 156H182"/>`,
  },
  // bits versus battery
  bits: {
    caption: 'Each extra bit roughly doubles the energy of a conversion. Ask for too many and the battery takes a byte.',
    art: () => `
      ${guy(54, 96)}${guy(268, 96, { arms: [[-12, -14], [12, -14]] })}
      ${say(12, 18, 120, ['How many bits', 'do we need?'], 56, 84)}
      ${say(214, 34, 96, ['ALL of them.'], 264, 82)}
      <rect x="138" y="118" width="46" height="24" rx="3"/><path d="M184 125v10"/><rect x="141" y="121" width="7" height="18" class="accentfill"/>
      <path d="M192 112q3 6 0 9q-3-3 0-9"/>${txt(161, 164, 'battery', 12, 'middle', 'muted')}`,
  },
  // a clocked chip versus an event-driven one
  events: {
    caption: 'A clocked chip checks on every neuron, every tick. An event-driven chip only gets excited when there’s a spike.',
    art: () => `
      ${txt(80, 18, 'CLOCKED', 13, 'middle', 'muted')}${txt(240, 18, 'EVENT-DRIVEN', 13, 'middle', 'muted')}<path d="M160 10V170" class="muted"/>
      ${guy(26, 80, { arms: [[14, -2], [10, 18]] })}<path d="M42 80l14-8v20z"/>
      ${say(56, 28, 98, ['Anyone? Anyone?'], 62, 70, 13)}
      ${[78, 102, 126, 150].map((x) => `<circle cx="${x - 6}" cy="138" r="8"/><path d="M${x - 9} 140h6"/>`).join('')}
      <path d="M180 162V100M300 162V100M180 106Q240 150 300 106"/>
      <circle cx="204" cy="112" r="8"/><path d="M212 118L256 126L278 116M234 122l-6-10M234 122l12-8"/>
      ${say(196, 36, 104, ['Wake me if', 'you spike.'], 206, 102, 13)}`,
  },
  // charging a capacitor in one jump versus a staircase
  stairs: {
    caption: 'Charge a capacitor in one jump and half the energy turns to heat. Take the stairs: it’s less of a charge.',
    art: () => `
      <path d="M14 162V96H118V162"/>${guy(62, 30, { arms: [[16, 10], [-12, 18]] })}
      <path d="M78 50h16l-3 12h-10z"/><path d="M104 66q6 18 2 30M112 74q6 22 0 40M98 82q4 20-2 36" class="accent"/>
      ${txt(66, 118, 'one jump:', 13)}${txt(66, 134, 'half lost', 13, 'middle', 'accent')}
      <path d="M164 162V144H190V126H216V108H242V90H268V72H312"/>
      ${guy(232, 44, { arms: [[14, 8], [-10, 18]], legs: [[-11, 26], [8, 20]] })}<path d="M245 66h12l-2 10h-8z"/>
      ${txt(262, 156, 'N small steps:', 13)}${txt(262, 172, 'lose 1/N', 13, 'middle', 'accent')}`,
  },
  // ── more brain ──
  // a Utah array, from the neurons' side
  utah: {
    caption: 'A Utah array is 100 needles, 1.5 mm deep. The neurons have questions.',
    art: () => `
      <rect x="98" y="16" width="124" height="22" rx="3" class="fill"/>${txt(160, 32, 'Utah array', 13)}
      <path d="${Array.from({ length: 10 }, (_, i) => `M${106 + i * 12} 38V${92 + (i % 3) * 3}`).join('')}"/>
      <path d="M14 74q15-8 30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0t30 0" class="muted"/>
      ${[[58, 130], [150, 136], [244, 128]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11"/><circle cx="${x - 4}" cy="${y - 2}" r="1.5" class="dot"/><circle cx="${x + 4}" cy="${y - 2}" r="1.5" class="dot"/><path d="M${x - 9} ${y + 7}l-8 10M${x + 9} ${y + 7}l8 10"/>`).join('')}
      ${say(234, 16, 82, ['Is this', 'acupuncture?'], 248, 114, 13)}`,
  },
  // SSVEP: the visual cortex flickers along with the light
  ssvep: {
    caption: 'Stare at a light flashing 15 times a second and your visual cortex starts flashing along. Brains are very suggestible.',
    art: () => `
      <circle cx="62" cy="78" r="17" class="accentfill"/><path d="M62 50v-10M62 106v10M34 78H24M90 78h10M42 58l-7-7M82 58l7-7M42 98l-7 7M82 98l7 7"/>
      ${txt(62, 140, '15 Hz', 14, 'middle', 'accent')}
      ${guy(226, 96, { arms: [[-10, 18], [10, 18]] })}<path d="M216 92q10-18 20 0"/><circle cx="219" cy="86" r="1.5" class="dot"/><circle cx="226" cy="82" r="1.5" class="dot"/><circle cx="233" cy="86" r="1.5" class="dot"/>
      <circle cx="234" cy="72" r="2.5"/><circle cx="240" cy="62" r="3.5"/>
      <rect x="196" y="14" width="114" height="40" rx="18" class="fill"/>${txt(253, 31, 'blink blink', 13)}${txt(253, 47, 'blink blink', 13)}`,
  },
  // phosphenes, one pixel at a time
  phosphene: {
    caption: 'Each electrode on the visual cortex gives you one spot of light. A screen needs a few more.',
    art: () => `
      ${guy(62, 92, { arms: [[-12, 18], [12, 18]] })}<path d="M57 90h3M64 90h3"/>
      ${say(12, 22, 100, ['I see a dot!'], 60, 78)}
      ${guy(252, 92, { arms: [[-16, 14], [-12, 18]] })}
      <rect x="186" y="118" width="46" height="28" rx="2"/><path d="M180 146H238"/>
      ${say(170, 14, 144, ['Great. Only 9,999', 'more to go.'], 248, 78)}
      <circle cx="110" cy="96" r="4" class="accentfill"/><path d="M110 84v-5M110 108v5M98 96h-5M122 96h5" class="accent"/>`,
  },
  // fNIRS is slow
  fnirs: {
    caption: 'fNIRS follows blood flow, which takes a few seconds to catch up with what you’re thinking.',
    art: () => `
      ${guy(78, 96, { arms: [[-12, 18], [12, 18]] })}<rect x="68" y="86" width="20" height="5" class="fill"/>
      <path d="M90 86l14-8M91 90h16M90 94l14 8" class="accent"/>
      ${say(12, 18, 124, ['Give me', 'five seconds.'], 74, 82)}
      ${guy(236, 96, { arms: [[-12, 18], [12, 18]] })}
      ${say(182, 18, 110, ['Are you', 'thinking?'], 234, 82)}
      <path d="M20 162H300"/>`,
  },
  // two streams of language
  streams: {
    caption: 'Speech takes two routes through the brain: one to what a word means, one to how to say it.',
    art: () => `
      <path d="M200 40V162M10 162H310"/>
      <path d="M200 50H140L130 61L140 72H200Z" class="fill"/>${txt(167, 66, 'meaning', 13)}
      <path d="M200 84H262L272 95L262 106H200Z" class="fill"/>${txt(233, 100, 'mouth', 13)}
      ${guy(70, 98, { arms: [[14, -4], [12, 18]] })}<rect x="84" y="94" width="44" height="18" rx="2" class="fill"/>${txt(106, 108, '“hello”', 12)}
      ${say(14, 22, 112, ['I’ll take both.'], 66, 84)}`,
  },
  // the tongue gets its own channels
  tongue: {
    caption: 'Hundreds of contacts over the speech cortex can tell the lips, jaw and tongue apart. The tongue gets plenty of channels.',
    art: () => `
      <circle cx="92" cy="78" r="40"/><circle cx="80" cy="72" r="2" class="dot"/><circle cx="104" cy="72" r="2" class="dot"/>
      <path d="M80 96q12 8 24 0"/><path d="M90 99q2 16 10 14q8-2 4-14" class="accentfill"/>
      <g class="muted">${[0, 1, 2, 3, 4].map((i) => [0, 1, 2].map((j) => `<circle cx="${66 + i * 12}" cy="${46 + j * 8}" r="1.6" class="dot"/>`).join('')).join('')}</g>
      <path d="M92 118V150M92 128l-14 14M92 128l14 14M92 150l-8 14M92 150l8 14"/>
      ${say(162, 22, 150, ['Thith ith', 'channel forty-theven.'], 130, 64)}`,
  },
  // ── more sensors ──
  // the electrode is a capacitor in a pool of salt water
  pool: {
    caption: 'Put metal in salt water and charge piles up on its surface. Electrically, the electrode turns into a capacitor.',
    art: () => `
      <path d="M20 86V160H300V86"/><path d="M20 100q10-6 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0" class="muted"/>
      ${guy(160, 58, { arms: [[-16, 6], [16, 6]], legs: [[-6, 30], [6, 30]] })}
      ${txt(144, 124, '+', 15, 'middle', 'accent')}${txt(144, 140, '+', 15, 'middle', 'accent')}${txt(178, 124, '−', 15)}${txt(178, 140, '−', 15)}
      ${txt(70, 140, 'salt water', 13, 'middle', 'muted')}
      ${say(192, 8, 124, ['The water’s fine.', 'A bit capacitive.'], 168, 48)}`,
  },
  // a big electrode hears the crowd, a small one hears a neighbour
  crowd: {
    caption: 'A big electrode hears the whole crowd. A tiny one hears whoever is standing right next to it.',
    art: () => `
      <path d="M80 10V40"/><ellipse cx="80" cy="46" rx="50" ry="9" class="fill"/>${txt(80, 30, 'EEG cup', 12, 'start', 'muted')}
      ${[0, 1, 2, 3, 4, 5].map((i) => [0, 1].map((j) => `<circle cx="${38 + i * 17 + j * 8}" cy="${80 + j * 18}" r="6"/>`).join('')).join('')}
      ${txt(80, 140, 'murmur murmur', 13, 'middle', 'muted')}
      <path d="M160 14V170" class="muted"/>
      <path d="M232 10V84l4 10 4-10V10"/>${txt(236, 150, 'Neuropixels', 12, 'middle', 'muted')}
      <circle cx="262" cy="106" r="11"/><circle cx="258" cy="104" r="1.5" class="dot"/><circle cx="266" cy="104" r="1.5" class="dot"/><path d="M253 113l-6 10M271 113l6 10"/>
      ${say(256, 46, 54, ['hi.'], 266, 92)}`,
  },
  // the ladder from the scalp into the cortex
  ladder: {
    caption: 'Each rung down gives a cleaner signal and takes more surgery.',
    art: () => `
      <path d="M124 8V172M170 8V172${[24, 56, 88, 120, 152].map((y) => `M124 ${y}H170`).join('')}"/>
      ${txt(182, 28, 'scalp · EEG', 12, 'start', 'muted')}${txt(182, 60, 'surface · ECoG', 12, 'start', 'muted')}${txt(182, 92, 'deep · sEEG', 12, 'start', 'muted')}${txt(182, 124, 'among cells · Utah', 12, 'start', 'muted')}${txt(182, 156, 'every layer · Neuropixels', 12, 'start', 'muted')}
      ${guy(147, 74, { arms: [[-16, -8], [16, -8]], legs: [[-14, 22], [12, 26]] })}
      ${say(8, 22, 104, ['How far down', 'does this go?'], 138, 70)}`,
  },
  // gold blocks the microscope, graphene does not
  graphene: {
    caption: 'Gold electrodes block the microscope’s view. Graphene lets 98% of the light through.',
    art: () => `
      <path d="M160 10V172" class="muted"/>
      <ellipse cx="50" cy="56" rx="16" ry="9"/><circle cx="50" cy="58" r="4" class="dot"/>
      ${say(10, 4, 84, ['I see', 'nothing.'], 50, 46, 12)}
      <rect x="20" y="72" width="120" height="14" class="ink"/>
      <ellipse cx="210" cy="56" rx="16" ry="9"/><circle cx="210" cy="60" r="4" class="dot"/>
      ${say(170, 4, 84, ['Oh hi,', 'neurons!'], 210, 46, 12)}
      <rect x="180" y="72" width="120" height="14" stroke-dasharray="5 5"/>
      ${[40, 80, 120].map((x) => `<circle cx="${x}" cy="128" r="9"/>`).join('')}
      ${[200, 240, 280].map((x) => `<circle cx="${x}" cy="128" r="9"/><circle cx="${x - 3}" cy="126" r="1.4" class="dot"/><circle cx="${x + 3}" cy="126" r="1.4" class="dot"/><path d="M${x + 8} 122l8-10"/>`).join('')}
      ${txt(80, 166, 'gold', 13, 'middle', 'muted')}${txt(240, 166, 'graphene', 13, 'middle', 'muted')}`,
  },
  // ── more chip ──
  // the signal chain as a bucket brigade
  brigade: {
    caption: 'The signal chain is a bucket brigade: amplify, digitise, sort, send. Nobody gets to keep the spike, and everyone gets a cut of the power budget.',
    art: () => `
      ${guy(40, 92, { arms: [[16, 12], [-12, 18]] })}${guy(120, 92, { arms: [[-16, 12], [14, 16]] })}${guy(200, 92)}${guy(280, 92)}
      <path d="M68 108h14l-2 10h-10z"/><path d="M70 104l3-10 3 14 3-5" class="accent"/>
      ${['AMP', 'ADC', 'DSP', 'RADIO'].map((t, i) => txt(40 + i * 80, 172, t, 13, 'middle', 'muted')).join('')}
      ${say(140, 10, 172, ['Pass it on.', 'Don’t drop the bits!'], 126, 78)}`,
  },
  // a spike lost in the noise
  noise: {
    caption: 'A 50 µV spike is easy to lose in the noise. Frankly, it’s a low-resistance way to lose your mind.',
    art: () => {
      let v = 7, d = 'M16 120';
      for (let x = 22; x <= 304; x += 6) { v = (v * 73 + 41) % 101; const y = 120 + ((v % 13) - 6) * 1.4 + (x === 94 ? -16 : x === 100 ? 10 : 0); d += `L${x} ${y.toFixed(1)}`; }
      return `<path d="${d}" class="muted"/>
        ${guy(54, 48, { arms: [[18, 24], [-10, 18]] })}<circle cx="88" cy="96" r="14"/><path d="M78 86l-6-6"/>
        ${say(118, 8, 190, ['Found the spike!', '…no wait, that’s noise.'], 66, 52)}
        ${txt(160, 166, 'signal-to-noise ratio: under negotiation', 12, 'middle', 'muted')}`;
    },
  },
  // compute-in-memory skips the commute
  commute: {
    caption: 'Fetching data from far-away memory is a long, expensive commute. Compute-in-memory lets the data work from home.',
    art: () => `
      <path d="M20 150V102H80V150M14 106L50 74L86 106"/>${txt(50, 134, 'DRAM', 13)}
      <path d="M240 150V102H300V150M234 106L270 74L306 106"/>${txt(270, 134, 'CPU', 13)}
      <path d="M8 150H312" />
      ${guy(160, 90, { arms: [[-10, -14], [10, -14]], legs: [[-12, 24], [10, 26]] })}
      <rect x="144" y="56" width="32" height="18" rx="2" class="fill"/>${txt(160, 70, '32 bits', 11)}
      <path d="M178 88q3 6 0 9q-3-3 0-9"/>
      ${txt(160, 30, 'the 640 pJ commute', 14, 'middle', 'accent')}`,
  },
  // two coils with chemistry
  coils: {
    caption: 'One pair of coils carries the power in and the data out. It’s a close relationship. Mutual, even.',
    art: () => {
      const coil = (x) => [0, 1, 2, 3].map((i) => `<ellipse cx="${x}" cy="${78 + i * 12}" rx="20" ry="6"/>`).join('') + `<path d="M${x - 20} 78V114M${x + 20} 78V114"/>`;
      return `${coil(90)}${coil(230)}
        <circle cx="84" cy="74" r="1.5" class="dot"/><circle cx="96" cy="74" r="1.5" class="dot"/><circle cx="224" cy="74" r="1.5" class="dot"/><circle cx="236" cy="74" r="1.5" class="dot"/>
        <path d="M114 86q46-26 92 0M114 104q46 26 92 0" class="accent" stroke-dasharray="5 5"/>
        ${say(14, 10, 120, ['I feel a', 'connection.'], 88, 66)}
        ${say(186, 10, 124, ['It’s mutual.', '(inductance)'], 232, 66)}
        ${txt(90, 150, 'reader', 13, 'middle', 'muted')}${txt(230, 150, 'implant', 13, 'middle', 'muted')}`;
    },
  },
};

export function doodle(id) {
  const c = COMICS[id];
  if (!c) return '';
  const f = `dw${++uid}`;
  return `<figure class="doodle">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.caption)}">
      <filter id="${f}"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${uid}"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter>
      <g filter="url(#${f})">${c.art()}</g>
    </svg>
    <figcaption>${esc(c.caption)}</figcaption>
  </figure>`;
}
