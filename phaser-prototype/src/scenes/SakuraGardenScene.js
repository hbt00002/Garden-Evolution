import Phaser from "phaser";

const W = 1672;
const H = 936;

export class SakuraGardenScene extends Phaser.Scene {
  constructor() {
    super("SakuraGardenScene");
    this.trees = [];
    this.petals = [];
    this.hype = 0;
  }

  preload() {
    const root = "/assets/stage4-v1/";
    this.load.image("s4-mountains", `${root}sakura-mountains.png`);
    this.load.image("s4-valley", `${root}sakura-valley.png`);
    this.load.image("s4-tree", `${root}sakura-tree.png`);
    this.load.image("s4-mid-tree", `${root}sakura-midground.png`);
    this.load.image("s4-petal-pile", `${root}fallen-petals.png`);
  }

  create() {
    this.trees = [];
    this.petals = [];
    this.buildSky();
    this.mountains = this.add.image(W / 2, 535, "s4-mountains")
      .setOrigin(.5, 1).setDisplaySize(W + 400, 660).setDepth(-90);
    this.valley = this.add.image(W / 2, H, "s4-valley")
      .setOrigin(.5, 1).setDisplaySize(W + 400, 720).setDepth(-60);
    this.applyValleyFade();
    this.createPixelMatchedTexture("s4-mid-tree", "s4-mid-tree-pixel", 4);
    this.createPixelMatchedTexture("s4-petal-pile", "s4-petal-pile-pixel", 4);

    this.addPetalPile(1510, 870, 285, true, 1537);
    this.addTree(1510, 865, .255, 1.7, true, 1540);
    this.addPetalPile(116, 870, 245, false, 1507);
    this.addTree(116, 865, .205, .2, false, 1510);
    this.addPetalPile(1450, 544, 132, true, 617);
    this.addMidgroundTree(1450, 540, 154, 2.8, false, 620);
    this.addPetalPile(290, 579, 122, false, 607);
    this.addMidgroundTree(290, 575, 142, 4.1, true, 610);
    this.addOverhangingBranch();
    this.addPetals();

    this.scale.on("resize", this.fitWorld, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.fitWorld, this);
    });
    this.time.delayedCall(60, () => this.fitWorld());
  }

  buildSky() {
    this.cameras.main.setBackgroundColor("#75cfe3");
    const sky = this.add.graphics().setDepth(-110);
    sky.fillGradientStyle(0x58bce3, 0x58bce3, 0xc4eee0, 0xc4eee0, 1)
      .fillRect(-200, 0, W + 400, 430);
    sky.fillStyle(0xfff3b0, .14).fillCircle(252, 126, 132);
    sky.fillStyle(0xfff6c8, .92).fillCircle(252, 126, 62);
    sky.fillStyle(0xffffff, .12)
      .fillTriangle(252, 150, 30, 700, 190, 700)
      .fillTriangle(270, 150, 240, 750, 500, 750);

    this.clouds = this.add.container(0, 0).setDepth(-105).setAlpha(.46);
    [[510, 118, 1], [1110, 150, .72]].forEach(([x, y, s]) => {
      const cloud = this.add.container(x, y);
      cloud.add([
        this.add.ellipse(0, 10, 170 * s, 38 * s, 0xffffff),
        this.add.circle(-42 * s, 0, 27 * s, 0xffffff),
        this.add.circle(12 * s, -10 * s, 35 * s, 0xffffff),
        this.add.circle(55 * s, 5 * s, 24 * s, 0xffffff)
      ]);
      cloud.drift = s;
      this.clouds.add(cloud);
    });
  }

  applyValleyFade() {
    const texture = this.textures.createCanvas("s4-valley-mask", 8, 720);
    const context = texture.getContext();
    const fade = context.createLinearGradient(0, 0, 0, 88);
    fade.addColorStop(0, "rgba(255,255,255,0)");
    fade.addColorStop(.45, "rgba(255,255,255,.42)");
    fade.addColorStop(1, "rgba(255,255,255,1)");
    context.clearRect(0, 0, 8, 720);
    context.fillStyle = fade;
    context.fillRect(0, 0, 8, 88);
    context.fillStyle = "#fff";
    context.fillRect(0, 88, 8, 632);
    texture.refresh();
    this.valleyMaskSource = this.make.image({ x: W / 2, y: H, key: "s4-valley-mask", add: false })
      .setOrigin(.5, 1).setDisplaySize(W + 400, 720);
    this.valley.setMask(this.valleyMaskSource.createBitmapMask());
  }

  createPixelMatchedTexture(sourceKey, targetKey, divisor) {
    const source = this.textures.get(sourceKey).getSourceImage();
    const width = Math.max(1, Math.round(source.width / divisor));
    const height = Math.max(1, Math.round(source.height / divisor));
    const texture = this.textures.createCanvas(targetKey, width, height);
    const context = texture.getContext();
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    texture.refresh();
  }

  addTree(x, y, scale, phase, flip, depth) {
    this.add.ellipse(x, y + 3, 560 * scale, 68 * scale, 0x244922, .26).setDepth(depth - 2);
    const tree = this.add.image(x, y, "s4-tree").setOrigin(.5, .985)
      .setScale(flip ? -scale : scale, scale).setDepth(depth);
    tree.wind = { phase, speed: .34 + this.trees.length * .025, amount: .3 + this.trees.length * .05 };
    this.trees.push(tree);
  }

  addMidgroundTree(x, y, displayHeight, phase, flip, depth) {
    this.add.ellipse(x, y + 2, displayHeight * .8, displayHeight * .08, 0x31552d, .2)
      .setDepth(depth - 2);
    const tree = this.add.image(x, y, "s4-mid-tree-pixel").setOrigin(.5, .965)
      .setDisplaySize(displayHeight * 1.09, displayHeight).setDepth(depth);
    if (flip) tree.setFlipX(true);
    tree.wind = { phase, speed: .3 + this.trees.length * .02, amount: .24 };
    this.trees.push(tree);
  }

  addPetalPile(x, y, width, flip, depth) {
    const pile = this.add.image(x, y, "s4-petal-pile-pixel").setOrigin(.5, .58)
      .setDisplaySize(width, width * .5).setDepth(depth).setAlpha(.88);
    if (flip) pile.setFlipX(true);
  }

  addOverhangingBranch() {
    this.branch = this.add.image(-48, 180, "s4-tree")
      .setOrigin(.49, .88).setScale(.35).setAngle(63).setDepth(1900);
  }

  addPetals() {
    const petalTexture = this.make.graphics({ add: false });
    petalTexture.fillStyle(0xffc4d7).fillEllipse(3, 2, 6, 4);
    petalTexture.generateTexture("s4-petal", 7, 5).destroy();
    const count = this.game.registry.get("lowPower") ? 14 : 24;
    for (let i = 0; i < count; i++) {
      const petal = this.add.image((i * 149) % W, (i * 83) % H, "s4-petal")
        .setDepth(1750).setAlpha(.38 + (i % 4) * .12).setScale(.65 + (i % 3) * .18);
      petal.seed = i * .71;
      petal.speed = 12 + (i % 5) * 3;
      this.petals.push(petal);
    }
  }

  fitWorld() {
    const width = this.game.canvas.clientWidth || this.scale.width;
    const height = this.game.canvas.clientHeight || this.scale.height;
    const zoom = Math.max(width / W, height / H);
    this.cameras.main.setViewport(0, 0, width, height).setZoom(zoom);
    this.cameras.main.setScroll(W / 2 - width / (2 * zoom), H / 2 - height / (2 * zoom));
  }

  update(time, delta) {
    this.hype = Math.max(0, this.hype - Math.min(delta / 1000, .05) * .2);
    this.trees.forEach(tree => {
      const w = tree.wind;
      tree.setAngle(Math.sin(time * .001 * w.speed + w.phase) * w.amount * (1 + this.hype * .04));
    });
    if (this.branch) this.branch.setAngle(63 + Math.sin(time * .00042) * (.42 + this.hype * .025));
    if (this.clouds) this.clouds.x = Math.sin(time * .000055) * 16;
    this.petals.forEach(petal => {
      petal.y += petal.speed * delta / 1000;
      petal.x += (9 + this.hype * .7) * delta / 1000 + Math.sin(time * .0012 + petal.seed) * .18;
      petal.angle += (18 + petal.seed) * delta / 1000;
      if (petal.y > H + 10 || petal.x > W + 10) {
        petal.y = -12 - (petal.seed % 1) * 90;
        petal.x = (petal.seed * 317) % W;
      }
    });
  }

  setHype(combo) { this.hype = Math.min(8, Math.max(0, Number(combo) || 0)); }
  setExtraParticles(enabled) { this.petals?.forEach(petal => petal.setVisible(enabled)); }
}
