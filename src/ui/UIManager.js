import { BIOMES, getBiomeById } from '../data/biomes.js';
import { ANIMALS, getAnimalsByBiome, getAnimalById } from '../data/animals.js';
import { getIconSvg, hydrateStaticIcons } from './AnimatedIcons.js';
import { initButtonEffects } from './ButtonEffects.js';

/**
 * 儿童友好绘本风 UI 管理器（星球浮标、动物交互卡、语音输入、图鉴、DeepSeek 成本测试面板）
 */
export class UIManager {
  constructor({ storage, audio, ai, handlers }) {
    this.storage = storage;
    this.audio = audio;
    this.ai = ai;
    this.handlers = handlers;

    this.currentAnimal = null;
    this.lastSpokenText = '';
    this.planetLabelEls = new Map();
    this.animalBadgeEls = new Map();
    this.toastTimer = null;

    this._cacheDom();
    hydrateStaticIcons(document);
    initButtonEffects();
    this._renderBiomeDock();
    this._bindEvents();
    this._syncDiscoveryCounter();
    this._loadDeepSeekForm();
    this.renderCostStats();

    this.audio.onSpeakingChange = (speaking) => {
      this.el.speakingWave.classList.toggle('hidden', !speaking);
    };
  }

  _cacheDom() {
    const q = (id) => document.getElementById(id);
    this.el = {
      labelsLayer: q('world-labels-layer'),
      transitionVeil: q('transition-veil'),
      transitionEmoji: q('transition-emoji'),
      transitionText: q('transition-text'),
      cameraFlash: q('camera-flash'),
      btnBackPlanet: q('btn-back-planet'),
      sceneSubtitle: q('scene-subtitle'),
      btnDayNight: q('btn-day-night'),
      dayNightIcon: q('day-night-icon'),
      dayNightLabel: q('day-night-label'),
      btnSound: q('btn-sound'),
      soundIcon: q('sound-icon'),
      btnEncyclopedia: q('btn-encyclopedia'),
      discoveredCount: q('discovered-count'),
      btnDevLab: q('btn-dev-lab'),
      planetDock: q('planet-dock'),
      biomePills: q('biome-pills'),
      habitatTip: q('habitat-tip'),
      // Animal Card
      animalCard: q('animal-card'),
      cardEmoji: q('card-emoji'),
      cardName: q('card-name'),
      cardSpecies: q('card-species'),
      cardMood: q('card-mood'),
      cardPersonality: q('card-personality'),
      btnReplayVoice: q('btn-replay-voice'),
      btnCloseCard: q('btn-close-card'),
      speakingWave: q('speaking-wave'),
      speechText: q('speech-text'),
      topicGrid: q('topic-grid'),
      btnPet: q('btn-pet'),
      btnFeed: q('btn-feed'),
      btnPhoto: q('btn-photo'),
      btnToggleAi: q('btn-toggle-ai'),
      aiDrawer: q('ai-drawer'),
      aiModeBadge: q('ai-mode-badge'),
      aiLastCost: q('ai-last-cost'),
      aiQuickChips: q('ai-quick-chips'),
      aiChatForm: q('ai-chat-form'),
      aiQuestionInput: q('ai-question-input'),
      btnMic: q('btn-mic'),
      btnAiSend: q('btn-ai-send'),
      // Encyclopedia
      modalEncyclopedia: q('modal-encyclopedia'),
      encyclopediaSummary: q('encyclopedia-summary'),
      encyclopediaGrid: q('encyclopedia-grid'),
      // Dev Lab
      modalDevLab: q('modal-dev-lab'),
      dsBaseUrl: q('ds-base-url'),
      dsModel: q('ds-model'),
      dsApiKey: q('ds-api-key'),
      priceInMiss: q('price-in-miss'),
      priceInHit: q('price-in-hit'),
      priceOut: q('price-out'),
      priceFx: q('price-fx'),
      btnSaveDs: q('btn-save-ds'),
      btnRunBenchmark: q('btn-run-benchmark'),
      btnClearStats: q('btn-clear-stats'),
      mTurns: q('m-turns'),
      mAvgTokens: q('m-avg-tokens'),
      mAvgCost: q('m-avg-cost'),
      mMonthlyProj: q('m-monthly-proj'),
      costLogList: q('cost-log-list'),
      toast: q('toast'),
    };
  }

