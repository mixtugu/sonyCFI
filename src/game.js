export const WORLD={w:1200,h:720,duration:90,speed:175,radius:13,wallLife:12,maxWalls:5,pushTime:1.4};
export const haven={x:180,y:360,r:115};
export const gate={x:1120,y:360,r:48};
export const treasures=[{x:405,y:215},{x:540,y:530},{x:660,y:320},{x:810,y:160},{x:895,y:555},{x:1030,y:265},{x:1040,y:465}];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function nearest(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return {x:a.x+t*dx,y:a.y+t*dy};}
export function createGame(swapped=false){return {swapped,time:0,child:{x:285,y:360,angle:0},cursor:{x:520,y:360},walls:[],nextId:1,cooldown:0,found:[],safeTime:0,blockedTime:0,breaks:0,logs:[],frames:[],sample:0,ended:false,escaped:false};}
export function addWall(s,a,b){
 if(s.ended||s.cooldown>0)return false;
 a={x:clamp(a.x,25,WORLD.w-25),y:clamp(a.y,25,WORLD.h-25)};
 b={x:clamp(b.x,25,WORLD.w-25),y:clamp(b.y,25,WORLD.h-25)};
 const len=distance(a,b);if(len<35)return false;
 if(len>180)b={x:a.x+(b.x-a.x)*180/len,y:a.y+(b.y-a.y)*180/len};
 if(distance(s.child,nearest(s.child,a,b))<WORLD.radius+10)return false;
 if(s.walls.length>=WORLD.maxWalls)s.walls.shift();
 s.walls.push({id:s.nextId++,a,b,born:s.time,pressure:0});s.cooldown=.65;
 s.logs.push({time:s.time,type:'wall',text:'親が新しい壁を置きました。',x:(a.x+b.x)/2,y:(a.y+b.y)/2});return true;
}
export function step(s,input,dt){
 if(s.ended)return;dt=clamp(dt,0,.05);s.time=Math.min(WORLD.duration,s.time+dt);s.cooldown=Math.max(0,s.cooldown-dt);
 s.walls=s.walls.filter(w=>s.time-w.born<WORLD.wallLife);
 let x=input.x||0,y=input.y||0;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}
 if(len>.05)s.child.angle=Math.atan2(y,x);
 const hit=new Set();
 for(let i=0;i<4;i++){
  s.child.x=clamp(s.child.x+x*WORLD.speed*dt/4,18,WORLD.w-18);
  s.child.y=clamp(s.child.y+y*WORLD.speed*dt/4,18,WORLD.h-18);
  for(const w of s.walls){const q=nearest(s.child,w.a,w.b),d=distance(s.child,q),r=WORLD.radius+5;
   if(d<r){hit.add(w.id);let nx=(s.child.x-q.x)/(d||1),ny=(s.child.y-q.y)/(d||1);if(d<.001){nx=-(w.b.y-w.a.y);ny=w.b.x-w.a.x;const n=Math.hypot(nx,ny);nx/=n;ny/=n;}s.child.x=q.x+nx*r;s.child.y=q.y+ny*r;}
  }
 }
 s.child.x=clamp(s.child.x,18,WORLD.w-18);s.child.y=clamp(s.child.y,18,WORLD.h-18);
 if(hit.size&&len>.05)s.blockedTime+=dt;
 s.walls=s.walls.filter(w=>{w.pressure=hit.has(w.id)&&len>.05?w.pressure+dt:Math.max(0,w.pressure-dt*2);if(w.pressure>=WORLD.pushTime){s.breaks++;s.logs.push({time:s.time,type:'break',text:'子どもが壁を押して乗り越えました。',x:s.child.x,y:s.child.y});return false;}return true;});
 if(distance(s.child,haven)<haven.r)s.safeTime+=dt;
 treasures.forEach((p,i)=>{if(!s.found.includes(i)&&distance(s.child,p)<28){s.found.push(i);s.logs.push({time:s.time,type:'pearl',text:`探検家が${s.found.length}個目の真珠を見つけました。`,x:p.x,y:p.y});}});
 if(s.found.length>=5&&distance(s.child,gate)<gate.r){s.escaped=true;s.ended=true;}
 if(s.time>=WORLD.duration)s.ended=true;
 s.sample-=dt;if(s.sample<=0||s.ended){s.frames.push({time:s.time,child:{...s.child},walls:s.walls.map(w=>({...w})),found:[...s.found]});s.sample=.2;}
}
