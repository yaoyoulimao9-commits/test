const siteData = window.BARCA_DATA ?? { matches: [], players: [], media: [], news: [] };
if (window.BARCA_NEWS?.items) {
  siteData.news = window.BARCA_NEWS.items;
  siteData.newsUpdatedAt = window.BARCA_NEWS.updatedAt;
}

const positionNames = {
  Goalkeeper: "门将",
  Defender: "后卫",
  Midfielder: "中场",
  Forward: "前锋",
};

const competitionNames = {
  laliga: "西甲",
  ucl: "欧冠",
  uel: "欧联杯",
  copa: "国王杯",
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDate = (dateString) => {
  if (!dateString) return "日期待定";
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
};

const optimizedPlayerImage = (player, variant = "full") => {
  const original = player?.portrait ?? "";
  if (!original.includes("assets/barca-brand/players/")) return original;
  const file = original.split("/").pop().replace(/\.[^.]+$/, ".webp");
  return `assets/barca-brand/players/${variant === "thumb" ? "thumbs" : "webp"}/${file}`;
};

const optimizedNewsImage = (source = "") => source.startsWith("assets/news/") ? source.replace(/\.[^.]+$/, ".webp") : source;

const imageWithFallback = ({ source, optimized = source, alt = "", loading = "lazy", className = "" }) =>
  `<img${className ? ` class="${escapeHtml(className)}"` : ""} src="${escapeHtml(optimized)}" data-fallback-src="${escapeHtml(source)}" alt="${escapeHtml(alt)}" loading="${loading}" decoding="async" />`;

const initMenu = () => {
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-menu]");
  if (!menuToggle || !menu) return;

  const closeMenu = () => {
    menuToggle.setAttribute("aria-expanded", "false");
    menu.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  };

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    menu.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("menu-open", !isOpen);
  });

  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  window.addEventListener("resize", () => {
    if (window.innerWidth > 820) closeMenu();
  });
};

const initCarousels = () => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll("[data-carousel]").forEach((carousel) => {
    const slides = [...carousel.querySelectorAll("[data-slide]")];
    const dotsRoot = carousel.querySelector("[data-carousel-dots]");
    const previous = carousel.querySelector("[data-carousel-prev]");
    const next = carousel.querySelector("[data-carousel-next]");
    const pause = carousel.querySelector("[data-carousel-pause]");
    if (slides.length < 2) return;

    let current = Math.max(0, slides.findIndex((slide) => slide.classList.contains("is-active")));
    let timer = null;
    let hoverDelayTimer = null;
    let hoverRepeatTimer = null;
    let isPaused = reducedMotion;
    const interval = Number(carousel.dataset.interval) || 6000;
    const hoverDelay = Number(carousel.dataset.hoverDelay) || 280;
    const hoverInterval = Number(carousel.dataset.hoverInterval) || 1100;

    const dots = slides.map((slide, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `显示第 ${index + 1} 张图片`);
      dot.addEventListener("click", () => show(index, true));
      dotsRoot?.append(dot);
      return dot;
    });

    const schedule = () => {
      window.clearInterval(timer);
      if (!isPaused) timer = window.setInterval(() => show(current + 1, false), interval);
    };

    const stopHoverPlayback = () => {
      window.clearTimeout(hoverDelayTimer);
      window.clearInterval(hoverRepeatTimer);
      hoverDelayTimer = null;
      hoverRepeatTimer = null;
    };

    const show = (index, restart = true) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === current;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", String(!active));
      });
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === current;
        dot.classList.toggle("is-active", active);
        dot.setAttribute("aria-current", active ? "true" : "false");
      });
      if (restart) schedule();
    };

    previous?.addEventListener("click", () => show(current - 1));
    next?.addEventListener("click", () => show(current + 1));
    pause?.addEventListener("click", () => {
      isPaused = !isPaused;
      pause.textContent = isPaused ? "▶" : "Ⅱ";
      pause.setAttribute("aria-label", isPaused ? "继续自动播放" : "暂停自动播放");
      pause.classList.toggle("is-paused", isPaused);
      schedule();
    });
    carousel.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") show(current - 1);
      if (event.key === "ArrowRight") show(current + 1);
    });
    carousel.addEventListener("pointerenter", () => window.clearInterval(timer));
    carousel.addEventListener("pointerleave", () => {
      stopHoverPlayback();
      schedule();
    });

    carousel.querySelectorAll("[data-carousel-hover]").forEach((zone) => {
      const direction = Number(zone.dataset.carouselHover) < 0 ? -1 : 1;
      zone.addEventListener("pointerenter", (event) => {
        if (event.pointerType === "touch") return;
        window.clearInterval(timer);
        stopHoverPlayback();
        hoverDelayTimer = window.setTimeout(() => {
          show(current + direction, false);
          if (!reducedMotion) {
            hoverRepeatTimer = window.setInterval(() => show(current + direction, false), hoverInterval);
          }
        }, hoverDelay);
      });
      zone.addEventListener("pointerleave", () => {
        stopHoverPlayback();
        schedule();
      });
    });

    if (reducedMotion && pause) {
      pause.textContent = "▶";
      pause.setAttribute("aria-label", "继续自动播放");
      pause.classList.add("is-paused");
    }
    show(current, false);
    schedule();
  });
};

