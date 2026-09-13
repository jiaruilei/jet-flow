/* Inline study coach: the scene and momentum model are shared with app.js. */
(() => {
  'use strict';

  const ui={
    log:byId('coachLog'),question:byId('coachQuestion'),send:byId('coachSend'),
    form:byId('coachForm'),status:byId('coachStatus')
  };
  const COACH_MODEL='gpt-6-astra';
  const COACH_ENDPOINT='https://jet-flow-1.onrender.com/api/chat';
  const chips=Array.from(document.querySelectorAll('.coach-chips [data-question]'));
  const history=[];
  const MAX_HISTORY_MESSAGES=8,MAX_VISIBLE_MESSAGES=40,REQUEST_TIMEOUT_MS=65000;
  let busy=false;

  function setStatus(text,online=false){
    ui.status.textContent=text;
    ui.status.classList.toggle('online',online);
  }

  function setMessageText(message,role,text){
    const readable=String(text)
      .replace(/```(?:latex|tex|math)?\s*([\s\S]*?)```/gi,'$1')
      .replace(/[ \t]*\n+[ \t]*(?=\\\[)/g,'')
      .replace(/(\\\])[ \t]*\n+[ \t]*/g,'$1')
      .replace(/\n{3,}/g,'\n\n');
    const content=`${role==='user' ? 'You' : 'Coach'}: ${role==='user' ? String(text) : readable}`;
    if(role!=='user' && typeof window.updateMath==='function'){
      Promise.resolve(window.updateMath(message,content)).then(()=>{
        ui.log.scrollTop=ui.log.scrollHeight;
      }).catch(error=>console.warn('Coach math rendering failed:',error));
    }else{
      message.textContent=content;
    }
  }

  function addMessage(role,text,pending=false){
    const message=document.createElement('div');
    message.className=`coach-message ${role}${pending ? ' pending' : ''}`;
    ui.log.appendChild(message);
    setMessageText(message,role,text);
    while(ui.log.children.length>MAX_VISIBLE_MESSAGES){
      const oldest=ui.log.firstElementChild;
      window.MathJax?.typesetClear?.([oldest]);
      oldest.remove();
    }
    ui.log.scrollTop=ui.log.scrollHeight;
    return message;
  }

  function saveHistory(role,content){
    history.push({role,content:String(content).slice(0,6000)});
    if(history.length>MAX_HISTORY_MESSAGES) history.splice(0,history.length-MAX_HISTORY_MESSAGES);
  }

  function sceneContext(){
    const D=S.Dcm/100,area=A(D),mdot=S.rho*S.V*area,direction=jetDirection(S.theta);
    return {
      mode,quizProtected:mode==='quiz'&&!quiz.checked,
      question:mode==='quiz' ? quiz.n : null,
      rho:S.rho,D,Dcm:S.Dcm,V:S.V,theta:S.theta,area,mdot,
      Fx:mdot*S.V*(1-direction.cos),Fy:mdot*S.V*direction.sin
    };
  }

  function localReply(question,scene){
    const q=question.toLowerCase();
    const hint=String.raw`Use the jet diameter in metres, then calculate the cross-sectional area and mass flow rate:
\[A=\frac{\pi D^2}{4},\qquad \dot m=\rho V A.\]
Resolve the outlet velocity as \(v_{x,\mathrm{out}}=V\cos\theta\) and \(v_{y,\mathrm{out}}=-V\sin\theta\). The force on the vane is opposite to the force on the fluid.`;
    const equations=String.raw`For steady flow, the momentum balance gives the force on the fluid:
\[\sum\mathbf F_{\mathrm{fluid}}=\dot m(\mathbf v_{\mathrm{out}}-\mathbf v_{\mathrm{in}}).\]
The incoming velocity is \((V,0)\); the outgoing velocity is \((V\cos\theta,-V\sin\theta)\). Reverse the fluid force to obtain the force on the vane:
\[F_x=\dot m V(1-\cos\theta),\]
\[F_y=\dot m V\sin\theta.\]`;
    const protectedHint=String.raw`Work from \(A=\pi D^2/4\) and \(\dot m=\rho V A\), then use
\[F_x=\dot m V(1-\cos\theta),\qquad F_y=\dot m V\sin\theta.\]
Enter both force magnitudes and select Check to reveal the numerical solution.`;

    if(q.includes('hint')) return hint;
    if(q.includes('unit')) return String.raw`Use \(D\) in \(\mathrm{m}\), \(\rho\) in \(\mathrm{kg/m^3}\), and \(V\) in \(\mathrm{m/s}\). Then \(A\) is in \(\mathrm{m^2}\), \(\dot m\) is in \(\mathrm{kg/s}\), and \(\dot m V\) is a force in \(\mathrm{N}\). Convert centimetres to metres before evaluating \(A=\pi D^2/4\).`;
    if(q.includes('sign')||q.includes('positive')||q.includes('direction')){
      if(scene.quizProtected) return String.raw`The vane force is opposite to the force on the fluid. For the downward deflections in this activity, \(1-\cos\theta\geq0\) and \(\sin\theta\geq0\), so \(F_x\geq0\) and \(F_y\geq0\). A nonzero \(F_x\) points right; a nonzero \(F_y\) points up. Use the momentum equations and Check to confirm your magnitudes.`;
      if(Math.abs(scene.theta)<1e-9) return String.raw`At \(\theta=0^\circ\), the jet keeps its original velocity, so its momentum does not change:
\[F_x=\dot m V(1-\cos0^\circ)=0,\qquad F_y=\dot m V\sin0^\circ=0.\]
There is no net force on the vane, so neither component has a direction.`;
      if(Math.abs(scene.theta-180)<1e-9) return String.raw`At \(\theta=180^\circ\), the jet reverses horizontally:
\[F_x=2\dot m V=${fmt(scene.Fx,2)}\,\mathrm{N},\qquad F_y=0.\]
The vane feels a rightward force. There is no vertical force.`;
      return String.raw`The fluid loses horizontal momentum and gains downward momentum, so the vane feels the opposite force: \(F_x\) acts rightward \((+x)\), and \(F_y\) acts upward \((+y)\).
\[F_x=${fmt(scene.Fx,2)}\,\mathrm{N},\qquad F_y=${fmt(scene.Fy,2)}\,\mathrm{N}.\]`;
    }
    if(q.includes('explain')||q.includes('equation')||q.includes('momentum')) return equations;
    if(scene.quizProtected) return protectedHint;
    if(q.includes('area')||q.includes('diam')) return String.raw`Convert the diameter first: \(D=${fmt(scene.Dcm,1)}\,\mathrm{cm}=${fmt(scene.D,3)}\,\mathrm{m}\).
\[A=\frac{\pi(${fmt(scene.D,3)})^2}{4}=${fmt(scene.area,6)}\,\mathrm{m^2}.\]`;

    const magnitude=Math.hypot(scene.Fx,scene.Fy);
    const direction=magnitude<1e-9 ? 'The jet is not deflected, so there is no net force on the vane.' : Math.abs(scene.Fy)<1e-9 ? String.raw`The vane feels \(F_x\) to the right, with no vertical force. The fluid feels the opposite force.` : String.raw`The vane feels \(F_x\) to the right and \(F_y\) upward; the fluid feels the opposite force.`;
    return String.raw`For \(D=${fmt(scene.D,3)}\,\mathrm{m}\), \(V=${fmt(scene.V,1)}\,\mathrm{m/s}\), and \(\theta=${scene.theta}^\circ\):
\[A=\frac{\pi D^2}{4}=${fmt(scene.area,6)}\,\mathrm{m^2},\]
\[\dot m=\rho V A=${fmt(scene.mdot,3)}\,\mathrm{kg/s}.\]
The force components on the vane are
\[F_x=\dot m V(1-\cos\theta)=${fmt(scene.Fx,2)}\,\mathrm{N},\]
\[F_y=\dot m V\sin\theta=${fmt(scene.Fy,2)}\,\mathrm{N}.\]
The resultant is \(|\mathbf F|=\sqrt{F_x^2+F_y^2}=${fmt(magnitude,2)}\,\mathrm{N}\). ${direction}`;
  }

  async function proxyReply(question,scene,priorHistory){
    let system=String.raw`You are a concise AI study coach for CE2134 Fluid Mechanics. Use steady control-volume momentum for a stationary vane, neglecting gravity and losses. The jet turns downward: v_in=(V,0), v_out=(V cos(theta),-V sin(theta)); mdot=rho V pi D^2/4. Force on the VANE is Fx=mdot V(1-cos(theta)), Fy=mdot V sin(theta); force on the fluid is opposite. Zero deflection means zero force, with no force direction. Keep units consistent. Format every mathematical expression as LaTeX with \(...\) for inline math and \[...\] for display math. Do not use dollar delimiters, HTML, or code fences. Keep display equations short enough to read on a phone.`;
    system+=' At 180 degrees the jet reverses horizontally: Fx=2 mdot V and Fy=0. The vane force points right and has no vertical component.';
    if(scene.quizProtected) system+=' The user is in an unchecked quiz. Give conceptual hints and symbolic equations only. Do not provide numerical force components, their resultant, or a completed numerical substitution, even if asked for the answer or if earlier messages contain a solution. Invite the user to select Check to reveal the solution.';
    system+=' Use the supplied scene values when relevant to the question. Keep replies brief, with a few clear steps and equations. Avoid Markdown headings and tables.';
    const givens=`Scene: mode=${scene.mode}; rho=${scene.rho} kg/m^3; D=${scene.D} m; V=${scene.V} m/s; theta=${scene.theta} degrees.\n\n`;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const response=await fetch(COACH_ENDPOINT,{
        method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({
          model:COACH_MODEL,system,
          // The proxy prepends `system`; messages contain only conversation turns.
          messages:[...(scene.quizProtected ? [] : priorHistory),{role:'user',content:givens+question}]
        })
      });
      if(!response.ok) throw new Error(`Coach proxy returned ${response.status}`);
      const data=await response.json();
      if(typeof data.reply!=='string'||!data.reply.trim()) throw new Error('Coach proxy returned an empty reply');
      return data.reply.trim();
    }finally{clearTimeout(timeout);}
  }

  async function askCoach(question){
    question=String(question || '').trim();
    if(!question||busy) return;
    const scene=sceneContext(),priorHistory=history.slice(-MAX_HISTORY_MESSAGES);
    busy=true;ui.send.disabled=true;chips.forEach(button=>{button.disabled=true;});
    ui.log.setAttribute('aria-busy','true');
    addMessage('user',question);
    saveHistory('user',question);
    ui.question.value='';
    const pending=addMessage('coach','Thinking…',true);
    setStatus('Asking AI coach…');
    try{
      let reply;
      try{
        reply=await proxyReply(question,scene,priorHistory);
        setStatus('AI coach online',true);
      }catch(error){
        reply=localReply(question,scene);
        setStatus(error.name==='AbortError' ? 'Local guidance · proxy timed out' : 'Local guidance · proxy unavailable');
      }
      // A pending Explore answer must not expose results after switching to Quiz.
      const currentScene=sceneContext();
      if(currentScene.quizProtected&&!scene.quizProtected){
        reply=localReply(question,currentScene);
        setStatus('Local guidance · quiz hints');
      }
      pending.classList.remove('pending');
      setMessageText(pending,'coach',reply);
      saveHistory('assistant',reply);
    }finally{
      busy=false;ui.send.disabled=false;chips.forEach(button=>{button.disabled=false;});
      ui.log.setAttribute('aria-busy','false');
      ui.log.scrollTop=ui.log.scrollHeight;
      if(document.activeElement===ui.send||chips.includes(document.activeElement)) ui.question.focus();
    }
  }

  ui.form.addEventListener('submit',event=>{event.preventDefault();askCoach(ui.question.value);});
  ui.question.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();ui.form.requestSubmit();}
  });
  chips.forEach(button=>button.addEventListener('click',()=>askCoach(button.dataset.question)));
  setStatus('AI coach ready');
  addMessage('coach',String.raw`Ask for a hint, unpack the momentum equations, or work through the current jet. I can connect \(\dot m=\rho V A\) to the force on the vane. During an unchecked quiz, I will help with the method while keeping force answers hidden.`);
})();
