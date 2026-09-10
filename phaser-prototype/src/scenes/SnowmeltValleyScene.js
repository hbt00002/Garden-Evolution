import Phaser from "phaser";

const DESIGN_W = 1672;
const DESIGN_H = 936;
// Logical source sizes from the approved originals. Display geometry is based
// on these values, so optimized raster dimensions never alter composition.
const MODEL_SIZE = {
  "s2v3-acacia": [1536, 1024],
  "s2v3-hornbeam": [1230, 1278],
  "s2v3-cottage": [1536, 1024],
  "s2v3-frog": [1536, 1024]
};

export class SnowmeltValleyScene extends Phaser.Scene {
  constructor() {
    super("SnowmeltValleyScene");
    this.trees = [];
    this.hype = 0;
  }

  preload() {
    const root = "/assets/stage2-v3/";
    this.load.image("s2v3-mountains", `${root}mountain-ridge.png`);
    this.load.image("s2v3-meadow", `${root}meadow-river.png`);
    this.load.image("s2v3-acacia", `${root}acacia.png`);
    this.load.image("s2v3-hornbeam", `${root}hornbeam.png`);
    this.load.image("s2v3-cottage", `${root}cottage.png`);
    this.load.image("s2v3-frog", `${root}frog-v2.png`);
  }

