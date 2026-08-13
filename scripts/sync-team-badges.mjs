import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(projectRoot, "data");
const badgeDir = path.join(projectRoot, "assets", "team-badges");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const aliases = {
  "AD Ceuta FC": "AD Ceuta",
  "AS Monaco FC": "Monaco",
  "Atalanta BC": "Atalanta",
  "Athletic Club": "Athletic Bilbao",
  "Atlético Madrid": "Atletico Madrid",
  "Bayern München": "Bayern Munich",
  "CA Osasuna": "Osasuna",
  "CD Leganés": "Leganes",
  "Chelsea FC": "Chelsea",
  "Club Atlético de Madrid": "Atletico Madrid",
  "Club Brugge KV": "Club Brugge",
  "Cádiz CF": "Cadiz",
  "Deportivo Alavés": "Deportivo Alaves",
  "Dinamo Kiev": "Dynamo Kyiv",
  "Elche CF": "Elche",
  "FC Bayern München": "Bayern Munich",
  "FC Internazionale Milano": "Inter Milan",
  "FC København": "FC Copenhagen",
  "FC Porto": "Porto",
  "FK Crvena Zvezda": "Red Star Belgrade",
  "FK Shakhtar Donetsk": "Shakhtar Donetsk",
  "Getafe CF": "Getafe",
  "Girona FC": "Girona",
  "Granada CF": "Granada",
  Inter: "Inter Milan",
  "Levante UD": "Levante",
  "Manchester United": "Manchester United",
  "Newcastle United FC": "Newcastle United",
  "PAE Olympiakos SFP": "Olympiacos",
  "Paris Saint-Germain FC": "Paris Saint Germain",
  "RC Celta de Vigo": "Celta Vigo",
  "RCD Espanyol de Barcelona": "Espanyol",
  "RCD Mallorca": "Mallorca",
  "Rayo Vallecano de Madrid": "Rayo Vallecano",
  "Real Betis Balompié": "Real Betis",
  "Real Madrid CF": "Real Madrid",
  "Real Sociedad de Fútbol": "Real Sociedad",
  "Real Valladolid CF": "Real Valladolid",
  "Royal Antwerp FC": "Royal Antwerp",
  "SK Slavia Praha": "Slavia Prague",
  "SL Benfica": "Benfica",
  "Sport Lisboa e Benfica": "Benfica",
  "SSC Napoli": "Napoli",
  "Stade Brestois 29": "Brest",
  "UD Almería": "Almeria",
  "UD Las Palmas": "Las Palmas",
  "Unionistas CF": "Unionistas de Salamanca",
  "Valencia CF": "Valencia",
  "Viktoria Plzeň": "Viktoria Plzen",
  "Villarreal CF": "Villarreal",
};

const slugify = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const fetchWithRetry = async (url, options = {}, attempts = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { "user-agent": "Barca-Match-Archive/1.0", ...(options.headers ?? {}) },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(700 * attempt);
    }
  }
  throw lastError;
};

const chooseTeam = (teams, query) => {
  if (!teams?.length) return null;
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    teams.find(
      (team) =>
        team.strSport === "Soccer" &&
        team.strGender !== "Female" &&
        team.strTeam?.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedQuery,
    ) ??
    teams.find((team) => team.strSport === "Soccer" && team.strGender !== "Female") ??
    teams[0]
  );
};

