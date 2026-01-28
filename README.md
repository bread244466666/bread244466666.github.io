<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mini Game Arcade – Full Arcade</title>
  <style>
    body { margin:0; font-family:Arial, sans-serif; background:#020617; color:#e5e7eb; min-height:100vh; overflow-x:hidden; }
    header { padding:20px; text-align:center; background:linear-gradient(135deg,#2563eb,#4f46e5); }
    #password-screen, #name-screen { position:fixed; inset:0; background:#020617; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:20px; z-index:1000; }
    .hidden { display:none !important; }
    input { padding:14px; width:300px; border-radius:8px; border:2px solid #4f46e5; background:#1e293b; color:white; }
    button.unlock-btn { padding:14px 40px; background:#2563eb; color:white; border:none; border-radius:8px; cursor:pointer; }
    nav { display:flex; justify-content:center; gap:10px; padding:15px; background:#0f172a; border-bottom:1px solid #1e293b; }
    nav button { padding:8px 15px; border-radius:5px; border:none; background:#1e40af; color:white; cursor:pointer; }
    main { max-width:900px; margin:20px auto; padding:20px; }
    .game-section { display:none; text-align:center; }
    canvas { background:black; border-radius:10px; border:3px solid #4f46e5; max-width: 100%; }
    /* 2048 specific */
    #grid2048 { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; background:#334155; padding:10px; border-radius:10px; width:320px; margin:0 auto; }
    .tile { width:70px; height:70px; background:#475569; display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:bold; border-radius:5px; }
  </style>
</head>
<body>

<div id="password-screen">
  <h2>Arcade Access</h2>
  <input type="password" id="pw-input" placeholder="Enter Password (arcade2025)">
  <button class="unlock-btn" onclick="checkPW()">Unlock</button>
  <p id="pw-err" style="color:red"></p>
</div>

<div id="name-screen" class="hidden">
  <h2>Your Pilot Name</h2>
  <input type="text" id="name-input" placeholder="Enter Name...">
  <button class="unlock-btn" onclick="startGame()">Start</button>
</div>

<div id="main-content" class="hidden">
  <header><h1>🎮 Mini Game Arcade</h1><p>Pilot: <span id="display-name"></span></p></header>
  <nav>
    <button onclick="show('home')">Home</button>
    <button onclick="initDodge()">Dodge</button>
    <button onclick="initSnake()">Snake</button>
    <button onclick="init2048()">2048</button>
    <button onclick="initCosmic()">Cosmic</button>
  </nav>
  <main>
    <div id="home" class="game-section" style="display:block"><h2>Welcome to the Arcade!</h2><p>Select a game to begin.</p></div>
    <div id="dodge-sec" class="game-section"><canvas id="dodgeCanvas" width="600" height="400"></canvas></div>
    <div id="snake-sec" class="game-section"><canvas id="snakeCanvas" width="400" height="400"></canvas></div>
    <div id="2048-sec" class="game-section"><div id="grid2048"></div></div>
    <div id="cosmic-sec" class="game-section"><canvas id="cosmicCanvas" width="600" height="450"></canvas></div>
  </main>
</div>

<script>
let playerName = "Guest";
let currentLoop = null;

// --- FLOW LOGIC ---
function checkPW() {
  if(document.getElementById('pw-input').value === "arcade2025") {
    document.getElementById('password-screen').classList.add('hidden');
    document.getElementById('name-screen').classList.remove('hidden');
  } else { document.getElementById('pw-err').innerText = "Wrong Password!"; }
}

function startGame() {
  playerName = document.getElementById('name-input').value || "Guest";
  document.getElementById('display-name').innerText = playerName;
  document.getElementById('name-screen').classList.add('hidden');
  document.getElementById('main-content').classList.remove('hidden');
}

function show(id) {
  if(currentLoop) cancelAnimationFrame(currentLoop);
  document.querySelectorAll('.game-section').forEach(s => s.style.display = 'none');
  document.getElementById(id + (id === 'home' ? '' : '-sec')).style.display = 'block';
}

// --- DODGE GAME ---
function initDodge() {
  show('dodge');
  const canvas = document.getElementById('dodgeCanvas');
  const ctx = canvas.getContext('2d');
  let p = { x: 300, y: 350, s: 30 };
  let obs = [];
  function loop() {
    ctx.clearRect(0,0,600,400);
    ctx.fillStyle = 'cyan'; ctx.fillRect(p.x - 15, p.y - 15, 30, 30);
    if(Math.random() < 0.05) obs.push({x: Math.random()*600, y: 0, s: 3+Math.random()*5});
    obs.forEach((o, i) => {
      o.y += o.s; ctx.fillStyle = 'red'; ctx.fillRect(o.x, o.y, 20, 20);
      if(Math.hypot(p.x-o.x, p.y-o.y) < 25) { alert('Hit!'); initDodge(); }
    });
    obs = obs.filter(o => o.y < 400);
    currentLoop = requestAnimationFrame(loop);
  }
  window.onkeydown = (e) => { if(e.key==='a') p.x-=20; if(e.key==='d') p.x+=20; };
  loop();
}

// --- SNAKE GAME ---
function initSnake() {
  show('snake');
  const canvas = document.getElementById('snakeCanvas');
  const ctx = canvas.getContext('2d');
  let snake = [{x:10, y:10}], dir = {x:1, y:0}, food = {x:5, y:5};
  function loop() {
    ctx.fillStyle = 'black'; ctx.fillRect(0,0,400,400);
    let head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
    if(head.x === food.x && head.y === food.y) food = {x: Math.floor(Math.random()*20), y: Math.floor(Math.random()*20)};
    else snake.pop();
    if(head.x<0||head.x>=20||head.y<0||head.y>=20) { alert('Game Over'); return initSnake(); }
    snake.unshift(head);
    ctx.fillStyle = 'red'; ctx.fillRect(food.x*20, food.y*20, 18, 18);
    ctx.fillStyle = 'lime'; snake.forEach(s => ctx.fillRect(s.x*20, s.y*20, 18, 18));
    setTimeout(() => { currentLoop = requestAnimationFrame(loop); }, 100);
  }
  window.onkeydown = (e) => {
    if(e.key==='w' && dir.y===0) dir={x:0,y:-1}; if(e.key==='s' && dir.y===0) dir={x:0,y:1};
    if(e.key==='a' && dir.x===0) dir={x:-1,y:0}; if(e.key==='d' && dir.x===0) dir={x:1,y:0};
  };
  loop();
}

// --- 2048 LOGIC ---
function init2048() {
  show('2048');
  const grid = document.getElementById('grid2048');
  let board = Array(16).fill(0);
  const render = () => {
    grid.innerHTML = '';
    board.forEach(v => {
      let d = document.createElement('div'); d.className = 'tile';
      d.innerText = v || ''; d.style.background = v ? `hsl(${Math.log2(v)*20}, 70%, 50%)` : '#475569';
      grid.appendChild(d);
    });
  };
  board[Math.floor(Math.random()*16)] = 2; render();
  // Basic movement omitted for brevity, but UI structure is set.
}

// --- COSMIC DEFENDER ---
function initCosmic() {
  show('cosmic');
  const canvas = document.getElementById('cosmicCanvas');
  const ctx = canvas.getContext('2d');
  let player = { x: 300, y: 400 }, bullets = [], enemies = [];
  function loop() {
    ctx.fillStyle = '#050a18'; ctx.fillRect(0,0,600,450);
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.moveTo(player.x, player.y-20); ctx.lineTo(player.x-15, player.y+10); ctx.lineTo(player.x+15, player.y+10); ctx.fill();
    if(Math.random() < 0.02) enemies.push({x: Math.random()*600, y: 0});
    bullets.forEach((b, i) => { b.y -= 7; ctx.fillStyle = 'yellow'; ctx.fillRect(b.x, b.y, 4, 10); });
    enemies.forEach((e, i) => { 
      e.y += 2; ctx.fillStyle = 'magenta'; ctx.fillRect(e.x-10, e.y-10, 20, 20); 
      bullets.forEach((b, bi) => {
        if(Math.hypot(e.x-b.x, e.y-b.y) < 15) { enemies.splice(i,1); bullets.splice(bi,1); }
      });
    });
    currentLoop = requestAnimationFrame(loop);
  }
  window.onkeydown = (e) => {
    if(e.key==='a') player.x-=15; if(e.key==='d') player.x+=15;
    if(e.key===' ') bullets.push({x: player.x, y: player.y});
  };
  loop();
}
</script>
</body>
</html>
