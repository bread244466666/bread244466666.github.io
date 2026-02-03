<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Mini Game Arcade – Password Protected</title>

<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XG59Q3C7MW"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XG59Q3C7MW');
</script>

<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5757280493155757"
     crossorigin="anonymous"></script>
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-5757280493155757"
     data-ad-slot="4821100611"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>
     (adsbygoogle = window.adsbygoogle || []).push({});
</script>

<style>
  body { margin:0; font-family:Arial, Helvetica, sans-serif; background:#020617; color:#e5e7eb; min-height:100vh; }
  header { padding:30px; text-align:center; background:linear-gradient(135deg,#2563eb,#4f46e5); }
  #password-screen, #name-screen {
    position:fixed; inset:0; background:#020617; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:20px; z-index:100;
  }
  #password-screen.hidden, #name-screen.hidden { display:none; }
  input[type="password"], input[type="text"] {
    padding:14px 18px; font-size:1.2rem; width:320px; max-width:90%; border-radius:8px;
    border:2px solid #4f46e5; background:#1e293b; color:white;
  }
  button.unlock-btn { padding:14px 40px; font-size:1.2rem; background:#2563eb; color:white; border:none; border-radius:8px; cursor:pointer; }
  button.unlock-btn:hover { background:#1d4ed8; }
  .error-msg { color:#ef4444; font-size:1.1rem; min-height:1.5em; }
  nav { display:flex; justify-content:center; gap:15px; padding:15px; background:#020617; border-bottom:1px solid #1e293b; flex-wrap:wrap; }
  nav button { padding:10px 18px; border:none; border-radius:8px; background:#1e40af; color:white; cursor:pointer; font-size:0.95rem; }
  nav button:hover { background:#1d4ed8; }
  main { max-width:960px; margin:30px auto; padding:0 20px; }
  .game { display:none; background:#020617; border-radius:14px; padding:24px; box-shadow:0 10px 30px rgba(0,0,0,0.5); }
  canvas { display:block; margin:20px auto; background:black; border-radius:10px; }
  button.action { padding:10px 20px; border:none; border-radius:8px; background:#2563eb; color:white; cursor:pointer; margin-top:10px; }
  #game2048 { display:block; margin:20px auto; width:400px; height:400px; position:relative; background:#111827; border-radius:10px; }
  .tile { width:90px; height:90px; position:absolute; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:bold; border-radius:10px; color:white; transition:all 0.15s ease; }
  .leaderboard h2 { color:#60a5fa; margin-top:30px; }
  table { width:100%; border-collapse:collapse; margin:16px 0; background:#1e293b; border-radius:10px; overflow:hidden; }
  th, td { padding:12px 16px; text-align:left; border-bottom:1px solid #334155; }
  th { background:#0f172a; color:#94a3b8; text-transform:uppercase; font-size:0.9rem; letter-spacing:0.5px; }
  .rank { width:70px; font-weight:bold; color:#fbbf24; font-size:1.1rem; }
  .score { text-align:right; font-weight:bold; color:#60a5fa; font-size:1.1rem; }
  tr:hover { background:#253549; }
  .empty-msg, .loading-msg { text-align:center; padding:30px; color:#64748b; font-style:italic; }

  /* ─── Music Game Styles ─── */
  #music .keys {
    display: flex;
    justify-content: center;
    gap: 30px;
    margin: 60px 0;
    flex-wrap: wrap;
  }
  #music .key {
    width: 90px;
    height: 140px;
    background: #1e293b;
    border: 3px solid #4f46e5;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    font-weight: bold;
    color: #60a5fa;
    transition: all 0.12s ease;
    user-select: none;
  }
  #music .key small {
    font-size: 1rem;
    color: #94a3b8;
    margin-top: 8px;
  }
  #music .key.active {
    background: #7c3aed;
    transform: scale(1.08);
    box-shadow: 0 0 30px #7c3aed88;
    color: white;
  }
  #music .key.next {
    border-color: #fbbf24;
    box-shadow: 0 0 15px #fbbf2488;
    color: #fbbf24;
  }
  #music .hint {
    text-align: center;
    color: #94a3b8;
    font-size: 1.1rem;
    margin: 20px 0;
  }
  #music .status-msg {
    text-align: center;
    font-size: 1.2rem;
    color: #60a5fa;
    margin: 20px 0;
    min-height: 1.5em;
  }
</style>
</head>
<body>

<!-- Password screen -->
<div id="password-screen">
  <h2>Enter Password</h2>
  <input type="password" id="password-input" placeholder="Password..." autofocus>
  <button class="unlock-btn" id="unlock-password">Unlock</button>
  <div id="password-error" class="error-msg"></div>
</div>

<!-- Name screen -->
<div id="name-screen" class="hidden">
  <h2>Enter Your Name</h2>
  <input type="text" id="name-input" placeholder="Your name..." autofocus>
  <button class="unlock-btn" id="unlock-name">Play</button>
  <div id="name-error" class="error-msg"></div>
</div>

<!-- Main content -->
<div id="main-content" style="display:none;">
  <header>
    <h1>🎮 Mini Game Arcade</h1>
    <p id="welcome-message">Welcome, <span id="player-name">Guest</span>!</p>
    <p>Use <strong>W A S D</strong> • Space = shoot (Alien only) • A S D F = notes (Music)</p>
    <iframe width="500" height="300" src="https://www.youtube.com/embed/xevfX_B1Lbw" title="TheFatRat - Unity No Vocals 1 Hour" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
  </header>

  <nav>
    <button onclick="showGame('home')">Home</button>
    <button onclick="showGame('dodge')">Dodge</button>
    <button onclick="showGame('snake')">Snake</button>
    <button onclick="showGame('game2048')">2048</button>
    <button onclick="showGame('alien')">Alien Shooter</button>
    <button onclick="showGame('music')">Music</button>
    <button onclick="showGame('leaderboard')">Leaderboard</button>
  </nav>

  <main>
    <section id="home" class="game" style="display:block">
      <h2>Welcome, <span id="player-name-home">Guest</span>!</h2>
      <p>Play any game → your score will appear on the global leaderboard!</p>
    </section>

    <section id="dodge" class="game">
      <h2>Dodge the Blocks</h2>
      <canvas id="dodgeGame" width="400" height="450"></canvas>
      <button class="action" onclick="startDodge()">Start / Restart</button>
      <p id="dodgeScore">Score: 0</p>
    </section>

    <section id="snake" class="game">
      <h2>Snake</h2>
      <canvas id="snakeGame" width="400" height="400"></canvas>
      <button class="action" onclick="startSnake()">Start / Restart</button>
    </section>

    <section id="game2048" class="game">
      <h2>2048</h2>
      <div id="game2048"></div>
      <div id="message2048" style="min-height:1.5em; color:#ef4444; font-weight:bold;"></div>
      <button class="action" onclick="init2048()">Restart</button>
    </section>

    <section id="alien" class="game">
      <h2>Alien Shooter</h2>
      <canvas id="alienGame" width="400" height="450"></canvas>
      <button class="action" onclick="startAlien()">Start / Restart</button>
      <p id="scoreAlien">Score: 0</p>
    </section>

    <!-- ─── UPDATED MUSIC GAME SECTION ─── -->
    <section id="music" class="game">
      <h2>ASDF Music – Learn the Song!</h2>
      <p class="hint">Press the highlighted key to play the note and reveal the next one.<br>Play manually anytime with <strong>A S D F</strong>.</p>
      
      <button class="action" id="start-tutorial-btn" style="font-size:1.3rem; padding:14px 32px; margin:20px 0;">Start Super Mario Tutorial</button>
      
      <div id="music-status" class="status-msg"></div>
      
      <div class="keys">
        <div class="key" data-key="a">A<br><small>440 Hz</small></div>
        <div class="key" data-key="s">S<br><small>494 Hz</small></div>
        <div class="key" data-key="d">D<br><small>523 Hz</small></div>
        <div class="key" data-key="f">F<br><small>587 Hz</small></div>
      </div>
      
      <p style="margin-top:40px; color:#94a3b8; font-style:italic;">
        Tip: Get it right to advance • Wrong key? Try again!
      </p>
    </section>

    <section id="leaderboard" class="game leaderboard">
      <h2>Global Leaderboard – Top 10</h2>
      <p>Shared with everyone playing this game</p>
      <h3>Dodge the Blocks</h3>
      <table id="lb-dodge"><thead><tr><th class="rank">Rank</th><th>Player</th><th class="score">Score</th></tr></thead><tbody></tbody></table>
      <h3>Snake</h3>
      <table id="lb-snake"><thead><tr><th class="rank">Rank</th><th>Player</th><th class="score">Length</th></tr></thead><tbody></tbody></table>
      <h3>2048</h3>
      <table id="lb-2048"><thead><tr><th class="rank">Rank</th><th>Player</th><th class="score">Score</th></tr></thead><tbody></tbody></table>
      <h3>Alien Shooter</h3>
      <table id="lb-alien"><thead><tr><th class="rank">Rank</th><th>Player</th><th class="score">Score</th></tr></thead><tbody></tbody></table>
    </section>
  </main>
</div>

<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js"></script>

<script>

// ────────────────────────────────────────────────
// DODGE
// ────────────────────────────────────────────────
const dCanvas = document.getElementById('dodgeGame');
const dctx = dCanvas.getContext('2d');
let player, blocks, dScore, dOver, speedMul, spawn;
function startDodge() {
  player = {x:180, y:420, w:40, h:20};
  blocks = [];
  dScore = 0; speedMul = 1; spawn = 0.03; dOver = false;
  document.getElementById('dodgeScore').innerText = 'Score: 0';
  if (dodgeRafId) cancelAnimationFrame(dodgeRafId);
  dodgeRafId = requestAnimationFrame(dLoop);
}
function dLoop() {
  if (dOver) return;
  dctx.clearRect(0,0,400,450);
  dctx.fillStyle = 'cyan';
  dctx.fillRect(player.x, player.y, player.w, player.h);
  if (Math.random() < spawn) blocks.push({x:Math.random()*360, y:0, s:4*speedMul});
  dctx.fillStyle = 'red';
  blocks.forEach(b => {
    b.y += b.s;
    dctx.fillRect(b.x, b.y, 40, 40);
    if (b.x < player.x + player.w && b.x + 40 > player.x && b.y < player.y + player.h && b.y + 40 > player.y) {
      dOver = true;
      alert('Game Over! Score: ' + dScore);
      updateLeaderboard('dodge', dScore);
    }
  });
  blocks = blocks.filter(b => b.y < 450);
  dScore++;
  if (dScore % 300 === 0) { speedMul += 0.2; spawn += 0.005; }
  document.getElementById('dodgeScore').innerText = 'Score: ' + dScore;
  dodgeRafId = requestAnimationFrame(dLoop);
}

// ────────────────────────────────────────────────
// SNAKE
// ────────────────────────────────────────────────
const sCanvas = document.getElementById('snakeGame');
const sctx = sCanvas.getContext('2d');
let snake = [], food, dir = {x:1,y:0};
function startSnake() {
  if (snakeTimer) clearInterval(snakeTimer);
  snake = [{x:10,y:10}];
  dir = {x:1,y:0};
  food = {x:Math.floor(Math.random()*20), y:Math.floor(Math.random()*20)};
  snakeTimer = setInterval(sLoop, 130);
}
function sLoop() {
  sctx.clearRect(0,0,400,400);
  const head = {x:snake[0].x + dir.x, y:snake[0].y + dir.y};
  if (head.x<0 || head.x>=20 || head.y<0 || head.y>=20 ||
      snake.some((p,i)=>i>0 && p.x===head.x && p.y===head.y)) {
    alert('Game Over! Length: ' + snake.length);
    updateLeaderboard('snake', snake.length);
    clearInterval(snakeTimer); snakeTimer = null;
    return;
  }
  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    food = {x:Math.floor(Math.random()*20), y:Math.floor(Math.random()*20)};
  } else snake.pop();
  sctx.fillStyle = 'red';
  sctx.fillRect(food.x*20, food.y*20, 20, 20);
  sctx.fillStyle = 'lime';
  snake.forEach(p => sctx.fillRect(p.x*20, p.y*20, 20, 20));
}

// ────────────────────────────────────────────────
// 2048
// ────────────────────────────────────────────────
// ────────────────────────────────────────────────
// 2048
// ────────────────────────────────────────────────
let grid = [], score2048 = 0;
let gameIsOver = false;   // ← new flag to stop input after end

const tileColors = {
  0:'#334155',2:'#eee4da',4:'#ede0c8',8:'#f2b179',16:'#f59563',
  32:'#f67c5f',64:'#f65e3b',128:'#edcf72',256:'#edcc61',512:'#edc850',
  1024:'#edc53f',2048:'#edc22e'
};

function init2048() {
  grid = Array(4).fill().map(()=>Array(4).fill(0));
  score2048 = 0;
  gameIsOver = false;
  document.getElementById('score2048').innerText = 'Score: 0';
  // Optional: clear any game-over message
  const msg = document.getElementById('message2048');
  if (msg) msg.innerText = '';
  addTile(); addTile();
  drawGrid();
}

function addTile() {
  const empty = [];
  for (let y=0;y<4;y++) for (let x=0;x<4;x++) if (grid[y][x]===0) empty.push([y,x]);
  if (!empty.length) return;
  const [y,x] = empty[Math.floor(Math.random()*empty.length)];
  grid[y][x] = Math.random()<0.9 ? 2 : 4;
}

function drawGrid() {
  const container = document.getElementById('game2048');
  container.innerHTML = '';
  for (let y=0;y<4;y++) {
    for (let x=0;x<4;x++) {
      const v = grid[y][x];
      if (!v) continue;
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.textContent = v;
      tile.style.backgroundColor = tileColors[v] || '#3c3a32';
      tile.style.left = (x*100 + 5) + 'px';
      tile.style.top = (y*100 + 5) + 'px';
      container.appendChild(tile);
    }
  }
  document.getElementById('score2048').innerText = 'Score: ' + score2048;
}

function moveGrid(dir) {
  if (gameIsOver) return;  // ← prevent moves after game over

  const rotMap = {w:3, a:0, s:1, d:2};
  let rotations = rotMap[dir.toLowerCase()];
  if (rotations === undefined) return;

  // Rotate board to always slide left
  let temp = grid;
  for (let i = 0; i < rotations; i++) {
    temp = temp[0].map((_,i) => temp.map(r => r[i]).reverse());
  }
  grid = temp;

  let moved = false;
  for (let y = 0; y < 4; y++) {
    let before = [...grid[y]];
    let row = grid[y].filter(n => n !== 0);
    for (let i = 0; i < row.length - 1; i++) {
      if (row[i] === row[i+1] && row[i] !== 0) {
        row[i] *= 2;
        score2048 += row[i];
        row[i+1] = 0;
        i++;
      }
    }
    row = row.filter(n => n !== 0);
    while (row.length < 4) row.push(0);
    grid[y] = row;
    if (!before.every((v,i) => v === row[i])) moved = true;
  }

  // Rotate back
  for (let i = 0; i < (4 - rotations) % 4; i++) {
    grid = grid[0].map((_,i) => grid.map(r => r[i]).reverse());
  }

  if (moved) {
    addTile();
    drawGrid();
  }

  // Check game over **after** every attempted move
  if (isGameOver()) {
    gameIsOver = true;
    const msg = document.getElementById('message2048') || document.createElement('p');
    msg.id = 'message2048';
    msg.style.color = '#ef4444';
    msg.style.fontWeight = 'bold';
    msg.innerText = 'Game Over! Score saved to leaderboard.';
    document.getElementById('game2048').parentNode.insertBefore(msg, document.getElementById('score2048').nextSibling);
  }
}

function isGameOver() {
  // 1. Any empty cell?
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) return false;
    }
  }

  // 2. Any possible horizontal merge?
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[r][c] === grid[r][c+1]) return false;
    }
  }

  // 3. Any possible vertical merge?
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 3; r++) {
      if (grid[r][c] === grid[r+1][c]) return false;
    }
  }

  // No moves possible → game over
  update2048Score();  // ← leaderboard update (your existing function)
  return true;
}

function update2048Score() {
  if (score2048 > 0) {
    updateLeaderboard('2048', score2048);
  }
}
// ────────────────────────────────────────────────
// ALIEN SHOOTER
// ────────────────────────────────────────────────
const aCanvas = document.getElementById('alienGame');
const actx = aCanvas.getContext('2d');
let aPlayer = {x:180,y:420,w:30,h:30};
let aliens = [], bullets = [], aScore = 0, alienOver = false, alienSpeed = 1;
function startAlien() {
  aPlayer = {x:180,y:420,w:30,h:30};
  aliens = []; bullets = []; aScore = 0; alienOver = false; alienSpeed = 1;
  document.getElementById('scoreAlien').innerText = 'Score: 0';
  if (alienTimer) clearInterval(alienTimer);
  alienTimer = setInterval(alienLoop, 20);
  setTimeout(spawnAlien, 800);
}
function spawnAlien() {
  if (alienOver) return;
  if (aliens.length >= 6) return setTimeout(spawnAlien, 1200);
  aliens.push({x:Math.random()*360+20, y:-20, r:18});
  setTimeout(spawnAlien, 1400 - aScore*2);
}
function alienLoop() {
  if (alienOver) return;
  actx.clearRect(0,0,400,450);
  actx.fillStyle = 'cyan';
  actx.beginPath();
  actx.moveTo(aPlayer.x, aPlayer.y - aPlayer.h/2);
  actx.lineTo(aPlayer.x - aPlayer.w/2, aPlayer.y + aPlayer.h/2);
  actx.lineTo(aPlayer.x + aPlayer.w/2, aPlayer.y + aPlayer.h/2);
  actx.closePath(); actx.fill();
  actx.strokeStyle = 'yellow'; actx.lineWidth = 3;
  bullets.forEach((b,i) => {
    b.y -= 7;
    actx.beginPath(); actx.moveTo(b.x,b.y); actx.lineTo(b.x,b.y-16); actx.stroke();
    aliens.forEach((al,j) => {
      if (Math.hypot(b.x-al.x, b.y-al.y) < al.r + 6) {
        aliens.splice(j,1); bullets.splice(i,1); aScore += 10;
        document.getElementById('scoreAlien').innerText = 'Score: ' + aScore;
      }
    });
  });
  bullets = bullets.filter(b=>b.y > -20);
  actx.fillStyle = 'red';
  aliens.forEach(al => {
    al.y += alienSpeed;
    actx.beginPath(); actx.arc(al.x, al.y, al.r, 0, Math.PI*2); actx.fill();
    if (Math.hypot(aPlayer.x - al.x, aPlayer.y - al.y) < al.r + 20 || al.y > 470) {
      alienOver = true;
      alert('Game Over! Score: ' + aScore);
      updateLeaderboard('alien', aScore);
      clearInterval(alienTimer); alienTimer = null;
    }
  });
  alienSpeed += 0.0004;
}
// ─── MUSIC GAME LOGIC ───────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const activeOsc = {};

const notes = {
  a: 440.00,   // A4
  s: 493.88,   // B4
  d: 523.25,   // C5
  f: 587.33    // D5
};

function playNote(key, duration = 0.15) {
  if (activeOsc[key]) {
    activeOsc[key].stop();
    delete activeOsc[key];
  }

  const osc = audioCtx.createOscillator();
  osc.type = 'sine';  // 'square' for retro
  osc.frequency.value = notes[key];

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  activeOsc[key] = osc;

  const el = document.querySelector(`.key[data-key="${key}"]`);
  if (el) {
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), duration * 1000 + 50);
  }

  setTimeout(() => stopNote(key), duration * 1000);
}

