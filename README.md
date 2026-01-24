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
  button.unlock-btn {
    padding:14px 40px; font-size:1.2rem; background:#2563eb; color:white; border:none;
    border-radius:8px; cursor:pointer;
  }
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

    <!-- Your game sections here (dodge, snake, 2048, alien) – same as before -->

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
// ────────────────────────────────────────────────
// FIREBASE CONFIG – PASTE YOUR OWN FROM FIREBASE CONSOLE
// ────────────────────────────────────────────────
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

// ────────────────────────────────────────────────
// PASSWORD + NAME
// ────────────────────────────────────────────────
const CORRECT_PASSWORD = 'bread';

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
// SHARED LEADERBOARD (Firebase)
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
  const ref = db.ref(path + '/' + currentPlayerName.replace(/[.#$[\]]/g, '_')); // safe key

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
    const entries = [];
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

// Live updates when someone else scores
Object.values(LEADERBOARD_PATHS).forEach(path => {
  db.ref(path).on('value', () => {
    if (document.getElementById('leaderboard').style.display !== 'none') {
      renderAll();
    }
  });
});

// ────────────────────────────────────────────────
// Your existing game logic here (dodge, snake, 2048, alien)
// Call updateLeaderboard('dodge', dScore) in game-over spots
// Example for dodge:
function dLoop() {
  // ... your code ...
  if (collision) {
    dOver = true;
    alert('Game Over! Score: ' + dScore);
    updateLeaderboard('dodge', dScore);
  }
  // ... rest ...
}

// Same for snake, alien, etc.
</script>
</body>
</html>
