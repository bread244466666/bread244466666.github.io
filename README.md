<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Mini Game Arcade</title>
<meta name="viewport" content="width=device-width, initial-scale=1">

<style>
body{margin:0;font-family:Arial;background:#020617;color:#e5e7eb}
header{padding:30px;text-align:center;background:linear-gradient(135deg,#2563eb,#4f46e5)}
nav{display:flex;justify-content:center;gap:15px;padding:15px;flex-wrap:wrap}
nav button{padding:10px 18px;border:none;border-radius:8px;background:#1e40af;color:white;cursor:pointer}
.game{display:none;padding:24px;text-align:center}
canvas{background:black;border-radius:10px}
button.action{padding:10px 20px;margin-top:10px;border:none;border-radius:8px;background:#2563eb;color:white}

#game2048{
  position:relative;
  width:400px;
  height:400px;
  margin:auto;
  background:#111;
}
#game2048 div{
  position:absolute;
  width:90px;height:90px;
  margin:5px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:24px;
  font-weight:bold;
  background:#374151;
}
</style>
</head>

<body>

<header>
<h1>Mini Game Arcade</h1>
<p>WASD / Arrow Keys • Space to shoot</p>
</header>

<nav>
<button onclick="showGame('dodge')">Dodge</button>
<button onclick="showGame('snake')">Snake</button>
<button onclick="showGame('game2048Section')">2048</button>
<button onclick="showGame('alien')">Alien</button>
</nav>

<section id="dodge" class="game">
<h2>Dodge</h2>
<canvas id="dodgeGame" width="400" height="450"></canvas><br>
<button class="action" onclick="startDodge()">Start</button>
<p id="dodgeScore">Score: 0</p>
</section>

<section id="snake" class="game">
<h2>Snake</h2>
<canvas id="snakeGame" width="400" height="400"></canvas><br>
<button class="action" onclick="startSnake()">Start</button>
</section>

<section id="game2048Section" class="game">
<h2>2048</h2>
<div id="game2048"></div>
<p id="score2048">Score: 0</p>
<button class="action" onclick="init2048()">Restart</button>
</section>

<section id="alien" class="game">
<h2>Alien Shooter</h2>
<canvas id="alienGame" width="400" height="450"></canvas><br>
<button class="action" onclick="startAlien()">Start</button>
<p id="scoreAlien">Score: 0</p>
</section>

<script>
let activeGame=null
function showGame(id){
  document.querySelectorAll('.game').forEach(g=>g.style.display='none')
  document.getElementById(id).style.display='block'
  activeGame=id
}

/* ---------- DODGE ---------- */
const dctx=dodgeGame.getContext('2d')
let player,blocks,dScore,dRaf

function startDodge(){
  player={x:180,y:420,w:40,h:20}
  blocks=[]
  dScore=0
  cancelAnimationFrame(dRaf)
  dLoop()
}
function dLoop(){
  dctx.clearRect(0,0,400,450)
  dctx.fillStyle='cyan'
  dctx.fillRect(player.x,player.y,player.w,player.h)

  if(Math.random()<0.04) blocks.push({x:Math.random()*360,y:0,s:4})

  dctx.fillStyle='red'
  for(let b of blocks){
    b.y+=b.s
    dctx.fillRect(b.x,b.y,40,40)
    if(b.x<player.x+40&&b.x+40>player.x&&b.y<player.y+20&&b.y+40>player.y){
      alert("Game Over! Score: "+dScore)
      return
    }
  }
  blocks=blocks.filter(b=>b.y<450)
  dScore++
  dodgeScore.innerText="Score: "+dScore
  dRaf=requestAnimationFrame(dLoop)
}

/* ---------- SNAKE ---------- */
const sctx=snakeGame.getContext('2d')
let snake,food,dir,sTimer
function startSnake(){
  clearInterval(sTimer)
  snake=[{x:10,y:10}]
  dir={x:1,y:0}
  food={x:5,y:5}
  sTimer=setInterval(sLoop,130)
}
function sLoop(){
  sctx.clearRect(0,0,400,400)
  let h={x:snake[0].x+dir.x,y:snake[0].y+dir.y}
  if(h.x<0||h.x>=20||h.y<0||h.y>=20) return clearInterval(sTimer)
  snake.unshift(h)
  if(h.x===food.x&&h.y===food.y) food={x:Math.random()*20|0,y:Math.random()*20|0}
  else snake.pop()
  sctx.fillStyle='red'
  sctx.fillRect(food.x*20,food.y*20,20,20)
  sctx.fillStyle='lime'
  snake.forEach(p=>sctx.fillRect(p.x*20,p.y*20,20,20))
}

/* ---------- 2048 ---------- */
let grid,score2048

function init2048(){
  grid=[...Array(4)].map(()=>Array(4).fill(0))
  score2048=0
  addTile();addTile()
  drawGrid()
}

function addTile(){
  let empty=[]
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(!grid[y][x])empty.push([y,x])
  if(empty.length){
    let [y,x]=empty[Math.random()*empty.length|0]
    grid[y][x]=Math.random()<0.9?2:4
  }
}

function slide(row){
  row=row.filter(v=>v)
  for(let i=0;i<row.length-1;i++){
    if(row[i]===row[i+1]){
      row[i]*=2
      score2048+=row[i]
      row[i+1]=0
    }
  }
  row=row.filter(v=>v)
  while(row.length<4) row.push(0)
  return row
}

function move(dx,dy){
  let moved=false
  let copy=JSON.stringify(grid)

  for(let i=0;i<4;i++){
    let line=[]
    for(let j=0;j<4;j++){
      let x=dx? (dx>0?3-j:j):i
      let y=dy? (dy>0?3-j:j):i
      line.push(dx?grid[i][x]:grid[y][i])
    }
    line=slide(line)
    for(let j=0;j<4;j++){
      let x=dx? (dx>0?3-j:j):i
      let y=dy? (dy>0?3-j:j):i
      dx?grid[i][x]=line[j]:grid[y][i]=line[j]
    }
  }
  if(copy!==JSON.stringify(grid)){
    addTile()
    drawGrid()
    if(isGameOver()) alert("2048 Game Over!")
  }
}

function isGameOver(){
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    if(!grid[y][x]) return false
    if(x<3 && grid[y][x]===grid[y][x+1]) return false
    if(y<3 && grid[y][x]===grid[y+1][x]) return false
  }
  return true
}

function drawGrid(){
  game2048.innerHTML=''
  grid.forEach((r,y)=>r.forEach((v,x)=>{
    if(v){
      let d=document.createElement('div')
      d.textContent=v
      d.style.left=x*100+'px'
      d.style.top=y*100+'px'
      game2048.appendChild(d)
    }
  }))
  score2048.innerText="Score: "+score2048
}

/* ---------- ALIEN ---------- */
const actx=alienGame.getContext('2d')
let aPlayer,aliens,bullets,aTimer,aScore
function startAlien(){
  aPlayer={x:200,y:420}
  aliens=[];bullets=[];aScore=0
  clearInterval(aTimer)
  setInterval(()=>aliens.push({x:Math.random()*360,y:0}),1800)
  aTimer=setInterval(aLoop,20)
}
function aLoop(){
  actx.clearRect(0,0,400,450)
  actx.fillStyle='cyan'
  actx.fillRect(aPlayer.x-15,aPlayer.y-15,30,30)
  bullets.forEach(b=>b.y-=8)
  aliens.forEach(a=>a.y+=2)
  bullets=bullets.filter(b=>b.y>0)
  aliens=aliens.filter(a=>{
    for(let b of bullets){
      if(Math.hypot(a.x-b.x,a.y-b.y)<15){
        aScore++; scoreAlien.innerText="Score: "+aScore
        return false
      }
    }
    return a.y<450
  })
  actx.fillStyle='yellow'
  bullets.forEach(b=>actx.fillRect(b.x,b.y,3,10))
  actx.fillStyle='red'
  aliens.forEach(a=>{actx.beginPath();actx.arc(a.x,a.y,15,0,7);actx.fill()})
}

/* ---------- INPUT ---------- */
document.addEventListener('keydown',e=>{
  let k=e.key.toLowerCase()

  if(activeGame==='dodge'){
    if(k==='a') player.x=Math.max(0,player.x-20)
    if(k==='d') player.x=Math.min(360,player.x+20)
  }

  if(activeGame==='snake'){
    if(k==='w')dir={x:0,y:-1}
    if(k==='s')dir={x:0,y:1}
    if(k==='a')dir={x:-1,y:0}
    if(k==='d')dir={x:1,y:0}
  }

  if(activeGame==='game2048Section'){
    if(k==='a'||k==='arrowleft') move(-1,0)
    if(k==='d'||k==='arrowright') move(1,0)
    if(k==='w'||k==='arrowup') move(0,-1)
    if(k==='s'||k==='arrowdown') move(0,1)
  }

  if(activeGame==='alien'){
    if(k==='a')aPlayer.x-=15
    if(k==='d')aPlayer.x+=15
    if(k===' ')bullets.push({x:aPlayer.x,y:aPlayer.y})
  }
})

init2048()
</script>
</body>
</html>
