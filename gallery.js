'use strict';
(() => {
  const $=id=>document.getElementById(id),deck=$('photo-deck'),viewer=$('photo-dialog'),cloud=window.LoveGithubAlbum;
  const open=dialog=>window.showLoveDialog(dialog);
  // Mobile toolbar scrolling must not change the whole document's layout on every scroll event.
  let viewportFrame=0,viewportValues='';
  function viewport(){
    if(!document.querySelector('dialog[open]'))return;
    const v=window.visualViewport,values=[v?v.width:innerWidth,v?v.height:innerHeight,v?v.offsetLeft:0,v?v.offsetTop:0].map(n=>Math.round(n*100)/100),key=values.join(',');
    if(key===viewportValues)return;viewportValues=key;
    ['width','height','left','top'].forEach((name,i)=>document.documentElement.style.setProperty('--view-'+name,values[i]+'px'));
  }
  function queueViewport(){cancelAnimationFrame(viewportFrame);viewportFrame=requestAnimationFrame(viewport);}
  window.addEventListener('love:dialog-open',viewport);window.addEventListener('resize',queueViewport);window.visualViewport?.addEventListener('resize',queueViewport);
  const staticShared=(window.LOVE_CONFIG.photos||[]).filter(p=>p&&typeof p.src==='string'&&!/^\s*(javascript|vbscript):/i.test(p.src)).map((p,i)=>({...p,id:p.id||'static-'+i,caption:p.caption||'我们的第 '+(i+1)+' 个瞬间',shared:true}));
  let remoteShared=[],localPhotos=[],photos=[],current=0,dbPromise=null,toastTimer,pending=[],busy=false;
  const objectURLs=new Map(),cards=new Map();
  function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3600);}
  function db(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('our-seconds-photos',1);req.onupgradeneeded=()=>req.result.createObjectStore('photos',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('blocked'));});return dbPromise;}
  async function records(){const database=await db();return new Promise((resolve,reject)=>{const req=database.transaction('photos').objectStore('photos').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function write(record,remove=false){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('photos','readwrite'),store=tx.objectStore('photos');if(remove)store.delete(record.id);else store.put({id:record.id,blob:record.blob,caption:record.caption,createdAt:record.createdAt,syncedPath:record.syncedPath});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  function hydrate(record){let src=objectURLs.get(record.id);if(!src){src=URL.createObjectURL(record.blob);objectURLs.set(record.id,src);}return {...record,src,shared:false};}
  function merge(){const active=photos[current]?.id;const shared=new Map([...staticShared,...remoteShared].map(p=>[p.id,p]));const paths=new Set([...shared.values()].map(p=>p.path).filter(Boolean));photos=[...shared.values(),...localPhotos.filter(p=>!shared.has(p.id)&&!(p.syncedPath&&paths.has(p.syncedPath)))];const index=photos.findIndex(p=>p.id===active);current=index>=0?index:Math.min(current,Math.max(0,photos.length-1));render();}
  function render(){
    $('gallery-empty').hidden=photos.length>0;
    const n=photos.length,seen=new Set(),visible=new Set();
    for(const slot of [0,-1,1,-2,2]){
      if(!n)break;const index=(current+slot+n)%n;if(seen.has(index))continue;seen.add(index);const p=photos[index];visible.add(p.id);
      let button=cards.get(p.id);
      if(!button){button=document.createElement('button');button.className='photo-card';button.type='button';button.dataset.photoId=p.id;const img=document.createElement('img');img.draggable=false;img.decoding='async';const label=document.createElement('span');label.className='photo-label';button.append(img,label);cards.set(p.id,button);deck.append(button);}
      button.hidden=false;button.dataset.slot=slot;button.setAttribute('aria-label','查看完整照片：'+p.caption);button.setAttribute('aria-current',String(slot===0));button.tabIndex=slot===0?0:-1;
      const img=button.firstElementChild;if(img.getAttribute('src')!==p.src)img.src=p.src;if(img.alt!==p.caption)img.alt=p.caption;
      const label=button.lastElementChild;if(label.textContent!==p.caption)label.textContent=p.caption;
    }
    for(const [id,button] of cards){if(!visible.has(id)){button.hidden=true;button.firstElementChild.removeAttribute('src');}}
    $('photo-position').textContent=n?`${String(current+1).padStart(2,'0')} / ${String(n).padStart(2,'0')}`:'等待我们的第一张照片';
    for(const id of ['photo-prev','photo-next','lightbox-prev','lightbox-next'])$(id).disabled=n<2;
    const unsynced=localPhotos.filter(p=>!photos.some(q=>q.id===p.id&&q.shared));$('manage-photos').hidden=!unsynced.length;$('sync-local-photos').hidden=!unsynced.length;
  }
  function step(direction){if(!photos.length)return;current=(current+direction+photos.length)%photos.length;render();if(viewer.open)renderFull();}
  function renderFull(){const p=photos[current];if(!p){viewer.close();return;}$('full-photo').src=p.src;$('full-photo').alt=p.caption;$('full-photo-caption').textContent=p.caption;$('lightbox-count').textContent=`${current+1} / ${photos.length}`;}
  let suppressClick=false;
  deck.addEventListener('click',e=>{if(suppressClick)return;const button=e.target.closest('.photo-card');if(!button)return;const index=photos.findIndex(p=>p.id===button.dataset.photoId);if(index<0)return;current=index;render();renderFull();open(viewer);});
  $('photo-prev').addEventListener('click',()=>step(-1));$('photo-next').addEventListener('click',()=>step(1));$('lightbox-prev').addEventListener('click',()=>step(-1));$('lightbox-next').addEventListener('click',()=>step(1));
  function swipe(element){let origin=null;element.addEventListener('pointerdown',e=>{if(e.isPrimary&&e.button===0)origin={x:e.clientX,y:e.clientY,id:e.pointerId};});element.addEventListener('pointercancel',()=>origin=null);window.addEventListener('pointerup',e=>{if(!origin||origin.id!==e.pointerId)return;const dx=e.clientX-origin.x,dy=e.clientY-origin.y;origin=null;if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.3){suppressClick=true;step(dx<0?1:-1);setTimeout(()=>suppressClick=false,180);}});element.addEventListener('dragstart',e=>e.preventDefault());}
  swipe(deck);swipe($('lightbox-stage'));
  document.addEventListener('keydown',e=>{if(!(viewer.open||deck.contains(document.activeElement)))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}});
  function pickerDisabled(disabled){for(const id of ['photo-input','photo-input-cover'])$(id).disabled=disabled;for(const id of ['add-photos','empty-add'])$(id).classList.toggle('picker-disabled',disabled);}
  function previewImage(file){return new Promise((resolve,reject)=>{const src=URL.createObjectURL(file),image=new Image(),timeout=setTimeout(()=>{image.onload=image.onerror=null;URL.revokeObjectURL(src);reject(new Error('图片读取超时'));},15000);image.onload=()=>{clearTimeout(timeout);resolve(src);};image.onerror=()=>{clearTimeout(timeout);URL.revokeObjectURL(src);reject(new Error('不支持的图片格式'));};image.src=src;});}
  function prepareUpload(items){pending=items;$('upload-preview-list').replaceChildren();$('upload-error').textContent='';$('upload-progress').textContent=`已选择 ${items.length} 张照片`;
    for(const p of items){const row=document.createElement('div');row.className='upload-item';const img=document.createElement('img');img.src=p.src;img.alt=p.caption;const label=document.createElement('label');label.textContent='照片标题';const field=document.createElement('input');field.value=p.caption;field.maxLength=100;field.setAttribute('aria-label','上传照片标题');field.addEventListener('input',()=>p.caption=field.value.trim()||'我们的日常');const size=document.createElement('small');size.textContent=(p.blob.size/1024/1024).toFixed(2)+' MB · 原图';label.append(field,size);row.append(img,label);$('upload-preview-list').append(row);}
    open($('upload-dialog'));
  }
  async function selectPhotos(input){
    const files=Array.from(input.files||[]);if(!files.length)return;pickerDisabled(true);$('album-state').textContent='正在读取选中的照片…';const selected=[];let rejected=0;
    try{
      for(const file of files.slice(0,20)){
        if((!file.type.startsWith('image/')&&!/\.(jpe?g|png|webp|gif|avif|bmp|heic|heif|svg)$/i.test(file.name))||file.size>25*1024*1024){rejected++;continue;}
        let src;try{src=await previewImage(file);}catch{rejected++;continue;}
        const id=crypto.randomUUID?.()||`local-${Date.now()}-${Math.random().toString(36).slice(2)}`;objectURLs.set(id,src);selected.push({id,blob:file,caption:file.name.replace(/\.[^.]+$/,''),createdAt:Date.now(),src,shared:false});
      }
      if(selected.length){prepareUpload(selected);if(rejected||files.length>20)$('upload-error').textContent='部分照片被跳过；每批最多 20 张、单张不超过 25 MB，请使用浏览器能打开的图片。';}
      else toast('暂时无法打开所选照片，请选择 25 MB 以内的 JPG、PNG、WebP 等图片。');
    }catch{toast('读取照片失败，请重新选择。');}
    finally{input.value='';pickerDisabled(false);connectionState();}
  }
  for(const id of ['photo-input','photo-input-cover'])$(id).addEventListener('change',e=>selectPhotos(e.currentTarget));
  function connectionState(){$('connect-album').textContent=cloud.isConnected()?'共享相册已连接':'连接共享相册';$('album-state').textContent=cloud.isConnected()?'已连接 xiguadoudou/our-seconds · 本次页面有效':'';$('github-disconnect').hidden=!cloud.isConnected();}
  $('connect-album').addEventListener('click',()=>{connectionState();$('github-error').textContent='';open($('github-dialog'));});
  $('github-form').addEventListener('submit',async e=>{e.preventDefault();const field=$('github-token'),button=$('github-connect-button');button.disabled=true;$('github-error').textContent='正在连接…';try{await cloud.connect(field.value);field.value='';$('github-error').textContent='';connectionState();$('github-dialog').close();toast('共享相册已连接，可以上传照片了 ♡');}catch(error){$('github-error').textContent=error.message;connectionState();}finally{button.disabled=false;}});
  $('github-dialog').addEventListener('close',()=>{$('github-token').value='';});
  $('github-disconnect').addEventListener('click',()=>{if(cloud.disconnect()){connectionState();$('github-token').value='';$('github-dialog').close();toast('共享相册已断开');}});
  function uploadBusy(value){busy=value;$('upload-dialog').dataset.busy=String(value);$('close-upload').disabled=value;for(const id of ['upload-to-github','save-local','github-disconnect'])$(id).disabled=value;pickerDisabled(value);$('upload-preview-list').querySelectorAll('input').forEach(input=>input.disabled=value);}
  $('upload-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  $('upload-to-github').addEventListener('click',async()=>{
    if(!pending.length||busy)return;if(!cloud.isConnected()){$('github-error').textContent='请连接相册后，再点击上传。';open($('github-dialog'));return;}
    uploadBusy(true);$('upload-error').textContent='';
    try{
      const result=await cloud.upload(pending,{onProgress:message=>$('upload-progress').textContent=message});
      const byID=new Map(remoteShared.map(p=>[p.id,p]));for(const p of result.photos)byID.set(p.id,p);remoteShared=[...byID.values()];
      for(const p of pending){const local=localPhotos.find(q=>q.id===p.id);if(local){local.syncedPath=result.photos.find(q=>q.id===p.id).path;try{await write(local);}catch{}}}
      const firstID=pending[0].id;merge();current=Math.max(0,photos.findIndex(p=>p.id===firstID));render();pending=[];$('upload-progress').textContent='已保存到 GitHub，网站正在自动更新。';$('upload-dialog').close();if($('photo-manage-dialog').open)$('photo-manage-dialog').close();toast('照片已上传 ♡ 网站更新后两个人都能看到');
    }catch(error){$('upload-error').textContent=error.message;$('upload-progress').textContent='照片尚未确认发布，可保留本机预览。';}
    finally{uploadBusy(false);}
  });
  $('save-local').addEventListener('click',async()=>{
    if(busy||!pending.length)return;uploadBusy(true);let saved=0;
    try{for(const p of pending){if(!localPhotos.some(q=>q.id===p.id)){localPhotos.push(p);try{await write(p);saved++;}catch{}}}const id=pending[0].id;merge();current=Math.max(0,photos.findIndex(p=>p.id===id));render();pending=[];$('upload-dialog').close();toast(saved?'已保存在此浏览器，可稍后上传共享相册':'已在本机显示；浏览器暂时无法保存');}finally{uploadBusy(false);}
  });
  async function refreshShared(showMessage=false){$('refresh-album').disabled=true;try{const received=await cloud.loadPublic();const merged=new Map(remoteShared.map(p=>[p.id,p]));for(const p of received)merged.set(p.id,p);remoteShared=[...merged.values()];merge();if(showMessage)toast('共享相册已刷新');}catch{if(showMessage)toast('共享相册暂时无法连接，请稍后刷新；本机照片仍可查看');}finally{$('refresh-album').disabled=false;}}
  $('refresh-album').addEventListener('click',()=>refreshShared(true));
  function unsynced(){return localPhotos.filter(p=>!remoteShared.some(q=>q.id===p.id||q.path===p.syncedPath));}
  function manage(){const list=$('photo-manage-list');list.replaceChildren();const local=unsynced();$('sync-local-photos').hidden=!local.length;
    if(!local.length){const p=document.createElement('p');p.className='manage-empty';p.textContent='本机照片已同步到共享相册。';list.append(p);return;}
    for(const p of local){const row=document.createElement('div');row.className='manage-row';const img=document.createElement('img');img.src=p.src;img.alt=p.caption;const field=document.createElement('input');field.value=p.caption;field.maxLength=100;field.setAttribute('aria-label','照片标题');field.addEventListener('change',async()=>{p.caption=field.value.trim()||'我们的日常';try{await write(p);}catch{toast('标题本次已修改，暂时无法保存');}render();});const remove=document.createElement('button');remove.textContent='移除';remove.setAttribute('aria-label','移除本机照片：'+p.caption);remove.addEventListener('click',async()=>{try{await write(p,true);}catch{toast('无法移除已保存照片，请稍后重试');return;}localPhotos=localPhotos.filter(item=>item.id!==p.id);merge();manage();});row.append(img,field,remove);list.append(row);}
  }
  $('manage-photos').addEventListener('click',()=>{manage();open($('photo-manage-dialog'));});$('sync-local-photos').addEventListener('click',()=>{const items=unsynced();if(items.length)prepareUpload(items);});
  window.exportLovePhotos=async()=>Promise.all(photos.map(async p=>{if(p.shared)return {src:new URL(p.src,document.baseURI).href,caption:p.caption};const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(p.blob);});return {src,caption:p.caption};}));
  merge();connectionState();
  records().then(saved=>{localPhotos=saved.sort((a,b)=>a.createdAt-b.createdAt).map(hydrate);merge();}).catch(()=>{$('gallery-note').textContent='当前浏览器无法保存本机照片，仍可连接 GitHub 上传共享相册';});
  refreshShared();
})();
