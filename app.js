/* ---------- Helpers ---------- */
const byId=id=>document.getElementById(id);
const fmt=(x,d=3)=>Number.isFinite(x)?Number(x).toFixed(d):'–';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const A = d => Math.PI*(d*d)/4;

/* ---------- Elements ---------- */
const c=byId('scene'), ctx=c.getContext('2d',{alpha:false});
const els={
  theta:byId('theta'), thetan:byId('thetan'),
  V:byId('V'), Vn:byId('Vn'),
  Dcm:byId('Dcm'), Dcmn:byId('Dcmn'),
  sTheta:byId('sTheta'), sV:byId('sV'), sD:byId('sD'),
  mdotTxt:byId('mdotTxt'),
  Fx:byId('Fx'), Fy:byId('Fy'), Fmag:byId('Fmag'),
  FxDir:byId('FxDir'), FyDir:byId('FyDir'),
  modeExplore:byId('modeExplore'), modeQuiz:byId('modeQuiz'),
  panelExplore:byId('panelExplore'), panelQuiz:byId('panelQuiz'),
  start:byId('start'), check:byId('check'), next:byId('next'),
  qText:byId('qText'), ansFx:byId('ansFx'), ansFy:byId('ansFy'),
  score:byId('score'), qMdot:byId('qMdot'), feedback:byId('feedback'), work:byId('work')
};

/* ---------- State ---------- */
const DEFAULTS={theta:60, V:30, Dcm:3};
const QUIZ_CASES=3;
let S={...DEFAULTS, rho:1000, mdot:0, Fcvx:0, Fcvy:0, Fx_vane:0, Fy_vane:0, Fmag:0};
let exploreInputs={...DEFAULTS};
let mode='explore';
let PATH={}; // geometry (straight → arc → downstream straight)
let animationPaused=false;
let animationFrame=0, lastFrame=0;
let compactCanvas=false;
const quiz={n:0,right:0,answered:0,ansFx:0,ansFy:0,mdot:0,active:false,checked:false,complete:false,params:null};

/* ---------- Bind controls ---------- */
[['theta',0,160,1],['V',2,50,0.1],['Dcm',1,10,0.1]].forEach(([k,min,max])=>{
  const r=els[k], n=els[k+'n'];
  const sync=(val)=>{
    const parsed=String(val).trim()==='' ? NaN : Number(val);
    val=Number.isFinite(parsed) ? clamp(parsed,min,max) : S[k];
    if(k==='theta') val=Math.round(val);
    else val=Math.round(val*10)/10;
    r.value=val; n.value=val; S[k]=val;
    if(mode==='explore') exploreInputs[k]=val;
    compute(); updateStatement();
  };
  r.addEventListener('input',e=>sync(e.target.value));
  n.addEventListener('change',e=>sync(e.target.value));
});
function setMode(which){
  mode=which==='quiz' ? 'quiz' : 'explore';
  const exploring=mode==='explore';
  els.modeExplore.classList.toggle('active',exploring);
  els.modeQuiz.classList.toggle('active',!exploring);
  els.modeExplore.setAttribute('aria-pressed',String(exploring));
  els.modeQuiz.setAttribute('aria-pressed',String(!exploring));
  // Also support the original tab interface when this script is reused.
  if(els.modeExplore.getAttribute('role')==='tab'){
    els.modeExplore.setAttribute('aria-selected',String(exploring));
    els.modeQuiz.setAttribute('aria-selected',String(!exploring));
  }
  els.panelExplore.hidden=!exploring;
  els.panelQuiz.hidden=exploring;
  els.panelExplore.style.display=exploring ? '' : 'none';
  els.panelQuiz.style.display=exploring ? 'none' : '';
  byId('labShell')?.setAttribute('data-mode',mode);
  applyInputs(exploring ? exploreInputs : (quiz.params || exploreInputs));
}
function applyInputs(inputs){
  Object.assign(S,inputs);
  for(const key of ['theta','V','Dcm']){
    els[key].value=S[key]; els[key+'n'].value=S[key];
  }
  compute(); updateStatement();
}
els.modeExplore.addEventListener('click',()=>setMode('explore'));
els.modeQuiz.addEventListener('click',()=>setMode('quiz'));
byId('resetExplore')?.addEventListener('click',()=>{
  exploreInputs={...DEFAULTS};
  setMode('explore');
});
byId('pauseAnimation')?.addEventListener('click',()=>setAnimationPaused(!animationPaused));

