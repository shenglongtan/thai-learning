"""后处理 docs/audio 下的 mp3，让连读听起来柔和：
  1. 去掉开头多余的静音，只留 30 毫秒
  2. 响度统一到约 -16 LUFS（先测响度、加增益，再限幅压住峰值），避免有的词大声、有的词小声
  3. 开头渐入 30 毫秒、结尾渐出 100 毫秒，再补 120 毫秒静音余量，切换下一段时不会"咔"一下
  4. 以 64kbps 重新编码，文件里写入标记，处理过的会跳过，可重复运行
需要系统装有 ffmpeg。用法：python tools/处理音频.py
新生成（未处理）的音频运行一次即可。
"""
import json
import re
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

根 = Path(__file__).resolve().parent.parent
音频 = 根 / "docs" / "audio"
标记 = "thai-proc-v1"
目标响度 = -16


def 运行(参数):
    return subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-y", *参数], capture_output=True, text=True)


def 已处理(文件):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format_tags=comment", "-of", "default=nw=1:nk=1", str(文件)],
                       capture_output=True, text=True)
    return 标记 in r.stdout


def 时长(文件):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(文件)],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def 处理(文件):
    if 已处理(文件):
        return "跳过"
    with tempfile.TemporaryDirectory() as 临时:
        甲 = Path(临时) / "a.wav"
        乙 = Path(临时) / "b.mp3"
        # 1) 去开头静音
        r = 运行(["-i", str(文件), "-af", "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03", "-ar", "24000", "-ac", "1", str(甲)])
        if r.returncode or not 甲.exists():
            return "失败:去静音"
        # 2) 测响度
        r = 运行(["-i", str(甲), "-af", f"loudnorm=I={目标响度}:TP=-1.5:LRA=7:print_format=json", "-f", "null", "-"])
        m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr, re.S)
        if not m:
            return "失败:测响度"
        j = json.loads(m.group(0))
        if j["input_i"] in ("-inf", "inf"):
            return "失败:静音文件"
        d = 时长(甲)
        渐出 = min(0.1, d / 3)
        增益 = 目标响度 - float(j["input_i"])
        # 先整体加增益到目标响度，再用限幅器压住峰值，这样短词也能和长句一样响
        滤镜 = (
            f"volume={增益:.2f}dB,alimiter=limit=0.89:attack=2:release=50:level=disabled,"
            f"afade=t=in:d=0.03,afade=t=out:st={d - 渐出:.3f}:d={渐出:.3f},apad=pad_dur=0.12"
        )
        r = 运行(["-i", str(甲), "-af", 滤镜, "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k",
                  "-metadata", f"comment={标记}", str(乙)])
        if r.returncode or not 乙.exists() or 乙.stat().st_size == 0:
            return "失败:编码"
        文件.write_bytes(乙.read_bytes())
    return "完成"


def 主():
    文件列表 = sorted(p for 类 in ("th", "ex", "zh", "ezh") for p in (音频 / 类).glob("*.mp3"))
    with ThreadPoolExecutor(8) as 池:
        结果 = list(池.map(处理, 文件列表))
    统计 = {}
    for 文件, 状态 in zip(文件列表, 结果):
        统计[状态] = 统计.get(状态, 0) + 1
        if 状态.startswith("失败"):
            print(状态, 文件.name)
    print("共", len(文件列表), "个：", 统计)


if __name__ == "__main__":
    主()