const playerById = (id) => siteData.players.find((player) => String(player.id) === String(id));

const openPlayerDialog = (player, stats = null) => {
  const dialog = document.querySelector("[data-player-dialog]");
  const content = dialog?.querySelector("[data-player-dialog-content]");
  if (!dialog || !content || !player) return;

  const statItems = stats
    ? Object.entries(stats)
        .filter(([, value]) => value !== null && value !== undefined && typeof value !== "object")
        .map(([label, value]) => `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`)
        .join("")
    : "";

  const profileFacts = [
    ["出生日期", player.birthDate],
    ["出生地", player.birthPlace],
    ["身高", player.height],
    ["体重", player.weight],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<li><span>${label}</span><strong>${escapeHtml(value)}</strong></li>`)
    .join("");

  const honours = (player.honours ?? [])
    .map(
      (honour) => `<li><span>${escapeHtml(honour.type)}</span><strong>${escapeHtml(honour.title)}</strong><b>${escapeHtml(honour.count)}</b><small>${escapeHtml(honour.seasons)}</small></li>`,
    )
    .join("");

  const biography = (player.biography ?? [])
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
  const localizedSummary = window.BarcaExperience?.playerSummary(player) || player.tagline;

  content.innerHTML = `
    <div class="dialog-player">
      <div class="dialog-player__portrait">
        ${player.portrait ? imageWithFallback({ source: player.portrait, optimized: optimizedPlayerImage(player), alt: `${player.displayName}定妆照`, loading: "eager" }) : `<span>${escapeHtml(player.number || "—")}</span>`}
      </div>
      <div class="dialog-player__copy">
        <p>${escapeHtml(player.number || "—")} · ${escapeHtml(positionNames[player.position] || player.position || "球员")}</p>
        <h2 id="player-dialog-title">${escapeHtml(player.displayName || player.name)}</h2>
        ${localizedSummary ? `<p class="dialog-player__tagline">${escapeHtml(localizedSummary)}</p>` : ""}
        ${
          stats
            ? `<h3 class="dialog-subtitle">本场比赛</h3><ul class="dialog-stats">${statItems}</ul>`
            : ""
        }
        ${profileFacts ? `<h3 class="dialog-subtitle">球员档案</h3><ul class="profile-facts">${profileFacts}</ul>` : ""}
        ${honours ? `<h3 class="dialog-subtitle">个人荣誉</h3><ul class="profile-honours">${honours}</ul>` : ""}
        ${biography ? `<details class="profile-biography"><summary>官方档案简介（英文原文）</summary><div>${biography}</div></details>` : ""}
        ${!stats && !profileFacts ? `<div class="dialog-data-note"><strong>档案数据暂缺</strong><p>当前公开来源尚未提供这名球员的完整基础信息。</p></div>` : ""}
        <div class="dialog-player__actions"><a href="player.html?id=${encodeURIComponent(player.id)}">进入完整球员档案 →</a><button type="button" data-favorite-player="${escapeHtml(player.id)}">${window.BarcaExperience?.isFavorite("players", player.id) ? "已收藏" : "收藏球员"}</button></div>
        ${player.profileUrl ? `<a href="${escapeHtml(player.profileUrl)}" target="_blank" rel="noreferrer">查看巴萨官方球员页 ↗</a>` : ""}
      </div>
    </div>`;
  dialog.scrollTop = 0;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
};

const initPlayerDialog = () => {
  const dialog = document.querySelector("[data-player-dialog]");
  if (!dialog) return;
  const clearPreview = () => {
    if (!document.querySelector("[data-player-directory]")) return;
    const url = new URL(location.href);
    url.searchParams.delete("preview");
    history.replaceState({}, "", url);
  };
  dialog.querySelector("[data-dialog-close]")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", clearPreview);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
};

const initPlayerDirectory = () => {
  const directory = document.querySelector("[data-player-directory]");
  if (!directory) return;
  const filters = document.querySelector("[data-player-filter]");
  const search = document.querySelector("[data-player-search]");
  const initialParams = new URLSearchParams(location.search);
  let activePosition = initialParams.get("position") || "all";
  let query = initialParams.get("q") || "";

  if (search) search.value = query;
  filters?.querySelectorAll("button").forEach((button) => button.classList.toggle("is-active", button.dataset.position === activePosition));

  const updateUrl = () => {
    const url = new URL(location.href);
    if (activePosition === "all") url.searchParams.delete("position");
    else url.searchParams.set("position", activePosition);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    history.replaceState({}, "", url);
  };

  const render = () => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    const players = siteData.players.filter((player) => {
      if (activePosition !== "all" && player.position !== activePosition) return false;
      if (normalizedQuery && !`${player.displayName} ${player.firstName || ""} ${player.lastName || ""} ${positionNames[player.position] || player.position}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery)) return false;
      return true;
    });
    if (!players.length) {
      directory.innerHTML = '<div class="data-empty"><strong>未读取到球员名单</strong><p>请先运行免费数据同步程序。</p></div>';
      return;
    }

    directory.innerHTML = players
      .map(
        (player) => `
          <button class="directory-player" type="button" data-player-id="${escapeHtml(player.id)}">
            <span class="directory-player__portrait">
              ${player.portrait ? imageWithFallback({ source: player.portrait, optimized: optimizedPlayerImage(player, "thumb"), alt: `${player.displayName}官方定妆照` }) : `<i>${escapeHtml(player.number || "—")}</i>`}
            </span>
            <span class="directory-player__number">${escapeHtml(String(player.number || "—").padStart(2, "0"))}</span>
            <span class="directory-player__name"><b>${escapeHtml(player.displayName)}</b><small>${escapeHtml(positionNames[player.position] || player.position)} · 查看完整档案</small></span>
            <span class="directory-player__arrow">↗</span>
          </button>`,
      )
      .join("");

    directory.querySelectorAll("[data-player-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const url = new URL(location.href);
        url.searchParams.set("preview", button.dataset.playerId);
        history.replaceState({}, "", url);
        openPlayerDialog(playerById(button.dataset.playerId));
      });
    });
  };

  filters?.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      activePosition = button.dataset.position;
      filters.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
      updateUrl();
      render();
    });
  });

  search?.addEventListener("input", () => {
    query = search.value;
    updateUrl();
    render();
  });

  render();
  const previewPlayer = playerById(initialParams.get("preview"));
  if (previewPlayer) openPlayerDialog(previewPlayer);
};

