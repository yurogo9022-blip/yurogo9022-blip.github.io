// ============================================================
//  組態設定
// ============================================================
const CONFIG = {
  gridSize: 3,
  gameDuration: 30,
  initialSpawnInterval: 1200,
  minSpawnInterval: 350,
  initialMoleDuration: 1500,
  minMoleDuration: 400,
  difficultyStep: 50,
  pointsPerHit: 10,
  maxConcurrentStart: 1,
  maxConcurrentEnd: 4,
  leaderboardSize: 10,
};

// ============================================================
//  狀態
// ============================================================
const state = {
  score: 0,
  timeLeft: CONFIG.gameDuration,
  isPlaying: false,
  holes: [],
  activeMoles: new Set(),
  spawnTimer: null,
  countdownTimer: null,
  difficultyLevel: 0,
};

// ============================================================
//  DOM 參考
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  board: $('#gameBoard'),
  score: $('#score'),
  timer: $('#timer'),
  startBtn: $('#startBtn'),
  restartBtn: $('#restartBtn'),
  closeModalBtn: $('#closeModalBtn'),
  modalOverlay: $('#modalOverlay'),
  finalScore: $('#finalScore'),
  newRecord: $('#newRecord'),
  leaderboard: $('#leaderboardList'),
  difficulty: $('#difficulty'),
  clearScoresBtn: $('#clearScoresBtn'),
};

// ============================================================
//  音效
// ============================================================
function playAudio(src) {
  try {
    const audio = new Audio(src);
    audio.volume = 0.3;
    audio.currentTime = 0;
    audio.play();
  } catch (e) { /* 靜默 */ }
}

function playWhackSound() {
  playAudio('assets/太離譜了.ogg');
}

function playHammerSound() {
  playAudio('assets/槌子.ogg');
}

function playGameOverSound() {
  playAudio('assets/議事鈴聲.ogg');
}

// ============================================================
//  圖片載入偵測（自訂貼圖支援）
// ============================================================
let useMoleImage = false;

function checkCustomImages() {
  const img = new Image();
  const apply = () => {
    useMoleImage = true;
    document.querySelectorAll('.mole').forEach(el => {
      el.classList.add('mole-use-image');
    });
  };
  img.onload = apply;
  img.onerror = () => { useMoleImage = false; };
  img.src = 'assets/mole.png';
  if (img.complete && img.naturalWidth > 0) apply();

  // 自訂游標（旋轉 -45 度）
  const cursorSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cpath d='M20 14 C20 2, 44 2, 44 14 C44 22, 32 26, 32 28' fill='none' stroke='%231a1a1a' stroke-width='6' stroke-linecap='round'/%3E%3Crect x='28' y='26' width='8' height='4' rx='1' fill='%23D4A853'/%3E%3Cpath d='M32 30 L32 54' fill='none' stroke='%231a1a1a' stroke-width='4' stroke-linecap='round'/%3E%3Cellipse cx='32' cy='58' rx='4' ry='3' fill='%23333'/%3E%3C/svg%3E") 32 58, pointer`;

  let baseCursor = cursorSvg;
  let baseCursorImg = null;

  function setCursor(url) {
    document.documentElement.style.setProperty('--cursor', url);
  }

  function rotateCursor(img, extraAngle) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.translate(size / 2, size / 2);
    ctx.rotate(-Math.PI / 4 + (extraAngle || 0));
    const s = size * Math.SQRT1_2;
    ctx.drawImage(img, -s / 2, -s / 2, s, s);
    return `url('${canvas.toDataURL()}') 32 58, pointer`;
  }

  function loadCursor() {
    const cursor = new Image();
    cursor.onload = () => {
      baseCursorImg = cursor;
      baseCursor = rotateCursor(cursor, 0);
      setCursor(baseCursor);
    };
    cursor.onerror = () => { setCursor(cursorSvg); };
    cursor.src = 'assets/cursor.png';
  }

  loadCursor();

  // 點擊左鍵時游標逆時針旋轉 45 度
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (baseCursorImg) {
      setCursor(rotateCursor(baseCursorImg, -Math.PI / 4));
    }
  });
  document.addEventListener('mouseup', () => {
    setCursor(baseCursor);
  });
}

