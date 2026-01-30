<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Mini Game Arcade</title>

<style>
body {
  margin:0;
  font-family:Arial, Helvetica, sans-serif;
  background:#020617;
  color:#e5e7eb;
  min-height:100vh;
}

header {
  padding:30px;
  text-align:center;
  background:linear-gradient(135deg,#2563eb,#4f46e5);
}

#password-screen, #name-screen {
  position:fixed;
  inset:0;
  background:#020617;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  gap:20px;
  z-index:100;
}

.hidden { display:none; }

input {
  padding:14px 18px;
  font-size:1.2rem;
  width:320px;
  max-width:90%;
  border-radius:8px;
  border:2px solid #4f46e5;
  background:#1e293b;
  color:white;
}

button {
  padding:12px 24px;
  border:none;
  border-radius:8px;
  background:#2563eb;
  color:white;
  cursor:pointer;
}

button:hover { background:#1d4ed8; }

nav {
  display:flex;
  justify-content:center;
  gap:15px;
  padding:15px;
  flex-wrap:wrap;
}

.game {
  display:none;
  padding:24px;
  overflow:visible;
}

canvas {
  display:block;
  margin:auto;
  background:black;
  border-radius:10px;
}

/* 2048 */
#game2048-board {
  width:400px;
  height:400px;
  margin:20px auto;
  position:relative;
  background:#111827;
  border-radius:10px;
}

.tile {
  width:90px;
  height:90px;
  position:absolute;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:2rem;
  font-weight:bold;
  border-radius:10px;
  color:white;
  transition:all 0.15s ease;
}
</style>
</head>

<body>

<div id="password-screen">
  <h2>Password</h2>
  <input id="password-input" type="password">
  <button onclick="unlockPassword()">Unlock</button>
  <div id="password-error"></div>
</div>

<div id="name-screen" class="hidden">
  <h2>Your Name</h2>
  <input id="name-input">
  <button onclick="unlockName()">Play</button>
</div>

<div id="main-content" style="display:none;">
<header>
  <h1>🎮 Mini Game Arcade</h1>
  <p>Use W A S D</p>
</header>

<nav>
  <button onclick="showGame('home')">Home</button>
  <button onclick="showGame('dodge')">Dodge</button>
  <button onclick="showGame('snake')">Snake</button>
  <button onclick="showGame('game2048')">2048</button>
  <button onclick="showGame('alien')">Alien</button>
</nav>

<main>

<section id="home" class="game" style="display:block">
  <h2>Welcome!</h2>
</section>

<section id="dodge" class="game">
  <h2>Dodge</h2>
  <canvas id="dodgeGame" width="400" height="450"></canvas>
  <p id="dodgeScore">Score: 0</p>
</section>

<section id="snake" class="game">
  <h2>Snake</h2>
  <canvas id="snakeGame" width="400" height="400"></canvas>
</section>

<section id="game2048" class="game">
  <h2>2048</h2>
  <div id="game2048-board"></div>
  <p id="score2048">Score: 0</p>
  <button onclick="init2048()">Restart</button>
</section>

<section id="alien" class="game">
  <h2>Alien Shooter</h2>
  <canvas id="alienGame" width="400" height="450"></canvas>
  <p id="scoreAlien">Score: 0</p>
</section>
<script>
/* PASSWORD */
const PASSWORD="bread";
function unlockPassword(){
  if(password-input.value===PASSWORD){
    password-screen.classList.add("hidden");
    name-screen.classList.remove("hidden");
  } else password-error.innerText="Wrong password";
}
function unlockName(){
  name-screen.classList.add("hidden");
  main-content.style.display="block";
}

/* SWITCHER */
function showGame(id){
  document.querySelectorAll(".game").forEach(g=>g.style.display="none");
  document.getElementById(id).style.display="block";
}

/* ───── DODGE ───── */
const d=document.getElementById("dodgeGame").getContext("2d");
let p={x:180,y:420,w:40,h:20}, blocks=[], dScore=0;
function dodgeLoop(){
  d.clearRect(0,0,400,450);
  d.fillStyle="cyan"; d.fillRect(p.x,p.y,p.w,p.h);
  if(Math.random()<0.04) blocks.push({x:Math.random()*360,y:0});
  d.fillStyle="red";
  blocks.forEach(b=>{
    b.y+=4;
    d.fillRect(b.x,b.y,40,40);
    if(b.y>450){ dScore++; dodgeScore.innerText="Score: "+dScore; }
  });
  blocks=blocks.filter(b=>b.y<450);
  requestAnimationFrame(dodgeLoop);
}
dodgeLoop();

/* ───── SNAKE ───── */
const s=document.getElementById("snakeGame").getContext("2d");
let snake=[{x:10,y:10}], food={x:5,y:5}, dir={x:1,y:0};
setInterval(()=>{
  s.clearRect(0,0,400,400);
  let h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
  if(h.x<0||h.y<0||h.x>=20||h.y>=20) snake=[{x:10,y:10}];
  snake.unshift(h);
  if(h.x===food.x&&h.y===food.y)
    food={x:Math.random()*20|0,y:Math.random()*20|0};
  else snake.pop();
  s.fillStyle="red"; s.fillRect(food.x*20,food.y*20,20,20);
  s.fillStyle="lime"; snake.forEach(p=>s.fillRect(p.x*20,p.y*20,20,20));
},140);

/* ───── 2048 ───── */
let grid=[], score2048=0;
const colors={2:'#eee4da',4:'#ede0c8',8:'#f2b179',16:'#f59563',32:'#f67c5f',64:'#f65e3b'};
function init2048(){
  grid=Array(4).fill().map(()=>Array(4).fill(0));
  score2048=0; addTile(); addTile(); draw2048();
}
function addTile(){
  let e=[]; for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(!grid[y][x])e.push([y,x]);
  if(!e.length) return;
  let [y,x]=e[Math.random()*e.length|0];
  grid[y][x]=2;
}
function draw2048(){
  const b=document.getElementById("game2048-board");
  b.innerHTML="";
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    let v=grid[y][x]; if(!v) continue;
    let t=document.createElement("div");
    t.className="tile"; t.textContent=v;
    t.style.background=colors[v]||"#333";
    t.style.left=x*100+5+"px";
    t.style.top=y*100+5+"px";
    b.appendChild(t);
  }
  score2048.innerText="Score: "+score2048;
}

/* ───── ALIEN ───── */
const a=document.getElementById("alienGame").getContext("2d");
let ship={x:200,y:420}, aliens=[];
setInterval(()=>{
  a.clearRect(0,0,400,450);
  a.fillStyle="cyan"; a.fillRect(ship.x-15,ship.y-15,30,30);
  if(Math.random()<0.03) aliens.push({x:Math.random()*380,y:0});
  a.fillStyle="red";
  aliens.forEach(al=>{ al.y+=2; a.fillRect(al.x,al.y,20,20); });
  aliens=aliens.filter(al=>al.y<460);
},30);

/* INPUT */
document.addEventListener("keydown",e=>{
  let k=e.key.toLowerCase();
  if(k==="a") ship.x-=15;
  if(k==="d") ship.x+=15;
  if(k==="a") p.x-=20;
  if(k==="d") p.x+=20;
  if("wasd".includes(k)) e.preventDefault();
});
</script>

</body>
</html>

</main>
</div>
