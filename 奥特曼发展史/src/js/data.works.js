/* ============================================================
   DATA — 现实世界发行史：作品档案
   资料口径：日本首播 / 首映日期；日期不明者只写年份。
   数据与渲染分离，新增作品只需在 WORKS 中追加一条记录。
   ============================================================ */
window.DATA_PHASES = [
  { id: 'origin',   name: '系列诞生',       en: 'ORIGIN',        years: '1966 — 1967', range: [1966, 1967], desc: '《奥特 Q》开启圆谷怪兽特摄，《奥特曼》确立“巨大光之巨人”公式，《赛文奥特曼》转向硬科幻与谍战叙事。' },
  { id: 'golden',   name: '昭和黄金期',     en: 'GOLDEN AGE',    years: '1971 — 1975', range: [1971, 1975], desc: '《归来的奥特曼》重启系列，“奥特兄弟”体系在《艾斯》《泰罗》中确立，《雷欧》以格斗与悲剧色彩收束第一期热潮。' },
  { id: 'late',     name: '调整与动画',     en: 'TRANSITION',    years: '1979 — 1984', range: [1979, 1984], desc: '电视系列以动画《乔尼亚斯》与《爱迪》延续，随后进入长达十余年的电视空白期，转向电影、OV 与海外合作。' },
  { id: 'heisei',   name: '平成新生',       en: 'HEISEI REBIRTH',years: '1987 — 1999', range: [1987, 1999], desc: '海外合作与 OV 维持火种；《迪迦》重启电视系列并开创“类型转换”，TDG 三部作把平成奥特曼推向高峰。' },
  { id: 'millennium', name: '新世纪探索',   en: 'MILLENNIUM',    years: '2000 — 2008', range: [2000, 2008], desc: '《高斯》《奈克瑟斯》《麦克斯》《梦比优斯》各自试验不同叙事与受众，40 周年作回到昭和世界观。' },
  { id: 'newgen',   name: '新生代英雄',     en: 'NEW GENERATION',years: '2009 — 2019', range: [2009, 2019], desc: '《超银河传说》推出赛罗，电影与网络作品扩张；“新生代英雄”以半年番与玩具联动形成新的系列节奏。' },
  { id: 'reiwa',    name: '令和与 60 周年', en: 'REIWA / 60TH',  years: '2020 — 2026', range: [2020, 2026], desc: '《泽塔》起进入令和年代，作品持续探索怪兽共生、宇宙威胁与多元世界；2025 年《奥美迦》、2026 年 60 周年作《提欧》接力。' }
];

window.DATA_WORK_TYPES = ['TV', '剧场版', 'OVA', '网络', '特别篇'];