  _renderBiomeDock() {
    this.el.biomePills.innerHTML = '';
    BIOMES.forEach((b) => {
      const btn = document.createElement('button');
      btn.className = 'biome-pill';
      btn.dataset.biomeId = b.id;
      btn.style.setProperty('--biome-accent', b.accentColor);
      const ids = getAnimalsByBiome(b.id).map((a) => a.id);
      const found = this.storage.getBiomeDiscoveredCount(ids);
      const badgeSvg = getIconSvg(`biome-${b.id}`) || b.emoji;
      btn.innerHTML = `
        <span class="bp-icon">${badgeSvg}</span>
        <span class="bp-text">
          <strong>${b.name}</strong>
          <small>${found}/${ids.length} 伙伴</small>
        </span>
      `;
      btn.addEventListener('click', () => {
        this.handlers.onEnterBiome(b.id);
      });
      this.el.biomePills.appendChild(btn);
    });
  }

  _bindEvents() {
    this.el.btnBackPlanet.addEventListener('click', () => this.handlers.onReturnPlanet());

    this.el.btnDayNight.addEventListener('click', () => {
      const isNight = this.handlers.onToggleDayNight();
      this.el.dayNightIcon.innerHTML = getIconSvg(isNight ? 'moon' : 'sun');
      this.el.dayNightLabel.textContent = isNight ? '夜晚' : '白天';
      this.el.btnDayNight.classList.toggle('is-night', isNight);
      this.showToast(isNight ? '🌙 夜幕降临，小动物们准备打盹儿啦' : '☀️ 太阳出来啦，小动物们精神满满！');
    });

    this.el.btnSound.addEventListener('click', () => {
      const next = !this.audio.enabled;
      this.audio.setEnabled(next);
      this.el.soundIcon.innerHTML = getIconSvg(next ? 'sound-on' : 'sound-off');
      this.el.btnSound.classList.toggle('is-muted', !next);
      if (next) this.audio.playSfx('pop');
      this.showToast(next ? '🔊 语音与音效已打开' : '🔇 已静音');
    });

    this.el.btnEncyclopedia.addEventListener('click', () => {
      this.audio.playSfx('pop');
      this.renderEncyclopedia();
      this.el.modalEncyclopedia.classList.remove('hidden');
    });

    this.el.btnDevLab.addEventListener('click', () => {
      this.audio.playSfx('pop');
      this._loadDeepSeekForm();
      this.renderCostStats();
      this.el.modalDevLab.classList.remove('hidden');
    });

    // 关闭弹窗
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-close-modal');
        document.getElementById(id)?.classList.add('hidden');
        this.audio.playSfx('pop');
      });
    });

    [this.el.modalEncyclopedia, this.el.modalDevLab].forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.add('hidden');
      });
    });

    // 动物交互卡事件
    this.el.btnCloseCard.addEventListener('click', () => this.handlers.onCloseAnimal());
    this.el.btnReplayVoice.addEventListener('click', () => {
      if (this.currentAnimal && this.lastSpokenText) {
        if (this.lastClipKey) {
          this.audio.speakPreset(this.currentAnimal.id, this.lastClipKey, this.lastSpokenText, this.currentAnimal.voice);
        } else {
          this.audio.speakDynamic(this.currentAnimal.id, this.lastSpokenText, this.currentAnimal.voice);
        }
      }
    });

    this.el.topicGrid.querySelectorAll('.topic-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.currentAnimal) return;
        const topic = btn.dataset.topic;
        this._selectTopic(topic);
      });
    });

    this.el.btnPet.addEventListener('click', () => {
      if (!this.currentAnimal) return;
      this.handlers.onPetAnimal(this.currentAnimal);
    });

    this.el.btnFeed.addEventListener('click', () => {
      if (!this.currentAnimal) return;
      this.handlers.onFeedAnimal(this.currentAnimal);
    });

    this.el.btnPhoto.addEventListener('click', () => {
      if (!this.currentAnimal) return;
      this.handlers.onTakePhoto(this.currentAnimal);
    });

    this.el.btnToggleAi.addEventListener('click', () => {
      const opening = this.el.aiDrawer.classList.contains('hidden');
      this.el.aiDrawer.classList.toggle('hidden', !opening);
      this.el.btnToggleAi.classList.toggle('active', opening);
      this.audio.playSfx('pop');
      this._refreshAiModeBadge();
      if (opening) this.el.aiQuestionInput.focus();
    });

    this.el.aiChatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = this.el.aiQuestionInput.value.trim();
      if (!q || !this.currentAnimal) return;
      this.el.aiQuestionInput.value = '';
      await this._handleAskAI(q);
    });

    this.el.btnMic.addEventListener('click', () => this._startVoiceInput());

    // DeepSeek 成本测试面板事件
    this.el.btnSaveDs.addEventListener('click', () => {
      this._saveDeepSeekForm();
      this.audio.playSfx('star');
      this.showToast('✅ DeepSeek 配置已保存到本机浏览器');
      this._refreshAiModeBadge();
    });

    this.el.btnClearStats.addEventListener('click', () => {
      this.storage.clearCostLogs();
      this.renderCostStats();
      this.audio.playSfx('pop');
      this.showToast('🗑️ 成本测试记录已清空');
    });

    this.el.btnRunBenchmark.addEventListener('click', () => this._runCostBenchmark());
  }

  _syncDiscoveryCounter() {
    const count = this.storage.getDiscoveredCount();
    this.el.discoveredCount.textContent = `${count}/${ANIMALS.length}`;
    this._renderBiomeDock();
  }

  showTransition(biome) {
    if (biome) {
      this.el.transitionEmoji.textContent = biome.emoji;
      this.el.transitionText.textContent = `正在飞往 ${biome.name}...`;
    } else {
      this.el.transitionEmoji.textContent = '🌍';
      this.el.transitionText.textContent = '正在飞回万象星球...';
    }
    this.el.transitionVeil.classList.add('active');
  }

  hideTransition() {
    this.el.transitionVeil.classList.remove('active');
  }

  setModePlanet() {
    this.currentAnimal = null;
    this.el.btnBackPlanet.classList.add('hidden');
    this.el.planetDock.classList.remove('hidden');
    this.el.habitatTip.classList.add('hidden');
    this.el.animalCard.classList.add('hidden');
    this.el.sceneSubtitle.textContent = '滑动旋转星球，点一个地方进去玩吧！';
    this._clearWorldLabels();
    this._syncDiscoveryCounter();
  }

  setModeHabitat(biome) {
    this.currentAnimal = null;
    this.el.btnBackPlanet.classList.remove('hidden');
    this.el.planetDock.classList.add('hidden');
    this.el.habitatTip.classList.remove('hidden');
    this.el.animalCard.classList.add('hidden');
    this.el.sceneSubtitle.textContent = `${biome.emoji} ${biome.name} · ${biome.tagline}`;
    this._clearWorldLabels();
  }

  openAnimalCard(animal, actorStatusText) {
    this.currentAnimal = animal;
    this.el.habitatTip.classList.add('hidden');
    this.el.animalCard.classList.remove('hidden');
    this.el.aiDrawer.classList.add('hidden');
    this.el.btnToggleAi.classList.remove('active');
    this.el.aiLastCost.textContent = '';

    this.el.cardEmoji.textContent = animal.emoji;
    this.el.cardName.textContent = animal.name;
    this.el.cardSpecies.textContent = animal.species;
    this.el.cardMood.textContent = actorStatusText || '热情向你打招呼';
    this.el.cardPersonality.textContent = animal.personality;

    // 渲染快捷儿童提问芯片
    this.el.aiQuickChips.innerHTML = '';
    (animal.quickQuestions || []).forEach((q) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'quick-chip';
      chip.textContent = q;
      chip.addEventListener('click', () => this._handleAskAI(q));
      this.el.aiQuickChips.appendChild(chip);
    });

    this._refreshAiModeBadge();
    this._selectTopic('intro');
    this._syncDiscoveryCounter();
  }

  closeAnimalCard() {
    this.currentAnimal = null;
    this.el.animalCard.classList.add('hidden');
    this.el.habitatTip.classList.remove('hidden');
    this.audio.stopSpeaking();
  }

  _selectTopic(topicKey) {
    if (!this.currentAnimal) return;
    this.el.topicGrid.querySelectorAll('.topic-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.topic === topicKey);
    });

    const text = this.currentAnimal.topics[topicKey] || this.currentAnimal.topics.intro;
    this.setSpeech(text, this.currentAnimal.voice, topicKey);
    this.storage.markTopicSeen(this.currentAnimal.id, topicKey);
    this._syncDiscoveryCounter();

    this.handlers.onTopicTriggered?.(this.currentAnimal, topicKey);
  }

  setSpeech(text, voiceOpts, clipKey = null) {
    this.lastSpokenText = text;
    this.lastClipKey = clipKey;
    this.el.speechText.textContent = text;
    if (!this.currentAnimal) return;
    if (clipKey) {
      this.audio.speakPreset(this.currentAnimal.id, clipKey, text, voiceOpts);
    } else {
      this.audio.speakDynamic(this.currentAnimal.id, text, voiceOpts);
    }
  }

  updateMoodLabel(text) {
    this.el.cardMood.textContent = text;
  }

  triggerCameraFlash() {
    this.el.cameraFlash.classList.remove('flash');
    void this.el.cameraFlash.offsetWidth;
    this.el.cameraFlash.classList.add('flash');
  }

  _refreshAiModeBadge() {
    if (this.ai.isLiveConfigured()) {
      const cfg = this.storage.getDeepSeekConfig();
      this.el.aiModeBadge.textContent = `🟢 DeepSeek 实时接入 (${cfg.model})`;
      this.el.aiModeBadge.classList.add('live');
    } else {
      this.el.aiModeBadge.textContent = '🧪 模拟模式（可在右上角「AI测试」填入 DeepSeek Key）';
      this.el.aiModeBadge.classList.remove('live');
    }
  }

  async _handleAskAI(question) {
    if (!this.currentAnimal) return;
    const animal = this.currentAnimal;
    this.el.btnAiSend.disabled = true;
    this.el.speechText.textContent = `${animal.name}正在歪着小脑袋想答案...`;
    this.updateMoodLabel('认真思考中');

    try {
      const rec = await this.ai.askAnimal(animal, question);
      if (this.currentAnimal?.id === animal.id) {
        this.setSpeech(rec.reply, animal.voice);
        this.updateMoodLabel('开心回答你');
        this.el.aiLastCost.textContent = `本次 ${rec.promptTokens}入/${rec.completionTokens}出 · ¥${rec.costCny.toFixed(5)}`;
        this.handlers.onAiReplied?.(animal);
      }
      this.renderCostStats();
    } catch (err) {
      this.showToast(`⚠️ AI 请求失败：${err.message}`);
      this.el.speechText.textContent = '哎呀，小信号飞走了一下，我们再试一次吧！';
    } finally {
      this.el.btnAiSend.disabled = false;
    }
  }

  _startVoiceInput() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      this.showToast('当前浏览器暂不支持麦克风语音识别，可以直接点上面的快捷问题哦！');
      return;
    }
    const rec = new SpeechRec();
    rec.lang = 'zh-CN';
    rec.interimResults = false;
    this.el.btnMic.classList.add('listening');
    this.showToast('🎤 请说话，我正在认真听...');

    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        this.el.aiQuestionInput.value = transcript;
        this._handleAskAI(transcript);
      }
    };
    rec.onerror = () => this.showToast('没听清楚，再点一下麦克风试试吧！');
    rec.onend = () => this.el.btnMic.classList.remove('listening');
    rec.start();
  }

  // ================= 3D 屏幕投影标签 =================
  _clearWorldLabels() {
    this.el.labelsLayer.innerHTML = '';
    this.planetLabelEls.clear();
    this.animalBadgeEls.clear();
  }

  updatePlanetLabels(labels) {
    labels.forEach((item) => {
      let el = this.planetLabelEls.get(item.id);
      if (!el) {
        el = document.createElement('button');
        el.className = 'planet-float-badge';
        el.style.setProperty('--biome-accent', item.biome.accentColor);
        const ids = getAnimalsByBiome(item.id).map((a) => a.id);
        const found = this.storage.getBiomeDiscoveredCount(ids);
        el.innerHTML = `
          <span class="pf-top"><span>${item.biome.emoji}</span> <strong>${item.biome.name}</strong> <em class="pf-count">${found}/${ids.length}</em></span>
          <span class="pf-sub">${item.biome.liveStatus}</span>
        `;
        el.addEventListener('click', () => this.handlers.onEnterBiome(item.id));
        this.el.labelsLayer.appendChild(el);
        this.planetLabelEls.set(item.id, el);
      }
      if (!item.visible) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      } else {
        const alpha = Math.min(1, (item.facing - 0.14) * 2.2);
        el.style.opacity = String(alpha.toFixed(2));
        el.style.pointerEvents = alpha > 0.35 ? 'auto' : 'none';
        el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0) translate(-50%, -100%)`;
      }
    });
  }

  updateAnimalBadges(badges) {
    const activeIds = new Set(badges.map((b) => b.id));
    this.animalBadgeEls.forEach((el, id) => {
      if (!activeIds.has(id)) {
        el.remove();
        this.animalBadgeEls.delete(id);
      }
    });

    badges.forEach((b) => {
      let el = this.animalBadgeEls.get(b.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'animal-float-badge';
        this.el.labelsLayer.appendChild(el);
        this.animalBadgeEls.set(b.id, el);
      }
      el.textContent = b.hovered ? `${b.emoji} 点我聊一聊` : b.emoji;
      el.classList.toggle('is-hovered', b.hovered);
      el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) translate(-50%, -100%)`;
    });
  }

  // ================= 动物图鉴弹窗 =================
  renderEncyclopedia() {
    const found = this.storage.getDiscoveredCount();
    const stars = this.storage.progress.stars || 0;
    this.el.encyclopediaSummary.textContent = `已认识 ${found} / ${ANIMALS.length} 位动物朋友 · 收集星星 ⭐ ${stars}`;

    this.el.encyclopediaGrid.innerHTML = '';
    ANIMALS.forEach((animal) => {
      const prog = this.storage.getAnimalProgress(animal.id);
      const biome = getBiomeById(animal.biomeId);
      const card = document.createElement('div');
      card.className = `ency-card ${prog ? 'unlocked' : 'locked'}`;

      if (prog) {
        const photoHtml = prog.photo
          ? `<img class="ency-photo" src="${prog.photo}" alt="${animal.name}的拍立得照片" />`
          : `<div class="ency-emoji-stage">${animal.emoji}</div>`;
        card.innerHTML = `
          ${photoHtml}
          <div class="ency-info">
            <div class="ency-title"><strong>${animal.name}</strong><span>${animal.species}</span></div>
            <div class="ency-meta">${biome.emoji} ${biome.name} · 听过 ${prog.topicsSeen.length}/4 故事</div>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div class="ency-emoji-stage locked-stage">❓</div>
          <div class="ency-info">
            <div class="ency-title"><strong>神秘动物</strong><span>未遇见</span></div>
            <div class="ency-meta">快去 ${biome.emoji} ${biome.name} 找找它吧！</div>
          </div>
        `;
      }
      this.el.encyclopediaGrid.appendChild(card);
    });
  }

  // ================= DeepSeek 成本测试实验室 =================
  _loadDeepSeekForm() {
    const cfg = this.storage.getDeepSeekConfig();
    this.el.dsBaseUrl.value = cfg.baseUrl;
    this.el.dsModel.value = cfg.model;
    this.el.dsApiKey.value = cfg.apiKey;
    this.el.priceInMiss.value = cfg.priceInMiss;
    this.el.priceInHit.value = cfg.priceInHit;
    this.el.priceOut.value = cfg.priceOut;
    this.el.priceFx.value = cfg.fxRate;
  }

  _saveDeepSeekForm() {
    this.storage.saveDeepSeekConfig({
      baseUrl: this.el.dsBaseUrl.value.trim() || 'https://api.deepseek.com',
      model: this.el.dsModel.value,
      apiKey: this.el.dsApiKey.value.trim(),
      priceInMiss: parseFloat(this.el.priceInMiss.value) || 0.27,
      priceInHit: parseFloat(this.el.priceInHit.value) || 0.07,
      priceOut: parseFloat(this.el.priceOut.value) || 1.1,
      fxRate: parseFloat(this.el.priceFx.value) || 7.2,
    });
    this.renderCostStats();
  }

  async _runCostBenchmark() {
    this._saveDeepSeekForm();
    const btn = this.el.btnRunBenchmark;
    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = '⏳ 正在运行 3 轮问答测试...';

    const samples = [
      { id: 'fox', q: '你的蓬松大尾巴冬天能当被子吗？' },
      { id: 'husky', q: '你在雪地里光着小脚丫跑步不怕冷吗？' },
      { id: 'apatosaurus', q: '你这么高的脖子吃树叶累不累呀？' },
    ];

    try {
      for (const s of samples) {
        const animal = getAnimalById(s.id);
        await this.ai.askAnimal(animal, s.q);
        this.renderCostStats();
      }
      this.audio.playSfx('star');
      this.showToast(
        this.ai.isLiveConfigured()
          ? '✅ 已完成 3 轮 DeepSeek 真实 API 成本测算！'
          : '✅ 已完成 3 轮本地模拟成本测算（填入 API Key 可测真实账单）'
      );
    } catch (err) {
      this.showToast(`⚠️ 测试中断：${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  renderCostStats() {
    const m = this.ai.getSummaryMetrics();
    this.el.mTurns.textContent = `${m.turns} 次`;
    this.el.mAvgTokens.textContent = `${m.avgIn} / ${m.avgOut}`;
    this.el.mAvgCost.textContent = `¥${m.avgCostCny.toFixed(5)}`;
    this.el.mMonthlyProj.textContent = `¥${m.monthlyProjCny.toFixed(2)} / 月`;

    const logs = this.storage.getDeepSeekStats().logs || [];
    if (!logs.length) {
      this.el.costLogList.innerHTML =
        '<div class="empty-log">尚无测试记录。你可以点击「运行 3 轮儿童问答成本基准测试」或直接点击小动物用「问它问题」实时测量。</div>';
      return;
    }

    this.el.costLogList.innerHTML = logs
      .map(
        (l) => `
      <div class="cost-log-item">
        <div class="log-head">
          <span><strong>${l.animalName}</strong> · ${l.mode === 'deepseek-live' ? '🟢 实测' : '🧪 模拟'} (${l.model})</span>
          <span class="log-cost">¥${l.costCny.toFixed(5)} · ${l.latencyMs}ms</span>
        </div>
        <div class="log-q">问：${l.question}</div>
        <div class="log-a">答：${l.reply}</div>
        <div class="log-tokens">
          输入 ${l.promptTokens}（缓存命中 ${l.cacheHitTokens} / 未命中 ${l.cacheMissTokens}） · 输出 ${l.completionTokens}
        </div>
      </div>
    `
      )
      .join('');
  }

  showToast(message) {
    this.el.toast.textContent = message;
    this.el.toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.el.toast.classList.add('hidden');
    }, 3000);
  }
}
