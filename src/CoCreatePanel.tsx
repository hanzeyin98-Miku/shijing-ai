import type { ReactNode } from 'react';
import type { CreativeConfig, CreativePoem } from '../shared/creative';
import { buildCreativePrompt, colorOptions, compositionOptions, moodOptions, paintingStyles } from '../shared/creative';

export type PaintingVersion = { id: string; imageUrl: string; config: CreativeConfig; createdAt: number; legacy?: boolean };

type Props = {
  poem: CreativePoem;
  imagery: string[];
  config: CreativeConfig;
  setConfig: (config: CreativeConfig) => void;
  imageUrl: string;
  versions: PaintingVersion[];
  busy: boolean;
  onClose: () => void;
  onGenerate: () => void;
  onUseVersion: (version: PaintingVersion) => void;
};

function InkPreview({ style }: { style: CreativeConfig['style'] }) {
  const palette = style === 'blue-green' ? ['#637d70', '#a4b8a8', '#748b9b'] : style === 'light-ochre' ? ['#947b62', '#c4ad8e', '#9aa493'] : ['#53665e', '#a5b1a8', '#879898'];
  return <svg viewBox="0 0 120 62" aria-hidden="true" className={`co-ink-preview ${style}`}>
    <path d="M4 54 37 15l19 23 18-30 42 46Z" fill={palette[0]} opacity=".72"/><path d="m21 54 36-24 17 13 18-23 23 34Z" fill={palette[1]} opacity=".78"/><path d="M0 57c25-8 40 3 61-2s36-6 59 1" fill="none" stroke={palette[2]} strokeWidth="3" opacity=".72"/><circle cx="94" cy="13" r="6" fill={palette[1]} opacity=".8"/>
  </svg>;
}