function stopNote(key) {
  if (activeOsc[key]) {
    activeOsc[key].stop();
    delete activeOsc[key];
  }
  const el = document.querySelector(`.key[data-key="${key}"]`);
  if (el) el.classList.remove('active');
}

// ─── Manual play (always available) ─────────────────────────
document.addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (notes[k] && document.getElementById('music').style.display === 'block') {
    playNote(k, 0.3);  // short for manual
  }
});

document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (notes[k]) stopNote(k);
});

// Mouse/touch for manual
document.querySelectorAll('.key').forEach(el => {
  const key = el.dataset.key;
  el.addEventListener('mousedown', () => playNote(key, 0.3));
  el.addEventListener('mouseup', () => stopNote(key));
  el.addEventListener('mouseleave', () => stopNote(key));

  el.addEventListener('touchstart', e => { e.preventDefault(); playNote(key, 0.3); });
  el.addEventListener('touchend', e => { e.preventDefault(); stopNote(key); });
});

// ─── Song Tutorial Mode ─────────────────────────────────────
const marioSequence = [
  {key: 'd', dur: 0.18},  // E
  {key: 'd', dur: 0.18},  // E
  {key: 'd', dur: 0.36},  // E (long)
  {key: 'a', dur: 0.12},  // C
  {key: 'd', dur: 0.24},  // E
  {key: 'f', dur: 0.48},  // G (long)
  {key: 'a', dur: 0.18},  // C
  {key: 'd', dur: 0.18},  // E
  {key: 'd', dur: 0.36},  // E (long)
  {key: 'a', dur: 0.12},  // C
  {key: 'd', dur: 0.24},  // E
  {key: 'f', dur: 0.48}   // G (long)
];

