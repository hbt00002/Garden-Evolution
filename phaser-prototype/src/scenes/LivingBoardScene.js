import Phaser from "phaser";

const THEMES={1:{frame:0x20384a,edge:0xc6e4f0,cell:0x49677b,cell2:0x304c60},2:{frame:0x244d49,edge:0xb8d9bd,cell:0x537f6c,cell2:0x345f58},3:{frame:0x3f5133,edge:0xe0c77e,cell:0x68744a,cell2:0x465d3c},4:{frame:0x4d2d48,edge:0xf0b3cd,cell:0x76506b,cell2:0x4d344f},5:{frame:0x0b172d,edge:0xb7d3eb,cell:0x233954,cell2:0x13253f}};
const APPROVED_GRASS="board-grass-approved";
const APPROVED_TULIP="board-tulip-approved";
const TULIP_TINTS=[0xd9473f,0x8a5bb8,0xf2c84b,0xf1efe3,0xec83aa,0xe98b35,0x354f99];
// Four overlapping rows turn the lower 70% into one uninterrupted meadow.
// The irregular x offsets prevent visible columns while every tuft still
// touches its neighbours horizontally.
const BACK_GRASS=[
  [.00,.50,.76],[.09,.48,.70],[.18,.51,.82],[.28,.47,.73],[.38,.50,.79],[.48,.46,.69],[.58,.51,.81],[.68,.48,.74],[.78,.50,.80],[.88,.47,.71],[.98,.51,.78],
  [.04,.66,.88],[.14,.63,.79],[.24,.67,.92],[.34,.64,.83],[.44,.68,.90],[.54,.62,.80],[.64,.66,.94],[.74,.63,.82],[.84,.68,.89],[.94,.64,.84],
  [.00,.82,.98],[.10,.79,.90],[.20,.83,1.02],[.30,.80,.94],[.40,.84,1.00],[.50,.78,.91],[.60,.82,1.04],[.70,.79,.93],[.80,.84,1.01],[.90,.80,.95],[1.00,.83,.99],
  [.04,.965,1.08],[.14,.94,1.00],[.24,.975,1.12],[.34,.945,1.04],[.44,.98,1.10],[.54,.935,1.01],[.64,.97,1.13],[.74,.94,1.03],[.84,.98,1.11],[.94,.945,1.05]
];
const FRONT_GRASS=[
  [.045,.965,.96],[.145,.938,.89],[.255,.985,1.08],[.355,.952,.98],[.465,.992,1.12],
  [.575,.948,.96],[.685,.982,1.08],[.785,.941,.91],[.885,.976,1.04],[.965,.949,.90]
];
const TULIPS=[
  [.14,.79,1.16],[.225,.91,.72],[.305,.845,.94],
  [.52,.925,.68],[.585,.76,1.22],
  [.765,.86,.90],[.845,.805,1.08]
];
const EXTRA_TULIPS=[
  [.095,.875,.67,4],[.265,.765,.72,5],[.43,.855,.70,3],
  [.68,.91,.66,0],[.91,.895,.69,2]
];

const softenTint=(color,amount)=>{
  const r=(color>>16)&255,g=(color>>8)&255,b=color&255;
  const gray=Math.round(r*.3+g*.59+b*.11);
  return(Math.round(r+(gray-r)*amount)<<16)|(Math.round(g+(gray-g)*amount)<<8)|Math.round(b+(gray-b)*amount);
};

export class LivingBoardScene extends Phaser.Scene{
  constructor(){
    super("LivingBoardScene");
    this.stage=1;this.motes=[];this.particlesEnabled=true;this.springRopes=[];this.springPivots=[];this.springBackGrass=[];
    this.hype=0;this.windDirection=1;
  }

  preload(){
    this.load.image(APPROVED_GRASS,"/assets/stage3-board-approved/grass-tuft-approved.png");
    this.load.image(APPROVED_TULIP,"/assets/stage3-board-approved/tulip-neutral-approved.png");
  }