const getBarcaResult = (match) => {
  if (!match.score) return { label: "待赛", className: "is-pending" };
  const barcaHome = match.home === "FC Barcelona";
  const barcaGoals = match.score[barcaHome ? 0 : 1];
  const opponentGoals = match.score[barcaHome ? 1 : 0];
  if (barcaGoals > opponentGoals) return { label: "胜", className: "is-win" };
  if (barcaGoals < opponentGoals) return { label: "负", className: "is-loss" };
  return { label: "平", className: "is-draw" };
};

const renderTeamMark = (team) => {
  const entry = siteData.teamBadges?.[team];
  if (entry?.badge) {
    const markClass = team === "FC Barcelona" ? "team-mark team-mark--barca" : "team-mark";
    return `<img class="${markClass}" src="${escapeHtml(entry.badge)}" alt="${escapeHtml(team)} 队徽" loading="lazy" decoding="async" />`;
  }
  return `<span class="team-mark--missing" role="img" aria-label="${escapeHtml(team)} 队徽暂缺">—</span>`;
};

const initMatchBrowser = () => {
  const list = document.querySelector("[data-match-list]");
  if (!list) return;
  const seasonSelect = document.querySelector("[data-filter-season]");
  const competitionSelect = document.querySelector("[data-filter-competition]");
  const queryInput = document.querySelector("[data-filter-query]");
  const loadMore = document.querySelector("[data-load-more]");
  const count = document.querySelector("[data-match-count]");
  const dashboard = document.querySelector("[data-match-dashboard]");
  const viewButtons = [...document.querySelectorAll("[data-match-view]")];
  const params = new URLSearchParams(location.search);
  let visibleCount = 36;
  let view = params.get("view") === "months" ? "months" : "list";

  if (count) count.textContent = new Intl.NumberFormat("zh-CN").format(siteData.matches.length);

  [...new Set(siteData.matches.map((match) => match.season))]
    .sort()
    .reverse()
    .forEach((season) => seasonSelect?.insertAdjacentHTML("beforeend", `<option value="${season}">${season.replace("-", "/")}</option>`));
  [...new Set(siteData.matches.map((match) => match.competitionCode))]
    .sort()
    .forEach((code) => competitionSelect?.insertAdjacentHTML("beforeend", `<option value="${code}">${escapeHtml(competitionNames[code] || code)}</option>`));

  if (seasonSelect && [...seasonSelect.options].some((option) => option.value === params.get("season"))) seasonSelect.value = params.get("season");
  if (competitionSelect && [...competitionSelect.options].some((option) => option.value === params.get("competition"))) competitionSelect.value = params.get("competition");
  if (queryInput) queryInput.value = params.get("q") || "";

  const renderMatch = (match) => {
    const result = getBarcaResult(match);
    const score = match.score ? `${match.score[0]} <i>—</i> ${match.score[1]}` : match.time || "待定";
    return `
      <a class="archive-match" href="match.html?id=${encodeURIComponent(match.id)}">
        <time datetime="${escapeHtml(match.date)}"><b>${escapeHtml(match.date.slice(8, 10))}</b><span>${escapeHtml(formatDate(match.date).replace(/\d{4}年/, ""))}</span></time>
        <div class="archive-match__meta"><strong>${escapeHtml(match.competition)}</strong><span>${escapeHtml(match.round || match.season)}</span></div>
        <div class="archive-match__teams">
          <span>${renderTeamMark(match.home)}<b>${escapeHtml(match.home)}</b></span>
          <strong>${score}</strong>
          <span>${renderTeamMark(match.away)}<b>${escapeHtml(match.away)}</b></span>
        </div>
        <div class="archive-match__status"><span class="result-tag ${result.className}">${result.label}</span><small>${match.dataLevel === "full" ? "完整详情" : "基础赛果"}</small><i>→</i></div>
      </a>`;
  };

  const updateUrl = () => {
    const url = new URL(location.href);
    const values = { season: seasonSelect?.value, competition: competitionSelect?.value, q: queryInput?.value.trim(), view };
    Object.entries(values).forEach(([key, value]) => {
      if (!value || value === "all" || (key === "view" && value === "list")) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    });
    history.replaceState({}, "", url);
  };

  const renderDashboard = (filtered) => {
    if (!dashboard) return;
    const completed = filtered.filter((match) => Array.isArray(match.score));
    const totals = completed.reduce((summary, match) => {
      const result = getBarcaResult(match).className;
      if (result === "is-win") summary.wins += 1;
      else if (result === "is-loss") summary.losses += 1;
      else summary.draws += 1;
      const barcaHome = match.home === "FC Barcelona";
      summary.goalsFor += Number(match.score[barcaHome ? 0 : 1] || 0);
      summary.goalsAgainst += Number(match.score[barcaHome ? 1 : 0] || 0);
      return summary;
    }, { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 });
    const recent = [...completed].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).reverse();
    const full = filtered.filter((match) => match.dataLevel === "full").length;
    dashboard.innerHTML = `
      <div><span>当前范围</span><strong>${new Intl.NumberFormat("zh-CN").format(filtered.length)}</strong><small>场比赛</small></div>
      <div><span>战绩</span><strong>${totals.wins}<i>胜</i> ${totals.draws}<i>平</i> ${totals.losses}<i>负</i></strong><small>${completed.length} 场已有比分</small></div>
      <div><span>进失球</span><strong>${totals.goalsFor}<i>进</i> ${totals.goalsAgainst}<i>失</i></strong><small>按巴萨视角统计</small></div>
      <div class="match-form"><span>最近五场</span><p>${recent.length ? recent.map((match) => { const result = getBarcaResult(match); return `<i class="${result.className}" title="${escapeHtml(match.home)} vs ${escapeHtml(match.away)}">${result.label}</i>`; }).join("") : "暂无比分"}</p><small>由左至右：早 → 晚</small></div>
      <div class="match-coverage"><span>完整数据覆盖</span><strong>${full}/${filtered.length}</strong><small>其余场次仅显示已核实赛果</small></div>`;
  };

  const render = () => {
    const season = seasonSelect?.value ?? "all";
    const competition = competitionSelect?.value ?? "all";
    const query = queryInput?.value.trim().toLocaleLowerCase("zh-CN") ?? "";
    const filtered = siteData.matches.filter((match) => {
      if (season !== "all" && match.season !== season) return false;
      if (competition !== "all" && match.competitionCode !== competition) return false;
      if (query && !`${match.home} ${match.away} ${match.date} ${match.round}`.toLocaleLowerCase("zh-CN").includes(query)) return false;
      return true;
    });

    updateUrl();
    renderDashboard(filtered);
    viewButtons.forEach((button) => {
      const active = button.dataset.matchView === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    if (!filtered.length) {
      list.innerHTML = '<div class="data-empty"><strong>没有找到比赛</strong><p>请尝试更换赛季、赛事或搜索词。</p></div>';
      if (loadMore) loadMore.hidden = true;
      return;
    }

    const visible = filtered.slice(0, visibleCount);
    list.classList.toggle("archive-list--months", view === "months");
    if (view === "months") {
      const groups = new Map();
      visible.forEach((match) => {
        const month = match.date.slice(0, 7);
        if (!groups.has(month)) groups.set(month, []);
        groups.get(month).push(match);
      });
      list.innerHTML = [...groups.entries()].map(([month, matches]) => `<section class="match-month"><header><strong>${escapeHtml(month.replace("-", " / "))}</strong><span>${matches.length} 场</span></header><div>${matches.map(renderMatch).join("")}</div></section>`).join("");
    } else list.innerHTML = visible.map(renderMatch).join("");

    if (loadMore) loadMore.hidden = visibleCount >= filtered.length;
  };

  seasonSelect?.addEventListener("change", () => { visibleCount = 36; render(); });
  competitionSelect?.addEventListener("change", () => { visibleCount = 36; render(); });
  queryInput?.addEventListener("input", () => { visibleCount = 36; render(); });
  viewButtons.forEach((button) => button.addEventListener("click", () => { view = button.dataset.matchView; visibleCount = 36; render(); }));
  loadMore?.addEventListener("click", () => { visibleCount += 36; render(); });
  render();
};

const renderPitchPlayers = (pitch, lineup) => {
  const players = lineup?.players ?? [];
  if (!players.length) return false;
  pitch.querySelector("[data-lineup-empty]")?.remove();
  pitch.querySelectorAll(".pitch-player").forEach((player) => player.remove());
  players.forEach((lineupPlayer) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pitch-player";
    button.style.left = `${Math.max(5, Math.min(95, lineupPlayer.x ?? 50))}%`;
    button.style.top = `${Math.max(5, Math.min(95, lineupPlayer.y ?? 50))}%`;
    const player = playerById(lineupPlayer.id) ?? { ...lineupPlayer, portrait: lineupPlayer.portrait || lineupPlayer.photo };
    button.innerHTML = `${player.portrait ? imageWithFallback({ source: player.portrait, optimized: optimizedPlayerImage(player, "thumb"), alt: "" }) : `<span>${escapeHtml(player.number || lineupPlayer.number || "")}</span>`}<b>${escapeHtml(player.displayName || player.name || lineupPlayer.name)}</b>`;
    button.addEventListener("click", () => openPlayerDialog(player, lineupPlayer.stats));
    pitch.append(button);
  });
  return true;
};

