import type { Request, Response } from 'express';

type Provider = 'imagery' | 'image' | 'assistant';

const providerSettings: Record<Provider, { url: string; key: string; model: string; label: string }> = {
  imagery: { url: 'IMAGERY_API_URL', key: 'IMAGERY_API_KEY', model: 'IMAGERY_API_MODEL', label: '意象提取 API' },
  image: { url: 'IMAGE_GENERATION_API_URL', key: 'IMAGE_GENERATION_API_KEY', model: 'IMAGE_GENERATION_API_MODEL', label: '图像生成 API' },
  assistant: { url: 'POETRY_ASSISTANT_API_URL', key: 'POETRY_ASSISTANT_API_KEY', model: 'POETRY_ASSISTANT_API_MODEL', label: '诗意/图谱/问答/色彩共用 API' },
};

function readableProviderError(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const data = value as Record<string, unknown>;
    for (const key of ['message', 'detail', 'error_description', 'msg', 'error']) {
      if (data[key] && data[key] !== value) {
        const nested = readableProviderError(data[key], '');
        if (nested) return nested;
      }
    }
    try { return JSON.stringify(value); } catch { return fallback; }
  }
  return fallback;
}

type PoemPayload = {
  poem?: { title?: string; author?: string; dynasty?: string; content?: string; explanation?: string };
  imagery?: Array<{ term?: string; category?: string }>;
  mode?: 'graph' | 'qa' | 'color';
  question?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  style?: string;
  prompt?: string;
};

function poemDescription(payload: PoemPayload) {
  const poem = payload.poem || {};
  return `诗题：${poem.title || '未命名'}\n作者：${poem.dynasty || ''} ${poem.author || '佚名'}\n原文：\n${poem.content || ''}\n已有释义：${poem.explanation || '暂无'}`;
}

// 原句词汇补漏：只从原文逐字匹配，不会凭空造词，也不增加模型调用。
const imageryLexicon: Array<[string, string]> = [
  ...['江山','山河','青山','群山','高山','远山','孤山','空山','西岭','庐山','赤壁','故垒','乱石','奇峰','大漠','沙漠','古道','孤城','边塞','山','岭','峰','岳','崖','川','石'].map((term) => [term, '山水'] as [string,string]),
  ...['千堆雪','惊涛拍岸','惊涛','江潮','黄河','大江','长江','沧海','江水','江流','清泉','泉水','瀑布','飞瀑','溪水','溪流','湖水','流水','江','河','海','湖','溪','泉','瀑','水','浪','涛'].map((term) => [term, '水景'] as [string,string]),
  ...['白云','浮云','乌云','云海','烟雨','暮烟','紫烟','炊烟','云','烟','雾','风雪','秋风','春风','西风','东风','北风','夜雨','细雨','风雨','暴雨','雨','风','雪','霜','冰','露'].map((term) => [term, '天气'] as [string,string]),
  ...['银河','星河','明月','残月','新月','月光','月色','夕阳','斜阳','落日','朝阳','红日','白日','青天','天空','九天','长空','夜空','彩霞','晚霞','朝霞','霞','虹','星','月','日','天'].map((term) => [term, '天象'] as [string,string]),
  ...['翠柳','杨柳','垂柳','松林','竹林','梅花','桃花','杏花','梨花','荷花','莲花','芦苇','梧桐','枫叶','芳草','春草','落花','柳','松','竹','莲','荷','梅','菊','花','草','树','林','叶'].map((term) => [term, '草木'] as [string,string]),
  ...['黄鹂','白鹭','鸿雁','孤雁','归雁','啼鸟','飞鸟','杜鹃','猿啼','蝉鸣','渔歌','鸟','鹂','鹭','雁','燕','鹤','鸦','猿','蝉','蛙','鱼','马','鹿'].map((term) => [term, '生灵'] as [string,string]),
  ...['渔舟','孤舟','扁舟','轻舟','归舟','小舟','孤帆','征帆','远帆','渔船','楼船','舟','船','帆','楼','高楼','危楼','亭','台','城','长城','关','塞','桥','门','窗','灯','烛','酒','剑','琴','笛','鼓','钟'].map((term) => [term, '器物建筑'] as [string,string]),
  ...['周郎','公瑾','浣女','渔翁','故人','行人','征人','游子','王孙','美人','佳人','诗人','豪杰','客','人'].map((term) => [term, '人物'] as [string,string]),
  ...['黄昏','清晨','黎明','夜半','深夜','春日','秋日','春','夏','秋','冬','夜','晓','暮','夕','晨','千秋'].map((term) => [term, '时令时空'] as [string,string]),
];