  create(){
    this.base=this.add.graphics();
    this.springGround=this.add.graphics().setVisible(false);
    this.springBackLayer=this.add.container().setVisible(false);
    this.springFrontLayer=this.add.container().setVisible(false);
    this.light=this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.fx=this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.lowPower=Boolean(this.game?.registry?.get("lowPower"));
    this.ensureTulipFrames();this.resetMotes();
    this.scale.on("resize",this.redraw,this);
    this.comboHandler=event=>this.setHype(event.detail?.combo||0);
    window.addEventListener("garden:combo",this.comboHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      this.scale.off("resize",this.redraw,this);
      window.removeEventListener("garden:combo",this.comboHandler);
    });
    this.redraw();
  }

  ensureTulipFrames(){
    const texture=this.textures.get(APPROVED_TULIP);
    if(!texture.has("bloom"))texture.add("bloom",0,0,0,48,48);
    if(!texture.has("stem"))texture.add("stem",0,0,42,48,86);
  }

  resetMotes(){
    const count=this.game?.registry?.get("lowPower")?16:24;
    this.motes=Array.from({length:count},(_,i)=>({x:Math.random(),y:Math.random(),speed:.05+Math.random()*.12,drift:.015+Math.random()*.045,phase:Math.random()*Math.PI*2,size:.7+Math.random()*1.8,spin:(Math.random()-.5)*2.2,kind:i%5}));
  }

  setStage(stage){if(!THEMES[stage])return;if(stage!==this.stage)this.resetMotes();this.stage=stage;this.redraw();}
  setHype(combo){this.hype=Math.min(8,Math.max(0,Number(combo)||0));}
  setExtraParticles(enabled){this.particlesEnabled=Boolean(enabled);if(!this.particlesEnabled){this.fx?.clear();this.light?.clear();}}

  clearSpringFlora(){
    this.springBackLayer.removeAll(true);this.springFrontLayer.removeAll(true);
    this.springRopes=[];this.springPivots=[];this.springBackGrass=[];
  }

  makeWindProfile(index,kind){
    const seed=(index+1)*(kind==="tulip"?2.173:1.619);
    return{phase:(seed*2.41)%(Math.PI*2),speed:.82+(seed%.37),amount:kind==="tulip"?5.2+(index%3)*1.15:3.5+(index%4)*.72,inertia:0};
  }

  createRopePlant({x,y,height,width,texture,frame=null,tint=0xffffff,index,kind}){
    const pointCount=kind==="tulip"?5:4;
    // Phaser maps the top of a Rope texture to point zero. Store points from
    // visual tip to fixed root so upright raster plants are never UV-flipped.
    const points=Array.from({length:pointCount},(_,i)=>new Phaser.Math.Vector2(0,-height*(1-i/(pointCount-1))));
    // Rope has per-vertex colors rather than Sprite's Tint component. Using
    // one uniform color array gives the stem the same runtime tint while the
    // bloom remains a regular Sprite using setTint(), as requested.
    const colors=Array(pointCount).fill(tint);
    const rope=this.add.rope(x,y,texture,frame,points,false,colors).setDepth(3+y);
    const sourceWidth=frame==="stem"?48:this.textures.get(texture).getSourceImage().width;
    const xScale=width/sourceWidth;
    rope.setScale(xScale,1);this.springFrontLayer.add(rope);
    const plant={rope,points,baseX:x,baseY:y,height,width,xScale,kind,wind:this.makeWindProfile(index,kind)};
    if(kind==="tulip"){
      const bloomSize=width*1.55;
      plant.bloom=this.add.image(x,y-height,APPROVED_TULIP,"bloom").setOrigin(.5,.86).setDisplaySize(bloomSize,bloomSize).setTint(tint).setDepth(4+y);
      this.springFrontLayer.add(plant.bloom);
    }
    this.springRopes.push(plant);
  }

  createPivotPlant({x,y,height,width,texture,frame=null,tint=0xffffff,index,kind}){
    const sprite=this.add.image(x,y,texture,frame).setOrigin(.5,1).setDisplaySize(width,height).setTint(tint).setDepth(3+y);
    this.springFrontLayer.add(sprite);
    const plant={sprite,kind,wind:this.makeWindProfile(index,kind),baseX:x,baseY:y,height};
    if(kind==="tulip"&&frame==="stem"){
      const bloomSize=width*1.55;
      plant.bloom=this.add.image(x,y-height,APPROVED_TULIP,"bloom").setOrigin(.5,.86).setDisplaySize(bloomSize,bloomSize).setTint(tint).setDepth(4+y);
      this.springFrontLayer.add(plant.bloom);
    }
    this.springPivots.push(plant);
  }

  buildSpringFlora(w,h,s){
    this.clearSpringFlora();if(this.stage!==3)return;
    // The approved 2D tuft is repeated with overlap, depth, scale and tint
    // variation. Roots remain fixed; only upper Rope points sway sideways.
    BACK_GRASS.forEach(([nx,ny,scale],index)=>{
      const rootY=ny*h;
      const back=ny<.58,mid=ny>=.58&&ny<.76;
      const widthJitter=[1.12,.84,1.03,.91,1.18,.78,1.06][index%7];
      const heightJitter=[.78,1.08,.89,1.17,.83,1.01,.72,.96][index%8];
      const layerScale=back?.78:mid?.92:1;
      const mainTint=back?(index%2?0x718b78:0x66816f):mid?(index%2?0x78945e:0x698653):(index%2?0x587c3e:0x668c43);
      const fillTint=back?0x536f62:mid?0x587645:0x416933;
      // A darker half-step companion sits behind every tuft. Together the
      // pair overlaps its neighbours by well over 40%, sealing transparent
      // blade gaps without altering the approved raster asset.
      const fillX=((nx+.048)%1.096)-.048;
      const fill=this.add.image(fillX*w,rootY+h*.012,APPROVED_GRASS).setOrigin(.5,1)
        .setDisplaySize(s*.21*scale*widthJitter,s*.28*scale*heightJitter*layerScale).setFlipX(index%2===0)
        .setTint(fillTint).setAlpha(back?.68:mid?.82:.92).setDepth(.5+rootY);
      this.springBackLayer.add(fill);
      const sprite=this.add.image(nx*w,rootY,APPROVED_GRASS).setOrigin(.5,1)
        .setDisplaySize(s*.21*scale*widthJitter,s*.28*scale*heightJitter*layerScale).setFlipX(index%3===0)
        .setTint(mainTint).setAlpha(back?.58:mid?.7:.82).setDepth(1+rootY);
      this.springBackLayer.add(sprite);this.springBackGrass.push({sprite,phase:index*.83,speed:.48+(index%4)*.05,amount:.55+(index%3)*.22});
    });
    // Two focus tufts sit behind the flowers; the remaining eight are drawn
    // afterwards and obscure selected lower stems.
    FRONT_GRASS.slice(0,2).forEach(([nx,ny,scale],index)=>{
      const spec={x:nx*w,y:ny*h,height:s*.125*scale,width:s*.168*scale,texture:APPROVED_GRASS,tint:index%3===0?0xa9c66f:index%3===1?0x87aa5d:0x98ba68,index,kind:"grass"};
      if(this.lowPower)this.createPivotPlant(spec);else this.createRopePlant(spec);
    });
    // Additional distant flowers enrich the clusters without increasing the
    // expensive Rope count: their small scale makes a rooted pivot sway read
    // naturally at this depth.
    EXTRA_TULIPS.forEach(([nx,ny,scale,colorIndex],index)=>{
      const tint=softenTint(TULIP_TINTS[colorIndex],.14);
      this.createPivotPlant({x:nx*w,y:ny*h,height:s*.19*scale,width:s*.05*scale,texture:APPROVED_TULIP,frame:"stem",tint,index:index+20,kind:"tulip"});
    });
    // Soft contact shadows and pale reflected blades connect each flower to
    // the surrounding meadow. They are inserted before the tulips so neither
    // effect paints over the bloom itself.
    [...TULIPS,...EXTRA_TULIPS].forEach(([nx,ny,scale],index)=>{
      const x=nx*w,y=ny*h,stem=s*.19*scale;
      [[.09,.32],[.065,.22],[.04,.14]].forEach(([size,alpha])=>{
        const shadow=this.add.ellipse(x,y-s*.006,s*size,s*size*.27,0x20341e,alpha).setDepth(2+y);
        this.springFrontLayer.add(shadow);
      });
      const reflected=this.add.image(x+(index%2?1:-1)*s*.025,y,APPROVED_GRASS).setOrigin(.5,1)
        .setDisplaySize(stem*.72,stem*.78).setFlipX(index%2===0).setTint(0xb3c978).setAlpha(.2).setDepth(2.5+y);
      this.springFrontLayer.add(reflected);
    });
    TULIPS.forEach(([nx,ny,scale],index)=>{
      const distant=ny<.84,depthScale=distant?.87:1;
      const tint=distant?softenTint(TULIP_TINTS[index],.13):TULIP_TINTS[index];
      const spec={x:nx*w,y:ny*h,height:s*.19*scale*depthScale,width:s*.05*scale*depthScale,texture:APPROVED_TULIP,frame:"stem",tint,index,kind:"tulip"};
      if(this.lowPower)this.createPivotPlant(spec);else this.createRopePlant(spec);
    });
    // Root-level occluders are deliberately added after the tulips. Their
    // height is tied to each stem, so roughly its lower half disappears into
    // the meadow while the bloom remains fully readable.
    [...TULIPS,...EXTRA_TULIPS].forEach(([nx,ny,scale],index)=>{
      const coverHeight=s*.19*scale*.5;
      const cover=this.add.image(nx*w,ny*h,APPROVED_GRASS).setOrigin(.5,1)
        .setDisplaySize(coverHeight*1.42,coverHeight).setFlipX(index%2===1)
        .setTint(index%3===0?0x789b51:index%3===1?0x89a95c:0x6f914b).setDepth(5+ny*h);
      this.springFrontLayer.add(cover);
    });
    // The second half is drawn last, hiding the lower tulip stems inside the
    // meadow instead of leaving the flowers floating in a separate row.
    FRONT_GRASS.slice(2).forEach(([nx,ny,scale],localIndex)=>{
      const index=localIndex+2;
      const spec={x:nx*w,y:ny*h,height:s*.13*scale,width:s*.172*scale,texture:APPROVED_GRASS,tint:index%3===0?0xa9c66f:index%3===1?0x87aa5d:0x98ba68,index,kind:"grass"};
      if(this.lowPower)this.createPivotPlant(spec);else this.createRopePlant(spec);
    });
    // Only blooms are promoted above the final grass layer. Stems keep their
    // original depth and remain naturally occluded inside the meadow.
    this.springRopes.forEach(plant=>{if(plant.bloom)this.springFrontLayer.bringToTop(plant.bloom);});
    this.springPivots.forEach(plant=>{if(plant.bloom)this.springFrontLayer.bringToTop(plant.bloom);});
  }

  redraw(){
    if(!this.base)return;
    const w=this.scale.width,h=this.scale.height,s=Math.min(w,h),g=s/48,r=s/30,t=THEMES[this.stage];
    this.base.clear();this.springGround.clear();
    this.base.fillStyle(0x02060c,.4).fillRoundedRect(g*.25,g*.45,w-g*.5,h-g*.35,r+3);
    this.base.fillStyle(t.frame,.98).fillRoundedRect(0,0,w,h,r);
    if(this.stage===3){
      const innerX=g*.45,innerY=g*.45,innerW=w-g*.9,innerH=h-g*.9,meadowY=innerY+innerH*.3;
      this.springGround.fillStyle(t.cell2,1).fillRect(innerX,innerY,innerW,innerH*.3);
      this.springGround.fillGradientStyle(t.cell,t.cell,t.cell2,t.cell2,1).fillRect(innerX,meadowY,innerW,innerH*.7);
    }
    this.base.lineStyle(Math.max(1,s/300),t.edge,.78).strokeRoundedRect(1,1,w-2,h-2,r);
    this.base.lineStyle(Math.max(1,s/520),t.edge,.3).strokeRoundedRect(g*.45,g*.45,w-g*.9,h-g*.9,r-3);
    const inner=w-g*2,c=(inner-g*3)/4;
    for(let row=0;row<4;row++)for(let col=0;col<4;col++){
      const x=g+col*(c+g),y=g+row*(c+g);
      this.base.fillStyle(t.cell2,.98).fillRoundedRect(x,y,c,c,Math.max(5,s/48));
      this.base.fillStyle(t.cell,.42).fillRoundedRect(x+2,y+2,c-4,c-4,Math.max(4,s/52));
      this.base.lineStyle(Math.max(1,s/520),t.edge,.25).strokeRoundedRect(x+.5,y+.5,c-1,c-1,Math.max(5,s/48));
    }
    const visible=this.stage===3;
    this.springGround.setVisible(visible);this.springBackLayer.setVisible(visible);this.springFrontLayer.setVisible(visible);
    this.buildSpringFlora(w,h,s);
  }

  updateSpringFlora(time,delta){
    if(this.stage!==3)return;
    this.hype=Math.max(0,this.hype-Math.min(delta/1000,.05)*.24);
    const p=time*.001,energy=1+this.hype*.04,dir=this.windDirection;
    this.springRopes.forEach(plant=>{
      const{points,wind}=plant;
      for(let i=0;i<points.length;i++){
        const normalized=1-i/(points.length-1),bend=Math.pow(normalized,1.3);
        // Pure 2D sway: y never changes, the fixed root stays at x=0 and
        // each upper point moves only left/right before returning to zero.
        const gust=Math.sin(p*wind.speed+wind.phase)*wind.amount*energy*dir;
        // Rope width is scaled independently; compensate its local x offset
        // so the requested bend remains in board pixels after that scaling.
        points[i].x=(gust*bend)/plant.xScale;points[i].y=-plant.height*normalized;
      }
      plant.rope.setDirty();
      if(plant.bloom){
        const tip=points[0],actualTipX=tip.x*plant.xScale;
        wind.inertia+=(actualTipX-wind.inertia)*Math.min(1,delta*.0065);
        plant.bloom.setPosition(plant.baseX+actualTipX,plant.baseY+tip.y).setAngle(wind.inertia*.55*dir);
      }
    });
    this.springPivots.forEach(plant=>{
      const{sprite,wind,kind}=plant,angle=Math.sin(p*wind.speed+wind.phase)*(kind==="tulip"?1.4:1.05)*energy*dir;
      sprite.setAngle(angle);
      if(plant.bloom){
        const radians=Phaser.Math.DegToRad(angle);
        plant.bloom.setPosition(plant.baseX+Math.sin(radians)*plant.height,plant.baseY-Math.cos(radians)*plant.height).setAngle(angle*.7);
      }
    });
    this.springBackGrass.forEach(({sprite,phase,speed,amount})=>sprite.setAngle(Math.sin(p*speed+phase)*amount*energy*dir));
  }

  respawn(m){m.y=-.06-Math.random()*.22;m.x=Math.random();}
  update(time,delta){
    const w=this.scale.width,h=this.scale.height,s=Math.min(w,h),p=time*.001,dt=Math.min(delta,34)/1000;
    this.updateSpringFlora(time,delta);this.light.clear();this.fx.clear();if(!this.particlesEnabled)return;
    if(this.stage===1)this.snow(p,dt,w,h,s);else if(this.stage===2)this.rain(p,dt,w,h,s);else if(this.stage===3)this.spring(p,w,h,s);else if(this.stage===4)this.sakura(p,dt,w,h,s);else this.moon(p,w,h,s);
  }

  snow(p,dt,w,h,s){this.motes.slice(0,20).forEach((m,i)=>{m.y+=m.speed*.36*dt;m.x+=(m.drift*.18+Math.sin(p*.75+m.phase)*.006)*dt;if(m.y>1.04||m.x>1.08)this.respawn(m);const x=m.x*w,y=m.y*h,r=Math.max(1,m.size*s/310),a=.24+(i%4)*.08;this.fx.lineStyle(Math.max(.7,s/650),0xf1fbff,a);this.fx.lineBetween(x-r,y,x+r,y).lineBetween(x,y-r,x,y+r).lineBetween(x-r*.7,y-r*.7,x+r*.7,y+r*.7).lineBetween(x+r*.7,y-r*.7,x-r*.7,y+r*.7);});}
  rain(p,dt,w,h,s){this.motes.forEach((m,i)=>{const leaf=m.kind===0;m.y+=m.speed*(leaf?.38:1.45)*dt;m.x+=(leaf?Math.sin(p*1.15+m.phase)*m.drift*.28:-m.drift*.12)*dt;if(m.y>1.06||m.x<-.08||m.x>1.08)this.respawn(m);const x=m.x*w,y=m.y*h;if(leaf){const turn=Math.abs(Math.sin(p*m.spin+m.phase));this.fx.fillStyle(i%2?0xc79047:0x89a84f,.44).fillEllipse(x,y,m.size*s/170,Math.max(1,turn*m.size*s/300));this.fx.lineStyle(.7,0x54482f,.38).lineBetween(x-1,y+1,x+m.size,y-m.size*.5);}else{const len=s*(.017+m.size*.005);this.fx.lineStyle(Math.max(.65,s/720),0xc7e4ea,.17+(i%3)*.06).lineBetween(x,y,x-w*.009,y+len);this.fx.fillStyle(0xe3f4f6,.18).fillCircle(x-w*.009,y+len,Math.max(.7,s/700));}});}
  spring(p,w,h,s){this.motes.slice(0,7).forEach((m,i)=>{const x=w*(.1+m.x*.8)+Math.sin(p*(.7+m.speed*3)+m.phase)*s*(.035+i%2*.012),y=h*(.12+m.y*.72)+Math.cos(p*(.9+m.speed*2)+m.phase)*s*.025,b=Math.max(1.2,s/260);this.light.fillStyle(0xffef8a,.045).fillCircle(x,y,b*4.8);this.light.fillStyle(0xffe35c,.09).fillCircle(x,y,b*3.1);this.light.fillStyle(0xffd43d,.18).fillCircle(x,y,b*1.8);this.fx.fillStyle(0xffe66a,.9).fillCircle(x,y,b*.58);this.fx.fillStyle(0x3b3024,.72).fillRect(x-b*.25,y-b*.6,b*.4,b*1.2);this.fx.fillStyle(0xeaf7ee,.36).fillEllipse(x-b*.8,y-b*.8,b,b*.7).fillEllipse(x+b*.8,y-b*.8,b,b*.7);});}
  sakura(p,dt,w,h,s){this.motes.slice(0,21).forEach((m,i)=>{m.y+=m.speed*.48*dt;m.x+=(Math.sin(p*.85+m.phase)*m.drift*.32+.006)*dt;if(m.y>1.05||m.x>1.08)this.respawn(m);const x=m.x*w,y=m.y*h,turn=Math.abs(Math.sin(p*1.3*m.spin+m.phase));this.fx.fillStyle(i%3===0?0xffd6e6:0xf5a9c8,.34+(i%4)*.06).fillEllipse(x,y,Math.max(1.5,m.size*s/180),Math.max(.8,turn*m.size*s/310));this.fx.fillStyle(0xffe9f1,.26).fillCircle(x+m.size,y,m.size*.35);});}
  moon(p,w,h,s){const sw=Math.sin(p*.48)*s*.012;this.fx.lineStyle(Math.max(4,s/82),0x81583a,.9).beginPath().moveTo(-s*.02,h*.18).lineTo(w*.08,h*.12).lineTo(w*.18+sw,h*.09).lineTo(w*.29+sw*.8,h*.13).lineTo(w*.45+sw,h*.22).strokePath();[[.07,.14],[.15,.09],[.23,.12],[.32,.16],[.39,.19]].forEach(([x,y],i)=>{const dx=sw*(.35+i*.17);this.fx.fillStyle(i%2?0x729064:0x557b5c,.86).fillEllipse(w*x+dx,h*y,s*.072,s*.032);});const x=w*.19+sw*.5,y=h*.2;this.light.fillStyle(0xff7627,.08).fillCircle(x,y,s*.21);this.light.fillStyle(0xff953b,.15).fillCircle(x,y,s*.135);this.light.fillStyle(0xffc06a,.3+.06*Math.sin(p*1.6)).fillCircle(x,y,s*.062);this.fx.lineStyle(Math.max(1,s/420),0xc19865,.9).lineBetween(x,y-s*.072,x,y-s*.02);this.fx.fillStyle(0x8c4d2c,.95).fillRoundedRect(x-s*.038,y-s*.022,s*.076,s*.095,s*.012);this.fx.fillStyle(0xffb253,.88+.08*Math.sin(p*1.6)).fillCircle(x,y+s*.024,s*.019);}
}
