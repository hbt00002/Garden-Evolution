import Phaser from "phaser";

const DESIGN_W = 1672;
const DESIGN_H = 936;

export class WinterMountainScene extends Phaser.Scene {
  constructor() {
    super("WinterMountainScene");
    this.trees = [];
    this.hype = 0;
  }

  preload() {
    this.load.image("mountain-ridge-v2", "/assets/stage1-v2/mountain-ridge.png");
    this.load.image("snow-tile", "/assets/stage1/snow-tile.png");
    this.load.image("spruce-large", "/assets/stage1-v2/spruce-large.png");
    this.load.image("spruce-medium", "/assets/stage1-v2/spruce-medium.png");
    this.load.image("spruce-small", "/assets/stage1-v2/spruce-small.png");
    this.load.image("shrub-a", "/assets/stage1-v2/shrub-a.png");
    this.load.image("shrub-b", "/assets/stage1-v2/shrub-b.png");
    this.load.image("rock-large", "/assets/stage1-v2/rock-large.png");
    this.load.image("rock-medium", "/assets/stage1-v2/rock-medium.png");
  }

  create() {
    this.trees = [];
    this.cameras.main.setBackgroundColor("#8299b6");
    this.buildWorldLayers();

    const layout = [
      [120, 910, .84, "spruce-large", .8], [380, 845, .75, "spruce-medium", 1.3],
      [650, 755, .62, "spruce-small", 1.7], [1015, 785, .66, "spruce-small", 2.2],
      [1325, 865, .78, "spruce-medium", 2.7], [1570, 930, .88, "spruce-large", 3.2],
      [310, 625, .42, "spruce-small", 4.1], [575, 595, .32, "spruce-small", 4.8],
      [1110, 635, .36, "spruce-small", 5.4], [1410, 690, .44, "spruce-small", 5.9],
      [72, 720, .52, "spruce-medium", 6.4], [235, 705, .47, "spruce-small", 6.9],
      [1215, 735, .5, "spruce-small", 7.5], [1500, 765, .54, "spruce-medium", 8.1]
    ];

    layout.forEach(([x, y, scale, key, phase], index) => {
      const tree = this.createTreeRig(x, y, scale, key);
      tree.setDepth(y);
      const distanceFade = Phaser.Math.Clamp(.58 + scale * .48, .66, .98);
      tree.setAlpha(distanceFade);
      const fogTint = scale < .4 ? 0x91a5bb : scale < .68 ? 0xaebdca : 0xffffff;
      tree.setTint(fogTint);
      tree.wind = {
        phase,
        speed: .42 + (index % 4) * .055,
        amplitude: .72 + (index % 3) * .22,
        gust: .24 + (index % 2) * .12
      };
      this.trees.push(tree);
    });

    [
      [510, 820, "shrub-a", .48], [1175, 850, "shrub-b", .55],
      [250, 875, "rock-medium", .48], [1445, 865, "rock-large", .5]
    ].forEach(([x, y, key, scale]) => this.add.image(x, y, key)
      .setOrigin(.5, 1).setScale(scale).setDepth(y - 1));

    const snowDot = this.make.graphics({ add: false });
    snowDot.fillStyle(0xeaf0f4, 1).fillRect(0, 0, 3, 3);
    snowDot.generateTexture("snow-dot", 3, 3);
    snowDot.destroy();

    const compact = this.scale.width < 760 || this.game.registry.get("lowPower");
    this.snow = this.add.particles(0, 0, "snow-dot", {
      x: { min: -100, max: DESIGN_W },
      y: { min: -80, max: DESIGN_H * .3 },
      lifespan: { min: 7000, max: 12000 },
      speedX: { min: 18, max: 46 },
      speedY: { min: 30, max: 72 },
      scale: { min: .35, max: 1.35 },
      alpha: { start: .78, end: .16 },
      quantity: compact ? 1 : 2,
      frequency: compact ? 170 : 105,
      blendMode: Phaser.BlendModes.SCREEN
    }).setDepth(2000);

    this.windMist = [];
    for (let i = 0; i < (compact ? 4 : 7); i++) {
      const streak = this.add.rectangle(-200, 130 + i * 92, 110 + i * 13, 2, 0xe9eef3, .16)
        .setRotation(.42).setDepth(1800);
      streak.speed = 22 + i * 6;
      streak.delay = Phaser.Math.FloatBetween(0, 7);
      this.windMist.push(streak);
    }

    this.scale.on("resize", this.fitWorld, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.fitWorld, this);
    });
    this.time.delayedCall(60, () => this.fitWorld());
  }

  createTreeRig(x, y, scale, key) {
    return this.add.image(x, y, key).setOrigin(.5, 1).setScale(scale);
  }

  buildWorldLayers() {
    // Every part below is an independent Phaser object; there is no full-screen scene image.
    const sky = this.add.graphics().setDepth(-100);
    sky.fillStyle(0x8299b6).fillRect(-200, 0, DESIGN_W + 400, 240);
    sky.fillStyle(0x91a7c0).fillRect(-200, 180, DESIGN_W + 400, 170);
    sky.fillStyle(0xa8b7c9, .85).fillRect(-200, 300, DESIGN_W + 400, 145);

    this.ridgeFar = this.add.image(DESIGN_W / 2 - 180, 230, "mountain-ridge-v2")
      .setOrigin(.5, .5).setDisplaySize(1780, 334).setAlpha(.3).setTint(0xa8b8ca).setDepth(-85);
    this.ridge = this.add.image(DESIGN_W / 2 + 30, 340, "mountain-ridge-v2")
      .setOrigin(.5, .5).setDisplaySize(1840, 345).setAlpha(.94).setDepth(-80);

    this.slope = this.add.graphics().setDepth(-60);
    this.slope.fillStyle(0xb9c8dc).fillPoints([
      { x: -120, y: 345 }, { x: 360, y: 370 }, { x: 825, y: 435 },
      { x: 1230, y: 482 }, { x: 1990, y: 512 }, { x: 1990, y: 1040 }, { x: -200, y: 1040 }
    ], true);

    const slopeMaskShape = this.make.graphics({ add: false });
    slopeMaskShape.fillStyle(0xffffff).fillPoints([
      { x: -120, y: 345 }, { x: 360, y: 370 }, { x: 825, y: 435 },
      { x: 1230, y: 482 }, { x: 1990, y: 512 }, { x: 1990, y: 1040 }, { x: -200, y: 1040 }
    ], true);
    const slopeMask = slopeMaskShape.createGeometryMask();
    this.snowTexture = this.add.tileSprite(DESIGN_W / 2, 600, DESIGN_W + 520, 810, "snow-tile")
      .setTileScale(.34).setAlpha(.52).setDepth(-59).setMask(slopeMask);

    // Gentle broad shadows live inside the same slope instead of overlapping mesh slabs.
    const contour = this.add.graphics().setDepth(-35);
    [
      [[-80,470],[370,500],[720,585],[690,606],[320,527],[-80,505]],
      [[180,650],[690,686],[1160,790],[1120,812],[650,714],[180,680]],
      [[760,820],[1250,846],[1760,930],[1760,958],[1210,878],[760,850]]
    ].forEach(points => contour.fillStyle(0x7891b5, .16)
      .fillPoints(points.map(([x,y]) => ({x,y})), true));

    this.snowStreaks = [];
    for (let i = 0; i < 38; i++) {
      const y = 270 + i * 19;
      const x = ((i * 173) % 1540) - 80;
      const streak = this.add.rectangle(x, y, 70 + (i % 5) * 22, i % 3 ? 3 : 5, 0xe8edf1, .38)
        .setOrigin(0, .5).setRotation(.14).setDepth(-20);
      this.snowStreaks.push(streak);
    }
  }

  fitWorld() {
    const width = this.game.canvas.clientWidth || this.scale.width;
    const height = this.game.canvas.clientHeight || this.scale.height;
    const zoom = Math.max(width / DESIGN_W, height / DESIGN_H);
    this.cameras.main.setViewport(0, 0, width, height);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.setScroll(
      DESIGN_W / 2 - width / (2 * zoom),
      DESIGN_H / 2 - height / (2 * zoom)
    );
    this.lastViewport = `${width}x${height}`;
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, .05);
    this.hype = Math.max(0, this.hype - dt * .3);
    const energy = 1 + this.hype * .05;
    const viewport = `${this.game.canvas.clientWidth}x${this.game.canvas.clientHeight}`;
    if (viewport !== this.lastViewport) this.fitWorld();

    this.trees.forEach((tree) => {
      const w = tree.wind;
      const breeze = Math.sin(time * .001 * w.speed + w.phase);
      const gust = Math.sin(time * .00019 + w.phase * .7) * w.gust;
      const wind = (breeze * w.amplitude + gust) * energy;
      tree.setAngle(wind * .42);
    });

    this.windMist.forEach((streak) => {
      if (streak.delay > 0) { streak.delay -= dt; return; }
      streak.x += streak.speed * energy * dt;
      streak.y += streak.speed * .45 * energy * dt;
      if (streak.x > DESIGN_W + 180 || streak.y > DESIGN_H) {
        streak.setPosition(Phaser.Math.Between(-250, 100), Phaser.Math.Between(80, 430));
        streak.delay = Phaser.Math.FloatBetween(1.5, 6);
      }
    });
  }

  setHype(combo) {
    this.hype = Math.min(8, Math.max(0, Number(combo) || 0));
    if (this.snow) this.snow.setFrequency(Math.max(45, 105 - combo * 7));
  }

  setExtraParticles(enabled) {
    this.snow?.setVisible(enabled);
    this.windMist?.forEach(streak => streak.setVisible(enabled));
  }
}
