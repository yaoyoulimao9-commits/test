import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const base = "https://yaoyoulimao9-commits.github.io/test/";
const readJson = async (name, fallback) => {
  try { return JSON.parse(await readFile(path.join(root, "data", name), "utf8")); }
  catch { return fallback; }
};
const players = (await readJson("players.json", { players: [] })).players;
const matches = (await readJson("matches.json", { matches: [] })).matches;
const news = (await readJson("news.json", { items: [] })).items;
const pages = ["index.html", "players.html", "fixtures.html", "history.html", "appearances.html", "goals.html", "assists.html", "news.html", "compare.html", "favorites.html"];
const urls = [
  ...pages.map((page) => `${base}${page}`),
  ...players.map((player) => `${base}player.html?id=${encodeURIComponent(player.id)}`),
  ...matches.map((match) => `${base}match.html?id=${encodeURIComponent(match.id)}`),
  ...news.map((item) => `${base}news-article.html?id=${encodeURIComponent(item.id)}`),
];
const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(root, "sitemap.xml"), xml, "utf8");
console.log(`站点地图：${urls.length} 个网址`);
