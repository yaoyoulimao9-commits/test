import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(projectRoot, "data");
const badgeDir = path.join(projectRoot, "assets", "team-badges");
const apiBase = "https://v3.football.api-sports.io";
const barcaTeamId = 529;
const finalStatuses = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
const detailRetryHours = [12, 24, 72, 168, 720];

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(path.join(dataDir, file), "utf8"));
  } catch {
    return fallback;
  }
};

const readEnvFile = async () => {
  try {
    const text = await readFile(path.join(projectRoot, ".env"), "utf8");
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
        }),
    );
  } catch {
    return {};
  }
};

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

const currentSeasonStart = (date = new Date()) => date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;

const normalizeName = (name = "") =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|club|deportivo|football|athletic|balompie)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

const slugify = (value = "team") =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "team";

const canonicalTeamName = (team) => Number(team?.id) === barcaTeamId ? "FC Barcelona" : String(team?.name || "未知球队").trim();

const madridDateParts = (isoDate) => {
  const date = new Date(isoDate);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, time: `${value("hour")}:${value("minute")}` };
};

const seasonLabel = (season) => `${season}-${String(Number(season) + 1).slice(-2)}`;

const competitionInfo = (fixture) => {
  const name = String(fixture?.league?.name || "其他赛事");
  const country = String(fixture?.league?.country || "");
  if (/la\s*liga|primera divisi[oó]n/i.test(name)) return { name: "西甲", code: "laliga" };
  if (/champions league/i.test(name)) return { name: "欧冠", code: "ucl" };
  if (/europa league/i.test(name)) return { name: "欧联杯", code: "uel" };
  if (/copa del rey/i.test(name)) return { name: "国王杯", code: "copa" };
  if (/super cup/i.test(name) && /spain/i.test(country)) return { name: "西班牙超级杯", code: "supercopa" };
  if (/club world cup/i.test(name)) return { name: "世俱杯", code: "club-world-cup" };
  return { name, code: `api-league-${fixture?.league?.id || "other"}` };
};

const isOfficialFixture = (fixture) => {
  const name = String(fixture?.league?.name || "");
  return !/friendl|friendly|amistoso/i.test(name) && Number(fixture?.teams?.home?.id) !== 0 && Number(fixture?.teams?.away?.id) !== 0;
};

const opponentName = (fixture) => Number(fixture?.teams?.home?.id) === barcaTeamId
  ? canonicalTeamName(fixture?.teams?.away)
  : canonicalTeamName(fixture?.teams?.home);

const localOpponentName = (match) => match.home === "FC Barcelona" ? match.away : match.home;

const findLocalMatch = (matches, fixture) => {
  const fixtureId = String(fixture?.fixture?.id || "");
  const byProviderId = matches.find((match) => String(match.fixtureId || "") === fixtureId);
  if (byProviderId) return byProviderId;
  const { date } = madridDateParts(fixture.fixture.date);
  const opponent = normalizeName(opponentName(fixture));
  return matches.find((match) => match.date === date && (() => {
    const localOpponent = normalizeName(localOpponentName(match));
    return localOpponent === opponent || localOpponent.includes(opponent) || opponent.includes(localOpponent);
  })());
};

const scoreFromFixture = (fixture) => {
  const home = fixture?.goals?.home;
  const away = fixture?.goals?.away;
  return Number.isFinite(home) && Number.isFinite(away) ? [home, away] : null;
};

const makeApiMatch = (fixture) => {
  const timing = madridDateParts(fixture.fixture.date);
  const competition = competitionInfo(fixture);
  return {
    id: `api-football-${fixture.fixture.id}`,
    season: seasonLabel(fixture.league.season),
    competition: competition.name,
    competitionCode: competition.code,
    round: String(fixture.league.round || fixture.fixture.status?.long || competition.name),
    date: timing.date,
    time: timing.time,
    home: canonicalTeamName(fixture.teams.home),
    away: canonicalTeamName(fixture.teams.away),
    score: scoreFromFixture(fixture),
    dataLevel: "result-only",
    detailStatus: "赛程与比分来自 API-Football 免费计划；阵容与事件将在赛后按免费额度增量补充。",
    fixtureId: fixture.fixture.id,
    source: "https://www.api-football.com/",
    sourceRefs: [{ provider: "API-Football", fixtureId: fixture.fixture.id }],
  };
};

