const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");

const SHIFT_ORANGE = "#FC6423";
const SHIFT_BG = "#1f2937";

// photographic background
const bgImage = new Image();
let bgReady = false;
bgImage.src = "bg1.jpg";
bgImage.onload = () => { bgReady = true; };

let keys = {};
let bullets = [];
let enemies = [];
let pickups = [];
let effects = []; // hit flashes
let devMessages = [];
let score = 0;
let lives = 3;
let gameOver = false;
let gameStarted = false;
let enemySpawnTimer = 0;
let pickupSpawnTimer = 0;
let shootCooldown = 0; // frames until next shot allowed
let gameTime = 0; // frames since start (for difficulty) 
let nextBossScore = 120; // first boss at ~120, then increments


// shake state
let shakeTimer = 0;
let shakeAmount = 0



// player is fixed near the left edge and moves vertically with smooth velocity
const player = {
  x: 40, // constant x position
  y: canvas.height / 2 - 20,
  width: 40,
  height: 40,
  vy: 0,
  accel: 0.7,
  damping: 0.85,
  maxSpeed: 8
};

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;

  if (e.code === "Enter") {
    if (!gameStarted) {
      gameStarted = true;
      restartGame();
    }
  }

  if (e.code === "Space" && gameStarted && !gameOver) {
    shoot();
  }

  if (e.code === "KeyR" && gameOver) {
    // restart and resume immediately
    restartGame();
    gameStarted = true;
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

function shoot() {
  if (shootCooldown > 0) return;
  // bullets originate from the beak area and travel right
  bullets.push({
    x: player.x + player.width,
    y: player.y + 16 + 2, // just out of the beak
    width: 16,
    height: 8,
    speed: 8
  });
  shootCooldown = 15; // about 15 frames cooldown
} // color applied when drawing



function spawnEnemy() {
  const size = 30;
  // choose a random variant for color and label
  const variants = [
    { type: "404", color: "#a855f7" },
    { type: "HOTFIX", color: SHIFT_ORANGE },
    { type: "NULL", color: "#374151" },
    { type: "CRASH", color: "#facc15" },
    { type: "PROD", color: "#10b981" },
    { type: "MERGE", color: "#3b82f6" },
    { type: "ROLLBACK", color: "#f87171" }
  ];
  const variant = variants[Math.floor(Math.random() * variants.length)];
  // spawn just outside right edge at a random vertical position
  // difficulty scale based on gameTime (frames) with gentle ramp
  const baseSpeed = 0.5 + Math.min(gameTime / 3600, 2); // slow base, ramps slowly
  const speed = baseSpeed + Math.random() * 1;
  enemies.push({
    x: canvas.width + size,
    y: Math.random() * (canvas.height - size),
    width: size,
    height: size,
    speed,
    type: variant.type,
    color: variant.color,
    hp: 1,
    isBoss: false
  });
}

function spawnBoss() {
  const size = 60;
  enemies.push({
    x: canvas.width + size,
    y: canvas.height / 2 - size / 2,
    width: size,
    height: size,
    speed: 0.8,
    type: "FRIDAY 16:57 DEPLOY",
    color: "#ffffff",
    hp: 5,
    isBoss: true
  });
}

function update() {
  if (!gameStarted || gameOver) return;

  // track time for ramping difficulty
  gameTime++;

  // decrement shake
  if (shakeTimer > 0) shakeTimer--;

  // pickup spawn timing
  pickupSpawnTimer++;
  if (pickupSpawnTimer > 400 && Math.random() < 0.02) {
    // spawn a life pickup
    const size = 20;
    pickups.push({
      x: canvas.width + size,
      y: Math.random() * (canvas.height - size),
      width: size,
      height: size,
      speed: 1.2
    });
    pickupSpawnTimer = 0;
  }

  // cooldown countdown
  if (shootCooldown > 0) shootCooldown--;

  // occasional developer message spawn
  if (Math.random() < 0.01) {
    const msgs = [
      "deploy failed",
      "rollback needed",
      "production incident"
    ];
    devMessages.push({
      text: msgs[Math.floor(Math.random() * msgs.length)],
      x: Math.random() * (canvas.width - 60) + 30,
      y: canvas.height - 30,
      timer: 80
    });
  }

  // smooth vertical movement with velocity and damping
  if (keys["ArrowUp"]) {
    player.vy -= player.accel;
  }
  if (keys["ArrowDown"]) {
    player.vy += player.accel;
  }
  // apply damping
  player.vy *= player.damping;
  // clamp
  if (player.vy > player.maxSpeed) player.vy = player.maxSpeed;
  if (player.vy < -player.maxSpeed) player.vy = -player.maxSpeed;
  player.y += player.vy;

  if (player.y < 0) {
    player.y = 0;
    player.vy = 0;
  }
  if (player.y + player.height > canvas.height) {
    player.y = canvas.height - player.height;
    player.vy = 0;
  }

  // move bullets to the right
  bullets.forEach((bullet) => {
    bullet.x += bullet.speed;
  });

  // remove bullets that leave the right edge
  bullets = bullets.filter((bullet) => bullet.x < canvas.width);

  enemySpawnTimer++;
  // spawn normal enemies with much slower early rate
  const spawnInterval = Math.max(40, 80 - Math.floor(score / 50));
  if (enemySpawnTimer > spawnInterval) {
    // limit simultaneous
    const maxEnemies = 4 + Math.floor(gameTime / 1800);
    if (enemies.length < maxEnemies && !enemies.some(e=>e.isBoss)) {
      spawnEnemy();
    }
    enemySpawnTimer = 0;
  }
  // boss spawn on score thresholds
  if (score >= nextBossScore) {
    spawnBoss();
    nextBossScore += 200;
  }

  enemies.forEach((enemy) => {
    enemy.x -= enemy.speed;
  });
  pickups.forEach((p) => {
    p.x -= p.speed;
  });

  enemies = enemies.filter((enemy) => {
    // if the enemy passes the left edge the player loses a life
    if (enemy.x + enemy.width < 0) {
      lives--;
      updateHUD();
      if (lives <= 0) {
        gameOver = true;
      }
      return false;
    }
    return true;
  });

  // pickup collision with player
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (
      player.x < p.x + p.width &&
      player.x + player.width > p.x &&
      player.y < p.y + p.height &&
      player.y + player.height > p.y
    ) {
      // collect
      lives = Math.min(lives + 1, 3);
      updateHUD();
      pickups.splice(i, 1);
    }
  }
  // remove pickups that leave screen
  pickups = pickups.filter((p) => p.x + p.width > 0);

  for (let i = enemies.length - 1; i >= 0; i--) {
    for (let j = bullets.length - 1; j >= 0; j--) {
      if (isColliding(enemies[i], bullets[j])) {
        // create hit effect at enemy center
        effects.push({
          x: enemies[i].x + enemies[i].width / 2,
          y: enemies[i].y + enemies[i].height / 2,
          timer: 10
        });
        bullets.splice(j, 1);
        enemies[i].hp--;
        if (enemies[i].hp <= 0) {
          // boss or regular destroyed
          if (enemies[i].isBoss) {
            score += 100; // big bonus
          } else {
            score += 10;
          }
          enemies.splice(i, 1);
          // trigger shake
          shakeTimer = 6;
          shakeAmount = 4;
        }
        updateHUD();
        break;
      }
    }
  }

  // update effects
  effects.forEach((e) => e.timer--);
  effects = effects.filter((e) => e.timer > 0);

  // update floating dev messages
  updateMessages();
}

