'use strict';
/* 泰语学习：单页应用，无需构建。数据来自 data/words.json，进度存在本机 localStorage。 */
(async function () {
  const DATA = await (await fetch('data/words.json')).json();
  const CATS = DATA.cats, WORDS = DATA.words;
  const BY = Object.fromEntries(WORDS.map(w => [w.id, w]));
  const CBY = Object.fromEntries(CATS.map(c => [c.id, c]));
  const DAY = 864e5, INT = [0, 1, 3, 7, 14, 30];

  /* ---------- 声调 ---------- */
  const TONE = {
    mid: { n: '中调', c: '#4f94ff', no: 1, th: 'สามัญ', y: 14, p: 'M6 14 L48 14' },
    low: { n: '低调', c: '#3dbd73', no: 2, th: 'เอก', y: 9, p: 'M6 9 L48 19' },
    falling: { n: '降调', c: '#f0605a', no: 3, th: 'โท', y: 4, p: 'M6 4 L48 22' },
    high: { n: '高调', c: '#f5a524', no: 4, th: 'ตรี', y: 15, p: 'M6 15 L48 7' },
    rising: { n: '升调', c: '#b274f0', no: 5, th: 'จัตวา', y: 13, p: 'M6 13 Q22 25 48 4' },
  };
  const toneOf = s => {
    const n = s.normalize('NFD');
    return /̀/.test(n) ? 'low' : /̂/.test(n) ? 'falling' : /́/.test(n) ? 'high' : /̌/.test(n) ? 'rising' : 'mid';
  };
  const curve = t => `<svg viewBox="0 0 54 26"><path d="${TONE[t].p}" stroke="${TONE[t].c}" stroke-width="3.6" fill="none" stroke-linecap="round"/><circle cx="6" cy="${TONE[t].y}" r="3.8" fill="${TONE[t].c}"/></svg>`;
  const showRom = () => !!S.settings.showRom;
  const sylBoxes = (w, cls = '') => {
    const roms = w.rom.split('-');
    return `<div class="syls ${cls} ${(w.tr || []).length > 3 ? 'many' : ''}">${(w.tr || []).map((x, i) => {
      const c = TONE[x.tone].c;
      return `<div class="syl" style="border-color:${c}"><b class="thai" style="color:${c}">${x.t}</b>${showRom() ? `<em style="color:${c}">${roms[i] || ''}</em>` : ''}${curve(x.tone)}<small style="color:${c}"><b>第${TONE[x.tone].no}声</b> ${TONE[x.tone].n}</small></div>`;
    }).join('')}</div>`;
  };
  const toneSum = w => (w.tr || []).map(x => `<span style="color:${TONE[x.tone].c}">第${TONE[x.tone].no}声</span>`).join(' · ');
  const colorRom = rom => !showRom() ? '' : rom.split(' ').map(wd => wd.split('-').map(s => `<span style="color:${TONE[toneOf(s)].c}">${s}</span>`).join('-')).join(' ');
  const ruleHtml = (w, light) => {
    const roms = w.rom.split('-');
    return `<div class="rules ${light ? 'lt' : ''}"><div class="rh"><span>声调规则</span><button class="lnk" data-a="go" data-v="#/rules">速查表 ›</button></div><div class="rbody">${(w.tr || []).map((x, i) => {
      const c = TONE[x.tone].c, warn = x.calc && toneOf(roms[i] || '') !== x.tone;
      return `<div class="rl" style="border-color:${c}"><b class="thai" style="color:${c}">${x.t}</b><span class="rd">${x.d.join(' · ')} <b style="color:${c}">→ 第${TONE[x.tone].no}声</b>${warn ? `<span class="rw">⚠ 按规则读第${TONE[x.tone].no}声，口语常读第${TONE[toneOf(roms[i] || '')].no}声（外来词／例外），待核对</span>` : ''}</span></div>`;
    }).join('')}</div></div>`;
  };
  // 例句里每个词一种颜色，对应的中文用同一种颜色（深色卡片用亮色，白底用深色）
  const PAL = ['#f5d547', '#7be3a6', '#8ad4f5', '#f5a58a', '#c4a6f5', '#f58ac8', '#b8e65c', '#fdba74'];
  const LPAL = ['#d97706', '#0f9d58', '#2563eb', '#dc2626', '#9333ea', '#db2777', '#4d7c0f', '#0891b2'];
  const exHtml = (w, light) => {
    const e = w.ex, pal = light ? LPAL : PAL, col = i => pal[i % pal.length];
    const th = e.seg.map((s, i) => {
      const hl = e.hl && i >= e.hl[0] && i < e.hl[1];
      return `<span class="cw ${hl ? 'hl' : ''}" style="color:${col(i)};border-color:${col(i)}">${s}</span>`;
    }).join('');
    const zh = (e.zs || [{ t: e.zh }]).map(x => x.i === undefined ? x.t : `<span class="cz" style="color:${col(x.i)};border-color:${col(x.i)}">${x.t}</span>`).join('');
    return `<div class="exth thai">${th}<button class="spk sm" style="${light ? 'background:#0a6cff' : ''}" data-a="sayEx" data-v="${w.id}">🔊</button></div>
      ${showRom() ? `<div class="exrom">${colorRom(e.rom)}</div>` : ''}<div class="exzh ${light ? 'lt' : ''}">${zh}</div>`;
  };

  /* ---------- 本地存储 ---------- */
  const KEY = 'thai.v1';
  const defaults = () => ({
    w: {}, days: [], today: { date: '', ids: [] },
    settings: { ver: 2, daily: 10, reps: 1, rate: 1, showRom: false, auto: true, zhRead: true, readEx: true, chain: true, unlockAll: false },
    sleep: { dur: 30, cats: [], rand: false },
  });
  let S = (() => {
    try {
      const d = defaults(), j = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (j.settings && j.settings.ver !== 2) { delete j.settings.reps; j.settings.ver = 2; } // 旧版默认读 3 遍，改为默认 1 遍
      return { ...d, ...j, settings: { ...d.settings, ...j.settings }, sleep: { ...d.sleep, ...j.sleep } };
    } catch (e) { return defaults(); }
  })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 隐私模式可能写不进去 */ } };
  const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const seen = id => !!S.w[id];
  const catWords = id => WORDS.filter(w => w.cat === id);
  const learnedIn = id => catWords(id).filter(w => seen(w.id)).length;
  const learnedAll = () => WORDS.filter(w => seen(w.id)).length;
  const unlocked = ci => S.settings.unlockAll || ci === 0 || learnedIn(CATS[ci - 1].id) / catWords(CATS[ci - 1].id).length >= 0.5;
  const level = () => 1 + Math.floor(learnedAll() / 25);
  const dueIds = () => WORDS.filter(w => S.w[w.id] && S.w[w.id].due <= Date.now()).map(w => w.id);

  function markActive() { const t = ymd(); if (!S.days.includes(t)) S.days.push(t); }
  function streak() {
    let n = 0, d = new Date();
    if (!S.days.includes(ymd(d))) d = new Date(Date.now() - DAY);
    while (S.days.includes(ymd(d))) { n++; d = new Date(d.getTime() - DAY); }
    return n;
  }
  function rate(id, r) {
    const st = S.w[id] || { box: 0 };
    if (r === 0) { st.box = 0; st.due = Date.now() + 10 * 60e3; }
    else if (r === 1) { st.box = Math.min(st.box + 1, 5); st.due = Date.now() + INT[st.box] * DAY; }
    else { st.box = 5; st.due = Date.now() + INT[5] * DAY; }
    S.w[id] = st; markActive(); save();
  }
  function setBox(id, box) { S.w[id] = { box, due: Date.now() + (box === 0 ? 10 * 60e3 : INT[box] * DAY) }; markActive(); save(); }
  function pickNew(n, skip = []) {
    const out = [];
    CATS.forEach((c, ci) => {
      if (!unlocked(ci)) return;
      catWords(c.id).forEach(w => { if (out.length < n && !seen(w.id) && !skip.includes(w.id)) out.push(w.id); });
    });
    return out;
  }
  function ensureToday() {
    if (S.today.date !== ymd()) { S.today = { date: ymd(), ids: pickNew(S.settings.daily) }; save(); }
  }

  /* ---------- 发音 ---------- */
  const AU = new Audio();
  AU.preload = 'auto';
  AU.preservesPitch = AU.webkitPreservesPitch = true; // 变速不变调
  const RATES = [0.5, 0.8, 1, 1.2, 1.5];
  const RATE = () => (RATES.includes(S.settings.rate) ? S.settings.rate : 1);
  let playToken = 0, pending = null;
  const zText = w => w.zh.split('（')[0].replace('/', '，');
  const zId = w => 'z' + w.id.slice(1);
  function stopAudio() {
    playToken++;
    AU.pause();
    try { speechSynthesis.cancel(); } catch (e) { /* 浏览器无朗读功能 */ }
    if (pending) { const p = pending; pending = null; p(false); }
  }
  function speak(text, lang, rate, tok) {
    return new Promise(res => {
      if (!('speechSynthesis' in window) || tok !== playToken) return res(false);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang; u.rate = rate;
      const v = speechSynthesis.getVoices().find(v => v.lang.replace('_', '-').startsWith(lang));
      if (v) u.voice = v;
      u.onend = () => res(true); u.onerror = () => res(false);
      speechSynthesis.speak(u);
    });
  }
  function playOne(kind, id, text, lang, rate, tok) {
    return new Promise(res => {
      if (tok !== playToken) return res(false);
      let done = false, fell = false;
      const fin = ok => { if (done) return; done = true; pending = null; AU.onended = AU.onerror = null; res(ok); };
      const fall = () => { if (fell) return; fell = true; if (!text) return fin(false); speak(text, lang, rate, tok).then(fin); };
      pending = fin;
      AU.onended = () => fin(true);
      AU.onerror = fall;
      AU.defaultPlaybackRate = rate;
      AU.src = `audio/${kind ? kind + '/' : ''}${id}.mp3`;
      AU.playbackRate = rate;
      const p = AU.play();
      if (p && p.catch) p.catch(fall);
    });
  }
  const sayWord = (w, rate = RATE()) => { stopAudio(); return playOne('th', w.id, w.th, 'th-TH', rate, playToken); };
  const sayEx = w => { stopAudio(); return playOne('ex', w.ex.id, w.ex.seg.join(''), 'th-TH', RATE(), playToken); };
  const sayZh = w => { stopAudio(); return playOne('zh', zId(w), zText(w), 'zh-CN', RATE(), playToken); };
  // 一个词的连读顺序：单词（reps 遍）→ 单词的中文 → 例句 → 例句的中文（中文只在“读中文意思”开启时读，例句只在 withEx 时读）
  async function playChain(w, tok, reps, withEx) {
    const zh = S.settings.zhRead, r = RATE();
    for (let k = 0; k < reps; k++) {
      await playOne('th', w.id, w.th, 'th-TH', r, tok);
      if (tok !== playToken) return;
      await gap(k < reps - 1 ? 500 : 400, tok);
    }
    if (tok !== playToken) return;
    if (zh) { await playOne('zh', zId(w), zText(w), 'zh-CN', r, tok); if (tok !== playToken) return; await gap(500, tok); }
    if (tok !== playToken || !withEx) return;
    await playOne('ex', w.ex.id, w.ex.seg.join(''), 'th-TH', r, tok);
    if (tok !== playToken) return;
    if (zh) { await gap(500, tok); if (tok !== playToken) return; await playOne('ezh', w.ex.id, w.ex.zh.replace(/（[^）]*）/g, ''), 'zh-CN', r, tok); }
  }
  // 学习卡自动发音
  function studyPlay(w) {
    stopAudio();
    return playChain(w, playToken, 1, S.settings.chain);
  }
  // 间隔：陪睡模式用静音音频撑住，防止锁屏后系统挂起页面
  function gap(ms, tok, keep) {
    if (!keep) return new Promise(r => setTimeout(r, ms));
    const n = Math.max(1, Math.round(ms / 1000));
    return (async () => { for (let i = 0; i < n && tok === playToken; i++) if (!(await playOne('', 'silence', '', 'th-TH', 1, tok).catch(() => false))) { await new Promise(r => setTimeout(r, 800)); } })();
  }

  /* ---------- 小工具 ---------- */
  const app = document.getElementById('app'), tabs = document.getElementById('tabs');
  function toast(msg) {
    const d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;left:50%;bottom:110px;transform:translateX(-50%);background:#12203a;color:#fff;padding:12px 20px;border-radius:24px;z-index:99;font-size:16px;max-width:86%;text-align:center';
    document.body.appendChild(d); setTimeout(() => d.remove(), 2200);
  }
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const dotCls = id => { const s = S.w[id]; return !s ? '' : s.box <= 1 ? 'l1' : s.box <= 3 ? 'l2' : 'l3'; };
  const go = h => { if (location.hash === h) render(); else location.hash = h; };
  const topbar = (title, back) => `<div class="topbar"><button class="back" data-a="back" data-v="${back || '#/cats'}">‹</button><h2>${title}</h2><span class="sp"></span></div>`;

  /* ---------- 页面：今日 ---------- */
  function home() {
    ensureToday();
    const ids = S.today.ids, done = ids.filter(seen).length, pct = ids.length ? Math.round(done / ids.length * 100) : 100;
    const firstCat = ids.length ? CBY[BY[ids[0]].cat].name : '今日完成';
    const preview = ids.slice(0, 4).map(i => BY[i].th).join(' · ');
    const dueN = dueIds().length;
    const wk = (() => {
      const now = new Date(), dow = (now.getDay() + 6) % 7, out = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(now.getTime() + (i - dow) * DAY), on = S.days.includes(ymd(d));
        out.push(`<div class="${on ? 'on' : ''} ${i === dow ? 'today-d' : ''}">${'一二三四五六日'[i]}<span>${on ? '🔥' : ''}</span></div>`);
      }
      return out.join('');
    })();
    const allDone = ids.length > 0 && done === ids.length;
    return `<div class="hero"><div class="row"><h1>泰语学习</h1><span class="lv">★ Lv.${level()}</span></div></div>
    <div class="page">
      <div class="greet"><h2>今天也一起加油</h2><p>今天来积累你的词汇吧。</p></div>
      <div class="today">
        <div class="t1">📖 今日 ${ids.length} 词</div>
        <div class="body"><div>
          <span class="badge">${firstCat}</span>
          <div class="words thai">${preview || '—'}</div>
          <div style="opacity:.7;margin-top:6px">⏱ 约 ${Math.max(1, Math.round(ids.length * 0.3))} 分钟</div>
        </div><div class="ring" style="--p:${pct}"><div><div><b>${done}</b><small>/${ids.length} 已学</small></div></div></div></div>
        ${allDone || !ids.length
        ? `<button class="btn-white" data-a="moreToday">🎉 今日完成，再学 ${S.settings.daily} 个</button>`
        : `<button class="btn-white" data-a="startToday">→ 开始学习</button>`}
      </div>
      <div class="streak"><div class="fire">🔥</div><div class="n">${streak()}<small>天连续</small></div><div class="week">${wk}</div></div>
      <div class="menu">
        <button data-a="go" data-v="#/cats"><span class="ic">▦</span><span class="tt"><b>全部分类</b><span>浏览全部 ${WORDS.length} 词</span></span><span class="arr">›</span></button>
        <button data-a="go" data-v="#/review"><span class="ic">↻</span><span class="tt"><b>复习</b><span>${dueN ? dueN + ' 个词待复习' : '巩固已学过的内容'}</span></span><span class="arr">›</span></button>
        <button data-a="go" data-v="#/sleep"><span class="ic" style="background:#dff0ee">🌙</span><span class="tt"><b>陪睡模式</b><span>睡前自动播放单词，磨耳朵学外语</span></span><span class="arr">›</span></button>
      </div>
    </div>`;
  }

  /* ---------- 页面：分类 ---------- */
  function cats() {
    const card = (c, ci) => {
      const tot = catWords(c.id).length, n = learnedIn(c.id), ok = unlocked(ci);
      return `<button class="cat ${n === tot ? 'done' : ''} ${ok ? '' : 'lock'}" data-a="${ok ? 'go' : 'locked'}" data-v="${ok ? '#/cat/' + c.id : ci}">
        ${ok ? '' : '<span class="lk">🔒</span>'}<div class="rg" style="--p:${Math.round(n / tot * 100)}"><div>${c.icon}</div></div>
        <b>${c.name}</b><span>${n === tot ? '全部掌握！' : '已学 ' + n + '/' + tot}</span></button>`;
    };
    const open = CATS.map((c, i) => unlocked(i) ? card(c, i) : '').join('');
    const lock = CATS.map((c, i) => unlocked(i) ? '' : card(c, i)).join('');
    return `<div class="hero"><div class="row"><h1>泰语学习</h1><span class="lv">★ Lv.${level()}</span></div></div>
      <div class="page"><div class="sec"><i>🔓</i>已解锁分类</div><div class="grid">${open}</div>
      ${lock ? `<div class="sec"><i>🔥</i>入门必备</div><div class="grid">${lock}</div>` : ''}</div>`;
  }
  function catPage(id) {
    const c = CBY[id]; if (!c) return home();
    const list = catWords(id), unseen = list.filter(w => !seen(w.id));
    return `${topbar(c.icon + ' ' + c.name)}<div class="page"><p style="color:var(--sub);margin:0 0 12px">${c.desc} · 已学 ${list.length - unseen.length}/${list.length}</p>
      <div class="row-btns"><button class="pill" data-a="studyCat" data-v="${id}">${unseen.length ? '学习新词（' + Math.min(unseen.length, S.settings.daily) + '）' : '重新过一遍'}</button>
      <button class="pill alt" data-a="go" data-v="#/auto/${id}">🎧 自动连读</button></div>
      <div class="wlist">${list.map(w => `<button class="item" data-a="oneWord" data-v="${w.id}"><span class="th thai">${w.th}</span><span class="mid"><b>${w.zh}</b><span>${showRom() ? colorRom(w.rom) : toneSum(w)}</span></span><span class="dot ${dotCls(w.id)}"></span></button>`).join('')}</div></div>`;
  }

  /* ---------- 页面：学习卡 ---------- */
  let SES = null;
  function startSession(ids, title) {
    if (!ids.length) return toast('没有可学的词了');
    SES = { q: ids.slice(), i: 0, title, total: ids.length, stat: [0, 0, 0], re: {} };
    go('#/study');
  }
  function study() {
    if (!SES) { go('#/today'); return ''; }
    if (SES.i >= SES.q.length) {
      const [m, o, e] = SES.stat;
      return `<div class="done-box"><div class="e">🎉</div><h2>${SES.title}完成</h2><p style="color:var(--sub);font-size:18px;line-height:1.8">没记住 ${m} · 记得 ${o} · 太简单 ${e}</p>
        <button class="pill" style="max-width:260px;margin:20px auto 0;display:block;width:100%" data-a="go" data-v="#/today">回首页</button></div>`;
    }
    const w = BY[SES.q[SES.i]];
    if (S.settings.auto) setTimeout(() => studyPlay(w), 200);
    return `<div class="fit"><div class="study-top"><button class="back" data-a="back" data-v="#/today">‹</button><h2>${SES.title} ${Math.min(SES.i + 1, SES.total)}/${SES.total}</h2><button class="spdm" data-a="studySpeed" title="发音语速">🐢 ${RATE()}×</button></div>
      <div class="bar"><i style="width:${SES.i / SES.q.length * 100}%"></i></div>
      <div class="scard">
        <div class="big thai">${w.th}<button class="spk" data-a="sayWord" data-v="${w.id}">🔊</button></div>
        ${showRom() ? `<div class="rom">${w.rom}</div>` : ''}
        ${sylBoxes(w)}
        ${ruleHtml(w, true)}
        ${w.note ? `<div class="note"><span>🎵</span><span>${w.note}</span></div>` : ''}
        <div class="zh">${w.zh}<button class="spk sm" style="margin-left:8px" data-a="sayZh" data-v="${w.id}">🔊</button></div>
        <div class="exbox">${exHtml(w, false)}</div>
      </div>
      <div class="ans"><button class="a-miss" data-a="rate" data-v="0">没记住</button><button class="a-ok" data-a="rate" data-v="1">记得</button><button class="a-easy" data-a="rate" data-v="2">太简单</button></div></div>`;
  }

  /* ---------- 页面：复习 ---------- */
  function review() {
    const due = dueIds(), all = Object.keys(S.w);
    const mastered = all.filter(i => S.w[i].box >= 5).length;
    return `<div class="hero"><div class="row"><h1>复习</h1><span class="lv">★ Lv.${level()}</span></div></div>
      <div class="page"><div class="stat"><div><b>${due.length}</b><span>待复习</span></div><div><b>${all.length - mastered}</b><span>学习中</span></div><div><b>${mastered}</b><span>已掌握</span></div></div>
      <button class="pill" style="width:100%;margin-top:16px;padding:16px;font-size:18px;${due.length ? '' : 'opacity:.5'}" data-a="startReview">${due.length ? '开始复习（' + Math.min(due.length, 30) + '）' : '暂时没有要复习的词'}</button>
      ${due.length ? `<div class="sec" style="font-size:18px">待复习的词</div><div class="wlist">${due.slice(0, 30).map(i => { const w = BY[i]; return `<button class="item" data-a="oneWord" data-v="${i}"><span class="th thai">${w.th}</span><span class="mid"><b>${w.zh}</b><span>${showRom() ? w.rom : toneSum(w)}</span></span><span class="dot ${dotCls(i)}"></span></button>`; }).join('')}</div>` : ''}</div>`;
  }

  /* ---------- 页面：自动连读 ---------- */
  let AUTO = null;
  function autoView(id) {
    const c = CBY[id]; if (!c) return home();
    if (!AUTO || AUTO.cat !== id) AUTO = { cat: id, list: catWords(id), i: 0, playing: false };
    const A = AUTO, w = A.list[A.i];
    return `<div class="fit lightfit"><div class="light-top"><button class="back" data-a="back" data-v="#/cat/${id}">‹ 返回</button><div class="pg"><i style="width:${(A.i + 1) / A.list.length * 100}%"></i></div><span class="ct">${A.i + 1} / ${A.list.length}</span></div>
      <button class="autoplay" data-a="autoToggle">${A.playing ? '⏸ 暂停连读' : '▶ 自动连读：每个词 泰语' + S.settings.reps + '遍' + (S.settings.readEx ? ' + 例句' : '') + (S.settings.zhRead ? ' + 中文意思' : '')}</button>
      <div class="chks"><label class="chk"><input type="checkbox" data-a="exToggle" ${S.settings.readEx ? 'checked' : ''}> 读例句</label><label class="chk"><input type="checkbox" data-a="zhToggle" ${S.settings.zhRead ? 'checked' : ''}> 读中文意思</label></div>
      <div class="acard">
        <div class="tools"><button class="spkb" data-a="autoSay">🔊</button><button class="spd" data-a="autoSpeed">🐢 ${RATE()}×</button></div>
        <div class="th2 thai">${w.th}</div><div class="zh2">${w.zh}</div>${showRom() ? `<div class="rom2">${w.rom}</div>` : ''}
        ${sylBoxes(w, 'lt')}
        ${ruleHtml(w, true)}
        ${w.note ? `<div class="note" style="background:#fff;color:var(--text)"><span>🎵</span><span>${w.note}</span></div>` : ''}
        <div class="exl">${exHtml(w, true)}</div>
      </div>
      <div class="ans ans4">${['陌生', '不熟悉', '熟悉', '精通'].map((t, i) => `<button class="l-${i}" data-a="level" data-v="${i}">${t}</button>`).join('')}</div>
      <div class="nav3"><button data-a="autoPrev">‹ 上一词</button><span>选择熟练度</span><button data-a="autoNext">下一词 ›</button></div></div>`;
  }
  async function autoLoop() {
    stopAudio();
    const tok = playToken;
    while (tok === playToken && AUTO && AUTO.playing) {
      const w = AUTO.list[AUTO.i];
      await playChain(w, tok, S.settings.reps, S.settings.readEx);
      if (tok !== playToken) return;
      await gap(300, tok);
      if (tok !== playToken) return;
      if (AUTO.i < AUTO.list.length - 1) { AUTO.i++; render(); } else { AUTO.playing = false; render(); return; }
    }
  }

  /* ---------- 页面：陪睡模式 ---------- */
  let SLP = { playing: false, endAt: 0, cur: null };
  function sleepView() {
    const sl = S.sleep, on = c => (c === 'all' ? !sl.cats.length : sl.cats.includes(c));
    const durs = [[0, '一直播'], [15, '15分钟'], [30, '30分钟'], [45, '45分钟'], [60, '60分钟'], [120, '2小时']];
    return `<div class="sleep"><div class="tb"><button class="back" data-a="back" data-v="#/today">‹</button></div>
      <div class="moon">🌙</div><h1>陪睡模式</h1><p class="s">自动循环播放单词发音，<br>在睡前轻松磨耳朵学外语</p>
      <button class="bigplay ${SLP.playing ? 'playing' : ''}" data-a="sleepToggle"><span><div style="font-size:48px;color:var(--gold)">${SLP.playing ? '⏸' : '🌙'}</div>${SLP.playing ? '停止播放' : '开始播放'}</span></button>
      <div class="now" id="now"></div>
      <h3>播放时长</h3><div class="chips">${durs.map(([m, t]) => `<button class="chip ${sl.dur === m ? 'on' : ''}" data-a="sleepDur" data-v="${m}">${t}</button>`).join('')}</div>
      <h3>选择分类</h3><div class="chips"><button class="chip ${on('all') ? 'on' : ''}" data-a="sleepCat" data-v="all">全部</button>${CATS.map(c => `<button class="chip ${on(c.id) ? 'on' : ''}" data-a="sleepCat" data-v="${c.id}">${c.icon} ${c.name}</button>`).join('')}</div>
      <div class="set"><span>随机顺序</span><button class="sw ${sl.rand ? 'on' : ''}" data-a="sleepRand"></button></div></div>`;
  }
  function setNow(txt) { const n = document.getElementById('now'); if (n) n.textContent = txt; }
  function stopSleep() {
    SLP.playing = false; stopAudio();
    try { navigator.mediaSession.playbackState = 'paused'; } catch (e) { /* 无媒体会话 */ }
    if (location.hash === '#/sleep') render();
  }
  async function sleepLoop() {
    stopAudio();
    const tok = playToken, sl = S.sleep;
    const pool = () => WORDS.filter(w => !sl.cats.length || sl.cats.includes(w.cat));
    let list = sl.rand ? shuffle(pool()) : pool(), i = 0;
    while (tok === playToken && SLP.playing) {
      if (SLP.endAt && Date.now() > SLP.endAt) return stopSleep();
      if (i >= list.length) { i = 0; if (sl.rand) list = shuffle(list); }
      const w = list[i++];
      SLP.cur = w;
      const left = SLP.endAt ? Math.max(0, Math.round((SLP.endAt - Date.now()) / 60000)) : null;
      setNow(`${w.th}　${w.zh}${left !== null ? '　· 剩余约 ' + left + ' 分钟' : ''}`);
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: showRom() ? w.th + '  ' + w.rom : w.th, artist: w.zh, album: '泰语学习 · 陪睡模式' });
        navigator.mediaSession.playbackState = 'playing';
      } catch (e) { /* 无媒体会话 */ }
      await playOne('th', w.id, w.th, 'th-TH', 0.9 * RATE(), tok); if (tok !== playToken) return;
      await gap(1500, tok, true);
      await playOne('zh', zId(w), zText(w), 'zh-CN', 0.95 * RATE(), tok); if (tok !== playToken) return;
      await gap(1500, tok, true);
      await playOne('th', w.id, w.th, 'th-TH', 0.8 * RATE(), tok); if (tok !== playToken) return;
      await gap(3000, tok, true);
    }
  }
  try {
    navigator.mediaSession.setActionHandler('pause', () => SLP.playing && stopSleep());
    navigator.mediaSession.setActionHandler('stop', () => SLP.playing && stopSleep());
  } catch (e) { /* 无媒体会话 */ }

  /* ---------- 页面：声调规则速查 ---------- */
  function rulesView() {
    const cell = t => `<td style="color:${TONE[t].c}">${TONE[t].no}声<br><small>${TONE[t].n}</small></td>`;
    const lt = s => `<span class="thai">${s}</span>`;
    const curves = Object.entries(TONE).map(([k, v]) => `<div class="cv" style="border-color:${v.c}">${curve(k)}<b style="color:${v.c}">第${v.no}声</b><small>${v.n}<br><span class="thai">${v.th}</span></small></div>`).join('');
    return `<div class="study-top"><button class="back" data-a="hist">‹</button><h2>声调规则速查</h2><span style="width:36px"></span></div>
      <div class="page rulepg">
        <div class="rc"><h3>五个声调（第1–5声）</h3><div class="cvs">${curves}</div></div>
        <div class="rc"><h3>判断三步走</h3>
          <p><b>① 辅音类</b>：看起首辅音是高、中、低哪一类。</p>
          <p><b>② 活／死音节</b>：看元音长短和有没有尾音。</p>
          <p><b>③ 声调符号</b>：有符号（ไม้เอก ่、ไม้โท ้、ไม้ตรี ๊、ไม้จัตวา ๋）按符号和辅音类定调；没有符号按下表默认调。注意符号名和声调不一定对应，如低辅音加 ไม้เอก 是第3声。</p></div>
        <div class="rc"><h3>① 三类辅音</h3>
          <p><b style="color:#3b82f6">中辅音（9）</b>${lt('ก จ ฎ ฏ ด ต บ ป อ')}</p>
          <p><b style="color:#f59e0b">高辅音（11）</b>${lt('ข ฃ ฉ ฐ ถ ผ ฝ ศ ษ ส ห')}</p>
          <p><b style="color:#22a05a">低辅音（其余）</b>${lt('ค ฆ ง ช ซ ฌ ญ ฑ ฒ ณ ท ธ น พ ฟ ภ ม ย ร ล ว ฬ ฮ')}</p>
          <p class="sm">复合起首辅音（${lt('กร กล ปล พร ขว')} 等）只看第一个辅音。</p></div>
        <div class="rc"><h3>② 活音节与死音节</h3>
          <p><b>活音节</b>：长元音无尾音；或尾音是 ${lt('ง น ม ย ว')}（以及读 n 的 ${lt('ญ ณ ร ล ฬ')}）；ไ ใ เ-า -ำ 也算活音节。</p>
          <p><b>死音节</b>：短元音无尾音；或尾音是 k／t／p 类（${lt('ก ข ค')}、${lt('ด ต จ ส ท ศ ษ')}、${lt('บ ป พ ฟ')} 等）。</p>
          <p class="sm">死音节再分长元音／短元音，只影响低辅音。</p></div>
        <div class="rc"><h3>③ 定调表</h3>
          <table class="tt"><tr><th></th><th>无符号<br>活音节</th><th>无符号<br>死音节</th><th>${lt('่')}</th><th>${lt('้')}</th><th>${lt('๊')}</th><th>${lt('๋')}</th></tr>
            <tr><th style="color:#3b82f6">中辅音</th>${cell('mid')}${cell('low')}${cell('low')}${cell('falling')}${cell('high')}${cell('rising')}</tr>
            <tr><th style="color:#f59e0b">高辅音</th>${cell('rising')}${cell('low')}${cell('low')}${cell('falling')}<td>—</td><td>—</td></tr>
            <tr><th style="color:#22a05a">低辅音</th>${cell('mid')}<td><span style="color:${TONE.high.c}">短→4声</span><br><span style="color:${TONE.falling.c}">长→3声</span></td>${cell('falling')}${cell('high')}<td>—</td><td>—</td></tr></table></div>
        <div class="rc"><h3>特殊情况</h3>
          <p><b>ห 引导</b>：${lt('ห')} 放在低响音辅音（${lt('ง ญ น ม ย ร ล ว')}）前，自己不发音，让后面的字按<b>高辅音</b>定调，如 ${lt('หนึ่ง หมู หวาน')}。</p>
          <p><b>อ 引导</b>：只有 ${lt('อยู่ อย่า อยาก อย่าง')} 四个词，${lt('อ')} 不发音，让 ${lt('ย')} 按<b>中辅音</b>定调。</p>
          <p><b>不发音的字母</b>：带 ${lt('์')} 的字母不读，如 ${lt('ศูนย์ เบียร์')}。</p>
          <p class="sm">外来词、个别口语词可能不按规则读，以实际发音为准。</p></div>
      </div>`;
  }

  /* ---------- 页面：设置 ---------- */
  function settings() {
    const s = S.settings, seg = (key, opts) => `<div class="seg">${opts.map(o => `<button class="${s[key] === o ? 'on' : ''}" data-a="set" data-v="${key}:${o}">${o}</button>`).join('')}</div>`;
    const sw = (key) => `<button class="sw ${s[key] ? 'on' : ''}" data-a="setBool" data-v="${key}"></button>`;
    return `<div class="hero"><div class="row"><h1>设置</h1><span class="lv">★ Lv.${level()}</span></div></div>
      <div class="page"><div class="stat"><div><b>${learnedAll()}</b><span>已学词</span></div><div><b>${streak()}</b><span>连续天数</span></div><div><b>${WORDS.length}</b><span>词库总数</span></div></div>
      <div class="setl">
        <div class="r"><span>每日新词</span>${seg('daily', [5, 10, 15, 20])}</div>
        <div class="r"><span>连读遍数</span>${seg('reps', [1, 2, 3, 5])}</div>
        <div class="r col"><span>发音语速<small>单词、例句、连读、陪睡模式都按这个速度（倍速）</small></span>${seg('rate', RATES)}</div>
        <button class="r" style="width:100%;background:none" data-a="go" data-v="#/rules"><span>声调规则速查表</span><span>›</span></button>
        <div class="r"><span>学习卡自动发音</span>${sw('auto')}</div>
        <div class="r"><span>学习卡连读例句<small>自动读完单词（和中文）后，接着读例句</small></span>${sw('chain')}</div>
        <div class="r"><span>显示罗马音<small>已会泰语拼读可关闭，只看泰文和声调规则</small></span>${sw('showRom')}</div>
        <div class="r"><span>连读时读例句<small>读完单词（和它的中文）后，接着读泰语例句</small></span>${sw('readEx')}</div>
        <div class="r"><span>连读时读中文意思<small>读完单词后读它的中文，读完例句后读例句的中文</small></span>${sw('zhRead')}</div>
        <div class="r"><span>解锁全部分类<small>关闭时需学完上一分类 50%</small></span>${sw('unlockAll')}</div>
      </div>
      <div class="setl">
        <button class="r" style="width:100%;background:none" data-a="export"><span>导出学习进度（备份）</span><span>›</span></button>
        <label class="r" style="cursor:pointer"><span>导入学习进度</span><span>›</span><input type="file" id="imp" accept="application/json" hidden></label>
        <button class="r danger" style="width:100%;background:none" data-a="reset"><span>清空学习进度</span><span>›</span></button>
      </div>
      <p style="color:var(--sub);text-align:center;font-size:13px;line-height:1.7;margin-top:20px">进度只保存在这台手机的浏览器里。<br>换手机或清理浏览器数据前请先导出备份。<br>词库为起草稿，尚待泰语母语者校对。</p></div>`;
  }

  /* ---------- 路由 ---------- */
  function render() {
    const [, r, p] = (location.hash || '#/today').split('/');
    const full = ['study', 'auto', 'sleep', 'cat', 'rules'].includes(r);
    document.body.classList.toggle('nonav', full);
    tabs.className = full ? 'hide' : '';
    const cur = ['today', 'cats', 'review', 'settings'].includes(r) ? r : (r === undefined ? 'today' : '');
    tabs.innerHTML = `<div class="in">${[['today', '☀︎', '今日'], ['cats', '▦', '分类'], ['review', '↻', '复习'], ['settings', '⚙︎', '设置']].map(([k, i, t]) => `<a href="#/${k}" class="${cur === k ? 'on' : ''}"><i>${i}</i>${t}</a>`).join('')}</div>`;
    const views = { today: home, cats, cat: () => catPage(p), study, review, auto: () => autoView(p), sleep: sleepView, settings, rules: rulesView };
    app.innerHTML = (views[r] || home)();
    const imp = document.getElementById('imp');
    if (imp) imp.onchange = importProgress;
  }
  function route() { stopAudio(); if (SLP.playing && location.hash !== '#/sleep') SLP.playing = false; if (AUTO) AUTO.playing = false; render(); window.scrollTo(0, 0); }
  window.addEventListener('hashchange', route);

  /* ---------- 操作 ---------- */
  function importProgress(e) {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(rd.result);
        if (!j || typeof j.w !== 'object') throw new Error('格式不对');
        S = { ...defaults(), ...j, settings: { ...defaults().settings, ...j.settings }, sleep: { ...defaults().sleep, ...j.sleep } };
        save(); toast('已导入学习进度'); render();
      } catch (err) { toast('导入失败：不是有效的备份文件'); }
    };
    rd.readAsText(f);
  }
  const ACT = {
    go: v => go(v),
    back: v => go(v),
    locked: v => toast(`先学完「${CATS[v - 1].name}」的一半就能解锁`),
    startToday: () => startSession(S.today.ids.filter(i => !seen(i)), '今日学习'),
    moreToday: () => { S.today.ids = S.today.ids.concat(pickNew(S.settings.daily, S.today.ids)); save(); startSession(S.today.ids.filter(i => !seen(i)), '今日学习'); },
    studyCat: v => { const un = catWords(v).filter(w => !seen(w.id)).map(w => w.id); startSession((un.length ? un.slice(0, S.settings.daily) : catWords(v).map(w => w.id)), CBY[v].name); },
    oneWord: v => startSession([v], '单词'),
    startReview: () => startSession(shuffle(dueIds()).slice(0, 30), '复习'),
    sayWord: v => sayWord(BY[v]),
    sayEx: v => sayEx(BY[v]),
    sayZh: v => sayZh(BY[v]),
    rate: v => {
      const r = +v, id = SES.q[SES.i];
      rate(id, r); SES.stat[r]++;
      if (r === 0 && (SES.re[id] || 0) < 2) { SES.re[id] = (SES.re[id] || 0) + 1; SES.q.push(id); }
      SES.i++; stopAudio(); render(); window.scrollTo(0, 0);
    },
    autoToggle: () => { AUTO.playing = !AUTO.playing; if (AUTO.playing) { render(); autoLoop(); } else { stopAudio(); render(); } },
    exToggle: () => { S.settings.readEx = !S.settings.readEx; save(); render(); },
    zhToggle: () => { S.settings.zhRead = !S.settings.zhRead; save(); render(); },
    autoSay: () => { AUTO.playing = false; sayWord(AUTO.list[AUTO.i]); render(); },
    autoSpeed: () => { S.settings.rate = RATES[(RATES.indexOf(RATE()) + 1) % RATES.length]; save(); render(); },
    studySpeed: () => { S.settings.rate = RATES[(RATES.indexOf(RATE()) + 1) % RATES.length]; save(); render(); },
    hist: () => history.back(),
    autoPrev: () => { const was = AUTO.playing; stopAudio(); AUTO.i = Math.max(0, AUTO.i - 1); render(); if (was) autoLoop(); },
    autoNext: () => { const was = AUTO.playing; stopAudio(); AUTO.i = Math.min(AUTO.list.length - 1, AUTO.i + 1); render(); if (was) autoLoop(); },
    level: v => { setBox(AUTO.list[AUTO.i].id, [0, 1, 3, 5][+v]); ACT.autoNext(); },
    sleepToggle: () => { if (SLP.playing) return stopSleep(); SLP = { playing: true, endAt: S.sleep.dur ? Date.now() + S.sleep.dur * 60000 : 0, cur: null }; render(); sleepLoop(); },
    sleepDur: v => { S.sleep.dur = +v; save(); render(); },
    sleepCat: v => { const c = S.sleep.cats; if (v === 'all') S.sleep.cats = []; else S.sleep.cats = c.includes(v) ? c.filter(x => x !== v) : c.concat(v); save(); render(); },
    sleepRand: () => { S.sleep.rand = !S.sleep.rand; save(); render(); },
    set: v => { const [k, x] = v.split(':'); S.settings[k] = +x; save(); render(); },
    setBool: v => { S.settings[v] = !S.settings[v]; save(); render(); },
    export: () => {
      const b = new Blob([JSON.stringify(S)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = `泰语学习进度_${ymd().replace(/-/g, '')}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
    reset: () => { if (confirm('确定清空所有学习进度吗？建议先导出备份。')) { S = defaults(); save(); toast('已清空'); render(); } },
  };
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (el && ACT[el.dataset.a]) ACT[el.dataset.a](el.dataset.v, el);
  });

  /* ---------- 启动 ---------- */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    } else {
      navigator.serviceWorker.register('sw.js').catch(() => { /* 不支持就当普通网页 */ });
    }
  }
  route();
})();