const updateMatchFromFixture = (match, fixture) => {
  const timing = madridDateParts(fixture.fixture.date);
  const competition = competitionInfo(fixture);
  const next = {
    season: seasonLabel(fixture.league.season),
    competition: competition.name,
    competitionCode: competition.code,
    round: String(fixture.league.round || match.round || competition.name),
    date: timing.date,
    time: timing.time,
    home: canonicalTeamName(fixture.teams.home),
    away: canonicalTeamName(fixture.teams.away),
    score: scoreFromFixture(fixture) ?? match.score ?? null,
    fixtureId: fixture.fixture.id,
  };
  let changed = false;
  Object.entries(next).forEach(([key, value]) => {
    if (JSON.stringify(match[key]) !== JSON.stringify(value)) {
      match[key] = value;
      changed = true;
    }
  });
  if (!(match.sourceRefs ?? []).some((item) => item.provider === "API-Football" && String(item.fixtureId) === String(fixture.fixture.id))) {
    match.sourceRefs = [...(match.sourceRefs ?? []), { provider: "API-Football", fixtureId: fixture.fixture.id }];
    changed = true;
  }
  return changed;
};

const positionPlayers = (startXI = [], statsByPlayer = new Map()) => {
  const byRow = new Map();
  startXI.forEach(({ player }) => {
    const [rowText = "1", columnText = "1"] = String(player.grid || "1:1").split(":");
    const row = Number(rowText) || 1;
    const column = Number(columnText) || 1;
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push({ player, column });
  });
  return [...byRow.entries()].flatMap(([row, rowPlayers]) => {
    const maxColumn = Math.max(...rowPlayers.map((item) => item.column), rowPlayers.length);
    return rowPlayers.map(({ player, column }) => ({
      id: player.id,
      name: player.name,
      number: player.number,
      position: player.pos,
      photo: `https://media.api-sports.io/football/players/${player.id}.png`,
      x: (column / (maxColumn + 1)) * 100,
      y: Math.max(8, 92 - (row - 1) * 27),
      stats: statsByPlayer.get(player.id) ?? null,
    }));
  });
};

const flattenStats = (statistics = {}) => ({
  评分: statistics.games?.rating ?? null,
  出场时间: statistics.games?.minutes ? `${statistics.games.minutes} 分钟` : null,
  射门: statistics.shots?.total ?? null,
  射正: statistics.shots?.on ?? null,
  进球: statistics.goals?.total ?? null,
  助攻: statistics.goals?.assists ?? null,
  传球: statistics.passes?.total ?? null,
  关键传球: statistics.passes?.key ?? null,
  传球准确率: statistics.passes?.accuracy ? `${statistics.passes.accuracy}%` : null,
  抢断: statistics.tackles?.total ?? null,
  拦截: statistics.tackles?.interceptions ?? null,
  对抗成功: statistics.duels?.won ?? null,
  犯规: statistics.fouls?.committed ?? null,
  黄牌: statistics.cards?.yellow ?? null,
  红牌: statistics.cards?.red ?? null,
});

const transformEvents = (events = []) => events.map((event) => {
  const type = String(event.type || "event").toLowerCase();
  const detail = String(event.detail || "");
  const labels = {
    goal: /own goal/i.test(detail) ? "乌龙球" : /penalty/i.test(detail) ? "点球" : "进球",
    card: /red/i.test(detail) ? "红牌" : "黄牌",
    subst: "换人",
    var: "VAR",
  };
  return {
    minute: event.time?.elapsed ?? "—",
    extra: event.time?.extra ?? null,
    type,
    label: labels[type] || detail || event.type || "比赛事件",
    player: event.player?.name || "未知球员",
    assist: type === "goal" ? event.assist?.name || "" : "",
    relatedPlayer: type === "subst" ? event.assist?.name || "" : "",
    team: event.team?.name || "",
  };
});