function isColliding(a, b) {
  const margin = 6; // forgiving overlap
  return (
    a.x - margin < b.x + b.width + margin &&
    a.x + a.width + margin > b.x - margin &&
    a.y - margin < b.y + b.height + margin &&
    a.y + a.height + margin > b.y - margin
  );
}

function updateHUD() {
  scoreEl.textContent = `Score: ${score}`;
  livesEl.textContent = `Lives: ${lives}`;
}

function drawPlayer() {
  // simple pixel-art duck facing right
  // body
  ctx.fillStyle = "#facc15";
  ctx.fillRect(player.x + 4, player.y + 12, 32, 20);
  // head
  ctx.fillRect(player.x + 20, player.y + 4, 16, 16);
  // wing
  ctx.fillStyle = "#eab308";
  ctx.fillRect(player.x + 10, player.y + 18, 12, 10);
  // tail
  ctx.fillRect(player.x, player.y + 18, 8, 8);
  // beak
  ctx.fillStyle = "#fb923c";
  ctx.fillRect(player.x + 36, player.y + 16, 8, 8);
  // eye
  ctx.fillStyle = "#000000";
  ctx.fillRect(player.x + 26, player.y + 6, 4, 4);
}


function drawBullets() {
  bullets.forEach((bullet) => {
    // main body in Shift orange
    ctx.fillStyle = SHIFT_ORANGE;
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    // subtle lighter trail
    ctx.fillStyle = "#fd9773"; // light orange
    ctx.fillRect(bullet.x - 4, bullet.y + 2, 4, bullet.height - 4);
  });
}



