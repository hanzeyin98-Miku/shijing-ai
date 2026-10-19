export const paintingStyles = [
  { id: 'traditional-ink', label: '传统水墨', description: '黑白灰墨韵，虚实相生，留白悠远。' },
  { id: 'blue-green', label: '青绿山水', description: '石青石绿设色，层峦林木，色墨交融。' },
  { id: 'light-ochre', label: '浅绛山水', description: '淡墨浅赭，温润古雅，笔意清和。' },
] as const;

export const moodOptions = [
  { id: '清寂', description: '安静疏朗、淡雅含蓄；以冷润淡墨、稀疏景物和静谧空境表现幽寂，不画成阴森。' },
  { id: '温暖', description: '柔和亲切、富有生活气息；用暖赭、柔光与相依景物传达温润，不做浓艳金色。' },
  { id: '苍茫', description: '辽阔雄浑、空间深远；拉开天地尺度，以远山、云气和大水形成壮阔纵深。' },
  { id: '空灵', description: '朦胧悠远、虚实相生；用淡墨云雾、疏笔和大面积空白营造澄澈呼吸感。' },
  { id: '悲凉', description: '冷寂萧瑟、情绪含蓄；以枯润变化、疏落景物和清寒色调表达低回，不渲染绝望。' },
  { id: '明丽', description: '清新明快、富有生机；以清透青绿、鲜活点景和明净光感表现春意，避免艳俗。' },
  { id: '喜悦', description: '轻快欣悦、舒展明朗；笔势灵动，景物呼应有生气，以明净设色传达欢欣而不喧闹。' },
  { id: '思乡', description: '温柔怀远、含蓄牵念；以远路、归舟、月色或故园景物表达眷恋，氛围绵长克制。' },
  { id: '豪迈', description: '开阔昂扬、气势充沛；用高远山势、奔放笔意和开张空间表达胸襟，不画成武侠奇幻。' },
  { id: '孤独', description: '孤清自持、疏离静默；突出单个主体与广阔空境的距离，保持诗意，不渲染惊悚。' },
  { id: '闲适', description: '从容恬淡、悠然自得；布局舒缓，笔墨松弛，以平远景物和柔和留白呈现安闲。' },
  { id: '忧思', description: '沉静低回、心绪悠长；以含蓄冷暖对照、层叠云气和回旋视线表现思虑，避免戏剧化。' },
] as const;

export const compositionOptions = [
  { id: '远景留白', description: '远山云雾与疏朗空境' }, { id: '近景特写', description: '突出花木、人物或山石' },
  { id: '高远山势', description: '纵向层峦与高远空间' }, { id: '平远水景', description: '水面延展与横向空间' },
  { id: '主体居中', description: '核心意象位于视觉中心' },
] as const;

export const colorOptions = [
  { id: '墨色为主', description: '水墨浓淡为主调' }, { id: '青绿设色', description: '石青、石绿层染' },
  { id: '浅赭暖色', description: '浅赭、土黄温润设色' }, { id: '淡彩清雅', description: '低饱和花青与淡彩' },
] as const;

export type PaintingStyle = (typeof paintingStyles)[number]['id'];
export type CreativeMood = (typeof moodOptions)[number]['id'];
export type CreativeConfig = {
  style: PaintingStyle;
  customStyle: string;
  mood: CreativeMood[];
  customMood: string;
  subjectImagery: string[];
  customImagery: string;
  composition: (typeof compositionOptions)[number]['id'];
  colorTone: (typeof colorOptions)[number]['id'];
  inkDensity: number;
  whitespace: number;
  aspectRatio: '16:9' | '1:1' | '3:4';
  customDescription: string;
};

export type CreativePoem = { title: string; author: string; dynasty: string; content: string; explanation?: string };

export function defaultCreativeConfig(imagery: string[] = []): CreativeConfig {
  return {
    style: 'traditional-ink', customStyle: '', mood: ['清寂'], customMood: '', subjectImagery: imagery.slice(0, 3), customImagery: '',
    composition: '远景留白', colorTone: '墨色为主', inkDensity: 52, whitespace: 58,
    aspectRatio: '16:9', customDescription: '',
  };
}

const styleDescriptions: Record<PaintingStyle, string> = {
  'traditional-ink': '传统水墨，以黑白灰为主，运用积墨、破墨、皴擦点染与宣纸肌理，重山水层次和虚实留白。',
  'blue-green': '青绿山水，以石青、石绿为主色，矿物色层染山峦林木，色墨相融，保持古典手绘山水画气韵。',
  'light-ochre': '浅绛山水，以淡墨、浅赭和温润自然色为主，设色轻柔克制，突出传统山水的笔墨趣味。',
};

