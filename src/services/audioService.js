import { assetUrl } from '../utils/assetUrl.js';

/**
 * 自然神经网络中文语音播放引擎（优先预生成 Neural MP3 → 动态 /api/tts 神经网络合成 → 兜底 Web Speech）
 * + 轻柔儿童玩具合成音效（Web Audio API）
 */
export class AudioService {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.currentAudio = null;
    this.currentObjectUrl = null;
    this.playToken = 0;
    this.zhVoice = null;
    this.onSpeakingChange = null;
    this._initFallbackVoices();
  }

  _initFallbackVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      const zh = voices.filter((v) => /zh[-_]?CN|cmn/i.test(v.lang));
      this.zhVoice = zh.find((v) => /Xiaoxiao|Xiaoyi|Yunxi|Tingting|Google/i.test(v.name)) || zh[0] || null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
  }

  _ensureAudioContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setEnabled(flag) {
    this.enabled = Boolean(flag);
    if (!this.enabled) {
      this.stopSpeaking();
    }
  }

  stopSpeaking() {
    this.playToken += 1;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.onSpeakingChange?.(false);
  }

  /**
   * 播放预生成的自然神经网络中文配音 MP3（零延迟、温暖生动、完全无机械感）
   * clipKey: 'intro' | 'food' | 'trick' | 'secret' | 'pet' | 'feed'
   */
  async speakPreset(animalId, clipKey, fallbackText, voiceOpts = {}) {
    if (!this.enabled) return;
    this.stopSpeaking();
    const token = this.playToken;
    const url = assetUrl(`/audio/voices/${animalId}_${clipKey}.mp3`);

    try {
      await this._playAudioUrl(url, token);
    } catch {
      if (token === this.playToken && fallbackText) {
        this.speakDynamic(animalId, fallbackText, voiceOpts);
      }
    }
  }

  /**
   * 为 DeepSeek AI 实时回复合成自然神经网络中文语音（调用本地 /api/tts，离线时优雅降级）
   */
  async speakDynamic(animalId, text, voiceOpts = {}) {
    if (!this.enabled || !text) return;
    this.stopSpeaking();
    const token = this.playToken;

    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animalId, text }),
      });
      if (!resp.ok) throw new Error('TTS API unavailable');
      const blob = await resp.blob();
      if (token !== this.playToken) return;
      const objectUrl = URL.createObjectURL(blob);
      this.currentObjectUrl = objectUrl;
      await this._playAudioUrl(objectUrl, token);
    } catch {
      if (token === this.playToken) {
        this._speakFallback(text, voiceOpts);
      }
    }
  }

  _playAudioUrl(url, token) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      this.currentAudio = audio;
      audio.volume = 1.0;

      audio.onplay = () => {
        if (token === this.playToken) this.onSpeakingChange?.(true);
      };
      audio.onended = () => {
        if (token === this.playToken) this.onSpeakingChange?.(false);
        resolve();
      };
      audio.onerror = (e) => {
        if (token === this.playToken) this.onSpeakingChange?.(false);
        reject(e);
      };

      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(reject);
      }
    });
  }

  _speakFallback(text, voiceOpts = {}) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    if (this.zhVoice) utter.voice = this.zhVoice;
    utter.pitch = voiceOpts.pitch ?? 1.08;
    utter.rate = voiceOpts.rate ?? 0.98;
    utter.onstart = () => this.onSpeakingChange?.(true);
    utter.onend = () => this.onSpeakingChange?.(false);
    utter.onerror = () => this.onSpeakingChange?.(false);
    window.speechSynthesis.speak(utter);
  }

  playSfx(type = 'pop') {
    if (!this.enabled) return;
    const ctx = this._ensureAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (type === 'pop') {
      this._tone(ctx, 460, 680, 0.08, 'sine', 0.12, now);
    } else if (type === 'enter') {
      this._tone(ctx, 392, 523.25, 0.13, 'triangle', 0.12, now);
      this._tone(ctx, 523.25, 659.25, 0.15, 'triangle', 0.12, now + 0.08);
      this._tone(ctx, 659.25, 783.99, 0.2, 'sine', 0.13, now + 0.16);
    } else if (type === 'back') {
      this._tone(ctx, 620, 420, 0.16, 'sine', 0.1, now);
    } else if (type === 'pet') {
      this._tone(ctx, 523, 659, 0.1, 'sine', 0.11, now);
      this._tone(ctx, 659, 880, 0.13, 'sine', 0.11, now + 0.08);
    } else if (type === 'feed') {
      this._tone(ctx, 340, 260, 0.06, 'triangle', 0.12, now);
      this._tone(ctx, 380, 290, 0.06, 'triangle', 0.11, now + 0.08);
      this._tone(ctx, 520, 700, 0.11, 'sine', 0.1, now + 0.16);
    } else if (type === 'trick') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        this._tone(ctx, f, f * 1.03, 0.11, 'triangle', 0.1, now + i * 0.065);
      });
    } else if (type === 'shutter') {
      const bufferSize = ctx.sampleRate * 0.065;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      noise.connect(gain).connect(ctx.destination);
      noise.start(now);
      this._tone(ctx, 880, 1200, 0.05, 'sine', 0.07, now + 0.025);
    } else if (type === 'star') {
      this._tone(ctx, 659.25, 987.77, 0.12, 'sine', 0.12, now);
      this._tone(ctx, 987.77, 1318.5, 0.2, 'sine', 0.12, now + 0.09);
    }
  }

  playAnimalCue(animalId) {
    if (!this.enabled) return;
    const ctx = this._ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    switch (animalId) {
      case 'apatosaurus':
      case 'triceratops':
      case 'stegosaurus':
        this._tone(ctx, 185, 130, 0.24, 'triangle', 0.1, now);
        break;
      case 'wolf':
      case 'husky':
        this._tone(ctx, 320, 480, 0.12, 'triangle', 0.09, now);
        this._tone(ctx, 480, 380, 0.18, 'sine', 0.09, now + 0.11);
        break;
      case 'dolphin':
      case 'clownfish':
        this._tone(ctx, 880, 1320, 0.08, 'sine', 0.09, now);
        this._tone(ctx, 1180, 1520, 0.09, 'sine', 0.09, now + 0.09);
        break;
      default:
        this._tone(ctx, 480, 640, 0.1, 'sine', 0.09, now);
        break;
    }
  }

  _tone(ctx, startFreq, endFreq, duration, type, volume, startTime) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }
}
