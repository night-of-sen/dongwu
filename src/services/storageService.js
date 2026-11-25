const PROGRESS_KEY = 'dongwu_planet_progress_v1';
const DS_CONFIG_KEY = 'dongwu_deepseek_config_v1';
const DS_STATS_KEY = 'dongwu_deepseek_stats_v1';

const DEFAULT_PROGRESS = {
  discovered: {}, // { animalId: { firstMetAt, topicsSeen: [], photo: dataUrl|null, petCount: 0 } }
  stars: 0,
};

const DEFAULT_DS_CONFIG = {
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  apiKey: '',
  priceInMiss: 0.27, // $ per 1M input tokens (cache miss)
  priceInHit: 0.07, // $ per 1M input tokens (cache hit)
  priceOut: 1.1, // $ per 1M output tokens
  fxRate: 7.2, // USD -> CNY
};

const DEFAULT_DS_STATS = {
  logs: [], // { ts, animalName, question, reply, mode, model, promptTokens, cacheHitTokens, cacheMissTokens, completionTokens, latencyMs, costUsd, costCny }
};

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(fallback);
    return { ...structuredClone(fallback), ...JSON.parse(raw) };
  } catch {
    return structuredClone(fallback);
  }
}

function safeWrite(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn('localStorage 写入失败（可能空间已满）:', err);
  }
}

export class StorageService {
  constructor() {
    this.progress = safeRead(PROGRESS_KEY, DEFAULT_PROGRESS);
    this.dsConfig = safeRead(DS_CONFIG_KEY, DEFAULT_DS_CONFIG);
    this.dsStats = safeRead(DS_STATS_KEY, DEFAULT_DS_STATS);
  }

  markDiscovered(animalId) {
    let isNew = false;
    if (!this.progress.discovered[animalId]) {
      this.progress.discovered[animalId] = {
        firstMetAt: Date.now(),
        topicsSeen: [],
        photo: null,
        petCount: 0,
      };
      this.progress.stars += 2;
      isNew = true;
      this.saveProgress();
    }
    return isNew;
  }

  markTopicSeen(animalId, topicKey) {
    this.markDiscovered(animalId);
    const entry = this.progress.discovered[animalId];
    if (!entry.topicsSeen.includes(topicKey)) {
      entry.topicsSeen.push(topicKey);
      this.progress.stars += 1;
      this.saveProgress();
      return true;
    }
    return false;
  }

  saveAnimalPhoto(animalId, dataUrl) {
    this.markDiscovered(animalId);
    const hadPhoto = Boolean(this.progress.discovered[animalId].photo);
    this.progress.discovered[animalId].photo = dataUrl;
    if (!hadPhoto) this.progress.stars += 2;
    this.saveProgress();
  }

  incrementPet(animalId) {
    this.markDiscovered(animalId);
    this.progress.discovered[animalId].petCount += 1;
    this.saveProgress();
  }

  getDiscoveredCount() {
    return Object.keys(this.progress.discovered).length;
  }

  getBiomeDiscoveredCount(animalIds) {
    return animalIds.filter((id) => Boolean(this.progress.discovered[id])).length;
  }

  getAnimalProgress(animalId) {
    return this.progress.discovered[animalId] || null;
  }

  saveProgress() {
    safeWrite(PROGRESS_KEY, this.progress);
  }

  getDeepSeekConfig() {
    return { ...this.dsConfig };
  }

  saveDeepSeekConfig(patch) {
    this.dsConfig = { ...this.dsConfig, ...patch };
    safeWrite(DS_CONFIG_KEY, this.dsConfig);
    return this.getDeepSeekConfig();
  }

  getDeepSeekStats() {
    return this.dsStats;
  }

  appendCostLog(entry) {
    this.dsStats.logs.unshift(entry);
    if (this.dsStats.logs.length > 40) {
      this.dsStats.logs.length = 40;
    }
    safeWrite(DS_STATS_KEY, this.dsStats);
  }

  clearCostLogs() {
    this.dsStats = structuredClone(DEFAULT_DS_STATS);
    safeWrite(DS_STATS_KEY, this.dsStats);
  }
}
