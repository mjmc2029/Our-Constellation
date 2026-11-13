function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const portraitQuery = window.matchMedia('(orientation: portrait)');

// Stars march along the screen's long axis (left→right on wide screens,
// top→bottom on phones) so 14+ stars keep a comfortable tap distance.
// A fresh seeded RNG per call keeps each orientation's layout stable.
function layoutStars(list, portrait) {
  const rand = mulberry32(20250709);
  const n = list.length;
  const [mainLo, mainHi] = portrait ? [7, 87] : [6, 94];     // leave room for the progress text
  const [crossLo, crossHi] = portrait ? [12, 88] : [14, 78];
  const amp = portrait ? 30 : 26;
  const band = (mainHi - mainLo) / n;
  const points = [];

  for (let i = 0; i < n; i++) {
    const baseMain = mainLo + band * i + band / 2;
    const main = baseMain + (rand() - 0.5) * band * 0.45;

    const wander = Math.sin(i * 1.35 + 0.6) * amp;
    let cross = Math.min(crossHi, Math.max(crossLo, 50 + wander + (rand() - 0.5) * 16));

    // nudge across the path if too close to an earlier star
    for (let tries = 0; tries < 5; tries++) {
      const tooClose = points.some((p) => Math.hypot(p.main - main, p.cross - cross) < 11);
      if (!tooClose) break;
      cross = Math.min(crossHi, Math.max(crossLo, cross + (tries % 2 === 0 ? 16 : -16)));
    }
    points.push({ main, cross });
  }
  return points.map(({ main, cross }) => (portrait ? { x: cross, y: main } : { x: main, y: cross }));
}

let positions = layoutStars(moments, portraitQuery.matches);
const visited = new Set();
const drawnSegments = new Set();
let finaleShown = false;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const skyEl = document.getElementById('sky');
const bgStarsEl = document.getElementById('bgStars');
const linesLayerEl = document.getElementById('linesLayer');
const starsLayerEl = document.getElementById('starsLayer');
const progressEl = document.getElementById('progress');
const overlayEl = document.getElementById('overlay');
const photoFanEl = document.getElementById('photoFan');
const cardBodyEl = document.getElementById('cardBody');
const cardDateEl = document.getElementById('cardDate');
const cardTitleEl = document.getElementById('cardTitle');
const cardCaptionEl = document.getElementById('cardCaption');
const closeBtnEl = document.getElementById('closeBtn');
const finaleEl = document.getElementById('finale');
const finaleMessageEl = document.getElementById('finaleMessage');
const replayBtnEl = document.getElementById('replayBtn');
const shootingStarEl = document.getElementById('shootingStar');

function buildBackgroundStars() {
  bgStarsEl.innerHTML = '';
  const count = 130;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'bg-star';
    const size = (Math.random() * 1.6 + 0.6).toFixed(2);
    s.style.left = (Math.random() * 100).toFixed(2) + '%';
    s.style.top = (Math.random() * 100).toFixed(2) + '%';
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.animationDuration = (2 + Math.random() * 3.5).toFixed(2) + 's';
    s.style.animationDelay = (Math.random() * 5).toFixed(2) + 's';
    frag.appendChild(s);
  }
  bgStarsEl.appendChild(frag);
}

function buildLines() {
  linesLayerEl.innerHTML = '';
  for (let i = 0; i < positions.length - 1; i++) {
    const a = positions[i], b = positions[i + 1];
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('pathLength', '100');
    line.setAttribute('class', 'line');
    line.dataset.segment = i;
    linesLayerEl.appendChild(line);
  }
}

function buildStars() {
  starsLayerEl.innerHTML = '';
  moments.forEach((m, i) => {
    const p = positions[i];
    const btn = document.createElement('button');
    btn.className = 'star';
    btn.style.left = p.x + '%';
    btn.style.top = p.y + '%';
    btn.setAttribute('aria-label', m.date + ': ' + (m.title === 'REPLACE' ? 'a moment' : m.title));
    btn.dataset.index = i;

    const core = document.createElement('span');
    core.className = 'star-core';
    core.style.animationDelay = (i * 0.35).toFixed(2) + 's';
    btn.appendChild(core);

    btn.addEventListener('click', () => openCard(i));
    starsLayerEl.appendChild(btn);
  });
}

// Tapping a photo pops it up full size with its own caption
// (m.photoCaptions[i]); the chapter's description stays on the card underneath.
let currentMoment = null;
const lightboxEl = document.getElementById('lightbox');
const lightboxImgEl = document.getElementById('lightboxImg');
const lightboxCaptionEl = document.getElementById('lightboxCaption');

function openPhoto(i) {
  const m = currentMoment;
  const caption = (m.photoCaptions && m.photoCaptions[i]) || '';
  lightboxImgEl.src = m.images[i];
  lightboxImgEl.alt = caption || m.title;
  lightboxCaptionEl.textContent = caption;
  lightboxCaptionEl.hidden = !caption;
  lightboxEl.classList.add('open');
  const hint = photoFanEl.querySelector('.fan-hint');
  if (hint) hint.classList.add('done');
}

function closePhoto() {
  lightboxEl.classList.remove('open');
}

lightboxEl.addEventListener('click', closePhoto);

