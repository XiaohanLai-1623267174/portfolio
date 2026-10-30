# 赖肖韩 · AI 应用开发实习作品集

面向「AI 应用开发实习（RAG / Agent 方向）」的单页作品集。**一个 HTML 文件就是全部**：样式、脚本、图示全部内联，双击即可离线打开，无任何外部网络依赖。

**在线访问**：<https://minorcold-portfolio-autonomous-manatee-d4c0b7b32b0c9.webapps.tcloudbase.com/>

---

## 这个仓库里有什么

| 路径 | 说明 |
|---|---|
| `deploy/index.html` | **交付物本体**。单文件，136 KB（139,321 字节），含全部内容、内联 SVG 图示与内嵌 Inter 子集 |
| `deploy/og-image.png` | 社交分享卡片，1200×630。页面本身不引用它，只被 `og:image` 指向 |
| `DESIGN.md` | 设计说明：色板、对比度实测值、字号与断点、图示几何、验收方法 |
| `diagrams/build-diagrams.mjs` | 图示生成器。产物同时输出 `.svg` 与 `.inline.svg`（后者内联进页面） |
| `diagrams/*.svg` | 5 组图示的构建产物，含一个**反向对照**样例（见下） |
| `tools/geometry_capture.mjs` | 图示几何验收脚本：用 `getBBox()` 检出越界、重叠、超出 `viewBox` |
| `tools/interactive_audit.mjs` | 交互验收脚本：轮播、主题切换、控制台异常 |

仓库**有意不包含**个人材料（照片、简历原件）与验收截图，它们在本地维护。

## 直接看

不用装任何东西：

```
双击 deploy/index.html
```

或用任意静态服务器把它当根目录：

```
npx serve deploy
```

## 改图示

图示是**代码画的**，不是导出图片，所以改了尺寸或文案必须重新生成：

```
node diagrams/build-diagrams.mjs
```

脚本会重写 `diagrams/*.svg` 与 `diagrams/*.inline.svg`，后者需要手工贴回 `deploy/index.html` 的对应 `<svg>` 块。改动后请用 `tools/geometry_capture.mjs` 复验——它是唯一能发现「文字挤出画布」的手段。

## 部署

只上传 `deploy/` 里的两个文件（打成压缩包、`index.html` 位于压缩包**根目录**）：

| 平台 | 要求 |
|---|---|
| 腾讯云 CloudBase | 静态托管 / 应用托管，默认首页设为 `index.html` |
| Cloudflare Workers | 入口名必须是 `index.html`，否则根路径 404 |

两种平台的根路径 `/` 都只认 `index.html`。压缩包内多套一层文件夹也会导致 404。

## 关于验证

页面里的数字不是估计值。`DESIGN.md` 里的对比度、字号、图示尺寸均由浏览器内实测取得（`getComputedStyle` / `getBBox`），不是照抄配色工具的输出。

几何验收带**反向对照**：`diagrams/_negative-control.inline.svg` 是一张**故意画坏**的图，验收装置必须能把它判红。如果它也是绿的，说明装置失效，其余全部结果作废。

## 技术选择

| 决定 | 原因 |
|---|---|
| 单文件、零外部资源 | 作品集要在任何网络环境下都能打开；远程字体和 CDN 是可用性的敌人 |
| 图示用内联 SVG 而非图片 | 随主题变量自动换色，体积小，且能保证文字不被截断（图片做不到） |
| 不引入构建工具 | 一个 HTML 文件没有构建的必要；多一层工具就多一类失败 |

## 许可

内容与个人经历归作者所有。仓库内 `LICENSE` 仅覆盖代码部分。