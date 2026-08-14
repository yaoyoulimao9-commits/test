import { access, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const htmlFiles = ["index.html", "players.html", "player.html", "compare.html", "favorites.html", "fixtures.html", "match.html", "history.html", "appearances.html", "goals.html", "assists.html", "news.html", "news-article.html"];
const sectionPages = ["players.html", "fixtures.html", "history.html", "appearances.html", "goals.html", "assists.html", "news.html"];
const errors = [];
const checkedReferences = new Set();

const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

const fileExists = async (relativePath) => {
  try {
    await access(path.join(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
};

for (const file of htmlFiles) {
  const html = await readFile(path.join(projectRoot, file), "utf8");
  expect(/<!doctype html>/i.test(html), `${file} 缺少 doctype`);
  expect(/<html[^>]*lang="zh-CN"/i.test(html), `${file} 缺少中文语言声明`);
  expect(/<main\b/i.test(html) && /<\/main>/i.test(html), `${file} 缺少完整 main 元素`);
  expect(/<\/html>\s*$/i.test(html), `${file} 缺少结束 html 标签`);
  expect(!/向前浏览|向后浏览/.test(html), `${file} 仍包含轮播方向文字`);

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const reference = match[1].split(/[?#]/)[0];
    if (!reference || /^(?:https?:|mailto:|tel:|data:|#)/i.test(reference)) continue;
    const decoded = decodeURIComponent(reference);
    const resolved = path.normalize(path.join(path.dirname(file), decoded));
    checkedReferences.add(resolved);
    expect(await fileExists(resolved), `${file} 引用了不存在的文件：${reference}`);
  }
}

for (const file of sectionPages) {
  const html = await readFile(path.join(projectRoot, file), "utf8");
  for (const route of sectionPages) expect(html.includes(`href="${route}"`), `${file} 导航缺少 ${route}`);
}

const matchesDocument = JSON.parse(await readFile(path.join(projectRoot, "data", "matches.json"), "utf8"));
const playersDocument = JSON.parse(await readFile(path.join(projectRoot, "data", "players.json"), "utf8"));
const badgesDocument = JSON.parse(await readFile(path.join(projectRoot, "data", "team-badges.json"), "utf8"));
const browserScript = await readFile(path.join(projectRoot, "data", "site-data.js"), "utf8");
const browserData = JSON.parse(browserScript.replace(/^window\.BARCA_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
const newsDocument = JSON.parse(await readFile(path.join(projectRoot, "data", "news.json"), "utf8"));
const newsBrowserScript = await readFile(path.join(projectRoot, "data", "news-data.js"), "utf8");
const newsBrowserData = JSON.parse(newsBrowserScript.replace(/^window\.BARCA_NEWS\s*=\s*/, "").replace(/;\s*$/, ""));
const playersBrowserScript = await readFile(path.join(projectRoot, "data", "players-data.js"), "utf8");
const playersBrowserData = JSON.parse(playersBrowserScript.replace(/^window\.BARCA_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
const matchesBrowserScript = await readFile(path.join(projectRoot, "data", "matches-data.js"), "utf8");
const matchesBrowserData = JSON.parse(matchesBrowserScript.replace(/^window\.BARCA_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
const styles = await readFile(path.join(projectRoot, "styles.css"), "utf8");
const mainScript = await readFile(path.join(projectRoot, "script.js"), "utf8");
const homeHtml = await readFile(path.join(projectRoot, "index.html"), "utf8");
const workflow = await readFile(path.join(projectRoot, ".github", "workflows", "sync-news.yml"), "utf8");
const matchWorkflow = await readFile(path.join(projectRoot, ".github", "workflows", "sync-match-details.yml"), "utf8");
const apiSyncScript = await readFile(path.join(projectRoot, "scripts", "enrich-api-football.mjs"), "utf8");
const apiSyncState = JSON.parse(await readFile(path.join(projectRoot, "data", "api-football-sync-state.json"), "utf8"));
const matchTeams = [...new Set(matchesDocument.matches.flatMap((match) => [match.home, match.away]))];

expect(matchesDocument.matches.length >= 250, `比赛记录不足：${matchesDocument.matches.length}`);
expect(playersDocument.players.length >= 20, `球员档案不足：${playersDocument.players.length}`);
expect(playersDocument.players.every((player) => player.birthDate && player.height && player.biography?.length), "存在基础资料或简介不完整的现役球员档案");
expect(browserData.matches.length === matchesDocument.matches.length, "site-data.js 的比赛数量与源数据不一致");
expect(browserData.players.length === playersDocument.players.length, "site-data.js 的球员数量与源数据不一致");
expect(playersBrowserData.players.length === playersDocument.players.length, "players-data.js 的球员数量与源数据不一致");
expect(playersBrowserData.matchArchiveCount === matchesDocument.matches.length, "players-data.js 的比赛档案总数不一致");
expect(matchesBrowserData.matches.length === matchesDocument.matches.length, "matches-data.js 的比赛数量与源数据不一致");
expect(Object.keys(matchesBrowserData.teamBadges).length >= matchTeams.length, "matches-data.js 的队徽映射数量不足");
expect(newsDocument.items.length >= 10, `时事资讯不足：${newsDocument.items.length}`);
expect(browserData.news.length === newsDocument.items.length, "site-data.js 的资讯数量与源数据不一致");
expect(newsBrowserData.items.length === newsDocument.items.length, "news-data.js 的资讯数量与源数据不一致");
expect(newsDocument.items.every((item) => item.source.startsWith("https://www.fcbarcelona.com/")), "存在非 FC Barcelona 官方来源的资讯");
expect(!/\.match-detail-nav\s*\{[^}]*position:\s*sticky/is.test(styles), "比赛详情栏目导航仍为吸顶状态");
expect(homeHtml.includes('data-home-news-list'), "首页缺少首屏下方的资讯流");
expect(mainScript.includes("news-article.html?id="), "资讯卡片未指向站内详情页");
expect(mainScript.includes("5 * 60 * 1000"), "页面缺少五分钟资讯数据检查");
expect(/cron:\s*"7,37 \* \* \* \*"/.test(workflow), "GitHub Actions 未配置每半小时资讯同步");
expect(/cron:\s*"17 \*\/6 \* \* \*"/.test(matchWorkflow), "GitHub Actions 未配置每六小时比赛详情同步");
expect(matchWorkflow.includes("secrets.API_FOOTBALL_KEY"), "比赛同步工作流未使用 GitHub Secret");
expect(matchWorkflow.includes('API_FOOTBALL_MAX_REQUESTS: "20"'), "比赛同步工作流缺少单轮请求保护线");
expect(matchWorkflow.includes('API_FOOTBALL_RESERVE_REQUESTS: "10"'), "比赛同步工作流缺少每日保留额度");
expect(apiSyncScript.includes("x-ratelimit-requests-remaining"), "比赛同步器未读取 API 剩余额度");
expect(apiSyncScript.includes("nextRetryAt"), "比赛同步器缺少失败退避记录");
expect(apiSyncState.version === 1 && apiSyncState.fixtures && typeof apiSyncState.fixtures === "object", "API-Football 同步状态文件无效");
expect(!/api[_-]?key|password|token/i.test(JSON.stringify(apiSyncState).replace(/API-Football/gi, "")), "API-Football 同步状态文件疑似包含敏感字段");

for (const team of matchTeams) {
  const entry = badgesDocument.teams[team];
  expect(Boolean(entry?.badge), `${team} 缺少队徽映射`);
  if (entry?.badge) expect(await fileExists(entry.badge), `${team} 的队徽文件不存在：${entry.badge}`);
}
expect(Object.keys(browserData.teamBadges).length >= matchTeams.length, "site-data.js 的队徽映射数量不足");
expect(badgesDocument.teams["Paris Saint-Germain FC"]?.name === "Paris Saint-Germain", "巴黎圣日耳曼队徽映射错误");
expect(badgesDocument.teams["Deportivo Alavés"]?.name === "Deportivo Alavés", "阿拉维斯队徽映射错误");

for (const player of playersDocument.players) {
  if (player.portrait) expect(await fileExists(player.portrait), `${player.displayName} 的本地肖像不存在：${player.portrait}`);
}
for (const item of newsDocument.items) {
  expect(Boolean(item.titleZh || item.title), `${item.id} 缺少资讯标题`);
  expect(Boolean(item.descriptionZh || item.description), `${item.id} 缺少资讯摘要`);
  if (item.localImage) expect(await fileExists(item.localImage), `${item.id} 的资讯图片不存在：${item.localImage}`);
}

if (errors.length) {
  console.error(`检查失败（${errors.length} 项）：`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`页面：${htmlFiles.length} 个通过`);
console.log(`本地引用：${checkedReferences.size} 个通过`);
console.log(`比赛：${matchesDocument.matches.length} 场`);
console.log(`球员：${playersDocument.players.length} 人，完整档案 ${playersDocument.players.filter((player) => player.biography?.length).length} 人`);
console.log(`队名/队徽：${matchTeams.length}/${matchTeams.length}`);
console.log(`官方资讯：${newsDocument.items.length} 条，当前中文翻译 ${newsDocument.items.filter((item) => item.titleZh && item.descriptionZh).length} 条，本地图片 ${newsDocument.items.filter((item) => item.localImage).length} 条`);
console.log("资讯入口：首页第二屏 + 站内详情页");
console.log("更新链路：页面每 5 分钟检查，GitHub Actions 每 30 分钟同步");
console.log("比赛详情：每 6 小时增量同步，单轮最多 20 次请求并保留 10 次免费额度");
console.log("比赛详情栏目导航：已取消吸顶");
console.log("轮播方向文字：已清除");