// ============================================================
//  建立遊戲面板
// ============================================================
function buildBoard() {
  dom.board.innerHTML = '';
  state.holes = [];

  for (let i = 0; i < CONFIG.gridSize * CONFIG.gridSize; i++) {
    const cell = document.createElement('div');
    cell.className = 'hole';
    cell.dataset.index = i;

    // Podium（質詢台，放在地鼠前方）
    const podium = document.createElement('div');
    podium.className = 'podium';

    const podiumTop = document.createElement('div');
    podiumTop.className = 'podium-top';
    podium.appendChild(podiumTop);

    const podiumBody = document.createElement('div');
    podiumBody.className = 'podium-body';

    const podiumText = document.createElement('div');
    podiumText.className = 'podium-text';
    podiumText.innerHTML = '立法院<br>質詢台';
    podiumBody.appendChild(podiumText);

    podium.appendChild(podiumBody);

    const podiumBase = document.createElement('div');
    podiumBase.className = 'podium-base';
    podium.appendChild(podiumBase);

    const podiumMic = document.createElement('div');
    podiumMic.className = 'podium-mic';
    podium.appendChild(podiumMic);

    cell.appendChild(podium);

    // 地鼠（在質詢台後方）
    const mole = document.createElement('div');
    mole.className = 'mole';
    mole.dataset.holeIndex = i;

    const body = document.createElement('div');
    body.className = 'mole-body';

    const face = document.createElement('div');
    face.className = 'mole-face';

    for (const side of ['left', 'right']) {
      const eye = document.createElement('div');
      eye.className = `mole-eye ${side}`;
      face.appendChild(eye);
    }

    const nose = document.createElement('div');
    nose.className = 'mole-nose';
    face.appendChild(nose);

    for (const side of ['left', 'right']) {
      const whisker = document.createElement('div');
      whisker.className = `mole-whisker ${side}`;
      face.appendChild(whisker);
    }

    body.appendChild(face);
    mole.appendChild(body);
    cell.appendChild(mole);

    cell.addEventListener('click', () => whackMole(i));

    dom.board.appendChild(cell);
    state.holes.push({ element: cell, moleEl: mole, isUp: false, timeoutId: null });
  }

  if (useMoleImage) {
    document.querySelectorAll('.mole').forEach(el => el.classList.add('mole-use-image'));
  }
}

// ============================================================
//  難度計算
// ============================================================
function getDifficulty(score) {
  const level = Math.floor(score / CONFIG.difficultyStep);
  return {
    level,
    spawnInterval: Math.max(
      CONFIG.minSpawnInterval,
      CONFIG.initialSpawnInterval - level * 120
    ),
    moleDuration: Math.max(
      CONFIG.minMoleDuration,
      CONFIG.initialMoleDuration - level * 150
    ),
    maxConcurrent: Math.min(
      CONFIG.maxConcurrentStart + Math.floor(level / 2),
      CONFIG.maxConcurrentEnd
    ),
  };
}

function updateDifficultyDisplay() {
  dom.difficulty.textContent = `難度: Lv.${state.difficultyLevel + 1}`;
}

// ============================================================
//  生成地鼠
// ============================================================
function spawnMole() {
  if (!state.isPlaying) return;

  const diff = getDifficulty(state.score);
  state.difficultyLevel = diff.level;
  updateDifficultyDisplay();

  // 找出可用的洞（沒有地鼠的）
  const available = state.holes
    .map((h, i) => ({ ...h, index: i }))
    .filter(h => !h.isUp);

  if (available.length === 0) return;

  // 計算本次要產生幾隻
  const activeCount = state.activeMoles.size;
  const toSpawn = Math.min(diff.maxConcurrent - activeCount, available.length, 1 + Math.floor(Math.random() * 2));

  for (let s = 0; s < toSpawn; s++) {
    if (available.length === 0) break;
    const pick = Math.floor(Math.random() * available.length);
    const hole = available.splice(pick, 1)[0];

    if (!hole.isUp && state.isPlaying) {
      showMole(hole.index, diff.moleDuration);
    }
  }

  // 排程下一波
  clearTimeout(state.spawnTimer);
  state.spawnTimer = setTimeout(spawnMole, diff.spawnInterval);
}

function showMole(index, duration) {
  const hole = state.holes[index];
  if (!hole || hole.isUp) return;

  hole.isUp = true;
  hole.moleEl.classList.remove('hit');
  // 強制 reflow 確保重播動畫
  void hole.moleEl.offsetWidth;
  hole.moleEl.classList.add('active');
  state.activeMoles.add(index);

  // 自動縮回
  hole.timeoutId = setTimeout(() => {
    hideMole(index);
  }, duration);
}

function hideMole(index) {
  const hole = state.holes[index];
  if (!hole || !hole.isUp) return;

  hole.isUp = false;
  hole.moleEl.classList.remove('active', 'hit');
  state.activeMoles.delete(index);
  clearTimeout(hole.timeoutId);
  hole.timeoutId = null;
}

