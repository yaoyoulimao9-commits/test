# 巴萨赛场档案

面向中文巴萨球迷的非官方网站。当前版本包含诺坎普高清轮播、官方一线队定妆照与完整档案、近五赛季比赛、俱乐部历史、历史三大榜单、官方时事资讯，以及球员对比、收藏与最近浏览等个人化功能。

## 本地查看

直接双击 `index.html` 即可。所有比赛数据同时生成到 `data/site-data.js`，因此使用 `file://` 打开时不需要本地服务器。

## 页面结构

- `index.html`：首屏为三张诺坎普高清轮播和七个栏目入口，下方展示最新官方资讯
- `players.html`：球员高清轮播、23 名官方一线队球员、搜索与位置筛选
- `player.html`：独立球员档案、中文简介、官方资料、荣誉和已核实比赛覆盖
- `compare.html`：两名球员的官方档案与荣誉横向对比
- `favorites.html`：只保存在浏览器本机的收藏球员、收藏比赛和最近浏览
- `fixtures.html`：2021/22—2025/26 共 262 场比赛档案、数据看板、赛季/赛事筛选、列表/月历视图和双方真实队徽
- `match.html`：比分、足球场阵型、比赛事件和球员单场数据界面
- `history.html`：1899 年至今的 13 段历史时间轴、时代筛选与荣誉分类
- `appearances.html`：一线队正式比赛历史出场前十名
- `goals.html`：一线队正式比赛历史进球前十名
- `assists.html`：历史助攻纪录与 StatBunker 西甲同口径前十名
- `news.html`：FC Barcelona 官方最新资讯、中文摘要、分类筛选和官方原文入口
- `news-article.html`：资讯站内详情、中文摘要、来源说明和相关资讯
- `archive/long-home-v0.html`：调整网站结构前的长首页备份

## 免费数据更新

基础比赛数据不需要账户或密钥：

```powershell
node scripts/sync-free-data.mjs
```

该命令会更新 OpenFootball 的五赛季比赛结果、巴萨官方阵容和本地高清图片，并重新生成全量数据、页面轻量数据块与站点地图。

只重新生成前端数据分包、站点地图或优化后的 WebP 图片：

```powershell
node scripts/build-browser-chunks.mjs
node scripts/build-sitemap.mjs
python scripts/optimize-images.py
```

单独更新球员官方档案、比赛队徽与时事资讯：

```powershell
node scripts/sync-player-profiles.mjs
node scripts/sync-team-badges.mjs
node scripts/sync-news.mjs
```

资讯同步会同时生成 `data/news-data.js`。部署后的页面每 5 分钟检查这个文件是否更新；本地 `file://` 页面显示最近一次同步的内容。

仓库内的 `.github/workflows/sync-news.yml` 会在每小时第 7 分和第 37 分自动读取官方资讯。若已启用 GitHub Pages（来源选择 GitHub Actions），再在仓库 Actions variables 中添加 `DEPLOY_PAGES=true`，同一个任务会把更新后的站点直接发布。

队徽同步带本地缓存，只会请求新增或尚未成功匹配的球队。修改后可运行完整性检查：

```powershell
node scripts/verify-site.mjs
```

如需在免费额度内补充阵容、事件和球员数据：

1. 注册 API-Football 免费账户并取得 API Key。
2. 将 `.env.example` 复制为 `.env`，只在 `.env` 中填写密钥。
3. 运行 `node scripts/enrich-api-football.mjs`。

`.env` 已被 Git 忽略，密钥不会进入网页或 GitHub。免费计划的赛季覆盖有限，因此没有返回详情的比赛会保留真实比分，并明确显示“暂无免费阵容数据”。

## 数据与素材来源

- OpenFootball `football.json`、`espana`、`champions-league`：CC0 比赛数据
- FC Barcelona 官方网站：俱乐部队徽、球场图片、球员名单、定妆照、档案、历史、荣誉与时事资讯
- TheSportsDB：比赛对手队徽的免费公开接口，图片已存入项目本地
- StatBunker：助攻页的提供方口径西甲榜单
- 可选 API-Football 免费账户：阵容、事件和球员单场统计

本项目为非官方球迷项目。俱乐部标志及官方图片版权归其各自权利人所有。
