# agent.md — 本仓库的 AI 协作约定

给在这个仓库里干活的 AI 编码代理（也适用于人类协作者）看的操作手册。
凡是与用户口头指令冲突的地方，以用户当次指令为准；其余默认按本文执行。

---

## 0. 回复约束

- 每次回复必须以 `(∠・ω＜ )⌒☆` 开头，不得省略、不得改写。

---

## 1. 这个仓库是什么

「许愿」式编程实验场：用户用自然语言许一个愿，代理负责把它做成能跑、能看、能复盘的成品。

因此每个许愿目录都要同时满足三件事：

1. **能交付** —— 有可直接打开的成品，不依赖后端、不依赖联网。
2. **能追溯** —— 许愿原文（`提示词.md`）、源码、抓取的资料、验收记录都在目录里。
3. **能重建** —— 成品由脚本从源码生成，不靠手改产物。

---

## 2. 目录约定

```
许愿/
├── README.md              # 仓库总览 + 许愿清单（新增许愿时更新表格）
├── agent.md               # 本文件
├── .gitignore
└── <愿望名>/               # 一个愿望一个目录
    ├── 提示词.md           # 许愿原文，只读；新增需求请追加「## 追加需求」小节
    ├── README.md           # 成品说明：做了什么、怎么开、怎么构建、内容口径
    ├── index.html          # 构建产物，双击可开，禁止手改
    ├── dev.html            # 开发入口，外链 src/ 下的 css/js
    ├── src/
    │   ├── css/            # 分层样式：base / layout / sections / photos / overlay
    │   └── js/             # data.*.js（内容） + app.*.js（逻辑） + art.js（图形）
    ├── assets/
    │   ├── heroes/         # 下载的原始图片
    │   └── processed/      # 压缩后的 WebP，供构建内联
    ├── tools/              # build / qa / 抓取 / 图片处理 脚本
    ├── research/           # 抓取到的资料原文，用于核对事实
    └── qa/                 # report.json 与验收截图（截图不入库）
```

新建许愿时照抄这个骨架；文件名用中文还是英文跟随该许愿的现有风格，不要中途混着改。

---

## 3. 标准工作流

```powershell
cd <愿望名>

# 1) 只改 src/、dev.html、tools/ —— 永远不要手改 index.html
# 2) 构建单文件成品
node tools/build.mjs
# 3) 回归测试（需要本机 Chrome 或 Edge）
node tools/qa.mjs
```

提交前必须满足：

- `qa/report.json` 中 `consoleErrors` 与 `failedRequests` 为空数组；
- `hasHorizontalOverflow` 为 `false`，移动端 390px 宽无横向滚动；
- 页面统计数字与 `data.*.js` 的实际条目数一致（改数据就要跑构建，不要手改数字）；
- `index.html` 内没有残留外部 `src` / `href` 请求（`build.mjs` 会打印剩余外部引用数）。

---

## 4. 硬性规则

- **零外部请求**：不引 CDN、不引网络字体、不引远程图片。图片一律本地文件 + 构建时内联为 data URI。
- **数据与渲染分离**：所有文案、作品、角色、事件只写在 `src/js/data.*.js`；逻辑文件里不许硬编码内容。
- **不虚构事实**：年份、日期、数量、设定无可靠依据时写「年代未明确」或标注「官方设定 / 作品描述」。需要核对时先看 `research/` 里已抓取的原文，再决定要不要补抓。
- **数字由数据算**：首屏统计、筛选计数等一律从数据数组计算，禁止写死。
- **可访问性**：键盘可操作、焦点可见、弹窗打开时锁定背景滚动、`Esc` 关闭并把焦点还给触发元素。
- **产物归产物**：`index.html`、`src/js/images.js` 由脚本生成，改它们等于白改。
- **体积**：单文件超过 10 MB 不进库；`.zip`、`qa/*.png`、`.chrome-qa/` 已由 `.gitignore` 排除，不要用 `-f` 强塞。

---

## 5. 提交规范

提交信息用中文，格式 `type(scope): 摘要`，一行说清改了什么。

| type | 用途 |
| --- | --- |
| `feat` | 新增能力或内容模块 |
| `fix` | 修 bug |
| `data` | 只改数据条目 / 资料口径 |
| `style` | 纯视觉调整，不改逻辑 |
| `refactor` | 重构，行为不变 |
| `docs` | README、agent.md、注释 |
| `build` | 构建 / QA / 工具脚本 |
| `chore` | 杂项 |

示例：`feat(chronicle): 增加第五纪元事件筛选与计数`

一次提交只做一件事；构建产物变化要和源码改动放在同一次提交里，避免仓库出现「源码改了但成品没更新」的状态。

---

## 6. 已知的坑

