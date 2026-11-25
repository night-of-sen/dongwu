import { getBiomeById } from '../data/biomes.js';

/**
 * 预留标准化 AI 对话服务（内置 DeepSeek OpenAI 兼容接口 + 本地模拟降级 + Token/成本精准测算）
 */
export class AIService {
  constructor(storage) {
    this.storage = storage;
    // 每只动物独立维护极短对话上下文（最多保留 3 轮，严控输入 Token）
    this.historyByAnimal = new Map();
  }

  isLiveConfigured() {
    const cfg = this.storage.getDeepSeekConfig();
    return Boolean(cfg.apiKey && cfg.apiKey.trim().length > 6);
  }

  /**
   * 固定前缀的儿童安全 System Prompt（高前缀复用率，利于 DeepSeek Prompt Cache 降本）
   */
  buildSystemPrompt(animal) {
    const biome = getBiomeById(animal.biomeId);
    return [
      '你是3D儿童科普游戏《万象星野》里的动物好朋友。',
      '规则：1）全程用第一人称、温暖可爱的儿童口语回答4到10岁小朋友的问题；',
      '2）每次回复控制在45到75个汉字以内，短句为主，方便语音朗读；',
      '3）内容必须科学准确、积极安全，绝不出现恐怖、暴力或成人话题；',
      '4）回复结尾偶尔可以用一句轻松的话鼓励孩子观察自然。',
      `当前角色：${animal.species}「${animal.name}」，性格：${animal.personality}，居住在「${biome.name}」。`,
    ].join('\n');
  }

  calculateCost({ cacheHitTokens = 0, cacheMissTokens = 0, completionTokens = 0 }) {
    const cfg = this.storage.getDeepSeekConfig();
    const costUsd =
      (cacheHitTokens / 1_000_000) * Number(cfg.priceInHit || 0) +
      (cacheMissTokens / 1_000_000) * Number(cfg.priceInMiss || 0) +
      (completionTokens / 1_000_000) * Number(cfg.priceOut || 0);
    const costCny = costUsd * Number(cfg.fxRate || 7.2);
    return { costUsd, costCny };
  }

  /**
   * 估算中英文混合 Token 数（本地模拟模式用）
   */
  _estimateTokens(text) {
    if (!text) return 0;
    const cnChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - cnChars;
    return Math.ceil(cnChars * 0.65 + otherChars * 0.35);
  }

