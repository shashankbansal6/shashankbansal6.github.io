// ─────────────────────────────────────────────────────────────────────────────
// Site content + chip specs. Everything a visitor reads that is *about you*
// lives here so you can edit it without touching the 3D code.
// ─────────────────────────────────────────────────────────────────────────────

// Neural interface SoC (from CV, June 2026). Add `areaMM2` to show density.
export const CHIP = {
  name: 'Neural interface system-on-chip',
  channels: 1024,
  powerPerChannelUW: 1.0, // µW per channel
  nef: 1.8, // noise efficiency factor
  // current test setup
  testbed: '8 × 32-channel chips bonded to one PCB → 256 channels on a custom headstage, recording from behaving mice',
};

// Hoverable functional blocks on the die. Layout is in die coordinates
// (x, z ∈ [-0.5, 0.5]); `rect` = [x0, z0, x1, z1].
export const CHIP_BLOCKS = [
  {
    id: 'array',
    label: 'Recording array',
    rect: [-0.3, -0.34, 0.3, 0.26],
    color: '#3ef0ff',
    lines: () => [
      `Up to ${CHIP.channels.toLocaleString()} low-noise channels`,
      `${CHIP.powerPerChannelUW} µW per channel`,
      `NEF ${CHIP.nef}`,
    ],
  },
  {
    id: 'imp',
    label: 'Impedance monitoring',
    rect: [-0.3, 0.29, 0.3, 0.43],
    color: '#a78bfa',
    lines: () => ['Tracks electrode–tissue impedance', 'Flags degrading contacts during chronic use'],
  },
  {
    id: 'power',
    label: 'Power management',
    rect: [-0.44, -0.34, -0.33, 0.43],
    color: '#ffb547',
    lines: () => ['Regulated supplies for the analog front-ends'],
  },
  {
    id: 'io',
    label: 'Data interface',
    rect: [0.33, -0.34, 0.44, 0.43],
    color: '#ff4fa3',
    lines: () => ['Serializes all channels off-chip', 'Today: wired headstage · next: wireless link'],
  },
  {
    id: 'bias',
    label: 'Bias & references',
    rect: [-0.44, -0.44, 0.44, -0.37],
    color: '#5eead4',
    lines: () => ['Shared biasing keeps per-channel area and power low'],
  },
];

export const totalPowerMW = () => (CHIP.channels * CHIP.powerPerChannelUW) / 1000;

// Sensing modalities. `spatialMM` / `temporalMS` are approximate and drive the
// resolution map; `overlay` is the 3D layer it switches on.
export const MODALITIES = [
  {
    id: 'eeg', name: 'EEG', stream: 'non', overlay: 'eeg', wave: 'eeg',
    full: 'Electroencephalography',
    measures: 'Summed postsynaptic potentials of cortical neurons, through skull and scalp',
    where: 'Scalp cap, 32–256 electrodes',
    spatial: '~1–3 cm', temporal: '~1 ms', spatialMM: 20, temporalMS: 1,
  },
  {
    id: 'meg', name: 'MEG', stream: 'non', overlay: 'meg', wave: 'meg',
    full: 'Magnetoencephalography',
    measures: 'Femtotesla magnetic fields from intracellular currents',
    where: 'SQUID helmet or wearable OPMs',
    spatial: '~3–10 mm', temporal: '~1 ms', spatialMM: 6, temporalMS: 1,
  },
  {
    id: 'hddot', name: 'fNIRS / HD-DOT', stream: 'non', overlay: 'hddot', wave: 'hddot',
    full: 'High-density diffuse optical tomography',
    measures: 'Blood oxygenation (HbO / HbR) from near-infrared light',
    where: 'Optode sources + detectors on scalp',
    spatial: '~1 cm', temporal: '~seconds (hemodynamic)', spatialMM: 12, temporalMS: 2000,
  },
  {
    id: 'semg', name: 'sEMG', stream: 'non', overlay: 'semg', wave: 'semg',
    full: 'Surface electromyography',
    measures: 'Muscle action potentials — the motor command after it leaves the brain',
    where: 'Skin over jaw, face, neck or forearm',
    spatial: 'muscle-level', temporal: '~1 ms', spatialMM: 25, temporalMS: 1, offMap: true,
  },
  {
    id: 'ecog', name: 'ECoG', stream: 'inv', overlay: 'ecog', wave: 'ecog',
    full: 'Electrocorticography',
    measures: 'Local field potentials incl. high-gamma, straight off the cortex',
    where: 'Subdural grid on the cortical surface',
    spatial: '~1–4 mm', temporal: '<1 ms', spatialMM: 2.5, temporalMS: 0.5, labelLeft: true,
  },
  {
    id: 'seeg', name: 'sEEG', stream: 'inv', overlay: 'seeg', wave: 'seeg',
    full: 'Stereo-electroencephalography',
    measures: 'LFPs from deep structures (hippocampus, insula, amygdala)',
    where: 'Depth leads through small burr holes',
    spatial: '~2–5 mm', temporal: '<1 ms', spatialMM: 3.5, temporalMS: 0.5,
  },
  {
    id: 'intra', name: 'Intracortical', stream: 'inv', overlay: 'utah', wave: 'spikes',
    full: 'Utah arrays, Neuropixels & threads',
    measures: 'Single-neuron spikes and LFP',
    where: 'Microelectrodes penetrating cortex',
    spatial: '~50 µm', temporal: '~0.03 ms', spatialMM: 0.05, temporalMS: 0.033,
  },
];

