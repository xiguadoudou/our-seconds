'use strict';
(() => {
  const $=id=>document.getElementById(id),couple=$('couple'),fx=$('egg-fx');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const timers=new Map();
  function later(key,callback,delay){clearTimeout(timers.get(key));timers.set(key,setTimeout(()=>{timers.delete(key);callback();},delay));}
  function center(element){const r=element.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};}
  function burst(element,stars=false,count=9){
    if(reduced.matches||document.hidden||fx.childElementCount>28)return;
    const {x,y}=center(element);
    for(let i=0;i<count;i++){
      const particle=document.createElement('span');particle.className='egg-particle'+(stars?' star':'');particle.textContent=stars?(i%2?'✧':'✦'):(i%3?'♡':'♥');particle.style.left=x+'px';particle.style.top=y+'px';particle.style.setProperty('--dx',((i-(count-1)/2)*21+(Math.random()-.5)*15)+'px');particle.style.setProperty('--dy',(-45-Math.random()*65)+'px');particle.style.setProperty('--turn',((Math.random()-.5)*65)+'deg');particle.style.setProperty('--wait',(i*23)+'ms');fx.append(particle);setTimeout(()=>particle.remove(),1600);
    }
  }
  let toastTimer;
  function whisper(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3100);}
  let holding=null,holdTimer=0,suppressClick=false;
  const hint=$('couple-hint');
  function toggleHug(){
    const cozy=!couple.classList.contains('is-close');
    if(cozy){const a=couple.querySelector('.name-a').getBoundingClientRect(),b=couple.querySelector('.name-b').getBoundingClientRect();couple.style.setProperty('--hug-shift',Math.max(0,(b.left-a.right-5)/2)+'px');}
    couple.classList.toggle('is-close',cozy);couple.parentElement.classList.toggle('is-cozy',cozy);couple.setAttribute('aria-pressed',String(cozy));
    hint.textContent=cozy?'贴贴成功 ♡ 再长按一下，可以松开。':'长按一下，想和你再靠近一点。';
    if(cozy)burst(couple,false,11);
  }
  function cancelHold(){clearTimeout(holdTimer);holdTimer=0;holding=null;couple.classList.remove('is-holding');}
  couple.classList.remove('is-close','is-holding');couple.parentElement.classList.remove('is-cozy');couple.setAttribute('aria-pressed','false');hint.textContent='长按一下，想和你再靠近一点。';
  couple.addEventListener('pointerdown',e=>{
    if(!e.isPrimary||e.button!==0)return;cancelHold();holding={x:e.clientX,y:e.clientY,id:e.pointerId};couple.classList.add('is-holding');
    holdTimer=setTimeout(()=>{holdTimer=0;couple.classList.remove('is-holding');suppressClick=true;toggleHug();},650);
  });
  couple.addEventListener('pointermove',e=>{if(holding&&Math.hypot(e.clientX-holding.x,e.clientY-holding.y)>10)cancelHold();});
  window.addEventListener('pointerup',cancelHold);window.addEventListener('pointercancel',cancelHold);window.addEventListener('blur',cancelHold);
  couple.addEventListener('contextmenu',e=>e.preventDefault());
  couple.addEventListener('click',e=>{if(suppressClick){suppressClick=false;e.preventDefault();return;}if(e.detail===0)toggleHug();else if(e.target.closest('.heart'))burst(couple,false,5);});
  couple.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat){cancelHold();toggleHug();}}});
  const poem=$('poem'),copy=poem.querySelector('.poem-copy');
  if(!copy.querySelector('.poem-char')){const words=copy.textContent;copy.replaceChildren();Array.from(words).forEach((char,i)=>{const span=document.createElement('span');span.className='poem-char';span.textContent=char;span.style.setProperty('--i',i);copy.append(span);});}
  const lines=['把平凡写成喜欢，把喜欢写成来日方长。','这一行的韵脚，是你。','和你在一起，普通的一天也有了诗意。','两个灵魂，一个小小的宇宙。'];let line=0;
  poem.classList.remove('poem-play');
  poem.addEventListener('click',()=>{
    $('poem-note').textContent=lines[line++%lines.length];
    if(!reduced.matches&&!poem.classList.contains('poem-play')){poem.classList.add('poem-play');later('poem',()=>poem.classList.remove('poem-play'),1500);burst(poem,true,5);}
  });
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries)poem.classList.toggle('poem-in-view',entry.isIntersecting);},{threshold:.3});observer.observe(poem);}else poem.classList.add('poem-in-view');
  document.querySelectorAll('.birthday-wish').forEach((button,i)=>button.addEventListener('click',()=>{
    const card=button.closest('.birthday-card'),name=$('birthday-name-'+i).textContent.replace(/的生日$/,'');
    card.classList.add('wish-lit');later('wish-'+i,()=>card.classList.remove('wish-lit'),1500);burst(button,true,9);whisper(`替${name}许个愿：新的一岁，被喜欢的事和人围绕。`);
  }));
  const heart=$('secret-heart');let hearts=0;heart.textContent='♡';$('secret-note').textContent='';
  const notes=['这颗心，今天也偏向你。','再靠近一点点，好喜欢你。','恭喜发现隐藏款偏爱：不止今天，每天都是你。'];
  heart.addEventListener('click',()=>{hearts++;heart.textContent=hearts>=3?'♥':'♡';$('secret-note').textContent=notes[Math.min(hearts-1,2)];if(!heart.classList.contains('heart-pop')){heart.classList.add('heart-pop');later('heart',()=>heart.classList.remove('heart-pop'),700);}burst(heart,false,hearts%3===0?13:6);});
  $('theme').addEventListener('click',()=>{
    if(!document.body.classList.contains('dark')||reduced.matches||document.hidden)return;
    const star=document.createElement('span');star.className='shooting-star';star.style.left='82%';star.style.top='12%';fx.append(star);setTimeout(()=>star.remove(),1400);
  });
  document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('egg-paused',document.hidden);if(document.hidden){cancelHold();fx.replaceChildren();}});
})();
