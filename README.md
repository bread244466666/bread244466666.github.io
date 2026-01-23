
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
#score2048, #dodgeScore, #scoreAlien { font-size:1.2rem; margin-top:10px; text-align:center; }
#game2048 { display:block; margin:20px auto; width:400px; height:400px; position:relative; }
.tile { width:90px; height:90px; position:absolute; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:bold; border-radius:10px; color:white; transition: all 0.15s ease; }
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
  <button onclick="showGame('alien')">Alien Shooter</button>
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

<section id="alien" class="game">
  <h2>Alien Shooter</h2>
  <canvas id="alienGame" width="400" height="500"></canvas>
  <button class="action" onclick="startAlien()">Start</button>
  <p id="scoreAlien">Score: 0</p>
</section>
</main>

<script>
// ===== NAV =====
function showGame(id) {
  document.querySelectorAll('.game').forEach(g => g.style.display = 'none');
  document.getElementById(id).style.display = 'block';
  if(id!=='snake' && snakeTimer){ clearInterval(snakeTimer); snakeTimer=null; }
  if(id!=='alien' && alienTimer){ clearInterval(alienTimer); alienTimer=null; }
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
  dctx.fillStyle='cyan'; dctx.fillRect(player.x,player.y,player.w,player.h);
  if(Math.random()<spawn) blocks.push({x:Math.random()*360,y:0,s:4*speedMul});
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

// ===== 2048 =====
let grid,score2048;
const tileColors = {0:'#334155',2:'#eee4da',4:'#ede0c8',8:'#f2b179',16:'#f59563',32:'#f67c5f',
64:'#f65e3b',128:'#edcf72',256:'#edcc61',512:'#edc850',1024:'#edc53f',2048:'#edc22e'};
function init2048(){
  grid=[[],[],[],[]]; for(let y=0;y<4;y++) for(let x=0;x<4;x++) grid[y][x]=0;
  score2048=0; addTile(); addTile(); drawGrid();
}
function addTile(){ 
  let empty=[]; 
  for(let y=0;y<4;y++) for(let x=0;x<4;x++) if(grid[y][x]===0) empty.push([y,x]); 
  if(empty.length===0) return; 
  let [y,x]=empty[Math.floor(Math.random()*empty.length)]; 
  grid[y][x]=Math.random()<0.9?2:4; 
}
function drawGrid(){ 
  const div=document.getElementById('game2048'); div.innerHTML='';
  for(let y=0;y<4;y++){ 
    for(let x=0;x<4;x++){ 
      const value=grid[y][x];
      if(value===0) continue;
      let tile=document.createElement('div');
      tile.className='tile';
      tile.style.backgroundColor=tileColors[value]||'#3c3a32';
      tile.style.left=(x*100+5)+'px';
      tile.style.top=(y*100+5)+'px';
      tile.textContent=value;
      div.appendChild(tile);
    }
  }
  document.getElementById('score2048').innerText='Score: '+score2048;
}
function moveGrid(direction){
  let moved=false;
  function slide(row){ let arr=row.filter(n=>n!==0); while(arr.length<4) arr.push(0); return arr; }
  function combine(row){ 
    for(let i=0;i<3;i++){ 
      if(row[i]!==0 && row[i]===row[i+1]){ 
        row[i]*=2; 
        score2048+=row[i]; 
        row[i+1]=0; 
        moved=true; 
      } 
    } 
    return row; 
  }
  const rotationMap = { 'w':3, 'a':0, 's':1, 'd':2 };
  const rotations = rotationMap[direction];
  const rotate = (mat) => mat[0].map((val,col)=>mat.map(r=>r[col]).reverse());

  for(let k=0;k<rotations;k++) grid=rotate(grid);

  for(let y=0;y<4;y++){
    let row=grid[y]; let before=[...row];
    row=slide(row); row=combine(row); row=slide(row); grid[y]=row;
    if(!moved) moved=!row.every((v,i)=>v===before[i]);
  }

  for(let k=0;k<(4-rotations)%4;k++) grid=rotate(grid);

  if(moved){ addTile(); drawGrid(); }
  else if(isFull() && !canMove()){ alert('Game Over!'); }
}
function isFull(){ return grid.flat().every(v=>v!==0); }
function canMove(){ for(let y=0;y<4;y++) for(let x=0;x<4;x++){ if(x<3 && grid[y][x]===grid[y][x+1]) return true; if(y<3 && grid[y][x]===grid[y+1][x]) return true; } return false; }

// ===== ALIEN SHOOTER (NEAT VERSION) =====
const aCanvas = document.getElementById('alienGame');
const actx = aCanvas.getContext('2d');
let aPlayer, aliens, bullets, aScore, alienTimer, alienOver, alienSpeed;

function startAlien(){
  aPlayer = {x:200, y:480, w:20, h:20};
  aliens = []; bullets = []; aScore = 0; alienOver = false; alienSpeed = 1;
  document.getElementById('scoreAlien').innerText='Score: 0';
  if(alienTimer) clearInterval(alienTimer);
  alienTimer = setInterval(alienLoop,20);
  spawnAlien();
}

function spawnAlien(){
  if(alienOver) return;
  const x = Math.random()*360 + 20;
  aliens.push({x:x,y:0,r:15});
  setTimeout(spawnAlien,1200);
}

function alienLoop(){
  if(alienOver) return;
  actx.clearRect(0,0,400,500);

  // Draw player triangle
  actx.fillStyle='cyan';
  actx.beginPath();
  actx.moveTo(aPlayer.x, aPlayer.y);
  actx.lineTo(aPlayer.x - aPlayer.w, aPlayer.y + aPlayer.h);
  actx.lineTo(aPlayer.x + aPlayer.w, aPlayer.y + aPlayer.h);
  actx.closePath();
  actx.fill();

  // Draw bullets
  bullets.forEach((b,i)=>{
    b.y -=6;
    actx.strokeStyle='yellow';
    actx.lineWidth=2;
    actx.beginPath();
    actx.moveTo(b.x,b.y);
    actx.lineTo(b.x,b.y-10);
    actx.stroke();

    aliens.forEach((al,j)=>{
      if(Math.hypot(b.x-al.x,b.y-al.y)<al.r){ aliens.splice(j,1); bullets.splice(i,1); aScore+=10; document.getElementById('scoreAlien').innerText='Score: '+aScore; }
    });
  });
  bullets = bullets.filter(b=>b.y>0);

  // Draw and move aliens
  aliens.forEach((al,i)=>{
    al.y += alienSpeed;
    actx.fillStyle='red';
    actx.beginPath();
    actx.arc(al.x,al.y,al.r,0,Math.PI*2);
    actx.fill();
    if(al.y + al.r >= 500){ alienOver=true; alert('Game Over! Score: '+aScore); }
  });
  alienSpeed += 0.0005;
}

// ===== GLOBAL INPUT =====
document.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
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
  // 2048
  if(document.getElementById('game2048').style.display==='block'){
    if(['w','a','s','d'].includes(key)) moveGrid(key);
  }
  // ALIEN SHOOTER
  if(document.getElementById('alien').style.display==='block'){
    if(key==='a'||e.key==='ArrowLeft') aPlayer.x-=5;
    if(key==='d'||e.key==='ArrowRight') aPlayer.x+=5;
    aPlayer.x=Math.max(0,Math.min(400-aPlayer.w,aPlayer.x));
    if(e.key===' ') bullets.push({x:aPlayer.x, y:aPlayer.y});
  }
});
</script>
</body>
</html>
