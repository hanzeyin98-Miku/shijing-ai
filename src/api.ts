export type ImageryItem = {
  term: string;
  category?: string;
  lineIndex?: number;
  start?: number;
  end?: number;
  description?: string;
};

export type PoemContext = {
  title: string;
  author: string;
  dynasty: string;
  content: string;
  explanation?: string;
};

export type AssistantMode = 'graph' | 'qa' | 'color';
export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type AssistantResponse = {
  answer?: string;
  nodes?: Array<{ id: string; label: string; kind?: string }>;
  edges?: Array<{ source: string; target: string; relation?: string; evidence?: string }>;
  palette?: string[];
  emotions?: Array<{ label: string; score: number }>;
  [key: string]: unknown;
};

export type PoemCache = { cached: boolean; imagery: ImageryItem[]; imageUrl?: string };

function readableError(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const error = value as Record<string, unknown>;
    for (const key of ['message', 'detail', 'error_description', 'msg', 'error']) {
      if (error[key] && error[key] !== value) {
        const nested: string = readableError(error[key], '');
        if (nested) return nested;
      }
    }
    try { return JSON.stringify(value); } catch { return fallback; }
  }
  return fallback;
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${readableError(data.error ?? data.message ?? data, '') || '接口请求失败'}（HTTP ${response.status}）`);
  return data as T;
}

export function extractImagery(poem: PoemContext) {
  return postJson<{ imagery: ImageryItem[] }>('/api/imagery/extract', { poem });
}

export function generatePoemImage(poem: PoemContext, imagery: ImageryItem[], style = '多彩水墨国画', prompt?: string) {
  return postJson<{ imageUrl: string; taskId?: string; model?: string }>('/api/image/generate', { poem, imagery, style, prompt });
}

export function loadPoemCache(poem: PoemContext) {
  return postJson<PoemCache>('/api/cache/lookup', { poem, imageStyle: 'ink-painting-v1' });
}

export function savePoemCache(poem: PoemContext, update: { imagery?: ImageryItem[]; imageUrl?: string; imageStyle?: string }) {
  return postJson<PoemCache>('/api/cache/save', { poem, ...update });
}

export function askPoetryAssistant(mode: AssistantMode, poem: PoemContext, imagery: ImageryItem[], question?: string, history?: ChatTurn[]) {
  return postJson<AssistantResponse>('/api/assistant', { mode, poem, imagery, question, history });
}
