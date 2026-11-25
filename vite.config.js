import { defineConfig } from 'vite';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const execFileAsync = promisify(execFile);

const VOICE_CAST = {
  lion: { voice: 'zh-CN-YunjianNeural', rate: '-4%', pitch: '-3Hz' },
  fox: { voice: 'zh-CN-XiaoyiNeural', rate: '+4%', pitch: '+4Hz' },
  stag: { voice: 'zh-CN-YunyangNeural', rate: '-4%', pitch: '-2Hz' },
  polarbear: { voice: 'zh-CN-YunyangNeural', rate: '-5%', pitch: '-4Hz' },
  wolf: { voice: 'zh-CN-YunxiNeural', rate: '-3%', pitch: '-4Hz' },
  husky: { voice: 'zh-CN-YunxiaNeural', rate: '+6%', pitch: '+3Hz' },
  orca: { voice: 'zh-CN-YunxiNeural', rate: '-2%', pitch: '-2Hz' },
  dolphin: { voice: 'zh-CN-XiaoyiNeural', rate: '+5%', pitch: '+4Hz' },
  mantaray: { voice: 'zh-CN-XiaoxiaoNeural', rate: '-5%', pitch: '-2Hz' },
  shark: { voice: 'zh-CN-YunjianNeural', rate: '+0%', pitch: '-2Hz' },
  trex: { voice: 'zh-CN-YunjianNeural', rate: '-6%', pitch: '-5Hz' },
  apatosaurus: { voice: 'zh-CN-YunyangNeural', rate: '-8%', pitch: '-6Hz' },
  triceratops: { voice: 'zh-CN-YunxiNeural', rate: '+1%', pitch: '-1Hz' },
  stegosaurus: { voice: 'zh-CN-XiaoxiaoNeural', rate: '-2%', pitch: '+1Hz' },
  camel: { voice: 'zh-CN-YunyangNeural', rate: '-6%', pitch: '-2Hz' },
  goat: { voice: 'zh-CN-YunxiaNeural', rate: '+6%', pitch: '+5Hz' },
  flamingo: { voice: 'zh-CN-XiaoxiaoNeural', rate: '+3%', pitch: '+4Hz' },
  bear: { voice: 'zh-CN-YunyangNeural', rate: '-6%', pitch: '-5Hz' },
  horse: { voice: 'zh-CN-YunxiNeural', rate: '+2%', pitch: '-1Hz' },
  doe: { voice: 'zh-CN-XiaoyiNeural', rate: '+0%', pitch: '+3Hz' },
};

const ttsMemoryCache = new Map();

/**
 * Vite 开发服务器内置神经网络中文语音合成接口（POST /api/tts）
 * 用于 DeepSeek AI 自由问答回复的实时自然人声播报
 */
function neuralTtsPlugin() {
  return {
    name: 'neural-tts-middleware',
    configureServer(server) {
      server.middlewares.use('/api/tts', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        try {
          let raw = '';
          for await (const chunk of req) raw += chunk;
          const { text = '', animalId = 'fox' } = JSON.parse(raw || '{}');
          const clean = String(text).trim().slice(0, 260);
          if (!clean) {
            res.statusCode = 400;
            res.end('Missing text');
            return;
          }

          const cast = VOICE_CAST[animalId] || VOICE_CAST.fox;
          const cacheKey = crypto
            .createHash('md5')
            .update(`${cast.voice}|${cast.rate}|${cast.pitch}|${clean}`)
            .digest('hex');

          let mp3Buffer = ttsMemoryCache.get(cacheKey);
          if (!mp3Buffer) {
            const tmpPath = path.join(os.tmpdir(), `dongwu_tts_${cacheKey}.mp3`);
            await execFileAsync(
              'python3',
              [
                '-m',
                'edge_tts',
                '--voice',
                cast.voice,
                `--rate=${cast.rate}`,
                `--pitch=${cast.pitch}`,
                '--text',
                clean,
                '--write-media',
                tmpPath,
              ],
              { timeout: 15000 }
            );
            mp3Buffer = await fs.readFile(tmpPath);
            fs.unlink(tmpPath).catch(() => {});
            if (ttsMemoryCache.size > 120) {
              const firstKey = ttsMemoryCache.keys().next().value;
              ttsMemoryCache.delete(firstKey);
            }
            ttsMemoryCache.set(cacheKey, mp3Buffer);
          }

          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.end(mp3Buffer);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(err?.message || err) }));
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [neuralTtsPlugin()],
});
