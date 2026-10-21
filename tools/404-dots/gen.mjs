import {im,POLY,inPoly} from './mask.mjs'; import fs from 'fs';
const {W,H,data}=im, N=W*H;
function chaikin(P,n){for(let k=0;k<n;k++){const Q=[];for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];Q.push([.75*a[0]+.25*b[0],.75*a[1]+.25*b[1]],[.25*a[0]+.75*b[0],.25*a[1]+.75*b[1]]);}P=Q;}return P;}
const SP=chaikin(POLY,3);
function dist(x,y){let m=1e9;for(let i=0;i<SP.length;i++){const a=SP[i],b=SP[(i+1)%SP.length],dx=b[0]-a[0],dy=b[1]-a[1];let t=((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy);t=Math.max(0,Math.min(1,t));const d=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);if(d<m)m=d;}return m;}
const fade=(x,y)=>{const u=Math.min(1,dist(x,y)/(isHead(x,y)?6:11));return .3+.7*u*u*(3-2*u);};
const isHead=(x,y)=>(y<128&&x>248&&x<350)||(x>440&&y>218&&y<290);
const L=new Float32Array(N), R=new Float32Array(N), B=new Float32Array(N);
for(let i=0;i<N;i++){R[i]=data[i*3];B[i]=data[i*3+2];L[i]=.299*data[i*3]+.587*data[i*3+1]+.114*data[i*3+2];}
const at=(a,x,y)=>a[Math.max(0,Math.min(H-1,y))*W+Math.max(0,Math.min(W-1,x))];
const blur=new Float32Array(N); for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)s+=at(L,x+i,y+j);blur[y*W+x]=s/9;}
const edge=new Float32Array(N); let em=0;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const gx=at(blur,x+1,y-1)+2*at(blur,x+1,y)+at(blur,x+1,y+1)-at(blur,x-1,y-1)-2*at(blur,x-1,y)-at(blur,x-1,y+1);
 const gy=at(blur,x-1,y+1)+2*at(blur,x,y+1)+at(blur,x+1,y+1)-at(blur,x-1,y-1)-2*at(blur,x,y-1)-at(blur,x+1,y-1); const m=Math.hypot(gx,gy); edge[y*W+x]=m; if(m>em)em=m;}
const e99=(()=>{const v=[...edge].sort((a,b)=>a-b);return v[Math.floor(v.length*.985)];})();
// mask + wall removal
const inJacket=(x,y)=>x>155&&x<340&&y>235&&y<425;
const mask=new Uint8Array(N); let minx=1e9,maxx=0,miny=1e9,maxy=0;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){ if(!inPoly(x,y,SP))continue; const i=y*W+x; const wall=L[i]>95&&L[i]<185&&R[i]-B[i]>10&&R[i]-B[i]<45&&!inJacket(x,y)&&edge[i]<e99*.35; if(wall)continue; mask[i]=1; minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);}
const TARGET=+process.argv[2]||2000; let R0=5.4;
function gen(R0){ let seed=11; const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const cell=R0/1.2, gw=Math.ceil(W/cell), gh=Math.ceil(H/cell), grid=new Array(gw*gh).fill(null).map(()=>[]); const pts=[];
 const put=(p)=>{pts.push(p);grid[((p.y/cell)|0)*gw+((p.x/cell)|0)].push(p);};
 const dens=(i)=>{const y=(i/W)|0, x=i%W; const t=Math.pow(Math.max(0,Math.min(1,(L[i]-18)/200)),.8); const e=Math.min(1,edge[i]/(e99*.8)); const head=isHead(x,y); const hd=head?5:1; const tt=head?Math.pow(Math.max(0,Math.min(1,(L[i]-60)/100)),1.2):t; return {t:tt,e,d:(.05+1.0*tt+1.0*e)*hd};};
 for(let k=0;k<N*3;k++){ const x=rnd()*W, y=rnd()*H, xi=x|0, yi=y|0, i=yi*W+xi; if(!mask[i])continue; const {t,e,d:d0}=dens(i); const f=fade(x,y); const d=d0*(.6+.4*f)*(1+.9*(1-f)*Math.min(1,e*2+t)); if(rnd()>d/3.2)continue; const r=R0/Math.sqrt(d); 
  let ok=true; const gx=(x/cell)|0, gy=(y/cell)|0; for(let j=-2;j<=2&&ok;j++)for(let q=-2;q<=2&&ok;q++){const gi=(gy+j)*gw+gx+q; if(gx+q<0||gx+q>=gw||gy+j<0||gy+j>=gh)continue; for(const p of grid[gi]){const dd=Math.hypot(p.x-x,p.y-y); if(dd<Math.min(r,p.r)*.9){ok=false;break;}}}
  if(!ok)continue; const bb=isHead(x,y)?Math.max(.4,Math.min(1,.3+.8*t)):Math.max(.25,Math.min(1,.2+.85*Math.max(t,e*1.1))); const p={x,y,r,b:Math.max(.12,bb*(.45+.55*f))}; put(p);} return pts;}
let pts=gen(R0); for(let it=0;it<8&&Math.abs(pts.length-TARGET)>60;it++){R0*=Math.sqrt(pts.length/TARGET); pts=gen(R0);} 
console.error('points',pts.length,'R0',R0.toFixed(2),'bbox',minx,miny,maxx,maxy);
// normalise to bbox: x,y in 0..1023 box units
const bw=maxx-minx, bh=maxy-miny, S=Math.max(bw,bh);
const out=pts.map(p=>({x:Math.round((p.x-minx)/S*1023),y:Math.round((p.y-miny)/S*1023),b:Math.round(p.b*15),h:isHead(p.x,p.y)?1:0}));
const enc=out.map(p=>((p.h<<24)|(p.b<<20)|(p.y<<10)|p.x).toString(36).padStart(5,'0')).join('');
fs.writeFileSync('points.json',JSON.stringify({aspect:bw/bh,w:bw,h:bh,S,n:out.length,enc}));
