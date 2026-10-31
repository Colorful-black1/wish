/* ============================================================
   DATA — 宇宙文明与势力
   align: friendly / neutral / hostile / ambiguous
   emblem 仅供 Art 生成原创徽记
   ============================================================ */
window.DATA_FACTIONS = [
  {
    id: 'f-m78', name: '光之国', jp: '光の国', category: '文明 · 星球', align: 'friendly',
    universe: 'M78 主宇宙', emblem: 'm78',
    desc: 'M78 星云中的光之文明，由等离子火花提供能源。居民在进化后成为光之巨人，以宇宙警备队维护星际秩序。',
    leaders: '奥特之父、奥特之母、宇宙警备队',
    goal: '维护宇宙秩序、救援受威胁的文明、守护等离子火花',
    relation: '绝大多数奥特战士的故乡，与地球长期保持联系',
    conflicts: '贝利亚之乱、安培拉星人入侵、怪兽墓场事件',
    works: ['ultraman', 'mebius', 'ultra-galaxy-legend'], status: '存续 · 主宇宙核心文明'
  },
  {
    id: 'f-garrison', name: '宇宙警备队', jp: '宇宙警備隊', category: '组织 · 军事', align: 'friendly',
    universe: 'M78 主宇宙', emblem: 'ray',
    desc: '光之国的常设防卫与救援组织，由奥特之父担任大队长、佐菲担任队长，负责巡逻、作战与星球救援。',
    leaders: '奥特之父（大队长）、佐菲（队长）',
    goal: '应对宇宙侵略与灾害，保护弱小文明',
    relation: '光之国的核心武装力量，奥特兄弟为其主力',
    conflicts: '安培拉星人战争、贝利亚越狱、怪兽军团',
    works: ['ultraman', 'seven', 'mebius'], status: '存续'
  },
  {
    id: 'f-brothers', name: '奥特兄弟', jp: 'ウルトラ兄弟', category: '组织 · 家族', align: 'friendly',
    universe: 'M78 主宇宙', emblem: 'eye',
    desc: '以佐菲、初代、赛文、杰克、艾斯、泰罗为核心的兄弟体系，后续作品亦将雷欧、阿斯特拉、梦比优斯等纳入兄弟行列。',
    leaders: '佐菲（长兄）',
    goal: '互相支援、共同守护宇宙与地球',
    relation: '光之国体制内最具情感联结的群体',
    conflicts: '亚波人、帝国星人、安培拉星人、贝利亚',
    works: ['ace', 'taro', 'mebius-movie'], status: '存续 · 成员持续扩展'
  },
  {
    id: 'f-baltan', name: '巴尔坦星人', jp: 'バルタン星人', category: '宇宙种族', align: 'hostile',
    universe: 'M78 主宇宙', emblem: 'fang',
    desc: '母星因核战争毁灭，二十亿三千万幸存者寻找新家园。拥有钳状双手、分身与护罩能力，是系列最经典的宇宙人之一。',
    leaders: '巴尔坦星人集体意志 / 各代个体',
    goal: '获取可移居的星球，延续种族',
    relation: '与光之国及地球多次冲突，也曾出现个体化的友好或中立版本',
    conflicts: '初代奥特曼、杰克、麦克斯、梦比优斯',
    works: ['ultraman', 'jack', 'max'], status: '散落宇宙 · 残党持续出现'
  },
  {
    id: 'f-reiblood', name: '雷布朗多星人', jp: 'レイブラッド星人', category: '宇宙人 · 精神体', align: 'hostile',
    universe: 'M78 / 多元宇宙', emblem: 'spiral',
    desc: '曾经支配宇宙的邪恶精神体，失去肉体后以寄生方式延续。贝利亚的堕落与“雷奥尼克斯”设定均与其相关。',
    leaders: '雷布朗多星人（精神体）',
    goal: '恢复支配宇宙的力量，寻找合适的宿主',
    relation: '与光之国为敌，是贝利亚黑暗化的直接原因',
    conflicts: '贝利亚事件、怪兽墓场、雷奥尼克斯争斗',
    works: ['ultra-galaxy-legend', 'ultra-galaxy'], status: '精神体 · 影响持续'
  },
  {
    id: 'f-belial', name: '贝利亚银河帝国', jp: 'ベリアル銀河帝国', category: '帝国 · 军事', align: 'hostile',
    universe: '另一个宇宙', emblem: 'crown',
    desc: '贝利亚在另一个宇宙建立的征服帝国，以黑暗洛普斯赛罗与庞大舰队统治行星，是赛罗电影的主要对手。',
    leaders: '贝利亚',
    goal: '征服多元宇宙，向光之国复仇',
    relation: '光之国的叛徒所建立的敌对帝国',
    conflicts: '赛罗、终极赛罗警备队、光之国',
    works: ['zero-movie', 'ultra-galaxy-legend'], status: '已崩溃 · 贝利亚残党仍存'
  },
  {
    id: 'f-empera', name: '安培拉星人暗黑军团', jp: 'エンペラ星人', category: '军势 · 侵略', align: 'hostile',
    universe: 'M78 主宇宙', emblem: 'skull',
    desc: '安培拉星人率领的暗黑军团，约三万年前与光之国爆发奥特大战争；其目标是让宇宙陷入永恒的黑暗。',
    leaders: '安培拉星人、黑暗四天王',
    goal: '熄灭光之国的光，统治宇宙',
    relation: '光之国的远古宿敌',
    conflicts: '奥特大战争、梦比优斯最终决战',
    works: ['mebius', 'mebius-movie'], status: '被击败 · 影响延续'
  },
  {
    id: 'f-darkgiants', name: '超古代黑暗巨人', jp: '超古代の闇の巨人', category: '古代势力', align: 'hostile',
    universe: '迪迦 · 戴拿宇宙', emblem: 'shard',
    desc: '三千万年前与迪迦同为黑暗巨人的卡蜜拉、达拉姆、希特拉。被迪迦封印后于现代苏醒，追讨背叛之债。',
    leaders: '卡蜜拉',
    goal: '夺回黑暗力量，让世界重回黑暗',
    relation: '迪迦的旧日同伴与宿敌',
    conflicts: '迪迦、GUTS',
    works: ['tiga', 'tiga-final'], status: '被击败 / 封印'
  },
  {
    id: 'f-radical', name: '根源性破灭招来体', jp: '根源的破滅招来体', category: '宇宙意志 · 威胁', align: 'hostile',
    universe: '盖亚地球', emblem: 'eye',
    desc: '《盖亚奥特曼》中试图毁灭人类文明的未知存在，派出怪兽与使者，其本质与目的始终未被完全说明。',
    leaders: '不明（以使者与怪兽代行）',
    goal: '抹除被视为威胁的人类文明',
    relation: '与地球意志、盖亚和阿古茹对立',
    conflicts: '盖亚、阿古茹、XIG',
    works: ['gaia'], status: '被阻止 · 本体不明'
  },
  {
    id: 'f-sphere', name: '斯菲亚', jp: 'スフィア', category: '宇宙生命体', align: 'hostile',
    universe: '迪迦 · 戴拿宇宙 / 德凯宇宙', emblem: 'spiral',
    desc: '以群体形式行动的宇宙生命体，能够附身、融合怪兽并封锁行星。在《戴拿》与《德凯》中都是宇宙级威胁。',
    leaders: '斯菲亚母体 / 群体意志',
    goal: '同化与扩张',
    relation: '与人类及奥特曼敌对',
    conflicts: '戴拿、德凯、Super GUTS、GUTS-SELECT',
    works: ['dyna', 'decker'], status: '多次被击退 · 仍存在'
  },
  {
    id: 'f-mafiras', name: '美菲拉斯星人', jp: 'メフィラス星人', category: '宇宙人 · 多重立场', align: 'ambiguous',
    universe: 'M78 主宇宙 / 新·奥特曼', emblem: 'diamond',
    desc: '智商极高的宇宙人，擅长以谈判与心理战取代直接战斗。不同作品中立场差异极大：既有侵略者，也有理性的对话者。',
    leaders: '各版本个体',
    goal: '因版本而异：获取地球、验证人类的可能性、维持势力平衡',
    relation: '与奥特曼亦敌亦友，常作为“另一种智慧”出现',
    conflicts: '初代奥特曼、新·奥特曼中的祸特对',
    works: ['ultraman', 'shin'], status: '多重版本 · 不可合并为同一经历'
  },
  {
    id: 'f-absolute', name: '阿布索留特一族', jp: 'アブソリュート族', category: '究极生命体', align: 'hostile',
    universe: '多元宇宙', emblem: 'crown',
    desc: '《奥特银河格斗》系列中登场的究极生命体族群，以塔尔塔洛斯为首，试图通过操纵时间线重建王国的荣光。',
    leaders: '阿布索留特·塔尔塔洛斯',
    goal: '复兴阿布索留特王国，改写多元宇宙秩序',
    relation: '与光之国及新生代英雄全面敌对',
    conflicts: '《奥特银河格斗》系列、雷古洛斯相关事件',
    works: ['regulos'], status: '对峙中'
  },
  {
    id: 'f-tpu', name: 'TPU / GUTS-SELECT', jp: 'TPU / GUTS-SELECT', category: '人类组织 · 防卫', align: 'friendly',
    universe: '特利迦 · 德凯宇宙', emblem: 'ray',
    desc: '地球和平同盟 TPU 与其日本支部精英胜利队，负责超古代遗迹调查、怪兽对策与奥特曼支援。',
    leaders: '静间光国、辰巳诚也等',
    goal: '保护地球与火星殖民地，研究超古代文明',
    relation: '与特利迦、德凯并肩作战',
    conflicts: '黑暗巨人、斯菲亚',
    works: ['trigger', 'decker'], status: '存续'
  },
  {
    id: 'f-skard', name: 'SKaRD', jp: '特殊怪対応分遣隊', category: '人类组织 · 防卫', align: 'friendly',
    universe: '布莱泽宇宙', emblem: 'shard',
    desc: 'GGF 下属的特殊怪兽对应分遣队，以少数精锐与怪兽灾害对抗，队长比留间弦人即布莱泽的人间体。',
    leaders: '比留间弦人',
    goal: '应对怪兽灾害，理解怪兽生态',
    relation: '与布莱泽协作，但保持组织独立性',
    conflicts: '宇宙怪兽、地球怪兽',
    works: ['blazar', 'blazar-movie'], status: '存续'
  },
  {
    id: 'f-kaijutai', name: '怪特队', jp: '怪特隊', category: '人类组织 · 调查', align: 'friendly',
    universe: '奥美迦宇宙', emblem: 'eye',
    desc: '《奥美迦奥特曼》中的怪兽特殊对策队，下设九个实战班与特务班“宇多班”，兼顾灾害应对与怪兽研究。',
    leaders: '宇多班班长（天才科学家）',
    goal: '调查怪兽现象、保护民众、理解奥特曼',
    relation: '与奥美迦（宙人）从观测对象逐渐发展为协作关系',
    conflicts: '接连出现的怪兽与相关威胁',
    works: ['omega'], status: '存续'
  },
  {
    id: 'f-uttf', name: 'UTTF', jp: '未確認脅威対策本部', category: '国际组织 · 调查', align: 'friendly',
    universe: '提欧宇宙', emblem: 'm78',
    desc: '《提欧奥特曼》中由联合国与 NASA 共同成立的国际机构“未确认威胁对策本部”，派员调查日本出现的巨大生物。',
    leaders: 'UTTF 调查员',
    goal: '查明怪兽来源、评估威胁、协调国际应对',
    relation: '与明心大学研究者、天文研究社产生交集',
    conflicts: '巨型生物与宇宙怪兽',
    works: ['teo'], status: '存续 · 活动中'
  }
];
