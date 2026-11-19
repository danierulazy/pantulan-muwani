(() => {
  "use strict";

  // =========================================================
  // PANTULAN MUWANI — ARCADE ENGINE
  // Vanilla JavaScript + Canvas 2D + Web Audio API
  // =========================================================

  const $ = (selector) => document.querySelector(selector);
  const canvas = $("#canvas");
  const ctx = canvas.getContext("2d");
  const bgm = $("#bgm");

  const ui = {
    score: $("#scoreValue"), best: $("#bestValue"), level: $("#levelValue"),
    lives: $("#livesValue"), status: $("#statusText"), combo: $("#comboDisplay"),
    power: $("#powerStatus"), menuBest: $("#menuBest"), menu: $("#menuOverlay"),
    pause: $("#pauseOverlay"), gameOver: $("#gameOverOverlay"),
    finalScore: $("#finalScore"), finalCombo: $("#finalCombo"),
    finalLevel: $("#finalLevel"), gameOverMessage: $("#gameOverMessage"),
    toast: $("#toast"), levelFlash: $("#levelFlash")
  };

  const STORAGE = {
    best: "muwaniArcadeBest",
    sound: "muwaniArcadeSound",
    difficulty: "muwaniArcadeDifficulty",
    coins: "muwaniArcadeCoins",
    ownedSkins: "muwaniArcadeOwnedSkins",
    equippedSkin: "muwaniArcadeEquippedSkin"
  };

  const SKINS = [
    { id: "classic", name: "CLASSIC", color: "#65f5ed", price: 0, rarity: "STARTER" },
    { id: "ice", name: "FROSTBYTE", color: "#8bdcff", price: 120, rarity: "RARE" },
    { id: "sakura", name: "SAKURA", color: "#ff82bd", price: 180, rarity: "RARE" },
    { id: "toxic", name: "TOXIC", color: "#a6ff62", price: 220, rarity: "EPIC" },
    { id: "gold", name: "GOLD RUSH", color: "#ffd36a", price: 250, rarity: "EPIC" },
    { id: "inferno", name: "INFERNO", color: "#ff704e", price: 300, rarity: "EPIC" },
    { id: "galaxy", name: "GALAXY", color: "#b18aff", price: 350, rarity: "LEGENDARY" },
    { id: "void", name: "VOID CORE", color: "#f0a2ff", price: 500, rarity: "MYTHIC" }
  ];

  const DIFFICULTIES = {
    normal: { speed: 4.7, lives: 3, paddle: 116, label: "NORMAL" },
    hard: { speed: 6.0, lives: 3, paddle: 104, label: "HARD" },
    insane: { speed: 7.2, lives: 2, paddle: 92, label: "INSANE" }
  };

  const POWERUPS = {
    slow: { color: "#65f5ed", label: "SLOW MOTION", symbol: "S", duration: 6500 },
    wide: { color: "#a98bff", label: "WIDE PADDLE", symbol: "W", duration: 8000 },
    shield: { color: "#ffd36a", label: "SHIELD ACTIVE", symbol: "◆", duration: 10000 },
    multi: { color: "#ff5c9a", label: "MULTI BALL", symbol: "✦", duration: 0 }
  };

  let width = 0, height = 0, dpr = 1;
  let state = "menu";
  let difficulty = localStorage.getItem(STORAGE.difficulty) || "normal";
  let score = 0, best = Number(localStorage.getItem(STORAGE.best) || 0), recordAtStart = best;
  let coins = Number(localStorage.getItem(STORAGE.coins) || 0);
  let ownedSkins = JSON.parse(localStorage.getItem(STORAGE.ownedSkins) || '["classic"]');
  let equippedSkin = localStorage.getItem(STORAGE.equippedSkin) || "classic";
  let coinsEarnedThisRun = 0;
  let level = 1, lives = 3, combo = 1, bestCombo = 1;
  let frame = 0, lastTime = 0, animationId = 0;
  let shake = 0, soundEnabled = localStorage.getItem(STORAGE.sound) !== "false";
  let audioContext = null, bgmStarted = false, toastTimer = 0;
  let balls = [], particles = [], powerDrops = [], activePowers = {};
  let shieldCharges = 0, stars = [];
  const keys = { left: false, right: false };

  const paddle = { x: 0, y: 0, baseWidth: 116, width: 116, height: 13, targetX: 0 };
  const pointer = { active: false, x: 0 };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paddle.y = height - 34;
    paddle.x = clamp(paddle.x || width / 2 - paddle.width / 2, 8, width - paddle.width - 8);
    paddle.targetX = paddle.x;
    stars = Array.from({ length: Math.max(35, Math.floor(width * height / 6500)) }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      r: Math.random() * 1.3 + .25, a: Math.random() * .5 + .12,
      phase: Math.random() * Math.PI * 2
    }));
    if (!balls.length && state !== "playing") draw();
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function random(min, max) { return Math.random() * (max - min) + min; }
  function formatScore(value) { return Math.floor(value).toString().padStart(6, "0"); }

  function unlockAudio() {
    if (!audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) audioContext = new AudioCtor();
    }
    if (audioContext?.state === "suspended") audioContext.resume();
    if (soundEnabled && !bgmStarted) {
      bgm.volume = .28;
      bgm.play().then(() => { bgmStarted = true; }).catch(() => {});
    }
  }

  function tone(frequency = 440, duration = .08, type = "sine", volume = .045, slide = 0) {
    if (!soundEnabled || !audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function sound(kind) {
    if (!soundEnabled) return;
    if (kind === "bounce") tone(340 + Math.random() * 100, .07, "sine", .035, 150);
    if (kind === "wall") tone(220, .045, "triangle", .022, 80);
    if (kind === "power") { tone(520, .12, "sine", .05, 400); setTimeout(() => tone(820, .16, "sine", .04, 180), 75); }
    if (kind === "lose") tone(260, .28, "sawtooth", .045, -190);
    if (kind === "level") { tone(440, .12, "triangle", .05, 250); setTimeout(() => tone(660, .18, "triangle", .05, 280), 100); }
    if (kind === "score") tone(720, .045, "sine", .018, 120);
  }

  function setSound(enabled) {
    soundEnabled = enabled;
    localStorage.setItem(STORAGE.sound, String(enabled));
    $("#soundButton").textContent = enabled ? "♫" : "♪̸";
    $("#soundButton").classList.toggle("muted", !enabled);
    if (!enabled) { bgm.pause(); bgmStarted = false; }
    else unlockAudio();
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 1600);
  }

  function updateHUD() {
    ui.score.textContent = formatScore(score);
    ui.best.textContent = formatScore(best);
    ui.menuBest.textContent = best.toLocaleString("id-ID");
    $("#menuCoins").textContent = coins.toLocaleString("id-ID");
    $("#shopCoins").textContent = coins.toLocaleString("id-ID");
    ui.level.textContent = String(level).padStart(2, "0");
    ui.lives.textContent = lives > 0 ? Array.from({ length: lives }, () => "♥").join(" ") : "—";
    ui.combo.textContent = "COMBO x" + combo;
    ui.power.textContent = Object.keys(activePowers).length
      ? Object.keys(activePowers).map(key => POWERUPS[key].label).join(" + ")
      : shieldCharges ? "SHIELD READY" : "NO ACTIVE POWER";
  }

  function setState(next) {
    state = next;
    $("#pauseButton").disabled = next !== "playing";
    ui.status.textContent = ({
      menu: "READY PLAYER?", playing: "SYSTEM ONLINE", paused: "GAME PAUSED",
      gameover: "SESSION ENDED"
    })[next] || next.toUpperCase();
  }

  function makeBall(x = width / 2, y = height * .48, angle = random(-.55, .55)) {
    const base = DIFFICULTIES[difficulty].speed + (level - 1) * .22;
    return {
      x, y, radius: 8, vx: Math.sin(angle) * base,
      vy: -Math.cos(angle) * base, trail: [], hue: 175
    };
  }

  function startGame() {
    unlockAudio();
    score = 0; recordAtStart = best; level = 1; lives = DIFFICULTIES[difficulty].lives;
    combo = 1; bestCombo = 1; shieldCharges = 0;
    activePowers = {}; powerDrops = []; particles = [];
    paddle.baseWidth = DIFFICULTIES[difficulty].paddle;
    paddle.width = paddle.baseWidth;
    paddle.x = width / 2 - paddle.width / 2;
    paddle.targetX = paddle.x;
    balls = [makeBall()];
    ui.menu.classList.add("hidden");
    $("#shopOverlay").classList.add("hidden");
    ui.pause.classList.add("hidden");
    ui.gameOver.classList.add("hidden");
    setState("playing");
    updateHUD();
    lastTime = performance.now();
    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(loop);
    showToast("GOOD LUCK. DON'T DROP IT!");
  }

  function pauseGame() {
    if (state !== "playing") return;
    setState("paused");
    ui.pause.classList.remove("hidden");
    cancelAnimationFrame(animationId);
    draw();
  }

  function resumeGame() {
    if (state !== "paused") return;
    unlockAudio();
    ui.pause.classList.add("hidden");
    setState("playing");
    lastTime = performance.now();
    animationId = requestAnimationFrame(loop);
  }

  function endGame() {
    setState("gameover");
    cancelAnimationFrame(animationId);
    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE.best, String(best));
    }
    coinsEarnedThisRun = Math.max(5, Math.floor(score / 100) + level * 3);
    coins += coinsEarnedThisRun;
    localStorage.setItem(STORAGE.coins, String(coins));
    ui.finalScore.textContent = score.toLocaleString("id-ID");
    $("#rewardLine").textContent = "✦ +" + coinsEarnedThisRun + " COINS EARNED";
    ui.finalCombo.textContent = "x" + bestCombo;
    ui.finalLevel.textContent = level;
    ui.gameOverMessage.textContent = score > recordAtStart && score > 0
      ? "NEW RECORD! MUWANI LEGENDARY! 😹"
      : "Lumayan, tapi bisa lebih tinggi lagi!";
    ui.gameOver.classList.remove("hidden");
    updateHUD();
    sound("lose");
  }

  function addScore(points) {
    const gained = points * combo;
    score += gained;
    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE.best, String(best));
    }
    combo = Math.min(combo + 1, 12);
    bestCombo = Math.max(bestCombo, combo);
    updateHUD();
    sound("score");
    if (score > 0 && Math.floor(score / 500) >= level) nextLevel();
  }

  function nextLevel() {
    level++;
    balls.forEach(ball => {
      const speed = Math.hypot(ball.vx, ball.vy) + .35;
      const angle = Math.atan2(ball.vx, -ball.vy);
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed;
    });
    updateHUD();
    ui.levelFlash.textContent = "LEVEL " + level;
    ui.levelFlash.classList.remove("show");
    void ui.levelFlash.offsetWidth;
    ui.levelFlash.classList.add("show");
    sound("level");
    showToast("LEVEL UP — SPEED INCREASED!");
  }

  function spawnParticles(x, y, color, count = 12, force = 3) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = random(.5, force);
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1, decay: random(.018, .04), size: random(1.3, 3.5), color
      });
    }
  }

  // Signature visual Pantulan Muwani: butiran putih berkilau yang
  // terus tertinggal di belakang bola, seperti versi original.
  function spawnWhiteBallSparkles(ball) {
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: ball.x + random(-3, 3),
        y: ball.y + random(-3, 3),
        vx: random(-1.15, 1.15) - ball.vx * .10,
        vy: random(-1.15, 1.15) - ball.vy * .10,
        life: random(.72, 1),
        decay: random(.045, .075),
        size: random(1.1, 2.5),
        color: "#ffffff"
      });
    }
    // Batasi jumlah partikel agar tetap ringan di HP dan laptop.
    if (particles.length > 650) particles.splice(0, particles.length - 650);
  }

  function spawnPowerup(x, y) {
    const types = ["slow", "wide", "shield", "multi"];
    const type = types[Math.floor(Math.random() * types.length)];
    powerDrops.push({ x, y, vy: 1.6, type, rotation: 0, size: 13 });
  }

  function activatePower(type) {
    const power = POWERUPS[type];
    sound("power");
    spawnParticles(paddle.x + paddle.width / 2, paddle.y, power.color, 22, 4);
    if (type === "multi") {
      if (balls.length < 5) {
        const original = balls[0] || makeBall();
        for (let i = 0; i < 2 && balls.length < 5; i++) {
          const copy = { ...original, trail: [], vx: original.vx * (i ? -1 : 1), vy: original.vy };
          balls.push(copy);
        }
      }
      showToast("MULTI BALL!");
    } else {
      activePowers[type] = performance.now() + power.duration;
      if (type === "wide") paddle.width = paddle.baseWidth * 1.55;
      if (type === "shield") shieldCharges = Math.min(shieldCharges + 1, 2);
      showToast(power.label + " ACTIVATED!");
    }
    updateHUD();
  }

  function updatePowers(now) {
    for (const [type, end] of Object.entries(activePowers)) {
      if (now >= end) {
        delete activePowers[type];
        if (type === "wide") paddle.width = paddle.baseWidth;
        showToast(POWERUPS[type].label + " ENDED");
      }
    }
    if (activePowers.slow) {
      // Slow motion is applied as a multiplier in the ball update.
    }
    updateHUD();
  }

  function movePaddle(dt) {
    const speed = 0.85 * dt;
    if (pointer.active) paddle.targetX = pointer.x - paddle.width / 2;
    else if (keys.left) paddle.targetX -= speed * 9;
    else if (keys.right) paddle.targetX += speed * 9;
    paddle.targetX = clamp(paddle.targetX, 7, width - paddle.width - 7);
    paddle.x += (paddle.targetX - paddle.x) * Math.min(1, dt * .025);
    paddle.y = height - 34;
  }

  function updateBalls(dt, now) {
    const slowFactor = activePowers.slow ? .62 : 1;
    for (let index = balls.length - 1; index >= 0; index--) {
      const ball = balls[index];
      const step = dt / 16.67 * slowFactor;
      ball.x += ball.vx * step;
      ball.y += ball.vy * step;
      ball.trail.push({ x: ball.x, y: ball.y, alpha: .48 });
      if (ball.trail.length > 8) ball.trail.shift();
      spawnWhiteBallSparkles(ball);

      if (ball.x < ball.radius + 2 || ball.x > width - ball.radius - 2) {
        ball.vx *= -1;
        ball.x = clamp(ball.x, ball.radius + 2, width - ball.radius - 2);
        spawnParticles(ball.x, ball.y, "#65f5ed", 5, 1.5);
        sound("wall");
      }
      if (ball.y < ball.radius + 2) {
        ball.vy = Math.abs(ball.vy);
        spawnParticles(ball.x, ball.y, "#a98bff", 5, 1.5);
        sound("wall");
      }

      const hitsPaddle = ball.vy > 0 &&
        ball.y + ball.radius >= paddle.y &&
        ball.y - ball.radius <= paddle.y + paddle.height &&
        ball.x >= paddle.x - ball.radius && ball.x <= paddle.x + paddle.width + ball.radius;

      if (hitsPaddle) {
        ball.y = paddle.y - ball.radius;
        const hit = clamp((ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2), -1, 1);
        const speed = Math.min(12, Math.hypot(ball.vx, ball.vy) + .08);
        const angle = hit * 1.05;
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.cos(angle) * speed;
        spawnParticles(ball.x, paddle.y, "#65f5ed", 15, 3.2);
        shake = Math.max(shake, 2);
        addScore(10);
        if (Math.random() < .12) spawnPowerup(ball.x, ball.y - 15);
        sound("bounce");
      }

      if (ball.y - ball.radius > height) {
        balls.splice(index, 1);
        if (!balls.length) {
          if (shieldCharges > 0) {
            shieldCharges--;
            balls = [makeBall()];
            combo = 1;
            showToast("SHIELD SAVED YOU!");
            spawnParticles(width / 2, height - 15, "#ffd36a", 28, 4);
            updateHUD();
          } else {
            lives--;
            combo = 1;
            updateHUD();
            sound("lose");
            shake = 9;
            if (lives <= 0) endGame();
            else {
              balls = [makeBall()];
              showToast("OOPS! " + lives + " LIFE LEFT");
            }
          }
        }
      }
    }
  }

  function updateDrops(dt) {
    for (let i = powerDrops.length - 1; i >= 0; i--) {
      const drop = powerDrops[i];
      drop.y += drop.vy * dt / 16.67;
      drop.rotation += .035 * dt / 16.67;
      const caught = drop.y + drop.size >= paddle.y &&
        drop.x >= paddle.x - 4 && drop.x <= paddle.x + paddle.width + 4;
      if (caught) {
        activatePower(drop.type);
        powerDrops.splice(i, 1);
      } else if (drop.y > height + 30) powerDrops.splice(i, 1);
    }
  }

  function updateParticles(dt) {
    const factor = dt / 16.67;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * factor; p.y += p.vy * factor;
      p.vx *= .985; p.vy *= .985;
      p.life -= p.decay * factor;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function update(dt, now) {
    frame++;
    movePaddle(dt);
    updatePowers(now);
    updateBalls(dt, now);
    updateDrops(dt);
    updateParticles(dt);
    shake *= .86;
  }

  function drawBackground() {
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, Math.max(width, height) * .75);
    gradient.addColorStop(0, "rgba(45,54,82,.17)");
    gradient.addColorStop(1, "rgba(5,7,13,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    stars.forEach(star => {
      const alpha = star.a * (.65 + Math.sin(frame * .018 + star.phase) * .35);
      ctx.fillStyle = "rgba(180,220,235," + alpha + ")";
      ctx.fillRect(star.x, star.y, star.r, star.r);
    });

    ctx.save();
    ctx.strokeStyle = "rgba(101,245,237,.045)";
    ctx.lineWidth = 1;
    const gap = 34;
    for (let x = width % gap; x < width; x += gap) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = height % gap; y < height; y += gap) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.restore();
  }

  function getSkin() { return SKINS.find(skin => skin.id === equippedSkin) || SKINS[0]; }

  function drawPaddle() {
    const x = paddle.x, y = paddle.y, w = paddle.width, h = paddle.height;
    const skin = getSkin();
    ctx.save();
    ctx.shadowBlur = 22; ctx.shadowColor = skin.color;
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(.35, skin.color); gradient.addColorStop(1, skin.color + "99");
    roundRect(x, y, w, h, 7, gradient);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,.65)";
    roundRect(x + 9, y + 2, w - 18, 2, 2, ctx.fillStyle);
    if (shieldCharges) {
      ctx.strokeStyle = "rgba(255,211,106,.75)";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 13; ctx.shadowColor = "#ffd36a";
      ctx.beginPath(); ctx.arc(x + w / 2, y + 7, w * .68, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, radius, fill) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = fill; ctx.fill();
  }

  function drawBall(ball) {
    const skin = getSkin();
    ctx.save();
    ball.trail.forEach((point, i) => {
      ctx.globalAlpha = (i / ball.trail.length) * .23;
      ctx.fillStyle = skin.color;
      ctx.beginPath(); ctx.arc(point.x, point.y, ball.radius * (i / ball.trail.length), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    const glow = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, ball.radius * 2.8);
    glow.addColorStop(0, "#ffffff"); glow.addColorStop(.35, skin.color); glow.addColorStop(1, "rgba(101,245,237,0)");
    ctx.fillStyle = glow; ctx.shadowBlur = 20; ctx.shadowColor = skin.color;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius * 1.65, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius * .68, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawDrops() {
    powerDrops.forEach(drop => {
      const power = POWERUPS[drop.type];
      ctx.save(); ctx.translate(drop.x, drop.y); ctx.rotate(drop.rotation);
      ctx.shadowBlur = 18; ctx.shadowColor = power.color;
      ctx.strokeStyle = power.color; ctx.fillStyle = "rgba(18,20,32,.9)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-drop.size, -drop.size, drop.size * 2, drop.size * 2, 6); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = power.color; ctx.font = "bold 13px Orbitron";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(power.symbol, 0, 1);
      ctx.restore();
    });
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8; ctx.shadowColor = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  function draw() {
    ctx.save();
    if (shake > .3) ctx.translate(random(-shake, shake), random(-shake, shake));
    drawBackground();
    drawDrops();
    balls.forEach(drawBall);
    drawPaddle();
    drawParticles();
    ctx.restore();
  }

  function loop(now) {
    if (state !== "playing") return;
    const dt = Math.min(32, now - (lastTime || now));
    lastTime = now;
    update(dt, now);
    draw();
    if (state === "playing") animationId = requestAnimationFrame(loop);
  }

  function setPointer(clientX) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = clientX - rect.left;
    pointer.active = true;
  }

  canvas.addEventListener("pointermove", event => {
    if (event.pointerType === "mouse" || event.pointerType === "pen" || event.pointerType === "touch") setPointer(event.clientX);
  });
  canvas.addEventListener("pointerdown", event => {
    unlockAudio();
    setPointer(event.clientX);
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener("pointerleave", () => { pointer.active = false; });
  canvas.addEventListener("pointerup", () => { pointer.active = false; });

  window.addEventListener("keydown", event => {
    if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") { keys.left = true; pointer.active = false; }
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") { keys.right = true; pointer.active = false; }
    if (event.code === "Space" && !event.repeat) {
      if (state === "playing") pauseGame();
      else if (state === "paused") resumeGame();
      else unlockAudio();
    }
    if (event.key === "Escape" && state === "playing") pauseGame();
  });
  window.addEventListener("keyup", event => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.left = false;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.right = false;
  });
  window.addEventListener("blur", () => { if (state === "playing") pauseGame(); });

  document.querySelectorAll(".difficulty").forEach(button => {
    button.addEventListener("click", () => {
      difficulty = button.dataset.difficulty;
      localStorage.setItem(STORAGE.difficulty, difficulty);
      document.querySelectorAll(".difficulty").forEach(item => item.classList.toggle("active", item === button));
    });
  });

  $("#openShopButton").addEventListener("click", openShop);
  $("#closeShopButton").addEventListener("click", closeShop);
  $("#startButton").addEventListener("click", startGame);
  $("#retryButton").addEventListener("click", startGame);
  $("#resumeButton").addEventListener("click", resumeGame);
  $("#pauseRestartButton").addEventListener("click", startGame);
  $("#pauseButton").addEventListener("click", pauseGame);
  $("#homeButton").addEventListener("click", () => {
    ui.gameOver.classList.add("hidden");
    ui.menu.classList.remove("hidden");
    setState("menu");
    draw();
  });
  $("#soundButton").addEventListener("click", () => setSound(!soundEnabled));


  function renderShop() {
    const grid = $("#skinGrid");
    grid.innerHTML = "";
    $("#shopCoins").textContent = coins.toLocaleString("id-ID");
    SKINS.forEach(skin => {
      const owned = ownedSkins.includes(skin.id);
      const equipped = equippedSkin === skin.id;
      const card = document.createElement("article");
      card.className = "skin-card" + (equipped ? " equipped" : "");
      card.style.setProperty("--skin-color", skin.color);
      const preview = document.createElement("div");
      preview.className = "skin-preview";
      const orb = document.createElement("span");
      orb.className = "skin-orb";
      preview.appendChild(orb);
      const name = document.createElement("strong");
      name.className = "skin-name";
      name.textContent = skin.name;
      const rarity = document.createElement("small");
      rarity.className = "skin-rarity";
      rarity.textContent = skin.rarity;
      const action = document.createElement("button");
      action.className = "skin-action";
      action.type = "button";
      action.textContent = equipped ? "EQUIPPED" : owned ? "EQUIP" : "✦ " + skin.price;
      action.disabled = equipped;
      action.addEventListener("click", () => {
        if (ownedSkins.includes(skin.id)) {
          equippedSkin = skin.id;
          localStorage.setItem(STORAGE.equippedSkin, equippedSkin);
          showToast(skin.name + " EQUIPPED!");
        } else if (coins >= skin.price) {
          coins -= skin.price;
          ownedSkins.push(skin.id);
          equippedSkin = skin.id;
          localStorage.setItem(STORAGE.coins, String(coins));
          localStorage.setItem(STORAGE.ownedSkins, JSON.stringify(ownedSkins));
          localStorage.setItem(STORAGE.equippedSkin, equippedSkin);
          showToast(skin.name + " UNLOCKED!");
        } else {
          showToast("NOT ENOUGH COINS — PLAY MORE!");
        }
        renderShop();
        updateHUD();
        draw();
      });
      card.append(preview, name, rarity, action);
      grid.appendChild(card);
    });
  }

  function openShop() {
    renderShop();
    ui.menu.classList.add("hidden");
    $("#shopOverlay").classList.remove("hidden");
  }

  function closeShop() {
    $("#shopOverlay").classList.add("hidden");
    ui.menu.classList.remove("hidden");
  }

  function init() {
    const savedDifficulty = document.querySelector('[data-difficulty="' + difficulty + '"]') || document.querySelector('[data-difficulty="normal"]');
    document.querySelectorAll(".difficulty").forEach(item => item.classList.toggle("active", item === savedDifficulty));
    difficulty = savedDifficulty.dataset.difficulty;
    if (!ownedSkins.includes("classic")) ownedSkins.unshift("classic");
    if (!ownedSkins.includes(equippedSkin)) equippedSkin = "classic";
    setSound(soundEnabled);
    updateHUD();
    resize();
    setState("menu");
    draw();
  }

  window.addEventListener("resize", resize);
  init();
})();
