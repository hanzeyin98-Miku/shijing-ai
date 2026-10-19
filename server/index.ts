import express from 'express';
import cors from 'cors';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { registerIntegrationRoutes } from './integrations.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const envFile=path.resolve(here,'../.env');
// Node 不会默认读取 .env；在启动本地服务时显式载入，密钥仍只留在服务端。
if(existsSync(envFile))process.loadEnvFile(envFile);
mkdirSync(path.resolve(here,'../data'),{recursive:true});
const generatedImageDir=path.resolve(here,'../data/generated-images');
mkdirSync(generatedImageDir,{recursive:true});
const db=new DatabaseSync(path.resolve(here,'../data/shijing.sqlite'));
db.exec('PRAGMA journal_mode=WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS works(id INTEGER PRIMARY KEY, title TEXT NOT NULL, author TEXT, dynasty TEXT, content TEXT NOT NULL, explanation TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS imagery(id INTEGER PRIMARY KEY, work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE, term TEXT NOT NULL, category TEXT DEFAULT '景物', verified INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS mappings(id INTEGER PRIMARY KEY, work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE, term TEXT NOT NULL, line_index INTEGER, region TEXT, image_url TEXT);
CREATE TABLE IF NOT EXISTS generations(id INTEGER PRIMARY KEY, work_id INTEGER REFERENCES works(id), prompt TEXT NOT NULL, provider TEXT, model TEXT, result_url TEXT, feedback TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS poem_cache(poem_key TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT, dynasty TEXT, content TEXT NOT NULL, imagery_json TEXT NOT NULL DEFAULT '[]', image_url TEXT, image_style TEXT NOT NULL DEFAULT 'legacy-photo', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
const poemCacheColumns=db.prepare('PRAGMA table_info(poem_cache)').all() as Array<{name:string}>;
if(!poemCacheColumns.some((column)=>column.name==='image_style'))db.exec("ALTER TABLE poem_cache ADD COLUMN image_style TEXT NOT NULL DEFAULT 'legacy-photo'");
const app=express(); app.use(cors()); app.use(express.json({limit:'25mb'}));
app.use('/api/generated-images',express.static(generatedImageDir,{maxAge:'1y',immutable:true}));
registerIntegrationRoutes(app);
app.get('/api/health',(_req,res)=>res.json({ok:true,database:'sqlite',integrations:{imagery:Boolean(process.env.IMAGERY_API_URL),imageryModel:Boolean(process.env.IMAGERY_API_MODEL),imageGeneration:Boolean(process.env.IMAGE_GENERATION_API_URL),imageGenerationModel:Boolean(process.env.IMAGE_GENERATION_API_MODEL),assistant:Boolean(process.env.POETRY_ASSISTANT_API_URL),assistantModel:Boolean(process.env.POETRY_ASSISTANT_API_MODEL)}}));
type CachePoem={title?:string;author?:string;dynasty?:string;content?:string};
function poemCacheKey(poem:CachePoem){
  const identity=[poem.title,poem.author,poem.dynasty,String(poem.content||'').replace(/\s+/g,'')].map((value)=>String(value||'').trim());
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}
async function persistGeneratedImage(value:string){
  let bytes:Buffer,extension:string;
  const dataMatch=value.match(/^data:image\/(png|jpeg|webp);base64,([\s\S]+)$/i);
  if(dataMatch){extension=dataMatch[1].toLowerCase()==='jpeg'?'jpg':dataMatch[1].toLowerCase();bytes=Buffer.from(dataMatch[2],'base64');}
  else{
    const imageUrl=new URL(value);
    if(imageUrl.protocol!=='https:')throw new Error('图片缓存只接受 HTTPS 图片地址');
    const response=await fetch(imageUrl,{signal:AbortSignal.timeout(30_000)});
    if(!response.ok)throw new Error(`下载生成图片失败（HTTP ${response.status}）`);
    const size=Number(response.headers.get('content-length')||0);
    if(size>25*1024*1024)throw new Error('生成图片超过本地缓存大小限制');
    const mime=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
    extension=({ 'image/png':'png','image/jpeg':'jpg','image/webp':'webp' } as Record<string,string>)[mime]||'';
    if(!extension)throw new Error(`生成图片格式暂不支持本地缓存：${mime||'未知'}`);
    bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.byteLength>25*1024*1024)throw new Error('生成图片超过本地缓存大小限制');
  }
  if(!bytes.byteLength||bytes.byteLength>25*1024*1024)throw new Error('生成图片数据为空或超过本地缓存大小限制');
  const filename=`${createHash('sha256').update(bytes).digest('hex')}.${extension}`;
  await writeFile(path.join(generatedImageDir,filename),bytes);
  return `/api/generated-images/${filename}`;
}
app.post('/api/cache/lookup',(req,res)=>{
  const poem=(req.body?.poem||{}) as CachePoem;
  if(!poem.title||!poem.content)return res.status(400).json({error:'查询缓存需要诗题和原文'});
  const row=db.prepare('SELECT imagery_json,image_url,image_style FROM poem_cache WHERE poem_key=?').get(poemCacheKey(poem)) as {imagery_json:string;image_url:string|null;image_style:string}|undefined;
  if(!row)return res.json({cached:false,imagery:[]});
  let imagery=[];try{imagery=JSON.parse(row.imagery_json)||[];}catch{/* 忽略损坏的旧缓存 */}
  const imageUrl=row.image_style==='ink-painting-v1'?row.image_url: null;
  res.json({cached:Boolean(imagery.length||imageUrl),imagery,imageUrl:imageUrl||undefined});
});
app.post('/api/cache/save',async(req,res)=>{
  try{
    const poem=(req.body?.poem||{}) as CachePoem;
    if(!poem.title||!poem.content)return res.status(400).json({error:'保存缓存需要诗题和原文'});
    const imagery=Array.isArray(req.body?.imagery)?req.body.imagery.filter((item:any)=>typeof item?.term==='string'&&item.term.trim()).slice(0,500):[];
    const imageStyle=typeof req.body?.imageStyle==='string'&&req.body.imageStyle==='ink-painting-v1'?'ink-painting-v1':'legacy-photo';
    let imageUrl=typeof req.body?.imageUrl==='string'?req.body.imageUrl:'';
    if(imageUrl.startsWith('data:image/')||/^https:\/\//i.test(imageUrl))imageUrl=await persistGeneratedImage(imageUrl);
    if(imageUrl&&!/^\/api\/generated-images\/[a-f0-9]{64}\.(png|jpg|webp)$/i.test(imageUrl))return res.status(400).json({error:'图片地址格式无效，无法保存缓存'});
    const key=poemCacheKey(poem);
    db.prepare(`INSERT INTO poem_cache(poem_key,title,author,dynasty,content,imagery_json,image_url,image_style)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(poem_key) DO UPDATE SET
      imagery_json=CASE WHEN excluded.imagery_json='[]' THEN poem_cache.imagery_json ELSE excluded.imagery_json END,
      image_url=COALESCE(excluded.image_url,poem_cache.image_url),
      image_style=CASE WHEN excluded.image_url IS NULL THEN poem_cache.image_style ELSE excluded.image_style END,
      updated_at=CURRENT_TIMESTAMP`)
      .run(key,poem.title,poem.author||'',poem.dynasty||'',poem.content,JSON.stringify(imagery),imageUrl||null,imageStyle);
    const row=db.prepare('SELECT imagery_json,image_url,image_style FROM poem_cache WHERE poem_key=?').get(key) as {imagery_json:string;image_url:string|null;image_style:string};
    res.json({cached:true,imagery:JSON.parse(row.imagery_json),imageUrl:row.image_style==='ink-painting-v1'?row.image_url||undefined:undefined});
  }catch(error){res.status(500).json({error:(error as Error).message||'缓存保存失败'});}
});
app.get('/api/search',async(req,res)=>{
  const q=String(req.query.q||'').trim();
  if(!q)return res.status(400).json({error:'请输入搜索内容'});
  const type=String(req.query.type||'all');
  const page=String(req.query.page||'1');
  const pageSize=String(req.query.page_size||'10');
  const endpoints=[
    `https://poetry.palemoky.com/api/v1/poems/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`,
    `https://poetry.palemoky.com/api/search?q=${encodeURIComponent(q)}`,
  ];
  // 两个版本的诗泉接口返回结构不同。检测到结果数组为空时继续尝试旧版，
  // 避免新版返回 200 空结果却把搜索短路。
  const hasPoems=(value:any):boolean=>{
    if(Array.isArray(value))return value.length>0;
    if(!value||typeof value!=='object')return false;
    for(const key of ['results','items','poems','records'])if(Array.isArray(value[key])&&value[key].length)return true;
    return hasPoems(value.data);
  };
  let lastStatus=502,hadSuccessfulResponse=false;
  try{
    for(const url of endpoints){
      const upstream=await fetch(url,{signal:AbortSignal.timeout(8000)});
      lastStatus=upstream.status;
      if(!upstream.ok)continue;
      hadSuccessfulResponse=true;
      const body=await upstream.text();
      let parsed:any;
      try{parsed=JSON.parse(body);}catch{continue;}
      if(hasPoems(parsed)){
        // 旧版 /api/search 只有全文检索；按用户选择的范围在服务端补做筛选。
        if(url===endpoints[1]&&type!=='all'){
          const findList=(value:any):any[]|null=>{
            if(Array.isArray(value))return value;
            if(!value||typeof value!=='object')return null;
            for(const key of ['results','items','poems','records'])if(Array.isArray(value[key]))return value[key];
            return findList(value.data);
          };
          const list=findList(parsed)||[];
          const needle=q.replace(/[\s，。！？、；：“”‘’《》]/g,'');
          const filtered=list.filter((item:any)=>{
            const text=(value:any)=>typeof value==='string'?value:value?.name||'';
            const title=text(item.title).replace(/[\s，。！？、；：“”‘’《》]/g,'');
            const content=(Array.isArray(item.content)?item.content.join(''):typeof item.content==='string'?item.content:'').replace(/[\s，。！？、；：“”‘’《》]/g,'');
            const author=text(item.author?.name||item.author);
            return type==='title'?title.includes(needle):type==='content'?content.includes(needle):type==='author'?author.includes(q):true;
          });
          parsed={results:filtered};
          if(!filtered.length)continue;
        }
        res.status(200).json(parsed);
        return;
      }
    }
    // 两个端点都正常但没有命中，返回空结果让前端显示“未找到”，而非误报 API 故障。
    if(hadSuccessfulResponse){res.json({results:[]});return;}
    res.status(502).json({error:'诗泉搜索接口暂不可用'});
  }catch{
    try{
      const fallback=await fetch(endpoints[1],{signal:AbortSignal.timeout(8000)});
      if(!fallback.ok)throw new Error('诗泉搜索失败');
      const body=await fallback.text();
      res.status(200).type('application/json').send(body);
    }catch{res.status(502).json({error:'诗泉 API 暂时无法访问'});}
  }
});
app.post('/api/works',(req,res)=>{const p=req.body as {title?:string;author?:string;dynasty?:string;content?:string;explanation?:string;images?:string[]};if(!p.title||!p.content)return res.status(400).json({error:'诗题和原文不能为空'});const insert=db.prepare('INSERT INTO works(title,author,dynasty,content,explanation) VALUES(?,?,?,?,?)');const insertImage=db.prepare('INSERT INTO imagery(work_id,term) VALUES(?,?)');db.exec('BEGIN');try{const row=insert.run(p.title,p.author||'',p.dynasty||'',p.content,p.explanation||'');for(const term of new Set(p.images||[]))insertImage.run(row.lastInsertRowid,term);db.exec('COMMIT');res.json({id:row.lastInsertRowid});}catch(e){db.exec('ROLLBACK');res.status(500).json({error:'作品保存失败'});}});
app.get('/api/works',(req,res)=>{const rows=db.prepare('SELECT * FROM works ORDER BY id DESC LIMIT 100').all();res.json(rows);});
const port=Number(process.env.PORT||8787);app.listen(port,()=>console.log(`诗境 API server: http://localhost:${port}`));