/* ---------- Momentum physics ---------- */
function compute(){
  const D = S.Dcm/100; // cm → m
  const mdot = S.rho * S.V * A(D);
  const th = S.theta*Math.PI/180;

  // CV force on fluid
  const Fcvx = mdot*(S.V*Math.cos(th) - S.V);
  const Fcvy = mdot*( - S.V*Math.sin(th));

  // Force on vane = - (force on fluid)
  const Fx_vane = -Fcvx, Fy_vane = -Fcvy, Fmag = Math.hypot(Fx_vane, Fy_vane);

  Object.assign(S,{mdot,Fcvx,Fcvy,Fx_vane,Fy_vane,Fmag});

  els.mdotTxt.textContent=fmt(mdot,3);
  els.Fx.textContent=fmt(Math.abs(Fx_vane),2);
  els.Fy.textContent=fmt(Math.abs(Fy_vane),2);
  els.Fmag.textContent=fmt(Fmag,2);
  els.FxDir.textContent=Fx_vane<1e-9 ? 'No horizontal force' : '+x · to the right';
  els.FyDir.textContent=Fy_vane<1e-9 ? 'No vertical force' : '+y · upward';

  const trail={
    calcArea:`A = π × (${fmt(D,3)} m)² / 4 = ${A(D).toExponential(3)} m²`,
    calcMdot:`ṁ = 1000 × ${fmt(S.V,1)} × ${A(D).toExponential(3)} = ${fmt(mdot,3)} kg/s`,
    calcFx:`Fₓ = ${fmt(mdot,3)} × ${fmt(S.V,1)} × (1 − cos ${S.theta}°) = ${fmt(Fx_vane,2)} N`,
    calcFy:`Fᵧ = ${fmt(mdot,3)} × ${fmt(S.V,1)} × sin ${S.theta}° = ${fmt(Fy_vane,2)} N`,
    calcResult:`|F| = √(Fₓ² + Fᵧ²) = ${fmt(Fmag,2)} N`
  };
  for(const [id,text] of Object.entries(trail)) if(byId(id)) byId(id).textContent=text;

  buildPath();
  requestDraw();
}
function updateStatement(){ els.sTheta.textContent=S.theta.toString(); els.sV.textContent=fmt(S.V,1); els.sD.textContent=fmt(S.Dcm,1); }

