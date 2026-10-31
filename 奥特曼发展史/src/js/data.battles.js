/* ============================================================
   DATA — 经典战役
   quote 统一为本站策展注解，不伪造角色台词。
   ============================================================ */
window.DATA_BATTLES = [
  {
    id: 'b-zetton', title: '杰顿战役', sub: '英雄第一次倒下', year: 1966,
    works: ['ultraman'], heroes: ['ultraman'], enemy: '杰顿', left: 'ultraman', right: null,
    participants: ['初代奥特曼', '杰顿', '科学特搜队', '佐菲'],
    bg: '宇宙恐龙杰顿受宇宙人控制降临地球。它能够吸收并反射光线，还能瞬间移动，科学特搜队的所有武器都失效。',
    course: '初代奥特曼在能量耗尽前发射斯派修姆光线，却被杰顿吸收并反弹。彩色计时器归零，奥特曼倒地。',
    result: '佐菲赶到，将生命与能量分予奥特曼；杰顿最终被击败，但“英雄会死”的事实已经成立。',
    impact: '系列第一次让主角战死，奠定“胜利需要代价”的叙事伦理。',
    events: ['e-zetton'],
    quote: '光之巨人第一次被证明并非不可战胜——也正因为如此，他后来的每一次站起才具有重量。'
  },
  {
    id: 'b-gos', title: '戈斯星人最终决战', sub: '地球的守夜人', year: 1968,
    works: ['seven'], heroes: ['seven'], enemy: '戈斯星人与庞敦', left: 'seven', right: null,
    participants: ['赛文', '奥特警备队', '戈斯星人', '庞敦'],
    bg: '戈斯星人企图用怪兽与导弹摧毁地球，奥特警备队在赛文的带领下展开最后防御。',
    course: '赛文以头镖与艾梅利姆光线连续作战，在能量与身体濒临极限时仍坚持守护地球。',
    result: '侵略被阻止，赛文离开地球，把未来交给人类。',
    impact: '赛文的结局不是“胜利庆典”，而是“守护者退场”，为《平成赛文》系列的成人化续篇留下空间。',
    events: [],
    quote: '他没有留下雕像，只留下一个需要人类自己守护的地球。'
  },
  {
    id: 'b-yapool', title: '异次元人亚波人之战', sub: '超兽与兄弟', year: 1972,
    works: ['ace'], heroes: ['ace'], enemy: '亚波人与超兽', left: 'ace', right: null,
    participants: ['艾斯', '北斗星司', '南夕子', 'TAC', '亚波人'],
    bg: '异次元人亚波人制造超兽，企图以异次元力量侵略地球。艾斯作为奥特兄弟的一员被派往地球。',
    course: '艾斯与 TAC 在多次战斗中逐渐掌握超兽的弱点，并以断头刀与梅塔利姆光线反击。',
    result: '亚波人的计划被挫败，但超兽与异次元的威胁并未根除。',
    impact: '确立“敌人是军势而非单只怪兽”的叙事，也让奥特兄弟的协同作战成为常态。',
    events: ['e-ultra-brothers'],
    quote: '当敌人来自另一个次元，英雄就不再是一个人的职业。'
  },
  {
    id: 'b-magma', title: 'L77 的复仇', sub: '失去故乡的王子', year: 1974,
    works: ['leo'], heroes: ['leo'], enemy: '马格马星人', left: 'leo', right: null,
    participants: ['雷欧', '赛文', '马格马星人', '孪生怪兽'],
    bg: '马格马星人毁灭了雷欧的故乡 L77，并追击到地球。雷欧在赛文的训练下以格斗术迎战。',
    course: '雷欧与孪生怪兽、马格马星人反复交手，赛文以严厉的训练与自我牺牲支持他。',
    result: '马格马星人被击败，但 L77 已无法复原，雷欧继续留在地球。',
    impact: '系列最沉重的复仇叙事，也把“格斗”提升为一种角色语言。',
    events: ['e-l77'],
    quote: '复仇成功了，故乡却没有回来——这是雷欧故事的真正底色。'
  },
  {
    id: 'b-gatanothor', title: '加坦杰厄决战', sub: '光的孩子们', year: 1997,
    works: ['tiga'], heroes: ['tiga'], enemy: '加坦杰厄', left: 'tiga', right: null,
    participants: ['迪迦', '圆大古', 'GUTS', '加坦杰厄'],
    bg: '邪神加坦杰厄苏醒，用黑雾笼罩地球，使迪迦失去力量并化为石像。',
    course: '全世界孩子们的光汇聚成新的力量，迪迦以闪耀形态复活，与加坦杰厄展开最终决战。',
    result: '加坦杰厄被击败，黑雾消散；迪迦与人类共同守护了地球。',
    impact: '“人类的光让英雄复活”成为平成奥特曼最著名的主题表达，也确立了迪迦的文化地位。',
    events: ['e-super-ancient'],
    quote: '这不是英雄拯救人类，而是人类与英雄互相照亮。'
  },
  {
    id: 'b-gransphere', title: '格兰斯菲亚决战', sub: '飞向宇宙的答案', year: 1998,
    works: ['dyna'], heroes: ['dyna'], enemy: '格兰斯菲亚', left: 'dyna', right: null,
    participants: ['戴拿', '飞鸟信', 'Super GUTS', '格兰斯菲亚'],
    bg: '斯菲亚以巨大球体形态逼近太阳系，试图同化地球。飞鸟信与 Super GUTS 决定主动出击。',
    course: '戴拿在宇宙空间与格兰斯菲亚交战，被吞入内部后仍以索尔捷特光线反击。',
    result: '格兰斯菲亚被击破，戴拿在爆炸中消失，去向不明。',
    impact: '开放式结局把“人类走向宇宙”的主题推到极致，也为多年后的《奥特曼传奇》留下回归的伏笔。',
    events: ['e-decker-sphere'],
    quote: '他没有回到地球，而是把地球的未来交给了继续出发的人。'
  },
  {
    id: 'b-zog', title: '佐格决战', sub: '地球的两种答案', year: 1999,
    works: ['gaia'], heroes: ['gaia', 'agul'], enemy: '佐格', left: 'gaia', right: 'agul',
    participants: ['盖亚', '阿古茹', '高山我梦', '藤宫博也', 'XIG', '佐格'],
    bg: '根源性破灭招来体的最终兵器佐格降临，地球面临被“重置”的危机。',
    course: '曾对立的盖亚与阿古茹并肩作战，XIG 与炼金之星全力支援，两位奥特曼以合体技反击。',
    result: '佐格被击败，地球意志与人类达成新的平衡。',
    impact: '用“和解”而非“消灭”解决理念冲突，使《盖亚》成为平成三部作中主题最完整的一作。',
    events: ['e-tdg-cross'],
    quote: '两个都爱地球的人，用了整部作品才学会站在同一边。'
  },
  {
    id: 'b-empera', title: '安培拉星人决战', sub: '三万年的因果', year: 2007,
    works: ['mebius'], heroes: ['mebius'], enemy: '安培拉星人', left: 'mebius', right: null,
    participants: ['梦比优斯', 'GUYS', '奥特兄弟', '安培拉星人', '佐菲'],
    bg: '安培拉星人再度降临，以暗黑力量使太阳熄灭，光之国与地球同时陷入危机。',
    course: '梦比优斯与 GUYS 拼死抵抗，奥特兄弟与佐菲赶来支援，最终以全员的能量击破安培拉。',
    result: '安培拉星人被击败，光与暗的古老战争画上句号，梦比优斯完成成长。',
    impact: '昭和世界观在 21 世纪的正式收束，40 周年纪念的情感核心。',
    events: ['e-empera-return', 'e-great-war'],
    quote: '三万年后的胜负，靠的仍是同一件事：有人愿意替别人站在前面。'
  },
  {
    id: 'b-belial-legend', title: '怪兽墓场决战', sub: '赛罗初阵', year: 2009,
    works: ['ultra-galaxy-legend'], heroes: ['zero'], enemy: '贝利亚', left: 'zero', right: null,
    participants: ['赛罗', '贝利亚', '奥特之王', '雷', '初代', '赛文', '梦比优斯'],
    bg: '贝利亚越狱并夺取等离子火花，光之国冻结；他在怪兽墓场集结百体怪兽，准备反攻。',
    course: '赛罗在奥特之王的试炼后获得力量，与雷和奥特战士突入怪兽墓场，正面击破贝利亚。',
    result: '等离子火花被夺回，光之国解冻；赛罗正式成为宇宙警备队的一员。',
    impact: '开启赛罗时代，并让“电影宇宙”成为系列的新支柱。',
    events: ['e-belial-escape'],
    quote: '这不是一场守卫战，而是一个新英雄的入场式。'
  },
  {
    id: 'b-darklugiel', title: '黑暗火花战争', sub: '被冻结的光', year: 2013,
    works: ['ginga'], heroes: ['ginga'], enemy: '黑暗路基艾尔', left: 'ginga', right: null,
    participants: ['银河', '礼堂光', '黑暗路基艾尔', 'UPG'],
    bg: '黑暗路基艾尔发动黑暗火花战争，把奥特曼与怪兽全部变成火花人偶，时间停止流动。',
    course: '礼堂光获得银河火花，与被冻结的伙伴们一起夺回光，最终与黑暗路基艾尔正面对决。',
    result: '黑暗路基艾尔被击败，火花人偶逐渐复原。',
    impact: '新生代英雄的起点，确立“借力/人偶”式的叙事与商业结构。',
    events: ['e-ginga-war'],
    quote: '当所有英雄都变成玩具，仍然有人愿意相信光。'
  },
  {
    id: 'b-magaorochi', title: '玛伽大蛇决战', sub: '魔王兽的终局', year: 2016,
    works: ['orb'], heroes: ['orb'], enemy: '玛伽大蛇', left: 'orb', right: null,
    participants: ['欧布', '红凯', '伽古拉', 'SSP', '玛伽大蛇'],
    bg: '魔王兽的封印接连被解开，最终魔王兽玛伽大蛇苏醒，威胁整个地球。',
    course: '欧布以奥特融合卡借用历代英雄之力，在 SSP 与伽古拉的复杂协助下迎战。',
    result: '玛伽大蛇被击败，但欧布与伽古拉之间的因缘并未结束。',
    impact: '“借力”成为新生代核心语法，也让不同世代的英雄在同一场战斗中对话。',
    events: ['e-orb-origin'],
    quote: '他借来的不只是力量，还有每一位前辈曾经相信过的东西。'
  },
  {
    id: 'b-geed-belial', title: '父子决战', sub: '基因之外的选择', year: 2017,
    works: ['geed'], heroes: ['geed'], enemy: '贝利亚', left: 'geed', right: null,
    participants: ['捷德', '朝仓陆', '贝利亚', '赛罗'],
    bg: '贝利亚的野心再度膨胀，而他的基因复制体朝仓陆已选择成为捷德。',
    course: '捷德与赛罗并肩作战，在多次失败后以自身意志对抗贝利亚的绝对力量。',
    result: '贝利亚被击败，捷德证明了自己不是父亲的延续。',
    impact: '系列最著名的反派获得情感收束，也把“出身不能决定选择”写成明确主题。',
    events: ['e-geed-birth'],
    quote: '他继承了父亲的光之基因，却拒绝了父亲的道路。'
  },
  {
    id: 'b-destrudos', title: '德斯特鲁多斯决战', sub: '最后的怪兽', year: 2020,
    works: ['z'], heroes: ['z'], enemy: '德斯特鲁多斯', left: 'z', right: null,
    participants: ['泽塔', '夏川遥辉', 'STORAGE', '赛雷布洛', '德斯特鲁多斯'],
    bg: '赛雷布洛收集恶魔碎片，制造出融合多只怪兽的德斯特鲁多斯，地球陷入绝境。',
    course: '泽塔与遥辉在 STORAGE 的支援下连续作战，以泽斯蒂姆光线完成最后一击。',
    result: '德斯特鲁多斯被击败，恶魔碎片危机解除，遥辉与泽塔继续守护地球。',
    impact: '令和时代的高评价决战，把防卫队群像与英雄成长同时推向高潮。',
    events: ['e-z-devilo'],
    quote: '这不是天才的胜利，而是一个见习战士和一群普通人一起撑到的结果。'
  },
  {
    id: 'b-carmeara', title: '卡尔蜜拉决战', sub: '永恒核心的尽头', year: 2021,
    works: ['trigger'], heroes: ['trigger'], enemy: '卡尔蜜拉', left: 'trigger', right: null,
    participants: ['特利迦', '真中剑悟', '卡尔蜜拉', 'GUTS-SELECT'],
    bg: '黑暗巨人卡尔蜜拉执念于特利迦与永恒核心，试图以黑暗吞噬一切。',
    course: '真中剑悟在伙伴的支持下反复站起，与卡尔蜜拉展开跨越光暗的最终对决。',
    result: '卡尔蜜拉被击败，永恒核心的危机暂时平息。',
    impact: '完成“迪迦—特利迦”的跨世代对话，也让令和版超古代叙事落地。',
    events: ['e-trigger-eternity'],
    quote: '他继承的不是迪迦的力量，而是“选择光”的那一次决定。'
  },
  {
    id: 'b-sphere', title: '斯菲亚决战', sub: '被封锁的地球', year: 2023,
    works: ['decker'], heroes: ['decker'], enemy: '斯菲亚', left: 'decker', right: null,
    participants: ['德凯', '明日见奏大', 'GUTS-SELECT', '斯菲亚'],
    bg: '斯菲亚以屏障封锁地球，企图将人类与宇宙彻底隔绝并同化。',
    course: '德凯与 GUTS-SELECT 在封闭环境中反复突破，最终直面斯菲亚的核心。',
    result: '斯菲亚的攻势被遏制，人类重新获得与宇宙连接的可能。',
    impact: '以“封锁”作为危机形式，延续《戴拿》的宇宙威胁谱系。',
    events: ['e-decker-sphere'],
    quote: '被关在星球上的人类，仍然选择了向宇宙伸手。'
  },
  {
    id: 'b-darkarc', title: '光与暗的亚刻', sub: '超次元大决战', year: 2025,
    works: ['arc-movie'], heroes: ['arc'], enemy: '暗之亚刻', left: 'arc', right: null,
    participants: ['亚刻', '飞世优马', 'SKIP', '暗之亚刻'],
    bg: '超次元的冲突把亚刻与优马卷入其中，与亚刻相对的存在“暗之亚刻”现身。',
    course: '亚刻在优马与伙伴的支援下，以想象力具现力量，与暗之亚刻展开决战。',
    result: '暗之亚刻被击败，光与暗的同源性得到确认。',
    impact: '为《亚刻》线收束，并把“想象力”主题推到剧场规模。',
    events: ['e-arc-imagination'],
    quote: '能够创造光的想象力，同样能够理解暗。'
  },
  {
    id: 'b-tdg', title: '超时空大决战', sub: '三个世界的孩子', year: 1999,
    works: ['tdg-movie'], heroes: ['tiga', 'dyna', 'gaia'], enemy: '红球召唤的怪兽', left: 'tiga', right: 'gaia',
    participants: ['迪迦', '戴拿', '盖亚', '圆大古', '飞鸟信', '高山我梦'],
    bg: '少年们通过神秘红球许愿，意外把三个不同世界的奥特曼与怪兽拉到同一时空。',
    course: '三位光之巨人首次并肩，与红球召唤的怪兽军团展开跨世界作战。',
    result: '危机解除，三个世界恢复原状，英雄之间留下跨宇宙的联系。',
    impact: '首次证明不同世界观可以共演，为后续多元宇宙叙事提供合法性。',
    events: ['e-tdg-cross'],
    quote: '三个地球，三个英雄，一次共同的许愿。'
  },
  {
    id: 'b-superior8', title: '八兄弟决战', sub: '如果英雄只存在于电视里', year: 2008,
    works: ['superior-8'], heroes: ['ultraman', 'seven', 'jack', 'ace', 'taro', 'tiga', 'dyna', 'gaia'], enemy: '怪兽军团', left: 'ultraman', right: 'tiga',
    participants: ['初代', '赛文', '杰克', '艾斯', '泰罗', '迪迦', '戴拿', '盖亚'],
    bg: '平行世界的横滨，奥特曼只是电视里的角色，怪兽却真实降临。',
    course: '八位奥特曼通过人类的记忆与羁绊被召唤，与当地人类共同迎战怪兽军团。',
    result: '怪兽军团被击退，两个世界的“英雄与人类”关系得到确认。',
    impact: '昭和与平成奥特曼第一次全员同框，成为平成一期最具纪念性的群像电影。',
    events: ['e-superior-8'],
    quote: '英雄需要被相信，才能从屏幕里走出来。'
  }
];
