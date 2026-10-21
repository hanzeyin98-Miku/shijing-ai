import { useEffect, useRef, useState } from 'react';
import './poetry-entry.css';

type EntryPhase = 'closed' | 'transitioning';
type PoetryEntryProps = { onEnter: () => void; onStart?: () => void };

const ENTRY_COPY = { title: '展卷入境', subtitle: '轻启竹简，阅见东方', hint: '点击展开' } as const;
const ENTER_DURATION = 1150;

export default function PoetryEntry({ onEnter, onStart }: PoetryEntryProps) {
  const [phase, setPhase] = useState<EntryPhase>('closed');
  const enterTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (enterTimer.current !== null) window.clearTimeout(enterTimer.current);
  }, []);

  function openBook() {
    if (phase !== 'closed') return;
    onStart?.();
    setPhase('transitioning');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    enterTimer.current = window.setTimeout(onEnter, reducedMotion ? 30 : ENTER_DURATION);
  }

  return <main className={`entry-screen entry-phase-${phase}`}>
    <div className="entry-background" aria-hidden="true" />
    <div className="entry-shade" aria-hidden="true" />

    <section className="entry-intro" aria-label="诗境·AI 网站入口">
      <h1 className="entry-brand"><img src="/shijing-calligraphy.png" alt="诗境"/><span><i aria-hidden="true">·</i>AI</span></h1>
      <p className="entry-title">{ENTRY_COPY.title}</p>
      <p className="entry-subtitle">{ENTRY_COPY.subtitle}</p>
    </section>

    <button className="entry-book-trigger" type="button" onClick={openBook} disabled={phase !== 'closed'} aria-label="点击古籍进入诗境·AI">
      <span className="entry-book-art" aria-hidden="true">
        <img className="entry-bamboo-image" src="/entry-bamboo-button.png" alt="" draggable={false} />
      </span>
      <span className="entry-book-instruction">{phase === 'closed' ? ENTRY_COPY.hint : '诗境徐徐展开'}</span>
    </button>

    <p className="entry-colophon" aria-hidden="true">诗境·AI　　以诗为引，以画作答</p>
  </main>;
}