/* ---------- Jet path: straight → arc → downstream straight ---------- */
function buildPath(){
  const rawL1=280, rawR=155, rawL2=200, th=S.theta*Math.PI/180;
  const startAng=-Math.PI/2, endAng=startAng+th;
  const Texit={x:Math.cos(th),y:Math.sin(th)};
  const rawExit={x:rawL1+rawR*Math.sin(th),y:rawR*(1-Math.cos(th))};
  const rawEnd={x:rawExit.x+Texit.x*rawL2,y:rawExit.y+Texit.y*rawL2};
  // Fit the entire path, nozzle and labels inside the diagram area at every angle.
  const samples=[{x:0,y:0},rawEnd];
  for(let i=0;i<=40;i++){
    const angle=th*i/40;
    samples.push({x:rawL1+rawR*Math.sin(angle),y:rawR*(1-Math.cos(angle))});
  }
  const minX=Math.min(...samples.map(p=>p.x))-75;
  const maxX=Math.max(...samples.map(p=>p.x))+75;
  const minY=-80, maxY=Math.max(...samples.map(p=>p.y))+70;
  const width=maxX-minX, height=maxY-minY;
  const scale=Math.min(850/width,355/height,1.2);
  const offsetX=55+(850-width*scale)/2-minX*scale;
  const offsetY=125+(355-height*scale)/2-minY*scale;
  const map=p=>({x:offsetX+p.x*scale,y:offsetY+p.y*scale});
  const p0=map({x:0,y:0}), p1=map({x:rawL1,y:0});
  const pe=map(rawExit), p2=map(rawEnd), R=rawR*scale, L1=rawL1*scale,L2=rawL2*scale;
  PATH={p0,p1,cx:p1.x,cy:p1.y+R,R,startAng,endAng,pe,Texit,p2,
    baseY:p0.y,th,L1,L2,scale,totalLength:L1+R*th+L2};
}
function pathPoint(t){
  const {p0,cx,cy,R,startAng,pe,Texit,th,L1,totalLength}=PATH;
  const distance=clamp(t,0,1)*totalLength;
  if(distance<=L1) return {x:p0.x+distance,y:p0.y};
  if(th>1e-8 && distance<=L1+R*th){
    const angle=startAng+(distance-L1)/R;
    return {x:cx+R*Math.cos(angle),y:cy+R*Math.sin(angle)};
  }
  const downstream=distance-L1-R*th;
  return {x:pe.x+Texit.x*downstream,y:pe.y+Texit.y*downstream};
}
function pathTangent(t){
  const eps=1e-4; const a=pathPoint(Math.max(0,t-eps)), b=pathPoint(Math.min(1,t+eps));
  const vx=b.x-a.x, vy=b.y-a.y; const len=Math.hypot(vx,vy)||1; return {x:vx/len, y:vy/len};
}

/* ---------- Particles (lighter) ---------- */
const particles=[]; const Ncols=80, Nrows=6;
function seedParticles(){
  particles.length=0;
  for(let i=0;i<Ncols;i++) for(let j=0;j<Nrows;j++)
    particles.push({s:(i/Ncols), n:((j+0.5)/Nrows - 0.5)*2, r:1.0+Math.random()*1.1, jitter:0.10+Math.random()*0.16});
}
seedParticles();
function currentHalfWidthPx(){ return (5+S.Dcm*2.2)*PATH.scale; }
function stepParticle(p,delta){
  p.s=(p.s+(S.V/40)*delta*0.48)%1;
  const P=pathPoint(p.s), T=pathTangent(p.s), N={x:-T.y, y:T.x};
  const w=currentHalfWidthPx(); const n=p.n;
  p.x=P.x+N.x*n*w; p.y=P.y+N.y*n*w;
}

