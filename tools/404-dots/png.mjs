import fs from 'fs'; import zlib from 'zlib';
export function decode(path){
  const b=fs.readFileSync(path); let p=8, W,H,idat=[];
  while(p<b.length){const len=b.readUInt32BE(p), type=b.toString('ascii',p+4,p+8), d=b.subarray(p+8,p+8+len);
    if(type==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);} if(type==='IDAT')idat.push(d); p+=12+len;}
  const raw=zlib.inflateSync(Buffer.concat(idat)), bpp=3, stride=W*bpp, out=Buffer.alloc(H*stride);
  for(let y=0;y<H;y++){const f=raw[y*(stride+1)]; for(let x=0;x<stride;x++){
    const v=raw[y*(stride+1)+1+x], a=x>=bpp?out[y*stride+x-bpp]:0, u=y?out[(y-1)*stride+x]:0, c=(x>=bpp&&y)?out[(y-1)*stride+x-bpp]:0; let r;
    if(f===0)r=v; else if(f===1)r=v+a; else if(f===2)r=v+u; else if(f===3)r=v+((a+u)>>1); else {const pp=a+u-c,pa=Math.abs(pp-a),pb=Math.abs(pp-u),pc=Math.abs(pp-c); r=v+(pa<=pb&&pa<=pc?a:pb<=pc?u:c);}
    out[y*stride+x]=r&255;}}
  return {W,H,data:out};
}
function crc(buf){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}let r=0xffffffff;for(const x of buf)r=t[(r^x)&255]^(r>>>8);return (r^0xffffffff)>>>0;}
export function encode(path,W,H,rgb){
  const stride=W*3, raw=Buffer.alloc(H*(stride+1)); for(let y=0;y<H;y++){raw[y*(stride+1)]=0; rgb.copy(raw,y*(stride+1)+1,y*stride,(y+1)*stride);}
  const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=2;
  fs.writeFileSync(path,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
