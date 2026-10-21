import { useEffect, useRef, useState } from 'react';
import './background-music.css';

const SETTINGS_KEY = 'shijing-background-music';
function readSettings(): { volume: number; enabled: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    return {
      volume: typeof saved?.volume === 'number' && Number.isFinite(saved.volume) ? Math.min(100, Math.max(0, saved.volume)) : 25,
      enabled: saved?.enabled !== false,
    };
  } catch { return { volume: 25, enabled: true }; }
}

export function useBackgroundMusic() {
  const [settings, setSettings] = useState(readSettings);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio('/shijing-background.wav');
    audio.loop = true;
    audio.preload = 'metadata';
    audioRef.current = audio;
    const onPlay = () => { setPlaying(true); setMessage(''); };
    const onPause = () => setPlaying(false);
    const onError = () => { setPlaying(false); setMessage('配乐加载失败，请稍后重试'); };
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = settings.volume / 100;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Storage may be unavailable. */ }
  }, [settings]);

  function play() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.error) audio.load();
    audio.volume = settings.volume / 100;
    void audio.play().catch(() => {
      if (audioRef.current !== audio) return;
      setPlaying(false);
      setMessage('点击播放开启配乐');
    });
  }

  return {
    volume: settings.volume, playing, message,
    start: () => { if (settings.enabled) play(); },
    toggle: () => {
      if (!audioRef.current) return;
      const enabled = audioRef.current.paused;
      setSettings(current => ({ ...current, enabled }));
      if (enabled) play();
      else audioRef.current.pause();
    },
    setVolume: (volume: number) => setSettings(current => ({ ...current, volume })),
  };
}

export default function BackgroundMusic({ music }: { music: ReturnType<typeof useBackgroundMusic> }) {
  return <div className="background-music" role="group" aria-label="背景配乐">
    <button type="button" className="music-toggle" onClick={music.toggle} aria-label={music.playing ? '暂停背景音乐' : '播放背景音乐'} aria-pressed={music.playing} title={music.playing ? '暂停配乐' : '播放配乐'}>
      <span aria-hidden="true">{music.playing ? 'Ⅱ' : '▷'}</span><span>配乐</span>
    </button>
    <input type="range" min="0" max="100" step="1" value={music.volume} onChange={event => music.setVolume(Number(event.target.value))} aria-label="背景音乐音量" aria-valuetext={music.volume === 0 ? '静音' : `${music.volume}%`} />
    <span className="music-volume" aria-hidden="true">{music.volume}%</span>
    <span className="music-message" role="status">{music.message}</span>
  </div>;
}