const initMatchDetail = () => {
  const detailRoot = document.querySelector("[data-match-detail]");
  if (!detailRoot) return;
  const id = new URLSearchParams(window.location.search).get("id");
  const match = siteData.matches.find((item) => item.id === id);
  const scoreboard = document.querySelector("[data-match-scoreboard]");
  const source = document.querySelector("[data-match-source]");

  if (!match) {
    if (scoreboard) scoreboard.innerHTML = '<div class="not-found"><p>比赛未找到</p><h1>这条比赛记录不存在</h1><a href="fixtures.html">返回比赛档案</a></div>';
    return;
  }

  document.title = `${match.home} ${match.score ? match.score.join("-") : "vs"} ${match.away} · 巴萨赛场档案`;
  if (scoreboard) {
    scoreboard.innerHTML = `
      <div class="scoreboard-meta"><span>${escapeHtml(match.season.replace("-", "/"))}</span><strong>${escapeHtml(match.competition)} · ${escapeHtml(match.round)}</strong><time datetime="${escapeHtml(match.date)}">${escapeHtml(formatDate(match.date))}${match.time ? ` · ${escapeHtml(match.time)}` : ""}</time></div>
      <div class="scoreboard-teams">
        <div>${renderTeamMark(match.home)}<h1>${escapeHtml(match.home)}</h1></div>
        <strong>${match.score ? `<b>${match.score[0]}</b><i>—</i><b>${match.score[1]}</b>` : `<span>${escapeHtml(match.time || "VS")}</span>`}</strong>
        <div>${renderTeamMark(match.away)}<h1>${escapeHtml(match.away)}</h1></div>
      </div>
      <p class="scoreboard-status"><i class="status-dot ${match.dataLevel === "full" ? "status-dot--full" : ""}"></i>${match.dataLevel === "full" ? "本场包含完整比赛详情" : "本场目前为基础赛果档案"}</p>`;
  }

  const lineups = match.details?.lineups ?? (match.details?.lineup ? [match.details.lineup] : []);
  const lineup = lineups[0];
  const pitch = document.querySelector("[data-football-pitch]");
  const formation = document.querySelector("[data-formation-label]");
  if (pitch && renderPitchPlayers(pitch, lineup) && formation) formation.textContent = lineup.formation || "阵型";
  else if (formation) formation.textContent = "等待免费阵容数据";
  const lineupSwitch = document.querySelector("[data-lineup-switch]");
  if (pitch && formation && lineupSwitch && lineups.length > 1) {
    lineupSwitch.hidden = false;
    lineupSwitch.innerHTML = lineups
      .map((item, index) => `<button type="button" class="${index === 0 ? "is-active" : ""}" data-lineup-index="${index}">${escapeHtml(item.team || `球队 ${index + 1}`)}</button>`)
      .join("");
    lineupSwitch.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const selected = lineups[Number(button.dataset.lineupIndex)];
        renderPitchPlayers(pitch, selected);
        formation.textContent = selected.formation || "阵型";
        lineupSwitch.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
      });
    });
  }

  const events = match.details?.events ?? [];
  const timeline = document.querySelector("[data-event-timeline]");
  if (timeline && events.length) {
    timeline.innerHTML = events
      .map((event) => `<article class="timeline-event timeline-event--${escapeHtml(event.type)}"><time>${escapeHtml(event.minute)}′</time><div><strong>${escapeHtml(event.player)}</strong><span>${escapeHtml(event.label)}${event.assist ? ` · 助攻 ${escapeHtml(event.assist)}` : ""}</span></div></article>`)
      .join("");
  }

  if (source) {
    source.innerHTML = `
      <div><p>DATA STATUS</p><h2>数据说明</h2></div>
      <div><strong>${escapeHtml(match.detailStatus)}</strong><p>本站不会根据比分推测阵容、助攻或球员数据。后续免费接口返回详情时，此页会自动升级，无需更换链接。</p><a href="${escapeHtml(match.source)}" target="_blank" rel="noreferrer">查看本场开放数据来源 ↗</a></div>`;
  }
};