const moodDescriptions: Record<CreativeMood, string> = Object.fromEntries(moodOptions.map((option) => [option.id, option.description])) as Record<CreativeMood, string>;

const compositionDescriptions: Record<CreativeConfig['composition'], string> = {
  远景留白: '采用远景构图，远山、云雾和大面积留白构成主空间。', 近景特写: '以近景为主，让主体意象清晰突出，同时保留笔墨层次。',
  高远山势: '采用高远构图，层峦由近及远向上延展，强化纵向空间。', 平远水景: '采用平远构图，以河流湖面横向延展，拉开天地空间。',
  主体居中: '将主要意象安排在视觉中心附近，周围景物形成呼应。',
};

const colorDescriptions: Record<CreativeConfig['colorTone'], string> = {
  墨色为主: '以墨色层次为主，彩色仅作极少点染。', 青绿设色: '以石青石绿为主，辅以墨色勾皴，保持古典低饱和。',
  浅赭暖色: '以浅赭、土黄和淡墨营造温润暖意，避免浓艳。', 淡彩清雅: '使用低饱和花青、淡绿与浅赭轻染，清雅通透。',
};

export function buildCreativePrompt(poem: CreativePoem, analyzedImagery: string[], config: CreativeConfig) {
  const customTerms = config.customImagery.split(/[、，,\s]+/).map((term) => term.trim()).filter(Boolean);
  const subjects = [...new Set(config.subjectImagery)];
  const freeSubjects = [...new Set(customTerms)];
  const style = styleDescriptions[config.style];
  const selectedMoods: CreativeMood[] = config.mood.length ? config.mood : ['清寂'];
  const mood = selectedMoods.map((item) => moodDescriptions[item]).join(' ');
  const composition = compositionDescriptions[config.composition];
  const color = colorDescriptions[config.colorTone];
  const ink = config.inkDensity < 34 ? '淡墨轻染、墨色清润、层次柔和。' : config.inkDensity > 68 ? '浓墨重彩中的墨骨清晰，主体对比鲜明、层次厚重。' : '浓淡相宜、墨色层次平衡、主次分明。';
  const blank = config.whitespace < 34 ? '画面内容较丰，主体占据较多空间，仍保留必要气口。' : config.whitespace > 68 ? '疏朗构图，强调大面积留白和虚处的气韵。' : '主体与空白平衡，留白疏密有致。';
  const ratio = { '16:9': '横幅 16:9，横向舒展。', '1:1': '方形 1:1，四边均衡。', '3:4': '竖幅 3:4，纵向展开。' }[config.aspectRatio];
  return [
    `为中国古诗《${poem.title}》创作一幅传统中国画。作者：${poem.dynasty}代${poem.author}。`,
    `原诗：${poem.content}`,
    `诗词意境参考：${poem.explanation || '依据原诗理解，不增添与诗意冲突的叙事'}。`,
    `诗中已分析意象：${analyzedImagery.length ? analyzedImagery.join('、') : '依据原诗提炼'}。`,
    `读者选定主体意象：${subjects.length ? subjects.join('、') : '从诗中意象选择最适合的主体'}。`,
    `自由创作意象（不代表原诗原有内容）：${freeSubjects.length ? freeSubjects.join('、') : '无'}。`,
    `绘画风格：${paintingStyles.find((option) => option.id === config.style)?.label}。${style}`,
    config.customStyle.trim() ? `读者自定义画风补充：${config.customStyle.trim()}。在传统中国画基础上结合此描述；自定义风格与基础画风不一致时，优先遵循自定义描述。` : '',
    `读者选择的复合情绪：${selectedMoods.join('、')}${config.customMood.trim() ? `、${config.customMood.trim()}` : ''}。${mood}${config.customMood.trim() ? `另外融入读者自定义情绪「${config.customMood.trim()}」，用相应的气氛、景物疏密和用笔表达。` : ''}按所选顺序融合情绪：第一项作为主气氛，其余作为辅助层次；若表达冲突，以主情绪为准，避免画面情绪互相抵消。情绪是读者的创作诠释，不改变原诗内容。`,
    `构图：${config.composition}。${composition}${ratio}`,
    `色彩倾向：${config.colorTone}。${color}`,
    `墨色浓淡 ${config.inkDensity}/100：${ink}`,
    `留白意向 ${config.whitespace}/100：${blank}该数值表达创作偏好，不要求像素级精确占比。`,
    config.customDescription.trim() ? `读者补充：${config.customDescription.trim()}。` : '',
    '使用中国画笔墨、宣纸肌理、皴法与留白，画面笔意自然，意象关系清楚。避免写实摄影、现代卡通、3D渲染、现代物件、文字题款、印章和过度饱和色彩。',
  ].filter(Boolean).join('\n');
}
