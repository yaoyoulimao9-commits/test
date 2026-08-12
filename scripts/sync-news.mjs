import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(projectRoot, "data");
const imageDir = path.join(projectRoot, "assets", "news");
const sourceUrl = "https://www.fcbarcelona.com/en/news/";

const decodeEntities = (value = "") =>
  value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));

const cleanText = (value = "") => decodeEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
const field = (html, className) => {
  const escapedClass = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return cleanText(html.match(new RegExp(`<[^>]+class="[^"]*${escapedClass}[^"]*"[^>]*>([\\s\\S]*?)<\\/(?:div|span)>`, "i"))?.[1]);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url, attempts = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "Barca-Match-Archive/1.0" } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(600 * attempt);
    }
  }
  throw lastError;
};

const normalizeDate = (monthDay) => {
  const now = new Date();
  let date = new Date(`${monthDay}, ${now.getFullYear()} 12:00:00 UTC`);
  if (date.getTime() > now.getTime() + 14 * 24 * 60 * 60 * 1000) date = new Date(`${monthDay}, ${now.getFullYear() - 1} 12:00:00 UTC`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const parseNews = (html) => {
  const widgetStart = html.indexOf('data-type="news-feed"');
  const widgetEnd = html.indexOf('data-type="promoted-content"', widgetStart);
  const feedHtml = html.slice(widgetStart, widgetEnd > widgetStart ? widgetEnd : undefined);
  const containers = feedHtml.split('feed__container js-feed-container').slice(1);
  const items = [];

  for (const container of containers) {
    const monthDay = field(container, "feed__month");
    const publishedDate = normalizeDate(monthDay);
    const cards = container.match(/<a\s+href="[^"]+"\s+class="thumbnail thumbnail--news[\s\S]*?<\/a>/gi) ?? [];
    for (const card of cards) {
      const href = decodeEntities(card.match(/<a\s+href="([^"]+)"/i)?.[1] ?? "");
      if (!/\/news\/\d+\//.test(href)) continue;
      const id = card.match(/data-article-id="(\d+)"/i)?.[1];
      const title = field(card, "thumbnail__title");
      if (!id || !title) continue;
      const image = decodeEntities(card.match(/data-img-src="([^"]+)"/i)?.[1] ?? "").split("?")[0];
      items.push({
        id,
        title,
        description: field(card, "thumbnail__desc"),
        category: field(card, "content-tag"),
        relativeTime: cleanText(card.match(/<time class="thumbnail__time">([\s\S]*?)<\/time>/i)?.[1]),
        publishedDate,
        dateLabel: monthDay,
        source: href.startsWith("http") ? href : `https://www.fcbarcelona.com${href}`,
        sourceImage: image,
      });
    }
  }

  return [...new Map(items.map((item) => [item.id, item])).values()].slice(0, 18);
};

const loadJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(path.join(dataDir, file), "utf8"));
  } catch {
    return fallback;
  }
};

const exists = async (file) => {
  try {
    await access(path.join(projectRoot, file));
    return true;
  } catch {
    return false;
  }
};

const rebuildBrowserData = async (news) => {
  const matchesDoc = await loadJson("matches.json", { matches: [], coverage: "" });
  const playersDoc = await loadJson("players.json", { players: [] });
  const mediaDoc = await loadJson("media.json", { stadiumImages: [] });
  const badgeDoc = await loadJson("team-badges.json", { teams: {} });
  const archive = await loadJson("archive.json", {});
  const newsUpdatedAt = new Date().toISOString();
  const browserData = {
    generatedAt: new Date().toISOString(),
    coverage: matchesDoc.coverage,
    matches: matchesDoc.matches,
    players: playersDoc.players,
    media: mediaDoc.stadiumImages,
    teamBadges: badgeDoc.teams,
    news,
    newsUpdatedAt,
    archive,
  };
  await writeFile(path.join(dataDir, "site-data.js"), `window.BARCA_DATA = ${JSON.stringify(browserData, null, 2)};\n`, "utf8");
};

await mkdir(imageDir, { recursive: true });
const translations = await loadJson("news-translations.json", {});
const previous = await loadJson("news.json", { items: [] });
const previousById = new Map(previous.items.map((item) => [item.id, item]));
const html = await (await fetchWithRetry(sourceUrl)).text();
const parsedItems = parseNews(html);
if (!parsedItems.length) throw new Error("官方新闻页已读取，但没有解析到新闻条目；页面结构可能已经变化。");

const items = [];
for (const [index, item] of parsedItems.entries()) {
  let localImage = previousById.get(item.id)?.localImage ?? "";
  if (localImage && !(await exists(localImage))) localImage = "";
  if (!localImage && item.sourceImage) {
    try {
      const response = await fetchWithRetry(`${item.sourceImage}?width=1280&height=800`);
      const contentType = response.headers.get("content-type") ?? "";
      const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const fileName = `${item.id}.${extension}`;
      await writeFile(path.join(imageDir, fileName), Buffer.from(await response.arrayBuffer()));
      localImage = `assets/news/${fileName}`;
    } catch (error) {
      console.warn(`${item.id} 图片下载失败：${error.message}`);
    }
  }
  const translation = translations[item.id] ?? {};
  items.push({ ...item, ...translation, localImage });
  console.log(`[${index + 1}/${parsedItems.length}] ${translation.titleZh ?? item.title}`);
}

const document = {
  updatedAt: new Date().toISOString(),
  source: sourceUrl,
  sourceName: "FC Barcelona Official Channel",
  note: "资讯标题、摘要、分类、发布时间与图片均来自 FC Barcelona 官方新闻页；中文翻译为本站便于阅读所作。",
  items,
};
await writeFile(path.join(dataDir, "news.json"), `${JSON.stringify(document, null, 2)}\n`, "utf8");
await writeFile(
  path.join(dataDir, "news-data.js"),
  `window.BARCA_NEWS = ${JSON.stringify({ updatedAt: document.updatedAt, source: document.source, items }, null, 2)};\n`,
  "utf8",
);
await rebuildBrowserData(items);
console.log(`完成：同步 ${items.length} 条官方资讯，其中 ${items.filter((item) => item.localImage).length} 条含本地图片。`);
