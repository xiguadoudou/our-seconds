'use strict';
(() => {
  const $=id=>document.getElementById(id),deck=$('photo-deck'),viewer=$('photo-dialog');
  // VisualViewport keeps dialogs inside the visible screen when mobile keyboards or zoom shift it.
  function viewport(){const v=window.visualViewport,root=document.documentElement;root.style.setProperty('--view-width',(v?v.width:innerWidth)+'px');root.style.setProperty('--view-height',(v?v.height:innerHeight)+'px');root.style.setProperty('--view-left',(v?v.offsetLeft:0)+'px');root.style.setProperty('--view-top',(v?v.offsetTop:0)+'px');}
  viewport();window.addEventListener('resize',viewport);window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);
  const shared=(window.LOVE_CONFIG.photos||[]).filter(p=>p&&typeof p.src==='string'&&!/^\s*(javascript|vbscript):/i.test(p.src)).map((p,i)=>({id:'shared-'+i,src:p.src,caption:p.caption||'我们的第 '+(i+1)+' 个瞬间',shared:true}));
  let photos=[...shared],current=0,dbPromise=null,toastTimer;
  const objectURLs=new Map();
  function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
  function db(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('our-seconds-photos',1);req.onupgradeneeded=()=>req.result.createObjectStore('photos',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('blocked'));});return dbPromise;}
  async function records(){const database=await db();return new Promise((resolve,reject)=>{const req=database.transaction('photos').objectStore('photos').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function write(record,remove=false){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('photos','readwrite'),store=tx.objectStore('photos');if(remove)store.delete(record.id);else store.put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  function hydrate(record){let src=objectURLs.get(record.id);if(!src){src=URL.createObjectURL(record.blob);objectURLs.set(record.id,src);}return {...record,src,shared:false};}
  function render(){
    deck.querySelectorAll('.photo-card').forEach(n=>n.remove());$('gallery-empty').hidden=photos.length>0;
    const n=photos.length,seen=new Set();
    for(const slot of [0,-1,1,-2,2]){const index=(current+slot+n)%n;if(!n||seen.has(index))continue;seen.add(index);const p=photos[index],button=document.createElement('button');button.className='photo-card';button.dataset.slot=slot;button.dataset.index=index;button.setAttribute('aria-label','查看完整照片：'+p.caption);button.setAttribute('aria-current',String(slot===0));const img=document.createElement('img');img.src=p.src;img.alt=p.caption;img.draggable=false;img.decoding='async';const label=document.createElement('span');label.className='photo-label';label.textContent=p.caption;button.append(img,label);deck.append(button);}
    $('photo-position').textContent=n?`${String(current+1).padStart(2,'0')} / ${String(n).padStart(2,'0')}`:'等待我们的第一张照片';
    for(const id of ['photo-prev','photo-next','lightbox-prev','lightbox-next'])$(id).disabled=n<2;
    $('manage-photos').hidden=!photos.some(p=>!p.shared);
  }
  function step(direction){if(!photos.length)return;current=(current+direction+photos.length)%photos.length;render();if(viewer.open)renderFull();}
  function renderFull(){const p=photos[current];if(!p){viewer.close();return;}$('full-photo').src=p.src;$('full-photo').alt=p.caption;$('full-photo-caption').textContent=p.caption;$('lightbox-count').textContent=`${current+1} / ${photos.length}`;}
  let suppressClick=false;
  deck.addEventListener('click',e=>{if(suppressClick)return;const b=e.target.closest('.photo-card');if(!b)return;current=Number(b.dataset.index);render();renderFull();viewer.showModal();});
  $('photo-prev').addEventListener('click',()=>step(-1));$('photo-next').addEventListener('click',()=>step(1));$('lightbox-prev').addEventListener('click',()=>step(-1));$('lightbox-next').addEventListener('click',()=>step(1));
  function swipe(element){let origin=null;element.addEventListener('pointerdown',e=>{if(e.isPrimary&&e.button===0)origin={x:e.clientX,y:e.clientY,id:e.pointerId};});element.addEventListener('pointercancel',()=>origin=null);window.addEventListener('pointerup',e=>{if(!origin||origin.id!==e.pointerId)return;const dx=e.clientX-origin.x,dy=e.clientY-origin.y;origin=null;if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.3){suppressClick=true;step(dx<0?1:-1);setTimeout(()=>suppressClick=false,180);}});element.addEventListener('dragstart',e=>e.preventDefault());}
  swipe(deck);swipe($('lightbox-stage'));
  document.addEventListener('keydown',e=>{if(!(viewer.open||deck.contains(document.activeElement)))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}});
  const input=$('photo-input');$('add-photos').addEventListener('click',()=>input.click());$('empty-add').addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const files=Array.from(input.files||[]);if(!files.length)return;
    $('add-photos').disabled=true;let added=0,persisted=0,rejected=0;
    for(const file of files){
      if(!file.type.startsWith('image/')){rejected++;continue;}
      const src=URL.createObjectURL(file);const image=new Image();image.src=src;
      try{await image.decode();}catch{URL.revokeObjectURL(src);rejected++;continue;}
      const record={id:crypto.randomUUID?.()||`local-${Date.now()}-${Math.random().toString(36).slice(2)}`,blob:file,caption:file.name.replace(/\.[^.]+$/,''),createdAt:Date.now()};
      try{await write(record);persisted++;}catch{}
      objectURLs.set(record.id,src);photos.push({...record,src,shared:false});added++;
    }
    if(added)current=photos.length-added;render();input.value='';$('add-photos').disabled=false;
    if(added)toast(persisted===added?`已收藏 ${added} 张照片 ♡`:'照片已显示；浏览器未能保存，刷新后可能丢失');else toast('这些图片暂时无法打开，请选择 JPG、PNG 或 WebP');
    if(rejected&&added)$('gallery-note').textContent=`已跳过 ${rejected} 张无法打开的图片 · 照片仅保存在此浏览器`;
  });
  function manage(){
    const list=$('photo-manage-list');list.replaceChildren();
    const local=photos.filter(p=>!p.shared);
    if(!local.length){const p=document.createElement('p');p.className='manage-empty';p.textContent='还没有添加本地照片。';list.append(p);return;}
    for(const p of local){const row=document.createElement('div');row.className='manage-row';const img=document.createElement('img');img.src=p.src;img.alt=p.caption;const field=document.createElement('input');field.value=p.caption;field.maxLength=100;field.setAttribute('aria-label','照片标题');field.addEventListener('change',async()=>{p.caption=field.value.trim()||'我们的日常';try{await write({id:p.id,blob:p.blob,caption:p.caption,createdAt:p.createdAt});}catch{toast('标题本次已修改，暂时无法保存');}render();});const remove=document.createElement('button');remove.textContent='移除';remove.setAttribute('aria-label','移除本地照片：'+p.caption);remove.addEventListener('click',async()=>{try{await write(p,true);}catch{toast('无法移除已保存照片，请稍后重试');return;}photos=photos.filter(item=>item.id!==p.id);if(objectURLs.has(p.id)){URL.revokeObjectURL(objectURLs.get(p.id));objectURLs.delete(p.id);}current=Math.min(current,Math.max(0,photos.length-1));render();manage();});row.append(img,field,remove);list.append(row);}
  }
  $('manage-photos').addEventListener('click',()=>{manage();$('photo-manage-dialog').showModal();});
  window.exportLovePhotos=async()=>Promise.all(photos.map(async p=>{if(p.shared)return {src:new URL(p.src,document.baseURI).href,caption:p.caption};const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(p.blob);});return {src,caption:p.caption};}));
  render();records().then(saved=>{photos.push(...saved.sort((a,b)=>a.createdAt-b.createdAt).map(hydrate));render();}).catch(()=>{$('gallery-note').textContent='点击查看完整图片 · 当前浏览器不能保存照片，本次添加仍可查看';});
})();
