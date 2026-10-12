/* Native motion layer. Decorative only: it never creates or alters weather values. */
(() => {
 'use strict';
 const media=matchMedia('(prefers-reduced-motion: reduce)'),running=new Set();
 let preference='auto',observer=null,sceneObserver=null;
 const enabled=()=>preference!=='reduced'&&!media.matches;
 function animate(el,frames,options={}) {
  if(!enabled()||!el?.animate)return null;
  const a=el.animate(frames,{duration:550,easing:'cubic-bezier(.22,.8,.24,1)',...options});running.add(a);
  a.finished.then(()=>running.delete(a),()=>running.delete(a));return a;
 }
 function cancel(){running.forEach(a=>a.cancel());running.clear();}
 function configure(value){
  preference=value==='reduced'?'reduced':'auto';document.documentElement.dataset.motion=enabled()?'full':'reduced';
  if(!enabled())cancel();
 }
 media.addEventListener('change',()=>configure(preference));
 document.addEventListener('visibilitychange',()=>{document.documentElement.dataset.pageHidden=String(document.hidden);running.forEach(a=>{if(document.hidden)a.pause();else if(enabled())a.play();});});
 document.addEventListener('pointerdown',e=>{
  const b=e.target.closest('button');if(!b||b.disabled||!enabled())return;
  animate(b,[{transform:'scale(1)'},{transform:'scale(.96)',offset:.3},{transform:'scale(1.018)',offset:.7},{transform:'scale(1)'}],{duration:330});
 },{passive:true});
 document.addEventListener('toggle',e=>{if(e.target.tagName==='DETAILS'&&e.target.open)animate(e.target.querySelector('.day-details'),[{opacity:0,transform:'translateY(-7px)'},{opacity:1,transform:'translateY(0)'}],{duration:320});},true);
 function enter(root){
  observer?.disconnect();sceneObserver?.disconnect();cancel();
  if('IntersectionObserver' in window){
   observer=new IntersectionObserver(entries=>entries.forEach((entry,i)=>{
    if(!entry.isIntersecting)return;observer.unobserve(entry.target);
    animate(entry.target,[{opacity:0,transform:'translateY(15px)'},{opacity:1,transform:'translateY(0)'}],{duration:650,delay:Math.min(i*65,260)});
   }),{threshold:.06});
   root.querySelectorAll('.hero,.quick-outlook,.chart-panel,.hourly-strip,.daily-panel,.condition-card').forEach(e=>observer.observe(e));
   sceneObserver=new IntersectionObserver(entries=>entries.forEach(e=>e.target.dataset.paused=String(!e.isIntersecting)),{threshold:0});
   root.querySelectorAll('.sky-scene').forEach(e=>sceneObserver.observe(e));
  }
  root.querySelectorAll('.temp-digits>span').forEach((el,i)=>animate(el,[{transform:'translateY(85%)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:700,delay:80+i*60}));
  root.querySelectorAll('.temperature-fill').forEach((el,i)=>animate(el,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:750,delay:i*35}));
 }
 function chart(root){
  root?.querySelectorAll('.chart-trace').forEach(p=>{
   if(!enabled()||typeof p.getTotalLength!=='function')return;
   const length=p.getTotalLength();if(!length)return;
   p.style.strokeDasharray=String(length);
   const a=animate(p,[{strokeDashoffset:length},{strokeDashoffset:0}],{duration:950});
   const clear=()=>{p.style.strokeDasharray='';p.style.strokeDashoffset='';};
   if(a)a.finished.then(clear,clear);else clear();
  });
 }
 function tabs(root){
  if(!root)return;let indicator=root.querySelector('.tab-indicator');
  if(!indicator){indicator=document.createElement('span');indicator.className='tab-indicator';indicator.setAttribute('aria-hidden','true');root.append(indicator);}
  const b=root.querySelector('[aria-pressed=true]');if(!b)return;
  indicator.style.width=b.offsetWidth+'px';indicator.style.transform=`translateX(${b.offsetLeft}px)`;
 }
 function dialog(el){animate(el,[{opacity:0,transform:'translateY(22px) scale(.975)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:360});}
 function sky(condition,night){
  const rain=['rain','storm','snow'].includes(condition.scene);
  const drops=rain?Array.from({length:18},(_,i)=>`<i class="sky-particle" style="--n:${i%11};--x:${(i*37)%100}%;--delay:-${(i*.37).toFixed(2)}s;--duration:${condition.scene==='snow'?4+(i%4):.85+(i%5)*.17}s"></i>`).join(''):'';
  const stars=night?Array.from({length:16},(_,i)=>`<i class="sky-star" style="--x:${(i*43+11)%100}%;--y:${(i*29+7)%65}%"></i>`).join(''):'';
  return `<div class="sky-scene" data-scene="${condition.scene}" data-night="${night}" data-paused="false" aria-hidden="true"><div class="sky-stars">${stars}</div><div class="orbital-ring outer"></div><div class="orbital-ring"></div><div class="orbital-ring inner"></div><div class="celestial-halo"></div><div class="celestial-body"></div><div class="sky-cloud far"></div><div class="sky-cloud"></div><div class="sky-precip">${drops}</div></div>`;
 }
 window.AtmosMotion=Object.freeze({configure,enabled,enter,chart,tabs,dialog,sky,cancel});
})();
