import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(projectRoot, "data");
const assetDir = path.join(projectRoot, "assets", "barca-brand");
const playerAssetDir = path.join(assetDir, "players");

const seasons = ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26"];
const monthNumbers = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

const stadiumImages = [
  {
    file: "camp-nou-classic.jpg",
    alt: "诺坎普球场全景",
    credit: "FC Barcelona",
    sourcePage: "https://www.fcbarcelona.com/en/club/facilities/spotify-camp-nou",
    url: "https://www.fcbarcelona.com/photo-resources/fcbarcelona/photo/2018/03/13/770788f8-49e4-4eb4-b4f5-aa7daa7f1e13/Camp-Nou-Grass.jpg?height=1350&width=2400",
  },
  {
    file: "camp-nou-return-2025.jpg",
    alt: "球迷重返 Spotify Camp Nou",
    credit: "German Parga / FC Barcelona",
    sourcePage: "https://www.fcbarcelona.com/en/club/news/4407337/45157-culers-roar-as-spotify-camp-nou-comes-back-to-life",
    url: "https://www.fcbarcelona.com/photo-resources/2025/11/22/7582c744-834c-460a-85f9-4c4d82a9c56a/DAG-032-0M1A0354.JPG?height=1350&width=2400",
  },
  {
    file: "camp-nou-training-2025.jpg",
    alt: "新诺坎普开放训练日",
    credit: "FC Barcelona",
    sourcePage: "https://www.fcbarcelona.com/en/news/4397724/day-to-remember-at-the-new-spotify-camp-nou",
    url: "https://www.fcbarcelona.com/photo-resources/2025/11/07/847cb868-dc99-48cd-9f4b-4f287ad75d6a/_SLS3045.jpg?height=1350&width=2400",
  },
];

const cleanText = (value = "") =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const slugify = (value) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const requestWithRetry = async (url, attempts = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Barca-Match-Archive/1.0" },
      });
      if (response.ok || response.status === 404) return response;
      throw new Error(`${response.status} ${response.statusText}: ${url}`);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
};

