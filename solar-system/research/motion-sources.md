# 四层运动的数据出处

v2 新增的四个运动数字，全部来自公开资料，抓取日期 2026-11-04。**页面上的读数必须与这张表一致**，
不得改写成「约 30 万公里每秒」这类拍脑袋说法。

| # | 运动 | 参考系 | 数值 | 出处 | 原文 |
| --- | --- | --- | --- | --- | --- |
| 1 | 行星绕太阳 | 日心 | 88 天 – 165 年 | JPL Table 1 根数 | 见 `research/SOURCES.md` 第三节 |
| 2 | 太阳相对邻近恒星（本动） | 局部静止标准 LSR | **19.4 km/s** | [NASA Sun Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html) | `Speed relative to nearby stars (km/s) = 19.4`（Sun/Earth 参数表） |
| 2b | 太阳向点方向 | 赤道 J2000 | RA `18h28m` / Dec `+30°`（武仙座，靠近织女星） | [Wikipedia: Solar apex](https://en.wikipedia.org/wiki/Solar_apex) | `Solar apex (RA) 18h 28m 00s (dec) 30°N` |
| 3 | 太阳绕银心 | 银心 | **约 220 km/s**，**约 2.4 亿年**一圈，距银心 **约 2.7 万光年（8.3 kpc）** | [Wikipedia: Milky Way](https://en.wikipedia.org/wiki/Milky_Way) | `The orbital speed of the Solar System about the center of the Milky Way is approximately 220 km/s`；`It takes the Solar System about 240 million years to complete one orbit`；`located on the inner edge of the Orion Arm at a radius of about 27,000 light-years (8.3 kpc)` |
| 4 | 太阳相对 CMB | CMB 静止系 | **369.82 ± 0.11 km/s**，朝巨爵座（Crater）与狮子座（Leo）边界方向 | Planck 2018，经 [Wikipedia: Cosmic microwave background](https://en.wikipedia.org/wiki/Cosmic_microwave_background) | `moves at 369.82 ± 0.11 km/s towards the constellation Crater near its boundary with the constellation Leo` |

## 取值区间与不确定度（必须一起写进 README）

- **银心距**：8.3 kpc（≈27,000 ly）是常用取中值；不同文献给 **7.9–8.6 kpc**（GRAVITY 2019 给 8.18 kpc，
  Reid 等给 8.3–8.4 kpc）。本页取 8.3 kpc，误差范围注明。
- **轨道速度**：维基百科正文说「典型恒星轨道速度 200–220 km/s」，太阳常被引用为 **约 220 km/s**
  （部分文献 230–240 km/s）。本页取 220。
- **银心公转周期**：同一页面同时给出 **240 Myr**（正文）与 **212 Myr**（信息框，引 Scientific American 2020）。
  本页取 **2.4 亿年**，并把 212 Myr 这个分歧写进 README。
- **CMB 偶极**：369.82 ± 0.11 km/s 是 Planck 2018 的拟合值，方向描述止于星座（巨爵座 / 狮子座边界）。
  本页取 **RA 168.0° / Dec −7.2°** 作为该方向的代表值 —— 这个方向只决定 CMB 参考系里位移的朝向，
  不参与任何天体的位置计算；量级（369.82）才是被引用的那个数。

## 单位换算（代码里用的常数）

```
1 km/s 持续 1 儒略年 = 3.15576e7 km = 0.210945 AU
1 pc                 = 206,264.806 AU
1 kpc                = 2.06264806e8 AU
银心角速度 ω = v / R = 220 km/s / 8.3 kpc = 2.71e-8 rad/yr → 周期 2.32e8 yr（与 2.4 亿年一致）
```

## 参考系怎么定义（避免重复计数）

三个参考系都是「从某个坐标原点看」的差别：

| 参考系 | 减去什么位移 | 说明 |
| --- | --- | --- |
| `sun` 太阳静止 | 不减 | v1 的日心黄道坐标，行星走闭合椭圆 |
| `galactic` 银河静止 | 太阳绕银心的圆轨道位移（只取 220 km/s 这一项） | 行星轨迹变成螺旋 |
| `cmb` CMB 静止 | 太阳相对 CMB 的总位移（369.82 km/s 一项） | 螺旋整体再漂移 |

**为什么 `cmb` 不把 220 + 19.4 再单独加上**：369.82 km/s 本身就是「绕银心 + 本动」合成的总速度
（三者不在一条直线上，220 + 19.4 ≠ 369.82）。再叠加会重复计数。

19.4 km/s 的本动只用在两处：L2 恒星邻域的位移、以及 HUD 上那个本动读数。

## 银河尺度运动的模型性质（必须标注）

- 太阳绕银心用的是**匀速圆轨道**近似：`θ(t) = ω·t`，位移是圆上的弦。
- 真实轨道有径向振荡（epicyclic）、会穿过旋臂、银心距也在缓慢变化；这些都不模拟。
- **这套公式只用于「银河尺度运动」的展示，绝不用于行星定位。** 行星定位仍走 JPL 根数，
  且严格限制在 1800–2050；时间越界时行星位置冻结在边界并在界面上标出来。