export const PROFILE = {
  name: 'Shashank Bansal',
  native: 'शशांक बंसल',
  email: 'shashankbansal56@gmail.com',
  links: [
    { label: 'CV', href: '/ShashankBansal-CV.pdf' },
    { label: 'GitHub', href: 'https://github.com/shashankbansal6/' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/shashank-bansal-43a9177b/' },
    { label: 'Threads', href: 'https://www.threads.com/@shashank_9543' },
    { label: 'Mastodon', href: 'https://mastodon.social/@shashankb' },
    { label: 'Photos', href: '/photos/' },
  ],
};

export const HONORS = [
  { year: '2026', text: 'Student Paper Award, Neural Systems & Applications TC · IEEE ISCAS 2026 (Shanghai)', img: '/awards/iscas-2026.jpg', alt: 'IEEE ISCAS 2026 Student Paper Award certificate' },
  { year: '2026', text: 'US Patent 12,676,185 granted — energy-efficient compute-in-memory SRAM-C architecture' },
  { year: '2025', text: 'Oral, International Materials Research Congress (Cancún) · 2 posters, SfN' },
  { year: '2023', text: 'Best Poster Award, First Place · IEEE Brain Discovery & Neurotechnology Workshop (Washington, DC)', img: '/awards/ieee-brain-2023.jpg', alt: 'IEEE Brain Best Poster Award, First Place, certificate' },
  { year: '2023', text: 'Telluride Neuromorphic Cognition Engineering Workshop' },
];

const doi = (d) => `https://doi.org/${d}`;
const PATENT_URL = 'https://patents.google.com/patent/US12676185B2/en';

// "What I work on". Each pillar links its paper(s) / patent.
export const RESEARCH = [
  {
    title: 'Neural interfaces & sensors',
    text: 'Nanostructured micropillar and nanoelectrode arrays that capture both spikes and sub-threshold activity, and the circuit models that explain what they record.',
    refs: [
      { kind: 'Paper', label: 'Dynamic spike sorter for multiscale nanoelectrode arrays · Adv. Mater. Interfaces 2025', href: doi('10.1002/admi.202500158') },
      { kind: 'Talk', label: 'Circuit-based characterization of nanostructured micropillars · IMRC 2025 (oral)' },
    ],
  },
  {
    title: 'Neural recording silicon',
    text: 'A neural interface SoC with up to 1,024 channels at 1 µW per channel with NEF 1.8 and on-chip impedance monitoring, now being integrated with transparent Neuro-clear probes.',
    refs: [{ kind: 'In progress', label: 'Neuro-clear: simultaneous electrophysiology + optical recording' }],
  },
  {
    title: 'Compute-in-memory',
    text: 'Adiabatic, energy-recycling charge-redistribution arrays for massively parallel cross-correlation: designed, verified and taped out.',
    refs: [
      { kind: 'Paper', label: 'Adiabatic energy-recycling charge-redistribution array · ISCAS 2026 · Student Paper Award (NSA TC)', href: doi('10.1109/iscas66217.2026.11562109') },
      { kind: 'Patent', label: 'US 12,676,185 B2 · Energy-efficient CIM SRAM-C circuit architecture', href: PATENT_URL },
      { kind: 'Paper', label: 'Where to cut: ADC quantization for analog in-memory computing · ISCAS 2025', href: doi('10.1109/iscas56072.2025.11043960') },
    ],
  },
  {
    title: 'Neuromorphic systems & decoding',
    text: 'Event-driven spiking hardware for large-scale SNNs, and passive BCIs that read motor-error signatures from EEG.',
    refs: [
      { kind: 'Paper', label: 'Reconfigurable event-driven spiking computing near HBM · BioCAS 2023', href: doi('10.1109/biocas58349.2023.10388692') },
      { kind: 'Code', label: 'HiAER-Spike toolkit', href: 'https://integrated-systems-neuroengineering.github.io/hiaer-spike/' },
      { kind: 'Poster', label: 'Wired for Oops: neural correlates of loss of control · IEEE Brain 2023 · Best Poster' },
    ],
  },
];

export const PUBLICATIONS = [
  { year: 2026, title: 'Adiabatic Energy-Recycling Charge-Redistribution Array for Ultra-Low Power Massively Parallel Cross-Correlation', authors: '<b>S. Bansal</b>, P. G. Hogganvik, S. Jain, G. Hota, et al.', venue: 'IEEE ISCAS 2026 · Student Paper Award, NSA TC', href: doi('10.1109/iscas66217.2026.11562109') },
  { type: 'patent', year: 2026, title: 'Energy Efficient Compute-in-Memory SRAM-C Circuit Architecture', authors: '<b>S. Bansal</b>, B. Cherif, G. Cauwenberghs, G. Hota, S. Jain', venue: 'US Patent 12,676,185 B2', href: PATENT_URL },
  { year: 2025, title: 'A Dynamic Spike Sorter for Multiscale Nanoelectrode Array Recordings', authors: 'S. Shukla, C. Walsh, <b>S. Bansal</b>, J. Leugering, et al.', venue: 'Advanced Materials Interfaces', href: doi('10.1002/admi.202500158') },
  { year: 2025, title: 'Where to Cut: Efficient ADC Quantization for Analog In-Memory Computing with Discrete Values', authors: 'J. Leugering, <b>S. Bansal</b>, Z. Liu, J. Song, et al.', venue: 'IEEE ISCAS 2025', href: doi('10.1109/iscas56072.2025.11043960') },
  { year: 2025, title: 'A Highly PVT Invariant Low Power Scalable Analog Dynamic Current-Mode Translinear Matrix-Vector Multiplier', authors: 'G. Gennis, B. Cherif, <b>S. Bansal</b>, J. Song, et al.', venue: 'IEEE ISCAS 2025', href: doi('10.1109/iscas56072.2025.11043721') },
  { year: 2024, title: 'The Past, Present, and Future of the Brain Imaging Data Structure (BIDS)', authors: 'R. Poldrack, … <b>S. Bansal</b>, et al.', venue: 'Imaging Neuroscience', href: doi('10.1162/imag_a_00103') },
  { year: 2023, title: 'Reconfigurable Event-Driven Spiking Neuromorphic Computing near High-Bandwidth Memory', authors: 'G. Hota, G. Frank, K. Wang, A. Uppal, O. Olajide, J. Liu, <b>S. Bansal</b>, et al.', venue: 'IEEE BioCAS 2023', href: doi('10.1109/biocas58349.2023.10388692') },
  { year: 2021, title: 'High-Sensitivity Detection of Facial Features on MRI Brain Scans with a Convolutional Network', authors: '<b>S. Bansal</b>, A. Kori, et al.', venue: 'bioRxiv', href: doi('10.1101/2021.04.25.441373') },
];

export const EXPERIENCE = [
  {
    when: 'Sep 2022 — now',
    title: 'PhD Candidate & Graduate Student Researcher',
    org: 'Integrated Systems Neuroengineering Lab, UC San Diego',
    url: 'https://isn.ucsd.edu/',
    logo: '/logos/ucsd.png',
    who: 'Prof. Gert Cauwenberghs',
    email: 'shbansal@ucsd.edu',
    notes: ['Neuro-clear neural interface SoC', 'Massive Cross-Correlation (MAX) · taped out', 'HiAER-Spike', 'Lead TA, BENG 216'],
  },
  {
    when: 'Jul 2025 — Jan 2026',
    title: 'Founding Engineer',
    org: 'Qernel.AI',
    url: 'https://www.qernel.ai',
    logo: '/logos/qernel.png',
    notes: ['Compute-in-memory accelerator for LLM attention', 'RTL → verification → FPGA'],
  },
  {
    when: 'Sep 2019 — Jun 2022',
    title: 'Research Assistant',
    org: 'Poldrack Lab, Stanford University',
    url: 'https://poldracklab.stanford.edu/',
    logo: '/logos/stanford.png',
    who: 'Prof. Russell Poldrack',
    notes: ['Non-defaced detector', 'BIDS Stats Models', 'FitLins'],
  },
  {
    when: 'Aug 2019 — Jun 2022',
    title: 'Systems Software Engineer II',
    org: 'NVIDIA',
    url: 'https://www.nvidia.com/',
    logo: '/logos/nvidia.png',
    notes: ['Infrastructure modeling for autonomous network management', 'Fleet telemetry platform'],
  },
  {
    when: 'Aug 2015 — May 2019',
    title: 'B.S. Computer Engineering, with Honors',
    org: 'University of Illinois Urbana-Champaign',
    url: 'https://ece.illinois.edu/',
    logo: '/logos/illinois.png',
    notes: ['TA: Computer Security, Digital Forensics', 'Director, IEEE Technical Events', 'James Scholar'],
  },
  {
    when: 'May 2017 — May 2018',
    title: 'Research Assistant',
    org: 'NCSA & Atmospheric Sciences, UIUC',
    url: 'https://www.ncsa.illinois.edu/',
    logo: '/logos/illinois.png',
    who: 'Prof. Larry Di Girolamo',
    notes: ['NASA Terra Data Fusion on Blue Waters'],
  },
];
