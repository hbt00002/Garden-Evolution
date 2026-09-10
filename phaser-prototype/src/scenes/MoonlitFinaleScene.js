import Phaser from "phaser";

const W = 1672;
const H = 936;

export class MoonlitFinaleScene extends Phaser.Scene {
  constructor() {
    super("MoonlitFinaleScene");
    this.windModels = [];
    this.fireflies = [];
    this.moths = [];
    this.petals = [];
    this.mistBands = [];
    this.hype = 0;
  }

  preload() {
    const root = "/assets/stage5-v2/";
    this.load.image("s5-garden", `${root}quiet-moon-garden.png`);
    this.load.image("s5-moon-branch", `${root}moon-branch.png`);
    this.load.image("s5-moon-reeds", `${root}moon-reeds.png`);
    this.load.image("s5-moon-moth", `${root}moon-moth.png`);
  }

  create() {
    this.windModels = [];
    this.fireflies = [];
    this.moths = [];
    this.petals = [];
    this.mistBands = [];
    this.cameras.main.setBackgroundColor("#07111c");
    this.garden = this.add.image(W / 2, H / 2, "s5-garden")
      .setDisplaySize(W + 400, H).setDepth(-100);
    this.addWaterMist();
    this.addAmbientLights();
    this.addLivingModels();
    this.addFireflies();
    this.addNightPetals();

    this.scale.on("resize", this.fitWorld, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.fitWorld, this);
    });
    this.time.delayedCall(60, () => this.fitWorld());
  }

  addLivingModels() {
    this.branch = this.add.image(-24, 15, "s5-moon-branch")
      .setOrigin(.08, .08).setDisplaySize(760, 507).setDepth(1470).setAlpha(.92);
    this.branch.wind = { base: -3.2, phase: .4, speed: .31, amount: .56 };
    this.windModels.push(this.branch);

    [
      [85, 922, 232, false, .2, 1580],
      [1222, 830, 166, true, 1.8, 1220],
      [1585, 930, 272, true, 3.1, 1600],
      [1438, 708, 126, false, 4.4, 1180]
    ].forEach(([x, y, height, flip, phase, depth], index) => {
      const reeds = this.add.image(x, y, "s5-moon-reeds").setOrigin(.5, .98)
        .setDisplaySize(height * 1.04, height).setFlipX(flip).setDepth(depth)
        .setAlpha(.72 + index * .055);
      reeds.wind = { base: 0, phase, speed: .38 + index * .035, amount: .46 + index * .09 };
      this.windModels.push(reeds);
    });

    const compact = this.scale.width < 760 || this.game.registry.get("lowPower");
    const mothLayout = compact
      ? [[475, 520, .15, 0], [930, 585, .135, 2.1]]
      : [[475, 520, .15, 0], [930, 585, .135, 2.1], [1110, 425, .115, 4.2]];
    mothLayout.forEach(([x, y, scale, phase], index) => {
      const moth = this.add.image(x, y, "s5-moon-moth").setScale(scale)
        .setDepth(1690).setAlpha(.66 + index * .08);
      moth.baseX = x; moth.baseY = y; moth.phase = phase; moth.baseScale = scale;
      this.moths.push(moth);
    });
  }

  addWaterMist() {
    [[1060, 222, 360, .055, 4], [1240, 385, 480, .045, 7], [950, 470, 300, .04, 10]]
      .forEach(([x, y, width, alpha, speed], index) => {
        const mist = this.add.ellipse(x, y, width, 34 + index * 8, 0xb8cee2, alpha)
          .setDepth(index ? 80 : -20).setBlendMode(Phaser.BlendModes.SCREEN);
        mist.baseX = x; mist.speed = speed; mist.phase = index * 1.7;
        this.mistBands.push(mist);
      });
  }

  buildSky() {
    this.cameras.main.setBackgroundColor("#080d26");
    const sky = this.add.graphics().setDepth(-110);
    sky.fillGradientStyle(0x080c25, 0x080c25, 0x24245b, 0x24245b, 1).fillRect(-200, 0, W + 400, 470);

    const stars = [[88,78,2],[175,145,1],[310,62,1],[418,122,2],[575,46,1],[690,152,1],
      [820,72,2],[958,132,1],[1090,54,1],[1184,180,1],[1498,70,2],[1580,168,1],[760,205,1]];
    stars.forEach(([x,y,r], i) => sky.fillStyle(0xeaf0ff, .46 + (i % 4) * .12).fillCircle(x, y, r));

    sky.fillStyle(0xacc8ff, .045).fillCircle(1370, 122, 164);
    sky.fillStyle(0xc9dcff, .09).fillCircle(1370, 122, 125);
    sky.fillStyle(0xe7efff, .2).fillCircle(1370, 122, 91);
    sky.fillStyle(0xfff9dc, .98).fillCircle(1370, 122, 58);
    sky.fillStyle(0xd7d7c9, .17).fillCircle(1387, 108, 10).fillCircle(1348, 139, 7);
    sky.fillStyle(0xd9e8ff, .035)
      .fillTriangle(1370, 168, 970, 860, 1280, 860)
      .fillTriangle(1388, 168, 1220, 900, 1540, 900);
  }

  applyValleyFade() {
    const texture = this.textures.createCanvas("s5-valley-mask", 8, 720);
    const context = texture.getContext();
    const fade = context.createLinearGradient(0, 0, 0, 94);
    fade.addColorStop(0, "rgba(255,255,255,0)");
    fade.addColorStop(.42, "rgba(255,255,255,.38)");
    fade.addColorStop(1, "rgba(255,255,255,1)");
    context.clearRect(0, 0, 8, 720);
    context.fillStyle = fade;
    context.fillRect(0, 0, 8, 94);
    context.fillStyle = "#fff";
    context.fillRect(0, 94, 8, 626);
    texture.refresh();
    this.valleyMaskSource = this.make.image({ x: W / 2, y: H, key: "s5-valley-mask", add: false })
      .setOrigin(.5, 1).setDisplaySize(W + 400, 720);
    this.valley.setMask(this.valleyMaskSource.createBitmapMask());
  }

  addAmbientLights() {
    const lanternGlow = this.make.graphics({ add: false });
    lanternGlow.fillStyle(0xffc85e, .07).fillCircle(18, 18, 18);
    lanternGlow.fillStyle(0xffd97a, .16).fillCircle(18, 18, 11);
    lanternGlow.fillStyle(0xffedb0, .38).fillCircle(18, 18, 5);
    lanternGlow.generateTexture("s5-lantern-glow", 36, 36).destroy();

    [[361,615],[612,327],[731,254],[1014,510]]
      .forEach(([x, y], index) => {
        const light = this.add.image(x, y, "s5-lantern-glow").setDepth(910)
          .setBlendMode(Phaser.BlendModes.ADD).setAlpha(.28).setScale(.85 + (index % 3) * .08);
        this.tweens.add({
          targets: light,
          alpha: .62,
          scaleX: light.scaleX * 1.12,
          scaleY: light.scaleY * 1.12,
          duration: 1450 + index * 137,
          delay: index * 180,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
      });

    const waterGlow = this.make.graphics({ add: false });
    waterGlow.fillStyle(0xbddcff, .04).fillEllipse(52, 10, 104, 20);
    waterGlow.fillStyle(0xd9ebff, .1).fillEllipse(52, 10, 68, 8);
    waterGlow.fillStyle(0xf1f7ff, .18).fillEllipse(52, 10, 32, 3);
    waterGlow.generateTexture("s5-water-glow", 104, 20).destroy();

    [[1208,282,.76],[1268,347,.92],[1350,421,.82]].forEach(([x,y,s], index) => {
      const gleam = this.add.image(x, y, "s5-water-glow").setDepth(905)
        .setBlendMode(Phaser.BlendModes.ADD).setScale(s, s).setAlpha(.16);
      this.tweens.add({
        targets: gleam,
        x: x + 10 + index * 2,
        alpha: .52,
        scaleX: s * 1.18,
        duration: 1750 + index * 260,
        delay: index * 320,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    });

    const wake = this.add.graphics().setDepth(906).setAlpha(.16)
      .setBlendMode(Phaser.BlendModes.ADD);
    wake.lineStyle(2, 0xdbeaff, .5).strokeEllipse(1352, 314, 62, 10);
    wake.lineStyle(1, 0xbfd8ff, .35).strokeEllipse(1370, 321, 90, 13);
    this.tweens.add({ targets: wake, x: 9, alpha: .38, duration: 2200,
      yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  addFireflies() {
    const glow = this.make.graphics({ add: false });
    glow.fillStyle(0xffef9a, .18).fillCircle(8, 8, 8);
    glow.fillStyle(0xfff2a8, .45).fillCircle(8, 8, 4);
    glow.fillStyle(0xfffbd2, 1).fillCircle(8, 8, 1.5);
    glow.generateTexture("s5-firefly", 16, 16).destroy();
    const points = [[210,555],[305,680],[455,790],[650,610],[880,555],[1030,690],[1160,620],[1410,730],[1515,595],[990,825]];
    (this.game.registry.get("lowPower") ? points.slice(0, 5) : points).forEach(([x,y], i) => {
      const fly = this.add.image(x, y, "s5-firefly").setDepth(1720).setAlpha(.35 + (i % 3) * .16);
      fly.baseX = x; fly.baseY = y; fly.phase = i * .83;
      this.fireflies.push(fly);
    });
  }

  addNightPetals() {
    const petal = this.make.graphics({ add: false });
    petal.fillStyle(0xb8cce0, .92).fillEllipse(3, 2, 6, 3);
    petal.generateTexture("s5-night-petal", 7, 5).destroy();
    const count = this.game.registry.get("lowPower") ? 5 : 10;
    for (let i = 0; i < count; i++) {
      const leaf = this.add.image((i * 193 + 80) % W, (i * 113) % H, "s5-night-petal")
        .setDepth(1660).setAlpha(.16 + (i % 4) * .055).setScale(.58 + (i % 3) * .13);
      leaf.phase = i * .77; leaf.speed = 7 + (i % 4) * 2.2;
      this.petals.push(leaf);
    }
  }

  fitWorld() {
    const width = this.game.canvas.clientWidth || this.scale.width;
    const height = this.game.canvas.clientHeight || this.scale.height;
    const zoom = Math.max(width / W, height / H);
    const aspect = width / Math.max(height, 1);
    const focusX = aspect <= (10 / 18) ? .72 : aspect <= .75 ? .68 : aspect <= 1 ? .62 : .5;
    const visibleWorldWidth = width / zoom;
    const overflowX = Math.max(0, W - visibleWorldWidth);
    this.cameras.main.setViewport(0, 0, width, height).setZoom(zoom);
    // Match CSS background-position exactly: horizontal focal crop + top edge.
    // This keeps Phaser's lantern/water overlays registered with the artwork.
    this.cameras.main.setScroll(overflowX * focusX, 0);
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, .05);
    this.hype = Math.max(0, this.hype - dt * .18);
    const energy = 1 + this.hype * .035;
    this.windModels.forEach(model => {
      const w = model.wind;
      model.setAngle(w.base + (Math.sin(time * .001 * w.speed + w.phase) * w.amount +
        Math.sin(time * .00016 + w.phase) * w.amount * .3) * energy);
    });
    this.fireflies.forEach(fly => {
      fly.x = fly.baseX + Math.sin(time * .0007 + fly.phase) * (18 + this.hype);
      fly.y = fly.baseY + Math.cos(time * .0009 + fly.phase * 1.3) * 11;
      fly.alpha = .28 + (Math.sin(time * .0022 + fly.phase) + 1) * .25;
    });
    this.moths.forEach((moth, index) => {
      const orbit = time * (.00048 + index * .000035) + moth.phase;
      moth.x = moth.baseX + Math.sin(orbit) * (48 + index * 9) * energy;
      moth.y = moth.baseY + Math.sin(orbit * 1.7 + .8) * (24 + index * 4);
      moth.angle = Math.cos(orbit) * 7;
      moth.scaleY = moth.baseScale * (.9 + Math.sin(time * .009 + moth.phase) * .09);
    });
    this.mistBands.forEach(mist => {
      mist.x = mist.baseX + Math.sin(time * .00005 * mist.speed + mist.phase) * 42;
      mist.alpha = .025 + (Math.sin(time * .00032 + mist.phase) + 1) * .02;
    });
    this.petals.forEach(leaf => {
      leaf.y += leaf.speed * dt;
      leaf.x += (5 + this.hype * .35) * dt + Math.sin(time * .001 + leaf.phase) * .12;
      leaf.angle += (9 + leaf.phase) * dt;
      if (leaf.y > H + 8 || leaf.x > W + 8) {
        leaf.y = -12 - (leaf.phase % 1) * 80;
        leaf.x = (leaf.phase * 337) % W;
      }
    });
    if (this.garden) this.garden.x = W / 2 + Math.sin(time * .000035) * 1.4;
  }

  setHype(combo) { this.hype = Math.min(8, Math.max(0, Number(combo) || 0)); }
  setExtraParticles(enabled) {
    this.fireflies?.forEach(fly => fly.setVisible(enabled));
    this.moths?.forEach(moth => moth.setVisible(enabled));
    this.petals?.forEach(leaf => leaf.setVisible(enabled));
    this.mistBands?.forEach(mist => mist.setVisible(enabled));
  }
}
