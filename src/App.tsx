import { useEffect, useMemo, useRef, useState } from 'react';
import { askPoetryAssistant, extractImagery, generatePoemImage, loadPoemCache, savePoemCache, type AssistantMode, type AssistantResponse, type ChatTurn, type ImageryItem } from './api';
import CoCreatePanel, { type PaintingVersion } from './CoCreatePanel';
import PoetryEntry from './PoetryEntry';
import { buildCreativePrompt, defaultCreativeConfig, moodOptions, type CreativeConfig } from '../shared/creative';

type Poem = { id?: string | number; title: string; author: string; dynasty: string; content: string; explanation: string; translation?: string[]; images: string[]; genre?: string };

const samples: Poem[] = [
  { title: '绝句', author: '杜甫', dynasty: '唐', content: '两个黄鹂鸣翠柳，\n一行白鹭上青天。\n窗含西岭千秋雪，\n门泊东吴万里船。', explanation: '两只黄鹂在翠绿的柳树间婉转鸣叫，一队白鹭飞向湛蓝的天空。窗外映着西岭终年不化的积雪，门前停泊着来自东吴的船只。诗人以明丽开阔的景象，写出春日生机与远行的想象。', translation: ['两只黄鹂在翠绿的柳枝间鸣叫。', '一行白鹭飞向湛蓝的天空。', '窗外映着西岭千年不化的积雪。', '门前停泊着来自东吴的万里航船。'], images: ['黄鹂', '翠柳', '白鹭', '青天', '窗', '西岭', '雪', '门', '船'] },
  { title: '山居秋暝', author: '王维', dynasty: '唐', content: '空山新雨后，天气晚来秋。\n明月松间照，清泉石上流。\n竹喧归浣女，莲动下渔舟。\n随意春芳歇，王孙自可留。', explanation: '新雨过后，山谷清朗，秋意渐浓。月光透过松林，清泉在石上流淌；竹林传来浣女归来的笑语，莲叶摇动，渔舟顺流而下。诗人借清幽明净的山居秋景，表达对自然与隐逸生活的喜爱。', translation: ['空旷的山林刚下过一场雨。', '傍晚的天气已经显出秋意。', '明月照在松林间。', '清泉从石头上流过。', '竹林里传来喧笑声，原来是洗衣女子归来。', '莲叶摇动，渔船顺流而下。', '任凭春天的花草凋谢。', '山中的景色依然值得停留。'], images: ['空山', '新雨', '秋', '明月', '松林', '清泉', '竹林', '浣女', '莲', '渔舟'] },
  { title: '春晓', author: '孟浩然', dynasty: '唐', content: '春眠不觉晓，处处闻啼鸟。\n夜来风雨声，花落知多少。', explanation: '春夜酣眠，不知不觉天已破晓，醒来只听见处处鸟鸣。回想昨夜的风雨声，不禁担心有多少花瓣已经飘落。诗句写出春晨的清新，也流露对春光易逝的怜惜。', translation: ['春夜里睡得香甜，不知不觉天已经亮了。', '醒来只听见四处都有鸟儿在啼叫。', '回想昨夜传来的风雨声。', '不知道有多少花瓣被风雨打落了。'], images: ['春眠', '晓', '鸟鸣', '风雨', '落花'] },
  { title: '望庐山瀑布', author: '李白', dynasty: '唐', content: '日照香炉生紫烟，遥看瀑布挂前川。\n飞流直下三千尺，疑是银河落九天。', explanation: '阳光照耀香炉峰，山间云雾升腾，仿佛紫色烟霞。远望瀑布像一条白练悬挂山前，水流从高处奔腾而下，仿佛银河自九天倾落。', translation: ['阳光照耀香炉峰，升起紫色的云雾。', '远远望去，瀑布像白练挂在山前。', '水流从高处直泻而下，仿佛有三千尺高。', '让人怀疑是银河从九重天上倾落下来。'], images: ['香炉峰', '紫烟', '瀑布', '银河'] },
];
const vocabulary = ['黄鹂', '翠柳', '白鹭', '青天', '西岭', '明月', '松林', '清泉', '空山', '雨', '春', '鸟', '落花', '瀑布', '银河', '云', '风', '竹林', '莲', '渔舟', '雪', '江', '孤帆', '长城', '黄河', '夕阳', '酒', '窗', '门', '船'];
const tabs = ['诗意', '图谱', '问答', '色彩', '探索'] as const;
const emotionAxes = ['明快', '宁静', '悲凉', '苍茫', '悠远'];
const emotionKeywords: Record<string, string[]> = {
  明快: ['春', '晓', '鸟', '翠', '青', '花', '日', '柳', '白'],
  宁静: ['空山', '明月', '松', '泉', '静', '清', '夜'],
  悲凉: ['落花', '雨', '秋', '霜', '泪', '孤', '愁', '别'],
  苍茫: ['江', '海', '天', '山', '河', '远', '万里'],
  悠远: ['千秋', '银河', '长', '远', '云', '月', '九天'],
};
const paletteKeywords: Record<string, string[]> = {
  '青绿': ['翠', '青', '柳', '松', '竹', '山'], '花青': ['天', '云', '江', '水', '夜'],
  '赭石': ['石', '山', '土', '枫', '秋'], '朱砂': ['日', '红', '花', '霞', '春'], '淡墨': ['月', '雪', '雨', '雾', '烟', '白'],
};
const paletteChoices = [
  { label: '青绿', color: '#829d83' }, { label: '花青', color: '#66899a' }, { label: '赭石', color: '#b88d67' },
  { label: '朱砂', color: '#b96859' }, { label: '淡墨', color: '#aaa9a0' },
];
type ScenePin = { term: string; x: number; y: number };
type ImageryNote = { text: string; includeInArtwork: boolean; updatedAt: number };
type PoemNotes = { title: string; author: string; dynasty: string; notes: Record<string, ImageryNote> };
type ExportSettings = { orientation: 'portrait' | 'landscape'; paper: string; includeTranslation: boolean; includeImagery: boolean };
type Tab = typeof tabs[number];
type SearchType = 'all' | 'title' | 'content' | 'author';
type ChatMessage = ChatTurn & { id: string };

