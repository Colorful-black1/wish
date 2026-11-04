# 星表来源记录：HYG（恒星背景层）

本文件记录 `src/js/data.stars.js` 这份恒星数据的来处、许可、截断口径与编码方式。
生成脚本：`tools/fetch-stars.mjs`（零依赖，只用 Node 内置模块）。

------

## 一、抓的是什么

| 项目 | 值 |
| --- | --- |
| 星表 | HYG Database（HYG 星表档案） |
| 版本 | **v4.0**（`hygdata_v40.csv.gz`） |
| 仓库 | https://github.com/astronexus/HYG-Database |
| 文件路径（仓库内） | `hyg/CURRENT/hygdata_v40.csv.gz` |
| 直链 | https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v40.csv.gz |
| 压缩包大小 | 13,636,420 bytes（13.6 MB gz） |
| 解压后大小 | 33,932,465 bytes（UTF-8 CSV） |
| 数据行数 | 119,626 行（不含表头，共 37 列） |
| 抓取时间 | 2026-11-04 11:59:25（Asia/Shanghai，UTC+8）= `2026-11-04T03:59:25.942Z` |
| 本地缓存 | `research/_raw/hygdata_v40.csv.gz`（脚本命中缓存就不再联网） |

**为什么不是任务书里写的 "HYG v3"**：任务书给的 37 个字段
（`id,hip,hd,hr,gl,bf,proper,ra,dec,dist,pmra,pmdec,rv,mag,absmag,spect,ci,x,y,z,vx,vy,vz,rarad,decrad,pmrarad,pmdecrad,bayer,flam,con,comp,comp_primary,base,lum,var,var_min,var_max`）
与 v4.0 的实测表头**逐字一致**，且仓库 `hyg/CURRENT/` 下的现行压缩包就是 `hygdata_v40.csv.gz`（`hyg_v41.csv` 是未压缩的新版，本任务未采用）。
v3.8（`hyg/v3/hyg_v38.csv.gz`）只作兜底，本次**没有用到**。因此 `meta.source` 如实记为 `'HYG Database v4'`、`version` 记为 `'4.0'`；
若下游一定要 `'HYG Database v3'` 这个字符串，改 `tools/fetch-stars.mjs` 里 `CATALOGS[0].source` 一处即可，数据本身不用动。

兜底顺序（脚本内）：先读 `research/_raw/hygdata_v40.csv.gz`，没有或不是合法 gzip 才下载 v4.0；v4.0 下载失败才退到 v3.8。
两者字段结构相同，脚本按表头取列，不依赖列序。

------

## 二、许可（原文照录）

v4.x 星表的 LICENSE 原文（仓库根 `LICENSE` 与 `hyg/CURRENT/LICENSE` 内容完全相同，各 422 bytes、逐字节一致）：

```text
Shield: [![CC BY-SA 4.0][cc-by-sa-shield]][cc-by-sa]

This work is licensed under a
[Creative Commons Attribution-ShareAlike 4.0 International License][cc-by-sa].

[![CC BY-SA 4.0][cc-by-sa-image]][cc-by-sa]

[cc-by-sa]: http://creativecommons.org/licenses/by-sa/4.0/
[cc-by-sa-image]: https://licensebuttons.net/l/by-sa/4.0/88x31.png
[cc-by-sa-shield]: https://img.shields.io/badge/License-CC%20BY--SA%204.0-lightgrey.svg
```

也就是说，**本数据按 CC BY-SA 4.0（Creative Commons Attribution-ShareAlike 4.0 International）授权**；
`data.stars.js` 里 `meta.license` 记的短名就是 `'CC BY-SA 4.0'`。

仓库 `hyg/README.md` 的对应原文：

> This work is licensed under a
> [Creative Commons Attribution-ShareAlike 4.0 International License][cc-by-sa].

同一份 README 还写明旧版本（HYG 2.x / 3.x，即 `hyg/v2`、`hyg/v3` 目录）：

