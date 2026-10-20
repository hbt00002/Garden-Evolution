// Graphics.fillCircle and fillEllipse build a many-sided path and triangulate
// it (earcut) every time they are called. The drifting particles call them
// dozens of times per frame, which on a phone was most of the main thread. A
// fan of triangles needs no triangulation and looks the same at these sizes.
export const FAN_MIN=8,FAN_MAX=28;
export function withFastShapes(graphics){
  const fan=(x,y,rx,ry)=>{
    const n=Math.max(FAN_MIN,Math.min(FAN_MAX,Math.round(Math.max(rx,ry)*1.3)));
    let px=x+rx,py=y;
    for(let i=1;i<=n;i++){
      const a=i/n*Math.PI*2,nx=x+Math.cos(a)*rx,ny=y+Math.sin(a)*ry;
      graphics.fillTriangle(x,y,px,py,nx,ny);
      px=nx;py=ny;
    }
    return graphics;
  };
  graphics.fillDisc=(x,y,radius)=>fan(x,y,radius,radius);
  // Like fillEllipse, width and height are the full extent.
  graphics.fillOval=(x,y,width,height)=>fan(x,y,width/2,height/2);
  return graphics;
}
