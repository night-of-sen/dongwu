#!/usr/bin/env python3
"""
使用 Microsoft Edge 神经网络中文语音（edge-tts）为 12 种动物批量生成自然、富有表现力的儿童配音 MP3。
"""
import asyncio
import json
import os
import subprocess
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "audio" / "voices"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 为 20 种动物量身选角（动画活泼童声 / 温柔故事姐姐 / 阳光少年 / 沉稳大哥哥）
VOICE_CAST = {
    "lion":        {"voice": "zh-CN-YunjianNeural",  "rate": "-4%",  "pitch": "-3Hz"},
    "fox":         {"voice": "zh-CN-XiaoyiNeural",   "rate": "+4%",  "pitch": "+4Hz"},
    "stag":        {"voice": "zh-CN-YunyangNeural",  "rate": "-4%",  "pitch": "-2Hz"},
    "polarbear":   {"voice": "zh-CN-YunyangNeural",  "rate": "-5%",  "pitch": "-4Hz"},
    "wolf":        {"voice": "zh-CN-YunxiNeural",    "rate": "-3%",  "pitch": "-4Hz"},
    "husky":       {"voice": "zh-CN-YunxiaNeural",   "rate": "+6%",  "pitch": "+3Hz"},
    "orca":        {"voice": "zh-CN-YunxiNeural",    "rate": "-2%",  "pitch": "-2Hz"},
    "dolphin":     {"voice": "zh-CN-XiaoyiNeural",   "rate": "+5%",  "pitch": "+4Hz"},
    "mantaray":    {"voice": "zh-CN-XiaoxiaoNeural", "rate": "-5%",  "pitch": "-2Hz"},
    "shark":       {"voice": "zh-CN-YunjianNeural",  "rate": "+0%",  "pitch": "-2Hz"},
    "trex":        {"voice": "zh-CN-YunjianNeural",  "rate": "-6%",  "pitch": "-5Hz"},
    "apatosaurus": {"voice": "zh-CN-YunyangNeural",  "rate": "-8%",  "pitch": "-6Hz"},
    "triceratops": {"voice": "zh-CN-YunxiNeural",    "rate": "+1%",  "pitch": "-1Hz"},
    "stegosaurus": {"voice": "zh-CN-XiaoxiaoNeural", "rate": "-2%",  "pitch": "+1Hz"},
    "camel":       {"voice": "zh-CN-YunyangNeural",  "rate": "-6%",  "pitch": "-2Hz"},
    "goat":        {"voice": "zh-CN-YunxiaNeural",   "rate": "+6%",  "pitch": "+5Hz"},
    "flamingo":    {"voice": "zh-CN-XiaoxiaoNeural", "rate": "+3%",  "pitch": "+4Hz"},
    "bear":        {"voice": "zh-CN-YunyangNeural",  "rate": "-6%",  "pitch": "-5Hz"},
    "horse":       {"voice": "zh-CN-YunxiNeural",    "rate": "+2%",  "pitch": "-1Hz"},
    "doe":         {"voice": "zh-CN-XiaoyiNeural",   "rate": "+0%",  "pitch": "+3Hz"},
}

REFRESH_IDS = {"husky", "apatosaurus", "bear"}

def load_animals():
    out = subprocess.check_output(
        ["node", "--input-type=module", "-e", "import { ANIMALS } from './src/data/animals.js'; console.log(JSON.stringify(ANIMALS));"],
        cwd=str(ROOT),
        text=True,
    )
    return json.loads(out)

async def synth_one(sem, animal_id, key, text):
    cast = VOICE_CAST.get(animal_id, {"voice": "zh-CN-XiaoyiNeural", "rate": "+0%", "pitch": "+0Hz"})
    dst = OUT_DIR / f"{animal_id}_{key}.mp3"
    if dst.exists() and dst.stat().st_size > 1000 and animal_id not in REFRESH_IDS:
        return True
    async with sem:
        for attempt in range(3):
            try:
                comm = edge_tts.Communicate(text, voice=cast["voice"], rate=cast["rate"], pitch=cast["pitch"])
                await comm.save(str(dst))
                if dst.exists() and dst.stat().st_size > 1000:
                    return True
            except Exception as e:
                if attempt == 2:
                    print(f"FAILED {dst.name}: {e}")
                await asyncio.sleep(0.8 * (attempt + 1))
    return False

async def main():
    animals = load_animals()
    sem = asyncio.Semaphore(8)
    tasks = []
    for a in animals:
        aid = a["id"]
        for k, text in a["topics"].items():
            tasks.append(synth_one(sem, aid, k, text))
        tasks.append(synth_one(sem, aid, "pet", a["petReaction"]))
        tasks.append(synth_one(sem, aid, "feed", a["feedReaction"]))

    results = await asyncio.gather(*tasks)
    ok = sum(1 for r in results if r)
    print(f"Generated {ok}/{len(results)} neural Chinese voice MP3s in {OUT_DIR}")

if __name__ == "__main__":
    asyncio.run(main())