window.DATA_WORKS = [
  {
    id: 'ultra-q', title: '奥特 Q', jp: 'ウルトラQ', en: 'ULTRA Q', year: 1966,
    date: '1966.01.02 – 1966.07.03', type: 'TV', phase: 'origin', heroes: [],
    synopsis: '没有巨大英雄登场，只有接连出现的怪兽、怪事件与超自然现象；每一集以普通人的视角，记录日本列岛遭遇的未知。',
    significance: '圆谷特撮“怪兽路线”的起点，也是《奥特曼》诞生的直接前身。它证明“怪兽本身”足以支撑一部电视作品。',
    innovation: '首次在日本电视中系统使用高密度特摄美术与微缩布景，确立“空想特撮”类型；黑白影像反而强化了未知感。',
    related: ['ultraman'],
    detail: {
      world: '现代日本，怪兽被视为突然出现的异常生物，尚无成体系的防卫组织，调查多由科学机构与记者完成。',
      chars: '万城目淳、江户川由利子、一户博士等调查者；每集以独立怪事件展开。',
      foes: '哥美斯、拉贡、贝吉拉、凯姆尔人等经典怪兽与宇宙人。',
      impact: '为《奥特曼》积累的怪兽设计、特摄班底与观众基础，使“光之巨人”得以在半年后登场。',
      links: '与《奥特曼》共享“空想特撮系列”框架，但两者世界观并不完全等同。'
    }
  },
  {
    id: 'ultraman', title: '奥特曼', jp: 'ウルトラマン', en: 'ULTRAMAN', year: 1966,
    date: '1966.07.17 – 1967.04.09', type: 'TV', phase: 'origin', heroes: ['ultraman'],
    synopsis: '来自 M78 星云光之国的宇宙人，与科学特搜队队员早田进合为一体，为守护地球与怪兽、宇宙人战斗。',
    significance: '系列的原点。它确立了“人间体 + 变身 + 三分钟时限 + 光线必杀”的基本语法，并塑造了巴尔坦星人、杰顿等跨世代符号。',
    innovation: '彩色特摄与巨型英雄的结合；以“斯派修姆光线”与彩色计时器把战斗转化为可视觉化的能量叙事。',
    related: ['ultra-q', 'seven', 'return-ultraman', 'mebius'],
    detail: {
      world: '20 世纪 60 年代的地球，科学特搜队（科特队）负责应对怪兽与宇宙人；M78 星云光之国是奥特曼的故乡。',
      chars: '早田进（人间体）、村松敏夫队长、富士明子、岚大助、井手光弘。',
      foes: '巴尔坦星人、贾米拉、杰顿、希多拉、雷德王等。',
      impact: '最高收视率突破 40%，直接引爆日本第一次怪兽热潮，也让圆谷制作成为特摄代表厂牌。',
      links: '后续《赛文》《归来的奥特曼》逐步把“奥特兄弟”与光之国体系补完。'
    }
  },
  {
    id: 'seven', title: '赛文奥特曼', jp: 'ウルトラセブン', en: 'ULTRASEVEN', year: 1967,
    date: '1967.10.01 – 1968.09.08', type: 'TV', phase: 'origin', heroes: ['seven'],
    synopsis: '来自 M78 星云的恒星观测员，化身为人间体诸星团加入奥特警备队，对抗侵略地球的宇宙人与怪兽。',
    significance: '系列第一次“换型”：从巨大英雄对战转向带有冷战隐喻的宇宙谍战与硬科幻，是昭和时期评价最高的作品之一。',
    innovation: '引入“奥特眼镜”变身、胶囊怪兽与地球防卫军体系；大量使用主观镜头与悬疑结构，拓展了特摄的叙事边界。',
    related: ['ultraman', 'heisei-seven', 'leo', 'zero'],
    detail: {
      world: '近未来的地球，奥特警备队（UG）承担宇宙人入侵对策；宇宙中已存在多个文明与星际政治。',
      chars: '诸星团（赛文）、友里安奴、桐山队长、古桥、索加等 UG 队员。',
      foes: '戈斯星人、庞敦、梅特隆星人、金古桥等。',
      impact: '奠定“宇宙人侵略”叙事与防卫队模式，其结局与后续 OV 系列让赛文成为昭和世界观中线索最长的角色之一。',
      links: '1994 年起推出《平成赛文》系列 OV，2007 年《ULTRASEVEN X》为 40 周年纪念作。'
    }
  },
  {
    id: 'return-ultraman', title: '归来的奥特曼', jp: '帰ってきたウルトラマン', en: 'RETURN OF ULTRAMAN', year: 1971,
    date: '1971.04.02 – 1972.03.31', type: 'TV', phase: 'golden', heroes: ['jack'],
    synopsis: '青年乡秀树为救少年而死，被新的奥特曼赋予生命并与之合体，加入怪兽攻击队 MAT 守护地球。',
    significance: '系列在三年空白后重启，确立“奥特兄弟”概念，并让初代与赛文客串，首次把昭和作品连成同一世界观。',
    innovation: '强化人间体的成长线与青春剧色彩；以“乡秀树的苦恼”把英雄力量表现为责任而非特权。',
    related: ['ultraman', 'seven', 'ace', 'taro'],
    detail: {
      world: '昭和日本，MAT 作为地球防卫组织；M78 光之国的奥特兄弟体系逐渐成形。',
      chars: '乡秀树（杰克）、坂田秋子、次郎、伊吹队长与 MAT 队员。',
      foes: '纳克尔星人、布莱克王、泽朗星人、萨沃尔斯王三世等。',
      impact: '“奥特兄弟”设定使系列从单元剧转向可持续的家族叙事，为《艾斯》《泰罗》的群像路线铺路。',
      links: '杰克在《梦比优斯》《超银河传说》等后续作品中持续回归。'
    }
  },
  {
    id: 'ace', title: '艾斯奥特曼', jp: 'ウルトラマンA', en: 'ULTRAMAN ACE', year: 1972,
    date: '1972.04.07 – 1973.03.30', type: 'TV', phase: 'golden', heroes: ['ace'],
    synopsis: '异次元人亚波人制造“超兽”侵略地球，两位青年合体成为艾斯奥特曼，加入 TAC 迎战。',
    significance: '“奥特兄弟”正式定名，系列进入群像与合体变身时代；超兽设定把怪兽威胁升级为异次元战争。',
    innovation: '双人合体变身、斷头刀与光线技的多样化；以“孩子们的愿望”作为重要叙事装置。',
    related: ['return-ultraman', 'taro', 'mebius'],
    detail: {
      world: '昭和地球，TAC 负责超兽对策；异次元人亚波人构成跨集数的持续威胁。',
      chars: '北斗星司、南夕子（前期共同变身）、龙五郎队长与 TAC 队员。',
      foes: '亚波人、超兽巴拉巴、贝劳克恩、艾斯杀手等。',
      impact: '确立“奥特兄弟”集体作战的传统，也让“敌人是文明/军势”而非单只怪兽成为可能。',
      links: '亚波人与超兽在后续《梦比优斯》等作品中再度登场。'
    }
  },
  {
    id: 'taro', title: '泰罗奥特曼', jp: 'ウルトラマンタロウ', en: 'ULTRAMAN TARO', year: 1973,
    date: '1973.04.06 – 1974.04.05', type: 'TV', phase: 'golden', heroes: ['taro'],
    synopsis: '奥特之父与奥特之母之子泰罗来到地球，与青年东光太郎合体，加入 ZAT 对抗怪兽与宇宙人。',
    significance: '“奥特家族”路线的顶点，系列首次以明确的家庭关系与喜剧基调塑造主角，成为当时儿童观众的核心记忆。',
    innovation: '大量使用夸张喜剧与家庭剧元素；泰罗的“奥特之角”与合体技拓展了英雄能力表现。',
    related: ['ace', 'leo', 'mebius'],
    detail: {
      world: '昭和地球与光之国两地展开，ZAT 为民间色彩浓厚的防卫队。',
      chars: '东光太郎（泰罗）、白鸟健一、森山泉、朝日奈队长等。',
      foes: '巴尔基星人、帝国星人、泰兰特、古兰特王等。',
      impact: '把“光之国也是一个有家庭的文明”具体化，为后续奥特兄弟的辈分与关系提供基础。',
      links: '泰罗在《梦比优斯》《超银河传说》中作为教官与兄长角色持续出现。'
    }
  },
  {
    id: 'leo', title: '雷欧奥特曼', jp: 'ウルトラマンレオ', en: 'ULTRAMAN LEO', year: 1974,
    date: '1974.04.12 – 1975.03.28', type: 'TV', phase: 'golden', heroes: ['leo'],
    synopsis: '故乡 L77 星被马格马星人毁灭的雷欧来到地球，与格斗家凤源合体，在赛文的指导下守护地球。',
    significance: '系列最黑暗的一作：以“失去故乡”的主角、接连牺牲的队友与硬派格斗，完成了昭和奥特曼的成人化尝试。',
    innovation: '强调肉搏与修炼，弱化光线；赛文以“训练者”身份退居幕后，形成师徒叙事。',
    related: ['seven', 'taro', 'eighty'],
    detail: {
      world: '昭和地球，MAC 队承担防卫；宇宙中 L77 星的毁灭是主角创伤的源头。',
      chars: '凤源（雷欧）、诸星团（赛文）、百子、通君、MAC 队员。',
      foes: '马格马星人、孪生怪兽、阿托拉星人、普雷夏等。',
      impact: '虽然当时收视与商业表现承压，但其悲剧性与格斗演出在后世评价持续上升，成为“被重新发现的杰作”。',
      links: '雷欧的弟弟阿斯特拉与 L77 的设定在后续作品中补完。'
    }
  },
  {
    id: 'the-ultraman', title: '乔尼亚斯奥特曼', jp: 'ザ☆ウルトラマン', en: 'THE ULTRAMAN', year: 1979,
    date: '1979.04.04 – 1980.03.26', type: 'TV', phase: 'late', heroes: ['joneus'],
    synopsis: '首部奥特曼电视动画：光之国的乔尼亚斯与地球科学家团队并肩，对抗威胁地球的宇宙侵略者。',
    significance: '系列唯一的长篇电视动画，证明奥特曼的叙事可以脱离特摄皮套与微缩布景独立成立。',
    innovation: '以动画自由表现宇宙舰队战与巨大尺度；引入“科学警备队”与更连续的剧情线。',
    related: ['eighty', 'usa'],
    detail: {
      world: '近未来地球与宇宙，科学警备队与光之国建立协作关系。',
      chars: '乔尼亚斯、光超一郎、科学警备队成员。',
      foes: '宇宙恐龙、巴拉达星人等宇宙侵略势力。',
      impact: '为后续动画与海外合作项目提供经验；乔尼亚斯也成为光之国体系中的正式成员。',
      links: '与实拍昭和系列共享 M78 设定，但世界观细节相对独立。'
    }
  },
  {
    id: 'eighty', title: '爱迪奥特曼', jp: 'ウルトラマン80', en: 'ULTRAMAN 80', year: 1980,
    date: '1980.04.02 – 1981.03.25', type: 'TV', phase: 'late', heroes: ['eighty'],
    synopsis: '光之国的中学教师矢的猛化身人类教师，加入 UGM，在校园与战场之间对抗由人类负能量催生的怪兽。',
    significance: '昭和电视系列的最后一部。它把“怪兽源于人心”的主题推到前台，并以学园剧结构收束了一个时代。',
    innovation: '教师身份与校园日常的大量描写；负能量怪兽设定让敌人与人类社会直接相关。',
    related: ['leo', 'mebius', 'the-ultraman'],
    detail: {
      world: '昭和日本，UGM 负责怪兽对策；怪兽多与人类的嫉妒、愤怒等负面情绪相关。',
      chars: '矢的猛（爱迪）、城野惠美、伊藤主任、原田等 UGM 队员。',
      foes: '负能量怪兽、加莫斯、霍、巴尔坦星人五世等。',
      impact: '《爱迪》结束后，电视系列中断十六年，系列转入电影、OV 与海外合作。',
      links: '《梦比优斯》以“昭和世界观续篇”的姿态重新连接《爱迪》以来的空白。'
    }
  },
  {
    id: 'ultraman-story', title: '奥特曼物语', jp: 'ウルトラマン物語', en: 'ULTRAMAN STORY', year: 1984,
    date: '1984.03.17', type: '剧场版', phase: 'late', heroes: ['taro', 'ultraman', 'seven'],
    synopsis: '以泰罗的成长为主线，串联初代、赛文等前辈的经典战役，是昭和奥特曼的第一次大银幕总集篇。',
    significance: '系列首部正式剧场版动画（以既有影像重构），证明“奥特曼”可以在电影院成立。',
    innovation: '将电视影像重新剪辑并加入新作画面，形成面向家庭观众的剧场体验。',
    related: ['taro', 'zoffy-1984', 'ultraman'],
    detail: {
      world: '光之国训练场与地球战场交替，属于昭和世界观的总括性叙述。',
      chars: '泰罗、奥特之父、奥特之母、初代、赛文等。',
      foes: '古兰特王等历代强敌的再构成。',
      impact: '开启奥特曼剧场版传统，为 1990 年代以后的电影项目铺路。',
      links: '与同年上映的《佐菲 奥特战士 VS 大怪兽军团》共同构成 1984 年影院双片。'
    }
  },
  {
    id: 'zoffy-1984', title: '佐菲 奥特战士 VS 大怪兽军团', jp: 'ウルトラマンZOFFY ウルトラの戦士VS大怪獣軍団', en: 'ULTRAMAN ZOFFY', year: 1984,
    date: '1984.03.17', type: '剧场版', phase: 'late', heroes: ['zoffy'],
    synopsis: '以佐菲为叙述者，回顾奥特战士与大怪兽军团的战斗，并补完光之国与奥特兄弟的设定。',
    significance: '佐菲首次作为剧场版核心角色，强化了“宇宙警备队队长”的职位设定。',
    innovation: '以总集篇 + 新作画面的形式整理昭和世界观，是早期“设定整合”型电影。',
    related: ['ultraman-story', 'ultraman'],
    detail: {
      world: 'M78 光之国与历代地球战场。',
      chars: '佐菲、奥特之父、奥特兄弟。',
      foes: '大怪兽军团、帝国星人等。',
      impact: '让佐菲从“救援者”升格为可独立叙述的角色。',
      links: '与《奥特曼物语》同日上映。'
    }
  },
  {
    id: 'usa', title: '美国奥特曼', jp: 'ウルトラマンUSA', en: 'ULTRAMAN: THE ADVENTURE BEGINS', year: 1987,
    date: '1987.10.12（美国电视）/ 1989.04.28（日本剧场）', type: '剧场版', phase: 'heisei', heroes: [],
    synopsis: '三位美国奥特曼史考特、查克、贝丝在北美与怪兽战斗，是圆谷面向海外市场的动画电影。',
    significance: '系列首次以美国为舞台、以三位奥特曼组队的形式展开，标志海外合作时代的开始。',
    innovation: '动画形式 + 美式英雄团队结构；日本于 1989 年以剧场版形式公映。',
    related: ['the-ultraman', 'great', 'powered'],
    detail: {
      world: '美国，军方与科学机构共同应对怪兽；三位奥特曼来自 M78 光之国。',
      chars: '史考特、查克、贝丝及地球搭档。',
      foes: '怪兽与宇宙侵略者。',
      impact: '为《葛雷》《帕瓦特》等海外合作实拍作品打开通路。',
      links: '与日本昭和系列共享 M78 设定，但剧情独立。'
    }
  },
  {
    id: 'great', title: '葛雷奥特曼', jp: 'ウルトラマンG', en: 'ULTRAMAN: TOWARDS THE FUTURE', year: 1990,
    date: '1990.09.25 – 1991.06.27（OVA）', type: 'OVA', phase: 'heisei', heroes: ['great'],
    synopsis: '澳大利亚与日本合作制作，葛雷奥特曼与地球防卫队迎战因环境破坏而出现的怪兽。',
    significance: '电视空白期的重要火种，证明系列可以通过 OV 与海外合作维持生命。',
    innovation: '全片在澳大利亚取景，环境议题浓厚；日本于 1995 年电视播出。',
    related: ['usa', 'powered', 'zearth'],
    detail: {
      world: '澳大利亚，环境问题与怪兽出现相互关联。',
      chars: '葛雷、杰克·辛多（人间体）与防卫队成员。',
      foes: '污染相关怪兽与宇宙生命体。',
      impact: '为后续海外合作与《帕瓦特》提供制作模式。',
      links: '与昭和世界观有设定联系，但剧中几乎不强调。'
    }
  },
  {
    id: 'powered', title: '帕瓦特奥特曼', jp: 'ウルトラマンパワード', en: 'ULTRAMAN: THE ULTIMATE HERO', year: 1993,
    date: '1993.12.05 – 1994.08.25（OVA）', type: 'OVA', phase: 'heisei', heroes: ['powered'],
    synopsis: '美国与日本合作，帕瓦特奥特曼在美国与怪兽战斗；以更写实的质感重制初代经典怪兽。',
    significance: '海外合作的第二弹，把初代奥特曼的怪兽以美式特摄质感重新演绎。',
    innovation: '更接近美国电视剧的摄影与剪辑；怪兽造型大幅重制。',
    related: ['great', 'usa', 'zearth'],
    detail: {
      world: '美国，W.I.N.R. 队负责怪兽对策。',
      chars: '帕瓦特、健·李（人间体）与 W.I.N.R. 队员。',
      foes: '巴尔坦星人、杰顿等初代经典怪兽的重制版。',
      impact: '与《葛雷》共同维持了 1990 年代前期的系列存在感。',
      links: '日本于 1995 年电视播出，与《葛雷》形成海外双线。'
    }
  },
  {
    id: 'heisei-seven', title: '平成赛文奥特曼', jp: '平成ウルトラセブン', en: 'HEISEI ULTRASEVEN', year: 1994,
    date: '1994.03.21 / 1994.10.10（TV 特别篇）', type: '特别篇', phase: 'heisei', heroes: ['seven'],
    synopsis: '赛文在 1990 年代回归，以电视特别篇与 OV 形式讲述更成人化、更连续的续篇故事。',
    significance: '“平成赛文”系列让老角色以 OV 形式获得新生，是圆谷面向核心粉丝的重要尝试。',
    innovation: '淡化儿童向玩具逻辑，强化军事、政治与人物关系；1998、1999、2002 年继续推出 OV 续作。',
    related: ['seven', 'ultraman'],
    detail: {
      world: '赛文离开地球后的近未来，地球防卫与宇宙人问题更加复杂。',
      chars: '诸星团、安奴、新队员与防卫队。',
      foes: '宇宙人、地球内部的阴谋势力。',
      impact: '证明“成人向 OV”具有市场，为《奈克瑟斯》等后期实验提供先例。',
      links: '属于《赛文》的直接续篇，与《归来的奥特曼》以后的世界观刻意保持距离。'
    }
  },
  {
    id: 'zearth', title: '哉阿斯奥特曼', jp: 'ウルトラマンゼアス', en: 'ULTRAMAN ZEARTH', year: 1996,
    date: '1996', type: '剧场版', phase: 'heisei', heroes: ['zearth'],
    synopsis: '有洁癖、胆小的哉阿斯奥特曼从光之国来到地球，在搞笑与成长中对抗怪兽与黑暗奥特曼。',
    significance: '系列少见的喜剧路线剧场版，证明奥特曼可以脱离“正剧”框架进行类型实验。',
    innovation: '以喜剧明星主演与夸张搞笑建立全新调性；1997 年推出续作。',
    related: ['great', 'powered', 'tiga'],
    detail: {
      world: '日本，国际防卫军与 Mydo 队；世界观延续昭和但以喜剧方式处理。',
      chars: '哉阿斯、胜人（人间体）、Mydo 队员。',
      foes: '假奥特曼、怪兽军团。',
      impact: '与《迪迦》同年登场，形成“正剧 + 喜剧”并行的 1996 年。',
      links: '剧中出现初代奥特曼的纪念像，暗示与昭和世界的历史联系。'
    }
  },
  {
    id: 'tiga', title: '迪迦奥特曼', jp: 'ウルトラマンティガ', en: 'ULTRAMAN TIGA', year: 1996,
    date: '1996.09.07 – 1997.08.30', type: 'TV', phase: 'heisei', heroes: ['tiga'],
    synopsis: '超古代的光之巨人迪迦在 21 世纪苏醒，与 GUTS 队员圆大古合体，迎战复苏的怪兽与黑暗。',
    significance: '平成奥特曼的开山之作，完全重置世界观并引入“类型转换”，把系列从低谷带回主流视野。',
    innovation: '复合、强力、空中三形态切换；以“超古代文明”构建神话纵深，并首次让主角面对“自己也曾是黑暗”的过去。',
    related: ['dyna', 'gaia', 'tdg-movie', 'tiga-final'],
    detail: {
      world: '近未来地球，TPC 与 GUTS 负责怪兽对策；三千万年前存在超古代文明与光之巨人。',
      chars: '圆大古（迪迦）、丽娜、居间惠队长、新城、掘井等 GUTS 队员。',
      foes: '哥尔赞、美尔巴、基里艾洛德人、加坦杰厄。',
      impact: '收视与商业双丰收，重振系列并奠定“平成三部作”的基础；大古与丽娜的结局成为一代观众的集体记忆。',
      links: '续作《戴拿》共享同一宇宙；剧场版《最终圣战》补完三千万年前的黑暗巨人往事。'
    }
  },
  {
    id: 'dyna', title: '戴拿奥特曼', jp: 'ウルトラマンダイナ', en: 'ULTRAMAN DYNA', year: 1997,
    date: '1997.09.06 – 1998.08.29', type: 'TV', phase: 'heisei', heroes: ['dyna'],
    synopsis: '迪迦消失后的新世代，飞鸟信在宇宙中与光相遇，成为戴拿奥特曼，加入 Super GUTS 对抗斯菲亚。',
    significance: 'TDG 第二作，把舞台从地球扩展到宇宙，并以“传承”处理迪迦留下的空缺。',
    innovation: '闪亮、奇迹、强壮三形态；以宇宙开拓与“人类走向星海”为主题，结局具有开放性。',
    related: ['tiga', 'gaia', 'tdg-movie', 'saga'],
    detail: {
      world: '迪迦之后的近未来，人类进入宇宙开发时代；斯菲亚作为宇宙规模的威胁出现。',
      chars: '飞鸟信（戴拿）、良、喜比队长、狩矢、绿川等 Super GUTS 队员。',
      foes: '斯菲亚、达兰比尔、新扎尔斯等。',
      impact: '把 TDG 宇宙的时间线向前推进，结局的消失与回归成为后续《奥特曼传奇》的伏笔。',
      links: '与《迪迦》同一宇宙；《奥特曼传奇》中与赛罗、高斯共演。'
    }
  },
  {
    id: 'gaia', title: '盖亚奥特曼', jp: 'ウルトラマンガイア', en: 'ULTRAMAN GAIA', year: 1998,
    date: '1998.09.05 – 1999.08.28', type: 'TV', phase: 'heisei', heroes: ['gaia', 'agul'],
    synopsis: '地球意志赋予高山我梦与藤宫博也光之力量，两位奥特曼在理念冲突中共同对抗根源性破灭招来体。',
    significance: 'TDG 第三作，首次以“双奥特曼对立—和解”为核心结构，主题从守护升级为文明与地球的共生。',
    innovation: '双主角、双组织（XIG / 炼金之星）并行；以“地球本身的选择”解释奥特曼的来源，科幻设定密度极高。',
    related: ['tiga', 'dyna', 'tdg-movie'],
    detail: {
      world: '近未来地球，XIG 与炼金之星共同应对根源性破灭招来体；地球意志是光之力量的来源。',
      chars: '高山我梦（盖亚）、藤宫博也（阿古茹）、石室指挥官、佐佐木队长等。',
      foes: '根源性破灭招来体、佐格、哥布纽等。',
      impact: '以“人类并非天然正义”的立场提升系列的思想深度，被广泛视为平成三部作中设定最完整的一作。',
      links: '与《迪迦》《戴拿》世界观不同，但在《超时空大决战》与《超奥特8兄弟》中跨世界共演。'
    }
  },
  {
    id: 'tdg-movie', title: '迪迦·戴拿&盖亚 超时空大决战', jp: 'ウルトラマンティガ・ウルトラマンダイナ&ウルトラマンガイア 超時空の大決戦', en: 'SUPERIOR 8? / TDG THE MOVIE', year: 1999,
    date: '1999.03.06', type: '剧场版', phase: 'heisei', heroes: ['tiga', 'dyna', 'gaia'],
    synopsis: '少年们许下的愿望把三位光之巨人带到同一时空，共同对抗来自异世界的怪兽与红球。',
    significance: 'TDG 三部作的第一次同框，证明不同世界观的奥特曼可以通过“超时空”设定共演。',
    innovation: '以“孩子们的想象力”作为跨世界连接的机制，影响后来的跨作品联动思路。',
    related: ['tiga', 'dyna', 'gaia', 'superior-8'],
    detail: {
      world: '多个平行地球因“红球”而交汇，三位奥特曼的舞台被强行连接。',
      chars: '圆大古、飞鸟信、高山我梦与少年主角们。',
      foes: '红球所召唤的怪兽与侵略者。',
      impact: '奠定“平成三杰同框”的纪念性地位，也为 2008 年《大决战！超奥特8兄弟》铺路。',
      links: '与《盖亚》的世界观差异在剧中以平行世界处理。'
    }
  },
  {
    id: 'tiga-final', title: '迪迦奥特曼 最终圣战', jp: 'ウルトラマンティガ THE FINAL ODYSSEY', en: 'TIGA: THE FINAL ODYSSEY', year: 2000,
    date: '2000.03.11', type: '剧场版', phase: 'millennium', heroes: ['tiga'],
    synopsis: '迪迦消失后的世界，三千万年前的黑暗巨人卡蜜拉等人苏醒，揭开迪迦曾经身为黑暗巨人的过去。',
    significance: '为《迪迦》补完最关键的设定：光之巨人的“过去”并不纯洁，英雄身份来自选择而非血统。',
    innovation: '把 TV 版未展开的超古代黑暗巨人作为剧场版主轴，并以“黑暗迪迦”完成主题闭环。',
    related: ['tiga', 'dyna', 'tdg-movie'],
    detail: {
      world: '迪迦离开后的地球，超古代遗迹与黑暗巨人的封印被解开。',
      chars: '圆大古、丽娜、卡蜜拉、达拉姆、希特拉。',
      foes: '卡蜜拉、黑暗巨人三干部、迪莫杰厄。',
      impact: '让迪迦的角色弧光在剧场版中真正完成，也强化了“光与暗是同一个人”的主题。',
      links: '时间线位于《迪迦》TV 结局之后、《戴拿》之前。'
    }
  },
  {
    id: 'neos', title: '奈欧斯奥特曼', jp: 'ウルトラマンネオス', en: 'ULTRAMAN NEOS', year: 2000,
    date: '2000.11.22 – 2001（OVA）', type: 'OVA', phase: 'millennium', heroes: ['neos'],
    synopsis: '光之国的奈欧斯与赛文21来到地球，与 HEART 队共同对抗宇宙侵略者。',
    significance: '原为电视企划、最终以 OV 形式推出，保留了浓厚的前平成企划痕迹，是系列过渡期的重要作品。',
    innovation: '回归初代式的“宇宙人侵略 + 防卫队”结构，同时引入双奥特曼协作。',
    related: ['tiga', 'cosmos', 'max'],
    detail: {
      world: '近未来地球，HEART 队负责怪兽与宇宙人对策。',
      chars: '奈欧斯、神乐元气（人间体）、赛文21、HEART 队员。',
      foes: '宇宙侵略者、怪兽军团。',
      impact: '在《迪迦》成功后承接传统路线，为 2000 年代初期的系列复苏提供过渡。',
      links: '设定上属于 M78 光之国体系，与平成三部作无关。'
    }
  },
  {
    id: 'cosmos', title: '高斯奥特曼', jp: 'ウルトラマンコスモス', en: 'ULTRAMAN COSMOS', year: 2001,
    date: '2001.07.07 – 2002.09.28', type: 'TV', phase: 'millennium', heroes: ['cosmos', 'justice'],
    synopsis: '温柔的高斯奥特曼与青年春野武藏合体，以“不杀”的方式保护怪兽，与 TEAM EYES 一起寻找人与怪兽共存的道路。',
    significance: '系列集数最多（65 话）的作品之一，以“守护而非消灭”为核心，开辟了完全不同的英雄伦理。',
    innovation: '月神、日冕等形态切换；大量“怪兽也有生命与情感”的单元剧；剧场版扩展出杰斯提斯与宇宙尺度冲突。',
    related: ['cosmos-movie', 'saga', 'neos'],
    detail: {
      world: '近未来地球，TEAM EYES 与宇宙和平机构合作；怪兽被视为需要保护的生态成员。',
      chars: '春野武藏（高斯）、森本绫乃、日浦队长、杰斯提斯等。',
      foes: '混沌头、卡欧斯病毒、侵略性宇宙人。',
      impact: '把“共存”主题推到系列前所未有的高度，也影响了后续《艾克斯》《布莱泽》等作品对怪兽的处理方式。',
      links: '剧场版《蓝色星球》引入杰斯提斯；《奥特曼传奇》与戴拿、赛罗共演。'
    }
  },
  {
    id: 'cosmos-movie', title: '高斯奥特曼2 蓝色星球', jp: 'ウルトラマンコスモス2 THE BLUE PLANET', en: 'COSMOS 2: THE BLUE PLANET', year: 2002,
    date: '2002.08.03', type: '剧场版', phase: 'millennium', heroes: ['cosmos', 'justice'],
    synopsis: '宇宙意志的使者杰斯提斯降临，与高斯在“人类是否值得守护”的问题上发生冲突。',
    significance: '系列首次让两位奥特曼因“理念”而非误会交战，把英雄叙事提升为文明审判。',
    innovation: '以宇宙意志的代理人作为对手，探讨人类对地球的责任；杰斯提斯随后成为独立英雄。',
    related: ['cosmos', 'saga'],
    detail: {
      world: '地球与宇宙意志的审判；杰斯提斯代表“重置”的立场。',
      chars: '春野武藏、杰斯提斯、藤原树理等。',
      foes: '桑德罗斯、宇宙意志的执行者。',
      impact: '让高斯的“温柔”不再是单向的，而需要面对更高尺度的质疑。',
      links: '《奥特曼传奇》中杰斯提斯与高斯的协作延续了这段关系。'
    }
  },
  {
    id: 'nexus', title: '奈克瑟斯奥特曼', jp: 'ウルトラマンネクサス', en: 'ULTRAMAN NEXUS', year: 2004,
    date: '2004.10.02 – 2005.06.25', type: 'TV', phase: 'millennium', heroes: ['nexus'],
    synopsis: '光之纽带在多位“适能者”之间传递，夜袭队与未知之手在黑暗中争夺人类的未来。',
    significance: '系列最大胆的成人向实验：连续剧结构、沉重主题与非线性叙事，虽商业失利却获得长期口碑。',
    innovation: '“适能者”制度让主角可以更替；以“光之纽带”把传承主题形式化；影像风格接近电影。',
    related: ['max', 'mebius', 'cosmos'],
    detail: {
      world: '近未来地球，TLT 与夜袭队秘密对抗“异生兽”；光之纽带跨越不同适能者。',
      chars: '孤门一辉、姬矢准、千树怜、西条凪等适能者与夜袭队成员。',
      foes: '异生兽、黑暗浮士德、黑暗梅菲斯特、黑暗扎基。',
      impact: '虽因档期与受众定位受挫，但其“英雄是被选择的普通人”的命题深刻影响了后来的作品与观众。',
      links: '作为“ULTRA N PROJECT”的一环，与《诺亚·奥特曼》的设定相连。'
    }
  },
  {
    id: 'max', title: '麦克斯奥特曼', jp: 'ウルトラマンマックス', en: 'ULTRAMAN MAX', year: 2005,
    date: '2005.07.02 – 2006.04.01', type: 'TV', phase: 'millennium', heroes: ['max'],
    synopsis: '光之国的麦克斯来到地球，与 DASH 队并肩，以“最快最强”的姿态应对怪兽与宇宙人。',
    significance: '回归单元剧与娱乐性，在《奈克瑟斯》的沉重之后重新确认“奥特曼首先是给孩子看的英雄”。',
    innovation: '强调速度与多样化的战斗演出；大量向昭和经典致敬的怪兽与桥段。',
    related: ['nexus', 'mebius', 'neos'],
    detail: {
      world: '近未来地球，DASH 队负责怪兽对策；麦克斯来自 M78 光之国。',
      chars: '麦克斯、东马快斗（人间体）、小石川队长与 DASH 队员。',
      foes: '怪兽、宇宙人、黑暗巴尔坦等。',
      impact: '以稳定的完成度守住电视档期，为 40 周年作《梦比优斯》积累制作经验。',
      links: '与《奈克瑟斯》《梦比优斯》并称“高概念奥特曼系列”。'
    }
  },
  {
    id: 'mebius', title: '梦比优斯奥特曼', jp: 'ウルトラマンメビウス', en: 'ULTRAMAN MEBIUS', year: 2006,
    date: '2006.04.08 – 2007.03.31', type: 'TV', phase: 'millennium', heroes: ['mebius'],
    synopsis: '年轻的梦比优斯被派往地球，加入 GUYS，在昭和奥特兄弟的注视下成长为真正的宇宙警备队战士。',
    significance: '系列 40 周年作，正式接续昭和世界观，让“奥特兄弟”在 21 世纪重新集结。',
    innovation: '以“新人成长”为主轴，GUYS 队员可合体操纵战机；大量昭和演员与角色回归。',
    related: ['mebius-movie', 'eighty', 'taro', 'ultraman'],
    detail: {
      world: '昭和系列延续的未来地球，GUYS 是新一代防卫队；光之国与地球重新建立联系。',
      chars: '日比野未来（梦比优斯）、迫水真吾队长、龙、真理奈等 GUYS 队员。',
      foes: '安培拉星人、英普莱扎、亚波人、黑暗四天王。',
      impact: '完成昭和世界观的“收束与传承”，并让安培拉星人这一远古宿敌真正登场。',
      links: '剧场版《梦比优斯与奥特兄弟》让昭和奥特兄弟全员共演。'
    }
  },
  {
    id: 'mebius-movie', title: '梦比优斯奥特曼与奥特兄弟', jp: 'ウルトラマンメビウス&ウルトラ兄弟', en: 'MEBIUS & THE ULTRA BROTHERS', year: 2006,
    date: '2006.09.02', type: '剧场版', phase: 'millennium', heroes: ['mebius', 'ultraman', 'seven', 'jack', 'ace', 'taro'],
    synopsis: '梦比优斯与初代、赛文、杰克、艾斯、泰罗等奥特兄弟共同对抗复活的宇宙威胁。',
    significance: '昭和奥特兄弟在 21 世纪的第一次全员剧场版集结，是 40 周年纪念的核心作品。',
    innovation: '以“兄弟”关系而非简单客串组织剧情；新旧世代在同一战场上分工。',
    related: ['mebius', 'taro', 'ultraman'],
    detail: {
      world: '昭和世界观延伸，光之国与地球共同面对宇宙规模的威胁。',
      chars: '梦比优斯、初代、赛文、杰克、艾斯、泰罗、佐菲。',
      foes: '复活的宇宙人军团与怪兽。',
      impact: '强化了“奥特兄弟”作为跨世代家族的情感纽带，为后续《超银河传说》的群像路线提供模板。',
      links: '剧情位于《梦比优斯》TV 中盘。'
    }
  },
  {
    id: 'ultra-galaxy', title: '奥特银河大怪兽之战', jp: 'ウルトラギャラクシー大怪獣バトル', en: 'ULTRA GALAXY MEGA MONSTER BATTLE', year: 2007,
    date: '2007.12.01 – 2008.02.23', type: 'TV', phase: 'millennium', heroes: [],
    synopsis: '在怪兽墓场般的行星上，雷与他的怪兽伙伴在各方势力的争夺中求生。',
    significance: '系列首次以“怪兽”为主角的电视作品，尝试低成本、连续剧化的新形态。',
    innovation: '以怪兽操纵与战斗为核心，减少巨大英雄出场；2008 年推出续篇《NEVER ENDING ODYSSEY》。',
    related: ['ultra-galaxy-legend', 'zero-movie'],
    detail: {
      world: '宇宙中的怪兽行星与怪兽墓场，多个宇宙势力争夺怪兽资源。',
      chars: '雷、怪兽哥莫拉、宇宙船上的伙伴们。',
      foes: '怪兽军团、宇宙猎人、雷布朗多相关势力。',
      impact: '为《超银河传说》的“怪兽墓场”与贝利亚事件提供舞台与设定基础。',
      links: '续篇与 2009 年电影直接衔接。'
    }
  },
  {
    id: 'ultra-galaxy-legend', title: '大怪兽格斗 超银河传说 THE MOVIE', jp: '大怪獣バトル ウルトラ銀河伝説 THE MOVIE', en: 'MEGA MONSTER BATTLE: ULTRA GALAXY LEGEND', year: 2009,
    date: '2009.12.12', type: '剧场版', phase: 'newgen', heroes: ['zero', 'ultraman', 'seven', 'mebius'],
    synopsis: '贝利亚越狱并夺取等离子火花，光之国陷入冰封；赛罗在奥特之王的试炼后登场，与奥特战士夺回光。',
    significance: '系列电影宇宙的起点：赛罗初登场、贝利亚成为长期宿敌，奥特战士大规模集结。',
    innovation: '以 CG 与大规模群像战打造“宇宙级事件”；把光之国本身作为战场与危机核心。',
    related: ['zero-movie', 'ultra-galaxy', 'mebius'],
    detail: {
      world: 'M78 光之国、怪兽墓场与宇宙战场；贝利亚的越狱直接威胁光之国存续。',
      chars: '赛罗、贝利亚、奥特之王、初代、赛文、梦比优斯、雷。',
      foes: '贝利亚、百体怪兽贝琉多拉、怪兽军团。',
      impact: '开启“赛罗时代”，并让贝利亚成为贯穿电影与新生代作品的核心反派。',
      links: '直接续作为《赛罗奥特曼 THE MOVIE 超决战！贝利亚银河帝国》。'
    }
  },
  {
    id: 'zero-movie', title: '赛罗奥特曼 THE MOVIE 超决战！贝利亚银河帝国', jp: 'ウルトラマンゼロ THE MOVIE 超決戦!ベリアル銀河帝国', en: 'ULTRAMAN ZERO: THE REVENGE OF BELIAL', year: 2010,
    date: '2010.12.23', type: '剧场版', phase: 'newgen', heroes: ['zero'],
    synopsis: '赛罗穿越到另一个宇宙，与镜子骑士、红莲火焰、钢铁武士结成联盟，对抗建立银河帝国的贝利亚。',
    significance: '系列首次大规模描绘“另一个宇宙”的政治格局，确立赛罗的多元宇宙巡游者身份。',
    innovation: '多英雄团队 + 宇宙帝国叙事；以“终极赛罗警备队”扩展角色谱系。',
    related: ['ultra-galaxy-legend', 'saga', 'ginga'],
    detail: {
      world: '贝利亚统治的另一个宇宙，银河帝国以武力征服行星。',
      chars: '赛罗、镜子骑士、红莲火焰、钢铁武士、艾美拉娜公主。',
      foes: '贝利亚、黑暗洛普斯赛罗、银河帝国军团。',
      impact: '把“多元宇宙”从设定变成可反复使用的叙事装置，赛罗的人气达到顶点。',
      links: '续作《奥特曼传奇》继续赛罗的跨宇宙线索。'
    }
  },
  {
    id: 'saga', title: '奥特曼传奇', jp: 'ウルトラマンサーガ', en: 'ULTRAMAN SAGA', year: 2012,
    date: '2012.03.24', type: '剧场版', phase: 'newgen', heroes: ['zero', 'dyna', 'cosmos'],
    synopsis: '赛罗、戴拿、高斯在另一个地球相遇，与 Team U 一同对抗海帕杰顿与宇宙级别的绝望。',
    significance: '把三位不同世界观的奥特曼放在同一战场，是“跨宇宙共演”的成熟形态。',
    innovation: '以“奥特曼不会放弃”为核心台词，把群像战斗与少年成长结合；戴拿的回归成为情感高潮。',
    related: ['zero-movie', 'dyna', 'cosmos'],
    detail: {
      world: '被海帕杰顿威胁的另一个地球，Team U 与三位奥特曼共同作战。',
      chars: '赛罗、戴拿、高斯、大河望、Team U 成员。',
      foes: '海帕杰顿、百特星人。',
      impact: '为新生代作品的“英雄集结”模式提供直接范本。',
      links: '赛罗线索承接《超决战！贝利亚银河帝国》，戴拿线索承接《戴拿》结局。'
    }
  },
  {
    id: 'ginga', title: '银河奥特曼', jp: 'ウルトラマンギンガ', en: 'ULTRAMAN GINGA', year: 2013,
    date: '2013.07.10 – 2013.12.18', type: 'TV', phase: 'newgen', heroes: ['ginga'],
    synopsis: '在怪兽与奥特曼都被变成“火花人偶”的世界，少年礼堂光获得银河的力量，与伙伴们夺回被冻结的光。',
    significance: '“新生代英雄”系列的第一作，以低预算、短篇与玩具联动重建电视档期，开启新的十年。',
    innovation: '火花人偶设定让历代怪兽与英雄可以低成本登场；校园与小镇舞台贴近新一代观众。',
    related: ['ginga-s', 'taiga', 'zero-movie'],
    detail: {
      world: '被黑暗火花冻结的降星镇；历代奥特曼与怪兽以人偶形态存在。',
      chars: '礼堂光（银河）、石动美玲、渡会健太、久野千草。',
      foes: '黑暗路基艾尔、黑暗代理人、怪兽人偶军团。',
      impact: '虽然制作规模有限，但成功重启电视系列，确立了新生代的商业与叙事模式。',
      links: '续作《银河奥特曼S》引入维克特利。'
    }
  },
  {
    id: 'ginga-s', title: '银河奥特曼S', jp: 'ウルトラマンギンガS', en: 'ULTRAMAN GINGA S', year: 2014,
    date: '2014.07.15 – 2014.12.23', type: 'TV', phase: 'newgen', heroes: ['ginga', 'victory'],
    synopsis: '银河与地底世界的维克特利奥特曼联手，对抗利用怪兽火花与地底资源的敌人。',
    significance: '首次在新生代中确立“双奥特曼 + 双变身器”的团队结构，并扩展了地底文明的世界观。',
    innovation: '维克特利的“怪兽武装”让怪兽力量成为可切换装备；UPG 队形成新生代防卫队模板。',
    related: ['ginga', 'x', 'orb'],
    detail: {
      world: '雫之丘与地底世界维克特利安，怪兽火花成为争夺焦点。',
      chars: '礼堂光、翔（维克特利）、朔夜、UPG 队员。',
      foes: '谢帕顿、加巴尔星人、黑暗路基艾尔的余党。',
      impact: '让“新生代英雄”从单作扩展为可持续的系列品牌。',
      links: '2015 年剧场版《决战！奥特10勇士！！》实现新生代大集结。'
    }
  },
  {
    id: 'x', title: '艾克斯奥特曼', jp: 'ウルトラマンX', en: 'ULTRAMAN X', year: 2015,
    date: '2015.07.14 – 2015.12.22', type: 'TV', phase: 'newgen', heroes: ['x'],
    synopsis: '数据化的奥特曼艾克斯与青年大地合体，加入 XIO 队，用怪兽装甲与数字化能力对抗怪兽。',
    significance: '首次把“怪兽数据/装甲”作为核心玩具与叙事机制，并引入“奥特曼与人间体双向成长”的结构。',
    innovation: '怪兽装甲系统、赛博感美术；防卫队 XIO 的技术设定完整。',
    related: ['ginga-s', 'orb', 'mebius'],
    detail: {
      world: '近未来日本，XIO 队使用科技装备应对怪兽；艾克斯来自光之国。',
      chars: '大空大地（艾克斯）、明日奈、神木队长、XIO 队员。',
      foes: '暗黑雷暴、怪兽军团、格里扎。',
      impact: '确立“半年番 + 装甲换装”的新生代公式，并让“怪兽也是生态一环”的议题回归。',
      links: '剧场版《来了！我们的奥特曼》让初代奥特曼回归。'
    }
  },
  {
    id: 'orb', title: '欧布奥特曼', jp: 'ウルトラマンオーブ', en: 'ULTRAMAN ORB', year: 2016,
    date: '2016.07.09 – 2016.12.24', type: 'TV', phase: 'newgen', heroes: ['orb'],
    synopsis: '流浪的奥特曼欧布借取历代英雄之力，与伽古拉等对手周旋，在魔王兽复苏的现代地球战斗。',
    significance: '系列 50 周年作，以“借用前辈力量”的设定把新生代与昭和、平成连接起来。',
    innovation: '奥特融合卡与多重形态；以“流浪者”主角和爵士风美术建立强烈作者性。',
    related: ['geed', 'x', 'zero-movie'],
    detail: {
      world: '现代地球，魔王兽封印逐渐解除；欧布的身份与过去被刻意隐藏。',
      chars: '红凯（欧布）、伽古拉、SSP 成员、梦野奈绪美。',
      foes: '玛伽大蛇、伽古拉、魔王兽。',
      impact: '商业与人气双赢，使“借力”成为新生代核心语法，也让伽古拉成为高人气反英雄。',
      links: '《欧布奥特曼 THE ORIGIN SAGA》补完凯与伽古拉的过去。'
    }
  },
  {
    id: 'geed', title: '捷德奥特曼', jp: 'ウルトラマンジード', en: 'ULTRAMAN GEED', year: 2017,
    date: '2017.07.08 – 2017.12.23', type: 'TV', phase: 'newgen', heroes: ['geed', 'zero'],
    synopsis: '作为贝利亚之子诞生的少年朝仓陆，选择以捷德的身份反抗父亲的野心，守护地球。',
    significance: '把系列最受欢迎的反派贝利亚与“父子”命题结合，完成新生代最具戏剧张力的一次尝试。',
    innovation: '胶囊融合变身；以“基因决定论 vs 自我选择”为核心主题，反派塑造复杂。',
    related: ['orb', 'zero-movie', 'taiga'],
    detail: {
      world: '现代地球，贝利亚的余党与 AIB 组织活动；小陆在星云庄生活。',
      chars: '朝仓陆（捷德）、鸟羽来叶、佩嘉、赛罗、贝利亚。',
      foes: '贝利亚、斯特鲁姆星人、加拉特隆。',
      impact: '让贝利亚的故事获得情感收束，同时把“英雄之子”的命题带入系列。',
      links: '剧场版《连接吧！愿望!!》延续捷德与奥特兄弟的联系。'
    }
  },
  {
    id: 'r-b', title: '罗布奥特曼', jp: 'ウルトラマンR/B', en: 'ULTRAMAN R/B', year: 2018,
    date: '2018.07.07 – 2018.12.22', type: 'TV', phase: 'newgen', heroes: ['rosso', 'blu'],
    synopsis: '凑家兄弟在父亲留下的店里生活，意外获得罗索与布鲁的力量，以兄弟搭档守护绫香市。',
    significance: '首次以“兄弟双主角 + 家庭剧”作为整部作品的核心，调性轻快。',
    innovation: '元素水晶换装、兄弟合体技；以家庭与店铺日常构建生活感。',
    related: ['ginga-s', 'taiga', 'orb'],
    detail: {
      world: '绫香市，凑家与爱染科技；怪兽与宇宙人围绕元素水晶出现。',
      chars: '凑活海（罗索）、凑勇海（布鲁）、凑朝阳、爱染诚。',
      foes: '黑暗欧布（爱染诚）、怪兽与宇宙人。',
      impact: '以轻喜剧拓宽新生代的受众，并引入妹妹朝阳的关键设定。',
      links: '剧场版《决定了！羁绊的水晶》补完家庭线。'
    }
  },
  {
    id: 'taiga', title: '泰迦奥特曼', jp: 'ウルトラマンタイガ', en: 'ULTRAMAN TAIGA', year: 2019,
    date: '2019.07.06 – 2019.12.28', type: 'TV', phase: 'newgen', heroes: ['taiga', 'zero'],
    synopsis: '泰罗之子泰迦与泰塔斯、风马三位奥特曼共同寄宿在青年工藤优幸身上，与 E.G.I.S. 一起解决宇宙人事件。',
    significance: '以“三人小队”和“奥特曼之子”双重设定，完成新生代对昭和血脉的致敬。',
    innovation: '一体三奥特曼的切换战斗；以民间调查事务所替代传统防卫队。',
    related: ['geed', 'taro', 'z'],
    detail: {
      world: '现代日本，宇宙人已秘密融入社会；E.G.I.S. 处理相关事件。',
      chars: '工藤优幸、泰迦、泰塔斯、风马、宗谷誉、佐佐木可奈。',
      foes: '托雷基亚、宇宙人犯罪集团、怪兽。',
      impact: '托雷基亚成为新生代最具哲学气质的反派之一，泰迦也确立了“令和前后交接”的位置。',
      links: '剧场版《新生代高潮》集结新生代英雄。'
    }
  },
  {
    id: 'z', title: '泽塔奥特曼', jp: 'ウルトラマンZ', en: 'ULTRAMAN Z', year: 2020,
    date: '2020.06.20 – 2020.12.26', type: 'TV', phase: 'reiwa', heroes: ['z', 'zero'],
    synopsis: '见习奥特曼泽塔为追回恶魔碎片来到地球，与军械库青年夏川遥辉合体，在 STORAGE 队中成长。',
    significance: '令和时代的高评价之作，以“热血笨蛋”主角与扎实的防卫队群像赢回口碑，被称为新生代的完成形。',
    innovation: '怪兽装甲与勋章系统；以“奥特曼也需要学习”的成长叙事替代天生强者。',
    related: ['taiga', 'trigger', 'geed'],
    detail: {
      world: '现代地球，STORAGE 队以机甲与怪兽应对威胁；恶魔碎片引发宇宙级混乱。',
      chars: '夏川遥辉（泽塔）、蛇仓翔太（伽古拉）、中岛洋子、大田结花。',
      foes: '赛雷布洛、德斯特鲁多斯、怪兽军团。',
      impact: '被视为新生代集大成之作，也让“防卫队日常”重新成为系列魅力核心。',
      links: '《特利迦奥特曼 特别篇 Z》延续泽塔与特利迦的共演。'
    }
  },
  {
    id: 'trigger', title: '特利迦奥特曼', jp: 'ウルトラマントリガー NEW GENERATION TIGA', en: 'ULTRAMAN TRIGGER', year: 2021,
    date: '2021.07.10 – 2022.01.22', type: 'TV', phase: 'reiwa', heroes: ['trigger'],
    synopsis: '在火星开拓时代，青年真中剑悟获得特利迦的力量，与 GUTS-SELECT 对抗黑暗巨人。',
    significance: '《迪迦》25 周年纪念作，以“新生代迪迦”之名重启超古代设定，连接平成与令和。',
    innovation: '多形态切换与“永恒核心”设定；火星舞台与 TPU 国际组织扩展世界观。',
    related: ['tiga', 'trigger-z', 'decker'],
    detail: {
      world: '火星与地球，TPU / GUTS-SELECT 负责怪兽对策；超古代文明与永恒核心是核心谜团。',
      chars: '真中剑悟（特利迦）、静间结名、圣彰人、精英胜利队。',
      foes: '卡尔蜜拉、达贡、希特拉姆、黑暗巨人。',
      impact: '虽评价分化，但完成“迪迦—特利迦”的跨世代对话，并为《德凯》建立同一宇宙。',
      links: '《德凯》共享同一地球与 TPU 体系；特别篇 Z 让泽塔登场。'
    }
  },
  {
    id: 'trigger-z', title: '特利迦奥特曼 特别篇 Z', jp: 'ウルトラマントリガー エピソードZ', en: 'TRIGGER: EPISODE Z', year: 2022,
    date: '2022.03.18', type: '网络', phase: 'reiwa', heroes: ['trigger', 'z'],
    synopsis: '特利迦与泽塔在特别篇中再度联手，处理 TV 结局后的新威胁。',
    significance: '以网络配信形式补完《特利迦》的后续，体现令和时代“正篇 + 网络特别篇”的发行结构。',
    innovation: '短篇高密度动作与跨作品联动，服务核心观众。',
    related: ['trigger', 'z', 'decker'],
    detail: {
      world: '《特利迦》结局后的地球，TPU 仍在处理怪兽威胁。',
      chars: '真中剑悟、夏川遥辉、GUTS-SELECT。',
      foes: '新出现的宇宙威胁。',
      impact: '连接《特利迦》与《德凯》的时间线，并让泽塔的世界与特利迦世界产生交集。',
      links: '属于《德凯》开播前的过渡作品。'
    }
  },
  {
    id: 'shin', title: '新·奥特曼', jp: 'シン・ウルトラマン', en: 'SHIN ULTRAMAN', year: 2022,
    date: '2022.05.13', type: '剧场版', phase: 'reiwa', heroes: [],
    synopsis: '巨大不明生物“祸威兽”接连出现，日本政府成立祸特对；来自外星的神秘巨人介入，揭开更大的宇宙博弈。',
    significance: '庵野秀明编剧、樋口真嗣执导的独立重启，把初代奥特曼的设定以现代政治与科幻语境重构。',
    innovation: '以 CG 与真实政治流程描写“怪兽灾害对策”；对初代的身高、光线与变身进行考据式重写。',
    related: ['ultraman', 'seven'],
    detail: {
      world: '现代日本，祸特对应对祸威兽；宇宙人（扎拉布、美菲拉斯、佐菲）各有图谋。',
      chars: '神永新二（奥特曼）、浅见弘子、田村君男、祸特对成员。',
      foes: '祸威兽、扎拉布星人、美菲拉斯星人、佐菲（立场复杂）。',
      impact: '以非系列正史的独立电影获得巨大社会关注，成为“成人向奥特曼”的新范式。',
      links: '与 TV 系列无 continuity 关系，属于独立世界观。'
    }
  },
  {
    id: 'decker', title: '德凯奥特曼', jp: 'ウルトラマンデッカー', en: 'ULTRAMAN DECKER', year: 2022,
    date: '2022.07.09 – 2023.01.21', type: 'TV', phase: 'reiwa', heroes: ['decker', 'trigger'],
    synopsis: '斯菲亚封锁地球后，青年明日见奏大获得德凯的力量，与 GUTS-SELECT 一起守护被隔绝的人类。',
    significance: '《特利迦》续篇，以“被宇宙封锁的地球”构建新的危机格局，并完成新生代与令和的交接。',
    innovation: '未来视角与“后代传承”；斯菲亚作为宇宙尺度威胁贯穿全篇；与《特利迦》同一地球。',
    related: ['trigger', 'decker-movie', 'dyna'],
    detail: {
      world: '近未来地球，斯菲亚屏障隔绝宇宙；TPU 与 GUTS-SELECT 继续运作。',
      chars: '明日见奏大（德凯）、桐野唯千夏、龙门创守、昴星队长。',
      foes: '斯菲亚、斯菲亚合成兽、宇宙威胁。',
      impact: '把“迪迦—戴拿”的宇宙传承关系以特利迦—德凯的形式重述。',
      links: '剧场版《最终章 前往星光之旅》为 TV 结局后的正式续篇。'
    }
  },
  {
    id: 'decker-movie', title: '德凯奥特曼 最终章 前往星光之旅', jp: 'ウルトラマンデッカー最終章 旅立ちの彼方へ…', en: 'DECKER: FAREWELL TO THE STARS', year: 2023,
    date: '2023.02.23', type: '剧场版', phase: 'reiwa', heroes: ['decker'],
    synopsis: 'TV 结局后的世界，奏大与伙伴们面对新的宇宙威胁与离别的选择。',
    significance: '为《德凯》TV 线收束，并以剧场版形式给出“人类走向宇宙”的阶段性答案。',
    innovation: '延续斯菲亚之后的宇宙观，强化“传承与出发”的主题。',
    related: ['decker', 'trigger', 'blazar'],
    detail: {
      world: '《德凯》结局后的地球与宇宙，TPU 面临新的星际局势。',
      chars: '明日见奏大、GUTS-SELECT 成员、特利迦。',
      foes: '新的宇宙侵略势力。',
      impact: '完成令和时代“TV + 剧场版”闭环的又一次实践。',
      links: '时间上位于《布莱泽》之前。'
    }
  },
  {
    id: 'blazar', title: '布莱泽奥特曼', jp: 'ウルトラマンブレーザー', en: 'ULTRAMAN BLAZAR', year: 2023,
    date: '2023.07.08 – 2024.01.20', type: 'TV', phase: 'reiwa', heroes: ['blazar'],
    synopsis: '宇宙怪兽与地球怪兽接连出现，特殊怪兽对应分遣队 SKaRD 的队长比留间弦人与神秘的布莱泽奥特曼相遇。',
    significance: '以“沟通失败”与“怪兽生态”为核心，被视为令和时代最具作者性的电视作品之一。',
    innovation: '主角是队长而非少年；布莱泽的野性动作与语言不通设定；军事质感与怪兽灾害描写写实。',
    related: ['blazar-movie', 'arc', 'decker'],
    detail: {
      world: '现代地球，GGF 与 SKaRD 负责怪兽灾害；宇宙怪兽与地球怪兽的冲突构成主线。',
      chars: '比留间弦人（布莱泽）、苍边惠美、名仓辉明、美南杏梨。',
      foes: '宇宙怪兽、地球怪兽、地球外威胁。',
      impact: '以成人向的叙事与高质量特摄获得高度评价，也让“怪兽是自然的一部分”的命题回归。',
      links: '剧场版《大怪兽首都激突》为 TV 结局后的续篇。'
    }
  },
  {
    id: 'regulos', title: '雷古洛斯奥特曼', jp: 'ウルトラマンレグロス', en: 'ULTRAMAN REGULOS', year: 2023,
    date: '2023.05.23 – 2023.07.04', type: '网络', phase: 'reiwa', heroes: [],
    synopsis: '失去记忆的雷古洛斯在宇宙中追寻自己的过去，与宇宙幻兽拳的传承相连。',
    significance: '以网络配信短篇扩展光之国体系，补完雷古洛斯与幻兽拳的设定。',
    innovation: '以“宇宙幻兽拳”构建独特的格斗体系；与《奥特银河格斗》系列联动。',
    related: ['ultra-galaxy-legend', 'zero-movie'],
    detail: {
      world: '宇宙中的幻兽拳修行地与其毁灭的过去。',
      chars: '雷古洛斯、迪亚斯、幻兽拳相关角色。',
      foes: '阿布索留特一族相关势力。',
      impact: '为《奥特银河格斗》的跨作品叙事提供角色与设定支点。',
      links: '与《奥特银河格斗：命运的冲突》共享时间线。'
    }
  },
  {
    id: 'blazar-movie', title: '布莱泽奥特曼 THE MOVIE 大怪兽首都激突', jp: 'ウルトラマンブレーザー THE MOVIE 大怪獣首都激突', en: 'BLAZAR THE MOVIE', year: 2024,
    date: '2024.02.23', type: '剧场版', phase: 'reiwa', heroes: ['blazar'],
    synopsis: '怪兽出现在首都，SKaRD 与布莱泽面对前所未有的城市灾害与新的敌人。',
    significance: '为《布莱泽》TV 线提供剧场版收束，延续其写实灾害描写。',
    innovation: '以首都圈为舞台的大规模灾害演出；TV 角色全员回归。',
    related: ['blazar', 'arc'],
    detail: {
      world: '《布莱泽》结局后的日本，怪兽灾害对策体系继续运转。',
      chars: '比留间弦人、SKaRD 全员。',
      foes: '新的怪兽与宇宙威胁。',
      impact: '完成令和“TV + 剧场版”的又一次闭环。',
      links: '时间上位于《亚刻》之前。'
    }
  },
  {
    id: 'rising', title: '奥特曼：崛起', jp: 'Ultraman: Rising', en: 'ULTRAMAN: RISING', year: 2024,
    date: '2024.06.14（Netflix）', type: '网络', phase: 'reiwa', heroes: [],
    synopsis: '美国职棒明星佐藤建回到东京，继承奥特曼的力量，却要同时照顾一只怪兽幼崽。',
    significance: 'Netflix 与圆谷合作的 CG 动画电影，面向全球观众重新讲述“英雄与家庭”。',
    innovation: '美式动画工业与日本 IP 的结合；以育儿喜剧重构英雄责任。',
    related: ['usa', 'shin'],
    detail: {
      world: '现代东京与棒球世界，怪兽与奥特曼的存在已公开。',
      chars: '佐藤建、艾米、怪兽幼崽惠美。',
      foes: '巨型怪兽、宇宙威胁。',
      impact: '探索了非日本本土制作的奥特曼影像，扩大全球受众。',
      links: '独立世界观，与 TV 系列无直接连续关系。'
    }
  },
  {
    id: 'arc', title: '亚刻奥特曼', jp: 'ウルトラマンアーク', en: 'ULTRAMAN ARC', year: 2024,
    date: '2024.07.06 – 2025.01.18', type: 'TV', phase: 'reiwa', heroes: ['arc'],
    synopsis: '怪兽防灾科学调查所 SKIP 的新人调查员飞世优马，在危机中与来自遥远银河的亚刻奥特曼结合。',
    significance: '以“调查与理解怪兽”替代单纯战斗，延续《布莱泽》的生态视角并加入少年成长线。',
    innovation: '想象力驱动的“亚刻之翼”与多形态；SKIP 的民间调查机构设定轻松而有生活感。',
    related: ['arc-movie', 'blazar', 'omega'],
    detail: {
      world: '现代日本，SKIP 各分所负责怪兽调查与防灾；亚刻来自遥远银河。',
      chars: '飞世优马（亚刻）、篠原凛、伴启介、所长。',
      foes: '怪兽、宇宙威胁、暗之亚刻（剧场版）。',
      impact: '以温柔、明亮的调性获得家庭观众支持，并完成“怪兽共生”主题的又一次变奏。',
      links: '剧场版《超次元大决战！光与暗的亚刻》于 2025.02.21 上映。'
    }
  },
  {
    id: 'arc-movie', title: '亚刻奥特曼 THE MOVIE 超次元大决战！光与暗的亚刻', jp: 'ウルトラマンアーク THE MOVIE 超次元大決戦！光と闇のアーク', en: 'ULTRAMAN ARC THE MOVIE', year: 2025,
    date: '2025.02.21', type: '剧场版', phase: 'reiwa', heroes: ['arc'],
    synopsis: '亚刻与优马被卷入超次元规模的冲突，面对与自身光之力相对的“暗之亚刻”。',
    significance: '《亚刻》的剧场版续篇，以“光与暗的同源性”为主题完成角色弧光。',
    innovation: '超次元舞台与大规模 CG 战斗；TV 角色与新 guest 共同行动。',
    related: ['arc', 'omega'],
    detail: {
      world: '跨越次元的战场，亚刻的起源与“暗之亚刻”的存在被揭示。',
      chars: '飞世优马、亚刻、SKIP 成员、暗之亚刻。',
      foes: '暗之亚刻、超次元威胁。',
      impact: '为《亚刻》线收束，并让“想象力”主题在剧场规模上完成。',
      links: '时间上位于《奥美迦》之前。'
    }
  },
  {
    id: 'omega', title: '奥美迦奥特曼', jp: 'ウルトラマンオメガ', en: 'ULTRAMAN OMEGA', year: 2025,
    date: '2025.07.05 – 2026.01.17', type: 'TV', phase: 'reiwa', heroes: ['omega'],
    synopsis: '失去记忆的宇宙人坠落到地球，被青年命名为“宙人”，在怪特队的调查与怪兽事件中逐渐找回自己。',
    significance: '令和第七部 TV 系列，以“失忆的宇宙人学习成为地球人”为核心，重新审视奥特曼为何守护地球。',
    innovation: '主角与人类青年组成“宇宙人—地球人”搭档；怪特队（怪兽特殊对策队）与特务班“宇多班”构建新的组织叙事；主监督武居正能、系列构成根元岁三。',
    related: ['arc', 'teo', 'z'],
    detail: {
      world: '现代地球，怪兽灾害常态化；怪特队下设九个实战班与特务班“宇多班”，以调查与对策并重。',
      chars: '大木田宙人（奥美迦）、青年搭档、生物学家市东步、宇多班成员。',
      foes: '接连出现的怪兽、与奥美迦失落记忆相关的威胁。',
      impact: '以“观测与理解”作为变身前的仪式（奥美迦观测手势），延续近年“怪兽也是生命”的主题。',
      links: '官方数据：身高 50m、体重 50,000t；必杀技「雷提克里特光线」。'
    }
  },
  {
    id: 'teo', title: '提欧奥特曼', jp: 'ウルトラマンテオ', en: 'ULTRAMAN TEO', year: 2026,
    date: '2026.07.04 – 播出中', type: 'TV', phase: 'reiwa', heroes: ['teo'],
    synopsis: '故乡行星 H12 被宇宙怪兽毁灭后，孤独的宇宙人逃到地球，以兽医学系学生光石息吹的身份生活，并再次面对毁灭故乡的怪兽。',
    significance: '奥特曼系列 60 周年纪念作，以“失去故乡的蓝色巨人”与“不擅长战斗的奥特曼”为命题，重新定义英雄的起点。',
    innovation: '系列罕见的“主角为兽医学学生 + 天文研究社”的青春群像；主监督二宫崇、系列构成田边茂范、主特摄监督辻本贵则；设计由后藤正行担当。',
    related: ['omega', 'arc'],
    note: '中文译名暂用「提欧奥特曼」，以官方引进版本为准。',
    detail: {
      world: '行星 H12 与地球；明心大学兽医学部、天文研究社，以及联合国与 NASA 共同成立的国际机构 UTTF。',
      chars: '光石息吹（提欧）、天文研究社的伙伴、美浓部教授、UTTF 调查员。',
      foes: '毁灭 H12 的宇宙怪兽与接连出现的巨型生物。',
      impact: '首集《从 H12 来的男人》于 2026.07.04 播出；以“尽量不战斗的奥特曼”为核心概念。',
      links: '官方数据：身高 45m、体重 36,000t；必杀技「提欧修姆光线」，变身道具「提欧水晶」。'
    }
  },
  {
    id: 'superior-8', title: '大决战！超奥特8兄弟', jp: '大決戦！超ウルトラ8兄弟', en: 'SUPERIOR 8 ULTRA BROTHERS', year: 2008,
    date: '2008.09.13', type: '剧场版', phase: 'millennium', heroes: ['ultraman', 'seven', 'jack', 'ace', 'taro', 'tiga', 'dyna', 'gaia'],
    synopsis: '在平行世界的横滨，八位奥特曼与人类并肩，对抗使世界陷入绝望的怪兽军团。',
    significance: '昭和与平成奥特曼第一次大规模共演，以“如果奥特曼没有来过地球”的假设展开情感叙事。',
    innovation: '平行世界 + 全明星阵容；把“英雄与人类的羁绊”作为战斗力的来源。',
    related: ['tiga', 'dyna', 'gaia', 'mebius'],
    detail: {
      world: '奥特曼只存在于电视里的平行世界横滨，八位英雄以“记忆”为钥匙降临。',
      chars: '圆大古、飞鸟信、高山我梦、早田进、诸星团、乡秀树、北斗星司、东光太郎。',
      foes: '基里艾洛德人、怪兽军团、暗黑势力。',
      impact: '成为平成一期最具纪念性的群像电影，也为此后的“全明星”作品定下规模。',
      links: '与《梦比优斯》同年，属于 40 周年纪念体系。'
    }
  }
];
