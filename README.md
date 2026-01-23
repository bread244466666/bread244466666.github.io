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
#dodgeScore { font-size:1.2rem; margin-top:10px; text-align:center; }
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
</main>

<script>
// ===== NAV =====
function showGame(id) {
  document.querySelectorAll('.game').forEach(g => g.style.display = 'none');
  document.getElementById(id).style.display = 'block';
  if(id!=='snake' && snakeTimer){ clearInterval(snakeTimer); snakeTimer=null; }
}

// ===== DODGE =====
const dCanvas = document.getElementById('dodgeGame');
const dctx = dCanvas.getContext('2d');
let player, blocks, dScore, dOver, speedMul, spawn;
function startDodge(){
  player={x:180,y:460,w:40,h:20}; blocks=[]; dScore=0; speedMul=1; spawn=0.03; dOver=false;
  document.getElementById('dodgeScore').innerText='Score: 0';
  requestAnimationFrame(dLoop);
}
function dLoop(){
  if(dOver) return;
  dctx.clearRect(0,0,400,500);
  // Draw player
  dctx.fillStyle='cyan'; dctx.fillRect(player.x,player.y,player.w,player.h);
  // Spawn blocks
  if(Math.random()<spawn) blocks.push({x:Math.random()*360,y:0,s:4*speedMul});
  // Draw blocks and collision
  dctx.fillStyle='red';
  blocks.forEach(b=>{
    b.y+=b.s; 
    dctx.fillRect(b.x,b.y,40,40);
    if(b.x < player.x + player.w && b.x + 40 > player.x && b.y < player.y + player.h && b.y + 40 > player.y){
      dOver=true; 
      alert('Game Over! Score: '+dScore);
    }
  });
  blocks = blocks.filter(b => b.y<500);
  dScore++; 
  if(dScore%300===0){ speedMul+=0.2; spawn+=0.005; }
  document.getElementById('dodgeScore').innerText='Score: '+dScore;
  requestAnimationFrame(dLoop);
}

// ===== SNAKE =====
const sCanvas=document.getElementById('snakeGame');
const sctx=sCanvas.getContext('2d');
let snake,food,dir,snakeTimer;
function startSnake(){ 
  if(snakeTimer) clearInterval(snakeTimer); 
  snake=[{x:10,y:10}]; 
  dir={x:1,y:0}; 
  food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)}; 
  snakeTimer=setInterval(sLoop,120); 
}
function sLoop(){
  sctx.clearRect(0,0,400,400);
  const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
  if(head.x<0||head.y<0||head.x>=20||head.y>=20){ alert('Snake Over'); clearInterval(snakeTimer); snakeTimer=null; return; }
  snake.unshift(head);
  if(head.x===food.x && head.y===food.y) food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)}; else snake.pop();
  sctx.fillStyle='red'; sctx.fillRect(food.x*20,food.y*20,20,20);
  sctx.fillStyle='lime'; snake.forEach(p=>sctx.fillRect(p.x*20,p.y*20,20,20));
}

// ===== GLOBAL WASD INPUT =====
document.addEventListener('keydown', e=>{
  const key = e.key.toLowerCase();

  // DODGE
  if(document.getElementById('dodge').style.display==='block'){
    if(key==='a') player.x-=20;
    if(key==='d') player.x+=20;
    player.x=Math.max(0,Math.min(400-player.w,player.x));
  }

  // SNAKE
  if(document.getElementById('snake').style.display==='block'){
    if(key==='w' && dir.y!==1) dir={x:0,y:-1};
    if(key==='s' && dir.y!==-1) dir={x:0,y:1};
    if(key==='a' && dir.x!==1) dir={x:-1,y:0};
    if(key==='d' && dir.x!==-1) dir={x:1,y:0};
  }
});
</script>
</body>
</html>