- **中文乱码不是文件坏了**。PowerShell 控制台里 `Get-Content` 可能显示成乱码，但文件本身是 UTF-8。判断内容请用读取工具，别据此「修复」编码，更不要批量转码。
- **`build.mjs` 用 `process.cwd()`**，必须在愿望目录内运行，否则会把文件读错位置或直接报缺文件。
- **`qa.mjs` 不认任意 Chrome 路径**，只查 `C:/Program Files/Google/Chrome/Application/chrome.exe` 与 `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`；报 `no chrome` 时先确认这两个路径，而不是改脚本逻辑。
- **`src/js/images.js` 约 1.7 MB**，由 `tools/process-images.py` 生成（需要 Pillow + numpy），一次性写入 base64 data URI。图片有变动才需要重跑，平时不要动它。
- **`index.html` 约 2.1 MB**，是 95 个内联 SVG 加图片的结果，属正常体积；不要为了「瘦身」把资源拆出去。
- **Windows 下路径含中文**：脚本里拼路径一律用 `path.join()`，不要手写字符串拼接。

---

## 7. 面对新愿望时

1. 先读 `提示词.md`，把验收标准写成可检查的清单（数量、宽度、错误日志、交互路径）。
2. 结构照抄现有愿望目录，先跑通「能打开的空壳」，再逐块填内容。
3. 素材优先自造（SVG / CSS），确需外部图片时下载到 `assets/` 并压缩，同时在 README 写清来源与非商业用途。
4. 做完在根 `README.md` 的许愿清单里加一行，链接到愿望目录和成品。


---

## 8. 渲染：无头浏览器只允许 GPU

**所有截图、验收、渲染都必须走 GPU，禁止退回 CPU 软件渲染（SwiftShader / llvmpipe）。** 软件渲染会把多核吃满、拖慢整台机器，跑出来的耗时数字也没有参考价值。

启动参数（Windows，Chrome / Edge 通用）：

```js
const GPU_ARGS = [
  '--headless=new',
  '--enable-gpu',
  '--use-gl=angle',
  '--use-angle=d3d11',
  '--disable-gpu-sandbox',
  '--ignore-gpu-blocklist',
  '--disable-software-rasterizer',
];
```

规则：

1. **禁止 `--disable-gpu`**；也禁止在默认路径里出现 `--enable-unsafe-swiftshader` / `--use-angle=swiftshader`。
2. 必须用 `--headless=new`，旧 headless 模式拿不到 GPU。
3. 启动后读一次 `WEBGL_debug_renderer_info`，把 renderer 字符串写进 `qa/report.json`；命中 `/swiftshader|software|llvmpipe/i` 就**直接失败**，不要「记录一下继续跑」。
4. 没有可用 GPU 时任务失败并说明原因，不要降级跑 CPU。
5. 临时截图脚本同样适用，不能因为「只是截个图」就用 CPU。

---

## 9. 协作纪律

### 最小改动

只改与本次需求直接相关的文件。禁止顺手优化、顺手重构、风格统一、大规模格式化、改无关文件。
发现无关问题时，只在回复里提出来，不动手。

### 先读后改

改之前先读，顺序固定：`dev.html` 入口 → `src/js/app.js` 装配 → 引擎 / 渲染 → `src/js/data.*.js` 数据 →
shader / css → `tools/`。不允许只看一个文件就改；跨层改动要先说明数据在各层怎么流。

### 信息不足时

先给「默认方案 + 备选方案 + 两者差异」，再问关键问题。禁止直接猜业务逻辑。

### 影响分析（本仓库口径）

涉及以下内容时，必须在回复里说明影响范围：

- `data.*.js` 的字段或条目结构（会牵动统计数字与筛选）
- URL hash / 查询参数的契约（会影响可分享链接）
- `tools/*.mjs` 的命令行参数与输出（会影响别人的验收流程）
- 键盘快捷键、无障碍行为、焦点管理
- `build.mjs` 的产物结构（是否还能双击打开、是否还有外部请求）

### 验证与说明

- 跑过验证就写清楚：命令（`node tools/build.mjs`、`node tools/qa.mjs`）、结果、有无失败项与警告。
- 没跑就写一句：「本次修改影响范围有限，未执行构建 / 验收」，并说明理由。
- 改动 `src/` 或 `dev.html` 必须重新构建产物；提交前按 §3 跑 QA。

### 异常不吞

前端不允许空 `catch`；渲染或加载失败必须给出可读的降级页或提示，控制台不留错误（与 §3 的 QA 要求一致）。

### 敏感信息与高风险操作

- 不在代码、日志、回复里出现密钥、Token、密码、手机号、身份证号等敏感信息。
- 未经明确授权，禁止 `git push --force`、`git commit --amend`、批量删除、覆盖生产配置等不可逆操作。

### Git：默认不提交

`git commit` / `git push` 只在用户明确要求时执行，提交信息按 §5 的格式。
做完改动但用户没说要提交时，把改动留在工作区并在回复里说明即可。