function buildFan(images, altBase) {
  photoFanEl.innerHTML = '';
  const n = images.length;
  const step = n >= 5 ? 8 : n === 4 ? 10 : 12; 
  const mid = (n - 1) / 2;

  images.forEach((src, i) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.style.setProperty('--fr', ((i - mid) * step).toFixed(2) + 'deg');
    card.style.transitionDelay = (i * 0.1).toFixed(2) + 's';
    card.style.zIndex = i + 1;

    const img = document.createElement('img');
    img.src = src;
    img.alt = n > 1 ? `${altBase} — photo ${i + 1} of ${n}` : altBase;
    card.appendChild(img);

    card.addEventListener('click', () => openPhoto(i));
    photoFanEl.appendChild(card);
  });

  {
    const hint = document.createElement('p');
    hint.className = 'fan-hint';
    hint.textContent = n > 1 ? 'tap a photo' : 'tap the photo';
    photoFanEl.appendChild(hint);
  }

  // force the "in the deck" starting styles to be computed, then deal
  // (setTimeout is sturdier than rAF — it fires even between paints)
  void photoFanEl.offsetWidth;
  setTimeout(() => {
    photoFanEl.querySelectorAll('.photo-card').forEach((c) => c.classList.add('dealt'));
  }, 30);
}

function openCard(index) {
  const m = moments[index];
  currentMoment = m;

  cardDateEl.textContent = m.date;
  cardTitleEl.textContent = m.title;
  cardCaptionEl.textContent = m.caption;

  const images = m.images || [];
  photoFanEl.classList.toggle('hidden', images.length === 0);
  cardBodyEl.classList.toggle('no-photo', images.length === 0);
  if (images.length > 0) buildFan(images, m.title === 'REPLACE' ? m.date : m.title);

  overlayEl.classList.add('open');

  markVisited(index);
}

function closeCard() {
  closePhoto();
  overlayEl.classList.remove('open');
  // give the close animation a moment before checking the finale
  setTimeout(() => {
    if (visited.size === moments.length && !finaleShown) showFinale();
  }, 350);
}

closeBtnEl.addEventListener('click', closeCard);
overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) closeCard(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (lightboxEl.classList.contains('open')) closePhoto();       // photo first, then the card
    else if (overlayEl.classList.contains('open')) closeCard();
    if (finaleEl.classList.contains('open')) { /* stays until replay, by design */ }
  }
});

function markVisited(index) {
  if (visited.has(index)) return;
  visited.add(index);
  starsLayerEl.children[index].classList.add('visited');
  updateProgress();
  checkSegments();
}

// The first chapter (through "One month") starts out already found and
// connected; the visitor picks up from the fall stars onward.
const BASELINE = 8;
function applyBaseline(lineDelay) {
  for (let i = 0; i < BASELINE; i++) {
    visited.add(i);
    starsLayerEl.children[i].classList.add('visited');
  }
  updateProgress();
  setTimeout(checkSegments, lineDelay); // delay lets the lines animate in
}

function checkSegments() {
  const lines = linesLayerEl.querySelectorAll('.line');
  lines.forEach((line) => {
    const seg = Number(line.dataset.segment);
    if (drawnSegments.has(seg)) return;
    if (visited.has(seg) && visited.has(seg + 1)) {
      drawnSegments.add(seg);
      line.classList.add('drawn');
    }
  });
}

function updateProgress() {
  progressEl.textContent = `${visited.size} of ${moments.length} stars found`;
}

/* ====================================================================
   FINALE
   ==================================================================== */
function showFinale() {
  finaleShown = true;
  finaleMessageEl.textContent = finalMessage;

  skyEl.classList.add('finale-pulse');
  bgStarsEl.classList.add('brighten');
  setTimeout(() => {
    skyEl.classList.remove('finale-pulse');
    bgStarsEl.classList.remove('brighten');
  }, 2000);

  setTimeout(() => finaleEl.classList.add('open'), reduceMotion ? 100 : 900);
}

replayBtnEl.addEventListener('click', resetExperience);

function resetExperience() {
  visited.clear();
  drawnSegments.clear();
  finaleShown = false;

  finaleEl.classList.remove('open');
  overlayEl.classList.remove('open');

  Array.from(starsLayerEl.children).forEach((el) => el.classList.remove('visited'));

  const lines = linesLayerEl.querySelectorAll('.line');
  lines.forEach((line) => line.classList.remove('drawn'));

  updateProgress();
  applyBaseline(60);
}

/* ====================================================================
   SHOOTING STAR — every 20-30s, skipped for reduced-motion users
   ==================================================================== */
function launchShootingStar() {
  const startX = Math.random() * 60;
  const startY = Math.random() * 40;
  const dx = 40 + Math.random() * 50;
  const dy = 20 + Math.random() * 40;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  shootingStarEl.style.left = startX + 'vw';
  shootingStarEl.style.top = startY + 'vh';
  shootingStarEl.style.transform = `rotate(${angle}deg)`;
  shootingStarEl.style.setProperty('--sx', dx + 'vw');
  shootingStarEl.style.setProperty('--sy', dy + 'vh');
  shootingStarEl.style.setProperty('--sa', angle + 'deg');

  shootingStarEl.classList.remove('active');
  void shootingStarEl.offsetWidth; // restart animation
  shootingStarEl.classList.add('active');
}

function scheduleShootingStar() {
  const delay = 20000 + Math.random() * 10000;
  setTimeout(() => {
    launchShootingStar();
    scheduleShootingStar();
  }, delay);
}

/* ====================================================================
   INIT
   ==================================================================== */
buildBackgroundStars();
buildLines();
buildStars();
updateProgress();
applyBaseline(reduceMotion ? 0 : 700);
if (!reduceMotion) scheduleShootingStar();

// Re-lay the constellation on rotate, keeping found stars and drawn lines.
portraitQuery.addEventListener('change', (e) => {
  positions = layoutStars(moments, e.matches);
  buildLines();
  buildStars();
  visited.forEach((i) => starsLayerEl.children[i].classList.add('visited'));
  linesLayerEl.querySelectorAll('.line').forEach((line) => {
    if (drawnSegments.has(Number(line.dataset.segment))) line.classList.add('drawn');
  });
});