const rebuildBrowserData = async (teams) => {
  const matchesDoc = JSON.parse(await readFile(path.join(dataDir, "matches.json"), "utf8"));
  const playersDoc = JSON.parse(await readFile(path.join(dataDir, "players.json"), "utf8"));
  const mediaDoc = JSON.parse(await readFile(path.join(dataDir, "media.json"), "utf8"));
  let archive = {};
  try {
    archive = JSON.parse(await readFile(path.join(dataDir, "archive.json"), "utf8"));
  } catch {}
  let newsDoc = { items: [] };
  try {
    newsDoc = JSON.parse(await readFile(path.join(dataDir, "news.json"), "utf8"));
  } catch {}

  const browserData = {
    generatedAt: new Date().toISOString(),
    coverage: matchesDoc.coverage,
    matches: matchesDoc.matches,
    players: playersDoc.players,
    media: mediaDoc.stadiumImages,
    teamBadges: teams,
    news: newsDoc.items ?? [],
    newsUpdatedAt: newsDoc.updatedAt ?? "",
    archive,
  };
  await writeFile(path.join(dataDir, "site-data.js"), `window.BARCA_DATA = ${JSON.stringify(browserData, null, 2)};\n`, "utf8");
};

await mkdir(badgeDir, { recursive: true });
const matchesDoc = JSON.parse(await readFile(path.join(dataDir, "matches.json"), "utf8"));
const originalTeams = [...new Set(matchesDoc.matches.flatMap((match) => [match.home, match.away]))].sort();
const canonicalTeams = [...new Set(originalTeams.filter((team) => team !== "FC Barcelona").map((team) => aliases[team] ?? team))];
const resolved = new Map();
let previousDocument = { teams: {} };
try {
  previousDocument = JSON.parse(await readFile(path.join(dataDir, "team-badges.json"), "utf8"));
} catch {}
const previousByQuery = new Map(
  Object.values(previousDocument.teams ?? {})
    .filter((team) => team.query && team.badge)
    .map((team) => [team.query, team]),
);

for (const [index, query] of canonicalTeams.entries()) {
  const cached = previousByQuery.get(query);
  if (cached) {
    resolved.set(query, cached);
    console.log(`[${index + 1}/${canonicalTeams.length}] ${query}：使用本地缓存`);
    continue;
  }
  try {
    const apiUrl = `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(query)}`;
    const response = await fetchWithRetry(apiUrl);
    const payload = await response.json();
    const team = chooseTeam(payload.teams, query);
    if (!team?.strBadge) throw new Error("未找到可用队徽");

    const imageResponse = await fetchWithRetry(team.strBadge);
    const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
    const extension = imageResponse.headers.get("content-type")?.includes("webp") ? "webp" : "png";
    const fileName = `${slugify(query)}.${extension}`;
    await writeFile(path.join(badgeDir, fileName), imageBytes);
    resolved.set(query, {
      name: team.strTeam ?? query,
      badge: `assets/team-badges/${fileName}`,
      provider: "TheSportsDB",
      source: `https://www.thesportsdb.com/team/${team.idTeam}`,
    });
    console.log(`[${index + 1}/${canonicalTeams.length}] ${query}：${team.strTeam}`);
  } catch (error) {
    resolved.set(query, { name: query, badge: "", provider: "TheSportsDB", status: `同步失败：${error.message}` });
    console.warn(`[${index + 1}/${canonicalTeams.length}] ${query}：${error.message}`);
  }
  if (index < canonicalTeams.length - 1) await wait(2050);
}

const teams = Object.fromEntries(
  originalTeams.map((originalName) => {
    if (originalName === "FC Barcelona") {
      return [originalName, { name: originalName, badge: "assets/barca-brand/fcb-crest.png", provider: "FC Barcelona" }];
    }
    const canonicalName = aliases[originalName] ?? originalName;
    return [originalName, { ...resolved.get(canonicalName), query: canonicalName }];
  }),
);

const document = {
  updatedAt: new Date().toISOString(),
  note: "比赛双方队徽来自 TheSportsDB 免费公开接口并已下载到项目本地；FC Barcelona 使用项目中的官方品牌图。",
  teams,
};
await writeFile(path.join(dataDir, "team-badges.json"), `${JSON.stringify(document, null, 2)}\n`, "utf8");
await rebuildBrowserData(teams);

const successCount = Object.values(teams).filter((team) => team.badge).length;
console.log(`完成：${successCount}/${originalTeams.length} 个比赛队名已映射本地真实队徽。`);
await import("./build-browser-chunks.mjs");
