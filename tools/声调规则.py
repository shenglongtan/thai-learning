"""根据泰文音节推导声调，并给出"为什么是这个调"的规则要素。
规则：辅音类（高/中/低）× 音节类（活/死，死音节再分长短元音）× 声调符号 → 声调。
用法（被 生成词库.py 调用）：分析(音节) -> dict
"""

高 = set("ขฃฉฐถผฝศษสห")
中 = set("กจฎฏดตบปอ")
低辅音鼻 = set("งญณนมยรลวฬ")  # 低辅音里的响音
全部辅音 = set("กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ")
声调符 = "่้๊๋"
前置元音 = "เแโใไ"
# 收尾辅音的实际读音类型
末音 = {}
for c in "งนมยว": 末音[c] = "响"
for c in "ญณรลฬ": 末音[c] = "响"  # 读 n
for c in "กขคฆ": 末音[c] = "k"
for c in "จชซศษสฎฏดตถทธฐฑฒ": 末音[c] = "t"
for c in "บปพฟภ": 末音[c] = "p"

符名 = {"่": "ไม้เอก", "้": "ไม้โท", "๊": "ไม้ตรี", "๋": "ไม้จัตวา"}
调名 = {"mid": "中调", "low": "低调", "falling": "降调", "high": "高调", "rising": "升调"}


def 辅音类(c):
    return "高" if c in 高 else "中" if c in 中 else "低"


def 查调(类, 活, 长, 符):
    """返回声调英文名"""
    if 符:
        if 类 == "中":
            return {"่": "low", "้": "falling", "๊": "high", "๋": "rising"}[符]
        if 类 == "高":
            return {"่": "low", "้": "falling"}[符]
        return {"่": "falling", "้": "high"}[符]
    if 类 == "中":
        return "mid" if 活 else "low"
    if 类 == "高":
        return "rising" if 活 else "low"
    if 活:
        return "mid"
    return "falling" if 长 else "high"


