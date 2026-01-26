
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Mini Game Arcade</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{margin:0;font-family:Arial;background:#020617;color:#e5e7eb}
header{text-align:center;padding:20px;background:linear-gradient(135deg,#2563eb,#4f46e5)}
nav{display:flex;justify-content:center;gap:10px;padding:10px;flex-wrap:wrap}
nav button{padding:8px 14px;border:none;border-radius:6px;background:#1e40af;color:#fff;cursor:pointer}
.game{display:none;padding:20px;text-align:center}
button.action{padding:8px 16px;margin:5px;border:none;border-radius:6px;background:#2563eb;color:#fff}

#boards{display:flex;justify-content:center;gap:20px;flex-wrap:wrap}
.board{position:relative;width:260px;height:260px;background:#111}
.tile{position:absolute;width:60px;height:60px;margin:5px;
display:flex;align-items:center;justify-content:center;
font-weight:bold;font-size:18px;background:#374151}

.timer{font-size:18px;margin:5px;color:#facc15}
</style>
</head>

<body>
<header>
<h1>Mini Game Arcade</h1>
<p>2048 Multiplayer • Turn-Based • Attacks • Mobile Support</p>
</header>

<nav>
<button onclick="showGame('g2048')">2048</button>
</nav>

<section id="g2048" class="game">
<h2>2048 Multiplayer</h2>

<div class="timer" id="turnTimer">Timer: --</div>

<div id="boards">
  <div>
    <h3>You</h3>
    <div id="myBoard" class="board"></div>
    <p id="score">Score: 0</p>
  </div>
  <div>
    <h3>Opponent</h3>
    <div id="oppBoard" class="board"></div>
  </div>
</div>

<button class="action" onclick="initGame()">Restart</button>
<button class="action" onclick="host()">Host</button>
<button class="action" onclick="join()">Join</button>

<p id="status">Single Player</p>
</section>

<script>
let active=null
function showGame(id){
 document.querySelectorAll('.game').forEach(g=>g.style.display='none')
 document.getElementById(id).style.display='block'
 active=id
}
showGame('g2048')

/* ===== 2048 CORE ===== */
let grid,oppGrid,score=0
const SIZE=4
const WIN=2048

function initGame(){
 grid=[...Array(SIZE)].map(()=>Array(SIZE).fill(0))
 oppGrid=[...Array(SIZE)].map(()=>Array(SIZE).fill(0))
 score=0
 addTile(grid);addTile(grid)
 draw()
}

function addTile(g,val=2){
 let e=[]
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(!g[y][x])e.push([y,x])
 if(e.length){
  let [y,x]=e[Math.random()*e.length|0]
  g[y][x]=val
 }
}

function slide(row){
 row=row.filter(v=>v)
 for(let i=0;i<row.length-1;i++){
  if(row[i]===row[i+1]){
   row[i]*=2
   score+=row[i]
   if(row[i]>=64 && multiplayer) sendGarbage()
   if(row[i]===WIN) win()
   row[i+1]=0
  }
 }
 row=row.filter(v=>v)
 while(row.length<SIZE)row.push(0)
 return row
}

function move(dx,dy){
 if(multiplayer&&!myTurn)return
 let before=JSON.stringify(grid)
 for(let i=0;i<SIZE;i++){
  let line=[]
  for(let j=0;j<SIZE;j++){
   let x=dx?(dx>0?SIZE-1-j:j):i
   let y=dy?(dy>0?SIZE-1-j:j):i
   line.push(dx?grid[i][x]:grid[y][i])
  }
  line=slide(line)
  for(let j=0;j<SIZE;j++){
   let x=dx?(dx>0?SIZE-1-j:j):i
   let y=dy?(dy>0?SIZE-1-j:j):i
   dx?grid[i][x]=line[j]:grid[y][i]=line[j]
  }
 }
 if(before!==JSON.stringify(grid)){
  addTile(grid)
  endTurn()
 }
}

function drawBoard(el,g){
 el.innerHTML=''
 g.forEach((r,y)=>r.forEach((v,x)=>{
  if(v){
   let d=document.createElement('div')
   d.className='tile'
   d.textContent=v
   d.style.left=x*65+'px'
   d.style.top=y*65+'px'
   el.appendChild(d)
  }
 }))
}

function draw(){
 drawBoard(myBoard,grid)
 drawBoard(oppBoard,oppGrid)
 score.innerText="Score: "+score
}

function gameOver(){
 alert("Game Over")
 if(multiplayer) send({t:'lose'})
}

function win(){
 alert("You Win!")
 if(multiplayer) send({t:'win'})
}

/* ===== MULTIPLAYER ===== */
let pc,dc,multiplayer=false,myTurn=false,timer

function host(){
 multiplayer=true
 myTurn=true
 status.innerText="Hosting — Your Turn"
 setup(true)
 startTimer()
}

function join(){
 multiplayer=true
 myTurn=false
 status.innerText="Joined — Opponent Turn"
 setup(false)
}

function setup(isHost){
 pc=new RTCPeerConnection()
 if(isHost){
  dc=pc.createDataChannel("g")
  bind()
 }else{
  pc.ondatachannel=e=>{dc=e.channel;bind()}
 }
 pc.onicecandidate=e=>e.candidate&&console.log(JSON.stringify(e.candidate))
 if(isHost){
  pc.createOffer().then(o=>{
   pc.setLocalDescription(o)
   alert("SEND OFFER:\n"+JSON.stringify(o))
  })
 }else{
  let o=JSON.parse(prompt("PASTE OFFER"))
  pc.setRemoteDescription(o)
  pc.createAnswer().then(a=>{
   pc.setLocalDescription(a)
   alert("SEND ANSWER:\n"+JSON.stringify(a))
  })
 }
}

function bind(){
 dc.onmessage=e=>{
  let d=JSON.parse(e.data)
  if(d.t==='state'){oppGrid=d.g;draw();myTurn=true;startTimer()}
  if(d.t==='garbage'){addTile(grid,2);draw()}
  if(d.t==='lose'){alert("Opponent lost!")}
  if(d.t==='win'){alert("Opponent won")}
 }
}

function send(o){dc&&dc.readyState==='open'&&dc.send(JSON.stringify(o))}

function endTurn(){
 draw()
 if(multiplayer){
  send({t:'state',g:grid})
  myTurn=false
  clearInterval(timer)
 }
 if(isOver(grid))gameOver()
}

function isOver(g){
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  if(!g[y][x])return false
  if(x<SIZE-1&&g[y][x]===g[y][x+1])return false
  if(y<SIZE-1&&g[y][x]===g[y+1][x])return false
 }
 return true
}

function sendGarbage(){send({t:'garbage'})}

/* ===== TURN TIMER ===== */
function startTimer(){
 let t=10
 turnTimer.innerText="Timer: "+t
 timer=setInterval(()=>{
  t--
  turnTimer.innerText="Timer: "+t
  if(t<=0){
   clearInterval(timer)
   myTurn=false
   send({t:'state',g:grid})
  }
 },1000)
}

/* ===== INPUT ===== */
document.addEventListener('keydown',e=>{
 if(active!=='g2048')return
 let k=e.key.toLowerCase()
 if(k==='a'||k==='arrowleft')move(-1,0)
 if(k==='d'||k==='arrowright')move(1,0)
 if(k==='w'||k==='arrowup')move(0,-1)
 if(k==='s'||k==='arrowdown')move(0,1)
})

/* ===== MOBILE SWIPE ===== */
let sx,sy
document.addEventListener('touchstart',e=>{
 sx=e.touches[0].clientX
 sy=e.touches[0].clientY
})
document.addEventListener('touchend',e=>{
 let dx=e.changedTouches[0].clientX-sx
 let dy=e.changedTouches[0].clientY-sy
 if(Math.abs(dx)>Math.abs(dy)){
  dx>0?move(1,0):move(-1,0)
 }else{
  dy>0?move(0,1):move(0,-1)
 }
})

initGame()
</script>
</body>
</html>