const fetchText = async (url, optional = false) => {
  const response = await requestWithRetry(url);
  if (!response.ok) {
    if (optional && response.status === 404) return null;
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.text();
};

const download = async (url, target) => {
  const response = await requestWithRetry(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
};

const writeJson = (file, value) =>
  writeFile(path.join(dataDir, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const makeDate = (season, month, day, explicitYear) => {
  const startYear = Number(season.slice(0, 4));
  const monthNumber = monthNumbers[month];
  const year = explicitYear ? Number(explicitYear) : Number(monthNumber) >= 7 ? startYear : startYear + 1;
  return `${year}-${monthNumber}-${String(day).padStart(2, "0")}`;
};

const stripCountry = (team) => cleanText(team).replace(/\s+\([A-Z]{3}\)$/, "");
const isBarca = (team) => stripCountry(team) === "FC Barcelona";

const makeMatch = ({ season, competition, competitionCode, round, date, time = "", home, away, homeGoals, awayGoals, source }) => ({
  id: `${competitionCode}-${season}-${date}-${slugify(home)}-${slugify(away)}`,
  season,
  competition,
  competitionCode,
  round: cleanText(round),
  date,
  time,
  home: stripCountry(home),
  away: stripCountry(away),
  score: Number.isFinite(homeGoals) && Number.isFinite(awayGoals) ? [homeGoals, awayGoals] : null,
  dataLevel: "result-only",
  detailStatus: "公开免费源仅提供赛程与比分，阵容、事件和球员数据等待免费接口补充。",
  source,
});

const parseEuropeanFile = (text, season, competition, competitionCode, source) => {
  if (!text) return [];
  let round = competition;
  let date = "";
  const matches = [];

  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trimEnd();
    const roundMatch = line.match(/^\s*▪\s*(.+)$/);
    if (roundMatch) {
      round = roundMatch[1];
      continue;
    }

    const dateMatch = line.match(/^\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?/);
    if (dateMatch) {
      date = makeDate(season, dateMatch[1], dateMatch[2], dateMatch[3]);
      continue;
    }

    const match = line.match(/^\s*(?:(\d{1,2}:\d{2})\s+)?(.+?)\s+v\s+(.+?)\s+(\d+)-(\d+)(?:\s|$)/);
    if (!match || !date) continue;
    const [, time = "", home, away, homeGoals, awayGoals] = match;
    if (!isBarca(home) && !isBarca(away)) continue;
    matches.push(
      makeMatch({
        season,
        competition,
        competitionCode,
        round,
        date,
        time,
        home,
        away,
        homeGoals: Number(homeGoals),
        awayGoals: Number(awayGoals),
        source,
      }),
    );
  }

  return matches;
};

const parseCupFile = (text, season, source) => {
  if (!text) return [];
  let round = "国王杯";
  let date = "";
  const matches = [];

  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trimEnd();
    const roundMatch = line.match(/^\s*▪\s*(.+)$/);
    if (roundMatch) {
      round = roundMatch[1];
      continue;
    }

    const dateMatch = line.match(/^\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?/);
    if (dateMatch) {
      date = makeDate(season, dateMatch[1], dateMatch[2], dateMatch[3]);
      continue;
    }

    if (!line.includes("FC Barcelona") || !date) continue;
    const versusMatch = line.match(/^\s*(?:(\d{1,2}:\d{2})\s+)?(.+?)\s+v\s+(.+?)\s+(\d+)-(\d+)(?:\s|$)/);
    if (versusMatch) {
      const [, time = "", home, away, homeGoals, awayGoals] = versusMatch;
      if (isBarca(home) || isBarca(away)) {
        matches.push(
          makeMatch({
            season,
            competition: "国王杯",
            competitionCode: "copa",
            round,
            date,
            time,
            home,
            away,
            homeGoals: Number(homeGoals),
            awayGoals: Number(awayGoals),
            source,
          }),
        );
      }
      continue;
    }
    const match = line.match(/^\s*(?:(\d{1,2}:\d{2})\s+)?(.+?)\s{2,}(\d+)-(\d+)(?:.*?)\s{2,}(.+?)\s*$/);
    if (!match) continue;
    const [, time = "", home, homeGoals, awayGoals, away] = match;
    if (!isBarca(home) && !isBarca(away)) continue;
    matches.push(
      makeMatch({
        season,
        competition: "国王杯",
        competitionCode: "copa",
        round,
        date,
        time,
        home,
        away,
        homeGoals: Number(homeGoals),
        awayGoals: Number(awayGoals),
        source,
      }),
    );
  }

  return matches;
};

const syncMatches = async () => {
  const matches = [];

  for (const season of seasons) {
    const leagueUrl = `https://raw.githubusercontent.com/openfootball/football.json/master/${season}/es.1.json`;
    const league = JSON.parse(await fetchText(leagueUrl));
    for (const item of league.matches) {
      if (!isBarca(item.team1) && !isBarca(item.team2)) continue;
      matches.push(
        makeMatch({
          season,
          competition: "西甲",
          competitionCode: "laliga",
          round: item.round,
          date: item.date,
          home: item.team1,
          away: item.team2,
          homeGoals: item.score?.ft?.[0],
          awayGoals: item.score?.ft?.[1],
          source: leagueUrl,
        }),
      );
    }

    const europeanSources = [
      ["欧冠", "ucl", `https://raw.githubusercontent.com/openfootball/champions-league/master/${season}/cl.txt`],
      ["欧联杯", "uel", `https://raw.githubusercontent.com/openfootball/champions-league/master/${season}/el.txt`],
    ];

    for (const [competition, code, url] of europeanSources) {
      const text = await fetchText(url, true);
      matches.push(...parseEuropeanFile(text, season, competition, code, url));
    }

    const cupUrl = `https://raw.githubusercontent.com/openfootball/espana/master/${season}/cup.txt`;
    const cupText = await fetchText(cupUrl, true);
    matches.push(...parseCupFile(cupText, season, cupUrl));
  }

  const unique = [...new Map(matches.map((match) => [match.id, match])).values()].sort((a, b) =>
    `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`),
  );

  await writeJson("matches.json", {
    updatedAt: new Date().toISOString(),
    coverage: "2021/22—2025/26：西甲、欧冠/欧联杯与公开源中可用的国王杯比赛。",
    detailPolicy: "只展示开放数据源已提供的事实；缺失阵容、事件和球员数据时明确标注暂无数据。",
    sources: [
      { name: "OpenFootball football.json", url: "https://github.com/openfootball/football.json", license: "CC0-1.0" },
      { name: "OpenFootball España", url: "https://github.com/openfootball/espana", license: "CC0-1.0" },
      { name: "OpenFootball Champions League", url: "https://github.com/openfootball/champions-league", license: "CC0-1.0" },
    ],
    matches: unique,
  });

  return unique;
};

const syncPlayers = async () => {
  const squadUrl = "https://www.fcbarcelona.com/en/football/first-team/squad";
  const squadHtml = await fetchText(squadUrl);
  const cards = [...squadHtml.matchAll(/<li\s+class="team-list__person-container js-team-list-player"[\s\S]*?<\/li>/g)];
  const players = [];

  for (const [index, cardMatch] of cards.entries()) {
    const card = cardMatch[0];
    const id = card.match(/data-player-id="(\d+)"/)?.[1];
    const profileUrl = card.match(/href="(https:\/\/www\.fcbarcelona\.com\/en\/football\/first-team\/players\/[^"]+)"/)?.[1];
    if (!id || !profileUrl || players.some((player) => player.id === id)) continue;

    const number = cleanText(card.match(/team-person__number[^>]*>([\s\S]*?)<\/span>/)?.[1]);
    const firstName = cleanText(card.match(/team-person__first-name[^>]*>([\s\S]*?)<\/span>/)?.[1]);
    const lastName = cleanText(card.match(/team-person__last-name[^>]*>([\s\S]*?)<\/span>/)?.[1]);
    const position = cleanText(card.match(/team-person__position-meta[^>]*>([\s\S]*?)<\/li>/)?.[1]);
    const fallbackImage = card.match(/data-img-src="(https:\/\/www\.fcbarcelona\.com\/photo-resources\/[^"]+)"/)?.[1];

    let portraitUrl = "";
    let portraitFile = `assets/barca-brand/players/${id}.png`;
    try {
      const profileHtml = await fetchText(profileUrl);
      const imageUrls = [...profileHtml.matchAll(/https:\/\/www\.fcbarcelona\.com\/photo-resources\/[^"' ]+\.png/g)].map(
        (match) => match[0],
      );
      portraitUrl = imageUrls.find((url) => !/home-kit-ficha|icon_cub/i.test(url)) ?? "";
      if (portraitUrl) portraitUrl = `${portraitUrl}?height=790&width=670`;
      if (!portraitUrl && fallbackImage) {
        portraitUrl = `${fallbackImage}?width=940&height=940`;
        portraitFile = `assets/barca-brand/players/${id}.jpg`;
      }
      if (portraitUrl) await download(portraitUrl, path.join(projectRoot, portraitFile));
    } catch (error) {
      console.warn(`球员图片下载失败：${firstName} ${lastName}`, error.message);
    }

    players.push({
      id,
      number,
      firstName,
      lastName,
      displayName: cleanText(`${firstName} ${lastName}`),
      position,
      profileUrl,
      portrait: portraitUrl ? portraitFile.replace(/\\/g, "/") : "",
      portraitSource: portraitUrl,
      order: index,
    });
  }

  await writeJson("players.json", {
    updatedAt: new Date().toISOString(),
    source: squadUrl,
    imageNote: "球员姓名、位置与定妆照来自 FC Barcelona 官方一线队页面。",
    players,
  });

  return players;
};

const syncMedia = async () => {
  for (const image of stadiumImages) {
    await download(image.url, path.join(assetDir, image.file));
  }
  await writeJson("media.json", {
    updatedAt: new Date().toISOString(),
    stadiumImages: stadiumImages.map(({ url, ...image }) => ({
      ...image,
      src: `assets/barca-brand/${image.file}`,
      sourceImage: url,
    })),
  });
  return stadiumImages.map(({ url, ...image }) => ({
    ...image,
    src: `assets/barca-brand/${image.file}`,
    sourceImage: url,
  }));
};

await mkdir(dataDir, { recursive: true });
await mkdir(playerAssetDir, { recursive: true });

const [matches, players, media] = await Promise.all([syncMatches(), syncPlayers(), syncMedia()]);
let badgeDoc = { teams: {} };
let newsDoc = { items: [] };
let archive = {};
try {
  badgeDoc = JSON.parse(await readFile(path.join(dataDir, "team-badges.json"), "utf8"));
} catch {}
try {
  newsDoc = JSON.parse(await readFile(path.join(dataDir, "news.json"), "utf8"));
} catch {}
try {
  archive = JSON.parse(await readFile(path.join(dataDir, "archive.json"), "utf8"));
} catch {}

const browserData = {
  generatedAt: new Date().toISOString(),
  coverage: "2021/22—2025/26 免费公开比赛档案",
  matches,
  players,
  media,
  teamBadges: badgeDoc.teams ?? {},
  news: newsDoc.items ?? [],
  newsUpdatedAt: newsDoc.updatedAt ?? "",
  archive,
};
await writeFile(
  path.join(dataDir, "site-data.js"),
  `window.BARCA_DATA = ${JSON.stringify(browserData, null, 2)};\n`,
  "utf8",
);
console.log(`同步完成：${matches.length} 场比赛，${players.length} 名球员，${media.length} 张球场图片。`);