const detailsFromFixture = (detail) => {
  const statsByTeam = new Map(
    (detail.players ?? []).map((team) => [
      team.team?.id,
      new Map((team.players ?? []).map((entry) => [entry.player.id, flattenStats(entry.statistics?.[0])])),
    ]),
  );
  const lineups = (detail.lineups ?? []).map((teamLineup) => {
    const statsByPlayer = statsByTeam.get(teamLineup.team?.id) ?? new Map();
    return {
      team: canonicalTeamName(teamLineup.team),
      teamId: teamLineup.team?.id,
      formation: teamLineup.formation || "",
      players: positionPlayers(teamLineup.startXI, statsByPlayer),
      substitutes: (teamLineup.substitutes ?? []).map(({ player }) => ({
        id: player.id,
        name: player.name,
        number: player.number,
        position: player.pos,
        photo: `https://media.api-sports.io/football/players/${player.id}.png`,
        stats: statsByPlayer.get(player.id) ?? null,
      })),
    };
  });
  const barcaLineup = lineups.find((lineup) => Number(lineup.teamId) === barcaTeamId);
  return {
    lineups,
    lineup: barcaLineup ?? lineups[0] ?? null,
    events: transformEvents(detail.events),
    provider: "API-Football",
    providerFixtureId: detail.fixture?.id,
    updatedAt: new Date().toISOString(),
  };
};

const detailQuality = (details) => {
  const lineupPlayers = (details?.lineups ?? []).reduce((total, lineup) => total + (lineup.players?.length ?? 0), 0);
  const events = details?.events?.length ?? 0;
  return { lineupPlayers, events, complete: lineupPlayers >= 20, useful: lineupPlayers > 0 || events > 0 };
};

const nextRetryAt = (attempts, now = Date.now()) => {
  const hours = detailRetryHours[Math.min(Math.max(0, attempts - 1), detailRetryHours.length - 1)];
  return new Date(now + hours * 60 * 60 * 1000).toISOString();
};

const runSelfTest = () => {
  const sample = {
    fixture: { id: 123, date: "2026-08-20T19:00:00+00:00", status: { short: "FT", long: "Match Finished" } },
    league: { id: 140, name: "La Liga", country: "Spain", season: 2026, round: "Regular Season - 1" },
    teams: { home: { id: barcaTeamId, name: "Barcelona" }, away: { id: 999, name: "Example CF" } },
    goals: { home: 2, away: 1 },
  };
  assert.equal(currentSeasonStart(new Date("2026-08-14T00:00:00Z")), 2026);
  assert.equal(normalizeName("Real Betis Balompié"), "realbetis");
  assert.deepEqual(competitionInfo(sample), { name: "西甲", code: "laliga" });
  assert.equal(makeApiMatch(sample).home, "FC Barcelona");
  assert.deepEqual(makeApiMatch(sample).score, [2, 1]);
  assert.equal(findLocalMatch([makeApiMatch(sample)], sample)?.fixtureId, 123);
  assert.equal(transformEvents([{ type: "subst", player: { name: "A" }, assist: { name: "B" } }])[0].relatedPlayer, "B");
  console.log("API-Football 增量同步器自检通过。");
};

if (process.argv.includes("--self-test")) {
  runSelfTest();
  process.exit(0);
}

const envFile = await readEnvFile();
const apiKey = process.env.API_FOOTBALL_KEY || envFile.API_FOOTBALL_KEY;
const configuredSeasons = process.env.API_FOOTBALL_SEASONS || envFile.API_FOOTBALL_SEASONS || String(currentSeasonStart());
const seasons = [...new Set(configuredSeasons.split(",").map((season) => season.trim()).filter((season) => /^\d{4}$/.test(season)))];
const maxRequests = clampInteger(process.env.API_FOOTBALL_MAX_REQUESTS || envFile.API_FOOTBALL_MAX_REQUESTS, 20, 2, 90);
const maxDetails = clampInteger(process.env.API_FOOTBALL_MAX_DETAILS || envFile.API_FOOTBALL_MAX_DETAILS, 15, 0, Math.max(0, maxRequests - seasons.length));
const reserveRequests = clampInteger(process.env.API_FOOTBALL_RESERVE_REQUESTS || envFile.API_FOOTBALL_RESERVE_REQUESTS, 10, 0, 50);
const minimumIntervalMs = clampInteger(process.env.API_FOOTBALL_INTERVAL_MS || envFile.API_FOOTBALL_INTERVAL_MS, 6500, 6100, 30000);

if (!apiKey) {
  console.error("缺少 API_FOOTBALL_KEY。免费注册后将密钥写入本地 .env 或 GitHub Actions Secret；密钥不会进入仓库。");
  process.exit(2);
}