def 分析(音节):
    s = 音节
    # 去掉不发音字母（带 ์ 的字母）
    while "์" in s:
        i = s.index("์")
        s = s[: max(i - 1, 0)] + s[i + 1:]
    符 = ""
    for m in 声调符:
        if m in s:
            符 = m
            s = s.replace(m, "")
    引导 = ""
    前 = ""
    if s and s[0] in 前置元音:
        前, s = s[0], s[1:]
    # 起首辅音
    if len(s) >= 2 and s[0] == "ห" and s[1] in 低辅音鼻:
        引导, 首, 余 = "ห", s[1], s[2:]
    elif len(s) >= 2 and s[0] == "อ" and s[1] == "ย":
        引导, 首, 余 = "อ", s[1], s[2:]
    else:
        首, 余 = s[0], s[1:]
        # 复合起首辅音（กร กล ปร พล ขว 等）：只有第一个辅音决定辅音类
        if 余 and 余[0] in "รลว":
            后 = 余[1:]
            元音符 = "ะาำิีึืุูัอ็"
            if 前:
                成立 = 余[0] in "รล"
            elif 后 and 后[0] in 元音符:
                成立 = True
            else:  # 无元音符号：ตรง 是复合（ตร+o+ง），ขวด/สวย 的 ว 是元音
                成立 = 余[0] in "รล" and len(后) == 1
            if 成立:
                余 = 后
    类 = "高" if 引导 == "ห" else "中" if 引导 == "อ" else 辅音类(首)
    # 元音与尾音
    长 = None
    尾 = ""
    元 = ""
    r = 余
    def 取尾(x):
        for ch in x:
            if ch in 末音:
                return ch
        return ""
    if 前 and 前 in "ไใ":
        长, 元, 尾 = False, "ไ", "ย"
        活 = True
        return 打包(音节, 类, 引导, 首, 活, 长, 元, 尾, 符)
    if 前 == "เ":
        if r in ("",):
            长, 元 = True, "เ-"
        elif r == "ะ":
            长, 元 = False, "เ-ะ"
        elif r == "า":
            长, 元, 尾 = False, "เ-า", "ว"  # 短元音，读 ao
        elif r == "าะ":
            长, 元 = False, "เ-าะ"
        elif r.startswith("็"):
            长, 元, 尾 = False, "เ-็-", 取尾(r[1:])
        elif r.startswith("ีย"):
            长, 元, 尾 = True, "เ-ีย", 取尾(r[2:])
        elif r.startswith("ือ"):
            长, 元, 尾 = True, "เ-ือ", 取尾(r[2:])
        elif r.startswith("ิ"):
            长, 元, 尾 = True, "เ-ิ-", 取尾(r[1:])
        elif r.startswith("อ"):
            长, 元, 尾 = True, "เ-อ", 取尾(r[1:])
        else:
            长, 元, 尾 = True, "เ-", 取尾(r)
    elif 前 == "แ":
        if r == "ะ":
            长, 元 = False, "แ-ะ"
        elif r.startswith("็"):
            长, 元, 尾 = False, "แ-็-", 取尾(r[1:])
        else:
            长, 元, 尾 = True, "แ-", 取尾(r)
    elif 前 == "โ":
        if r == "ะ":
            长, 元 = False, "โ-ะ"
        else:
            长, 元, 尾 = True, "โ-", 取尾(r)
    else:
        if r == "":
            长, 元 = False, "-ะ"  # 省略的 a
        elif r == "ะ":
            长, 元 = False, "-ะ"
        elif r.startswith("ั") and r[1:2] == "ว":
            长, 元, 尾 = True, "-ัว", 取尾(r[2:])
        elif r.startswith("ั"):
            长, 元, 尾 = False, "-ั-", 取尾(r[1:])
        elif r.startswith("า"):
            长, 元, 尾 = True, "-า", 取尾(r[1:])
        elif r.startswith("ำ"):
            长, 元, 尾 = False, "-ำ", "ม"
        elif r.startswith("ิ"):
            长, 元, 尾 = False, "-ิ", 取尾(r[1:])
        elif r.startswith("ี"):
            长, 元, 尾 = True, "-ี", 取尾(r[1:])
        elif r.startswith("ึ"):
            长, 元, 尾 = False, "-ึ", 取尾(r[1:])
        elif r.startswith("ื"):
            长, 元, 尾 = True, "-ื", 取尾(r[1:].lstrip("อ"))
        elif r.startswith("ุ"):
            长, 元, 尾 = False, "-ุ", 取尾(r[1:])
        elif r.startswith("ู"):
            长, 元, 尾 = True, "-ู", 取尾(r[1:])
        elif r.startswith("อ"):
            长, 元, 尾 = True, "-อ", 取尾(r[1:])
        elif r.startswith("ว"):
            长, 元, 尾 = True, "-ัว", 取尾(r[1:])
        else:
            长, 元, 尾 = False, "-o-", 取尾(r)  # 省略的 o
    if 元 in ("เ-าะ",):
        活 = False
    elif 元 == "เ-า":
        活 = True
    elif 尾:
        活 = 末音[尾] == "响"
    else:
        活 = bool(长) and not 元.endswith("ะ")
        if 元 in ("-ะ", "เ-ะ", "แ-ะ", "โ-ะ"):
            活 = False
    return 打包(音节, 类, 引导, 首, 活, 长, 元, 尾, 符)


def 打包(音节, 类, 引导, 首, 活, 长, 元, 尾, 符):
    调 = 查调(类, 活, 长, 符)
    return {"th": 音节, "cls": 类, "lead": 引导, "init": 首, "live": 活, "long": 长,
            "vowel": 元, "final": 尾, "mark": 符, "tone": 调}


def 规则文字(a):
    """把分析结果写成三段中文：辅音、音节、符号。"""
    if a["lead"] == "ห":
        c = "ห引导（不发音）→ 按高辅音"
    elif a["lead"] == "อ":
        c = "อ引导（不发音）→ 按中辅音"
    else:
        c = f"「{a['init']}」{a['cls']}辅音"
    元 = a["vowel"]
    if 元 == "ไ":
        s = "ไ/ใ 元音（视为活音节）"
    elif 元 in ("เ-า", "-ำ"):
        s = f"{'เ-า' if 元 == 'เ-า' else '-ำ'} 元音（短元音，视为活音节）"
    elif a["final"] and a["live"]:
        s = f"{'长' if a['long'] else '短'}元音 + 尾音「{a['final']}」→ 活音节"
    elif a["final"]:
        s = f"{'长' if a['long'] else '短'}元音 + 尾音「{a['final']}」（k/t/p 收尾）→ 死音节"
    elif a["live"]:
        s = "长元音，无尾音 → 活音节"
    else:
        s = "短元音，无尾音 → 死音节"
    if a["mark"]:
        m = f"{符名[a['mark']]}「{a['mark']}」"
    else:
        m = "无声调符号"
        if not a["live"] and a["cls"] == "低":
            m += "（死音节，" + ("长" if a["long"] else "短") + "元音）"
    return [c, s, m]