> As noted above, these have been licensed under Creative Commons BY-SA-2.5.

**注意：如果哪天真退到 v3.8 兜底，许可要跟着改成 CC BY-SA 2.5**（脚本里两套 catalog 各自带 `license` 字段，会自动写对）。
本目录只做事实引用与学习用途，使用时请保留出处并按 BY-SA 署名/相同方式共享。

------

## 三、截断与筛选

| 步骤 | 结果 |
| --- | --- |
| 读入数据行 | 119,626 |
| `ra` / `dec` 为空或非有限数 | 0 行被丢 |
| `mag > 6.50` | 丢 110,705 行 |
| 太阳行（`id = 0`、`proper = "Sol"`、`ra = 0`、`dec = 0`、`mag = −26.7`） | 丢 1 行 |
| **保留** | **8,920 颗** |

- 截断星等：**V ≤ 6.50**（裸眼极限）。没有为了压体积再抬高一档，b64 只有 95 KB，离 400 KB 上限很远。
- **为什么丢太阳**：HYG 第 0 行是太阳本身（观测者），不是背景恒星。它 `ra = 0 / dec = 0`，`mag = −26.7`；
  若保留，编码时 `w2 = −26.7×100 + 2000 = −670` 会被夹到 `0`，等于在春分点放一颗 mag 0 的假亮星 —— 这是数据错误，不是取舍。
- 其余一行不删：不做邻星合并、不做双星去重、不按 `dist` 过滤。
- 缺 `ci` 的星有 40 颗，B−V 记为 **0.00**（中性白），在编码里就是 5000。

------

## 四、字段映射（HYG → 我们的 4 个 uint16）

每颗星 4 个小端 uint16，8 bytes；`n × 4` 的 `Uint16Array` 直接 base64。

| 字 | HYG 字段 | 含义 | 公式 | 理论范围 | 解码 |
| --- | --- | --- | --- | --- | --- |
| `w0` | `ra` | 赤经，**小时** 0–24 | `round(ra × 15 × 100)` | 0 – 36,000 | `raDeg = w0 / 100` |
| `w1` | `dec` | 赤纬，**度** −90–+90 | `round(dec × 100) + 9000` | 0 – 18,000 | `decDeg = (w1 − 9000) / 100` |
| `w2` | `mag` | V 星等 | `round(mag × 100) + 2000` | ≈1,856 – 2,650 | `mag = (w2 − 2000) / 100` |
| `w3` | `ci` | B−V 色指数 | `ci` 先夹到 `[−1, 4]`，再 `round(ci × 100) + 5000` | 4,900 – 5,400 | `B−V = (w3 − 5000) / 100` |

- 每个值最后再夹进 `[0, 65535]`，保证 `Uint16Array` 不越界（实测没有触发）。
- 小数位：RA / Dec **0.01°**（= 36″），星等 0.01，B−V 0.01。对 6.5 等的星图来说远超屏幕像素精度。
- 字节序：小端。脚本在写入前检查 `os.endianness()`，非 LE 主机上会先做字节交换，产物在任何机器上都一致。
- **排列**：按 `ra` 升序（同 RA 再按 dec、mag 排，保证可重复）。运行时可以二分查找按天区取星。

体积：

| 项 | 数值 |
| --- | --- |
| 星数 `n` | 8,920 |
| 原始字节 | 71,360（8,920 × 8） |
| **base64 字节** | **95,148**（上限 409,600，未触及） |
| `src/js/data.stars.js` | **100,251 bytes**（UTF-8，无 BOM，LF 换行） |

------

## 五、只用了四个量，坐标不重投影

**只内联 `RA / Dec / Vmag / B−V` 四个字段。** `dist`、`pmra`、`pmdec`、`rv`、`spect`、`absmag`、`lum`、`var` 等一律丢弃，不进产物。

坐标口径：