let currentIndex = -1;
let inTutorial = false;

function highlightNext() {
  document.querySelectorAll('.key').forEach(el => el.classList.remove('next'));
  if (currentIndex < marioSequence.length) {
    const nextKey = marioSequence[currentIndex].key;
    const el = document.querySelector(`.key[data-key="${nextKey}"]`);
    if (el) el.classList.add('next');
    document.getElementById('music-status').textContent = currentIndex === -1 ? '' : `Press the highlighted key (${nextKey.toUpperCase()})!`;
  } else {
    document.getElementById('music-status').textContent = 'Well done! You played the song! 🎉';
    document.getElementById('start-tutorial-btn').textContent = 'Restart Tutorial';
    inTutorial = false;
  }
}

document.getElementById('start-tutorial-btn')?.addEventListener('click', () => {
  currentIndex = 0;
  inTutorial = true;
  document.getElementById('start-tutorial-btn').textContent = 'Tutorial in Progress...';
  document.getElementById('music-status').textContent = 'Press the highlighted key!';
  highlightNext();
});

// ─── Keydown for tutorial ───────────────────────────────────
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (!inTutorial || e.repeat || document.getElementById('music').style.display !== 'block') return;

  const expected = marioSequence[currentIndex]?.key;
  if (k === expected) {
    playNote(k, marioSequence[currentIndex].dur);
    currentIndex++;
    highlightNext();
  } else {
    // Wrong key: short error beep (using 'a' as low note)
    playNote('a', 0.1);
    document.getElementById('music-status').textContent = 'Oops! Wrong key. Try again.';
    setTimeout(() => {
      document.getElementById('music-status').textContent = `Press ${expected.toUpperCase()}!`;
    }, 800);
  }
});

// Reset tutorial when switching games
const originalShowGame = showGame;
showGame = function(id) {
  originalShowGame(id);
  if (id !== 'music') {
    inTutorial = false;
    currentIndex = -1;
    document.querySelectorAll('.key').forEach(el => el.classList.remove('next'));
    if (document.getElementById('start-tutorial-btn')) {
      document.getElementById('start-tutorial-btn').textContent = 'Start Super Mario Tutorial';
    }
    document.getElementById('music-status').textContent = '';
  }
};

// ─── INPUT (your original input code remains unchanged)
</script>
</body>
</html>
