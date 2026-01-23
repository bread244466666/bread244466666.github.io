<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Mini Game Arcade</title>
<style>
body { margin:0; font-family:Arial, Helvetica, sans-serif; background:#020617; color:#e5e7eb; }
header { padding:30px; text-align:center; background:linear-gradient(135deg,#2563eb,#4f46e5); }
nav { display:flex; justify-content:center; gap:15px; padding:15px; background:#020617; border-bottom:1px solid #1e293b; }
nav button { padding:10px 18px; border:none; border-radius:8px; background:#1e40af; color:white; cursor:pointer; font-size:0.95rem; }
nav button:hover { background:#1d4ed8; }
main { max-width:900px; margin:30px auto; padding:0 20px; }
.game { display:none; background:#020617; border-radius:14px; padding:20px; box-shadow:0 10px 30px rgba(0,0,0,0.5); }
canvas { display:block; margin:20px auto; background:black; border-radius:10px; }
button.action { padding:10px 20px; border:none; border-radius:8px; background:#2563eb; color:white; cursor:pointer; margin-top:10px; }
</style>
</head>
<body>
<header>
<h1>🎮 Mini Game Arcade</h1>
<p>Pure HTML + JavaScript · Hosted on GitHub Pages</p>
</header>

<nav>
  <button onclick="showGame('home')">Home</button>
  <button onclick="showGame('dodge')">Dodge</button>
  <button onclick="showGame('box')">Box Push</button>
  <button onclick="showGame('snake')">Snake</button>
</nav>

<main>
<section id="home" class="game" style="display:block">
  <h2>Welcome</h2>
  <p>Select a game from the menu above.</p>
</section>

<section id="dodge" class="game">
  <h2>Dodge the Blocks</h2>
  <canvas id="dodgeGame" width="400" height="500"></canvas>
  <button class="action" onclick="startDodge()">Start</button>
  <p id="dodgeScore">Score: 0</p>
</section>

<section id="box" class="game">
  <h2>Box Pushing (Sokoban)</h2>
  <canvas id="boxGame" width="400" height="320"></canvas>
  <p id="boxLevel">Level: 1</p>
  <button class="action" onclick="startBoxGame()">Restart</button>
</section>

<section id="snake" class="game">
  <h2>Snake</h2>
  <canvas id="snakeGame" width="400" height="400"></canvas>
  <button class="action" onclick="startSnake()">Start</button>
</section>
</main>

<script>
// ===== NAV =====
function showGame(id) {
  document.querySelectorAll('.game').forEach(g => g.style.display = 'none');
  document.getElementById(id).style.display = 'block';
  if (id !== 'snake' && snakeTimer) { clearInterval(snakeTimer); snakeTimer=null; }
}

// ===== DODGE GAME =====
const dCanvas = document.getElementById('dodgeGame');
const dctx = dCanvas.getContext('2d');
let player, blocks, dScore, dOver, speedMul, spawn;
function startDodge() {
  player={x:180,y:460,w:40,h:20}; blocks=[]; dScore=0; speedMul=1; spawn=0.03; dOver=false;
  requestAnimationFrame(dLoop);
}
function dLoop() {
  if(dOver) return;
  dctx.clearRect(0,0,400,500);
  dctx.fillStyle='cyan'; dctx.fillRect(player.x,player.y,player.w,player.h);
  if(Math.random()<spawn) blocks.push({x:Math.random()*360,y:0,s:4*speedMul});
  dctx.fillStyle='red'; blocks.forEach(b=>{ b.y+=b.s; dctx.fillRect(b.x,b.y,40,40); if(b.x<player.x+player.w&&b.x+40>player.x&&b.y<player.y+player.h&&b.y+40>player.y){dOver=true; alert('Game Over! Score:'+dScore); } });
  blocks=blocks.filter(b=>b.y<500);
  dScore++; if(dScore%300===0){speedMul+=0.2;spawn+=0.005;}
  document.getElementById('dodgeScore').innerText='Score:'+dScore;
  requestAnimationFrame(dLoop);
}

// ===== PROGRESSIVE BOX PUSH GAME =====
const boxCanvas=document.getElementById('boxGame');
const bctx=boxCanvas.getContext('2d');
const tile=40;
let map,p,currentLevel=1;

function startBoxGame(){ 
  map = generateLevelForProgression(currentLevel); 
  document.getElementById('boxLevel').innerText = 'Level: '+currentLevel;
  drawBox(); 
}

function generateLevelForProgression(level){
  const width = Math.min(12, 8 + level); // increase map size
  const height = Math.min(8, 5 + Math.floor(level/2));
  const boxes = Math.min(5, 2 + Math.floor(level/2));
  let m = Array.from({length:height},()=>Array(width).fill('.'));
  for(let y=0;y<height;y++){ m[y][0]=m[y][width-1]='#'; }
  for(let x=0;x<width;x++){ m[0][x]=m[height-1][x]='#'; }

  // Place goals
  let goals=[];
  while(goals.length<boxes){
    let gx=Math.floor(Math.random()*(width-2))+1;
    let gy=Math.floor(Math.random()*(height-2))+1;
    if(m[gy][gx]==='.'){ m[gy][gx]='G'; goals.push({x:gx,y:gy}); }
  }

  // Place boxes along solvable path (reverse push simulation)
  let boxesPlaced=0;
  let attempts=0;
  while(boxesPlaced<boxes && attempts<1000){
    attempts++;
    let goal=goals[boxesPlaced];
    let px=Math.min(width-2,Math.max(1,goal.x + (Math.random()*3|0 -1)));
    let py=Math.min(height-2,Math.max(1,goal.y + (Math.random()*3|0 -1)));
    if(m[py][px]==='.' && !goals.some(g=>g.x===px && g.y===py)){
      m[py][px]='B';
      boxesPlaced++;
    }
  }

  // Place player near first box
  for(let y=1;y<height-1;y++){
    let found=false;
    for(let x=1;x<width-1;x++){
      if(m[y][x]==='.'){ p={x,y}; found=true; break; }
    }
    if(found) break;
  }

  // Add optional walls for challenge
  const wallCount = Math.floor(width*height*0.08); // more walls as level increases
  for(let i=0;i<wallCount;i++){
    let x=Math.floor(Math.random()*(width-2))+1;
    let y=Math.floor(Math.random()*(height-2))+1;
    if(m[y][x]==='.') m[y][x]='#';
  }

  return m;
}

function moveBox(dx,dy){
  const nx=p.x+dx,ny=p.y+dy; const next=map[ny][nx]; if(next==='#') return;
  if(next==='B'){ const bx=nx+dx,by=ny+dy; if(map[by][bx]==='.'||map[by][bx]==='G'){map[by][bx]='B';map[ny][nx]='.';}else return;}
  p={x:nx,y:ny}; drawBox(); checkWin();
}

function checkWin(){
  for(let y=0;y<map.length;y++) for(let x=0;x<map[y].length;x++) if(map[y][x]==='G') return;
  setTimeout(()=>{
    alert('Level Complete!');
    currentLevel++;
    startBoxGame();
  },100);
}

function drawBox(){
  bctx.clearRect(0,0,400,320);
  for(let y=0;y<map.length;y++) for(let x=0;x<map[y].length;x++){
    if(map[y][x]==='#') bctx.fillStyle='#334155';
    else if(map[y][x]==='G') bctx.fillStyle='green';
    else if(map[y][x]==='B') bctx.fillStyle='orange';
    else continue;
    bctx.fillRect(x*tile,y*tile,tile,tile);
  }
  bctx.fillStyle='cyan'; bctx.fillRect(p.x*tile,p.y*tile,tile,tile);
}

// ===== SNAKE =====
const sCanvas=document.getElementById('snakeGame');
const sctx=sCanvas.getContext('2d');
let snake,food,dir,snakeTimer;
function startSnake(){ if(snakeTimer) clearInterval(snakeTimer); snake=[{x:10,y:10}]; dir={x:1,y:0}; food={x:Math.random()*20|0,y:Math.random()*20|0}; snakeTimer=setInterval(sLoop,120); }
function sLoop(){
  sctx.clearRect(0,0,400,400);
  const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
  if(head.x<0||head.y<0||head.x>=20||head.y>=20){ alert('Snake Over'); clearInterval(snakeTimer); snakeTimer=null; return; }
  snake.unshift(head);
  if(head.x===food.x && head.y===food.y) food={x:Math.random()*20|0,y:Math.random()*20|0}; else snake.pop();
  sctx.fillStyle='red'; sctx.fillRect(food.x*20,food.y*20,20,20);
  sctx.fillStyle='lime'; snake.forEach(p=>sctx.fillRect(p.x*20,p.y*20,20,20));
}

// ===== INPUT =====
document.addEventListener('keydown',e=>{
  const active=document.querySelector('.game:not([style*="display: none"])'); if(!active) return;
  if(active.id==='dodge' && player){ if(e.key==='ArrowLeft') player.x-=20; if(e.key==='ArrowRight') player.x+=20; player.x=Math.max(0,Math.min(400-player.w,player.x));}
  if(active.id==='box'){ const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}; if(m[e.key]) moveBox(m[e.key][0],m[e.key][1]);}
  if(active.id==='snake'){ if(e.key==='ArrowUp' && dir.y!==1) dir={x:0,y:-1}; if(e.key==='ArrowDown' && dir.y!==-1) dir={x:0,y:1}; if(e.key==='ArrowLeft' && dir.x!==1) dir={x:-1,y:0}; if(e.key==='ArrowRight' && dir.x!==-1) dir={x:1,y:0}; }
});

startBoxGame();
</script>
</body>
</html>