/* ---------- Quiz (always water) ---------- */
['start','check','next'].forEach(id=>byId(id)?.addEventListener('click',()=>{
  if(id==='start') startQuiz();
  if(id==='check') checkAnswer();
  if(id==='next') nextQ();
}));
['ansFx','ansFy'].forEach(id=>byId(id)?.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!byId('check').disabled) checkAnswer(); }));
function startQuiz(){
  Object.assign(quiz,{n:0,right:0,answered:0,active:true,checked:true,complete:false,params:null});
  els.score.textContent='0/0'; els.start.textContent='Restart quiz';
  nextQ();
}
function nextQ(){
  if(!quiz.active || !quiz.checked || quiz.complete) return;
  if(quiz.n>=QUIZ_CASES){
    quiz.complete=true;
    els.qText.textContent=`Round complete. Final score: ${quiz.right}/${QUIZ_CASES}. Start a new round to practise again.`;
    els.check.disabled=true; els.next.disabled=true;
    requestDraw();
    return;
  }
  quiz.n++;
  // Calculate with exactly the same values shown in the question.
  const Dcm=Math.round(rnd(1.5,6.0)*10)/10, D=Dcm/100;
  const V=Math.round(rnd(5,40)*10)/10, theta=Math.round(rnd(15,120)), rho=1000;
  const mdot=rho*V*A(D), th=theta*Math.PI/180;
  const Fcvx=mdot*(V*Math.cos(th)-V), Fcvy=mdot*(-V*Math.sin(th));
  const Fx_vane=Math.abs(-Fcvx), Fy_vane=Math.abs(-Fcvy);
  Object.assign(quiz,{ansFx:Fx_vane, ansFy:Fy_vane, mdot,checked:false,params:{theta,V,Dcm}});
  els.qText.textContent=`Question ${quiz.n} of ${QUIZ_CASES} · ρ = ${rho} kg/m³, D = ${fmt(Dcm,1)} cm, V = ${fmt(V,1)} m/s, θ = ${theta}°. Find |Fₓ| and |Fᵧ| on the vane.`;
  els.qMdot.textContent=fmt(mdot,3); els.ansFx.value=''; els.ansFy.value='';
  els.check.disabled=false; els.next.disabled=true; els.feedback.style.display='none';
  els.next.textContent=quiz.n===QUIZ_CASES ? 'Finish quiz' : 'Next question';
  els.work.textContent='Check your answer to reveal the worked solution.';
  byId('solutionDetails').open=false;
  setMode('quiz');
  els.ansFx.focus();
}
function checkAnswer(){
  if(!quiz.active || quiz.checked || quiz.complete || mode!=='quiz') return;
  const ux=parseFloat(els.ansFx.value), uy=parseFloat(els.ansFy.value);
  if(!Number.isFinite(ux)||!Number.isFinite(uy)||ux<0||uy<0){ showFeedback('Enter a nonnegative magnitude for both force components.','bad'); return; }
  const tolFx=Math.max(0.5,Math.abs(quiz.ansFx)*0.02), tolFy=Math.max(0.5,Math.abs(quiz.ansFy)*0.02);
  const okx=Math.abs(ux-quiz.ansFx)<=tolFx, oky=Math.abs(uy-quiz.ansFy)<=tolFy;
  if(okx&&oky){ quiz.right++; showFeedback(`Correct! ✔ |Fx|=${fmt(quiz.ansFx,2)} N, |Fy|=${fmt(quiz.ansFy,2)} N.`,'good'); }
  else{ showFeedback(`Not quite. ✖ |Fx|=${fmt(quiz.ansFx,2)} N, |Fy|=${fmt(quiz.ansFy,2)} N.`,'bad'); }
  quiz.checked=true; quiz.answered++;
  els.score.textContent=`${quiz.right}/${quiz.answered}`; byId('check').disabled=true; byId('next').disabled=false;
  const Fmag=Math.hypot(quiz.ansFx,quiz.ansFy);
  els.work.textContent=`ṁ = ρ V A = ${fmt(quiz.mdot,3)} kg/s; A = πD²/4.
For steady CV: ∑F = ṁ(v_out − v_in) (on fluid). Force on vane = −∑F.
So |Fx| = ${fmt(quiz.ansFx,3)} N, |Fy| = ${fmt(quiz.ansFy,3)} N; |F| = ${fmt(Fmag,3)} N.`;
  byId('solutionDetails').open=true;
  requestDraw();
}
function showFeedback(msg,kind){ const el=els.feedback; el.style.display='block'; el.textContent=msg; el.className='pill '+(kind||'warn'); }
function rnd(a,b){ return a + Math.random()*(b-a); }