const newsCategoryNames = {
  "First Team": "一线队",
  Women: "女足",
  Club: "俱乐部",
  Basketball: "篮球",
  Feature: "专题",
  Academy: "青训",
};

const formatNewsDate = (value) => {
  if (!value) return "日期待确认";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(`${value}T12:00:00`));
};

const renderNewsStory = (item, lead = false) => {
  const title = item.titleZh || item.title;
  const description = item.descriptionZh || item.description || "";
  const originalTitle = item.titleZh && item.titleZh !== item.title ? `<span lang="en">${escapeHtml(item.title)}</span>` : "";
  const localUrl = `news-article.html?id=${encodeURIComponent(item.id)}`;
  return `
    <article class="news-story ${lead ? "news-story--lead" : ""}">
      <a href="${localUrl}" aria-label="在站内阅读 ${escapeHtml(title)}">
        <figure>${item.localImage ? imageWithFallback({ source: item.localImage, optimized: optimizedNewsImage(item.localImage), alt: "" }) : '<div class="news-image-missing">官方图片暂缺</div>'}</figure>
        <div class="news-story__body">
          <div class="news-story__meta"><time datetime="${escapeHtml(item.publishedDate)}">${escapeHtml(formatNewsDate(item.publishedDate))}</time><span>${escapeHtml(newsCategoryNames[item.category] || item.category || "官方资讯")}</span></div>
          <h2>${escapeHtml(title)}</h2>
          ${originalTitle}
          ${description ? `<p>${escapeHtml(description)}</p>` : ""}
          <footer><small>FC BARCELONA OFFICIAL</small><b>进入站内详情 →</b></footer>
        </div>
      </a>
    </article>`;
};

