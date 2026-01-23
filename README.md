<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My GitHub Game Site</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: #0f172a;
      color: #e5e7eb;
      text-align: center;
    }
    header {
      padding: 40px 20px;
      background: linear-gradient(135deg, #2563eb, #4f46e5);
    }
    main {
      max-width: 900px;
      margin: 40px auto;
      padding: 0 20px;
    }
    .card {
      background: #020617;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
      margin-bottom: 30px;
    }
    canvas {
      background: black;
      border-radius: 10px;
      display: block;
      margin: 20px auto;
    }
    button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      background: #2563eb;
      color: white;
      font-size: 1rem;
      cursor: pointer;
    }
    button:hover {
      background: #1d4ed8;
    }
  </style>
</head>
<body>
  <header>
    <h1>GitHub Games Website</h1>
    <p>Play games directly in your browser</p>
  </header>

  <main>
    <section class="card">
      <h2>🎮 Mini Game: Dodge the Blocks</h2>
      <p>Use ← → arrow keys to move. Avoid the falling blocks.</p>
      <canvas id="game" width="400" height="500"></canvas>
      <button onclick="startGame()">Start / Restart</button>
      <p id="score">Score: 0</p>
    </section>
  </main>

  <script>
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");

    let player, blocks, score, gameOver;

    function startGame() {
      player = { x: 180, y: 460, w: 40, h: 20 };
      blocks = [];
      score = 0;
      gameOver = false;
      document.getElementById("score").innerText = "Score: 0";
      requestAnimationFrame(loop);
    }

    document.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft") player.x -= 20;
      if (e.key === "ArrowRight") player.x += 20;
      player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));
    });

    function loop() {
      if (gameOver) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Player
      ctx.fillStyle = "cyan";
      ctx.fillRect(player.x, player.y, player.w, player.h);

      // Add blocks
      if (Math.random() < 0.03) {
        blocks.push({ x: Math.random() * 360, y: 0, s: 4 });
      }

      // Blocks
      ctx.fillStyle = "red";
      blocks.forEach(b => {
        b.y += b.s;
        ctx.fillRect(b.x, b.y, 40, 40);

        // Collision
        if (
          b.x < player.x + player.w &&
          b.x + 40 > player.x &&
          b.y < player.y + player.h &&
          b.y + 40 > player.y
        ) {
          gameOver = true;
          alert("Game Over! Score: " + score);
        }
      });

      blocks = blocks.filter(b => b.y < canvas.height);
      score++;
      document.getElementById("score").innerText = "Score: " + score;

      requestAnimationFrame(loop);
    }
  </script>
</body>
</html>