// 单独出现时只是动作或语法成分，不作为意象词条；名词词组如「落花」不受影响。
const verbOrFunctionTerms = new Set('出 过 入 去 来 归 上 下 落 飞 鸣 听 看 望 知 闻 生 照 流 泊 含 挂 起 卷 问 是 如 为 而 且 乃 不 无 有 将 把 被 与 之 其 此'.split(' '));

function enrichImagery(poem: PoemPayload['poem'], result: any) {
  const source = String(poem?.content || '');
  const existing: Array<{term?: string; category?: string; description?: string; lineIndex?: number}> = Array.isArray(result?.imagery) ? result.imagery : [];
  const byTerm = new Map<string, {term: string; category: string; description?: string; lineIndex?: number}>();
  for (const item of existing) {
    const term = String(item.term || '').trim();
    const category = String(item.category || '意象');
    if (term && !verbOrFunctionTerms.has(term) && !/动作|动词|助词/.test(category)) byTerm.set(term, { ...item, term, category });
  }
  const lines = source.split(/\n|[。！？；]/).map((line) => line.trim()).filter(Boolean);
  for (const [lineIndex, line] of lines.entries()) {
    const found = imageryLexicon.filter(([term]) => line.includes(term)).sort((a,b) => b[0].length-a[0].length);
    const accepted: string[] = [];
    for (const [term, category] of found) {
      // 「明月」命中时不再把同一处拆成「月」；避免词条重复而保留独立出现的短意象。
      if (accepted.some((longer) => longer.includes(term))) continue;
      accepted.push(term);
      if (!byTerm.has(term)) byTerm.set(term, { term, category, description: `原句「${line}」中的意象`, lineIndex });
    }
  }
  return { ...result, imagery: [...byTerm.values()] };
}

function promptFor(provider: Provider, payload: PoemPayload) {
  const poem = poemDescription(payload);
  const imagery = (payload.imagery || []).map((item) => item.term).filter(Boolean).join('、') || '待提取';
  if (provider === 'imagery') return `你是负责高召回率的中国古典诗词意象标注助手。目标是尽量完整，而不是只挑最显眼的几个词。必须逐句扫描全文两遍：第一遍提取具体可感知的名词和名词性词组，第二遍检查有没有漏掉的次要景物、人物、器物、声音、颜色、方位、时令和时空词。覆盖自然景物（山水、天地日月、风云雨雪、草木花叶、鸟兽鱼虫）、人物、舟车建筑器物、声音和时间空间；一个词组优先保留完整名词（如“明月”“落花”“归雁”），也可同时保留语义独立的其他名词意象。不要把动词、助词、介词、连词或代词单独当作意象，例如“出”“过”“入”“上”“下”“来”“去”“是”“而”；动词只有组成约定俗成的具体名词词组时才保留。不要设置数量上限，不要因为意象常见而省略；同一意象只保留一次。只取原文明确出现的名词，不推测诗外内容，不把抽象主题或释义改写成原文词条。lineIndex 从 0 开始，指向原诗分句。仅返回合法 JSON，不要 Markdown 或解释，格式：{"imagery":[{"term":"原文名词或名词词组","category":"山水/天气/天象/草木/生灵/水景/人物/声音/器物建筑/时令时空/其他","description":"该词在句中的画面作用","lineIndex":0}]}。提交前再次逐句对照原文，移除单独的动词和语法成分，再检查遗漏名词。\n${poem}`;
  if (payload.mode === 'graph') return `你是古典诗词意象关系分析器。只能使用下面“意象列表”中的原词创建节点，label 必须与意象原词完全一致；只分析原诗中有明确语义依据的意象关系，不要为了连线而臆造关系。不确定时不要连线。边的 source 和 target 填节点 id，relation 用简洁中文描述关系，evidence 引用原诗中的短语作为依据。仅返回合法 JSON：{"nodes":[{"id":"n1","label":"明月","kind":"天象"}],"edges":[{"source":"n1","target":"n2","relation":"映照","evidence":"明月松间照"}]}。\n${poem}\n意象列表：${imagery}`;
  if (payload.mode === 'color') return `分析这首诗的画面色彩和情绪强度。请为以下五个固定维度分别给出 0 到 1 的分值（0 表示没有，1 表示非常强），不要遗漏或改名：明快、宁静、悲凉、苍茫、悠远。palette 返回 3 到 5 个适合诗意画面的十六进制颜色。只返回合法 JSON，格式：{"palette":["#263238","#c8d0cc"],"emotions":[{"label":"明快","score":0.4},{"label":"宁静","score":0.8},{"label":"悲凉","score":0.2},{"label":"苍茫","score":0.5},{"label":"悠远","score":0.7}]}。\n${poem}\n意象：${imagery}`;
  const question = payload.question || '请解释这首诗。';
  if (/翻译|译文/.test(question)) return `你是中国古典诗词翻译助手。按原诗分句顺序逐句翻译成通顺现代汉语。请严格根据原文，不遗漏、不合并句子。只返回合法 JSON：{"translations":["第一句译文","第二句译文"]}。\n${poem}\n问题：${question}`;
  const conversation = (payload.history || []).slice(-12).map((turn) => `${turn.role === 'user' ? '用户' : '助手'}：${turn.content}`).join('\n');
  return `你是中国古典诗词讲解助手。结合诗词和此前对话，用简洁中文回答用户最新问题；只返回合法 JSON：{"answer":"回答内容"}。\n${poem}\n意象：${imagery}\n此前对话：\n${conversation || '（首次提问）'}\n最新问题：${question}`;
}

