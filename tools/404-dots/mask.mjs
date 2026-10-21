import {decode,encode} from './png.mjs';
// source still: SRC=path/to/still.png (8-bit RGB PNG, 599x450). Not kept in the repo.
export const im=decode(process.env.SRC);
// coarse silhouette polygon (image px), clockwise from top of hair
export const POLY=[[268,20],[290,17],[318,24],[332,40],[342,62],[342,84],[336,102],[345,116],[385,126],[405,146],[425,169],[442,203],[456,226],[470,225],[482,228],[487,244],[484,261],[470,268],[452,276],[446,282],[432,266],[408,247],[401,262],[404,278],[406,330],[405,390],[402,450],[286,450],[288,414],[270,420],[200,412],[165,398],[158,380],[175,336],[198,300],[214,262],[205,226],[212,172],[226,142],[252,124],[262,114],[256,96],[254,60],[256,36]];
export function inPoly(x,y,P=POLY){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,yi]=P[i],[xj,yj]=P[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;}
if(process.argv[1].endsWith('mask.mjs')){
 const o=Buffer.from(im.data); for(let y=0;y<im.H;y++)for(let x=0;x<im.W;x++){ if(!inPoly(x,y)){const i=(y*im.W+x)*3; o[i]*=.35;o[i+1]*=.35;o[i+2]*=.35;}}
 encode('mask-debug.png',im.W,im.H,o);}
