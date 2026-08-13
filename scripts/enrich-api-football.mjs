import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(projectRoot, "data");
const apiBase = "https://v3.football.api-sports.io";
const barcaTeamId = 529;

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

const envFile = await readEnvFile();
const apiKey = process.env.API_FOOTBALL_KEY || envFile.API_FOOTBALL_KEY;
const seasons = (process.env.API_FOOTBALL_SEASONS || envFile.API_FOOTBALL_SEASONS || "2025")
  .split(",")
  .map((season) => season.trim())
  .filter(Boolean);
const maxDetails = Number(process.env.API_FOOTBALL_MAX_DETAILS || envFile.API_FOOTBALL_MAX_DETAILS || 90);

if (!apiKey) {
  console.error("缺少 API_FOOTBALL_KEY。请复制 .env.example 为 .env，并填入免费 API-Football 密钥。");
  process.exit(1);
}

const apiRequest = async (endpoint) => {
  const response = await fetch(`${apiBase}${endpoint}`, {
    headers: { "x-apisports-key": apiKey },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${endpoint}`);
  const payload = await response.json();
  if (payload.errors && Object.keys(payload.errors).length) {
    throw new Error(`API 返回错误：${JSON.stringify(payload.errors)}`);
  }
  return payload.response ?? [];
};

const normalizeName = (name = "") =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|club|deportivo|football|athletic)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

const opponentName = (fixture) =>
  fixture.teams.home.id === barcaTeamId ? fixture.teams.away.name : fixture.teams.home.name;

const localOpponentName = (match) => (match.home === "FC Barcelona" ? match.away : match.home);

const findLocalMatch = (matches, fixture) => {
  const date = fixture.fixture.date.slice(0, 10);
  const candidates = matches.filter((match) => match.date === date);
  const opponent = normalizeName(opponentName(fixture));
  return (
    candidates.find((match) => {
      const localOpponent = normalizeName(localOpponentName(match));
      return localOpponent.includes(opponent) || opponent.includes(localOpponent);
    }) ?? candidates[0]
  );
};

const positionPlayers = (startXI = []) => {
  const byRow = new Map();
  startXI.forEach(({ player }) => {
    const [rowText = "1", columnText = "1"] = String(player.grid || "1:1").split(":");
    const row = Number(rowText);
    const column = Number(columnText);
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
    }));
  });
};

const flattenStats = (statistics = {}) => ({
  评分: statistics.games?.rating ?? null,
  出场时间: statistics.games?.minutes ? `${statistics.games.minutes} 分钟` : null,
  射门: statistics.shots?.total ?? null,
  射正: statistics.shots?.on ?? null,
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

const transformEvents = (events = []) =>
  events.map((event) => {
    const labels = {
      Goal: event.detail === "Own Goal" ? "乌龙球" : "进球",
      Card: event.detail?.includes("Red") ? "红牌" : "黄牌",
      subst: "换人",
      Var: "VAR",
    };
    return {
      minute: event.time?.elapsed ?? "—",
      extra: event.time?.extra ?? null,
      type: event.type?.toLowerCase() || "event",
      label: labels[event.type] || labels[event.detail] || event.detail || event.type,
      player: event.player?.name || "未知球员",
      assist: event.assist?.name || "",
      team: event.team?.name || "",
    };
  });

const archive = JSON.parse(await readFile(path.join(dataDir, "matches.json"), "utf8"));
const playersArchive = JSON.parse(await readFile(path.join(dataDir, "players.json"), "utf8"));
const mediaArchive = JSON.parse(await readFile(path.join(dataDir, "media.json"), "utf8"));

const fixtures = [];
for (const season of seasons) {
  const seasonFixtures = await apiRequest(`/fixtures?team=${barcaTeamId}&season=${season}`);
  fixtures.push(...seasonFixtures);
}

let enrichedCount = 0;
for (const fixture of fixtures.slice(0, Math.max(0, maxDetails))) {
  const localMatch = findLocalMatch(archive.matches, fixture);
  if (!localMatch) continue;

  const [detail] = await apiRequest(`/fixtures?id=${fixture.fixture.id}`);
  if (!detail) continue;

  const statsByTeam = new Map(
    (detail.players ?? []).map((team) => [
      team.team?.id,
      new Map((team.players ?? []).map((entry) => [entry.player.id, flattenStats(entry.statistics?.[0])])),
    ]),
  );
  const lineups = (detail.lineups ?? []).map((teamLineup) => {
    const statsByPlayer = statsByTeam.get(teamLineup.team?.id) ?? new Map();
    return {
      team: teamLineup.team?.name || "球队",
      teamId: teamLineup.team?.id,
      formation: teamLineup.formation || "",
      players: positionPlayers(teamLineup.startXI).map((player) => ({
        ...player,
        stats: statsByPlayer.get(player.id) ?? null,
      })),
      substitutes: (teamLineup.substitutes ?? []).map(({ player }) => ({
        id: player.id,
        name: player.name,
        number: player.number,
        position: player.pos,
      })),
    };
  });
  const barcaLineup = lineups.find((lineup) => lineup.teamId === barcaTeamId);
  const lineupPlayers = barcaLineup?.players ?? [];

  localMatch.dataLevel = lineupPlayers.length || detail.events?.length ? "full" : "result-only";
  localMatch.detailStatus = localMatch.dataLevel === "full" ? "本场详情由 API-Football 免费额度补充。" : localMatch.detailStatus;
  localMatch.fixtureId = fixture.fixture.id;
  localMatch.details = {
    lineups,
    lineup: barcaLineup ?? lineups[0] ?? null,
    events: transformEvents(detail.events),
  };
  enrichedCount += 1;
}

archive.updatedAt = new Date().toISOString();
archive.apiFootball = {
  enrichedAt: archive.updatedAt,
  seasons,
  enrichedMatches: enrichedCount,
  note: "API 密钥未写入输出文件。",
};
await writeFile(path.join(dataDir, "matches.json"), `${JSON.stringify(archive, null, 2)}\n`, "utf8");

const browserData = {
  generatedAt: archive.updatedAt,
  coverage: archive.coverage,
  matches: archive.matches,
  players: playersArchive.players,
  media: mediaArchive.stadiumImages,
};
await writeFile(path.join(dataDir, "site-data.js"), `window.BARCA_DATA = ${JSON.stringify(browserData, null, 2)};\n`, "utf8");

console.log(`详情增强完成：${enrichedCount} 场。API 密钥只从 .env 读取，未写入网站文件。`);
await import("./build-browser-chunks.mjs");
