/**
 * 手绘绘本风 3D 质感动态 SVG 图标库（彻底告别通用系统 Emoji，每个图标带专属微动效结构）
 */

export const ICONS = {
  // 品牌徽章：迷你旋转地球 + 星环 + 闪亮小星星
  brand: `
    <svg class="anim-svg svg-brand" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="g-brand-orb" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#FFE680"/>
          <stop offset="55%" stop-color="#FFA93A"/>
          <stop offset="100%" stop-color="#E66A1F"/>
        </radialGradient>
      </defs>
      <ellipse class="svg-orbit" cx="18" cy="18" rx="15" ry="6.2" transform="rotate(-22 18 18)" stroke="#FFF4C2" stroke-width="2" stroke-dasharray="4 3" opacity="0.9"/>
      <circle cx="18" cy="18" r="10.5" fill="url(#g-brand-orb)"/>
      <path d="M12 15.5c2.2-2.6 6-3 8.8-1.4 1.8 1 3 3.2 2.4 5.4-.5 2-2.5 3.4-5.2 3.2-3.4-.3-6.6-2.5-6-7.2Z" fill="#7AD85F" opacity="0.88"/>
      <ellipse cx="14.5" cy="12.5" rx="3" ry="1.6" transform="rotate(-28 14.5 12.5)" fill="#FFFFFF" opacity="0.55"/>
      <path class="svg-twinkle" d="M29.5 7l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1 1-2.4Z" fill="#FFF7B2"/>
    </svg>
  `,

  // 回星球：立体蔚蓝地球 + 环绕返回轨箭
  'back-planet': `
    <svg class="anim-svg svg-globe" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="g-earth" cx="35%" cy="30%" r="72%">
          <stop offset="0%" stop-color="#7AE4FF"/>
          <stop offset="60%" stop-color="#2599E8"/>
          <stop offset="100%" stop-color="#1761B5"/>
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="10" fill="url(#g-earth)"/>
      <path class="svg-land-drift" d="M10.5 13c1.8-2.4 5.2-2.8 7.4-1.3 1.5 1 .9 3-.6 3.7-1.7.8-1.8 2.8-.2 3.8 1.4.8 1 2.6-.9 3-2.6.5-5.6-1.2-6.5-4.2-.6-1.8-.3-3.5.8-5Z" fill="#7EE068"/>
      <path d="M20.5 10.5c1.6.7 2.8 2.2 3.1 4-1.4.3-2.7-.2-3.3-1.4-.5-1-.4-1.9.2-2.6Z" fill="#9BF07E"/>
      <ellipse cx="12.5" cy="11" rx="2.6" ry="1.4" transform="rotate(-30 12.5 11)" fill="#FFF" opacity="0.5"/>
      <g class="svg-orbit-arrow">
        <path d="M5.5 20.5C3.5 14 9 6.5 17 5.5c4.8-.6 9 1.6 10.5 5.2" stroke="#FFE57F" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M4.2 17.5l1.3 3.4 3.4-1.1" stroke="#FFE57F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </svg>
  `,

  // 白天：温暖发光旋转太阳
  sun: `
    <svg class="anim-svg svg-sun" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="g-sun" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#FFF9C4"/>
          <stop offset="55%" stop-color="#FFD43B"/>
          <stop offset="100%" stop-color="#FF922B"/>
        </radialGradient>
      </defs>
      <g class="svg-sun-rays" stroke="#FFF3B0" stroke-width="2.4" stroke-linecap="round">
        <line x1="16" y1="3" x2="16" y2="6.2"/>
        <line x1="16" y1="25.8" x2="16" y2="29"/>
        <line x1="3" y1="16" x2="6.2" y2="16"/>
        <line x1="25.8" y1="16" x2="29" y2="16"/>
        <line x1="6.8" y1="6.8" x2="9.1" y2="9.1"/>
        <line x1="22.9" y1="22.9" x2="25.2" y2="25.2"/>
        <line x1="25.2" y1="6.8" x2="22.9" y2="9.1"/>
        <line x1="9.1" y1="22.9" x2="6.8" y2="25.2"/>
      </g>
      <circle class="svg-sun-core" cx="16" cy="16" r="7.4" fill="url(#g-sun)"/>
      <circle cx="13.5" cy="13.5" r="2" fill="#FFFFFF" opacity="0.55"/>
    </svg>
  `,

  // 夜晚：弯弯金月 + 闪烁双星
  moon: `
    <svg class="anim-svg svg-moon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="g-moon" x1="6" y1="6" x2="24" y2="26">
          <stop offset="0%" stop-color="#FFF5B8"/>
          <stop offset="100%" stop-color="#FFC94A"/>
        </linearGradient>
      </defs>
      <path class="svg-moon-body" d="M22.5 19.8A9.2 9.2 0 0 1 11.2 8.5a9.4 9.4 0 1 0 11.3 11.3Z" fill="url(#g-moon)"/>
      <path class="svg-twinkle" d="M23.5 6.5l1 2.3 2.3 1-2.3 1-1 2.3-1-2.3-2.3-1 2.3-1 1-2.3Z" fill="#FFF7C2"/>
      <circle class="svg-twinkle-delay" cx="26.5" cy="15.5" r="1.4" fill="#A5F3FC"/>
    </svg>
  `,

  // 声音开启：手绘小喇叭 + 三重脉冲声波
  'sound-on': `
    <svg class="anim-svg svg-sound" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="g-spk" x1="5" y1="10" x2="18" y2="23">
          <stop offset="0%" stop-color="#FFB74D"/>
          <stop offset="100%" stop-color="#EA6B24"/>
        </linearGradient>
      </defs>
      <path d="M6 13.5h4.2l5.6-4.6c.8-.6 2-.1 2 .9v12.4c0 1-1.2 1.5-2 .9l-5.6-4.6H6a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2Z" fill="url(#g-spk)"/>
      <path class="svg-wave-1" d="M21 12.6c1.5 1.9 1.5 4.9 0 6.8" stroke="#F59E0B" stroke-width="2.4" stroke-linecap="round"/>
      <path class="svg-wave-2" d="M24.6 9.8c2.7 3.5 2.7 8.9 0 12.4" stroke="#38BDF8" stroke-width="2.4" stroke-linecap="round"/>
    </svg>
  `,

  // 静音状态
  'sound-off': `
    <svg class="anim-svg svg-sound-off" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M6 13.5h4.2l5.6-4.6c.8-.6 2-.1 2 .9v12.4c0 1-1.2 1.5-2 .9l-5.6-4.6H6a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2Z" fill="#94A3B8"/>
      <path d="M21.5 12.5l6 7m0-7l-6 7" stroke="#EF4444" stroke-width="2.6" stroke-linecap="round"/>
    </svg>
  `,

  // 动物图鉴：立体精装探险手册 + 闪烁星标
  book: `
    <svg class="anim-svg svg-book" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="g-book" x1="5" y1="6" x2="26" y2="26">
          <stop offset="0%" stop-color="#FFFDF5"/>
          <stop offset="100%" stop-color="#FDE68A"/>
        </linearGradient>
      </defs>
      <path d="M5 8.5C5 7.1 6.1 6 7.5 6H15v20H7.5A2.5 2.5 0 0 1 5 23.5v-15Z" fill="#B45309"/>
      <path d="M15 6h9.5A2.5 2.5 0 0 1 27 8.5v15a2.5 2.5 0 0 1-2.5 2.5H15V6Z" fill="#D97706"/>
      <path class="svg-page-flip" d="M7.5 8.2H15v15.6H7.5a.8.8 0 0 1-.8-.8V9c0-.4.4-.8.8-.8Zm9 0H24a.8.8 0 0 1 .8.8v14a.8.8 0 0 1-.8.8h-7.5V8.2Z" fill="url(#g-book)"/>
      <path class="svg-twinkle" d="M20.5 11.5l1.1 2.4 2.5.4-1.8 1.8.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.8 2.5-.4 1.1-2.4Z" fill="#F59E0B"/>
    </svg>
  `,

  // AI 测试实验室：灵动魔法罗盘 / 星火仪（替代呆板齿轮）
  compass: `
    <svg class="anim-svg svg-compass" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="g-comp" x1="6" y1="6" x2="26" y2="26">
          <stop offset="0%" stop-color="#38BDF8"/>
          <stop offset="100%" stop-color="#0284C7"/>
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="10.5" fill="#E0F2FE" stroke="url(#g-comp)" stroke-width="2.4"/>
      <g class="svg-needle">
        <polygon points="16,8.2 19.2,16 16,17.2 12.8,16" fill="#F97316"/>
        <polygon points="16,23.8 19.2,16 16,14.8 12.8,16" fill="#0EA5E9"/>
        <circle cx="16" cy="16" r="2.1" fill="#FFFDF7" stroke="#1E3A5F" stroke-width="1.2"/>
      </g>
      <path class="svg-twinkle" d="M26.5 4.5l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8.8-1.8Z" fill="#F59E0B"/>
    </svg>
  `,

  // ====== 6 大陆板块专属动态徽章 ======
  'biome-meadow': `
    <svg class="anim-svg svg-biome-meadow" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#FEF3C7"/>
      <circle class="svg-sun-core" cx="25" cy="10.5" r="4" fill="#FBBF24"/>
      <path d="M3.5 23.5C9 18 16 18 22 22c4.5 2.8 8 2 10.8.8A16 16 0 0 1 18 34 16 16 0 0 1 3.5 23.5Z" fill="#65C452"/>
      <g class="svg-sway">
        <path d="M13 26c-.5-5 1-10 3.5-14" stroke="#D97706" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="14" cy="15.5" rx="2.6" ry="1.4" transform="rotate(-35 14 15.5)" fill="#F59E0B"/>
        <ellipse cx="17.2" cy="13.5" rx="2.6" ry="1.4" transform="rotate(28 17.2 13.5)" fill="#FBBF24"/>
        <ellipse cx="15.5" cy="19" rx="2.4" ry="1.3" transform="rotate(-30 15.5 19)" fill="#F59E0B"/>
      </g>
    </svg>
  `,

  'biome-snow': `
    <svg class="anim-svg svg-biome-snow" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#E0F2FE"/>
      <g class="svg-spin-slow" stroke="#0284C7" stroke-width="2.2" stroke-linecap="round">
        <line x1="18" y1="6.5" x2="18" y2="29.5"/>
        <line x1="8" y1="12.2" x2="28" y2="23.8"/>
        <line x1="28" y1="12.2" x2="8" y2="23.8"/>
        <path d="M15.2 9.2L18 12l2.8-2.8M15.2 26.8L18 24l2.8 2.8" stroke="#38BDF8" stroke-width="1.8"/>
      </g>
      <circle cx="18" cy="18" r="3.4" fill="#FFFFFF" stroke="#38BDF8" stroke-width="1.8"/>
    </svg>
  `,

  'biome-coast': `
    <svg class="anim-svg svg-biome-coast" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#E0F7FA"/>
      <path d="M5 25c4-2.5 8 1.5 13 0s9-2.5 13 0A16 16 0 0 1 18 34 16 16 0 0 1 5 25Z" fill="#22C3E6"/>
      <g class="svg-bob">
        <path d="M18 10c5.5 0 9.5 4.2 8.5 9.5-.6 3-3 5.2-5.5 6h-6c-2.5-.8-4.9-3-5.5-6C8.5 14.2 12.5 10 18 10Z" fill="#FB7185"/>
        <path d="M18 10.5v14.5M14 11.5l2.5 13.5M22 11.5l-2.5 13.5" stroke="#FFE4E6" stroke-width="1.5" stroke-linecap="round"/>
      </g>
      <circle class="svg-bubble-rise" cx="26.5" cy="12" r="2.2" fill="#FFFFFF" opacity="0.85"/>
    </svg>
  `,

  'biome-dino': `
    <svg class="anim-svg svg-biome-dino" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#DCFCE7"/>
      <g class="svg-sway">
        <path d="M12 27c2-6 6-12 13-16" stroke="#15803D" stroke-width="2.4" stroke-linecap="round"/>
        <ellipse cx="16.5" cy="19.5" rx="5" ry="2.2" transform="rotate(-38 16.5 19.5)" fill="#22C55E"/>
        <ellipse cx="21" cy="15.5" rx="4.6" ry="2" transform="rotate(-25 21 15.5)" fill="#4ADE80"/>
        <ellipse cx="21.5" cy="22" rx="4.8" ry="2.1" transform="rotate(18 21.5 22)" fill="#16A34A"/>
      </g>
      <circle cx="12" cy="12" r="2.4" fill="#86EFAC"/>
      <circle class="svg-twinkle" cx="26.5" cy="24.5" r="2" fill="#FACC15"/>
    </svg>
  `,

  'biome-desert': `
    <svg class="anim-svg svg-biome-desert" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#FFEDD5"/>
      <circle class="svg-sun-core" cx="24.5" cy="11" r="4.2" fill="#F97316"/>
      <path d="M3 24c6-5.5 11.5-5.5 17 0 4 3.5 8 1.8 12.5-1.5A16 16 0 0 1 18 34 16 16 0 0 1 3 24Z" fill="#F59E0B"/>
      <path d="M10 28c6-5 12-5 18 0a16 16 0 0 1-18 0Z" fill="#EA580C" opacity="0.65"/>
      <g class="svg-sway">
        <path d="M12.5 24c0-4 .8-7.5 2.2-10" stroke="#92400E" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M14.7 14c-3-1.4-5.2-.2-6 1.5M14.7 14c2.8-1.6 5.2-.5 6 1.4M14.7 14c-.6-2.8 1-4.5 3.2-4.4" stroke="#16A34A" stroke-width="2.2" stroke-linecap="round"/>
      </g>
    </svg>
  `,

  'biome-highland': `
    <svg class="anim-svg svg-biome-highland" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#FEF3C7"/>
      <polygon points="6,27 16,10 25,27" fill="#B45309"/>
      <polygon points="16,10 19.6,16.2 16.8,15.2 14.5,16.8 12.6,15.8" fill="#FFFDF7"/>
      <polygon points="15,28 24,14 32,28" fill="#D97706"/>
      <polygon points="24,14 26.8,18.6 24.4,17.8 22.5,19 21.4,18.2" fill="#FFFDF7"/>
      <path class="svg-leaf-float" d="M27.5 8.5c2 0 3.5 1.5 3.2 3.5-2 .3-3.5-1.2-3.2-3.5Z" fill="#EF4444"/>
    </svg>
  `,

  // ====== 动物交互卡片 4 大话题动态图标 ======
  // 认识我：热情挥动的可爱小肉垫爪爪
  'topic-intro': `
    <svg class="anim-svg svg-wave-paw" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="g-paw" x1="8" y1="8" x2="24" y2="26">
          <stop offset="0%" stop-color="#FFCA4B"/>
          <stop offset="100%" stop-color="#F59E0B"/>
        </linearGradient>
      </defs>
      <g class="svg-paw-wiggle">
        <ellipse cx="16" cy="20.5" rx="6.5" ry="5.4" fill="url(#g-paw)"/>
        <circle cx="9.2" cy="14" r="2.6" fill="url(#g-paw)"/>
        <circle cx="13.8" cy="10.5" r="2.7" fill="url(#g-paw)"/>
        <circle cx="19.2" cy="10.8" r="2.7" fill="url(#g-paw)"/>
        <circle cx="23.4" cy="14.6" r="2.5" fill="url(#g-paw)"/>
        <ellipse cx="16" cy="21" rx="3.4" ry="2.6" fill="#FFE4E6" opacity="0.85"/>
      </g>
    </svg>
  `,

  // 爱吃啥：饱满水润红苹果 + 摇摆嫩叶
  'topic-food': `
    <svg class="anim-svg svg-apple" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="g-apple" cx="35%" cy="32%" r="70%">
          <stop offset="0%" stop-color="#FF8A80"/>
          <stop offset="55%" stop-color="#F43F5E"/>
          <stop offset="100%" stop-color="#BE123C"/>
        </radialGradient>
      </defs>
      <g class="svg-bob">
        <path d="M16 10.5c-4.5-2.6-9.5.8-9.5 6.8 0 5.5 3.7 10 7.2 10 1.4 0 2-.7 2.3-.7.3 0 .9.7 2.3.7 3.5 0 7.2-4.5 7.2-10 0-6-5-9.4-9.5-6.8Z" fill="url(#g-apple)"/>
        <ellipse cx="12" cy="15.5" rx="1.8" ry="3.2" transform="rotate(-18 12 15.5)" fill="#FFF" opacity="0.45"/>
        <path d="M16 10.5c.3-2.5 1.4-4.2 3-5" stroke="#78350F" stroke-width="2" stroke-linecap="round"/>
        <path class="svg-sway" d="M17.2 8.5c2.2-2.6 5.6-2.6 6.8-.5-1.8 2.4-4.8 2.8-6.8.5Z" fill="#22C55E"/>
      </g>
    </svg>
  `,

  // 看绝活：旋转魔法星芒 + 轨道星屑
  'topic-trick': `
    <svg class="anim-svg svg-trick" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="g-star" x1="6" y1="6" x2="26" y2="26">
          <stop offset="0%" stop-color="#FEF08A"/>
          <stop offset="50%" stop-color="#FBBF24"/>
          <stop offset="100%" stop-color="#F97316"/>
        </linearGradient>
      </defs>
      <path class="svg-star-spin" d="M16 4l3.2 7.8L27.5 13l-6.4 5.4 2 8.2L16 22.3l-7.1 4.3 2-8.2L4.5 13l8.3-1.2L16 4Z" fill="url(#g-star)"/>
      <circle cx="14.5" cy="13.5" r="2" fill="#FFF" opacity="0.6"/>
      <path class="svg-twinkle" d="M26 4l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8.8-1.9Z" fill="#38BDF8"/>
    </svg>
  `,

  // 小秘密：温暖发光奇思灯泡
  'topic-secret': `
    <svg class="anim-svg svg-secret" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="g-bulb" cx="45%" cy="38%" r="65%">
          <stop offset="0%" stop-color="#FFFDE7"/>
          <stop offset="60%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#F59E0B"/>
        </radialGradient>
      </defs>
      <circle class="svg-glow-pulse" cx="16" cy="13.5" r="10.5" fill="#FDE047" opacity="0.28"/>
      <path d="M16 5.5a7.5 7.5 0 0 0-4.6 13.4c.7.6 1.1 1.4 1.2 2.3h6.8c.1-.9.5-1.7 1.2-2.3A7.5 7.5 0 0 0 16 5.5Z" fill="url(#g-bulb)"/>
      <rect x="12.4" y="22" width="7.2" height="2.4" rx="1.2" fill="#94A3B8"/>
      <rect x="13.5" y="25.2" width="5" height="2.1" rx="1" fill="#64748B"/>
      <path d="M13.8 14.5c.8-1.4 3.6-1.4 4.4 0" stroke="#FFF" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `,

  // ====== 4 大动作按钮动态图标 ======
  // 摸摸头：跳动暖心双爱心
  'action-pet': `
    <svg class="anim-svg svg-heart" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path class="svg-heartbeat" d="M14 23.5s-8.5-5.3-8.5-11.2C5.5 8.8 8 6.5 10.8 6.5c1.7 0 2.7.9 3.2 1.8.5-.9 1.5-1.8 3.2-1.8 2.8 0 5.3 2.3 5.3 5.8 0 5.9-8.5 11.2-8.5 11.2Z" fill="#FFFDF7"/>
      <path class="svg-twinkle" d="M22.5 4.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7.7-1.6Z" fill="#FFE4E6"/>
    </svg>
  `,

  // 喂零食：满满野果小提篮
  'action-feed': `
    <svg class="anim-svg svg-basket" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <g class="svg-bob">
        <path d="M8.5 12.5C9.5 7.5 18.5 7.5 19.5 12.5" stroke="#FEF3C7" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="11.5" cy="12" r="2.5" fill="#FDE047"/>
        <circle cx="16.5" cy="11.5" r="2.7" fill="#FB7185"/>
        <circle cx="14" cy="10.5" r="2.2" fill="#86EFAC"/>
        <path d="M5.5 13h17l-2.2 9a2.4 2.4 0 0 1-2.3 1.8H10a2.4 2.4 0 0 1-2.3-1.8L5.5 13Z" fill="#FFFDF7"/>
        <path d="M9.5 16.5h9M10.5 20h7" stroke="#10B981" stroke-width="1.8" stroke-linecap="round" opacity="0.65"/>
      </g>
    </svg>
  `,

  // 拍一张：闪烁快门小相机
  'action-photo': `
    <svg class="anim-svg svg-camera" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M5 10.5A2.5 2.5 0 0 1 7.5 8h2.2l1.4-2.1A1.6 1.6 0 0 1 12.4 5h3.2c.5 0 1 .3 1.3.9L18.3 8h2.2A2.5 2.5 0 0 1 23 10.5v9A2.5 2.5 0 0 1 20.5 22h-13A2.5 2.5 0 0 1 5 19.5v-9Z" fill="#FFFDF7"/>
      <circle cx="14" cy="15" r="4.3" fill="#0284C7"/>
      <circle class="svg-lens-pulse" cx="14" cy="15" r="2.3" fill="#7DD3FC"/>
      <circle class="svg-twinkle" cx="19.8" cy="10.8" r="1.3" fill="#FBBF24"/>
    </svg>
  `,

  // 问它问题：跳动魔法对话双气泡
  'action-ai': `
    <svg class="anim-svg svg-chat" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M5.5 12.5C5.5 8.5 9.3 5.5 14 5.5s8.5 3 8.5 7-3.8 7-8.5 7c-1.1 0-2.2-.2-3.2-.5L6.5 21.5l1.2-3.5c-1.4-1.4-2.2-3.3-2.2-5.5Z" fill="#FFFDF7"/>
      <circle class="svg-dot-1" cx="10.4" cy="12.5" r="1.4" fill="#0F766E"/>
      <circle class="svg-dot-2" cx="14" cy="12.5" r="1.4" fill="#0F766E"/>
      <circle class="svg-dot-3" cx="17.6" cy="12.5" r="1.4" fill="#0F766E"/>
      <path class="svg-twinkle" d="M23.2 4.2l.7 1.5 1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7.7-1.5Z" fill="#FEF08A"/>
    </svg>
  `,

  // 麦克风：声波拾音麦
  mic: `
    <svg class="anim-svg svg-mic" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="10.5" y="4.5" width="7" height="12" rx="3.5" fill="#F59E0B"/>
      <path d="M7.5 13.5a6.5 6.5 0 0 0 13 0M14 20v3.5M10.5 23.5h7" stroke="#92400E" stroke-width="2.2" stroke-linecap="round"/>
    </svg>
  `,

  // 关闭圆叉
  close: `
    <svg class="anim-svg svg-close" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>
    </svg>
  `,
};

export function getIconSvg(name) {
  return ICONS[name] || '';
}

export function hydrateStaticIcons(root = document) {
  root.querySelectorAll('[data-svg-icon]').forEach((el) => {
    const key = el.getAttribute('data-svg-icon');
    if (key && ICONS[key]) {
      el.innerHTML = ICONS[key];
    }
  });
}