function drawEnemies() {
  enemies.forEach((enemy) => {
    if (enemy.isBoss) {
      // pixel-art oversized bug boss
      const bx = enemy.x;
      const by = enemy.y;
      const bw = enemy.width;
      const bh = enemy.height;
      // body segments
      ctx.fillStyle = "#222222";
      ctx.fillRect(bx + bw*0.2, by + bh*0.1, bw*0.6, bh*0.8);
      // head
      ctx.fillRect(bx + bw*0.3, by, bw*0.4, bh*0.2);
      // eyes
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(bx + bw*0.33, by + bh*0.05, bw*0.05, bh*0.05);
      ctx.fillRect(bx + bw*0.62, by + bh*0.05, bw*0.05, bh*0.05);
      // legs
      ctx.fillStyle = enemy.color || "#ffffff";
      ctx.fillRect(bx, by + bh*0.2, bw*0.2, 2);
      ctx.fillRect(bx, by + bh*0.4, bw*0.2, 2);
      ctx.fillRect(bx + bw*0.8, by + bh*0.2, bw*0.2, 2);
      ctx.fillRect(bx + bw*0.8, by + bh*0.4, bw*0.2, 2);
      // outline effect
      ctx.strokeStyle = SHIFT_ORANGE;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);
      // health bar
      ctx.fillStyle = "#ef4444";
      const barW = (enemy.hp / 5) * bw;
      ctx.fillRect(bx, by - 6, barW, 4);
      // label
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px Arial";
      ctx.fillText(enemy.type, bx + 4, by - 10);
    } else {
      // draw simple pixel bug using colored rectangles
      const cx = enemy.x;
      const cy = enemy.y;
      const w = enemy.width;
      const h = enemy.height;
      ctx.fillStyle = enemy.color || "#ef4444";
      // body
      ctx.fillRect(cx + w*0.2, cy + h*0.2, w*0.6, h*0.6);
      // head
      ctx.fillRect(cx + w*0.3, cy, w*0.4, h*0.3);
      // legs
      ctx.fillRect(cx, cy + h*0.4, w*0.2, 2);
      ctx.fillRect(cx, cy + h*0.6, w*0.2, 2);
      ctx.fillRect(cx + w*0.8, cy + h*0.4, w*0.2, 2);
      ctx.fillRect(cx + w*0.8, cy + h*0.6, w*0.2, 2);
      // label above
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px Arial";
      ctx.fillText(enemy.type || "BUG", cx, cy - 4);
    }
  });
}

function drawPickups() {
  pickups.forEach((p) => {
    // draw a simple heart shape
    const cx = p.x + p.width/2;
    const cy = p.y + p.height/2;
    const r = p.width/2;
    ctx.fillStyle = SHIFT_ORANGE;
    ctx.beginPath();
    ctx.moveTo(cx, cy + r/2);
    ctx.bezierCurveTo(cx + r, cy - r/3, cx + r/3, cy - r, cx, cy - r/3);
    ctx.bezierCurveTo(cx - r/3, cy - r, cx - r, cy - r/3, cx, cy + r/2);
    ctx.fill();
  });
}

function drawBackground() {
  // photographic backdrop if loaded
  if (bgReady) {
    // scale to fill while preserving aspect ratio
    const scale = Math.max(canvas.width / bgImage.width, canvas.height / bgImage.height);
    const w = bgImage.width * scale;
    const h = bgImage.height * scale;
    // subtle drifting offset based on time
    const driftX = Math.sin(gameTime / 300) * 20; // horizontal sway
    const driftY = Math.cos(gameTime / 400) * 10; // vertical bob
    const x = (canvas.width - w) / 2 + driftX;
    const y = (canvas.height - h) / 2 + driftY;
    ctx.drawImage(bgImage, x, y, w, h);
    // dark overlay for readability
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    // fallback solid color
    ctx.fillStyle = SHIFT_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // floating code panel rectangles
  ctx.fillStyle = "rgba(55,65,81,0.6)";
  ctx.fillRect(60, 40, 120, 80);
  ctx.fillRect(200, 100, 150, 60);
  ctx.fillRect(380, 30, 100, 100);

  // panel outlines to suggest windows
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 1;
  ctx.strokeRect(60, 40, 120, 80);
  ctx.strokeRect(200, 100, 150, 60);
  ctx.strokeRect(380, 30, 100, 100);
  // tiny orange corner accents
  ctx.strokeStyle = SHIFT_ORANGE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60,40);
  ctx.lineTo(70,40);
  ctx.moveTo(60,40);
  ctx.lineTo(60,50);
  ctx.stroke();
  // floating symbols/lines
  ctx.fillStyle = "#9ca3af";
  ctx.font = "14px monospace";
  ctx.fillText("</>", 80, 70);
  ctx.fillText("{ }", 220, 130);
  ctx.fillText("console.log();", 390, 60);
  ctx.fillText("404", 440, 120);

  // ground / digital track at bottom
  ctx.fillStyle = "#374151";
  ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
  ctx.strokeStyle = "#6b7280";
  ctx.lineWidth = 2;
  for (let x = 0; x < canvas.width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, canvas.height - 10);
    ctx.lineTo(x + 10, canvas.height - 10);
    ctx.stroke();
  }
}