/* ---------- Drawing (nozzle scales with D) ---------- */
function drawNozzle(){
  const w=currentHalfWidthPx(), x=PATH.p0.x, y=PATH.p0.y;
  ctx.fillStyle='#647993';
  roundRect(ctx,x-58,y-w-11,58,w*2+22,8);ctx.fill();
  ctx.fillStyle='#dce7f5';ctx.fillRect(x-58,y-w,58,w*2);
  ctx.strokeStyle='#48647e';ctx.lineWidth=2;ctx.strokeRect(x-15,y-w-11,15,w*2+22);
}
function drawVaneFlat(){
  const {p1,cx,cy,R,startAng,endAng,th}=PATH;
  const radius=R+currentHalfWidthPx()+10;
  ctx.strokeStyle='#64748b';ctx.lineWidth=12;ctx.lineCap='round';
  ctx.beginPath();
  if(th<1e-8){ctx.moveTo(p1.x-25,p1.y-currentHalfWidthPx()-10);ctx.lineTo(p1.x+110,p1.y-currentHalfWidthPx()-10);}
  else ctx.arc(cx,cy,radius,startAng,endAng);
  ctx.stroke();ctx.lineCap='butt';
  const angle=startAng+th*0.4;
  const label={x:cx+(radius+45)*Math.cos(angle),y:cy+(radius+45)*Math.sin(angle)};
  drawLabel('Stationary vane',clamp(label.x,150,790),clamp(label.y-12,155,458),'#42566e',18);
}
function roundRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.lineTo(x+w-rr,y);ctx.quadraticCurveTo(x+w,y,x+w,y+rr);ctx.lineTo(x+w,y+h-rr);ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);ctx.lineTo(x+rr,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-rr);ctx.lineTo(x,y+rr);ctx.quadraticCurveTo(x,y,x+rr,y);ctx.closePath();}

