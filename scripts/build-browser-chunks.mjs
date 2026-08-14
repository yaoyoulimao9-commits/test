import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(projectRoot, "data");
const readJson = async (name, fallback) => {
  try {
    return JSON.parse(await readFile(path.join(dataDir, name), "utf8"));
  } catch {
    return fallback;
  }
};

const matchesDoc = await readJson("matches.json", { matches: [], coverage: "" });
const playersDoc = await readJson("players.json", { players: [] });
const badgesDoc = await readJson("team-badges.json", { teams: {} });
const mediaDoc = await readJson("media.json", { stadiumImages: [] });
const newsDoc = await readJson("news.json", { items: [], updatedAt: "" });
const archiveDoc = await readJson("archive.json", {});
const generatedAt = new Date().toISOString();
const detailedPlayerMatches = matchesDoc.matches.filter((match) => {
  const lineups = match.details?.lineups ?? (match.details?.lineup ? [match.details.lineup] : []);
  return lineups.some((lineup) => Array.isArray(lineup.players) && lineup.players.length);
});

const playersData = {
  generatedAt,
  coverage: matchesDoc.coverage,
  matchArchiveCount: matchesDoc.matches.length,
  matches: detailedPlayerMatches,
  players: playersDoc.players,
  teamBadges: {},
  media: [],
  news: [],
};

const matchesData = {
  generatedAt,
  coverage: matchesDoc.coverage,
  matches: matchesDoc.matches,
  players: playersDoc.players,
  teamBadges: badgesDoc.teams,
  media: [],
  news: [],
};

const siteData = {
  generatedAt,
  coverage: matchesDoc.coverage,
  matches: matchesDoc.matches,
  players: playersDoc.players,
  media: mediaDoc.stadiumImages ?? [],
  teamBadges: badgesDoc.teams,
  news: newsDoc.items ?? [],
  newsUpdatedAt: newsDoc.updatedAt ?? "",
  archive: archiveDoc,
};

await writeFile(path.join(dataDir, "players-data.js"), `window.BARCA_DATA = ${JSON.stringify(playersData, null, 2)};\n`, "utf8");
await writeFile(path.join(dataDir, "matches-data.js"), `window.BARCA_DATA = ${JSON.stringify(matchesData, null, 2)};\n`, "utf8");
await writeFile(path.join(dataDir, "site-data.js"), `window.BARCA_DATA = ${JSON.stringify(siteData, null, 2)};\n`, "utf8");

console.log(`球员数据块：${playersData.players.length} 人，${detailedPlayerMatches.length}/${matchesDoc.matches.length} 场含球员级字段`);
console.log(`比赛数据块：${matchesData.matches.length} 场，${Object.keys(matchesData.teamBadges).length} 个队徽映射`);
console.log(`兼容数据块：${siteData.matches.length} 场，${siteData.news.length} 条资讯`);
