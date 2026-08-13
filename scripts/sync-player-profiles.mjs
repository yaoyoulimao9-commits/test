import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(projectRoot, "data");
const playersFile = path.join(dataDir, "players.json");

const decodeEntities = (value = "") =>
  value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&#x2022;|&#8226;/gi, "•")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));

const cleanText = (value = "") =>
  decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const fetchHtml = async (url, attempts = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "Barca-Match-Archive/1.0" } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
};

const fieldFromStrip = (html, label) => {
  const pattern = new RegExp(
    `<div\\s+class="player-strip__label">\\s*${label}\\s*<\\/div>\\s*<div\\s+class="player-strip__data">([\\s\\S]*?)<\\/div>`,
    "i",
  );
  return cleanText(html.match(pattern)?.[1]);
};

const parseHonours = (html) => {
  const honoursSection = html.match(/player-honours content-slider[\s\S]*?<ul class="content-slider__controls/gi)?.[0] ?? "";
  return [...honoursSection.matchAll(/<li class="player-honours__item[\s\S]*?<\/li>/gi)]
    .map(([item]) => ({
      type: cleanText(item.match(/player-honour__type">([\s\S]*?)<\/div>/i)?.[1]),
      title: cleanText(item.match(/player-honour__title">([\s\S]*?)<\/div>/i)?.[1]),
      count: Number(cleanText(item.match(/player-honour__trophy-amount">([\s\S]*?)<\/span>/i)?.[1])) || 0,
      seasons: cleanText(item.match(/player-honour__dates">([\s\S]*?)<\/div>/i)?.[1]),
    }))
    .filter((honour) => honour.title);
};

const parseProfile = (html) => {
  const tagline = cleanText(
    html.match(/content-promo__title player-bio__title">([\s\S]*?)<\/div>/i)?.[1] ??
      html.match(/<meta name="description" content="([^"]*)"/i)?.[1],
  );
  const descriptionHtml = html.match(/content-promo__description player-bio__description">([\s\S]*?)<\/div>/i)?.[1] ?? "";
  const biography = [...descriptionHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1]))
    .filter(Boolean);

  return {
    tagline,
    biography,
    birthPlace: fieldFromStrip(html, "Place of birth"),
    birthDate: fieldFromStrip(html, "Date of birth"),
    weight: fieldFromStrip(html, "Weight"),
    height: fieldFromStrip(html, "Height"),
    honours: parseHonours(html),
  };
};

const rebuildBrowserData = async (players) => {
  const matchesDoc = JSON.parse(await readFile(path.join(dataDir, "matches.json"), "utf8"));
  const mediaDoc = JSON.parse(await readFile(path.join(dataDir, "media.json"), "utf8"));
  let badgeDoc = { teams: {} };
  try {
    badgeDoc = JSON.parse(await readFile(path.join(dataDir, "team-badges.json"), "utf8"));
  } catch {}
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
    players,
    media: mediaDoc.stadiumImages,
    teamBadges: badgeDoc.teams ?? {},
    news: newsDoc.items ?? [],
    newsUpdatedAt: newsDoc.updatedAt ?? "",
    archive,
  };
  await writeFile(path.join(dataDir, "site-data.js"), `window.BARCA_DATA = ${JSON.stringify(browserData, null, 2)};\n`, "utf8");
};

const document = JSON.parse(await readFile(playersFile, "utf8"));
const enrichedPlayers = [];

for (const [index, player] of document.players.entries()) {
  try {
    const html = await fetchHtml(player.profileUrl);
    const profile = parseProfile(html);
    enrichedPlayers.push({ ...player, ...profile });
    console.log(`[${index + 1}/${document.players.length}] ${player.displayName}：档案已同步`);
  } catch (error) {
    enrichedPlayers.push({ ...player, profileStatus: `同步失败：${error.message}` });
    console.warn(`[${index + 1}/${document.players.length}] ${player.displayName}：${error.message}`);
  }
}

const nextDocument = {
  ...document,
  updatedAt: new Date().toISOString(),
  profileNote: "出生信息、身高、体重、官方简介与荣誉来自各球员的 FC Barcelona 官方档案页。",
  players: enrichedPlayers,
};

await writeFile(playersFile, `${JSON.stringify(nextDocument, null, 2)}\n`, "utf8");
await rebuildBrowserData(enrichedPlayers);
console.log(`完成：${enrichedPlayers.filter((player) => player.birthDate).length}/${enrichedPlayers.length} 名球员档案包含完整基础信息。`);
await import("./build-browser-chunks.mjs");
