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
#game2048 { display:block; margin:20px auto; width:400px; }
button.action { padding:10px 20px; border:none; border-radius:8px; background:#2563eb; color:white; cursor:pointer; margin-top:10px; }
#score2048 { font-size:1.2rem; margin-top:10px; text-align:center; }
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
  <button onclick="showGame('snake')">Snake</button>
  <button onclick="showGame('game2048')">2048</button>
  <button onclick="showGame('runner')">Subway Surfer</button>
</nav>

<main>
<section id="home" class="game" style="display:block">
  <h2>Welcome</h2>
  <p>Select a game from the menu above. All games run directly in your browser.</p>
</section>

<section id="dodge" class="game">
  <h2>Dodge the Blocks</h2>
  <canvas id="dodgeGame" width="400" height="500"></canvas>
  <button class="action" onclick="startDodge()">Start</button>
  <p id="dodgeScore">Score: 0</p>
</section>

<section id="snake" class="game">
  <h2>Snake</h2>
  <canvas id="snakeGame" width="400" height="400"></canvas>
  <button class="action" onclick="startSnake()">Start</button>
</section>

<section id="game2048" class="game">
  <h2>2048</h2>
  <div id="game2048"></div>
  <p id="score2048">Score: 0</p>
  <button class="action" onclick="init2048()">Restart</button>
</section>

<section id="runner" class="game">
  <h2>Subway Surfer–Style Runner</h2>
  <canvas id="runnerCanvas" width="400" height="400"></canvas>
  <p id="runnerScore">Score: 0</p>
  <button class="action" onclick="startRunner()">Start</button>
</section>
</main>

<script>
// ===== NAV =====
function showGame(id) {
  document.querySelectorAll('.game').forEach(g => g.style.display = 'none');
  document.getElementById(id).style.display = 'block';
  if(id!=='snake' && snakeTimer){ clearInterval(snakeTimer); snakeTimer=null; }
  if(id!=='runner' && runnerTimer){ clearInterval(runnerTimer); runnerTimer=null; }
}

// ===== DODGE GAME =====
const dCanvas = document.getElementById('dodgeGame');
const dctx = dCanvas.getContext('2d');
let player, blocks, dScore, dOver, speedMul, spawn;
function startDodge(){
  player={x:180,y:460,w:40,h:20}; blocks=[]; dScore=0; speedMul=1; spawn=0.03; dOver=false;
  requestAnimationFrame(dLoop);
}
function dLoop(){
  if(dOver) return;
  dctx.clearRect(0,0,400,500);
  dctx.fillStyle='cyan'; dctx.fillRect(player.x,player.y,player.w,player.h);
  if(Math.random()<spawn) blocks.push({x:Math.random()*360,y:0,s:4*speedMul});
  dctx.fillStyle='red'; blocks.forEach(b=>{ b.y+=b.s; dctx.fillRect(b.x,b.y,40,40); if(b.x<player.x+player.w&&b.x+40>player.x&&b.y<player.y+player.h&&b.y+40>player.y){ dOver=true; alert('Game Over! Score:'+dScore); } });
  blocks=blocks.filter(b=>b.y<500);
  dScore++; if(dScore%300===0){speedMul+=0.2;spawn+=0.005;}
  document.getElementById('dodgeScore').innerText='Score: '+dScore;
  requestAnimationFrame(dLoop);
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
  const active=document.querySelector('.game:not([style*="display:none"])'); if(!active) return;
  if(active.id==='dodge' && player){ if(e.key==='ArrowLeft') player.x-=20; if(e.key==='ArrowRight') player.x+=20; player.x=Math.max(0,Math.min(400-player.w,player.x));}
  if(active.id==='snake'){ if(e.key==='ArrowUp' && dir.y!==1) dir={x:0,y:-1}; if(e.key==='ArrowDown' && dir.y!==-1) dir={x:0,y:1}; if(e.key==='ArrowLeft' && dir.x!==1) dir={x:-1,y:0}; if(e.key==='ArrowRight' && dir.x!==-1) dir={x:1,y:0}; }
  if(active.id==='runner'){ if(e.key==='ArrowLeft') runnerX-=50; if(e.key==='ArrowRight') runnerX+=50; if(e.key===' ') runnerJump=true; }
});