// ============================================================
//  打地鼠！
// ============================================================
function whackMole(index) {
  if (!state.isPlaying) return;

  const hole = state.holes[index];
  if (!hole || !hole.isUp) return;

  // 立即標記為已打（防止重複得分）
  hole.isUp = false;
  state.activeMoles.delete(index);
  clearTimeout(hole.timeoutId);

  // 得分
  state.score += CONFIG.pointsPerHit;
  updateScoreDisplay();

  // 動畫與音效
  hole.moleEl.classList.add('hit');
  playWhackSound();

  // 動畫結束後隱藏
  setTimeout(() => {
    hole.moleEl.classList.remove('active', 'hit');
  }, 80);
}

// ============================================================
//  UI 更新
// ============================================================
function updateScoreDisplay() {
  dom.score.textContent = state.score;
}

function updateTimerDisplay() {
  dom.timer.textContent = state.timeLeft;
}

// ============================================================
//  倒數計時
// ============================================================
function startCountdown() {
  state.timeLeft = CONFIG.gameDuration;
  updateTimerDisplay();

  state.countdownTimer = setInterval(() => {
    state.timeLeft--;
    updateTimerDisplay();

    if (state.timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

// ============================================================
//  開始 / 結束遊戲
// ============================================================
function startGame() {
  if (state.isPlaying) return;

  // 重置
  state.isPlaying = true;
  state.score = 0;
  state.difficultyLevel = 0;
  state.activeMoles.clear();

  // 隱藏所有地鼠
  state.holes.forEach((_, i) => {
    hideMole(i);
  });

  updateScoreDisplay();
  updateDifficultyDisplay();
  dom.startBtn.disabled = true;
  dom.startBtn.textContent = '遊戲中...';
  dom.modalOverlay.classList.add('hidden');

  // 啟動
  startCountdown();
  spawnMole();
}

function endGame() {
  state.isPlaying = false;
  clearInterval(state.countdownTimer);
  clearTimeout(state.spawnTimer);

  // 隱藏所有地鼠
  state.holes.forEach((_, i) => hideMole(i));

  dom.startBtn.disabled = false;
  dom.startBtn.textContent = '開始遊戲';

  playGameOverSound();

  // 顯示結果
  dom.finalScore.textContent = state.score;

  const isNewRecord = saveScore(state.score);
  dom.newRecord.classList.toggle('hidden', !isNewRecord);

  renderLeaderboard();
  dom.modalOverlay.classList.remove('hidden');
}

// ============================================================
//  排行榜 (localStorage)
// ============================================================
function getLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem('whackMoleLeaderboard')) || [];
  } catch {
    return [];
  }
}

function saveScore(score) {
  if (score === 0) return false;

  const board = getLeaderboard();
  const entry = {
    score,
    date: new Date().toLocaleDateString('zh-TW'),
  };

  board.push(entry);
  board.sort((a, b) => b.score - a.score);
  const trimmed = board.slice(0, CONFIG.leaderboardSize);
  localStorage.setItem('whackMoleLeaderboard', JSON.stringify(trimmed));

  // 檢查是否為新紀錄（第一名）
  return trimmed.length === 1 || (trimmed[0].score === score && trimmed[0].date === entry.date);
}

function renderLeaderboard() {
  const board = getLeaderboard();
  dom.leaderboard.innerHTML = '';

  if (board.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '暫無記錄';
    dom.leaderboard.appendChild(li);
    return;
  }

  board.forEach(entry => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${entry.score} 分</span>
      <span class="date-entry">${entry.date}</span>
    `;
    dom.leaderboard.appendChild(li);
  });
}

function clearLeaderboard() {
  localStorage.removeItem('whackMoleLeaderboard');
  renderLeaderboard();
}

// ============================================================
//  初始化
// ============================================================
function init() {
  buildBoard();
  checkCustomImages();
  renderLeaderboard();
  updateTimerDisplay();
  updateScoreDisplay();
  updateDifficultyDisplay();

  // 事件綁定
  dom.startBtn.addEventListener('click', startGame);
  dom.restartBtn.addEventListener('click', () => {
    dom.modalOverlay.classList.add('hidden');
    startGame();
  });
  dom.closeModalBtn.addEventListener('click', () => {
    dom.modalOverlay.classList.add('hidden');
  });
  dom.clearScoresBtn.addEventListener('click', clearLeaderboard);

  // 點擊遮罩關閉 modal
  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) {
      dom.modalOverlay.classList.add('hidden');
    }
  });

  // 空點游標時播放槌子音效
  dom.board.addEventListener('click', () => {
    if (state.isPlaying) playHammerSound();
  });
}

// 等待 DOM 準備就緒
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
