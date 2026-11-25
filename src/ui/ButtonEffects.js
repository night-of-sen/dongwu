/**
 * 全局按钮灵动交互特效引擎：
 * - 点击瞬间触发中心扩散水波纹（ripple）
 * - 向四周迸发 7 颗缤纷星星/圆点微粒（sparkle burst）
 * - 触发按钮与动态图标的弹性弹跳（is-popped）
 */

const BUTTON_SELECTOR = '.toy-btn, .biome-pill, .topic-btn, .action-pill, .icon-circle-btn, .mic-btn, .send-btn';

const SPARK_COLORS = {
  'pill-coral': ['#FF6B6B', '#FFB3C1', '#FFE066'],
  'pill-mint': ['#22C55E', '#86EFAC', '#FDE047'],
  'pill-sky': ['#38BDF8', '#7DD3FC', '#FEF08A'],
  'pill-ai': ['#14B8A6', '#5EEAD4', '#FEF08A'],
  'toy-btn-sun': ['#F59E0B', '#FDE047', '#FFFFFF'],
  'toy-btn-honey': ['#F59E0B', '#FBBF24', '#FFF3B0'],
  'toy-btn-sky': ['#38BDF8', '#7DD3FC', '#FFFFFF'],
  default: ['#FBBF24', '#38BDF8', '#FB7185', '#4ADE80'],
};

function pickPalette(btn) {
  for (const [cls, cols] of Object.entries(SPARK_COLORS)) {
    if (cls !== 'default' && btn.classList.contains(cls)) return cols;
  }
  const accent = btn.style.getPropertyValue('--biome-accent')?.trim();
  if (accent) return [accent, '#FDE047', '#FFFFFF'];
  return SPARK_COLORS.default;
}

function spawnTapSparks(x, y, colors) {
  const count = 7;
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('span');
    dot.className = i % 2 === 0 ? 'ui-tap-spark is-star' : 'ui-tap-spark';
    const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
    const dist = 24 + Math.random() * 26;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist - 8;
    const size = 6 + Math.random() * 5;
    const color = colors[i % colors.length];

    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.setProperty('--spark-dx', `${dx.toFixed(1)}px`);
    dot.style.setProperty('--spark-dy', `${dy.toFixed(1)}px`);
    dot.style.setProperty('--spark-color', color);
    dot.style.setProperty('--spark-rot', `${Math.round((Math.random() - 0.5) * 200)}deg`);
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 620);
  }
}

function spawnRipple(btn, clientX, clientY) {
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'btn-ripple-ring';
  const size = Math.max(rect.width, rect.height) * 1.35;
  const rx = clientX ? clientX - rect.left : rect.width / 2;
  const ry = clientY ? clientY - rect.top : rect.height / 2;
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${rx - size / 2}px`;
  ripple.style.top = `${ry - size / 2}px`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 540);
}

export function initButtonEffects() {
  if (typeof window === 'undefined') return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest?.(BUTTON_SELECTOR);
    if (!btn || btn.disabled) return;

    btn.classList.remove('is-popped');
    void btn.offsetWidth;
    btn.classList.add('is-popped');
    setTimeout(() => btn.classList.remove('is-popped'), 460);

    if (reduced) return;

    spawnRipple(btn, e.clientX, e.clientY);
    const rect = btn.getBoundingClientRect();
    const cx = e.clientX || rect.left + rect.width / 2;
    const cy = e.clientY || rect.top + rect.height / 2;
    spawnTapSparks(cx, cy, pickPalette(btn));
  });
}
