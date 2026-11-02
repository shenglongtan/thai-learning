"""读取 data/源词库.txt，校验后生成 docs/data/words.json，并生成图标与静音音频。
用法：python tools/生成词库.py
"""
import hashlib
import json
import sys
from pathlib import Path

根 = Path(__file__).resolve().parent.parent
源 = 根 / "data" / "源词库.txt"
输出 = 根 / "docs" / "data" / "words.json"

声调说明 = {
    "H": "「ห」是引导字：不发音，但让后面的低辅音按高辅音规则定调。",
    "A": "「อ」是引导字：不发音，但让后面的「ย」按中辅音规则定调。",
}


def 编号(前缀, 文本):
    return 前缀 + hashlib.sha1(文本.encode("utf-8")).hexdigest()[:8]


def 主函数():
    分类 = []
    词 = []
    错误 = []
    见过 = set()
    for 行号, 行 in enumerate(源.read_text(encoding="utf-8").splitlines(), 1):
        行 = 行.strip()
        if not 行 or 行.startswith("# "):
            continue
        列 = 行.split("#")
        if 列[0] == "@cat":
            分类.append({"id": 列[1], "name": 列[2], "icon": 列[3], "desc": 列[4]})
            continue
        if len(列) != 7:
            错误.append(f"第{行号}行列数不对：{行[:30]}")
            continue
        泰文, 罗马, 中文, 分词, 例罗马, 例中文, 代码 = 列
        if 泰文 in 见过:
            错误.append(f"第{行号}行重复：{泰文}")
        见过.add(泰文)
        段 = 分词.split("|")
        例泰文 = "".join(段)
        if len(段) != len(例罗马.split(" ")):
            错误.append(f"第{行号}行例句分词数与罗马音词数不一致：{泰文}")
        # 目标词在例句里的位置（连续几个分词拼起来等于目标词）
        高亮 = None
        for i in range(len(段)):
            拼 = ""
            for j in range(i, len(段)):
                拼 += 段[j]
                if 拼 == 泰文:
                    高亮 = [i, j + 1]
                    break
            if 高亮:
                break
        if 高亮 is None:
            print(f"提示：第{行号}行例句里没有单独出现目标词：{泰文}")
        词.append({
            "id": 编号("w", 泰文),
            "cat": 分类[-1]["id"],
            "th": 泰文,
            "rom": 罗马,
            "zh": 中文,
            "note": 声调说明.get(代码, ""),
            "ex": {
                "id": 编号("e", 例泰文),
                "seg": 段,
                "rom": 例罗马,
                "zh": 例中文,
                "hl": 高亮,
            },
        })
    ids = [w["id"] for w in 词]
    if len(ids) != len(set(ids)):
        错误.append("编号冲突")
    if 错误:
        print("\n".join(错误))
        sys.exit(1)
    输出.parent.mkdir(parents=True, exist_ok=True)
    输出.write_text(json.dumps({"cats": 分类, "words": 词}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"已生成 {len(词)} 个词、{len(分类)} 个分类 -> {输出}")
    生成资源()


def 生成资源():
    # 静音 mp3：约 1 秒，用来在陪睡模式的间隔里保持音频会话不被系统挂起
    帧 = bytes([0xFF, 0xFB, 0x90, 0x64]) + bytes(413)
    目录 = 根 / "docs" / "audio"
    目录.mkdir(parents=True, exist_ok=True)
    (目录 / "silence.mp3").write_bytes(帧 * 39)
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("没有 PIL，跳过图标")
        return
    for 边 in (180, 192, 512):
        图 = Image.new("RGB", (边, 边), (18, 32, 58))
        画 = ImageDraw.Draw(图)
        r = 边 * 0.30
        c = 边 / 2
        画.ellipse([c - r, c - r, c + r, c + r], fill=(212, 168, 67))
        画.ellipse([c - r * 0.55, c - r * 1.15, c + r * 1.45, c + r * 0.85], fill=(18, 32, 58))
        图.save(根 / "docs" / f"icon-{边}.png")
    print("已生成图标与静音音频")


if __name__ == "__main__":
    主函数()
