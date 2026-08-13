(() => {
  const data = window.BARCA_DATA ?? { matches: [], players: [], teamBadges: [] };
  const storageKey = "barca-archive-personal-v1";
  const positionNames = { Goalkeeper: "门将", Defender: "后卫", Midfielder: "中场", Forward: "前锋" };
  const summaries = {
    "110491": "反应迅速、脚下技术出色，能够主动参与后场组织的门将。",
    "3543": "拥有阿森纳、罗马和尤文图斯经历，比赛经验极为丰富的国际级门将。",
    "68906": "速度、力量与突破能力兼备，能够持续支援进攻的爆发型边后卫。",
    "129400": "判断果断、具备领导力，同时能够从后场稳定推进球权的中后卫。",
    "4495": "阅读比赛能力突出，传球准确并善于寻找由守转攻线路的中后卫。",
    "111861": "能够胜任左后卫和中后卫位置，适应性出色的防守球员。",
    "15552": "速度快、拦截及时，同时拥有优秀持球和推进能力的后卫。",
    "24635": "擅长从后场组织进攻，并依靠预判完成防守的中后卫。",
    "129337": "防守果断，向前冲刺和进攻纵深能力突出的年轻后卫。",
    "116719": "技术、斗志和比赛阅读能力兼备，风格鲜明的中场球员。",
    "70486": "善于向前持球、摆脱直接对手，并通过传球打穿防线的中场。",
    "118929": "从拉玛西亚成长为一线队重要成员，跑动和前插能力突出。",
    "117924": "勤奋、稳定且具备领导气质的拉玛西亚中场。",
    "16677": "能够在中场和前场多个位置发挥作用，兼具创造力与得分能力。",
    "16291": "视野、能量与多位置适应能力出色，能够掌控中场节奏。",
    "141411": "战术意识和防守能力突出，能够保护防线的后腰。",
    "43098": "技术特点全面，能够胜任锋线多个位置的进攻球员。",
    "129404": "来自拉玛西亚的顶级年轻天才，以大胆、直接的盘带突破见长。",
    "24156": "技术和盘带能力出众，擅长在边路突破并参与快速配合。",
    "123727": "兼具技术、速度和得分能力，发展潜力突出的年轻右边锋。",
    "23747": "跑动积极，既能担任边锋也能出任中锋的攻击手。",
    "52163": "速度极快、适应性强，能够胜任锋线各个位置。",
    "136745": "盘带和强力推进能力突出，拥有广阔发展空间的年轻边锋。",
  };

  const escapeHtml = (value = "") =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const formatDate = (value) => {
    if (!value) return "日期待定";
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(`${value}T12:00:00`));
  };

  const playerImage = (player, variant = "full") => {
    const original = player?.portrait ?? "";
    if (!original.includes("assets/barca-brand/players/")) return original;
    const file = original.split("/").pop().replace(/\.[^.]+$/, ".webp");
    return `assets/barca-brand/players/${variant === "thumb" ? "thumbs" : "webp"}/${file}`;
  };

  const optimizedNewsImage = (source = "") => {
    if (!source.startsWith("assets/news/")) return source;
    return source.replace(/\.[^.]+$/, ".webp");
  };

  const imageMarkup = (source, alt, options = {}) => {
    if (!source) return "";
    const optimized = options.player ? playerImage(options.player, options.variant) : options.news ? optimizedNewsImage(source) : source;
    const loading = options.eager ? "eager" : "lazy";
    const priority = options.eager ? ' fetchpriority="high"' : "";
    return `<img src="${escapeHtml(optimized)}" data-fallback-src="${escapeHtml(source)}" alt="${escapeHtml(alt)}" loading="${loading}" decoding="async"${priority} />`;
  };

  const defaultStore = () => ({ favorites: { players: [], matches: [] }, recent: { players: [], matches: [] } });
  const readStore = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "null");
      return {
        favorites: {
          players: Array.isArray(parsed?.favorites?.players) ? parsed.favorites.players.map(String) : [],
          matches: Array.isArray(parsed?.favorites?.matches) ? parsed.favorites.matches.map(String) : [],
        },
        recent: {
          players: Array.isArray(parsed?.recent?.players) ? parsed.recent.players.map(String) : [],
          matches: Array.isArray(parsed?.recent?.matches) ? parsed.recent.matches.map(String) : [],
        },
      };
    } catch {
      return defaultStore();
    }
  };

  const writeStore = (store) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(store));
    } catch {
      return;
    }
    window.dispatchEvent(new CustomEvent("barca-personal-updated"));
  };

  const favoriteCount = () => {
    const store = readStore();
    return store.favorites.players.length + store.favorites.matches.length;
  };

  const isFavorite = (type, id) => readStore().favorites[type]?.includes(String(id));

  const toggleFavorite = (type, id) => {
    const store = readStore();
    const key = String(id);
    const list = store.favorites[type] ?? [];
    store.favorites[type] = list.includes(key) ? list.filter((item) => item !== key) : [key, ...list];
    writeStore(store);
    return store.favorites[type].includes(key);
  };

  const rememberRecent = (type, id) => {
    const store = readStore();
    const key = String(id);
    store.recent[type] = [key, ...(store.recent[type] ?? []).filter((item) => item !== key)].slice(0, 8);
    writeStore(store);
  };

  const clearPersonal = (scope = "all") => {
    const store = readStore();
    if (scope === "all") writeStore(defaultStore());
    else {
      if (store.favorites[scope]) store.favorites[scope] = [];
      if (store.recent[scope]) store.recent[scope] = [];
      writeStore(store);
    }
  };

  const playerSummary = (player) => summaries[String(player?.id)] || player?.tagline || "官方球员档案摘要待补充。";

  const setMeta = ({ title, description, image, canonical }) => {
    if (title) document.title = title;
    const ensure = (selector, attr, value) => {
      let node = document.head.querySelector(selector);
      if (!node) {
        node = document.createElement(selector.startsWith("link") ? "link" : "meta");
        if (selector.includes("canonical")) node.rel = "canonical";
        const property = selector.match(/property="([^"]+)/)?.[1];
        const name = selector.match(/name="([^"]+)/)?.[1];
        if (property) node.setAttribute("property", property);
        if (name) node.setAttribute("name", name);
        document.head.append(node);
      }
      node.setAttribute(attr, value);
    };
    if (description) ensure('meta[name="description"]', "content", description);
    ensure('meta[property="og:title"]', "content", title || document.title);
    ensure('meta[property="og:description"]', "content", description || "巴萨赛场档案");
    ensure('meta[property="og:type"]', "content", "website");
    if (image) ensure('meta[property="og:image"]', "content", new URL(image, location.href).href);
    const url = canonical || location.href;
    ensure('meta[property="og:url"]', "content", url);
    ensure('link[rel="canonical"]', "href", url);
  };

  const sharePage = async (title, text, url = location.href) => {
    try {
      if (navigator.share) await navigator.share({ title, text, url });
      else {
        await navigator.clipboard.writeText(url);
        showToast("链接已复制");
      }
    } catch (error) {
      if (error?.name !== "AbortError") showToast("暂时无法分享，请复制浏览器地址");
    }
  };

  const showToast = (message) => {
    let toast = document.querySelector("[data-experience-toast]");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "experience-toast";
      toast.dataset.experienceToast = "";
      toast.setAttribute("role", "status");
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
  };

  const normalizeName = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const playerMatchLog = (player) => {
    const playerNames = [player.displayName, `${player.firstName || ""}${player.lastName || ""}`].map(normalizeName);
    return (data.matches ?? []).flatMap((match) => {
      const lineups = match.details?.lineups ?? (match.details?.lineup ? [match.details.lineup] : []);
      for (const lineup of lineups) {
        const entry = (lineup.players ?? []).find((item) => String(item.id) === String(player.id) || playerNames.includes(normalizeName(item.name || item.displayName)));
        if (entry) return [{ match, entry }];
      }
      return [];
    });
  };

  const aggregateStats = (log) => {
    const totals = {};
    log.forEach(({ entry }) => {
      Object.entries(entry.stats ?? {}).forEach(([key, value]) => {
        if (typeof value === "number") totals[key] = (totals[key] ?? 0) + value;
      });
    });
    return totals;
  };

  const renderHonours = (player) => {
    const honours = player.honours ?? [];
    if (!honours.length) return '<div class="experience-empty"><strong>暂无荣誉条目</strong><p>公开档案尚未列出个人或球队荣誉。</p></div>';
    return `<div class="player-page-honours">${honours.map((honour) => `<article><span>${escapeHtml(honour.type)}</span><div><strong>${escapeHtml(honour.title)}</strong><small>${escapeHtml(honour.seasons || "赛季待确认")}</small></div><b>${escapeHtml(honour.count)}</b></article>`).join("")}</div>`;
  };

  const renderPlayerPage = () => {
    const root = document.querySelector("[data-player-page]");
    if (!root) return;
    const id = new URLSearchParams(location.search).get("id");
    const players = [...(data.players ?? [])].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const player = players.find((item) => String(item.id) === String(id));
    if (!player) {
      root.innerHTML = '<section class="experience-not-found page-shell"><p>PLAYER NOT FOUND</p><h1>没有找到这名球员</h1><a href="players.html">返回一线队名单 →</a></section>';
      return;
    }

    const index = players.indexOf(player);
    const previous = players[(index - 1 + players.length) % players.length];
    const next = players[(index + 1) % players.length];
    const log = playerMatchLog(player);
    const stats = aggregateStats(log);
    const facts = [["出生日期", player.birthDate], ["出生地", player.birthPlace], ["身高", player.height], ["体重", player.weight]];
    const canonical = new URL(`player.html?id=${encodeURIComponent(player.id)}`, location.href).href;
    const description = `${player.displayName}球员档案：${playerSummary(player)}`;
    setMeta({ title: `${player.displayName} · 球员档案 · 巴萨赛场档案`, description, image: player.portrait, canonical });
    rememberRecent("players", player.id);

    const schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Person", name: player.displayName, image: new URL(player.portrait, location.href).href, description, url: canonical, affiliation: { "@type": "SportsTeam", name: "FC Barcelona" } });
    document.head.append(schema);

    root.innerHTML = `
      <section class="player-page-hero">
        <div class="player-page-portrait">${imageMarkup(player.portrait, `${player.displayName}官方定妆照`, { player, variant: "full", eager: true })}</div>
        <div class="player-page-intro">
          <p>${escapeHtml(player.number || "—")} · ${escapeHtml(positionNames[player.position] || player.position)}</p>
          <h1>${escapeHtml(player.displayName)}</h1>
          <strong>${escapeHtml(playerSummary(player))}</strong>
          <div class="player-page-actions">
            <button type="button" data-favorite-player="${escapeHtml(player.id)}">${isFavorite("players", player.id) ? "已收藏" : "收藏球员"}</button>
            <button type="button" data-share-player>分享档案</button>
            <a href="compare.html?a=${encodeURIComponent(player.id)}">加入对比 →</a>
          </div>
          <dl>${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value || "待确认")}</dd></div>`).join("")}</dl>
        </div>
      </section>
      <nav class="player-page-tabs page-shell" aria-label="球员档案栏目">
        <button class="is-active" type="button" data-player-tab="overview">档案概览</button>
        <button type="button" data-player-tab="season">赛季数据</button>
        <button type="button" data-player-tab="matches">比赛记录</button>
        <button type="button" data-player-tab="source">官方原文</button>
      </nav>
      <div class="player-page-content page-shell">
        <section data-player-panel="overview">
          <div class="player-page-section-heading"><p>PROFILE / HONOURS</p><h2>球员档案</h2><span>资料来源：FC Barcelona 官方球员页</span></div>
          <div class="player-overview-grid"><article><h3>中文简介</h3><p>${escapeHtml(playerSummary(player))}</p><p>位置：${escapeHtml(positionNames[player.position] || player.position)}。当前档案包含 ${facts.filter(([, value]) => value).length}/4 项基础资料与 ${(player.honours ?? []).length} 组荣誉记录。</p></article><div>${renderHonours(player)}</div></div>
        </section>
        <section data-player-panel="season" hidden>
          <div class="player-page-section-heading"><p>VERIFIED COVERAGE</p><h2>赛季数据</h2><span>只统计带有逐场球员字段的比赛</span></div>
          <div class="coverage-panel"><strong>${String(log.length).padStart(2, "0")}</strong><div><h3>已核实球员出场记录</h3><p>本站已收录 ${data.matchArchiveCount ?? (data.matches ?? []).length} 场球队比赛，但当前免费源返回的逐场阵容覆盖为 ${log.length}/${data.matchArchiveCount ?? (data.matches ?? []).length}。数据不足时不推测出场、进球或助攻。</p></div></div>
          ${Object.keys(stats).length ? `<div class="verified-stats">${Object.entries(stats).map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>` : '<div class="experience-empty"><strong>赛季统计正在等待可靠公开字段</strong><p>页面结构已经支持出场、进球、助攻、红黄牌和其他数值；数据源返回后会自动显示。</p></div>'}
        </section>
        <section data-player-panel="matches" hidden>
          <div class="player-page-section-heading"><p>MATCH LOG</p><h2>比赛记录</h2><span>${log.length} 场具有球员级数据</span></div>
          ${log.length ? `<div class="player-match-log">${log.map(({ match, entry }) => `<a href="match.html?id=${encodeURIComponent(match.id)}"><time>${escapeHtml(formatDate(match.date))}</time><strong>${escapeHtml(match.home)} ${match.score ? match.score.join(" — ") : "VS"} ${escapeHtml(match.away)}</strong><span>${escapeHtml(entry.starter ? "首发" : "替补")} →</span></a>`).join("")}</div>` : '<div class="experience-empty"><strong>暂无可核实的逐场出场记录</strong><p>可以进入比赛档案浏览球队赛果；本站不会把球队参赛自动视为该球员出场。</p><a href="fixtures.html">浏览比赛档案 →</a></div>'}
        </section>
        <section data-player-panel="source" hidden>
          <div class="player-page-section-heading"><p>OFFICIAL PROFILE</p><h2>官方原文</h2><span>英文内容保持来源原意</span></div>
          <div class="official-biography">${(player.biography ?? []).map((paragraph) => `<p lang="en">${escapeHtml(paragraph)}</p>`).join("") || "<p>官方简介暂缺。</p>"}${player.profileUrl ? `<a href="${escapeHtml(player.profileUrl)}" target="_blank" rel="noreferrer">查看 FC Barcelona 官方球员页 ↗</a>` : ""}</div>
        </section>
      </div>
      <nav class="player-page-pagination" aria-label="浏览其他球员">
        <a href="player.html?id=${encodeURIComponent(previous.id)}"><span>上一位</span><b>← ${escapeHtml(previous.displayName)}</b></a>
        <a href="players.html"><span>一线队</span><b>全部球员</b></a>
        <a href="player.html?id=${encodeURIComponent(next.id)}"><span>下一位</span><b>${escapeHtml(next.displayName)} →</b></a>
      </nav>`;

    root.querySelectorAll("[data-player-tab]").forEach((button) => button.addEventListener("click", () => {
      root.querySelectorAll("[data-player-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
      root.querySelectorAll("[data-player-panel]").forEach((panel) => { panel.hidden = panel.dataset.playerPanel !== button.dataset.playerTab; });
    }));
    root.querySelector("[data-share-player]")?.addEventListener("click", () => sharePage(document.title, description, canonical));
  };

  const renderPersonalRail = () => {
    if (document.querySelector("[data-personal-rail]")) return;
    const rail = document.createElement("a");
    rail.href = "favorites.html";
    rail.className = "personal-rail";
    rail.dataset.personalRail = "";
    rail.setAttribute("aria-label", "查看收藏与最近浏览");
    rail.innerHTML = `<span>我的档案</span><b>${favoriteCount()}</b>`;
    document.body.append(rail);
  };

  const updatePersonalUI = () => {
    document.querySelector("[data-personal-rail] b")?.replaceChildren(String(favoriteCount()));
    document.querySelectorAll("[data-favorite-player]").forEach((button) => { button.textContent = isFavorite("players", button.dataset.favoritePlayer) ? "已收藏" : "收藏球员"; });
    document.querySelectorAll("[data-favorite-match]").forEach((button) => { button.textContent = isFavorite("matches", button.dataset.favoriteMatch) ? "已收藏" : "收藏比赛"; });
  };

  const initMatchPersonal = () => {
    const root = document.querySelector("[data-match-detail]");
    if (!root) return;
    const id = new URLSearchParams(location.search).get("id");
    const match = (data.matches ?? []).find((item) => String(item.id) === String(id));
    if (!match) return;
    rememberRecent("matches", match.id);
    const scoreboard = document.querySelector("[data-match-scoreboard]");
    if (scoreboard && !scoreboard.querySelector("[data-match-personal]")) {
      scoreboard.insertAdjacentHTML("beforeend", `<div class="match-personal-actions" data-match-personal><button type="button" data-favorite-match="${escapeHtml(match.id)}">${isFavorite("matches", match.id) ? "已收藏" : "收藏比赛"}</button><button type="button" data-share-match>分享比赛</button><a href="fixtures.html?season=${encodeURIComponent(match.season)}">查看同赛季 →</a></div>`);
      scoreboard.querySelector("[data-share-match]")?.addEventListener("click", () => sharePage(document.title, `${match.home} 对阵 ${match.away}`, location.href));
    }
  };

  const renderComparePage = () => {
    const root = document.querySelector("[data-compare-page]");
    if (!root) return;
    const players = [...(data.players ?? [])].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    if (players.length < 2) {
      root.innerHTML = '<section class="experience-not-found page-shell"><p>PLAYER COMPARISON</p><h1>球员资料不足，暂时无法对比</h1><a href="players.html">返回球员列表 →</a></section>';
      return;
    }
    const params = new URLSearchParams(location.search);
    const playerById = (id) => players.find((player) => String(player.id) === String(id));
    let left = playerById(params.get("a")) || players[0];
    let right = playerById(params.get("b")) || players.find((player) => String(player.id) !== String(left.id)) || players[1];
    if (String(left.id) === String(right.id)) right = players.find((player) => String(player.id) !== String(left.id)) || players[1];
    const title = `${left.displayName} vs ${right.displayName} · 球员对比`;
    setMeta({ title: `${title} · 巴萨赛场档案`, description: `对比 ${left.displayName} 与 ${right.displayName} 的官方球员档案、身体资料与荣誉。`, canonical: new URL(`compare.html?a=${encodeURIComponent(left.id)}&b=${encodeURIComponent(right.id)}`, location.href).href });

    const optionMarkup = (selected) => players.map((player) => `<option value="${escapeHtml(player.id)}"${String(player.id) === String(selected.id) ? " selected" : ""}>${escapeHtml(player.number || "—")} · ${escapeHtml(player.displayName)} · ${escapeHtml(positionNames[player.position] || player.position)}</option>`).join("");
    const portrait = (player, side) => `<article class="compare-player compare-player--${side}"><div class="compare-player__image">${imageMarkup(player.portrait, `${player.displayName}官方定妆照`, { player, variant: "full", eager: true })}</div><div class="compare-player__identity"><span>${escapeHtml(player.number || "—")} · ${escapeHtml(positionNames[player.position] || player.position)}</span><h2>${escapeHtml(player.displayName)}</h2><p>${escapeHtml(playerSummary(player))}</p><div><a href="player.html?id=${encodeURIComponent(player.id)}">查看完整档案 →</a><button type="button" data-favorite-player="${escapeHtml(player.id)}">${isFavorite("players", player.id) ? "已收藏" : "收藏球员"}</button></div></div></article>`;
    const facts = [["出生日期", left.birthDate, right.birthDate], ["出生地", left.birthPlace, right.birthPlace], ["身高", left.height, right.height], ["体重", left.weight, right.weight], ["档案荣誉条目", (left.honours ?? []).length, (right.honours ?? []).length]];
    const honourTotals = (player) => (player.honours ?? []).reduce((totals, honour) => {
      totals[honour.title] = (totals[honour.title] ?? 0) + (Number(honour.count) || 0);
      return totals;
    }, {});
    const leftHonours = honourTotals(left);
    const rightHonours = honourTotals(right);
    const honourTitles = [...new Set([...Object.keys(leftHonours), ...Object.keys(rightHonours)])].sort((a, b) => (rightHonours[b] ?? 0) + (leftHonours[b] ?? 0) - (rightHonours[a] ?? 0) - (leftHonours[a] ?? 0));

    root.innerHTML = `
      <section class="compare-masthead page-shell">
        <p>PLAYER COMPARISON / VERIFIED PROFILE</p>
        <div><h1>球员<br />对比</h1><p>选择两名一线队球员，横向比较官方基础档案与荣誉。没有可靠逐场字段的出场、进球和助攻不会出现在对比中。</p></div>
        <form class="compare-selectors" data-compare-form>
          <label><span>球员 A</span><select name="a" aria-label="选择第一名球员">${optionMarkup(left)}</select></label>
          <b>VS</b>
          <label><span>球员 B</span><select name="b" aria-label="选择第二名球员">${optionMarkup(right)}</select></label>
        </form>
      </section>
      <section class="compare-stage">${portrait(left, "left")}<div class="compare-stage__versus">VS</div>${portrait(right, "right")}</section>
      <section class="compare-data page-shell">
        <header><p>PROFILE MATRIX</p><h2>官方档案字段</h2><span>资料更新时间 ${escapeHtml(data.generatedAt ? formatDate(data.generatedAt.slice(0, 10)) : "待确认")}</span></header>
        <div class="compare-matrix">${facts.map(([label, a, b]) => `<div><strong>${escapeHtml(a ?? "待确认")}</strong><span>${label}</span><strong>${escapeHtml(b ?? "待确认")}</strong></div>`).join("")}</div>
      </section>
      <section class="compare-honours page-shell">
        <header><div><p>PROFILE HONOURS</p><h2>档案所列荣誉</h2></div><p>同名荣誉按官方球员档案中的条目合计；“—”表示该球员当前档案未列出该项，不代表职业生涯绝对为零。</p></header>
        ${honourTitles.length ? `<div class="compare-honours__table"><div class="compare-honours__head"><b>${escapeHtml(left.displayName)}</b><span>荣誉</span><b>${escapeHtml(right.displayName)}</b></div>${honourTitles.map((honour) => `<div><strong>${leftHonours[honour] || "—"}</strong><span>${escapeHtml(honour)}</span><strong>${rightHonours[honour] || "—"}</strong></div>`).join("")}</div>` : '<div class="experience-empty"><strong>两份官方档案暂未列出荣誉条目</strong><p>页面会在本地球员档案更新后自动显示。</p></div>'}
        <div class="coverage-panel coverage-panel--compare"><strong>0/${escapeHtml(data.matchArchiveCount ?? (data.matches ?? []).length)}</strong><div><h3>逐场球员数据覆盖率</h3><p>当前免费比赛源只包含赛程和比分，因此不进行竞技数据胜负判断。对比页面已经预留后续可靠数据入口。</p></div></div>
      </section>`;

    root.querySelector("[data-compare-form]")?.addEventListener("change", (event) => {
      const form = event.currentTarget;
      const a = form.elements.a.value;
      let b = form.elements.b.value;
      if (a === b) {
        const alternate = players.find((player) => String(player.id) !== String(a));
        b = String(alternate.id);
      }
      const url = new URL(location.href);
      url.searchParams.set("a", a);
      url.searchParams.set("b", b);
      location.href = url.href;
    });
  };

  const badgeMarkup = (team) => {
    const badge = data.teamBadges?.[team]?.badge || (team === "FC Barcelona" ? "assets/barca-brand/fcb-icon-192.png" : "");
    return badge ? `<img src="${escapeHtml(badge)}" alt="${escapeHtml(team)}队徽" loading="lazy" decoding="async" />` : `<span>${escapeHtml(team.slice(0, 2).toUpperCase())}</span>`;
  };

  const renderFavoritesPage = () => {
    const root = document.querySelector("[data-favorites-page]");
    if (!root) return;
    const store = readStore();
    const playersById = new Map((data.players ?? []).map((player) => [String(player.id), player]));
    const matchesById = new Map((data.matches ?? []).map((match) => [String(match.id), match]));
    const favoritePlayers = store.favorites.players.map((id) => playersById.get(id)).filter(Boolean);
    const favoriteMatches = store.favorites.matches.map((id) => matchesById.get(id)).filter(Boolean);
    const recentPlayers = store.recent.players.map((id) => playersById.get(id)).filter(Boolean);
    const recentMatches = store.recent.matches.map((id) => matchesById.get(id)).filter(Boolean);
    const playerCards = (players, removable = false) => players.length ? `<div class="personal-player-grid">${players.map((player) => `<article><a href="player.html?id=${encodeURIComponent(player.id)}"><div>${imageMarkup(player.portrait, player.displayName, { player, variant: "thumb" })}</div><span>${escapeHtml(player.number || "—")} · ${escapeHtml(positionNames[player.position] || player.position)}</span><h3>${escapeHtml(player.displayName)}</h3></a>${removable ? `<button type="button" data-favorite-player="${escapeHtml(player.id)}">移出收藏</button>` : ""}</article>`).join("")}</div>` : '<div class="experience-empty"><strong>这里还是空的</strong><p>打开球员档案后即可收藏；最近浏览会自动保留最多 8 条。</p><a href="players.html">浏览一线队 →</a></div>';
    const matchCards = (matches, removable = false) => matches.length ? `<div class="personal-match-list">${matches.map((match) => `<article><a href="match.html?id=${encodeURIComponent(match.id)}"><time>${escapeHtml(formatDate(match.date))} · ${escapeHtml(match.competition)}</time><div><span>${badgeMarkup(match.home)}<b>${escapeHtml(match.home)}</b></span><strong>${match.score ? `${escapeHtml(match.score[0])}<i>—</i>${escapeHtml(match.score[1])}` : "VS"}</strong><span>${badgeMarkup(match.away)}<b>${escapeHtml(match.away)}</b></span></div></a>${removable ? `<button type="button" data-favorite-match="${escapeHtml(match.id)}">移出收藏</button>` : ""}</article>`).join("")}</div>` : '<div class="experience-empty"><strong>暂无比赛记录</strong><p>进入任意比赛详情可收藏；最近浏览会自动保留最多 8 条。</p><a href="fixtures.html">浏览比赛档案 →</a></div>';
    const total = favoritePlayers.length + favoriteMatches.length;
    setMeta({ title: "我的档案 · 巴萨赛场档案", description: "保存在当前浏览器中的巴萨球员与比赛收藏。", canonical: new URL("favorites.html", location.href).href });
    root.innerHTML = `
      <section class="personal-masthead page-shell"><p>MY ARCHIVE / THIS DEVICE</p><div><h1>我的<br />档案</h1><div><strong>${String(total).padStart(2, "0")}</strong><span>条收藏</span><p>收藏与浏览历史只保存在当前设备，不需要注册，也不会上传个人数据。</p></div></div></section>
      <nav class="personal-jump page-shell" aria-label="档案分区"><a href="#favorite-players">收藏球员 <b>${favoritePlayers.length}</b></a><a href="#favorite-matches">收藏比赛 <b>${favoriteMatches.length}</b></a><a href="#recently-viewed">最近浏览 <b>${recentPlayers.length + recentMatches.length}</b></a></nav>
      <section class="personal-section page-shell" id="favorite-players"><header><div><p>FAVOURITE PLAYERS</p><h2>收藏球员</h2></div><a href="compare.html${favoritePlayers.length ? `?a=${encodeURIComponent(favoritePlayers[0].id)}${favoritePlayers[1] ? `&b=${encodeURIComponent(favoritePlayers[1].id)}` : ""}` : ""}">进入球员对比 →</a></header>${playerCards(favoritePlayers, true)}</section>
      <section class="personal-section personal-section--dark" id="favorite-matches"><div class="page-shell"><header><div><p>FAVOURITE MATCHES</p><h2>收藏比赛</h2></div><a href="fixtures.html">全部比赛 →</a></header>${matchCards(favoriteMatches, true)}</div></section>
      <section class="personal-section page-shell" id="recently-viewed"><header><div><p>RECENTLY VIEWED</p><h2>最近浏览</h2></div><button type="button" data-clear-personal="recent">清空最近浏览</button></header><div class="personal-recent-grid"><div><h3>球员</h3>${playerCards(recentPlayers)}</div><div><h3>比赛</h3>${matchCards(recentMatches)}</div></div></section>
      <section class="personal-privacy page-shell"><div><p>LOCAL STORAGE</p><h2>由你掌控的数据</h2><span>这些记录只存在浏览器 Local Storage 中。清空后无法恢复。</span></div><button type="button" data-clear-personal="all"${total + recentPlayers.length + recentMatches.length ? "" : " disabled"}>清空全部档案</button></section>`;

    root.querySelectorAll("[data-clear-personal]").forEach((button) => button.addEventListener("click", () => {
      const scope = button.dataset.clearPersonal;
      if (scope === "all" && !window.confirm("确定清空全部收藏和最近浏览吗？此操作无法恢复。")) return;
      if (scope === "recent") {
        const next = readStore();
        next.recent = { players: [], matches: [] };
        writeStore(next);
      } else clearPersonal("all");
      showToast(scope === "all" ? "全部档案已清空" : "最近浏览已清空");
    }));
  };

  const initHistoryExplorer = () => {
    const timeline = document.querySelector(".history-timeline--complete");
    if (!timeline || timeline.dataset.explorerReady) return;
    timeline.dataset.explorerReady = "true";
    const eras = [
      { key: "all", label: "全部时代", range: "1899—至今", title: "跨越三个世纪的蓝红档案", description: "从创立、生存与身份形成，到诺坎普、梦之队和现代王朝，完整保留十三个历史阶段。", links: [["历史出场榜", "appearances.html"], ["历史进球榜", "goals.html"], ["历史助攻榜", "assists.html"]] },
      { key: "foundation", label: "创立与生存", range: "1899—1949", title: "从一次聚会到城市身份", description: "俱乐部在球场、成员、政治动荡与战争中建立并守住蓝红身份。", links: [["查看最早年代", "#history-timeline"]] },
      { key: "campnou", label: "诺坎普时代", range: "1950—1987", title: "新球场与新的社会维度", description: "库巴拉、诺坎普、克鲁伊夫和不断扩大的会员体系共同塑造现代巴萨。", links: [["俱乐部荣誉", "#honours-title"], ["比赛档案", "fixtures.html"]] },
      { key: "dreamteam", label: "梦之队与复兴", range: "1988—2007", title: "从温布利到拉玛西亚复兴", description: "克鲁伊夫的梦之队奠定足球哲学，百年之后的新一代重新登上欧洲之巅。", links: [["历史出场榜", "appearances.html"], ["历史进球榜", "goals.html"]] },
      { key: "golden", label: "黄金王朝", range: "2008—2020", title: "改变世界足球的时代", description: "传控体系、拉玛西亚核心与多个冠军周期共同构成队史最辉煌的竞技阶段。", links: [["历史进球榜", "goals.html"], ["历史助攻榜", "assists.html"], ["冠军目录", "#honours-title"]] },
      { key: "new", label: "新周期", range: "2021—至今", title: "年轻一代与重返诺坎普", description: "拉玛西亚新核心、球队重建与焕新的主场共同打开下一段历史。", links: [["当前一线队", "players.html"], ["近五年比赛", "fixtures.html"], ["最新资讯", "news.html"]] },
    ];
    const eraForYear = (year) => year <= 1949 ? "foundation" : year <= 1987 ? "campnou" : year <= 2007 ? "dreamteam" : year <= 2020 ? "golden" : "new";
    [...timeline.children].forEach((item) => {
      const year = Number(item.querySelector("time")?.textContent.match(/\d{4}/)?.[0] || 9999);
      item.dataset.historyEra = eraForYear(year);
    });
    timeline.id = "history-timeline";
    const explorer = document.createElement("section");
    explorer.className = "history-explorer";
    explorer.innerHTML = `<div class="history-era-switch" aria-label="按时代筛选历史">${eras.map((era) => `<button type="button" data-history-era-button="${era.key}">${era.label}</button>`).join("")}</div><article class="history-era-focus" data-history-era-focus></article>`;
    timeline.before(explorer);
    const initial = eras.some((era) => era.key === new URLSearchParams(location.search).get("era")) ? new URLSearchParams(location.search).get("era") : "all";
    const showEra = (key) => {
      const era = eras.find((item) => item.key === key) || eras[0];
      timeline.querySelectorAll("[data-history-era]").forEach((item) => { item.hidden = key !== "all" && item.dataset.historyEra !== key; });
      explorer.querySelectorAll("[data-history-era-button]").forEach((button) => button.classList.toggle("is-active", button.dataset.historyEraButton === key));
      explorer.querySelector("[data-history-era-focus]").innerHTML = `<span>${era.range}</span><div><h2>${era.title}</h2><p>${era.description}</p><nav>${era.links.map(([label, href]) => `<a href="${href}">${label} →</a>`).join("")}</nav></div>`;
      const url = new URL(location.href);
      if (key === "all") url.searchParams.delete("era"); else url.searchParams.set("era", key);
      history.replaceState({}, "", url);
    };
    explorer.addEventListener("click", (event) => {
      const button = event.target.closest("[data-history-era-button]");
      if (button) showEra(button.dataset.historyEraButton);
    });
    showEra(initial);

    const honours = document.querySelector(".honours-catalog__list");
    if (honours) {
      const filters = document.createElement("div");
      filters.className = "honours-filter";
      filters.innerHTML = '<button class="is-active" type="button" data-honours-filter="all">全部荣誉</button><button type="button" data-honours-filter="EUROPE">欧洲</button><button type="button" data-honours-filter="WORLD">世界</button><button type="button" data-honours-filter="SPAIN">西班牙</button><button type="button" data-honours-filter="CATALONIA">加泰罗尼亚</button>';
      honours.before(filters);
      filters.addEventListener("click", (event) => {
        const button = event.target.closest("[data-honours-filter]");
        if (!button) return;
        const category = button.dataset.honoursFilter;
        filters.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
        [...honours.children].forEach((article) => { article.hidden = category !== "all" && article.querySelector("span")?.textContent.trim() !== category; });
      });
    }
  };

  document.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.dataset.fallbackSrc || image.src.endsWith(image.dataset.fallbackSrc)) return;
    image.src = image.dataset.fallbackSrc;
  }, true);

  document.addEventListener("click", (event) => {
    const playerButton = event.target.closest("[data-favorite-player]");
    const matchButton = event.target.closest("[data-favorite-match]");
    if (playerButton) {
      const active = toggleFavorite("players", playerButton.dataset.favoritePlayer);
      showToast(active ? "已收藏球员" : "已取消收藏");
    }
    if (matchButton) {
      const active = toggleFavorite("matches", matchButton.dataset.favoriteMatch);
      showToast(active ? "已收藏比赛" : "已取消收藏");
    }
  });

  window.addEventListener("barca-personal-updated", () => {
    updatePersonalUI();
    renderFavoritesPage();
  });

  window.BarcaExperience = {
    data,
    escapeHtml,
    formatDate,
    playerImage,
    optimizedNewsImage,
    imageMarkup,
    playerSummary,
    playerMatchLog,
    aggregateStats,
    readStore,
    writeStore,
    isFavorite,
    toggleFavorite,
    rememberRecent,
    clearPersonal,
    sharePage,
    showToast,
    setMeta,
    positionNames,
    renderComparePage,
    renderFavoritesPage,
  };

  if (!document.body.classList.contains("home-page")) renderPersonalRail();
  renderPlayerPage();
  renderComparePage();
  renderFavoritesPage();
  initMatchPersonal();
  initHistoryExplorer();
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