const initNewsPage = () => {
  const list = document.querySelector("[data-news-list]");
  if (!list) return;
  const filters = document.querySelector("[data-news-filters]");
  const count = document.querySelector("[data-news-count]");
  const updated = document.querySelector("[data-news-updated]");
  let items = Array.isArray(siteData.news) ? siteData.news : [];
  let activeCategory = "all";

  const renderUpdatedAt = () => {
    if (count) count.textContent = String(items.length).padStart(2, "0");
    if (!updated) return;
    const date = siteData.newsUpdatedAt || siteData.generatedAt;
    updated.textContent = date ? `同步于 ${new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(date))}` : "同步时间待确认";
    if (date) updated.dateTime = date;
  };

  const renderFilters = () => {
    const categories = [...new Set(items.map((item) => item.category).filter(Boolean))];
    if (activeCategory !== "all" && !categories.includes(activeCategory)) activeCategory = "all";
    if (!filters) return;
    filters.innerHTML = [{ value: "all", label: "全部" }, ...categories.map((category) => ({ value: category, label: newsCategoryNames[category] || category }))]
      .map((filter) => `<button type="button" class="${filter.value === activeCategory ? "is-active" : ""}" data-news-category="${escapeHtml(filter.value)}">${escapeHtml(filter.label)}</button>`)
      .join("");
  };

  const render = () => {
    renderUpdatedAt();
    renderFilters();
    if (!items.length) {
      list.innerHTML = '<div class="data-empty"><strong>尚未同步时事资讯</strong><p>请运行 node scripts/sync-news.mjs 获取 FC Barcelona 官方最新资讯。</p></div>';
      return;
    }
    const visible = activeCategory === "all" ? items : items.filter((item) => item.category === activeCategory);
    list.innerHTML = visible.length
      ? `${renderNewsStory(visible[0], true)}<div class="news-grid">${visible.slice(1).map((item) => renderNewsStory(item)).join("")}</div>`
      : '<div class="data-empty"><strong>这个栏目暂时没有资讯</strong><p>切换到其他分类即可继续浏览。</p></div>';
  };

  filters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-news-category]");
    if (!button) return;
    activeCategory = button.dataset.newsCategory;
    render();
  });

  window.addEventListener("barca-news-updated", () => {
    items = Array.isArray(siteData.news) ? siteData.news : [];
    render();
  });
  render();
};