function drawGameOver() {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f9fafb";
  ctx.font = "40px Arial";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);

  ctx.font = "24px Arial";
  ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2);

  ctx.font = "20px Arial";
  ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 40);

  ctx.textAlign = "start"; // restore
}

function drawHUD() {
  // semi-transparent backing with orange border
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(8, 8, 260, 60);
  ctx.strokeStyle = SHIFT_ORANGE;
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, 260, 60);

  // title
  ctx.fillStyle = "#f9fafb";
  ctx.font = "18px Arial";
  ctx.fillText("Shift Duck: Production Panic", 12, 28);

  // score and lives with accent
  ctx.font = "16px monospace";
  ctx.fillStyle = SHIFT_ORANGE;
  ctx.fillText(`Score: ${score}`, 12, 48);
  ctx.fillStyle = "#f9fafb";
  ctx.fillText(`Lives: ${lives}`, 140, 48);
}

function drawEffects() {
  effects.forEach((e) => {
    const size = (10 - e.timer) * 2;
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = e.timer / 10;
    ctx.fillRect(e.x - size/2, e.y - size/2, size, size);
    ctx.globalAlpha = 1;
  });
}

function drawMessages() {
  devMessages.forEach((m) => {
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "14px monospace";
    ctx.globalAlpha = m.timer / 80;
    ctx.fillText(m.text, m.x, m.y);
    ctx.globalAlpha = 1;
  });
}

// update messages movement and timer
function updateMessages() {
  devMessages.forEach((m) => {
    m.y -= 0.5;
    m.timer--;
  });
  devMessages = devMessages.filter((m) => m.timer > 0);
}

function drawStartScreen() {
  // dark overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f9fafb";
  ctx.font = "32px Arial";
  ctx.fillText("Shift Duck: Production Panic", 60, canvas.height / 2 - 40);

  ctx.font = "18px Arial";
  ctx.fillText("Duck vs production bugs", 120, canvas.height / 2 - 10);

  ctx.font = "16px monospace";
  ctx.fillText("ArrowUp / ArrowDown to move", 90, canvas.height / 2 + 30);
  ctx.fillText("Space to shoot", 160, canvas.height / 2 + 60);
  ctx.fillText("Heart pickups restore 1 life, up to a maximum of 3.", 70, canvas.height / 2 + 90);
  ctx.font = "18px Arial";
  ctx.fillText("Press Enter to start", 120, canvas.height / 2 + 135);
}

function draw() {
  // screen shake translation
  if (shakeTimer > 0) {
    const dx = (Math.random() * 2 - 1) * shakeAmount;
    const dy = (Math.random() * 2 - 1) * shakeAmount;
    ctx.save();
    ctx.translate(dx, dy);
  }

  drawBackground();
  if (!gameStarted) {
    drawStartScreen();
    if (shakeTimer > 0) ctx.restore();
    return;
  }
  drawHUD();
  drawPlayer();
  drawBullets();
  drawEnemies();
  drawPickups();
  drawEffects();
  drawMessages();

  if (gameOver) {
    drawGameOver();
  }

  if (shakeTimer > 0) ctx.restore();
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

function restartGame() {
  bullets = [];
  enemies = [];
  effects = [];
  devMessages = [];
  score = 0;
  lives = 3;
  gameOver = false;
  shootCooldown = 0;
  gameTime = 0;
  player.x = 40;
  player.y = canvas.height / 2 - 20;
  player.vy = 0;
  updateHUD();
}

updateHUD();
gameLoop();
