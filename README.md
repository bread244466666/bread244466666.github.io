<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Mini Game Arcade – Password Protected</title>
<style>
  body { 
    margin:0; font-family:Arial, Helvetica, sans-serif; background:#020617; color:#e5e7eb; min-height:100vh;
  }
  header { padding:30px; text-align:center; background:linear-gradient(135deg,#2563eb,#4f46e5); }
  #password-screen {
    position:fixed; inset:0; background:#020617; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:20px; z-index:100;
  }
  #password-screen.hidden { display:none; }
  input[type="password"] { padding:14px 18px; font-size:1.2rem; width:320px; max-width:90%; border-radius:8px; border:2px solid #4f46e5; background:#1e293b; color:white; }
  button#unlock { padding:14px 40px; font-size:1.2rem; background:#2563eb; color:white; border:none; border-radius:8px; cursor:pointer; }
  button#unlock:hover { background:#1d4ed8; }
  #error { color:#ef4444; font-size:1.1rem; min-height:1.5em; }
  nav { display:flex; justify-content:center; gap:15px; padding:15px; background:#020617; border-bottom:1px solid #1e293b; }
  nav button { padding:10px 18px; border:none; border-radius:8px; background:#1e40af; color:white; cursor:pointer; font-size:0.95rem; }
  nav button:hover { background:#1d4ed8; }
  main { max-width:900px; margin:30px auto; padding:0 20px; }
  .game { display:none; background:#020617; border-radius:14px; padding:20px; box-shadow:0 10px 30px rgba(0,0,0,0.5); }
  canvas { display:block; margin:20px auto; background:black; border-radius:10px; }
  button.action { padding:10px 20px; border:none; border-radius:8px; background:#2563eb; color:white; cursor:pointer; margin-top:10px; }
  #score2048, #dodgeScore, #scoreAlien { font-size:1.2rem; margin-top:10px; text-align:center; }
  #game2048 { display:block; margin:20px auto; width:400px; height:400px; position:relative; background:#111827; border-radius:10px; }
  .tile { width:90px; height:90px; position:absolute; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:bold; border-radius:10px; color:white; transition:all 0.15s ease; }
</style>
</head>
<body>

<!-- Password screen -->
<div id="password-screen">
  <h2>Enter Password to Unlock Games</h2>
  <input type="password" id="password-input" placeholder="Password..." autofocus>
  <button id="unlock">Unlock</button>
  <div id="error"></div>
</div>

<!-- Main content -->
<div id="main-content" style="display:none;">
  <header>
    <h1>🎮 Mini Game Arcade</h1>
    <p>Use <strong>W A S D</strong> • Space = shoot (Alien only)</p>
  </header>
  <nav>
    <button onclick="showGame('home')">Home</button>
    <button onclick="showGame('dodge')">Dodge</button>
    <button onclick="showGame('snake')">Snake</button>
    <button onclick="showGame('game2048')">2048</button>
    <button onclick="showGame('alien')">Alien Shooter</button>
  </nav>
  <main>
    <section id="home" class="game" style="display:block">
      <h2>Welcome</h2>
      <p>Click "Start / Restart" in each game, then use WASD.<br>Click inside the game area if keys don't respond at first.</p>
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
  </main>
</div>

<script>
// PASSWORD
const CORRECT_PASSWORD = 'bread';

document.getElementById('unlock').onclick = () => {
  const input = document.getElementById('password-input').value.trim();
  const error = document.getElementById('error');
  if (input === CORRECT_PASSWORD) {
    document.getElementById('password-screen').classList.add('hidden');
    document.getElementById('main-content').style.display = 'block';
    document.body.focus();
    init2048();
  } else {
    error.textContent = 'Wrong password. Try again.';
    document.getElementById('password-input').value = '';
    document.getElementById('password-input').focus();
  }
};

document.getElementById('password-input').onkeypress = e => {
  if (e.key === 'Enter') document.getElementById('unlock').click();
};

// GAME LOGIC
let dodgeRafId = null;
let snakeTimer = null;
let alienTimer = null;

function showGame(id) {
  document.querySelectorAll('.game').forEach(g => g.style.display = 'none');
  document.getElementById(id).style.display = 'block';

  if (id !== 'dodge' && dodgeRafId) cancelAnimationFrame(dodgeRafId);
  if (id !== 'snake' && snakeTimer) clearInterval(snakeTimer);
  if (id !== 'alien' && alienTimer) clearInterval(alienTimer);

  ['dodgeGame','snakeGame','alienGame'].forEach(cid => {
    const c = document.getElementById(cid);
    if (c) c.getContext('2d')?.clearRect(0,0,c.width,c.height);
  });
}

// DODGE
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
    }
  });
  blocks = blocks.filter(b => b.y < 450);
  dScore++;
  if (dScore % 300 === 0) { speedMul += 0.2; spawn += 0.005; }
  document.getElementById('dodgeScore').innerText = 'Score: ' + dScore;
  dodgeRafId = requestAnimationFrame(dLoop);
}

// SNAKE
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
    alert('Game Over!');
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

// 2048 ─ FIXED: new tile spawns after EVERY valid move (slide or merge)
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
      tile.style.top  = (y*100 + 5) + 'px';
      container.appendChild(tile);
    }
  }
  document.getElementById('score2048').innerText = 'Score: ' + score2048;
}

function moveGrid(dir) {
  const rotMap = {w:3, a:0, s:1, d:2};
  let rotations = rotMap[dir];
  const rotate = m => m[0].map((_,i) => m.map(r => r[i]).reverse());

  // Rotate grid to make direction always "left"
  for (let i = 0; i < rotations; i++) grid = rotate(grid);

  let moved = false;

  for (let y = 0; y < 4; y++) {
    let before = [...grid[y]];  // snapshot to detect any change

    // Slide left (remove zeros)
    let row = grid[y].filter(n => n !== 0);

    // Merge
    for (let i = 0; i < row.length - 1; i++) {
      if (row[i] === row[i+1] && row[i] !== 0) {
        row[i] *= 2;
        score2048 += row[i];
        row[i+1] = 0;
        i++;  // skip next (now zero)
      }
    }

    // Remove zeros again after merge
    row = row.filter(n => n !== 0);

    // Pad with zeros on right
    while (row.length < 4) row.push(0);

    grid[y] = row;

    // If row changed at all → movement happened
    if (!before.every((v,i) => v === row[i])) moved = true;
  }

  // Rotate back
  for (let i = 0; i < (4 - rotations) % 4; i++) grid = rotate(grid);

  if (moved) {
    addTile();
    drawGrid();
  }
}

// ALIEN SHOOTER
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
      clearInterval(alienTimer); alienTimer = null;
    }
  });
  alienSpeed += 0.0004;
}

// INPUT
document.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  const visible = document.querySelector('.game:not([style*="none"])');
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
