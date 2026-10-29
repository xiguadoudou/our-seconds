'use strict';
(() => {
  const KEY = 'our-seconds-settings-v1';
  const defaults = structuredClone(window.LOVE_CONFIG);
  const $ = id => document.getElementById(id);
  const storage = {get(key) {try{return localStorage.getItem(key);}catch{return null;}},set(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}};
  function valid(c) { return c && Array.isArray(c.names) && c.names.length === 2 && c.names.every(n => typeof n === 'string' && n.trim() && n.length <= 16) && typeof c.start === 'string' && /\+08:00$/.test(c.start) && Number.isFinite(Date.parse(c.start)) && typeof c.letter === 'string' && typeof c.title === 'string'; }
  let config = defaults;
  try {const saved = JSON.parse(storage.get(KEY));if(valid(saved)) config = {...defaults,names:saved.names,start:[Date.parse('2026-03-24T13:00:00+08:00'),Date.parse('2026-04-24T00:00:00+08:00')].includes(Date.parse(saved.start))?defaults.start:saved.start,title:saved.title,letter:saved.letter};} catch {}
  const pad = (n, size=2) => String(n).padStart(size,'0');
  const parts = ms => {let t = Math.max(0, Math.floor(ms));return {days:Math.floor(t/86400000),hours:Math.floor(t/3600000)%24,minutes:Math.floor(t/60000)%60,seconds:Math.floor(t/1000)%60,ms:t%1000};};
  const chinaParts = timestamp => {const d=new Date(timestamp+28800000);return {year:d.getUTCFullYear(),month:d.getUTCMonth(),day:d.getUTCDate(),hours:d.getUTCHours(),minutes:d.getUTCMinutes(),seconds:d.getUTCSeconds()};};
  function anniversary(year,start) {const last = new Date(Date.UTC(year,start.month+1,0)).getUTCDate();return Date.UTC(year,start.month,Math.min(start.day,last),start.hours,start.minutes,start.seconds)-28800000;}
  let startTime, lastDay = '', frame = 0, lastBirthdaySecond = -1;
  const cache = {};
  function text(id,value) {value=String(value);if(cache[id]!==value){$(id).textContent=value;cache[id]=value;}}
  function renderConfig() {
    startTime=Date.parse(config.start);lastDay='';lastBirthdaySecond=-1;
    document.querySelector('.name-a').textContent=config.names[0];document.querySelector('.name-b').textContent=config.names[1];
    document.title = `${config.names.join(' × ')} · 我们的每一秒`;
    $('footer-names').textContent=config.names.join(' & ');$('letter-text').textContent=config.letter;
    const s=chinaParts(startTime);
    $('since').textContent=`${s.year}.${pad(s.month+1)}.${pad(s.day)} · ${pad(s.hours)}:${pad(s.minutes)}${s.seconds?':'+pad(s.seconds):''}`;
    $('since').dateTime=config.start;$('begin-date').textContent=`${s.year} 年 ${s.month+1} 月 ${s.day} 日`;
    update();
  }
  function milestones(now) {
    const current=chinaParts(now),s=chinaParts(startTime);
    let year=Math.max(current.year,s.year+1),next=anniversary(year,s);
    if(next<=now){year++;next=anniversary(year,s);}
    const days=Math.ceil((next-now)/86400000);
    $('next-title').textContent=`在一起的第 ${year-s.year} 周年`;
    $('next-date').textContent=`${year}.${pad(s.month+1)}.${pad(chinaParts(next).day)} · 还有 ${days} 天`;
    const prev=Math.max(startTime,anniversary(year-1,s));
    $('year-progress').style.width=`${Math.min(100,Math.max(0,(now-prev)/(next-prev)*100))}%`;
  }
  function birthdayState(now, birth) {
    const [year,month,day]=birth.split('-').map(Number),current=chinaParts(now);
    const today=current.month===month-1&&current.day===day;
    let nextYear=current.year;
    let target=anniversary(nextYear,{month:month-1,day,hours:0,minutes:0,seconds:0});
    if(target<=now&&!today){nextYear++;target=anniversary(nextYear,{month:month-1,day,hours:0,minutes:0,seconds:0});}
    return {today,age:nextYear-year,target,remaining:parts(target-now)};
  }
  function renderBirthdays(now) {
    (config.birthdays||defaults.birthdays).forEach((birth,i)=>{
      const b=birthdayState(now,birth),p=b.remaining;
      text('birthday-name-'+i,config.names[i]+'的生日');
      const clock=$('birthday-clock-'+i);clock.classList.toggle('is-birthday',b.today);
      const mode=b.today?'today':'countdown';
      if(clock.dataset.mode!==mode){
        clock.dataset.mode=mode;clock.replaceChildren();
        if(b.today){clock.textContent='今天，生日快乐 ♡';}
        else{const days=document.createElement('strong'),unit=document.createElement('span'),time=document.createElement('em');days.id='birthday-days-'+i;time.id='birthday-time-'+i;unit.textContent='天';clock.append(days,unit,time);delete cache[days.id];delete cache[time.id];}
      }
      if(b.today)text('birthday-foot-'+i,`${b.age} 岁的每一天，都想陪你一起度过。`);
      else{text('birthday-days-'+i,p.days);text('birthday-time-'+i,`${pad(p.hours)} : ${pad(p.minutes)} : ${pad(p.seconds)}`);text('birthday-foot-'+i,`距离 ${b.age} 岁生日 · ${birth.slice(5).replace('-', ' 月 ')} 日`);}
    });
  }
  function update() {
    const now=Date.now(),p=parts(now-startTime);
    text('days',p.days.toLocaleString('en-US'));text('hours',pad(p.hours));text('minutes',pad(p.minutes));text('seconds',pad(p.seconds));text('ms',pad(p.ms,3));
    const dayKey=Math.floor((now+28800000)/86400000);
    if(dayKey!==lastDay){milestones(now);lastDay=dayKey;}
    const secondKey=Math.floor(now/1000);if(secondKey!==lastBirthdaySecond){renderBirthdays(now);lastBirthdaySecond=secondKey;}
  }
  let lastPaint=-Infinity;
  function loop(timestamp=0){if(timestamp-lastPaint>=32){update();lastPaint=timestamp;}frame=requestAnimationFrame(loop);}
  document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);if(!document.hidden){lastPaint=-Infinity;loop();}});
  renderConfig();loop();
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{const d=$(b.dataset.close);if(d.dataset.busy!=='true')d.close();}));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d&&d.dataset.busy!=='true'){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  let viewportFrame=0,lastViewport='';
  function updateDialogViewport(){
    if(!document.querySelector('dialog[open]'))return;
    const v=window.visualViewport,values=[v?v.width:innerWidth,v?v.height:innerHeight,v?v.offsetLeft:0,v?v.offsetTop:0].map(n=>Math.round(n*100)/100);
    const key=values.join(',');if(key===lastViewport)return;lastViewport=key;
    ['width','height','left','top'].forEach((name,i)=>document.documentElement.style.setProperty('--view-'+name,values[i]+'px'));
  }
  function queueDialogViewport(){cancelAnimationFrame(viewportFrame);viewportFrame=requestAnimationFrame(updateDialogViewport);}
  window.addEventListener('resize',queueDialogViewport);window.visualViewport?.addEventListener('resize',queueDialogViewport);
  let lockedScroll=null;
  window.showLoveDialog=dialog=>{
    if(dialog.open)return;
    if(!document.querySelector('dialog[open]')){
      lockedScroll={x:window.scrollX,y:window.scrollY};
      document.body.style.setProperty('--locked-y',`${-lockedScroll.y}px`);
      document.body.classList.add('modal-scroll-locked');
    }
    dialog.showModal();updateDialogViewport();
  };
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{
    if(document.querySelector('dialog[open]')||!lockedScroll)return;
    const position=lockedScroll;lockedScroll=null;
    document.body.classList.remove('modal-scroll-locked');document.body.style.removeProperty('--locked-y');
    window.scrollTo({left:position.x,top:position.y,behavior:'instant'});
  }));
  $('open-letter').addEventListener('click',()=>window.showLoveDialog($('letter-dialog')));
  let toastTimer;
  function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3000);}
  function applyTheme(dark){document.body.classList.toggle('dark',dark);$('theme').setAttribute('aria-label',dark?'切换日间主题':'切换夜间主题');$('theme').setAttribute('aria-pressed',String(dark));document.querySelector('meta[name="theme-color"]').content=dark?'#211e28':'#f9f6f2';}
  applyTheme(storage.get('our-seconds-theme')==='dark');
  $('theme').addEventListener('click',()=>{const dark=!document.body.classList.contains('dark');applyTheme(dark);storage.set('our-seconds-theme',dark?'dark':'light');});
  if(!document.fullscreenEnabled){$('fullscreen').hidden=true;}
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前浏览器暂不支持全屏');}});
  document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'进入全屏');$('fullscreen').firstChild.textContent=document.fullscreenElement?'回到日常 ':'沉浸一下 ';});
  const form=$('settings-form');
  $('settings').addEventListener('click',()=>{form.elements.first.value=config.names[0];form.elements.second.value=config.names[1];form.elements.start.value=config.start.slice(0,19);form.elements.letter.value=config.letter;$('form-error').textContent='';window.showLoveDialog($('settings-dialog'));});
  function readForm(){
    if(!form.reportValidity())return null;
    const start=form.elements.start.value.length===16?form.elements.start.value+':00':form.elements.start.value;
    const candidate={...config,names:[form.elements.first.value.trim(),form.elements.second.value.trim()],start:start+'+08:00',letter:form.elements.letter.value};
    if(!valid(candidate)||Date.parse(candidate.start)>Date.now()){$('form-error').textContent='请选择已经发生的开始时间，并填好两个人的称呼。';return null;}
    return candidate;
  }
  form.addEventListener('submit',e=>{e.preventDefault();const value=readForm();if(!value)return;config=value;const saved=storage.set(KEY,JSON.stringify(config));renderConfig();$('settings-dialog').close();toast(saved?'我们的故事，记住啦 ♡':'本次已生效；下载专属页面可以保留设置');});
  $('download-page').addEventListener('click',async()=>{
    const value=readForm();if(!value)return;
    const button=$('download-page');button.disabled=true;
    try {
      const fetchText=async url=>{const r=await fetch(url);if(!r.ok)throw new Error('fetch failed');return r.text();};
      const [css,js,eggs]=await Promise.all([fetchText('style.css?v=20261029-8'),fetchText('app.js?v=20261029-8'),fetchText('little-things.js?v=20261029-8')]);
      const exportConfig=value;
      const clone=document.documentElement.cloneNode(true);
      clone.querySelectorAll('script,link[rel="stylesheet"]').forEach(n=>n.remove());
      clone.querySelectorAll('dialog').forEach(n=>n.removeAttribute('open'));
      clone.querySelector('#toast').classList.remove('visible');
      clone.querySelectorAll('.petal').forEach(n=>n.remove());
      clone.querySelector('#egg-fx').replaceChildren();
      clone.querySelectorAll('.is-holding,.is-close,.poem-play,.poem-in-view,.wish-lit,.heart-pop').forEach(n=>n.classList.remove('is-holding','is-close','poem-play','poem-in-view','wish-lit','heart-pop'));
      clone.querySelector('#couple').setAttribute('aria-pressed','false');
      clone.querySelector('body').classList.remove('modal-scroll-locked');
      clone.querySelector('body').style.removeProperty('--locked-y');
      clone.querySelector('title').textContent=`${value.names.join(' × ')} · 我们的每一秒`;
      const style=document.createElement('style');style.textContent=css;clone.querySelector('head').append(style);
      const setting=document.createElement('script');setting.textContent='window.LOVE_CONFIG='+JSON.stringify(exportConfig).replace(/</g,'\\u003c')+';';
      clone.querySelector('head').append(setting);
      const app=document.createElement('script');app.textContent=js+'\n'+eggs;clone.querySelector('body').append(app);
      clone.querySelector('#download-page').hidden=true;
      const link=document.createElement('a');const url=URL.createObjectURL(new Blob(['<!doctype html>\n'+clone.outerHTML],{type:'text/html;charset=utf-8'}));link.href=url;link.download='our-seconds.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
      toast('专属页面已下载 ♡');
    }catch{toast('请在网站中打开后下载，或直接编辑 config.js');}finally{button.disabled=false;}
  });
})();