const initHomeNews = () => {
  const list = document.querySelector("[data-home-news-list]");
  if (!list) return;
  const updated = document.querySelector("[data-home-news-updated]");

  const render = () => {
    const items = Array.isArray(siteData.news) ? siteData.news.slice(0, 5) : [];
    if (updated) {
      const date = siteData.newsUpdatedAt || siteData.generatedAt;
      updated.textContent = date ? `最近同步 · ${new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(date))}` : "同步时间待确认";
      if (date) updated.dateTime = date;
    }
    list.innerHTML = items.length
      ? `${renderNewsStory(items[0], true)}<div class="news-grid">${items.slice(1).map((item) => renderNewsStory(item)).join("")}</div>`
      : '<div class="data-empty data-empty--dark"><strong>尚未同步最新资讯</strong><p>部署版本会自动检查 FC Barcelona 官方源。</p></div>';
  };

  window.addEventListener("barca-news-updated", render);
  render();
};

const initNewsArticle = () => {
  const root = document.querySelector("[data-news-article]");
  if (!root) return;
  const id = new URLSearchParams(window.location.search).get("id");

  const render = () => {
    const item = siteData.news?.find((entry) => String(entry.id) === String(id));
    if (!item) {
      root.innerHTML = '<section class="news-article-loading"><div class="page-shell"><p>NOT FOUND</p><h1>这条资讯不存在</h1><a href="news.html">返回时事资讯 →</a></div></section>';
      return;
    }
    const title = item.titleZh || item.title;
    const description = item.descriptionZh || item.description || "官方资讯摘要暂缺。";
    document.title = `${title} · 巴萨赛场档案`;
    root.innerHTML = `
      <article class="news-article">
        <header class="news-article__hero">
          <div class="page-shell news-article__heading">
            <div class="news-article__meta"><span>${escapeHtml(newsCategoryNames[item.category] || item.category || "官方资讯")}</span><time datetime="${escapeHtml(item.publishedDate)}">${escapeHtml(formatNewsDate(item.publishedDate))}</time></div>
            <h1>${escapeHtml(title)}</h1>
            ${item.titleZh ? `<p lang="en">${escapeHtml(item.title)}</p>` : ""}
          </div>
          ${item.localImage ? `<figure>${imageWithFallback({ source: item.localImage, optimized: optimizedNewsImage(item.localImage), alt: title, loading: "eager" })}</figure>` : ""}
        </header>
        <div class="news-article__layout page-shell">
          <aside><span>FCB / ${escapeHtml(item.id)}</span><strong>站内资讯摘要</strong><p>根据俱乐部官方发布内容整理</p></aside>
          <div class="news-article__content">
            <p class="news-article__lead">${escapeHtml(description)}</p>
            ${item.descriptionZh && item.description ? `<div class="news-original-summary"><span>OFFICIAL SUMMARY</span><p lang="en">${escapeHtml(item.description)}</p></div>` : ""}
            <div class="news-article__notice"><strong>信息来源与阅读说明</strong><p>本站在站内提供中文摘要、发布时间、分类和官方图片，方便连续浏览；不复制整篇受版权保护的官方报道。需要查看完整报道、视频或相册时，可通过下方出处进入俱乐部官方页面。</p></div>
            <a class="news-official-link" href="${escapeHtml(item.source)}" target="_blank" rel="noreferrer">查看 FC Barcelona 官方完整报道 <span>↗</span></a>
          </div>
        </div>
        <section class="news-related page-shell">
          <header><p>CONTINUE READING</p><h2>继续阅读</h2><a href="news.html">全部资讯 →</a></header>
          <div class="news-grid">${siteData.news.filter((entry) => entry.id !== item.id).slice(0, 3).map((entry) => renderNewsStory(entry)).join("")}</div>
        </section>
      </article>`;
  };

  window.addEventListener("barca-news-updated", render);
  render();
};

const initLiveNewsRefresh = () => {
  if (!/^https?:$/.test(window.location.protocol)) return;
  let loading = false;
  const refresh = () => {
    if (loading || document.hidden) return;
    loading = true;
    const previousUpdatedAt = siteData.newsUpdatedAt;
    const loader = document.createElement("script");
    loader.src = `data/news-data.js?t=${Date.now()}`;
    loader.onload = () => {
      loading = false;
      loader.remove();
      if (!window.BARCA_NEWS?.items || window.BARCA_NEWS.updatedAt === previousUpdatedAt) return;
      siteData.news = window.BARCA_NEWS.items;
      siteData.newsUpdatedAt = window.BARCA_NEWS.updatedAt;
      window.dispatchEvent(new CustomEvent("barca-news-updated"));
    };
    loader.onerror = () => {
      loading = false;
      loader.remove();
    };
    document.head.append(loader);
  };
  window.setInterval(refresh, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
};

initMenu();
initCarousels();
initPlayerDialog();
initPlayerDirectory();
initMatchBrowser();
initMatchDetail();
initNewsPage();
initHomeNews();
initNewsArticle();
initLiveNewsRefresh();
