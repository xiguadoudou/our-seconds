'use strict';
(() => {
  const REPO='xiguadoudou/our-seconds',BRANCH='main',MANIFEST='photos.json';
  const API='https://api.github.com/repos/'+REPO;
  const safePath=path=>typeof path==='string'&&/^photos\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(path);
  let token='',uploading=false;
  function errorFor(status){
    if(status===401)return '令牌无效或已经过期，请重新连接共享相册。';
    if(status===403||status===404)return '无法写入相册。请确认令牌只选中了 our-seconds，并已授予 Contents → Read and write 权限；也可能触发了 GitHub 请求限制。';
    if(status===413)return '这张照片太大，请选择不超过 25 MB 的图片。';
    if(status===409||status===422)return '相册正在被更新，请稍后重试。';
    return `GitHub 暂时无法完成请求（${status}），请稍后重试。`;
  }
  async function request(path,options={}){
    if(!path.startsWith('/')||path.startsWith('//'))throw new Error('无效相册路径');
    const {allowMissing=false,publicRead=false,...init}=options;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),90000);
    try{
      const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
      if(!publicRead&&token)headers.Authorization='Bearer '+token;
      if(init.body)headers['Content-Type']='application/json';
      let response;
      try{response=await fetch(API+path,{...init,headers,signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});}catch{const e=new Error('暂时连接不到 GitHub，请检查网络后重试。');e.network=true;throw e;}
      if(response.status===404&&allowMissing)return null;
      if(!response.ok){const e=new Error(errorFor(response.status));e.status=response.status;throw e;}
      return response.status===204?null:await response.json();
    }finally{clearTimeout(timeout);}
  }
  function parseManifest(data){
    if(!data||!Array.isArray(data.photos))throw new Error('共享相册列表格式有误，请先修复 photos.json。');
    const seen=new Set();
    return data.photos.map(p=>{if(!p||typeof p.id!=='string'||seen.has(p.id)||!safePath(p.path))throw new Error('共享相册列表包含无效的照片记录。');seen.add(p.id);return {...p,caption:typeof p.caption==='string'?p.caption.slice(0,100):'我们的日常'};});
  }
  function fromBase64(content){const bytes=Uint8Array.from(atob(content.replace(/\s/g,'')),c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes));}
  async function readManifestAt(sha){const file=await request('/contents/'+MANIFEST+'?ref='+encodeURIComponent(sha),{allowMissing:true});if(!file)return [];if(file.encoding!=='base64')throw new Error('暂时无法读取共享相册列表。');return parseManifest(fromBase64(file.content));}
  function toBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('读取照片失败，请重新选择照片。'));reader.onabort=()=>reject(new Error('照片读取已取消。'));reader.readAsDataURL(blob);});}
  function extension(record){const ext=(record.blob.name||'').split('.').pop().toLowerCase();if(/^(jpe?g|png|webp|gif|avif|bmp|heic|heif|svg)$/.test(ext))return ext;return {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif','image/svg+xml':'svg'}[record.blob.type]||'jpg';}
  function view(entries,sha){return entries.map(p=>({...p,shared:true,src:'https://raw.githubusercontent.com/'+REPO+'/'+encodeURIComponent(sha||BRANCH)+'/'+p.path}));}
  async function connect(value){if(uploading)throw new Error('照片正在上传，请完成后再修改连接。');const candidate=value.trim();if(candidate.length<20||/\s/.test(candidate))throw new Error('请填写有效的 GitHub 访问令牌。');token=candidate;try{await request('/git/ref/heads/'+BRANCH);}catch(e){token='';throw e;}return true;}
  async function loadPublic(){
    if(window.LOVE_CONFIG?.snapshot)return [];
    // Pages is the primary source; raw GitHub is a fallback during deployment propagation.
    let firstError;
    for(const url of [new URL(MANIFEST,document.baseURI).href,'https://raw.githubusercontent.com/'+REPO+'/'+BRANCH+'/'+MANIFEST]){
      try{const response=await fetch(url,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error('暂时无法读取共享相册');return view(parseManifest(await response.json()));}catch(e){firstError=e;}
    }
    throw firstError||new Error('暂时无法读取共享相册');
  }
  async function upload(records,{onProgress=()=>{}}={}){
    if(!token)throw new Error('请先连接共享相册。');
    if(uploading)throw new Error('另一批照片还在上传，请稍候。');
    if(!Array.isArray(records)||!records.length)throw new Error('请先选择照片。');
    uploading=true;
    try{
      const entries=[],blobs=[];
      for(let index=0;index<records.length;index++){
        const record=records[index];if(!record.blob||record.blob.size>25*1024*1024)throw new Error('请选择不超过 25 MB 的照片。');
        if(!/^[a-zA-Z0-9_-]+$/.test(record.id))throw new Error('照片编号无效，请重新选图。');
        const path='photos/'+record.id+'.'+extension(record);
        onProgress(`正在上传原图 ${index+1} / ${records.length}…`);
        const result=await request('/git/blobs',{method:'POST',body:JSON.stringify({encoding:'base64',content:await toBase64(record.blob)})});
        if(!result?.sha)throw new Error('GitHub 未能确认原图，请重试。');
        entries.push({id:record.id,path,caption:(record.caption||'我们的日常').slice(0,100),createdAt:record.createdAt||Date.now()});
        blobs.push({path,mode:'100644',type:'blob',sha:result.sha});
      }
      for(let attempt=0;attempt<3;attempt++){
        onProgress(attempt?'正在合并相册的最新内容…':'原图已传输，正在保存共享相册…');
        const head=await request('/git/ref/heads/'+BRANCH),headSHA=head.object.sha;
        const [commit,previous]=await Promise.all([request('/git/commits/'+headSHA),readManifestAt(headSHA)]);
        const merged=new Map(previous.map(p=>[p.id,p]));for(const p of entries)merged.set(p.id,p);
        const manifest={version:1,photos:[...merged.values()]};
        const tree=await request('/git/trees',{method:'POST',body:JSON.stringify({base_tree:commit.tree.sha,tree:[...blobs,{path:MANIFEST,mode:'100644',type:'blob',content:JSON.stringify(manifest,null,2)+'\n'}]})});
        const next=await request('/git/commits',{method:'POST',body:JSON.stringify({message:`Add ${entries.length} photos to our shared album`,tree:tree.sha,parents:[headSHA]})});
        try{
          await request('/git/refs/heads/'+BRANCH,{method:'PATCH',body:JSON.stringify({sha:next.sha,force:false})});
          return {sha:next.sha,photos:view(entries,next.sha)};
        }catch(e){
          if(e.network){
            // A timeout after PATCH may already have published: inspect before offering another attempt.
            try{const actual=await request('/git/ref/heads/'+BRANCH);const saved=await readManifestAt(actual.object.sha);if(entries.every(p=>saved.some(q=>q.id===p.id&&q.path===p.path)))return {sha:actual.object.sha,photos:view(entries,actual.object.sha)};}catch{}
            const uncertain=new Error('网络在保存时中断，上传结果待确认。请先刷新共享相册，再决定是否重试。');uncertain.uncertain=true;throw uncertain;
          }
          if((e.status===409||e.status===422)&&attempt<2){const actual=await request('/git/ref/heads/'+BRANCH);if(actual.object.sha!==headSHA)continue;}
          throw e;
        }
      }
      throw new Error('相册更新频繁，请稍后重试。');
    }finally{uploading=false;}
  }
  window.LoveGithubAlbum={connect,disconnect(){if(uploading)return false;token='';return true;},isConnected:()=>Boolean(token),loadPublic,upload};
})();