function responseText(data: any): string {
  if (typeof data?.output_text === 'string') return data.output_text;
  const chunks = (data?.output || []).flatMap((item: any) => item?.content || [])
    .filter((item: any) => item?.type === 'output_text' && typeof item.text === 'string')
    .map((item: any) => item.text);
  return chunks.join('\n').trim();
}

function parsedModelResult(data: any, provider: Provider) {
  const text = responseText(data);
  if (!text) throw Object.assign(new Error(`${providerSettings[provider].label}已响应，但没有返回可读取的文本。请确认模型支持文本输出。`), { status: 502 });
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const candidates = [cleaned];
  // 有些模型会在 JSON 前后补充说明文字；优先尝试截取完整 JSON 对象。
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch { /* 继续尝试宽松恢复 */ }
  }
  // 意象提取只需 term 才能驱动左侧列表；JSON 外壳损坏时保留模型已输出的完整意象项。
  if (provider === 'imagery') {
    const terms = [...cleaned.matchAll(/"term"\s*:\s*"((?:\\.|[^"\\])*)"/g)]
      .map((match) => { try { return JSON.parse(`"${match[1]}"`) as string; } catch { return match[1]; } })
      .filter((term) => term.trim());
    if (terms.length) return { imagery: [...new Set(terms)].map((term) => ({ term })) };
  }
  throw Object.assign(new Error(`${providerSettings[provider].label}返回内容无法解析。请重试，或让模型按 JSON 格式输出。`), { status: 502 });
}

/**
 * 外部服务适配入口。
 * 若供应商支持“JSON POST + Bearer Key”，填写 .env 即可试用；
 * 若供应商使用其他鉴权或字段格式，请在这里的 provider adapter 中转换。
 */
