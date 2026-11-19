const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const paddle = {
  width: 100,
  height: 15,
  x: canvas.width / 2 - 50,
  y: canvas.height - 40,
  color: '#cc2222'
};

const ball = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 10,
  dx: 8,
  dy: -8,
  color: '#ffffff'
};

let score = 0;
let topScore = localStorage.getItem("topScoreMuwani") || 0;

const scoreText = document.getElementById("score");
const topScoreText = document.getElementById("topScore");
const gameOverScreen = document.getElementById("gameOverScreen");
const finalScoreText = document.getElementById("finalScore");
const retryBtn = document.getElementById("retryBtn");
const bgm = document.getElementById("bgm");

topScoreText.textContent = "Top Score: " + topScore;

// BACKGROUND MUSIC
bgm.volume = 0.4;
let bgmStarted = false;

function startBGM() {
  if (bgmStarted) return;

  bgm.play()
    .then(() => {
      bgmStarted = true;
      document.removeEventListener("pointerdown", startBGM);
      document.removeEventListener("keydown", startBGM);
      console.log("BGM berhasil diputar!");
    })
    .catch((error) => {
      console.warn("BGM belum bisa diputar:", error);
    });
}

document.addEventListener("pointerdown", startBGM);
document.addEventListener("keydown", startBGM);

let gameRunning = true;
const particles = [];

function createTrail(x, y) {
  for (let i = 0; i < 3; i++) {
    particles.push({
      x, y,
      alpha: 1,
      radius: Math.random() * 3 + 1,
      dx: (Math.random() - 0.5) * 2,
      dy: (Math.random() - 0.5) * 2
    });
  }
}

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.dx;
    p.y += p.dy;
    p.alpha -= 0.02;

    if (p.alpha <= 0) {
      particles.splice(i, 1);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
      ctx.fill();
    }
  }
}

function drawPaddle() {
  ctx.fillStyle = paddle.color;
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();
}

function endGame() {
  gameRunning = false;
  finalScoreText.textContent = "Skormu: " + score;
  gameOverScreen.style.display = "flex";
}

function resetGame() {
  score = 0;
  scoreText.textContent = "Skor: 0";
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  ball.dx = 8;
  ball.dy = -8;
  paddle.x = canvas.width / 2 - paddle.width / 2;
  particles.length = 0;
  gameOverScreen.style.display = "none";
  gameRunning = true;
  update();
}

function update() {
  if (!gameRunning) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPaddle();
  drawBall();
  drawParticles();

  if (ball.x + ball.dx > canvas.width - ball.radius || ball.x + ball.dx < ball.radius) {
    ball.dx = -ball.dx;
  }

  if (ball.y + ball.dy < ball.radius) {
    ball.dy = -ball.dy;
  } else if (ball.y + ball.dy > paddle.y - ball.radius) {
    if (ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
      ball.dy = -ball.dy;
      score++;
      scoreText.textContent = "Skor: " + score;
      createTrail(ball.x, paddle.y);

      if (score > topScore) {
        topScore = score;
        localStorage.setItem("topScoreMuwani", topScore);
        topScoreText.textContent = "Top Score: " + topScore;
      }
    } else if (ball.y > canvas.height + ball.radius) {
      endGame();
      return;
    }
  }

  ball.x += ball.dx;
  ball.y += ball.dy;
  createTrail(ball.x, ball.y);
  requestAnimationFrame(update);
}

/* TOUCH SUPPORT */
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const touchX = e.touches[0].clientX;
  paddle.x = touchX - paddle.width / 2;
  if (paddle.x < 0) paddle.x = 0;
  if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;
});

/* MOUSE SUPPORT */
canvas.addEventListener("mousemove", (e) => {
  paddle.x = e.clientX - paddle.width / 2;
  if (paddle.x < 0) paddle.x = 0;
  if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;
});

retryBtn.addEventListener("click", resetGame);
update();
