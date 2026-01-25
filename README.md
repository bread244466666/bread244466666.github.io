<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Mini Game Arcade – Password Protected</title>
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
    <p>Use <strong>W A S D</strong> • Space = shoot (Alien only)</p>
  </header>
  <nav>
    <button onclick="showGame('home')">Home</button>
    <button onclick="showGame('dodge')">Dodge</button>
    <button onclick="showGame('snake')">Snake</button>
    <button onclick="showGame('game2048')">2048</button>
    <button onclick="showGame('alien')">Alien Shooter</button>
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
      <p id="score2048">Score: 0</p>
      <button class="action" onclick="init2048()">Restart</button>
    </section>

    <section id="alien" class="game">
      <h2>Alien Shooter</h2>
      <canvas id="alienGame" width="400" height="450"></canvas>
      <button class="action" onclick="startAlien()">Start / Restart</button>
      <p id="scoreAlien">Score: 0</p>
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
// Your real Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyANLp5iTUBM9isYt3nRaxYt9fZ-qc-Lsts",
  authDomain: "minigamearcade-373e5.firebaseapp.com",
  databaseURL: "https://minigamearcade-373e5-default-rtdb.firebaseio.com",
  projectId: "minigamearcade-373e5",
  storageBucket: "minigamearcade-373e5.firebasestorage.app",
  messagingSenderId: "347058693088",
  appId: "1:347058693088:web:41e1b5da9cbc5567aa0185",
  measurementId: "G-PMXHFHMQSZ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentPlayerName = 'Guest';
const CORRECT_PASSWORD = 'bread';

// ────────────────────────────────────────────────
// PASSWORD + NAME ENTRY
// ────────────────────────────────────────────────
document.getElementById('unlock-password').onclick = () => {
  const input = document.getElementById('password-input').value.trim();
  if (input === CORRECT_PASSWORD) {
    document.getElementById('password-screen').classList.add('hidden');
    document.getElementById('name-screen').classList.remove('hidden');
    document.getElementById('name-input').focus();
  } else {
    document.getElementById('password-error').textContent = 'Wrong password';
  }
};

document.getElementById('unlock-name').onclick = () => {
  const name = document.getElementById('name-input').value.trim();
  if (name) {
    currentPlayerName = name;
    document.getElementById('player-name').textContent = name;
    document.getElementById('player-name-home').textContent = name;
    document.getElementById('name-screen').classList.add('hidden');
    document.getElementById('main-content').style.display = 'block';
    renderAll();
  } else {
    document.getElementById('name-error').textContent = 'Enter a name';
  }
};

// ────────────────────────────────────────────────
// SHARED LEADERBOARD
// ────────────────────────────────────────────────
const LEADERBOARD_PATHS = {
  dodge: 'leaderboards/dodge',
  snake: 'leaderboards/snake',
  '2048': 'leaderboards/2048',
  alien: 'leaderboards/alien'
};

