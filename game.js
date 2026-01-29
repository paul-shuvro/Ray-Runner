let W, H;

let gameState = {
  started: false,
  score: 0,
  lives: 3,
  gameOver: false,
  fallLocked: false,
};

let player_config = {
  player_speed: 150,
  player_jumpspeed: -700,
};

let config = {
  type: Phaser.AUTO,
  scale: { mode: Phaser.Scale.FIT, width: 1200, height: 600 },
  backgroundColor: "#ffffff",
  physics: { default: "arcade", arcade: { gravity: { y: 1000 }, debug: false } },
  scene: { preload, create, update },
};

new Phaser.Game(config);

function preload() {
  this.load.image("ground", "Assets/topground.png");
  this.load.image("sky", "Assets/background.png");
  this.load.image("apple", "Assets/apple.png");
  this.load.image("ray", "Assets/ray.png");
  this.load.spritesheet("dude", "Assets/dude.png", { frameWidth: 32, frameHeight: 48 });
}

function create() {
  W = this.scale.width;
  H = this.scale.height;

  // Background
  let background = this.add.image(0, 0, "sky").setOrigin(0);
  background.displayWidth = W;
  background.displayHeight = H;
  background.depth = -2;

  // Rays
  let rays = [];
  for (let i = -10; i <= 10; i++) {
    let ray = this.add.sprite(W / 2, H - 100, "ray");
    ray.displayHeight = 1.2 * H;
    ray.setOrigin(0.5, 1);
    ray.alpha = 0.2;
    ray.angle = i * 20;
    ray.depth = -1;
    rays.push(ray);
  }
  this.tweens.add({ targets: rays, angle: "+=20", duration: 8000, repeat: -1 });

  // Ground + platforms
  let ground = this.add.tileSprite(0, H - 128, W, 128, "ground").setOrigin(0);
  this.physics.add.existing(ground, true);

  let platforms = this.physics.add.staticGroup();
  platforms.add(ground);
  platforms.create(500, 350, "ground").setScale(2, 0.5).refreshBody();
  platforms.create(850, 275, "ground").setScale(2, 0.5).refreshBody();
  platforms.create(100, 200, "ground").setScale(2.5, 0.5).refreshBody();
  platforms.create(1125, 150, "ground").setScale(1.5, 0.5).refreshBody();

  // Player
  this.player = this.physics.add.sprite(100, 100, "dude", 4);
  this.player.setBounce(0.5);
  this.player.setCollideWorldBounds(true);

  // Animations
  this.anims.create({ key: "left", frames: this.anims.generateFrameNumbers("dude", { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
  this.anims.create({ key: "center", frames: [{ key: "dude", frame: 4 }], frameRate: 10 });
  this.anims.create({ key: "right", frames: this.anims.generateFrameNumbers("dude", { start: 5, end: 8 }), frameRate: 10, repeat: -1 });

  // Input
  this.cursors = this.input.keyboard.createCursorKeys();
  this.startKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

  // Fruits
  this.fruits = this.physics.add.group({
    key: "apple",
    repeat: 12,
    setScale: { x: 0.2, y: 0.2 },
    setXY: { x: 10, y: 0, stepX: 100 },
  });
  this.fruits.children.iterate((f) => f.setBounce(Phaser.Math.FloatBetween(0.4, 0.7)));

  // Total fruits dynamically
  this.totalFruits = this.fruits.getLength();

  // Collisions
  this.physics.add.collider(this.player, platforms);
  this.physics.add.collider(this.fruits, platforms);
  this.physics.add.overlap(this.player, this.fruits, eatFruit, null, this);

  // Camera
  this.cameras.main.setBounds(0, 0, W, H);
  this.physics.world.setBounds(0, 0, W, H);
  this.cameras.main.startFollow(this.player, true, true);
  this.cameras.main.setZoom(1.5);

  // UI
  this.scoreText = this.add.text(16, 16, "Score: 0", { fontSize: "24px", fill: "#000" }).setScrollFactor(0);
  this.livesText = this.add.text(16, 50, "Lives: 3", { fontSize: "24px", fill: "#000" }).setScrollFactor(0);
  this.startText = this.add
    .text(W / 2, H / 2, "RAY RUNNER\nPress SPACE to Start", {
      fontSize: "40px",
      fill: "#000",
      fontStyle: "bold",
      align: "center",
    })
    .setOrigin(0.5)
    .setScrollFactor(0);

  this.endText = null;

  this.physics.pause();
}

function update() {
  // Start Game
  if (!gameState.started) {
    if (Phaser.Input.Keyboard.JustDown(this.startKey)) {
      gameState.started = true;
      this.startText.destroy();
      this.physics.resume();
    }
    return;
  }

  // Restart Game
  if (gameState.gameOver) {
    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.scene.restart();
      gameState = { started: false, score: 0, lives: 3, gameOver: false, fallLocked: false };
    }
    return;
  }

  // Player Movement
  if (this.cursors.left.isDown) {
    this.player.setVelocityX(-player_config.player_speed);
    this.player.anims.play("left", true);
  } else if (this.cursors.right.isDown) {
    this.player.setVelocityX(player_config.player_speed);
    this.player.anims.play("right", true);
  } else {
    this.player.setVelocityX(0);
    this.player.anims.play("center");
  }

  if (this.cursors.up.isDown && this.player.body.touching.down) {
    this.player.setVelocityY(player_config.player_jumpspeed);
  }

  // Fall off screen = lose life (with lock)
  if (!gameState.fallLocked && this.player.y > H + 50) {
    gameState.fallLocked = true;
    loseLife.call(this);
    this.time.delayedCall(500, () => (gameState.fallLocked = false));
  }
}

function eatFruit(player, fruit) {
  fruit.disableBody(true, true);
  gameState.score += 10;
  this.scoreText.setText("Score: " + gameState.score);

  if (gameState.score === this.totalFruits * 10) {
    endGame.call(this, "YOU WIN 🎉\nPress R to Restart", "#000");
  }
}

function loseLife() {
  gameState.lives -= 1;
  this.livesText.setText("Lives: " + gameState.lives);

  if (gameState.lives <= 0) {
    endGame.call(this, "GAME OVER\nPress R to Restart", "#f00");
  } else {
    // Respawn player
    this.player.setPosition(100, 100);
    this.player.setVelocity(0, 0);
  }
}

function endGame(message, color) {
  gameState.gameOver = true;

  this.player.setVelocity(0, 0);
  this.player.anims.stop();
  this.physics.pause();

  this.cameras.main.stopFollow();

  if (this.endText) this.endText.destroy();
  this.endText = this.add
    .text(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y, message, {
      fontSize: "48px",
      fill: color,
      fontStyle: "bold",
      align: "center",
    })
    .setOrigin(0.5)
    .setScrollFactor(0);
}