  create() {
    this.trees = [];
    this.cameras.main.setBackgroundColor("#b8d6d5");
    this.buildSky();
    this.mountains = this.add.image(DESIGN_W / 2, 410, "s2v3-mountains")
      .setOrigin(.5, 1).setDisplaySize(DESIGN_W + 400, 594).setDepth(-90);
    this.meadow = this.add.image(DESIGN_W / 2, DESIGN_H + 16, "s2v3-meadow")
      // Extend the textured terrain beneath the foothills so the transparent
      // edges of the two generated layers overlap instead of exposing the sky.
      // Keep its former top edge while extending 16 design pixels below the
      // nominal scene edge. This prevents fractional camera scaling from
      // sampling the clear colour along the final screen row.
      .setOrigin(.5, 1).setDisplaySize(DESIGN_W + 400, 741).setDepth(-60);

    this.addGroundedCottage(1335, 690, .27);
    [
      [205, 665, "s2v3-hornbeam", .19, -.7],
      [315, 790, "s2v3-acacia", .24, .35],
      [1420, 850, "s2v3-hornbeam", .21, 1.2],
      [1235, 790, "s2v3-acacia", .205, 2.1],
      [175, 900, "s2v3-acacia", .20, 2.8],
      [1110, 565, "s2v3-hornbeam", .115, 3.6]
    ].forEach((tree, index) => this.addGroundedTree(...tree, index));

    this.frogs = [
      // The generated frog faces left by default. Mirror only the left-bank
      // frog so the pair look inward toward one another.
      // Sit on the broad river stone instead of floating beside its bank.
      // Broad flat stone in the lower-left river: the container baseline is
      // aligned to the stone's upper surface so the frog reads as seated on it.
      this.createFrog(510, 790, .050, 0, true),
      this.createFrog(1245, 875, .048, 1, false)
    ];
    this.buildWaterLife();
    this.buildAirParticles();
    this.scale.on("resize", this.fitWorld, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.fitWorld, this);
    });
    this.time.delayedCall(60, () => this.fitWorld());
  }

  buildSky() {
    const sky = this.add.graphics().setDepth(-100);
    sky.fillGradientStyle(0xb7d7d8, 0xb7d7d8, 0xdce7d5, 0xdce7d5, 1).fillRect(-200, 0, DESIGN_W + 400, 390);
    // Opaque terrain underlay: generated foreground plates can land between
    // device pixels at wide aspect ratios. The underlay guarantees that those
    // edge samples reveal meadow green, never the blue camera clear colour.
    sky.fillStyle(0x668446, 1).fillRect(-200, 360, DESIGN_W + 400, DESIGN_H + 220);
    sky.fillStyle(0xf5efc5, .22).fillCircle(1430, 104, 92);
    sky.fillStyle(0xffffff, .22).fillEllipse(210, 128, 190, 31).fillEllipse(1280, 185, 160, 25);
  }

  addGroundedCottage(x, y, scale) {
    this.add.ellipse(x, y + 5, 330, 42, 0x31482a, .26).setDepth(y - 2);
    const [sourceW, sourceH] = MODEL_SIZE["s2v3-cottage"];
    this.cottage = this.add.image(x, y, "s2v3-cottage").setOrigin(.5, 1)
      .setDisplaySize(sourceW * scale, sourceH * scale).setDepth(y);
  }

  addGroundedTree(x, y, key, scale, phase, index) {
    const shadowW = key.includes("acacia") ? 270 : 185;
    this.add.ellipse(x, y + 4, shadowW * scale * 2.35, 40 * scale * 2.2, 0x29452d, .29).setDepth(y - 2);
    const [sourceW, sourceH] = MODEL_SIZE[key];
    const tree = this.add.image(x, y, key).setOrigin(.5, .985)
      .setDisplaySize(sourceW * scale, sourceH * scale).setDepth(y);
    tree.wind = { phase, speed: .52 + index * .025, amplitude: .34 + (index % 3) * .1 };
    this.trees.push(tree);
  }

  buildWaterLife() {
    const shine = this.add.graphics().setDepth(120);
    [[94, 742, 60], [135, 799, 86], [182, 858, 72], [365, 413, 35]].forEach(([x, y, w]) => {
      shine.lineStyle(2, 0xe8fbf5, .5).lineBetween(x, y, x + w, y - 4);
    });
    this.tweens.add({ targets: shine, alpha: .35, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  buildAirParticles() {
    const mote = this.make.graphics({ add: false });
    mote.fillStyle(0xf4e7a7, 1).fillCircle(2, 2, 2).generateTexture("s2v3-mote", 4, 4).destroy();
    this.pollen = this.add.particles(0, 0, "s2v3-mote", {
      x: { min: 0, max: DESIGN_W }, y: { min: 350, max: 850 }, lifespan: { min: 6500, max: 11000 },
      speedX: { min: 6, max: 16 }, speedY: { min: -7, max: 3 }, alpha: { start: .25, end: 0 },
      scale: { min: .18, max: .48 }, frequency: this.game.registry.get("lowPower") ? 860 : 520, quantity: 1
    }).setDepth(1500);
  }

  createFrog(x, y, scale, phase, flip) {
    const direction = flip ? -1 : 1;
    const frog = this.add.container(x, y).setDepth(2000);
    const shadow = this.add.ellipse(0, 5, 92, 18, 0x233a29, .32);
    const [sourceW, sourceH] = MODEL_SIZE["s2v3-frog"];
    const model = this.add.image(0, 0, "s2v3-frog")
      .setOrigin(.5, .91).setDisplaySize(sourceW * scale, sourceH * scale).setFlipX(flip);
    const throatX = direction * -17;
    const throat = this.add.ellipse(throatX, -22, 24, 19, 0xe8ddb1, .82)
      .setScale(.72, .22).setAlpha(.15);
    frog.add([shadow, model, throat]);
    const restingScaleY = model.scaleY;
    this.tweens.add({ targets: model, scaleY: restingScaleY * 1.018, duration: 1150,
      yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: phase * 430 });
    this.tweens.add({ targets: throat, scaleY: 1.15, scaleX: 1.08, alpha: .88, duration: 760,
      delay: 1500 + phase * 850, hold: 600, yoyo: true, repeat: -1,
      repeatDelay: 2800 + phase * 700, ease: "Sine.easeInOut" });
    return frog;
  }

  fitWorld() {
    const width = this.game.canvas.clientWidth || this.scale.width;
    const height = this.game.canvas.clientHeight || this.scale.height;
    const zoom = Math.max(width / DESIGN_W, height / DESIGN_H);
    this.cameras.main.setViewport(0, 0, width, height).setZoom(zoom);
    this.cameras.main.setScroll(DESIGN_W / 2 - width / (2 * zoom), DESIGN_H / 2 - height / (2 * zoom));
  }

  update(time, delta) {
    this.hype = Math.max(0, this.hype - Math.min(delta / 1000, .05) * .25);
    this.trees.forEach(tree => {
      const w = tree.wind;
      tree.setAngle((Math.sin(time * .001 * w.speed + w.phase) * w.amplitude +
        Math.sin(time * .00019 + w.phase) * .16) * (1 + this.hype * .04));
    });
    if (this.mountains) this.mountains.x = DESIGN_W / 2 + Math.sin(time * .000045) * 3;
  }

  setHype(combo) { this.hype = Math.min(8, Math.max(0, Number(combo) || 0)); }
  setExtraParticles(enabled) { this.pollen?.setVisible(enabled); }
}