  async askAnimal(animal, question, { forceMock = false } = {}) {
    const cleanQ = String(question || '').trim();
    if (!cleanQ) throw new Error('问题不能为空');

    const systemPrompt = this.buildSystemPrompt(animal);
    const history = this.historyByAnimal.get(animal.id) || [];
    const recentHistory = history.slice(-6); // 最多 3 轮（6 条消息）
    const cfg = this.storage.getDeepSeekConfig();
    const useLive = !forceMock && this.isLiveConfigured();

    const startTime = performance.now();

    if (useLive) {
      const endpoint = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`;
      const messages = [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
        { role: 'user', content: cleanQ },
      ];

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: cfg.model || 'deepseek-chat',
          messages,
          max_tokens: 110,
          temperature: 0.75,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`DeepSeek 接口返回 ${resp.status}: ${errText.slice(0, 140)}`);
      }

      const data = await resp.json();
      const reply = (data?.choices?.[0]?.message?.content || '').trim() || animal.mockReplies.default;
      const usage = data?.usage || {};
      const promptTokens = usage.prompt_tokens ?? this._estimateTokens(systemPrompt + cleanQ);
      const cacheHitTokens = usage.prompt_cache_hit_tokens ?? 0;
      const cacheMissTokens =
        usage.prompt_cache_miss_tokens ?? Math.max(0, promptTokens - cacheHitTokens);
      const completionTokens = usage.completion_tokens ?? this._estimateTokens(reply);
      const latencyMs = Math.round(performance.now() - startTime);
      const { costUsd, costCny } = this.calculateCost({
        cacheHitTokens,
        cacheMissTokens,
        completionTokens,
      });

      this._pushHistory(animal.id, cleanQ, reply);

      const record = {
        ts: Date.now(),
        animalName: `${animal.emoji} ${animal.name}`,
        question: cleanQ,
        reply,
        mode: 'deepseek-live',
        model: cfg.model || 'deepseek-chat',
        promptTokens,
        cacheHitTokens,
        cacheMissTokens,
        completionTokens,
        latencyMs,
        costUsd,
        costCny,
      };
      this.storage.appendCostLog(record);
      return record;
    }

    // 本地模拟模式（零费用预览互动流程 + 模拟 Token 测算）
    await new Promise((r) => setTimeout(r, 380));
    const reply = this._pickMockReply(animal, cleanQ);
    const sysTokens = this._estimateTokens(systemPrompt);
    const historyTokens = recentHistory.reduce((acc, m) => acc + this._estimateTokens(m.content), 0);
    const qTokens = this._estimateTokens(cleanQ);
    const promptTokens = sysTokens + historyTokens + qTokens + 24;
    // 模拟：首轮后 System Prompt 命中缓存
    const cacheHitTokens = recentHistory.length > 0 ? Math.round(sysTokens * 0.85) : 0;
    const cacheMissTokens = Math.max(0, promptTokens - cacheHitTokens);
    const completionTokens = this._estimateTokens(reply) + 6;
    const latencyMs = Math.round(performance.now() - startTime);
    const { costUsd, costCny } = this.calculateCost({
      cacheHitTokens,
      cacheMissTokens,
      completionTokens,
    });

    this._pushHistory(animal.id, cleanQ, reply);

    const record = {
      ts: Date.now(),
      animalName: `${animal.emoji} ${animal.name}`,
      question: cleanQ,
      reply,
      mode: 'mock-estimate',
      model: `${cfg.model || 'deepseek-chat'} (模拟)`,
      promptTokens,
      cacheHitTokens,
      cacheMissTokens,
      completionTokens,
      latencyMs,
      costUsd,
      costCny,
    };
    this.storage.appendCostLog(record);
    return record;
  }

  _pickMockReply(animal, question) {
    const entries = Object.entries(animal.mockReplies || {});
    for (const [kw, text] of entries) {
      if (kw !== 'default' && question.includes(kw)) {
        return text;
      }
    }
    return animal.mockReplies?.default || `${animal.topics.secret}`;
  }

  _pushHistory(animalId, q, a) {
    const list = this.historyByAnimal.get(animalId) || [];
    list.push({ role: 'user', content: q }, { role: 'assistant', content: a });
    this.historyByAnimal.set(animalId, list.slice(-6));
  }

  /**
   * 汇总所有测试记录的成本指标 + 1000 名儿童月度预估
   */
  getSummaryMetrics() {
    const logs = this.storage.getDeepSeekStats().logs || [];
    const turns = logs.length;
    if (turns === 0) {
      return {
        turns: 0,
        avgIn: 0,
        avgOut: 0,
        avgCostCny: 0,
        monthlyProjCny: 0,
      };
    }
    const totalIn = logs.reduce((s, x) => s + (x.promptTokens || 0), 0);
    const totalOut = logs.reduce((s, x) => s + (x.completionTokens || 0), 0);
    const totalCny = logs.reduce((s, x) => s + (x.costCny || 0), 0);
    const avgCostCny = totalCny / turns;
    // 1000 名活跃儿童 × 8 次提问/天 × 30 天 = 240,000 次/月
    const monthlyProjCny = avgCostCny * 1000 * 8 * 30;
    return {
      turns,
      avgIn: Math.round(totalIn / turns),
      avgOut: Math.round(totalOut / turns),
      avgCostCny,
      monthlyProjCny,
    };
  }
}