function localPoemKey(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

function normalizeSavedMood(value: unknown): CreativeConfig['mood'] {
  const allowed = moodOptions.map((option) => option.id) as string[];
  const choices = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const valid = choices.filter((item): item is CreativeConfig['mood'][number] => typeof item === 'string' && allowed.includes(item));
  return valid.length ? valid : ['清寂'];
}

function welcomeMessage(title: string): ChatMessage {
  return { id: `welcome-${title}`, role: 'assistant', content: `关于《${title}》，你想了解什么？可以问作者、意象或诗句释义。` };
}

function loadChat(title: string): ChatMessage[] {
  try {
    const saved = localStorage.getItem(`shijing-ai-chat:${title}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.filter((item) => ['user', 'assistant'].includes(item.role) && typeof item.content === 'string');
    }
  } catch { /* 浏览器禁用本地存储时仍可在本次页面会话中聊天 */ }
  return [welcomeMessage(title)];
}

function saveChat(title: string, messages: ChatMessage[]) {
  try { localStorage.setItem(`shijing-ai-chat:${title}`, JSON.stringify(messages)); } catch { /* 保留内存中的聊天内容 */ }
}

function imageryKind(term: string) {
  if (/山|岭|峰|岳|峦|崖/.test(term)) return 'mountain';
  if (/月|日|阳/.test(term)) return 'moon';
  if (/鸟|鹂|鹭|雁|燕|鹤|鸦/.test(term)) return 'bird';
  if (/柳|松|竹|树|林|莲|荷/.test(term)) return 'tree';
  if (/船|舟|帆|渔/.test(term)) return 'boat';
  if (/花|梅|菊|桃|杏|兰/.test(term)) return 'flower';
  if (/窗|门|楼|阁|亭/.test(term)) return 'window';
  if (/雪|霜|冰/.test(term)) return 'snow';
  if (/雨/.test(term)) return 'rain';
  if (/云|雾|烟/.test(term)) return 'cloud';
  if (/天|空|星|霞|虹/.test(term)) return 'sky';
  if (/泉|瀑|江|河|海|溪|水/.test(term)) return 'water';
  if (/人|女|客|翁|王孙/.test(term)) return 'person';
  return 'stone';
}

function ImageryContour({ term }: { term: string }) {
  const kind = imageryKind(term);
  const shape = {
    mountain: <><path d="M30 160 88 77l28 36 44-78 88 125H30Z"/><path d="m75 96 13-19 14 18m43-3 15-27 17 26"/><path d="M34 170h205"/></>,
    moon: <><path d="M157 42a58 58 0 1 0 0 116 49 49 0 0 1 0-116Z"/><path d="M30 166c38-13 73-13 110 0s73 13 110 0"/></>,
    bird: <><path d="M25 126c29-37 54-38 82 0 25-33 50-33 76 0 19-22 41-24 70-3"/><path d="M32 153c52-18 111-18 174 0"/></>,
    tree: <><path d="M137 55 82 119h39l-47 42h127l-45-42h37L137 55Z"/><path d="M130 160h15v24h-15Z"/><path d="M45 185h185"/></>,
    boat: <><path d="M44 143h180l-28 34H77l-33-34Z"/><path d="M132 45v98m0-88-54 65h54m8-37 50 37h-50"/><path d="M36 190c32-12 58-12 89 0s59 12 96 0"/></>,
    flower: <><path d="M137 78c-28-38-62-7-30 19-46 1-40 43 1 35-20 37 16 53 35 16 20 36 57 15 36-17 42 7 47-35 1-35 31-29-3-59-34-18Z"/><path d="M139 141v48m0-24-35 19m35-13 35 15"/></>,
    window: <><path d="M55 48h166v133H55zM138 48v133M55 113h166"/><path d="M42 40h190v150H42z"/></>,
    water: <><path d="M45 52c39 35 71 35 101 0s64-35 96 0M34 102c44 35 78 35 116 0s63-35 93 0M25 151c53 35 90 35 133 0s62-35 87 0"/></>,
    snow: <><path d="M136 45v115m-50-86 100 58m0-58L86 132M136 45l-13 16m13-16 13 16m-13 99-13-16m13 16 13-16M86 74l21 2m-21-2 9 19m91-19-21 2m21-2-9 19M86 132l21-2m-21 2 9-19m91 19-21-2m21 2-9-19"/><path d="M40 177c42-17 69-17 96 0s56 17 104 0"/></>,
    rain: <><path d="M74 102a36 36 0 0 1 4-72 47 47 0 0 1 88 15 29 29 0 1 1 16 57H74Z"/><path d="m88 124-12 24m49-24-12 24m49-24-12 24m49-24-12 24"/></>,
    cloud: <><path d="M51 123a36 36 0 0 1 4-72 47 47 0 0 1 88 15 29 29 0 1 1 16 57H51Z"/><path d="M41 151c42-15 67-15 97 0s54 15 100 0"/></>,
    sky: <><path d="M35 157h210M51 133c36-27 74-27 111 0s50 26 73 0"/><path d="m71 58 4 10 11 1-9 7 3 11-9-7-9 7 3-11-9-7 11-1 4-10Zm94 5 3 7 8 1-6 5 2 8-7-5-6 5 2-8-6-5 8-1 2-7Z"/></>,
    person: <><circle cx="137" cy="55" r="20"/><path d="m116 82-34 63 37 7-4 36h47l-5-36 37-7-34-63Z"/><path d="m114 95-38 39m88-39 39 39"/></>,
    stone: <><path d="m42 153 30-71 37 30 35-67 71 108H42Z"/><path d="M37 164h190"/></>,
  }[kind];
  return <div className={`imagery-contour contour-${kind}`} key={term} aria-label={`「${term}」的立体意象轮廓`}>
    <div className="contour-title"><span>意象浮现</span><strong>{term}</strong></div>
    <svg viewBox="0 0 280 210" role="img" aria-label={`${term}的立体线稿`}>
      <g className="contour-back" transform="translate(10 -9)">{shape}</g>
      <g className="contour-front">{shape}</g>
      <path className="contour-connect" d="M30 160 40 151m190 9 10-9M137 55l10-9"/>
    </svg>
  </div>;
}

function highlight(line: string, terms: string[], selected: string, select: (term: string) => void, focusWords: string[] = []) {
  const nodes: React.ReactNode[] = [];
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const sortedFocus = [...new Set(focusWords)].sort((a, b) => b.length - a.length);
  for (let i = 0; i < line.length;) {
    const term = sorted.find((x) => line.startsWith(x, i));
    if (term) { nodes.push(<button key={i} className={`poem-term ${selected === term ? 'active' : ''}`} onClick={() => select(term)}>{term}</button>); i += term.length; }
    else if (sortedFocus.some((word) => line.startsWith(word, i))) {
      const word = sortedFocus.find((candidate) => line.startsWith(candidate, i))!;
      nodes.push(<mark key={i} className="emotion-keyword">{word}</mark>); i += word.length;
    }
    else { nodes.push(<span key={i}>{line[i]}</span>); i += 1; }
  }
  return nodes;
}

function graphPosition(index: number, count: number) {
  // 错列排布：中心节点在上、左右节点交替向下，避免标签挤在一起。
  const slots = [
    { x: 140, y: 24 }, { x: 54, y: 54 }, { x: 226, y: 54 },
    { x: 54, y: 105 }, { x: 226, y: 105 }, { x: 54, y: 156 },
    { x: 226, y: 156 }, { x: 105, y: 208 }, { x: 175, y: 208 },
  ];
  if (count <= slots.length) return slots[index];
  const angle = (Math.PI * 2 * (index + 0.5)) / count - Math.PI / 2;
  return { x: 140 + Math.cos(angle) * 100, y: 120 + Math.sin(angle) * 100 };
}

function matchImageryTerm(label: string, terms: string[]) {
  const normalized = label.replace(/[\s，。！？、；：“”‘’《》]/g, '');
  return terms.find((term) => term === normalized)
    || [...terms].sort((a, b) => b.length - a.length).find((term) => normalized.includes(term) || term.includes(normalized));
}

export default function App() {
  const [hasEntered, setHasEntered] = useState(false);
  const [poem, setPoem] = useState<Poem>(samples[0]);
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [busy, setBusy] = useState(false);
  const [searchResults, setSearchResults] = useState<Poem[]>([]);
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState('西岭');
  const [selectedVerse, setSelectedVerse] = useState(-1);
  const [selectedEmotion, setSelectedEmotion] = useState('');
  const [selectedPalette, setSelectedPalette] = useState('');
  const [pinMode, setPinMode] = useState(false);
  const [pinsByPoem, setPinsByPoem] = useState<Record<string, ScenePin[]>>(() => {
    try { return JSON.parse(localStorage.getItem('shijing-ai-scene-pins') || '{}'); } catch { return {}; }
  });
  const [exportSettings, setExportSettings] = useState<ExportSettings>({ orientation: 'portrait', paper: '#f8f6ef', includeTranslation: true, includeImagery: true });
  const [exploreRound, setExploreRound] = useState(0);
  const [exploreChoice, setExploreChoice] = useState('');
  const [exploreCorrect, setExploreCorrect] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('诗意');
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadChat(samples[0].title));
  const [assistantResult, setAssistantResult] = useState<AssistantResponse | null>(null);
  const [assistantResultMode, setAssistantResultMode] = useState<AssistantMode | ''>('');
  const [integrationBusy, setIntegrationBusy] = useState('');
  const [generatedImage, setGeneratedImage] = useState('');
  const [sceneRevision, setSceneRevision] = useState(0);
  const [coCreateOpen, setCoCreateOpen] = useState(false);
  const [creativeConfig, setCreativeConfig] = useState<CreativeConfig>(() => defaultCreativeConfig(samples[0].images));
  const [versionsByPoem, setVersionsByPoem] = useState<Record<string, PaintingVersion[]>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('shijing-ai-painting-versions') || '{}') as Record<string, Array<PaintingVersion & { config?: Partial<CreativeConfig> & { mood?: unknown } }>>;
      return Object.fromEntries(Object.entries(saved).map(([key, versions]) => [key, (Array.isArray(versions) ? versions : []).map((version) => ({ ...version, config: { ...defaultCreativeConfig(), ...version.config, mood: normalizeSavedMood(version.config?.mood) } }))])) as Record<string, PaintingVersion[]>;
    } catch { return {}; }
  });
  const [notesByPoem, setNotesByPoem] = useState<Record<string, PoemNotes>>(() => {
    try { return JSON.parse(localStorage.getItem('shijing-ai-imagery-notes') || '{}'); } catch { return {}; }
  });
  const [noteTerm, setNoteTerm] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [noteIncludeInArtwork, setNoteIncludeInArtwork] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [editingNotebookNote, setEditingNotebookNote] = useState<{ poemKey: string; term: string } | null>(null);
  const [notebookDraft, setNotebookDraft] = useState('');
  const [notebookIncludeInArtwork, setNotebookIncludeInArtwork] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const terms = useMemo(() => [...new Set([...poem.images, ...vocabulary.filter((term) => poem.content.includes(term))])], [poem]);
  const verses = useMemo(() => poem.content.split('\n').flatMap((line) => line.match(/[^，。！？]+[，。！？]?/g) || []).filter(Boolean), [poem.content]);
  const poemIdentity = localPoemKey(`${poem.title}|${poem.author}|${poem.content}`);
  const paintingVersions = versionsByPoem[poemIdentity] || [];
  const poemNotes = notesByPoem[poemIdentity]?.notes || {};
  const notebookGroups = Object.entries(notesByPoem).filter(([, group]) => Object.keys(group.notes).length);
  const verseRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const scenePins = pinsByPoem[poemIdentity] || [];
  const challengeTarget = terms.length ? terms[exploreRound % terms.length] : '';
  const challengeOptions = useMemo(() => {
    if (!challengeTarget) return [];
    const decoys = vocabulary.filter((term) => !terms.includes(term));
    const offset = (exploreRound * 3) % Math.max(decoys.length, 1);
    return [challengeTarget, decoys[offset] || '朝霞', decoys[(offset + 7) % decoys.length] || '孤帆'].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [challengeTarget, exploreRound, terms]);
  const poemContext = { title: poem.title, author: poem.author, dynasty: poem.dynasty, content: poem.content, explanation: poem.explanation };
  const imageryPayload: ImageryItem[] = terms.map((term) => ({ term }));
  const analyzedEmotions = assistantResultMode === 'color' ? assistantResult?.emotions : undefined;
  const emotionScores = emotionAxes.map((label, index) => {
    const score = analyzedEmotions?.find((item) => item.label === label)?.score;
    return typeof score === 'number' && Number.isFinite(score) ? Math.max(0, Math.min(1, score > 1 ? score / 100 : score)) : [0.72, 0.62, 0.3, 0.44, 0.7][index];
  });
  const radarPoint = (index: number, scale: number) => {
    const angle = (Math.PI * 2 * index) / emotionAxes.length - Math.PI / 2;
    return `${(90 + Math.cos(angle) * 43 * scale).toFixed(1)},${(70 + Math.sin(angle) * 43 * scale).toFixed(1)}`;
  };
  const emotionPolygon = emotionScores.map((score, index) => radarPoint(index, score)).join(' ');
  const graphWasAnalyzed = assistantResultMode === 'graph' && Boolean(assistantResult);
  const graphNodes = graphWasAnalyzed
    // 保留 API 实际返回的标签；不同诗词的模型可能会用短语概括原意象，不能因逐字不等就把节点全部过滤掉。
    ? (assistantResult?.nodes || []).slice(0, 10)
    : terms.slice(0, 5).map((label, index) => ({ id: `preview-${index}`, label, kind: '意象' }));
  const graphEdges = graphWasAnalyzed ? (assistantResult?.edges || []).flatMap((edge) => {
    const source = graphNodes.find((node) => node.id === edge.source || node.label === edge.source);
    const target = graphNodes.find((node) => node.id === edge.target || node.label === edge.target);
    return source && target && source.id !== target.id ? [{ edge, source, target }] : [];
  }) : [];

  function selectTerm(term: string) {
    setSelected(term);
    setSelectedVerse(-1);
    const verseIndex = verses.findIndex((line) => line.includes(term));
    if (verseIndex >= 0) requestAnimationFrame(() => verseRefs.current[verseIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  function openImageryNote(term: string) {
    selectTerm(term);
    const saved = poemNotes[term];
    setNoteTerm(term);
    setNoteDraft(saved?.text || '');
    setNoteIncludeInArtwork(saved?.includeInArtwork || false);
  }

  function saveImageryNote() {
    if (!noteTerm) return;
    const nextNotes = { ...poemNotes };
    if (noteDraft.trim()) nextNotes[noteTerm] = { text: noteDraft.trim(), includeInArtwork: noteIncludeInArtwork, updatedAt: Date.now() };
    else delete nextNotes[noteTerm];
    const group: PoemNotes = { title: poem.title, author: poem.author, dynasty: poem.dynasty, notes: nextNotes };
    const updated = { ...notesByPoem, [poemIdentity]: group };
    if (!Object.keys(nextNotes).length) delete updated[poemIdentity];
    setNotesByPoem(updated);
    try { localStorage.setItem('shijing-ai-imagery-notes', JSON.stringify(updated)); setNotice(noteDraft.trim() ? `「${noteTerm}」的感受已保存在本机。` : `已删除「${noteTerm}」的笔记。`); }
    catch { setNotice('浏览器本地存储空间不足，笔记暂时只保留在当前页面。'); }
    setNoteTerm('');
  }

  function beginNotebookEdit(poemKey: string, term: string, note: ImageryNote) {
    setEditingNotebookNote({ poemKey, term });
    setNotebookDraft(note.text);
    setNotebookIncludeInArtwork(note.includeInArtwork);
  }

  function saveNotebookEdit() {
    if (!editingNotebookNote) return;
    const { poemKey, term } = editingNotebookNote;
    const group = notesByPoem[poemKey];
    if (!group || !notebookDraft.trim()) {
      setNotice('请先写下手记内容，再保存。');
      return;
    }
    const updated = {
      ...notesByPoem,
      [poemKey]: {
        ...group,
        notes: {
          ...group.notes,
          [term]: { text: notebookDraft.trim(), includeInArtwork: notebookIncludeInArtwork, updatedAt: Date.now() },
        },
      },
    };
    setNotesByPoem(updated);
    try {
      localStorage.setItem('shijing-ai-imagery-notes', JSON.stringify(updated));
      setNotice(`《${group.title}》中「${term}」的手记已更新。`);
    } catch {
      setNotice('浏览器本地存储空间不足，修改暂时只保留在当前页面。');
    }
    setEditingNotebookNote(null);
  }

  function deleteNotebookNote(poemKey: string, term: string) {
    const group = notesByPoem[poemKey];
    if (!group || !window.confirm(`确定删除《${group.title}》中「${term}」的手记吗？`)) return;
    const remainingNotes = { ...group.notes };
    delete remainingNotes[term];
    const updated = { ...notesByPoem };
    if (Object.keys(remainingNotes).length) updated[poemKey] = { ...group, notes: remainingNotes };
    else delete updated[poemKey];
    setNotesByPoem(updated);
    try {
      localStorage.setItem('shijing-ai-imagery-notes', JSON.stringify(updated));
      setNotice(`《${group.title}》中「${term}」的手记已删除。`);
    } catch {
      setNotice('浏览器本地存储空间不足，删除暂时只保留在当前页面。');
    }
    if (editingNotebookNote?.poemKey === poemKey && editingNotebookNote.term === term) setEditingNotebookNote(null);
  }

  function setScenePins(pins: ScenePin[]) {
    setPinsByPoem((current) => {
      const updated = { ...current, [poemIdentity]: pins };
      try { localStorage.setItem('shijing-ai-scene-pins', JSON.stringify(updated)); } catch { /* 无持久化权限时保留在当前会话 */ }
      return updated;
    });
  }

  function markScenePoint(event: React.MouseEvent<HTMLDivElement>) {
    if (!pinMode) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(3, Math.min(97, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(5, Math.min(95, ((event.clientY - bounds.top) / bounds.height) * 100));
    setScenePins([...scenePins.filter((pin) => pin.term !== selected), { term: selected, x, y }]);
    setPinMode(false);
    setNotice(`已在画面中标注「${selected}」，标注已保存在本机。`);
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chatMessages, integrationBusy]);

  useEffect(() => {
    const words = selectedEmotion ? emotionKeywords[selectedEmotion] : selectedPalette ? paletteKeywords[selectedPalette] : [];
    const index = verses.findIndex((line) => words.some((word) => line.includes(word)));
    if (index >= 0) requestAnimationFrame(() => verseRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [selectedEmotion, selectedPalette, poem.content]);

  useEffect(() => {
    let active = true;
    loadPoemCache(poemContext).then((cache) => {
      if (!active || !cache.cached) return;
      const cachedImagery = (cache.imagery || []).filter((item) => item.term);
      if (cachedImagery.length) {
        const cachedTerms = [...new Set(cachedImagery.map((item) => item.term))];
        setPoem((current) => current.title === poem.title && current.content === poem.content ? { ...current, images: cachedTerms } : current);
        setSelected(cachedTerms[0]);
      }
      if (cache.imageUrl) {
        setGeneratedImage(cache.imageUrl); setSceneRevision((revision) => revision + 1);
        setVersionsByPoem((current) => {
          if (current[poemIdentity]?.length) return current;
          const legacy: PaintingVersion = { id: `legacy-${Date.now()}`, imageUrl: cache.imageUrl!, config: defaultCreativeConfig(cachedImagery.map((item) => item.term)), createdAt: Date.now(), legacy: true };
          const updated = { ...current, [poemIdentity]: [legacy] };
          try { localStorage.setItem('shijing-ai-painting-versions', JSON.stringify(updated)); } catch { /* 本机会话仍可查看 */ }
          return updated;
        });
      }
      setNotice(`已从本地记忆恢复《${poem.title}》${[cachedImagery.length ? '意象' : '', cache.imageUrl ? '画面' : ''].filter(Boolean).join('和')}，无需重新调用生成 API。`);
    }).catch(() => { /* 缓存不可用时仍可正常使用诗词与 API */ });
    return () => { active = false; };
  }, [poem.title, poem.author, poem.dynasty, poem.content]);

  useEffect(() => {
    try { localStorage.setItem('shijing-ai-painting-versions', JSON.stringify(versionsByPoem)); } catch { /* 图片过多时保留当前会话；诗词数据库仍保存最近画面 */ }
  }, [versionsByPoem]);

  async function extractPoemImagery() {
    setIntegrationBusy('imagery');
    try {
      const data = await extractImagery(poemContext);
      const extracted = (data.imagery || []).filter((item) => item.term);
      if (!extracted.length) throw new Error('意象提取接口没有返回 imagery 列表');
      setPoem({ ...poem, images: [...new Set(extracted.map((item) => item.term))] });
      setSelected(extracted[0].term);
      try { await savePoemCache(poemContext, { imagery: extracted }); setNotice(`已提取并记住 ${extracted.length} 个意象，下次打开这首诗将直接恢复。`); }
      catch { setNotice(`已提取 ${extracted.length} 个意象，但本次缓存未能保存。`); }
    } catch (error) { setNotice((error as Error).message); }
    finally { setIntegrationBusy(''); }
  }

  async function generateImage(config = creativeConfig) {
    setIntegrationBusy('image');
    setNotice(`正在按「${config.mood.join('、')}·${config.aspectRatio}」方案为《${poem.title}》绘制国画…`);
    try {
      const prompt = buildCreativePrompt(poemContext, terms, config);
      const data = await generatePoemImage(poemContext, imageryPayload, config.style, prompt);
      if (!data.imageUrl) throw new Error('图像生成接口响应缺少 imageUrl');
      setSceneRevision((revision) => revision + 1);
      setGeneratedImage(data.imageUrl);
      const version: PaintingVersion = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, imageUrl: data.imageUrl, config: { ...config, subjectImagery: [...config.subjectImagery] }, createdAt: Date.now() };
      try {
        const saved = await savePoemCache(poemContext, { imageUrl: data.imageUrl, imageStyle: 'ink-painting-v1' });
        if (saved.imageUrl) { setGeneratedImage(saved.imageUrl); version.imageUrl = saved.imageUrl; }
        setNotice(`《${poem.title}》的画面已生成并记入本地记忆。`);
      } catch { setNotice(`《${poem.title}》的画面已生成，但本地缓存保存失败；图片链接可能会过期。`); }
      setVersionsByPoem((current) => ({ ...current, [poemIdentity]: [...(current[poemIdentity] || []), version].slice(-6) }));
    } catch (error) { setNotice((error as Error).message); }
    finally { setIntegrationBusy(''); }
  }

  function usePaintingVersion(version: PaintingVersion) {
    setGeneratedImage(version.imageUrl);
    if (!version.legacy) setCreativeConfig(version.config);
    setSceneRevision((revision) => revision + 1);
    setNotice(version.legacy ? '已切换到历史画作（原始创作参数未保存）。' : '已切换到所选画作版本及其创作参数。');
  }

  async function runAssistant(mode: AssistantMode, userQuestion?: string) {
    setIntegrationBusy(mode);
    try {
      const data = await askPoetryAssistant(mode, poemContext, imageryPayload, userQuestion);
      setAssistantResult(data); setAssistantResultMode(mode);
      setNotice(`${mode === 'graph' ? '意象图谱' : mode === 'qa' ? '诗词问答' : '色彩分析'}接口已返回结果。`);
    } catch (error) { setNotice((error as Error).message); }
    finally { setIntegrationBusy(''); }
  }

  async function sendQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentQuestion = question.trim();
    if (!currentQuestion || integrationBusy === 'qa') return;
    const history = chatMessages.map(({ role, content }) => ({ role, content }));
    const userTurn: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: currentQuestion };
    const userMessages = [...chatMessages, userTurn];
    setChatMessages(userMessages);
    saveChat(poem.title, userMessages);
    setQuestion('');
    setIntegrationBusy('qa');
    try {
      const data = await askPoetryAssistant('qa', poemContext, imageryPayload, currentQuestion, history.slice(-12));
      const answer = data.answer || '接口已响应，但没有返回 answer 字段。';
      const completeMessages = [...userMessages, { id: `assistant-${Date.now()}`, role: 'assistant' as const, content: answer }];
      setChatMessages(completeMessages);
      saveChat(poem.title, completeMessages);
    } catch (error) {
      const completeMessages = [...userMessages, { id: `error-${Date.now()}`, role: 'assistant' as const, content: `这次没有收到回复：${(error as Error).message}` }];
      setChatMessages(completeMessages);
      saveChat(poem.title, completeMessages);
    } finally { setIntegrationBusy(''); }
  }

  async function generateTranslation() {
    setIntegrationBusy('translation');
    try {
      const data = await askPoetryAssistant('qa', poemContext, imageryPayload, `请把下面这首诗按原诗每个分句的顺序逐句译成现代汉语。原诗共 ${verses.length} 句，请返回恰好 ${verses.length} 条译文。只返回合法 JSON，不要 Markdown，格式为 {"translations":["第一句译文","第二句译文"]}。`);
      const translated = (data as AssistantResponse & { translations?: string[] }).translations;
      if (!Array.isArray(translated) || !translated.some((line) => line.trim())) throw new Error('模型没有返回 translations 译文列表，请重试。');
      setPoem((current) => ({ ...current, translation: translated }));
      setNotice(`已生成《${poem.title}》逐句译文。`);
    } catch (error) { setNotice((error as Error).message); }
    finally { setIntegrationBusy(''); }
  }

  async function search() {
    if (!query.trim()) return;
    setBusy(true); setNotice('正在诗泉中检索…');
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${searchType}`);
      if (!response.ok) throw new Error('诗泉服务暂不可用');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '诗泉服务暂不可用');
      const rawItems = Array.isArray(result) ? result : result.results || result.data?.items || result.data?.poems || result.data || result.poems || result.items || [];
      const items = (Array.isArray(rawItems) ? rawItems : []).map((item: any) => {
        const content = Array.isArray(item.content) ? item.content.join('\n') : item.content || item.paragraphs?.join('\n') || '';
        const rawTranslation = item.translation || item.translations;
        const translation = Array.isArray(rawTranslation) ? rawTranslation.map((line: any) => typeof line === 'string' ? line : line.translation || line.text || '').filter(Boolean) : typeof rawTranslation === 'string' ? rawTranslation.split('\n').filter(Boolean) : undefined;
        return { id: item.id, title: item.title || '诗词', author: item.author?.name || item.author || '作者待考', dynasty: item.dynasty?.name || item.dynasty || '朝代待考', genre: item.type?.name || item.type || '', content, explanation: '诗泉提供了诗词原文。释义可在“编辑”中补充校订。', translation, images: vocabulary.filter((term) => content.includes(term)) } as Poem;
      }).filter((item: Poem) => item.content);
      if (!items.length) throw new Error('没有找到匹配诗词');
      setSearchResults(items); setNotice(`找到 ${items.length} 首诗词，请从结果中选择。`);
    } catch (error) { setNotice(`${(error as Error).message}。本地示例仍可正常使用。`); }
    finally { setBusy(false); }
  }

  async function exportArtworkCard() {
    if (!generatedImage) { setNotice('请先点击「生成水墨画」，再导出包含画面的作品卡。'); return; }
    if (exportSettings.includeTranslation && (!poem.translation?.length || poem.translation.length < verses.length)) {
      setNotice('请先在「诗意」版块点击「AI 生成完整译文」，补齐逐句译文后再导出。');
      setTab('诗意');
      return;
    }
    try {
      await document.fonts.ready;
      const isLandscape = exportSettings.orientation === 'landscape';
      const width = isLandscape ? 1600 : 1200, margin = isLandscape ? 72 : 82, contentWidth = width - margin * 2;
      const imageW = isLandscape ? Math.round(contentWidth * 0.55) : contentWidth;
      const textX = isLandscape ? margin + imageW + 48 : margin;
      const textWidth = isLandscape ? width - margin - textX : contentWidth;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('浏览器无法创建图片画布');
      const fontFamily = '"Noto Serif SC", "Songti SC", "SimSun", serif';
      const wrap = (text: string, maxWidth: number) => {
        const rows: string[] = []; let row = '';
        for (const char of text) {
          const next = row + char;
          if (row && ctx.measureText(next).width > maxWidth) { rows.push(row); row = char; } else row = next;
        }
        if (row) rows.push(row);
        return rows;
      };
      const pairs = verses.map((verse, index) => {
        ctx.font = `30px ${fontFamily}`; const original = wrap(verse, textWidth - 42);
        ctx.font = `21px ${fontFamily}`; const translated = exportSettings.includeTranslation ? wrap(poem.translation?.[index] || '', textWidth - 42) : [];
        return { original, translated, height: original.length * 44 + translated.length * 34 + 24 };
      });
      const chips = exportSettings.includeImagery ? terms.filter(Boolean) : [];
      const includedNotes = Object.entries(poemNotes).filter(([, note]) => note.includeInArtwork && note.text.trim()).map(([term, note]) => {
        ctx.font = `19px ${fontFamily}`;
        return { term, lines: wrap(note.text, textWidth - 90) };
      });
      const notesHeight = includedNotes.length ? 60 + includedNotes.reduce((sum, note) => sum + 30 + note.lines.length * 30, 0) : 0;
      ctx.font = `19px ${fontFamily}`;
      let chipRows = 1, chipX = textX;
      const chipMaxX = width - margin;
      for (const term of chips) {
        const chipWidth = ctx.measureText(term).width + 38;
        if (chipX + chipWidth > chipMaxX) { chipRows++; chipX = textX; }
        chipX += chipWidth + 12;
      }
      const picture = new Image();
      picture.src = generatedImage;
      await picture.decode();
      // 作品卡使用原图比例完整呈现；固定横幅比例会裁掉方图/竖图的上下内容。
      const imageY = 96;
      const naturalImageHeight = imageW * picture.naturalHeight / picture.naturalWidth;
      const imageHeight = isLandscape ? Math.min(760, naturalImageHeight) : naturalImageHeight;
      const imageDrawW = Math.min(imageW, imageHeight * picture.naturalWidth / picture.naturalHeight);
      const imageDrawH = imageDrawW * picture.naturalHeight / picture.naturalWidth;
      const imageDrawX = margin + (imageW - imageDrawW) / 2;
      const imageDrawY = imageY + (imageHeight - imageDrawH) / 2;
      const rowsHeight = pairs.reduce((sum, pair) => sum + pair.height + 8, 0);
      // 根据实际诗句换行数和意象标签行数计算画布高度，避免长诗被画布底边裁掉。
      // 这与下方绘制时的 y 游标保持同一套间距，并额外预留页脚空间。
      const contentStartY = isLandscape ? imageY + 246 : imageY + imageHeight + 78 + 43 + 54 + 30 + 28;
      const imageryStartY = contentStartY + rowsHeight + 26 + 24;
      const portraitHeight = imageryStartY + Math.max(chipRows, 1) * 52 + 120 + notesHeight;
      const landscapeHeight = Math.max(imageY + imageHeight, contentStartY + rowsHeight + (chips.length ? 70 + chipRows * 52 : 0) + notesHeight) + 130;
      const height = isLandscape ? Math.max(1100, landscapeHeight) : Math.max(1500, portraitHeight);
      canvas.width = width; canvas.height = height;
      ctx.fillStyle = exportSettings.paper; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#e5dfd2'; ctx.lineWidth = 2; ctx.strokeRect(28, 28, width - 56, height - 56);
      ctx.fillStyle = '#8479bb'; ctx.font = `18px Arial, ${fontFamily}`; ctx.textAlign = 'left';
      ctx.fillText('SHIJING · POETRY IN A PAINTING', margin, 68);

      ctx.save(); ctx.beginPath(); ctx.roundRect(margin, imageY, imageW, imageHeight, 12); ctx.clip();
      ctx.drawImage(picture, imageDrawX, imageDrawY, imageDrawW, imageDrawH); ctx.restore();

      let y: number;
      if (isLandscape) {
        ctx.textAlign = 'left'; ctx.fillStyle = '#292b30'; ctx.font = `48px ${fontFamily}`; ctx.fillText(`《${poem.title}》`, textX, imageY + 54);
        ctx.fillStyle = '#827d87'; ctx.font = `22px ${fontFamily}`; ctx.fillText(`${poem.dynasty} · ${poem.author}`, textX, imageY + 91);
        ctx.fillStyle = '#7468b5'; ctx.font = `21px ${fontFamily}`; ctx.fillText(exportSettings.includeTranslation ? '原文 · 逐句译文' : '诗词原文', textX, imageY + 150);
        y = imageY + 180; ctx.strokeStyle = '#e8e4ed'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(textX, y); ctx.lineTo(width - margin, y); ctx.stroke(); y += 30;
      } else {
        y = imageY + imageHeight + 78;
        ctx.textAlign = 'center'; ctx.fillStyle = '#292b30'; ctx.font = `48px ${fontFamily}`; ctx.fillText(`《${poem.title}》`, width / 2, y);
        y += 43; ctx.fillStyle = '#827d87'; ctx.font = `22px ${fontFamily}`; ctx.fillText(`${poem.dynasty} · ${poem.author}`, width / 2, y);
        y += 54; ctx.textAlign = 'left'; ctx.fillStyle = '#7468b5'; ctx.font = `21px ${fontFamily}`; ctx.fillText(exportSettings.includeTranslation ? '原文 · 逐句译文' : '诗词原文', margin, y);
        y += 30; ctx.strokeStyle = '#e8e4ed'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(width - margin, y); ctx.stroke(); y += 28;
      }
      pairs.forEach((pair, index) => {
        ctx.fillStyle = '#aaa3c4'; ctx.font = `17px Arial, ${fontFamily}`; ctx.textAlign = 'left'; ctx.fillText(String(index + 1).padStart(2, '0'), textX, y + 26);
        ctx.fillStyle = '#303138'; ctx.font = `30px ${fontFamily}`;
        pair.original.forEach((line, row) => ctx.fillText(line, textX + 42, y + 30 + row * 44));
        ctx.fillStyle = '#797983'; ctx.font = `21px ${fontFamily}`;
        pair.translated.forEach((line, row) => ctx.fillText(line, textX + 42, y + 30 + pair.original.length * 44 + row * 34));
        y += pair.height + 8;
      });
      if (chips.length) {
        y += 26; ctx.fillStyle = '#7468b5'; ctx.font = `21px ${fontFamily}`; ctx.fillText('诗中意象', textX, y);
        y += 24; let x = textX;
        ctx.font = `19px ${fontFamily}`;
        for (const term of chips) {
          const labelWidth = ctx.measureText(term).width, chipWidth = labelWidth + 38;
          if (x + chipWidth > width - margin) { x = textX; y += 52; }
          ctx.fillStyle = '#efedf8'; ctx.beginPath(); ctx.roundRect(x, y, chipWidth, 38, 18); ctx.fill();
          ctx.fillStyle = '#645b97'; ctx.fillText(term, x + 19, y + 25); x += chipWidth + 12;
        }
        y += chipRows * 52;
      }
      if (includedNotes.length) {
        y += 24; ctx.fillStyle = '#7468b5'; ctx.font = `21px ${fontFamily}`; ctx.fillText('意象手记', textX, y);
        y += 24;
        for (const note of includedNotes) {
          ctx.fillStyle = '#897759'; ctx.font = `19px ${fontFamily}`; ctx.fillText(`「${note.term}」`, textX, y + 20);
          ctx.fillStyle = '#625f58'; ctx.font = `19px ${fontFamily}`;
          note.lines.forEach((line, row) => ctx.fillText(line, textX + 78, y + 20 + row * 30));
          y += Math.max(30, note.lines.length * 30) + 10;
        }
      }
      ctx.textAlign = 'right'; ctx.fillStyle = '#aaa5b3'; ctx.font = `16px ${fontFamily}`;
      ctx.fillText('诗境·AI　以诗为引，以画作答', width - margin, height - 54);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('作品图片导出失败')), 'image/png'));
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `诗境作品卡-${poem.title}.png`; link.click(); URL.revokeObjectURL(url);
      setNotice(`《${poem.title}》作品卡已导出为 PNG 图片。`);
    } catch (error) { setNotice(`作品卡导出失败：${(error as Error).message}`); }
  }

  async function saveWork() {
    try {
      const response = await fetch('/api/works', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...poem, images: terms }) });
      setNotice(response.ok ? '作品已保存到本地数据库。' : '数据库暂不可用，可使用“导出作品”保存。');
    } catch { setNotice('数据库暂不可用，可使用“导出作品”保存。'); }
  }

  function resetPoemInteractions() { setSelectedVerse(-1); setSelectedEmotion(''); setSelectedPalette(''); setExploreChoice(''); setExploreCorrect(null); setExploreRound(0); setPinMode(false); }
  function chooseSample(item: Poem) { resetPoemInteractions(); setPoem(item); setCreativeConfig(defaultCreativeConfig(item.images)); setGeneratedImage(''); setSelected(item.images[0]); setChatMessages(loadChat(item.title)); setAssistantResult(null); setAssistantResultMode(''); setNotice(`已载入《${item.title}》本地示例。`); }
  function chooseSearchResult(item: Poem) { resetPoemInteractions(); setPoem(item); setCreativeConfig(defaultCreativeConfig(item.images)); setGeneratedImage(''); setSelected(item.images[0] || '诗词'); setChatMessages(loadChat(item.title)); setAssistantResult(null); setAssistantResultMode(''); setSearchResults([]); setNotice(`已载入《${item.title}》· ${item.dynasty} ${item.author}。释义可编辑补充。`); }

  if (!hasEntered) return <PoetryEntry onEnter={() => setHasEntered(true)} />;

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top"><span className="brand-mark">诗</span><span>诗境<span className="brand-ai">·AI</span><small>POETRY IN A PAINTING</small></span></a>
      <div className="top-title"><span className="status-dot" />诗画交互工作台</div>
      <div className="top-actions"><button onClick={saveWork}>保存作品</button><button className="export-button" onClick={exportArtworkCard}>导出作品卡 PNG ↗</button></div>
    </header>

    <main id="top" className="workspace">
      <aside className="symbol-rail">
        <div className="rail-title">意象 <span className="imagery-count">{terms.length.toString().padStart(2, '0')}</span><br/><span>SYMBOLS · 点击词条浮现轮廓</span></div>
        <div className="symbol-items">{terms.length ? terms.map((term, index) => <button key={term} className={`symbol-item ${selected === term ? 'selected' : ''} ${poemNotes[term] ? 'has-note' : ''}`} onClick={() => openImageryNote(term)} title={`点击「${term}」定位诗句并写下感受`}><span className="symbol-index">{String(index + 1).padStart(2, '0')}</span><span className="symbol-label">{term}</span><span className="symbol-kind">{poemNotes[term] ? '已有手记' : ({ mountain: '山峦', moon: '天象', bird: '飞禽', tree: '草木', boat: '舟船', flower: '花木', window: '楼阁', water: '水流', snow: '冰雪', rain: '风雨', cloud: '烟云', sky: '天空', person: '人物', stone: '意象' } as Record<string, string>)[imageryKind(term)]}</span></button>) : <div className="symbol-empty"><span className="empty-seal">意</span><span>这首诗还没有意象</span><button onClick={extractPoemImagery} disabled={integrationBusy === 'imagery'}>{integrationBusy === 'imagery' ? '提取中…' : '提取诗中意象'}</button></div>}</div>
        <button className="notebook-open" onClick={() => setNotebookOpen(true)}><span>▤</span><span><strong>我的意象手记</strong><small>{notebookGroups.reduce((sum, [, group]) => sum + Object.keys(group.notes).length, 0)} 条 · 按诗分类</small></span><b>↗</b></button>
        <div className="rail-foot">点击意象可记录诗中感受<br/>笔记保存在本机浏览器</div>
      </aside>

      <section className="art-column" aria-label="诗意画境">
        <div className="art-heading"><div><span>01 / POETRY VISUALIZATION</span><h1>诗意画境</h1><small className="art-subtitle">彩墨入诗 · 笔意随心</small></div><div className="art-heading-actions"><button className="co-open-button" onClick={() => setCoCreateOpen(true)}>✦ 诗画共创</button><button className="generate-scene-button" title={`使用已配置的图像 API 为《${poem.title}》绘制彩墨国画`} onClick={() => generateImage()} disabled={integrationBusy === 'image'}>{integrationBusy === 'image' ? '正在绘制…' : '生成水墨画'}</button></div></div>
        <div className="art-frame">
          <div className="frame-topline"><span>诗境图卷 · {poem.dynasty}</span><span>写意彩墨　／　诗画相生</span></div>
          <div key={`${poemIdentity}-${sceneRevision}`} className={`landscape ${generatedImage ? 'has-generated ink-reveal' : ''} ${pinMode ? 'pin-mode' : ''} ${integrationBusy === 'image' ? 'painting-pending' : ''}`} data-motif={selected} onClick={markScenePoint}>
            {generatedImage && <img className="generated-art" src={generatedImage} alt={`《${poem.title}》的彩墨国画`} />}
            <div className="sky-wash"/><div className="sun-disc"/><div className="mountain-shape distant-mountain"/><div className="mountain-shape middle-mountain"/><div className="mountain-shape near-mountain"/><div className="mist-band mist-one"/><div className="mist-band mist-two"/><div className="pine-grove"><i/><i/><i/><i/></div><div className="river-wash"/><div className="painting-stamp">诗境<br/>AI</div>
            {!generatedImage && selected && terms.includes(selected) && <ImageryContour term={selected}/>}
            {scenePins.map((pin) => <button key={pin.term} className={`scene-pin ${pin.term === selected ? 'active' : ''}`} style={{ left: `${pin.x}%`, top: `${pin.y}%` }} onClick={(event) => { event.stopPropagation(); selectTerm(pin.term); }} title={`画中意象：${pin.term}`}><span className="pin-bead"/><strong>{pin.term}</strong></button>)}
            {pinMode && <div className="pin-instruction">点击画面，为「{selected}」落下标注</div>}
            {integrationBusy === 'image' && <div className="ink-loading"><span/><span/><span/>正在绘制彩墨画卷</div>}
            <div className="art-caption"><span>此景取自</span><strong>《{poem.title}》</strong><span>· {poem.author}</span></div>
          </div>
          <div className="frame-bottomline"><span>墨分五色　·　留白生境</span><span>意象：{selected}</span></div>
        </div>
        <div className="art-footer"><span>{pinMode ? `正在标注「${selected}」` : generatedImage ? '彩墨画境已入卷' : '点击「生成水墨画」绘制诗意国画'}</span><div className="art-footer-actions"><button disabled={!terms.includes(selected)} className={pinMode ? 'active' : ''} onClick={() => { setPinMode(!pinMode); setNotice(pinMode ? '已退出画面标注。' : `请在画面中点击「${selected}」所在位置。`); }}>{pinMode ? '取消标注' : '＋ 标注意象'}</button><button disabled={!scenePins.length} onClick={() => setScenePins([])}>清除标注</button><button onClick={() => setTab('图谱')}>查看意象关系 <span>↗</span></button></div></div>
      </section>

      <section className="poem-column" aria-label="诗词展示">
        <div className="poem-card">
          <div className="card-index">A</div><div className="poem-kicker">POETRY SHOWCASE</div>
          <div className="poem-controls"><select aria-label="搜索范围" value={searchType} onChange={(e) => setSearchType(e.target.value as SearchType)}><option value="all">全文</option><option value="title">诗题</option><option value="content">正文</option><option value="author">作者</option></select><input aria-label="搜索诗词" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="输入关键词检索诗词"/><button onClick={search} disabled={busy}>{busy ? '…' : '⌕'}</button></div>
          <div className="api-credit">诗泉古诗词 API　·　全文／诗题／作者检索</div>
          {searchResults.length > 0 && <div className="search-results"><div className="results-heading">诗泉检索结果 <span>{searchResults.length} 首</span><button onClick={() => setSearchResults([])} aria-label="关闭搜索结果">×</button></div>{searchResults.map((item, index) => <button key={item.id ?? `${item.title}-${index}`} className="result-item" onClick={() => chooseSearchResult(item)}><span><strong>{item.title}</strong><small>{item.dynasty} · {item.author}{item.genre ? ` · ${item.genre}` : ''}</small></span><span className="result-preview">{item.content.replace(/\n/g, '　')}</span></button>)}</div>}
          <div className="sample-select">{samples.map((item) => <button key={item.title} className={poem.title === item.title ? 'chosen' : ''} onClick={() => chooseSample(item)}>{item.title}</button>)}</div>
          {editing ? <input className="title-edit" value={poem.title} onChange={(e) => setPoem({ ...poem, title: e.target.value })} /> : <h2>《{poem.title}》</h2>}
          <p className="poem-author">{poem.dynasty} · {poem.author}</p>
          {editing && <input className="author-edit" value={poem.author} onChange={(e) => setPoem({ ...poem, author: e.target.value })} placeholder="作者"/>}
          <div className="poem-lines">{verses.map((line, index) => { const emotionWords = selectedEmotion ? emotionKeywords[selectedEmotion] : selectedPalette ? paletteKeywords[selectedPalette] : []; const isEmotionMatch = emotionWords.some((word) => line.includes(word)); const lineTerms = terms.filter((term) => line.includes(term)); return <div className="verse-entry" key={`${line}-${index}`}><p ref={(node) => { verseRefs.current[index] = node; }} className={`${line.includes(selected) ? 'line-active' : ''} ${selectedVerse === index ? 'verse-open' : ''} ${isEmotionMatch ? 'emotion-match' : ''}`} onClick={() => setSelectedVerse(selectedVerse === index ? -1 : index)}>{highlight(line, terms, selected, selectTerm, emotionWords)}</p>{selectedVerse === index && <div className="verse-detail"><strong>逐句细读</strong><span>{poem.translation?.[index] || '这句尚无逐句译文，可在右侧「诗意」面板生成完整译文。'}</span>{lineTerms.length > 0 && <small>相关意象：{lineTerms.join(' · ')}</small>}</div>}</div>; })}</div>
          <div className="meaning-box"><div className="meaning-title"><span>诗词释义</span><button onClick={() => setEditing(!editing)}>{editing ? '完成' : '编辑'}</button></div>{editing ? <textarea value={poem.explanation} onChange={(e) => setPoem({ ...poem, explanation: e.target.value })}/> : <p>{poem.explanation}</p>}</div>
          <button className="mark-button" onClick={extractPoemImagery} disabled={integrationBusy === 'imagery'}>{integrationBusy === 'imagery' ? '提取中…' : '✳　AI 提取意象'}</button>
        </div>
        <nav className="bottom-tabs" aria-label="诗词面板导航">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav>
      </section>

      <aside className={`insight-rail ${tab === '问答' ? 'qa-active' : ''}`}>
        <div className="insight-head"><span>POEM STUDIO</span><span className="online-dot">● 在线</span></div>
        <div className="side-tabs">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>
        {tab === '图谱' && <section className="insight-card graph-card"><div className="card-heading"><span className="panel-number">C.2</span><h3>意象关系</h3></div><div className="graph-view"><div className="graph-canvas"><svg viewBox="0 0 280 240" role="img" aria-label="诗中意象关系图"><defs><marker id="graph-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7Z"/></marker></defs>{graphEdges.map(({ edge, source, target }, index) => { const from = graphPosition(graphNodes.indexOf(source), graphNodes.length); const to = graphPosition(graphNodes.indexOf(target), graphNodes.length); const active = matchImageryTerm(source.label, terms) === selected || matchImageryTerm(target.label, terms) === selected; return <g key={`${edge.source}-${edge.target}-${index}`} className={`graph-edge ${active ? 'active' : ''}`}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd="url(#graph-arrow)"/></g>; })}</svg>{graphNodes.map((node, index) => { const point = graphPosition(index, graphNodes.length); const matchedTerm = matchImageryTerm(node.label, terms); return <button key={node.id} className={`graph-node ${selected === node.label || (matchedTerm && selected === matchedTerm) ? 'active' : ''}`} style={{ left: `${(point.x / 280) * 100}%`, top: `${(point.y / 240) * 100}%` }} onClick={() => selectTerm(matchedTerm || node.label)} title={`点击定位「${node.label}」的诗句与画面`}>{node.label}</button>; })}</div></div><p className="graph-status">{!graphWasAnalyzed ? '当前仅显示意象，点击分析后生成关系线' : !graphNodes.length ? 'API 没有返回意象节点，请重试分析' : graphEdges.length ? `找到 ${graphEdges.length} 条有诗句依据的意象关系` : '已显示 API 返回节点，但没有可连接的明确关系'}</p>{graphEdges.length > 0 && <div className="graph-relations">{graphEdges.map(({ edge, source, target }, index) => <div className="graph-relation" key={`${edge.source}-${edge.target}-detail-${index}`}><strong>{source.label} <span>—{edge.relation || '相关'}→</span> {target.label}</strong>{edge.evidence && <small>原句依据：「{edge.evidence}」</small>}</div>)}</div>}<div className="graph-legend">点击节点可定位对应诗句，关系线随所选意象高亮</div><button className="panel-button" disabled={integrationBusy === 'graph'} onClick={() => runAssistant('graph')}>{integrationBusy === 'graph' ? '分析中…' : graphWasAnalyzed ? '重新分析意象关系' : '调用 API 分析意象关系'}</button></section>}
        {tab === '问答' && <section className="insight-card qa-card"><div className="card-heading"><span className="panel-number">C.3</span><h3>诗词问答</h3></div><div className="chat-body" aria-live="polite">{chatMessages.map((message) => <p key={message.id} className={message.role === 'user' ? 'user-question' : 'assistant-reply'}>{message.content}</p>)}{integrationBusy === 'qa' && <p className="assistant-reply typing-reply">正在思考…</p>}<div ref={chatEndRef}/></div><div className="prompt-chips"><button type="button" onClick={() => setQuestion('这首诗描写了怎样的画面？')}>画面</button><button type="button" onClick={() => setQuestion('诗中意象有什么寓意？')}>意象</button><button type="button" onClick={() => setQuestion('请解释这首诗。')}>释义</button></div><form className="question-form" onSubmit={sendQuestion}><input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="输入你的问题…" aria-label="输入你的问题"/><button type="submit" aria-label="发送问题" disabled={integrationBusy === 'qa' || !question.trim()}>↑</button></form></section>}
        {tab === '色彩' && <section className="insight-card color-card"><div className="card-heading"><span className="panel-number">C.4</span><h3>诗境色彩</h3></div><div className="color-wheel"><div className="wheel-center">墨<br/>韵</div></div><div className="palette">{paletteChoices.map(({ label, color }, index) => <button key={label} type="button" className={selectedPalette === label ? 'chosen' : ''} style={{ backgroundColor: assistantResultMode === 'color' ? assistantResult?.palette?.[index] || color : color }} onClick={() => { setSelectedPalette(selectedPalette === label ? '' : label); setSelectedEmotion(''); }} aria-label={`以${label}标记诗句`} title={`${label} · 点击关联诗句`}/>)}</div><p className="palette-caption">{selectedPalette ? `已选「${selectedPalette}」色意，诗句中的相关字词已标出` : '点击色彩，查看它与诗句的呼应'}</p><div className="emotion-title">情绪意境</div><div className="emotion-chart"><svg viewBox="0 0 180 142" role="img" aria-label="诗词情绪意境雷达图">{[1, 2 / 3, 1 / 3].map((scale) => <polygon key={scale} className="radar-grid" points={emotionAxes.map((_, index) => radarPoint(index, scale)).join(' ')}/>)}{emotionAxes.map((label, index) => <line key={`axis-${label}`} className="radar-axis" x1="90" y1="70" x2={radarPoint(index, 1).split(',')[0]} y2={radarPoint(index, 1).split(',')[1]}/>)}<polygon className="radar-value" points={emotionPolygon}/>{emotionAxes.map((label, index) => { const [x, y] = radarPoint(index, 1.35).split(',').map(Number); return <text key={label} role="button" tabIndex={0} className={`radar-label ${selectedEmotion === label ? 'chosen' : ''}`} onClick={() => { setSelectedEmotion(selectedEmotion === label ? '' : label); setSelectedPalette(''); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedEmotion(selectedEmotion === label ? '' : label); }} x={x} y={y} textAnchor={x < 75 ? 'end' : x > 105 ? 'start' : 'middle'}>{label}</text>; })}</svg></div><p className="emotion-caption">{selectedEmotion ? `「${selectedEmotion}」相关诗句已标出` : assistantResultMode === 'color' && analyzedEmotions?.length ? 'API 分析结果 · 点击情绪查看诗句依据' : '点击情绪维度，可查看诗句依据'}</p><button className="panel-button" disabled={integrationBusy === 'color'} onClick={() => runAssistant('color')}>{integrationBusy === 'color' ? '分析中…' : 'API 分析色彩与情绪'}</button></section>}
        {tab === '诗意' && <section className="insight-card intro-card"><div className="card-heading"><span className="panel-number">C.1</span><h3>诗意 · 原文与译文</h3></div><p className="poetry-note">《{poem.title}》 · {poem.dynasty} {poem.author}</p><div className="verse-translation">{verses.map((verse, index) => <div className="translation-pair" key={`${verse}-${index}`}><p className="original-verse">{verse}</p>{poem.translation?.[index] && <p className="translated-verse">{poem.translation[index]}</p>}</div>)}{(!poem.translation || !poem.translation.length) && <p className="translation-empty">这首诗尚无逐句译文，可使用下方按钮生成。</p>}</div>{(!poem.translation || poem.translation.length < verses.length) && <button className="panel-button translation-action" onClick={generateTranslation} disabled={integrationBusy === 'translation'}>{integrationBusy === 'translation' ? '正在逐句翻译…' : 'AI 生成完整译文'}</button>}<div className="selected-insight"><span>当前意象</span><strong>{selected || '点击左侧意象'}</strong><small>点击诗句或左侧意象，可同步查看画面标记</small></div><button className="panel-button" onClick={() => setTab('图谱')}>探索意象关系　↗</button></section>}
        {tab === '探索' && <section className="insight-card explore-card"><div className="card-heading"><span className="panel-number">C.5</span><h3>诗中寻意</h3></div><p className="explore-kicker">POETRY QUEST · 第 {exploreRound + 1} 题</p>{challengeTarget ? <><p className="explore-question">《{poem.title}》中出现了哪个意象？</p><div className="explore-options">{challengeOptions.map((option) => <button key={option} className={`${exploreChoice === option ? 'chosen' : ''} ${exploreChoice === option && exploreCorrect ? 'correct' : ''} ${exploreChoice === option && exploreCorrect === false ? 'incorrect' : ''}`} disabled={exploreChoice !== ''} onClick={() => { setExploreChoice(option); setExploreCorrect(option === challengeTarget); if (option === challengeTarget) selectTerm(option); }}>{option}</button>)}</div>{exploreCorrect !== null && <div className={`explore-feedback ${exploreCorrect ? 'correct' : 'incorrect'}`}><strong>{exploreCorrect ? '答对了 · 意象入诗' : `再读一遍 · 正确意象是「${challengeTarget}」`}</strong><span>{verses.find((line) => line.includes(challengeTarget)) || `《${poem.title}》原文中包含「${challengeTarget}」。`}</span><small>{poem.translation?.[verses.findIndex((line) => line.includes(challengeTarget))] || '点击意象词，可在诗句与意象栏之间继续探索。'}</small></div>}<button className="panel-button explore-next" onClick={() => { setExploreRound((round) => round + 1); setExploreChoice(''); setExploreCorrect(null); }}>换一道诗句</button></> : <div className="translation-empty">先提取这首诗的意象，再开始探索。</div>}<p className="explore-local-note">本地诗句互动，不调用 API。</p></section>}
        <section className="export-settings"><div className="export-settings-title"><strong>作品卡版式</strong><span>导出前设置</span></div><div className="export-setting-row"><span>画幅</span><div className="setting-segment"><button className={exportSettings.orientation === 'portrait' ? 'active' : ''} onClick={() => setExportSettings({ ...exportSettings, orientation: 'portrait' })}>竖幅</button><button className={exportSettings.orientation === 'landscape' ? 'active' : ''} onClick={() => setExportSettings({ ...exportSettings, orientation: 'landscape' })}>横幅</button></div></div><div className="export-setting-row"><span>纸色</span><select value={exportSettings.paper} onChange={(event) => setExportSettings({ ...exportSettings, paper: event.target.value })}><option value="#f8f6ef">宣纸白</option><option value="#f2ead8">古纸黄</option><option value="#e9efed">青灰笺</option></select></div><div className="export-setting-row export-checks"><label><input type="checkbox" checked={exportSettings.includeTranslation} onChange={(event) => setExportSettings({ ...exportSettings, includeTranslation: event.target.checked })}/>逐句译文</label><label><input type="checkbox" checked={exportSettings.includeImagery} onChange={(event) => setExportSettings({ ...exportSettings, includeImagery: event.target.checked })}/>诗中意象</label></div></section>
        <section className="data-card work-card"><div className="work-card-thumb">{generatedImage ? <img src={generatedImage} alt="作品画面缩略图"/> : <span>诗</span>}</div><div className="work-card-info"><span>作品卡片</span><strong title={poem.title}>《{poem.title}》</strong><small>{poem.dynasty} · {poem.author}　意象 {terms.length} 个</small></div><button onClick={saveWork}>保存</button><button className="download-mini" onClick={exportArtworkCard} title="导出 PNG 图片">PNG</button></section>
        {notice && <div className="notice" role="status"><button onClick={() => setNotice('')} aria-label="关闭提示">×</button>{notice}</div>}
      </aside>
    </main>
    {noteTerm && <div className="note-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNoteTerm(''); }}><section className="note-dialog" role="dialog" aria-modal="true" aria-labelledby="note-title"><header><div><span>意象手记 · {poem.dynasty} {poem.author}</span><h2 id="note-title">「{noteTerm}」</h2><small>《{poem.title}》</small></div><button onClick={() => setNoteTerm('')} aria-label="关闭笔记">×</button></header><p className="note-context">{verses.find((line) => line.includes(noteTerm)) || '写下这个意象带给你的联想、情绪或画面。'}</p><textarea autoFocus value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder={`此刻读到「${noteTerm}」，你想到什么？`}/><label className="note-export-option"><input type="checkbox" checked={noteIncludeInArtwork} onChange={(event) => setNoteIncludeInArtwork(event.target.checked)}/><span><strong>在作品卡中展示</strong><small>勾选后，导出的作品卡会附上这条意象手记。</small></span></label><footer><button className="note-cancel" onClick={() => setNoteTerm('')}>取消</button><button className="note-save" onClick={saveImageryNote}>保存到本地</button></footer></section></div>}
    {notebookOpen && <div className="note-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNotebookOpen(false); }}><section className="notebook-dialog" role="dialog" aria-modal="true" aria-labelledby="notebook-title"><header><div><span>SHIJING · PERSONAL NOTES</span><h2 id="notebook-title">我的意象手记</h2><small>依诗词归档 · 仅保存在此浏览器</small></div><button onClick={() => setNotebookOpen(false)} aria-label="关闭笔记本">×</button></header><div className="notebook-content">{notebookGroups.length ? notebookGroups.map(([key, group]) => <section className="notebook-poem" key={key}><h3>《{group.title}》<small>{group.dynasty} · {group.author}</small></h3>{Object.entries(group.notes).sort(([, a], [, b]) => b.updatedAt - a.updatedAt).map(([term, note]) => { const isEditing = editingNotebookNote?.poemKey === key && editingNotebookNote.term === term; return <article className={`notebook-entry ${isEditing ? 'is-editing' : ''}`} key={term}><div className="notebook-entry-head"><strong>{term}</strong><div className="notebook-entry-tools">{!isEditing && <><small>{note.includeInArtwork ? '已加入作品卡' : '仅保存为手记'} · {new Date(note.updatedAt).toLocaleDateString()}</small><button type="button" className="notebook-action" onClick={() => beginNotebookEdit(key, term, note)}>编辑</button><button type="button" className="notebook-action delete" onClick={() => deleteNotebookNote(key, term)}>删除</button></>}</div></div>{isEditing ? <><textarea className="notebook-edit-textarea" autoFocus value={notebookDraft} onChange={(event) => setNotebookDraft(event.target.value)} aria-label={`编辑「${term}」手记`}/><label className="notebook-edit-option"><input type="checkbox" checked={notebookIncludeInArtwork} onChange={(event) => setNotebookIncludeInArtwork(event.target.checked)}/>在作品卡中展示</label><div className="notebook-edit-actions"><button type="button" className="note-cancel" onClick={() => setEditingNotebookNote(null)}>取消</button><button type="button" className="note-save" onClick={saveNotebookEdit}>保存修改</button></div></> : <p>{note.text}</p>}</article>; })}</section>) : <div className="notebook-empty"><span>笺</span><strong>你的意象手记会收在这里</strong><p>点击左侧任意意象，写下感受并保存。每首诗的手记会分开归档。</p></div>}</div><footer><button className="note-save" onClick={() => { setEditingNotebookNote(null); setNotebookOpen(false); }}>合上笔记本</button></footer></section></div>}
    {coCreateOpen && <CoCreatePanel poem={poemContext} imagery={terms} config={creativeConfig} setConfig={setCreativeConfig} imageUrl={generatedImage} versions={paintingVersions} busy={integrationBusy === 'image'} onClose={() => setCoCreateOpen(false)} onGenerate={() => generateImage(creativeConfig)} onUseVersion={usePaintingVersion}/>}
    <footer className="page-footer"><span>诗境·AI　以诗为引，以画作答</span><span>本地示例 · 无需 API 即可体验</span></footer>
  </div>;
}