function drawArrow(x1,y1,x2,y2,color,width=4){
  const length=Math.hypot(x2-x1,y2-y1);
  if(length<1) return;
  const angle=Math.atan2(y2-y1,x2-x1), head=Math.min(12,length*0.35);
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=width;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x2,y2);
  ctx.lineTo(x2-head*Math.cos(angle-0.5),y2-head*Math.sin(angle-0.5));
  ctx.lineTo(x2-head*Math.cos(angle+0.5),y2-head*Math.sin(angle+0.5));
  ctx.closePath();ctx.fill();
}
function drawLabel(text,x,y,color='#123658',size=20){
  if(compactCanvas) size=Math.max(size,28);
  ctx.save();ctx.font=`600 ${size}px system-ui, sans-serif`;ctx.textAlign='center';
  if(compactCanvas){
    const halfWidth=ctx.measureText(text).width/2;
    x=clamp(x,35+halfWidth,c.width-35-halfWidth);
  }
  ctx.lineWidth=7;ctx.strokeStyle='#edf5ff';ctx.lineJoin='round';ctx.strokeText(text,x,y);
  ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.restore();
}
function revealForces(){return mode==='explore' || (quiz.active && quiz.checked);}
function drawForceVectors(){
  const revealed=revealForces(), color='#c2410c';
  ctx.fillStyle='#ffffff';ctx.strokeStyle='#d1dfed';ctx.lineWidth=1.5;
  if(compactCanvas) roundRect(ctx,45,560,810,280,22);
  else roundRect(ctx,925,124,240,356,18);
  ctx.fill();ctx.stroke();
  ctx.fillStyle='#42566e';ctx.font=`600 ${compactCanvas ? 28 : 19}px system-ui, sans-serif`;
  ctx.fillText('FORCE ON VANE',compactCanvas ? 78 : 945,compactCanvas ? 602 : 159);
  const x=compactCanvas ? 112 : 974,y=compactCanvas ? 780 : 324;
  const maxForce=Math.max(S.Fx_vane,S.Fy_vane),maxLength=compactCanvas ? 137 : 117;
  const lx=maxForce>1e-9 ? Math.max(14,S.Fx_vane/maxForce*maxLength) : 0;
  const ly=maxForce>1e-9 ? Math.max(14,S.Fy_vane/maxForce*maxLength) : 0;
  const symbolicLength=compactCanvas ? maxLength : 100;
  const fxLength=revealed ? lx : symbolicLength,fyLength=revealed ? ly : symbolicLength;
  if(maxForce>1e-9 || !revealed){
    drawArrow(x,y,x+fxLength,y,color,4);
    drawArrow(x,y,x,y-fyLength,color,4);
    ctx.fillStyle=color;ctx.font=`600 ${compactCanvas ? 32 : 21}px system-ui, sans-serif`;
    ctx.fillText('Fₓ',x+fxLength+9,y+7);ctx.fillText('Fᵧ',x+12,y-fyLength+2);
  }
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
  ctx.font=`500 ${compactCanvas ? 32 : 19}px system-ui, sans-serif`;ctx.fillStyle='#42566e';
  const valueX=compactCanvas ? 394 : 945;
  ctx.fillText(revealed ? `Fₓ  ${fmt(S.Fx_vane,1)} N` : 'Fₓ  Find the magnitude',valueX,compactCanvas ? 674 : 375);
  ctx.fillText(revealed ? `Fᵧ  ${fmt(S.Fy_vane,1)} N` : 'Fᵧ  Find the magnitude',valueX,compactCanvas ? 725 : 405);
  ctx.font=`${compactCanvas ? 26 : 17}px system-ui, sans-serif`;ctx.fillStyle='#64748b';
  ctx.fillText(revealed ? (maxForce<1e-9 ? 'No deflection → no force' : '+x right · +y upward') : 'Revealed after Check',valueX,compactCanvas ? 788 : 449);
  if(compactCanvas){
    ctx.strokeStyle='#dce8f5';ctx.beginPath();ctx.moveTo(350,630);ctx.lineTo(350,805);ctx.stroke();
  }
}
function drawScene(delta=0){
  ctx.fillStyle='#edf5ff'; ctx.fillRect(0,0,c.width,c.height);
  ctx.strokeStyle='#dce8f5';ctx.lineWidth=1;
  for(let x=45;x<(compactCanvas ? 855 : 920);x+=40){ctx.beginPath();ctx.moveTo(x,compactCanvas ? 110 : 102);ctx.lineTo(x,486);ctx.stroke();}
  for(let y=126;y<490;y+=40){ctx.beginPath();ctx.moveTo(45,y);ctx.lineTo(compactCanvas ? 855 : 900,y);ctx.stroke();}
  drawNozzle();
  const corridor=new Path2D(); buildCorridor(corridor);
  ctx.fillStyle='#b5daf8';ctx.fill(corridor);ctx.save();ctx.clip(corridor);
  ctx.fillStyle='#257cc0';
  for(const p of particles){stepParticle(p,delta);ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
  ctx.restore();
  ctx.strokeStyle='#6baee0';ctx.lineWidth=1.4;ctx.setLineDash([6,6]);
  ctx.beginPath();for(let i=0;i<=100;i++){const P=pathPoint(i/100);if(i===0)ctx.moveTo(P.x,P.y);else ctx.lineTo(P.x,P.y);}ctx.stroke();ctx.setLineDash([]);
  drawVaneFlat();
  const blue='#2563eb',{p0,p1,pe,p2,Texit}=PATH;
  drawArrow(p0.x+35,p0.y,p1.x-28,p1.y,blue,4);
  drawLabel(`V in = ${fmt(S.V,1)} m/s`,(p0.x+p1.x)/2,p0.y-currentHalfWidthPx()-35,blue);
  const outletStart={x:pe.x+Texit.x*PATH.L2*0.26,y:pe.y+Texit.y*PATH.L2*0.26};
  const outletEnd={x:p2.x-Texit.x*15,y:p2.y-Texit.y*15};
  drawArrow(outletStart.x,outletStart.y,outletEnd.x,outletEnd.y,blue,4);
  drawLabel(`V out = ${fmt(S.V,1)} m/s`,clamp((pe.x+p2.x)/2-Texit.y*50,160,795),
    clamp((pe.y+p2.y)/2+Texit.x*50,145,490),blue);
  // θ is measured clockwise from the incoming +x direction.
  if(PATH.th>0.001){
    ctx.strokeStyle='#6e8197';ctx.lineWidth=1.8;ctx.setLineDash([5,5]);
    ctx.beginPath();ctx.moveTo(pe.x,pe.y);ctx.lineTo(pe.x+70,pe.y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(pe.x,pe.y,41,0,PATH.th);ctx.stroke();
    drawLabel(`θ = ${S.theta}°`,clamp(pe.x+83,140,820),clamp(pe.y+22,150,484),'#42566e',18);
  }
  drawForceVectors();
  ctx.fillStyle='#526982';ctx.font=`${compactCanvas ? 27 : 20}px system-ui, sans-serif`;
  ctx.fillText(`D = ${fmt(S.Dcm,1)} cm`,42,compactCanvas ? 76 : 86);
  if(compactCanvas) return;
  drawArrow(62,570,107,570,'#526982',2);drawArrow(62,570,62,531,'#526982',2);
  ctx.font='17px system-ui, sans-serif';ctx.fillStyle='#526982';ctx.fillText('+x',116,576);ctx.fillText('+y',49,527);
}
function buildCorridor(path){
  const w=currentHalfWidthPx(), offs1=[], offs2=[];
  for(let i=0;i<=120;i++){ const t=i/120,P=pathPoint(t), T=pathTangent(t), N={x:-T.y,y:T.x}; offs1.push({x:P.x+N.x*w,y:P.y+N.y*w}); offs2.push({x:P.x-N.x*w,y:P.y-N.y*w}); }
  path.moveTo(offs1[0].x,offs1[0].y); for(const q of offs1) path.lineTo(q.x,q.y); for(let i=offs2.length-1;i>=0;i--) path.lineTo(offs2[i].x,offs2[i].y); path.closePath();
}
function animate(time){
  animationFrame=0;
  const delta=animationPaused || !lastFrame ? 0 : Math.min((time-lastFrame)/1000,0.05);
  lastFrame=time;drawScene(delta);
  if(!animationPaused) animationFrame=requestAnimationFrame(animate);
}
function requestDraw(){
  if(!animationFrame) animationFrame=requestAnimationFrame(animate);
  const summary=`Water jet at ${fmt(S.V,1)} metres per second and ${fmt(S.Dcm,1)} centimetres diameter, deflected ${S.theta} degrees downward. `+
    (revealForces() ? `Force on vane: ${fmt(S.Fx_vane,2)} newtons right and ${fmt(S.Fy_vane,2)} newtons upward.` : 'Force magnitudes are hidden until you check your quiz answer.');
  c.setAttribute('aria-label',summary);
}
function setAnimationPaused(paused){
  animationPaused=paused;lastFrame=0;
  const button=byId('pauseAnimation');
  if(button){button.textContent=paused ? 'Play animation' : 'Pause animation';button.setAttribute('aria-pressed',String(paused));}
  if(byId('sceneStatus')) byId('sceneStatus').textContent=paused ? 'Animation paused' : 'Flow animation running';
  requestDraw();
}
function resizeScene(){
  const width=c.getBoundingClientRect().width;
  if(width<=0) return;
  const nextCompact=width<=600;
  if(nextCompact===compactCanvas) return;
  compactCanvas=nextCompact;
  c.width=compactCanvas ? 900 : 1200;
  c.height=compactCanvas ? 900 : 600;
  c.style.aspectRatio=compactCanvas ? '900 / 900' : '1200 / 600';
  lastFrame=0;
  requestDraw();
}

/* ---------- Initial view ---------- */
setMode('explore');
setAnimationPaused(animationPaused);
resizeScene();
if(typeof ResizeObserver!=='undefined'){
  const sceneResizeObserver=new ResizeObserver(resizeScene);
  sceneResizeObserver.observe(c.parentElement);
}else window.addEventListener('resize',resizeScene);
