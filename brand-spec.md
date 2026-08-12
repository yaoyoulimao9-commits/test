# 巴萨赛场档案 · 品牌与素材规范

## 设计定位

- 类型：非官方中文巴萨球迷资料与比赛档案站
- 模式：重设计但保留现有页面结构与链接
- 视觉语言：巴萨博物馆 + 欧洲足球年鉴 + 转播级比赛中心
- 视觉变化度：6/10
- 动态强度：7/10
- 信息密度：比赛页 8/10，首页 3/10
- 真实素材依赖：9/10
- 品牌还原：9/10

## 页面与交互

- `index.html`：诺坎普高清首屏、站点标志、七栏目入口，以及首屏下方的最新资讯编辑台
- `players.html`：高清球员轮播，所有球员姓名前展示官方透明定妆照
- `fixtures.html`：近五赛季紧凑比赛索引
- `match.html`：比分、双方阵型切换、事件时间线和球员数据弹窗
- `news.html`：FC Barcelona 官方资讯的中文编辑台，使用本地官方图片、分类筛选和原文链接
- `news-article.html`：站内资讯详情与来源说明；卡片不再直接跳出站外
- 所有轮播支持上一张、下一张、指示器、暂停、桌面端左右悬停连续轮播和 `prefers-reduced-motion`

## 官方品牌资产

| 用途 | 本地文件 | 来源 |
| --- | --- | --- |
| 官方队徽与字标 | `assets/barca-brand/fcb-crest.png` | FC Barcelona 官方网站 |
| 诺坎普经典全景 | `assets/barca-brand/camp-nou-classic.jpg` | FC Barcelona 官方球场图片 |
| 2025 重返诺坎普 | `assets/barca-brand/camp-nou-return-2025.jpg` | FC Barcelona 官方新闻图片，German Parga |
| 2025 开放训练日 | `assets/barca-brand/camp-nou-training-2025.jpg` | FC Barcelona 官方新闻图片 |
| 2026 诺坎普主视觉 | `assets/barca-brand/spotify-camp-nou-2026.jpg` | FC Barcelona 官方公告 |
| 一线队三人主视觉 | `assets/barca-brand/first-team-trio-2025-26.jpg` | FC Barcelona 官方图片 |
| 一线队透明定妆照 | `assets/barca-brand/players/*.png` | FC Barcelona 官方球员页，670×790 |
| 最新资讯图片 | `assets/news/*` | FC Barcelona Official Channel 新闻页 |

## 色彩与字体

- 夜场背景：`#050814`
- 巴萨蓝：`#004D98`
- 石榴红：`#A50044`
- 荣誉金：`#EDBB00`
- 暖白底色：`#F4F1E8`
- 冷白文字：`#F7F8FC`
- 拉丁标题与数字：`Bahnschrift Condensed`
- 中文与正文：`Microsoft YaHei UI` / `PingFang SC`

## 形状与动效

- 8px 基础间距网格
- 赛程、榜单和数据面板使用直角与细分隔线
- 圆形仅用于头像、状态点和单一图标控件
- 轮播使用 6—6.5 秒自动节奏与 900ms 交叉淡入；桌面端左右悬停 280ms 后触发，并以 1.1 秒节奏连续切换
- 运动必须有暂停入口，并在减少动态偏好下关闭自动播放

## 数据原则

- 五赛季基础赛果来自 OpenFootball CC0 开放仓库
- 详细阵容与统计只使用可验证的免费 API 返回值
- 没有阵容、助攻、红黄牌、换人或球员数据时显示明确空状态
- 不根据比分、新闻摘要或常识推测任何缺失字段
- 时事资讯只收录 FC Barcelona 官方新闻页条目；中文标题和摘要保留官方原文链接以便核对
- 部署版每 5 分钟检查一次数据文件，GitHub Actions 每 30 分钟同步一次官方新闻；纯本地版读取最近一次同步结果
