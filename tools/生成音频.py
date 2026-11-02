"""按 docs/data/words.json 用 edge-tts 生成泰语单词、泰语例句、中文释义的 mp3。
已存在的文件会跳过，可重复运行。
用法：python tools/生成音频.py
"""
import asyncio
import json
from pathlib import Path

import edge_tts

根 = Path(__file__).resolve().parent.parent
数据 = json.loads((根 / "docs" / "data" / "words.json").read_text(encoding="utf-8"))
音频 = 根 / "docs" / "audio"
泰声 = "th-TH-PremwadeeNeural"
中声 = "zh-CN-XiaoxiaoNeural"


def 任务列表():
    for w in 数据["words"]:
        yield "th", w["id"], w["th"], 泰声
        yield "ex", w["ex"]["id"], "".join(w["ex"]["seg"]), 泰声
        yield "zh", "z" + w["id"][1:], w["zh"].split("（")[0].replace("/", "，"), 中声


async def 生成(信号, 类, 编号, 文本, 声音):
    文件 = 音频 / 类 / f"{编号}.mp3"
    if 文件.exists() and 文件.stat().st_size > 0:
        return False
    文件.parent.mkdir(parents=True, exist_ok=True)
    async with 信号:
        for 次 in range(3):
            try:
                await edge_tts.Communicate(文本, 声音).save(str(文件))
                return True
            except Exception as e:  # noqa: BLE001
                if 次 == 2:
                    print("失败", 类, 编号, 文本, e)
                    文件.unlink(missing_ok=True)
                await asyncio.sleep(1)
    return False


async def 主():
    信号 = asyncio.Semaphore(6)
    表 = {(t[0], t[1]): t for t in 任务列表()}
    结果 = await asyncio.gather(*(生成(信号, *t) for t in 表.values()))
    print(f"共 {len(表)} 条，新生成 {sum(结果)} 条")


asyncio.run(主())