export async function callProvider(provider: Provider, payload: unknown) {
  const settings = providerSettings[provider];
  const url = process.env[settings.url];
  const key = process.env[settings.key];
  const model = process.env[settings.model];
  if (!url) throw Object.assign(new Error(`${settings.label}尚未配置。请填写 .env 中的 ${settings.url}。`), { status: 503 });

  const bodyPayload = payload && typeof payload === 'object' ? payload as PoemPayload : {};
  const pathname = new URL(url).pathname.replace(/\/$/, '');
  let requestBody: Record<string, unknown>;
  if (pathname.endsWith('/responses') && provider !== 'image') {
    // 方舟 Responses API 接受 model + input；项目内部的 poem/mode 数据先整理成提示词。
    requestBody = { ...(model ? { model } : {}), input: promptFor(provider, bodyPayload) };
  } else if (pathname.endsWith('/images/generations') && provider === 'image') {
    const poem = bodyPayload.poem || {};
    const terms = (bodyPayload.imagery || []).map((item) => item.term).filter(Boolean).join('、');
    const style = bodyPayload.style || '多彩水墨国画';
    const suppliedPrompt = typeof bodyPayload.prompt === 'string' ? bodyPayload.prompt.trim() : '';
    requestBody = {
      ...(model ? { model } : {}),
      prompt: suppliedPrompt || `请创作一幅中国传统彩色水墨国画，为古诗《${poem.title || ''}》营造诗意画境。作者：${poem.dynasty || ''}代${poem.author || '佚名'}。诗句：${poem.content || ''}。画面重点表现这些意象：${terms || '请从诗句中选取最鲜明的景物意象'}。采用中国画笔墨语言：墨色浓淡干湿、皴擦点染、虚实相生、层叠留白；在水墨基础上使用克制而丰富的矿物色与植物色，如青绿、花青、赭石、朱砂、淡金。构图有远近层次，气韵清雅，准确呈现诗句中的主要景物。${style}。画面应明确呈现手绘国画质感，避免照片写实、摄影镜头、现代物品、卡通、3D渲染；不要出现文字、题字、边框或印章。`,
      response_format: 'url',
      size: '2K',
      watermark: false,
    };
  } else {
    // 其他兼容服务继续使用通用 JSON 转发格式。
    requestBody = { ...(payload && typeof payload === 'object' ? payload as Record<string, unknown> : { input: payload }), ...(model ? { model } : {}) };
  }
  const timeoutMs = provider === 'image' ? 180_000 : 60_000;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = readableProviderError(data.error ?? data.message ?? data, `${settings.label}请求失败`);
    throw Object.assign(new Error(`${settings.label}：${detail}（上游 HTTP ${response.status}）`), { status: 502 });
  }
  if (pathname.endsWith('/responses') && provider !== 'image') {
    const parsed = parsedModelResult(data, provider);
    return provider === 'imagery' ? enrichImagery(bodyPayload.poem, parsed) : parsed;
  }
  if (pathname.endsWith('/images/generations') && provider === 'image') {
    const first = data?.data?.[0] || data?.images?.[0] || data?.output?.[0] || data?.result;
    const imageUrl = first?.url || first?.image_url || data?.image_url || data?.url
      || (first?.b64_json ? `data:image/${first.output_format || 'png'};base64,${first.b64_json}` : undefined)
      || (data?.b64_json ? `data:image/${data.output_format || 'png'};base64,${data.b64_json}` : undefined);
    if (!imageUrl) throw Object.assign(new Error(`图像生成 API 已响应，但未找到图片 URL 或 Base64（响应字段：${Object.keys(data || {}).join(', ') || '空'}）。请检查图像 API 返回格式。`), { status: 502 });
    return { imageUrl, model: data.model, created: data.created };
  }
  return data;
}

export function sendIntegrationError(error: unknown, response: Response) {
  const err = error as Error & { status?: number };
  response.status(err.status || 502).json({ error: err.message || '外部 API 请求失败' });
}

export function registerIntegrationRoutes(app: import('express').Express) {
  app.post('/api/imagery/extract', async (req: Request, res: Response) => {
    try { res.json(await callProvider('imagery', req.body)); }
    catch (error) { sendIntegrationError(error, res); }
  });

  app.post('/api/image/generate', async (req: Request, res: Response) => {
    try { res.json(await callProvider('image', req.body)); }
    catch (error) { sendIntegrationError(error, res); }
  });

  // 一个供应商端点，通过 mode=graph | qa | color 区分三类任务。
  app.post('/api/assistant', async (req: Request, res: Response) => {
    const { mode } = req.body || {};
    if (!['graph', 'qa', 'color'].includes(mode)) return res.status(400).json({ error: 'mode 必须是 graph、qa 或 color' });
    try { res.json(await callProvider('assistant', req.body)); }
    catch (error) { sendIntegrationError(error, res); }
  });
}