1. 位置是 **J2000 赤道坐标**（HYG README 原文：*"the star's right ascension and declination, for epoch and equinox 2000.0"*）。
2. **构建期不做任何再投影**：没有转黄道坐标、没有转银道坐标、没有加自行、没有加周年视差。
   编码进去的就是星表原始赤经赤纬（换算成度、保留两位小数）。
3. 运行时才由 `astro.js` 用黄赤交角 ε = 23.43928° 转到**黄道坐标**（本页场景是黄道系）。
   星空只随相机朝向旋转，**不随模拟日期变化** —— 周年视差最大约 0.77″，不在本页的表现范围里，也不该伪造。
4. 赤经按 `ra × 15` 换成度；`ra` 在 HYG 里就是小时（0–24），不是弧度（弧度在 `rarad` 字段，未使用）。

------

## 六、名字表 `names`

- 条件：`proper` 非空 **且** `mag ≤ 3.50`；产出 `[starIndex, 'Name']` 二元组，`starIndex` 是排序后数组的下标。
- 实际入选 **188 条**（上限 200 未触发，因此没有做"只留最亮 200"的裁剪）。
- 顺序按 `starIndex` 升序，方便运行时按下标对齐。
- 若同名出现在多颗星上（双星系统），报告里取其中最亮的一颗；`names` 本身不重复合并。
- 这些名字只用于定位与标注（猎户座腰带三星、北斗七星、天狼星等），不参与亮度/位置计算。

------

## 七、核对结果（来自编码后的 `b64` 解码，不是解析中间值）

| 名称 | index | RA (°) | Dec (°) | Vmag | B−V |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sirius 天狼 | 2457 | 101.29 | −16.72 | −1.44 | 0.01 |
| Betelgeuse 参宿四 | 2074 | 88.79 | +7.41 | 0.45 | 1.50 |
| Polaris 北极星 | 775 | 37.95 | +89.26 | 1.97 | 0.64 |
| Vega 织女一 | 6896 | 279.23 | +38.78 | 0.03 | 0.00 |
| Alnitak 参宿一 | 1963 | 85.19 | −1.94 | 1.74 | −0.20 |
| Alnilam 参宿二 | 1920 | 84.05 | −1.20 | 1.69 | −0.18 |
| Mintaka 参宿三 | 1875 | 83.00 | −0.30 | 2.25 | −0.17 |
| Dubhe 天枢 | 4242 | 165.93 | +61.75 | 1.81 | 1.06 |
| Mizar 开阳 | 4984 | 200.98 | +54.93 | 2.23 | 0.06 |
| Alkaid 摇光 | 5117 | 206.89 | +49.31 | 1.85 | −0.10 |

断言（脚本内每次运行都跑，失败会以退出码 1 结束）：

- [x] 星数 8,920，落在预期区间 8,000–12,000；
- [x] Sirius 星等 −1.44（期望 −1.44 ± 0.02）；
- [x] Polaris 赤纬 +89.26°（期望 +89.26 ± 0.05）；
- [x] b64 95,148 bytes < 409,600 bytes；
- [x] 上述 10 颗参考星全部出现在 `names` 里。

口径小注：

- Alnitak 在 HYG v4.0 里记的是 **1.74**，部分资料给 Aa 分量 1.77 —— 0.03 的差属于星表口径差异，这里照 HYG 原值，不改数。
- 星等取 HYG 的 `mag`（V 波段视星等），没有做消光改正，也没有把多星系统拆开重算合成星等。

------

## 八、复现

```powershell
cd solar-system
node tools/fetch-stars.mjs
```

- 首次运行下载 13.6 MB gz 到 `research/_raw/hygdata_v40.csv.gz`；之后命中缓存，**完全离线**也能重跑。
- 唯一运行时产物是 `src/js/data.stars.js`（约 100 KB），页面双击即开，不再需要任何网络请求。
- 脚本会打印：星数、b64 字节数、原始字节数、最小/最大星等、命名星条数、10 颗参考星的解码坐标、以及上面 5 条断言的 PASS/FAIL。