function updateLeaderboard(game, score) {
  if (!currentPlayerName || score <= 0) return;

  const path = LEADERBOARD_PATHS[game];
  const safeName = currentPlayerName.replace(/[.#$[\]]/g, '_');
  const ref = db.ref(path + '/' + safeName);

  ref.once('value', snap => {
    const data = snap.val();
    if (!data || score > data.score) {
      ref.set({
        name: currentPlayerName,
        score: score,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
    }
  });
}

function renderLeaderboard(game) {
  const tbody = document.querySelector(`#lb-${game} tbody`);
  tbody.innerHTML = '<tr><td colspan="3" class="loading-msg">Loading global scores...</td></tr>';

  const path = LEADERBOARD_PATHS[game];
  db.ref(path).orderByChild('score').limitToLast(10).once('value', snap => {
    tbody.innerHTML = '';
    let entries = [];
    snap.forEach(child => {
      const d = child.val();
      entries.push({ name: d.name || child.key, score: d.score });
    });
    entries.sort((a,b) => b.score - a.score);

    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-msg">No scores yet — be the first!</td></tr>';
      return;
    }

    entries.forEach((e, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="rank">${i+1}</td><td>${e.name}</td><td class="score">${e.score.toLocaleString()}</td>`;
      tbody.appendChild(tr);
    });
  });
}

function renderAll() {
  ['dodge','snake','2048','alien'].forEach(renderLeaderboard);
}

// Live updates
Object.values(LEADERBOARD_PATHS).forEach(path => {
  db.ref(path).on('value', () => {
    if (document.getElementById('leaderboard').style.display !== 'none') {
      renderAll();
    }
  });
});

// ────────────────────────────────────────────────
// GAME SWITCHER
// ────────────────────────────────────────────────
let dodgeRafId = null;
let snakeTimer = null;
let alienTimer = null;

function showGame(id) {
  document.querySelectorAll('.game').forEach(g => g.style.display = 'none');
  document.getElementById(id).style.display = 'block';

  if (id === 'leaderboard') renderAll();

  if (id !== 'dodge' && dodgeRafId) cancelAnimationFrame(dodgeRafId);
  if (id !== 'snake' && snakeTimer) clearInterval(snakeTimer);
  if (id !== 'alien' && alienTimer) clearInterval(alienTimer);

  ['dodgeGame','snakeGame','alienGame'].forEach(cid => {
    const c = document.getElementById(cid);
    if (c) c.getContext('2d')?.clearRect(0,0,c.width,c.height);
  });
}

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
// 2048 – WITH GAME OVER DETECTION & LEADERBOARD SAVE
// ────────────────────────────────────────────────
let grid = [], score2048 = 0;
const tileColors = {
  0:'#334155',2:'#eee4da',4:'#ede0c8',8:'#f2b179',16:'#f59563',
  32:'#f67c5f',64:'#f65e3b',128:'#edcf72',256:'#edcc61',512:'#edc850',
  1024:'#edc53f',2048:'#edc22e'
};
function init2048() {
  grid = Array(4).fill().map(()=>Array(4).fill(0));
  score2048 = 0;
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
  const rotMap = {w:3, a:0, s:1, d:2};
  let rotations = rotMap[dir];
  const rotate = m => m[0].map((_,i) => m.map(r => r[i]).reverse());
  for (let i = 0; i < rotations; i++) grid = rotate(grid);
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
  for (let i = 0; i < (4 - rotations) % 4; i++) grid = rotate(grid);

  if (moved) {
    addTile();
    drawGrid();

    // Check for win
    if (grid.flat().includes(2048)) {
      alert('You win! 2048 reached! Score: ' + score2048);
      updateLeaderboard('2048', score2048);
    }

    // Check for game over
    let gameOver = true;
    for (let y = 0; y < 4 && gameOver; y++) {
      for (let x = 0; x < 4; x++) {
        const val = grid[y][x];
        if (val === 0) {
          gameOver = false;
          break;
        }
        if (x < 3 && val === grid[y][x+1]) {
          gameOver = false;
          break;
        }
        if (y < 3 && val === grid[y+1][x]) {
          gameOver = false;
          break;
        }
      }
    }

    if (gameOver && score2048 > 0) {
      alert('Game Over! No moves left. Final Score: ' + score2048);
      updateLeaderboard('2048', score2048);
    }
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

// ────────────────────────────────────────────────
// INPUT
// ────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  const visible = document.querySelector('.game:not([style*="display: none"])');
  if (!visible) return;
  const id = visible.id;

  if (id === 'dodge') {
    if (key==='a') player.x -= 22;
    if (key==='d') player.x += 22;
    player.x = Math.max(0, Math.min(360, player.x));
  }
  else if (id === 'snake') {
    if (key==='w' && dir.y !== 1) dir = {x:0,y:-1};
    if (key==='s' && dir.y !== -1) dir = {x:0,y:1};
    if (key==='a' && dir.x !== 1) dir = {x:-1,y:0};
    if (key==='d' && dir.x !== -1) dir = {x:1,y:0};
  }
  else if (id === 'game2048') {
    if (['w','a','s','d'].includes(key)) {
      moveGrid(key);
      e.preventDefault();
    }
  }
  else if (id === 'alien') {
    if (key==='a') aPlayer.x -= 8;
    if (key==='d') aPlayer.x += 8;
    aPlayer.x = Math.max(0, Math.min(370, aPlayer.x));
    if (e.key === ' ') {
      bullets.push({x:aPlayer.x, y:aPlayer.y - aPlayer.h/2});
      e.preventDefault();
    }
  }
});
</script>
</body>
</html>