export default function CoCreatePanel({ poem, imagery, config, setConfig, imageUrl, versions, busy, onClose, onGenerate, onUseVersion }: Props) {
  const prompt = buildCreativePrompt(poem, imagery, config);
  const toggleSubject = (term: string) => setConfig({ ...config, subjectImagery: config.subjectImagery.includes(term) ? config.subjectImagery.filter((item) => item !== term) : [...config.subjectImagery, term] });
  const section = (title: string, children: ReactNode) => <section className="co-section"><h3>{title}</h3>{children}</section>;
  return <div className="co-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="co-panel" role="dialog" aria-modal="true" aria-labelledby="co-title">
      <header className="co-header"><div><span>POETRY · PAINTING CO-CREATION</span><h2 id="co-title">诗画共创</h2><p>为《{poem.title}》调整画意，再生成一幅专属国画。</p></div><button className="co-close" onClick={onClose} aria-label="关闭共创面板">×</button></header>
      <div className="co-body">
        <main className="co-controls">
          {section('01　画风', <><div className="co-style-grid">{paintingStyles.map((item) => <button type="button" key={item.id} className={`co-style-card ${config.style === item.id ? 'active' : ''}`} onClick={() => setConfig({ ...config, style: item.id })}><InkPreview style={item.id}/><strong>{item.label}</strong><small>{item.description}</small></button>)}</div><label className="co-free-input"><span>自定义画风</span><input className="co-input" value={config.customStyle} onChange={(event) => setConfig({ ...config, customStyle: event.target.value })} placeholder="自由描述画风，如：宋代院体、工笔重彩、泼墨写意"/></label></>)}
          {section('02　情绪意境', <><p className="co-hint">可多选，按选择顺序融合情绪；第一项作为主气氛，其余补充画面层次。</p><div className="co-chips co-moods">{moodOptions.map((item) => <button key={item.id} className={config.mood.includes(item.id) ? 'active' : ''} aria-pressed={config.mood.includes(item.id)} onClick={() => { const selected = config.mood.includes(item.id) ? config.mood.filter((mood) => mood !== item.id) : [...config.mood, item.id]; if (selected.length) setConfig({ ...config, mood: selected }); }} title={item.description}>{item.id}{config.mood.length > 1 && config.mood[0] === item.id && <em>主</em>}</button>)}</div><div className="co-mood-detail">{config.mood.map((mood, index) => { const option = moodOptions.find((item) => item.id === mood); return <p key={mood}><strong>{index === 0 ? '主意境' : '辅意境'} · {mood}</strong><span>{option?.description}</span></p>; })}</div><label className="co-free-input"><span>自定义情绪</span><input className="co-input" value={config.customMood} onChange={(event) => setConfig({ ...config, customMood: event.target.value })} placeholder="自由输入情绪，如：怅然、期待、苍凉中带着希望"/></label></>)}
          {section('03　主体意象', <><p className="co-hint">选中诗中意象作为画面重点；自由补充项会单独标明，不会冒充原诗意象。</p><div className="co-chips co-imagery">{imagery.map((term) => <button key={term} className={config.subjectImagery.includes(term) ? 'active' : ''} onClick={() => toggleSubject(term)}>{term}</button>)}</div><input className="co-input" value={config.customImagery} onChange={(event) => setConfig({ ...config, customImagery: event.target.value })} placeholder="自由补充意象，如：远山、归鸟"/></>)}
          {section('04　构图与画幅', <><div className="co-option-list">{compositionOptions.map((item) => <button key={item.id} className={config.composition === item.id ? 'active' : ''} onClick={() => setConfig({ ...config, composition: item.id })}><strong>{item.id}</strong><small>{item.description}</small></button>)}</div><div className="co-ratios">{(['16:9', '1:1', '3:4'] as const).map((ratio) => <button key={ratio} className={config.aspectRatio === ratio ? 'active' : ''} onClick={() => setConfig({ ...config, aspectRatio: ratio })}><i className={`ratio-icon ratio-${ratio.replace(':', '-')}`}/>{ratio}</button>)}</div><p className="co-hint">画幅作为构图要求写入提示词；当前图像服务按 2K 返回，比例是否被服务端严格支持取决于服务商。</p></>)}
          {section('05　色彩与笔墨', <><div className="co-option-list co-color-options">{colorOptions.map((item) => <button key={item.id} className={config.colorTone === item.id ? 'active' : ''} onClick={() => setConfig({ ...config, colorTone: item.id })}><strong>{item.id}</strong><small>{item.description}</small></button>)}</div><label className="co-slider">墨色浓淡 <span>{config.inkDensity}</span><input type="range" min="0" max="100" value={config.inkDensity} onChange={(event) => setConfig({ ...config, inkDensity: Number(event.target.value) })}/><small>淡墨　·　浓墨</small></label><label className="co-slider">留白程度 <span>{config.whitespace}</span><input type="range" min="0" max="100" value={config.whitespace} onChange={(event) => setConfig({ ...config, whitespace: Number(event.target.value) })}/><small>画面丰实　·　空灵疏朗</small></label><textarea className="co-input co-textarea" value={config.customDescription} onChange={(event) => setConfig({ ...config, customDescription: event.target.value })} placeholder="补充画面细节或希望避免的内容"/></>)}
          {section('06　创作描述预览', <details className="co-prompt"><summary>展开查看将提交给现有生图 API 的完整提示词</summary><pre>{prompt}</pre></details>)}
        </main>
        <aside className="co-preview-column"><div className="co-preview-title"><strong>画作预览</strong><span>{imageUrl ? '当前已生成' : '尚未生成'}</span></div><div className={`co-image-preview ${imageUrl ? '' : 'empty'}`}>{imageUrl ? <img src={imageUrl} alt={`《${poem.title}》当前画作预览`}/> : <><InkPreview style={config.style}/><p>参数调整完成后，点击下方按钮生成画作</p></>}</div>
          <div className="co-summary"><strong>当前方案</strong><span>{paintingStyles.find((item) => item.id === config.style)?.label} · {config.mood.join(' + ')} · {config.composition}</span><span>{config.subjectImagery.length ? config.subjectImagery.join('、') : '未指定主体意象'}</span><span>画幅 {config.aspectRatio}　墨色 {config.inkDensity}　留白 {config.whitespace}</span></div>
          <div className="co-history"><div className="co-history-heading"><strong>画作版本</strong><span>{versions.length} 幅</span></div>{versions.length ? <div className="co-version-list">{[...versions].reverse().map((version, index) => <article className="co-version" key={version.id}><img src={version.imageUrl} alt={`第 ${versions.length - index} 版画作`}/><div><strong>{version.legacy ? '历史画作' : `第 ${versions.length - index} 版`}</strong><small>{version.legacy ? '生成参数未记录' : `${paintingStyles.find((item) => item.id === version.config.style)?.label} · ${version.config.mood.join(' + ')}`}</small><button onClick={() => onUseVersion(version)}>设为当前画作</button></div></article>)}</div> : <p className="co-hint">生成新版本后，会在这里保留本机版本记录并可切换比较。</p>}{versions.length > 1 && <div className="co-compare"><strong>最近两版对照</strong><div>{versions.slice(-2).map((version, index) => <figure key={`compare-${version.id}`}><img src={version.imageUrl} alt={`对照版本 ${index + 1}`}/><figcaption>{paintingStyles.find((item) => item.id === version.config.style)?.label} · {version.config.mood.join(' + ')}</figcaption></figure>)}</div></div>}</div>
          <button className="co-generate" disabled={busy} onClick={onGenerate}>{busy ? '正在绘制画卷…' : imageUrl ? '按当前方案生成新版本' : '生成画作'}</button><p className="co-cost-note">仅调用本项目现有的图像生成 API；调整参数和预览不消耗 API。</p>
        </aside>
      </div>
    </section>
  </div>;
}