let requestsUsed = 0;
let remainingDaily = Number.POSITIVE_INFINITY;
let lastRequestAt = 0;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class RequestBudgetReached extends Error {}

const apiRequest = async (endpoint) => {
  if (requestsUsed >= maxRequests || remainingDaily <= reserveRequests) throw new RequestBudgetReached("已到本轮免费额度保护线");
  const elapsed = Date.now() - lastRequestAt;
  if (lastRequestAt && elapsed < minimumIntervalMs) await wait(minimumIntervalMs - elapsed);
  const response = await fetch(`${apiBase}${endpoint}`, { headers: { "x-apisports-key": apiKey } });
  lastRequestAt = Date.now();
  requestsUsed += 1;
  const remaining = Number(response.headers.get("x-ratelimit-requests-remaining"));
  if (Number.isFinite(remaining)) remainingDaily = remaining;
  if (response.status === 429) {
    remainingDaily = 0;
    throw new RequestBudgetReached("API 返回 429，已停止本轮请求");
  }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${endpoint}`);
  const payload = await response.json();
  if (payload.errors && Object.keys(payload.errors).length) throw new Error(`API 返回错误：${JSON.stringify(payload.errors)}`);
  return payload.response ?? [];
};

const archive = await readJson("matches.json", { matches: [], sources: [] });
const badgesDocument = await readJson("team-badges.json", { teams: {} });
const syncState = await readJson("api-football-sync-state.json", { version: 1, fixtures: {} });
const fixtures = [];

for (const season of seasons) {
  try {
    const seasonFixtures = await apiRequest(`/fixtures?team=${barcaTeamId}&season=${season}`);
    fixtures.push(...seasonFixtures.filter(isOfficialFixture));
    console.log(`赛季 ${season}：读取 ${seasonFixtures.length} 场，保留 ${seasonFixtures.filter(isOfficialFixture).length} 场正式比赛。`);
  } catch (error) {
    if (error instanceof RequestBudgetReached) break;
    console.warn(`赛季 ${season} 暂不可用：${error.message}`);
  }
}

let archiveChanged = false;
let badgesChanged = false;
let stateChanged = false;
let addedMatches = 0;
let enrichedMatches = 0;

const badgeFileExists = async (relativePath) => {
  try {
    await access(path.join(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
};

const ensureBadge = async (team) => {
  const name = canonicalTeamName(team);
  if (name === "FC Barcelona" || !team?.logo) return;
  const existing = badgesDocument.teams?.[name];
  if (existing?.badge && await badgeFileExists(existing.badge)) return;
  const extension = new URL(team.logo).pathname.match(/\.(png|webp|jpe?g)$/i)?.[1]?.toLowerCase() || "png";
  const relativePath = `assets/team-badges/api-${team.id}-${slugify(name)}.${extension}`;
  try {
    const response = await fetch(team.logo);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    await mkdir(badgeDir, { recursive: true });
    await writeFile(path.join(projectRoot, relativePath), Buffer.from(await response.arrayBuffer()));
    badgesDocument.teams ??= {};
    badgesDocument.teams[name] = { name, badge: relativePath, provider: "API-Football", source: "https://www.api-football.com/", apiTeamId: team.id };
    badgesChanged = true;
  } catch (error) {
    console.warn(`${name} 队徽缓存失败：${error.message}`);
  }
};

for (const fixture of fixtures) {
  let match = findLocalMatch(archive.matches, fixture);
  if (!match) {
    match = makeApiMatch(fixture);
    archive.matches.push(match);
    archiveChanged = true;
    addedMatches += 1;
  } else if (updateMatchFromFixture(match, fixture)) {
    archiveChanged = true;
  }
  await ensureBadge(fixture.teams.home);
  await ensureBadge(fixture.teams.away);
}

const now = Date.now();
const detailCandidates = fixtures
  .filter((fixture) => finalStatuses.has(fixture.fixture.status?.short))
  .map((fixture) => ({ fixture, match: findLocalMatch(archive.matches, fixture) }))
  .filter(({ match }) => {
    if (!match) return false;
    if (detailQuality(match.details).complete) return false;
    const record = syncState.fixtures?.[fixtureKey(match.fixtureId)];
    return !record?.nextRetryAt || Date.parse(record.nextRetryAt) <= now;
  })
  .sort((a, b) => b.fixture.fixture.date.localeCompare(a.fixture.fixture.date))
  .slice(0, maxDetails);

function fixtureKey(value) {
  return String(value || "unknown");
}

for (const { fixture, match } of detailCandidates) {
  try {
    const [detail] = await apiRequest(`/fixtures?id=${fixture.fixture.id}`);
    if (!detail) throw new Error("接口没有返回比赛详情");
    const details = detailsFromFixture(detail);
    const quality = detailQuality(details);
    const key = fixtureKey(fixture.fixture.id);
    const attempts = (syncState.fixtures?.[key]?.attempts ?? 0) + 1;
    syncState.fixtures ??= {};
    syncState.fixtures[key] = {
      attempts,
      lastAttemptAt: new Date().toISOString(),
      status: quality.complete ? "complete" : quality.useful ? "partial" : "unavailable",
      nextRetryAt: quality.complete ? null : nextRetryAt(attempts),
    };
    stateChanged = true;
    if (quality.useful) {
      match.details = details;
      match.dataLevel = quality.complete ? "full" : "partial";
      match.detailStatus = quality.complete
        ? "阵容、比赛事件与可用球员数据由 API-Football 免费额度补充。"
        : "API-Football 已返回部分比赛事件；阵容或球员数据仍等待后续免费同步。";
      archiveChanged = true;
      enrichedMatches += 1;
    }
  } catch (error) {
    if (error instanceof RequestBudgetReached) {
      console.log("已到本轮请求上限或每日保留额度，剩余比赛将在下轮继续。");
      break;
    }
    const key = fixtureKey(fixture.fixture.id);
    const attempts = (syncState.fixtures?.[key]?.attempts ?? 0) + 1;
    syncState.fixtures ??= {};
    syncState.fixtures[key] = { attempts, lastAttemptAt: new Date().toISOString(), status: "error", nextRetryAt: nextRetryAt(attempts), error: error.message.slice(0, 180) };
    stateChanged = true;
    console.warn(`${match.date} ${match.home} vs ${match.away}：${error.message}`);
  }
}

archive.matches.sort((a, b) => b.date.localeCompare(a.date) || String(b.time || "").localeCompare(String(a.time || "")));

if (archiveChanged) {
  archive.updatedAt = new Date().toISOString();
  archive.coverage = "2021/22 至今：公开免费赛果 + API-Football 免费额度增量详情。";
  archive.detailPolicy = "只展示开放或已授权数据源提供的事实；缺失阵容、事件和球员数据时明确标注暂无数据。";
  if (!(archive.sources ?? []).some((source) => source.name === "API-Football")) {
    archive.sources = [...(archive.sources ?? []), { name: "API-Football", url: "https://www.api-football.com/", license: "Free plan / provider terms" }];
  }
  archive.apiFootball = { lastSuccessfulSync: archive.updatedAt, seasons, note: "免费额度增量同步；API 密钥未写入输出文件。" };
  await writeFile(path.join(dataDir, "matches.json"), `${JSON.stringify(archive, null, 2)}\n`, "utf8");
}

if (badgesChanged) {
  badgesDocument.updatedAt = new Date().toISOString();
  badgesDocument.note = "比赛双方队徽来自 TheSportsDB 与 API-Football 免费公开接口并已下载到项目本地；FC Barcelona 使用项目中的官方品牌图。";
  await writeFile(path.join(dataDir, "team-badges.json"), `${JSON.stringify(badgesDocument, null, 2)}\n`, "utf8");
}

if (stateChanged) {
  syncState.version = 1;
  syncState.updatedAt = new Date().toISOString();
  syncState.note = "仅记录公开比赛 ID 的重试时间，不含 API 密钥或个人信息。";
  await writeFile(path.join(dataDir, "api-football-sync-state.json"), `${JSON.stringify(syncState, null, 2)}\n`, "utf8");
}

if (archiveChanged || badgesChanged) {
  await import(`./build-browser-chunks.mjs?run=${Date.now()}`);
  await import(`./build-sitemap.mjs?run=${Date.now()}`);
}

console.log(`同步完成：使用 ${requestsUsed}/${maxRequests} 次本轮额度，新增 ${addedMatches} 场，补充 ${enrichedMatches} 场，API 剩余 ${Number.isFinite(remainingDaily) ? remainingDaily : "未知"} 次。`);
