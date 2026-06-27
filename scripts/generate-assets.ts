/**
 * Offline asset generator — renders the original sprite sheets and field
 * texture to PNG files in assets/generated/ and assets/game/.
 *
 * Run with: bun run scripts/generate-assets.ts
 */
import { createCanvas } from 'canvas';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const FRAME_W = 32;
const FRAME_H = 40;
const DIRECTIONS = 8;
const FRAMES = 4;
const ANIMATIONS = [
  'idle','walk','run','sprint','dribble','pass','shoot','lobPass',
  'tackle','hit','header','celebrate','gkIdle','gkRun','gkCatch','gkDive',
];

const PALETTE = {
  skin: '#f1c27d', skinShade: '#d9a65e', hair: '#3b2a1a',
  boot: '#20242b', bootLace: '#e8e8e8', shadow: 'rgba(0,0,0,0.32)',
};
const TEAMS = [
  { jersey: '#e23b3b', shorts: '#1f2937', trim: '#ffffff' },
  { jersey: '#2f7fd4', shorts: '#0b1f3a', trim: '#ffd23f' },
];

function roundRect(ctx: any, x:number,y:number,w:number,h:number,r:number){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

function drawFrame(ctx:any, ox:number, oy:number, anim:string, frame:number, dir:number, jersey:any){
  ctx.save(); ctx.translate(ox,oy);
  const cx=16, footY=36;
  ctx.fillStyle=PALETTE.shadow;
  ctx.beginPath(); ctx.ellipse(cx,footY+2,9,3,0,0,Math.PI*2); ctx.fill();
  const phase=frame/FRAMES;
  const swing=Math.sin(phase*Math.PI*2);
  let bodyY=footY-22, legSwing=0, armSwing=0, leanX=0, armRaise=0;
  const isGK = anim.startsWith('gk');
  switch(anim){
    case 'idle': bodyY+=Math.sin(phase*Math.PI*2)*0.5; break;
    case 'walk': legSwing=swing*2; armSwing=swing*1.5; break;
    case 'run': legSwing=swing*3; armSwing=swing*2.5; leanX=2; break;
    case 'sprint': legSwing=swing*4; armSwing=swing*3; leanX=3; break;
    case 'dribble': legSwing=swing*2.5; armSwing=swing*2; leanX=2; break;
    case 'pass': armRaise=(frame===1||frame===2)?1:0.3; legSwing=1; break;
    case 'shoot': armRaise=frame>=1?1:0.3; legSwing=2; leanX=2; break;
    case 'lobPass': armRaise=frame>=1?0.8:0.3; legSwing=1; break;
    case 'tackle': bodyY+=8; leanX=4; legSwing=3; break;
    case 'hit': bodyY+=2; armRaise=0.6; break;
    case 'header': bodyY-=4; leanX=2; break;
    case 'celebrate': armRaise=frame%2===0?1:0.7; bodyY+=Math.sin(phase*Math.PI*2)*-2; break;
    case 'gkIdle': bodyY+=Math.sin(phase*Math.PI*2)*0.5; break;
    case 'gkRun': legSwing=swing*2.5; armSwing=swing*2; break;
    case 'gkCatch': armRaise=frame>=1?0.9:0.4; bodyY-=1; break;
    case 'gkDive': bodyY+=4; armRaise=0.8; break;
  }
  ctx.fillStyle=PALETTE.boot;
  ctx.fillRect(cx-4,footY-8-legSwing,3,8+legSwing);
  ctx.fillRect(cx+1,footY-8+legSwing,3,8-legSwing);
  ctx.fillStyle=PALETTE.bootLace;
  ctx.fillRect(cx-4,footY-1-legSwing,3,1);
  ctx.fillRect(cx+1,footY-1+legSwing,3,1);
  ctx.fillStyle=jersey.shorts;
  ctx.fillRect(cx-5,bodyY+6,10,5);
  ctx.fillStyle=jersey.trim;
  ctx.fillRect(cx-5,bodyY+10,10,1);
  ctx.fillStyle=jersey.jersey;
  roundRect(ctx,cx-6+leanX,bodyY,12,8,2); ctx.fill();
  ctx.fillStyle=jersey.trim;
  ctx.fillRect(cx-6+leanX,bodyY+4,12,1);
  ctx.fillStyle=jersey.jersey;
  const armY1=bodyY+2-armSwing;
  ctx.fillRect(cx-8+leanX,armY1,2,5-armRaise*2);
  const armY2=bodyY+2+armSwing;
  if(armRaise>0.5){
    ctx.fillRect(cx+6+leanX,bodyY-1,2,4-armRaise*2);
    ctx.fillRect(cx+5+leanX,bodyY-3,3,2);
  } else {
    ctx.fillRect(cx+6+leanX,armY2,2,5-armRaise*2);
  }
  ctx.fillStyle=PALETTE.skin;
  ctx.beginPath(); ctx.arc(cx+leanX,bodyY-4,4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=PALETTE.hair;
  ctx.fillRect(cx+leanX-4,bodyY-8,8,2);
  ctx.fillRect(cx+leanX-3,bodyY-9,6,1);
  const nx=Math.cos((dir/8)*Math.PI*2), ny=Math.sin((dir/8)*Math.PI*2);
  ctx.fillStyle=PALETTE.skinShade;
  ctx.fillRect(Math.round(cx+leanX+nx*3-0.5),Math.round(bodyY-4+ny*3-0.5),2,2);
  if(isGK){
    ctx.fillStyle='#ffd23f';
    ctx.fillRect(cx-9+leanX,armY1+3,2,2);
    if(armRaise>0.5) ctx.fillRect(cx+5+leanX,bodyY-4,3,2);
    else ctx.fillRect(cx+6+leanX,armY2+3,2,2);
  }
  ctx.restore();
}

function buildSheet(team:number){
  const cols=DIRECTIONS, rows=ANIMATIONS.length*FRAMES;
  const c=createCanvas(cols*FRAME_W, rows*FRAME_H);
  const ctx=c.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  for(let a=0;a<ANIMATIONS.length;a++){
    for(let f=0;f<FRAMES;f++){
      for(let d=0;d<DIRECTIONS;d++){
        drawFrame(ctx, d*FRAME_W, (a*FRAMES+f)*FRAME_H, ANIMATIONS[a], f, d, TEAMS[team]);
      }
    }
  }
  return c;
}

const FIELD_X=56, FIELD_Y=44, FIELD_W=1120, FIELD_H=640;
const FIELD_CX=FIELD_X+FIELD_W/2, FIELD_CY=FIELD_Y+FIELD_H/2;
const FIELD_TOP=FIELD_Y, FIELD_BOTTOM=FIELD_Y+FIELD_H, FIELD_RIGHT=FIELD_X+FIELD_W;
const GOAL_H=148, GOAL_TOP=FIELD_CY-GOAL_H/2, GOAL_BOTTOM=FIELD_CY+GOAL_H/2;
const CENTER_CIRCLE_R=84;
const PENALTY_BOX_W=132, PENALTY_BOX_H=300, GOAL_AREA_W=56, GOAL_AREA_H=176;
const GRASS_LIGHT='#3aa84a', GRASS_DARK='#2f9240', GRASS_EDGE='#46c25a';
const LINE_WHITE='#f4fff0', STANDS_MID='#1a3458', STANDS_DARK='#10243f';
const TRACK='#7a5a2a';
const WORLD_W=1232, WORLD_H=728;

function buildField(){
  const c=createCanvas(WORLD_W,WORLD_H);
  const ctx=c.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle=STANDS_MID; ctx.fillRect(0,0,WORLD_W,WORLD_H);
  ctx.fillStyle=STANDS_DARK; ctx.fillRect(0,0,WORLD_W,Math.floor(WORLD_H*0.25));
  const rowColors=['#d83a3a','#e8c23a','#3aa86b','#3a7ad8'];
  let row=0;
  for(let py=Math.floor(WORLD_H*0.28);py<WORLD_H-1;py+=5){
    const col=rowColors[row%rowColors.length], alt=rowColors[(row+3)%rowColors.length];
    let i=0;
    for(let px=1;px<WORLD_W-1;px+=4){
      ctx.fillStyle=(i+row)%2===0?col:alt;
      ctx.fillRect(px,py,3,3); i++;
    }
    row++;
  }
  const ti=8;
  ctx.fillStyle=TRACK;
  ctx.fillRect(FIELD_X-ti,FIELD_TOP-ti,FIELD_W+ti*2,ti);
  ctx.fillRect(FIELD_X-ti,FIELD_BOTTOM,FIELD_W+ti*2,ti);
  ctx.fillRect(FIELD_X-ti,FIELD_TOP,ti,FIELD_H);
  ctx.fillRect(FIELD_RIGHT,FIELD_TOP,ti,FIELD_H);
  const sc=18, sw=FIELD_W/sc;
  for(let i=0;i<sc;i++){
    ctx.fillStyle=i%2===0?GRASS_LIGHT:GRASS_DARK;
    ctx.fillRect(Math.round(FIELD_X+i*sw),FIELD_TOP,Math.ceil(sw)+1,FIELD_H);
  }
  ctx.fillStyle=GRASS_EDGE;
  ctx.fillRect(FIELD_X,FIELD_TOP,FIELD_W,2);
  ctx.fillRect(FIELD_X,FIELD_TOP,2,FIELD_H);
  ctx.strokeStyle=LINE_WHITE; ctx.fillStyle=LINE_WHITE; ctx.lineWidth=3;
  ctx.strokeRect(FIELD_X+0.5,FIELD_TOP+0.5,FIELD_W,FIELD_H);
  ctx.beginPath(); ctx.moveTo(FIELD_CX+0.5,FIELD_TOP); ctx.lineTo(FIELD_CX+0.5,FIELD_BOTTOM); ctx.stroke();
  ctx.beginPath(); ctx.arc(FIELD_CX,FIELD_CY,CENTER_CIRCLE_R,0,Math.PI*2); ctx.stroke();
  ctx.fillRect(FIELD_CX-2,FIELD_CY-2,4,4);
  for(const side of ['left','right'] as const){
    const lineX=side==='left'?FIELD_X:FIELD_RIGHT;
    const pbX=side==='left'?lineX:lineX-PENALTY_BOX_W;
    ctx.strokeRect(pbX+0.5,FIELD_CY-PENALTY_BOX_H/2+0.5,PENALTY_BOX_W,PENALTY_BOX_H);
    const gaX=side==='left'?lineX:lineX-GOAL_AREA_W;
    ctx.strokeRect(gaX+0.5,FIELD_CY-GOAL_AREA_H/2+0.5,GOAL_AREA_W,GOAL_AREA_H);
  }
  void GOAL_TOP; void GOAL_BOTTOM;
  return c;
}

const out = { generated: path.resolve('assets/generated'), game: path.resolve('assets/game') };
const home = buildSheet(0);
const away = buildSheet(1);
writeFileSync(path.join(out.generated,'player_home.png'), home.toBuffer('image/png'));
writeFileSync(path.join(out.generated,'player_away.png'), away.toBuffer('image/png'));
writeFileSync(path.join(out.game,'player_home.png'), home.toBuffer('image/png'));
writeFileSync(path.join(out.game,'player_away.png'), away.toBuffer('image/png'));
const field = buildField();
writeFileSync(path.join(out.generated,'field.png'), field.toBuffer('image/png'));
writeFileSync(path.join(out.game,'field.png'), field.toBuffer('image/png'));

console.log('Generated:');
console.log('  assets/generated/player_home.png', home.width+'x'+home.height);
console.log('  assets/generated/player_away.png', away.width+'x'+away.height);
console.log('  assets/generated/field.png', field.width+'x'+field.height);

const manifest = {
  generated: new Date().toISOString(),
  spec: { frameW: FRAME_W, frameH: FRAME_H, directions: DIRECTIONS, frames: FRAMES, animations: ANIMATIONS },
  files: ['assets/generated/player_home.png','assets/generated/player_away.png','assets/generated/field.png'],
  license: 'Original work (CC0-equivalent). All pixels generated procedurally; no third-party assets copied.',
};
writeFileSync(path.join(out.generated,'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('  assets/generated/manifest.json');
