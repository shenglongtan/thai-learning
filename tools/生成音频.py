"""按 docs/data/words.json 用 edge-tts 生成泰语单词、泰语例句、中文释义的 mp3。
已存在的文件会跳过，可重复运行。
用法：python tools/生成音频.py
"""
import asyncio
import json
import re
from pathlib import Path

import edge_tts

根 = Path(__file__).resolve().parent.parent
数据 = json.loads((根 / "docs" / "data" / "words.json").read_text(encoding="utf-8"))
音频 = 根 / "docs" / "audio"
# 默认男声；女性用语（词库里标 g=f）用女声
声 = {
    ("th", "m"): "th-TH-NiwatNeural", ("th", "f"): "th-TH-PremwadeeNeural",
    ("zh", "m"): "zh-CN-YunxiNeural", ("zh", "f"): "zh-CN-XiaoxiaoNeural",
}
旧声 = {"th": "th-TH-PremwadeeNeural", "zh": "zh-CN-XiaoxiaoNeural"}  # 清单里没有记录的旧文件都是这两个女声
清单文件 = 根 / "docs" / "audio" / "声音.json"
清单 = json.loads(清单文件.read_text(encoding="utf-8")) if 清单文件.exists() else {}


def 存清单():
    清单文件.write_text(json.dumps(清单, ensure_ascii=False, indent=0, sort_keys=True), encoding="utf-8")


def 任务列表():
    for w in 数据["words"]:
        女 = w.get("g") == "f"
        例女 = w["ex"].get("g") == "f"
        yield "th", w["id"], w["th"], 声["th", "f" if 女 else "m"]
        yield "ex", w["ex"]["id"], "".join(w["ex"]["seg"]), 声["th", "f" if 例女 else "m"]
        # 例句的中文翻译（去掉括号里的"男士说"之类提示），自动连读可选读出
        yield "ezh", w["ex"]["id"], re.sub(r"（[^）]*）", "", w["ex"]["zh"]), 声["zh", "f" if 例女 else "m"]
        yield "zh", "z" + w["id"][1:], (w["zh"].split("（")[0] or re.sub("[（）]", "", w["zh"])).replace("/", "，"), 声["zh", "f" if 女 else "m"]


async def 生成(信号, 类, 编号, 文本, 声音):
    文件 = 音频 / 类 / f"{编号}.mp3"
    键 = f"{类}/{编号}"
    现声 = 清单.get(键, 旧声["zh" if 类 == "zh" else "th"])
    if 文件.exists() and 文件.stat().st_size > 0 and 现声 == 声音:
        return False
    文件.parent.mkdir(parents=True, exist_ok=True)
    async with 信号:
        for 次 in range(3):
            try:
                await edge_tts.Communicate(文本, 声音).save(str(文件))
                清单[键] = 声音
                存清单()
                return True
            except Exception as e:  # noqa: BLE001
                if 次 == 2:
                    print("失败", 类, 编号, 文本, e)
                await asyncio.sleep(1)
    return False


async def 主():
    信号 = asyncio.Semaphore(6)
    表 = {(t[0], t[1]): t for t in 任务列表()}
    结果 = await asyncio.gather(*(生成(信号, *t) for t in 表.values()))
    存清单()
    print(f"共 {len(表)} 条，新生成 {sum(结果)} 条")


asyncio.run(主())