// ===== 2048 =====
let grid,score2048;
function init2048(){
  grid=[[],[],[],[]]; for(let y=0;y<4;y++) for(let x=0;x<4;x++) grid[y][x]=0;
  score2048=0; addTile(); addTile(); drawGrid();
}
function addTile(){ let empty=[]; for(let y=0;y<4;y++) for(let x=0;x<4;x++) if(grid[y][x]===0) empty.push([y,x]); if(empty.length===0) return; let [y,x]=empty[Math.floor(Math.random()*empty.length)]; grid[y][x]=Math.random()<0.9?2:4; }
function drawGrid(){ let div=document.getElementById('game2048'); div.innerHTML=''; for(let y=0;y<4;y++){ let row=document.createElement('div'); row.style.display='flex'; for(let x=0;x<4;x++){ let cell=document.createElement('div'); cell.textContent=grid[y][x]||''; cell.style.width='90px'; cell.style.height='90px'; cell.style.margin='5px'; cell.style.background='#334155'; cell.style.display='flex'; cell.style.alignItems='center'; cell.style.justifyContent='center'; cell.style.fontSize='2rem'; cell.style.fontWeight='bold'; row.appendChild(cell);} div.appendChild(row);} document.getElementById('score2048').innerText='Score: '+score2048; }
document.addEventListener('keydown', e => {
  const active=document.querySelector('.game:not([style*="display:none"])'); if(!active || active.id!=='game2048') return;
  let moved=false;
  const rotate=function(mat){ return mat[0].map((val,col)=>mat.map(row=>row[col]).reverse()); };
  const combine=function(row){ for(let i=row.length-1;i>0;i--){ if(row[i]!==0 && row[i]===row[i-1]){ row[i]*=2; score2048+=row[i]; row[i-1]=0; moved=true; } } return row; };
  const slide=function(row){ let r=row.filter(n=>n!==0); while(r.length<4) r.unshift(0); return r; };
  const move=function(dir){ for(let k=0;k<dir;k++){ grid=rotate(grid); } for(let y=0;y<4;y++){ let row=grid[y]; row=combine(row); row=slide(row); grid[y]=row; } for(let k=0;k<(4-dir)%4;k++){ grid=rotate(grid); } drawGrid(); };
  if(e.key==='ArrowLeft'){ move(0); moved=true; }
  if(e.key==='ArrowUp'){ move(1); moved=true; }
  if(e.key==='ArrowRight'){ move(2); moved=true; }
  if(e.key==='ArrowDown'){ move(3); moved=true; }
  if(moved) addTile();
});

// ===== SUBWAY SURFER =====
const runnerCanvas=document.getElementById('runnerCanvas');
const rctx=runnerCanvas.getContext('2d');
let runnerX=175, runnerY=350, runnerJump=false, runnerObstacles=[], runnerScore=0, runnerTimer;
function startRunner(){ runnerX=175; runnerY=350; runnerJump=false; runnerObstacles=[]; runnerScore=0; if(runnerTimer) clearInterval(runnerTimer); runnerTimer=setInterval(rLoop,30);}
function rLoop(){
  rctx.clearRect(0,0,400,400);
  // Draw player
  if(runnerJump) runnerY-=8; else if(runnerY<350) runnerY+=8;
  if(runnerY>350) runnerY=350; runnerJump=false;
  rctx.fillStyle='cyan'; rctx.fillRect(runnerX,runnerY,50,50);
  // Obstacles
  if(Math.random()<0.03) runnerObstacles.push({x:Math.random()*350,y:-50});
  rctx.fillStyle='red';
  runnerObstacles.forEach(o=>{ o.y+=5; rctx.fillRect(o.x,o.y,50,50); if(runnerX<o.x+50 && runnerX+50>o.x && runnerY<o.y+50 && runnerY+50>o.y){ alert('Runner Over! Score:'+runnerScore); clearInterval(runnerTimer); runnerTimer=null; } });
  runnerObstacles=runnerObstacles.filter(o=>o.y<400);
  runnerScore++; document.getElementById('runnerScore').innerText='Score: '+runnerScore;
}
</script>
</body>
</html>
