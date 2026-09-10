import Phaser from "phaser";

const W = 1672;
const H = 936;

export class SpringBloomScene extends Phaser.Scene {
  constructor() {
    super("SpringBloomScene");
    this.trees = [];
    this.hype = 0;
  }

  preload() {
    const root = "/assets/stage3-v1/";
    this.load.image("s3-hills", `${root}spring-hills.png`);
    this.load.image("s3-terrain", `${root}spring-terrain.png`);
    this.load.image("s3-tree", `${root}blossom-tree.png`);
    this.load.image("s3-turtle", `${root}turtle.png`);
    this.load.image("s3-bird", `${root}songbird.png`);
    this.load.image("s3-flying-bird", `${root}flying-songbird.png`);
    this.load.image("s3-hive", `${root}bee-hive.png`);
    this.load.image("s3-nest", `${root}bird-nest.png`);
    this.load.image("s3-bee", `${root}honey-bee.png`);
  }

  create() {
    this.trees = [];
    this.buildSky();
    this.hills = this.add.image(W / 2, 405, "s3-hills")
      .setOrigin(.5, 1).setDisplaySize(W + 400, 600).setDepth(-90);
    this.terrain = this.add.image(W / 2, H, "s3-terrain")
      .setOrigin(.5, 1).setDisplaySize(W + 400, 720).setDepth(-60);
    this.applyTerrainHorizonFade();

    [
      [1320, 430, .26, -.4, false], [310, 365, .145, .8, true],
      [1450, 815, .255, 1.9, true], [1215, 640, .14, 3.0, false]
    ].forEach((args, i) => this.addTree(...args, i));

    this.addHive(305, 285);
    this.addNest(1375, 665);
    this.addTurtle(1210, 770);
    this.addGroundBirds();
    this.addPerchedBird(1360, 330, .039, false);
    this.addPerchedBird(1350, 672, .037, true);
    this.addInsects();

    this.scale.on("resize", this.fitWorld, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.fitWorld, this);
    });
    this.time.delayedCall(60, () => this.fitWorld());
  }

  buildSky() {
    this.cameras.main.setBackgroundColor("#9bd8e5");
    const sky = this.add.graphics().setDepth(-100);
    sky.fillGradientStyle(0x82cde1, 0x82cde1, 0xc7eadc, 0xc7eadc, 1).fillRect(-200, 0, W + 400, 410);
    sky.fillStyle(0xfff2ad, .72).fillCircle(1430, 105, 58);
    sky.fillStyle(0xffffff, .42).fillEllipse(205, 130, 210, 38).fillEllipse(1110, 165, 150, 27);
  }

  applyTerrainHorizonFade() {
    const maskTexture = this.textures.createCanvas("s3-terrain-horizon-mask", 8, 720);
    const context = maskTexture.getContext();
    const fade = context.createLinearGradient(0, 0, 0, 96);
    fade.addColorStop(0, "rgba(255,255,255,0)");
    fade.addColorStop(.28, "rgba(255,255,255,.18)");
    fade.addColorStop(.7, "rgba(255,255,255,.78)");
    fade.addColorStop(1, "rgba(255,255,255,1)");
    context.clearRect(0, 0, 8, 720);
    context.fillStyle = fade;
    context.fillRect(0, 0, 8, 96);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 96, 8, 624);
    maskTexture.refresh();

    this.terrainMaskSource = this.make.image({
      x: W / 2, y: H, key: "s3-terrain-horizon-mask", add: false
    }).setOrigin(.5, 1).setDisplaySize(W + 400, 720);
    this.terrain.setMask(this.terrainMaskSource.createBitmapMask());
  }

  addTree(x, y, scale, phase, flip, index) {
    this.add.ellipse(x, y + 4, 250 * scale * 2.2, 40 * scale * 2, 0x284b2d, .26).setDepth(y - 2);
    const tree = this.add.image(x, y, "s3-tree").setOrigin(.5, .985)
      .setScale(flip ? -scale : scale, scale).setDepth(y);
    tree.wind = { phase, speed: .42 + index * .035, amount: .34 + index * .08 };
    this.trees.push(tree);
  }

  addHive(x, y) {
    const hive = this.add.image(x, y, "s3-hive")
      .setOrigin(.5, .08).setScale(.038).setDepth(1200);
    this.tweens.add({ targets: hive, angle: 2, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  addNest(x, y) {
    this.add.image(x, y, "s3-nest")
      .setOrigin(.5, .72).setScale(.044).setDepth(1190);
  }

  addTurtle(x, y) {
    this.add.ellipse(x, y + 4, 88, 15, 0x29462d, .28).setDepth(1450);
    const turtle = this.add.image(x, y, "s3-turtle").setOrigin(.5, .82).setScale(.062).setDepth(1460);
    this.tweens.add({ targets: turtle, x: x + 42, duration: 11000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.tweens.add({ targets: turtle, angle: .8, duration: 920, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  addGroundBirds() {
    // The former riverside feeding pair now crosses the upper valley. There
    // is deliberately no grain pile and no pecking motion.
    [[220, 105, .025, false, 0], [1130, 120, .023, true, 700]]
      .forEach(([x, y, s, flip, delay], index) => {
        const bird = this.add.image(x, y, "s3-flying-bird").setOrigin(.5)
          .setScale(flip ? -s : s, s).setDepth(1530).setAlpha(.82)
          .setTint(0xc7d5d0).setAngle(flip ? -3 : 3);
        this.tweens.add({
          targets: bird,
          x: x + (flip ? -155 : 155),
          y: y + (index ? 13 : -11),
          angle: flip ? 2 : -2,
          duration: 4300 + index * 600,
          delay,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
        this.tweens.add({ targets: bird, scaleY: s * .91, duration: 520 + index * 70,
          yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      });

    const pathBird = this.add.image(1260, 655, "s3-bird").setOrigin(.5, .88)
      .setScale(-.033, .033).setDepth(1530);
    this.tweens.add({ targets: pathBird, y: 652, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  addPerchedBird(x, y, scale, flip) {
    const bird = this.add.image(x, y, "s3-bird").setOrigin(.5, .9)
      .setScale(flip ? -scale : scale, scale).setDepth(1550);
    this.tweens.add({ targets: bird, scaleY: scale * 1.018, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  addInsects() {
    this.bees = [];
    [[365, 540, 0, false], [1110, 600, 2.2, true]].forEach(([x, y, phase, flip], index) => {
      const scale = .018;
      const bee = this.add.image(x, y, "s3-bee").setOrigin(.5)
        .setScale(flip ? -scale : scale, scale).setDepth(1700)
        .setAngle(flip ? -4 : 4);
      this.bees.push(bee);
      this.tweens.add({ targets: bee, x: x + (flip ? -55 : 55), y: y - 24, angle: flip ? 5 : -5,
        duration: 2200 + phase * 300,
        yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.tweens.add({ targets: bee, scaleY: scale * .88, duration: 115 + index * 18,
        yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    });
  }

  fitWorld() {
    const width = this.game.canvas.clientWidth || this.scale.width;
    const height = this.game.canvas.clientHeight || this.scale.height;
    const zoom = Math.max(width / W, height / H);
    this.cameras.main.setViewport(0, 0, width, height).setZoom(zoom);
    this.cameras.main.setScroll(W / 2 - width / (2 * zoom), H / 2 - height / (2 * zoom));
  }

  update(time, delta) {
    this.hype = Math.max(0, this.hype - Math.min(delta / 1000, .05) * .24);
    this.trees.forEach(tree => {
      const w = tree.wind;
      tree.setAngle((Math.sin(time * .001 * w.speed + w.phase) * w.amount + Math.sin(time * .0002) * .12) * (1 + this.hype * .04));
    });
    if (this.hills) this.hills.x = W / 2 + Math.sin(time * .00004) * 3;
  }

  setHype(combo) { this.hype = Math.min(8, Math.max(0, Number(combo) || 0)); }
  setExtraParticles(enabled) { this.bees?.forEach(bee => bee.setVisible(enabled)); }
}
