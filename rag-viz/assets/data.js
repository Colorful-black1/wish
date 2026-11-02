/* ============================================================================
 * data.js —— 语料、问题、概念标注、文案
 *
 * 设计原则：
 *   1. 三份制度文档直接取自 rag/sample_docs/，文字不改，保证和已有实验口径一致；
 *   2. 额外加一份 IT 服务台文档，专门用来演示「精确编号」（错误码 / 工号）检索；
 *   3. 每个章节手工标注「概念权重」。它只用来生成**示意向量**，不参与分块与 BM25。
 *      （真实 embedding 是神经网络给的，这里用概念向量代替，见 README「已知失真」）
 * ========================================================================== */

(function (global) {
  "use strict";

  /* ------------------------------------------------------------------ 概念
   * 一个概念 = 一个语义方向。keyword 用于理解自由输入的问题。
   * doc 表示这个概念主要属于哪份文档：生成向量时会让它靠近该文档的主题方向。
   */
  const CONCEPTS = {
    travel_policy: {
      label: "差旅制度总则", doc: "travel",
      keywords: ["差旅", "出差", "适用范围", "制度", "交通费", "住宿费", "餐饮补贴", "公务"]
    },
    lodging: {
      label: "住宿标准", doc: "travel",
      keywords: ["住宿", "酒店", "房费", "每晚", "标准间", "限额", "一线城市", "二线城市", "合住"]
    },
    transport: {
      label: "交通标准", doc: "travel",
      keywords: ["交通", "高铁", "动车", "飞机", "机票", "经济舱", "公务舱", "二等座", "一等座", "自驾", "网约车", "燃油"]
    },
    meal: {
      label: "餐饮补贴", doc: "travel",
      keywords: ["餐补", "餐饮", "吃饭", "用餐", "伙食"]
    },
    reimburse_flow: {
      label: "报销流程", doc: "travel",
      keywords: ["报销", "单据", "报销单", "发票", "提交", "时限", "复核", "财务", "打款", "过期"]
    },
    approval: {
      label: "审批权限", doc: "travel",
      keywords: ["审批", "主管", "负责人", "副总", "批准", "复核"]
    },
    annual_leave: {
      label: "年假天数", doc: "leave",
      keywords: ["年假", "天数", "年限", "几天", "假期", "入职"]
    },
    leave_apply: {
      label: "休假申请", doc: "leave",
      keywords: ["休假", "请假", "申请", "顺延", "提前几个工作日"]
    },
    leave_convert: {
      label: "未休年假折算", doc: "leave",
      keywords: ["折算", "工资", "未休", "离职", "300%", "结算"]
    },
    password: {
      label: "密码策略", doc: "security",
      keywords: ["密码", "位数", "90天", "大写", "小写", "特殊符号", "锁定", "解锁"]
    },
    vpn: {
      label: "VPN 与远程办公", doc: "security",
      keywords: ["VPN", "远程", "断开", "下线", "认证", "公共电脑", "外网"]
    },
    data_class: {
      label: "数据分级", doc: "security",
      keywords: ["数据", "机密", "绝密", "内部", "公开", "外传", "加密通道"]
    },
    endpoint: {
      label: "终端安全", doc: "security",
      keywords: ["电脑", "补丁", "防火墙", "锁屏", "终端", "软件", "遗失"]
    },
    incident: {
      label: "安全事件报告", doc: "security",
      keywords: ["事件", "钓鱼", "异常登录", "泄露", "报告", "热线", "处罚"]
    },
    err_code: {
      label: "故障码", doc: "it",
      keywords: ["错误", "错误码", "故障码", "E1024", "E1025", "E2024", "E3001", "超时", "令牌", "限流"]
    },
    permission: {
      label: "权限申请", doc: "it",
      keywords: ["权限", "工号", "A-2024-7781", "三级", "只读", "导出", "复核"]
    },
    support: {
      label: "服务台支持", doc: "it",
      keywords: ["服务台", "热线", "工单", "值班", "8888", "报修"]
    }
  };

  /* -------------------------------------------------------------- 文档语料 */
  const DOCS = [
    {
      id: "travel",
      name: "员工差旅报销制度.md",
      short: "差旅报销",
      dept: "财务部",
      owner: "finance@example.com",
      updated: "2026-09-12",
      version: "v3.2",
      color: "#60a5fa",
      sections: [
        {
          h1: "员工差旅报销制度", h2: null,
          concepts: { travel_policy: 0.9, approval: 0.55, reimburse_flow: 0.45 },
          paras: [
            "本制度适用于公司全体正式员工与实习生。出差前须在 OA 系统提交出差申请，经直属主管审批通过后方可出行。未经审批产生的费用，原则上不予报销。"
          ]
        },
        {
          h1: "员工差旅报销制度", h2: "第一章 适用范围",
          concepts: { travel_policy: 0.95, reimburse_flow: 0.5, approval: 0.2 },
          paras: [
            "本制度覆盖因公出差产生的交通费、住宿费、餐饮补贴以及其他经批准的合理费用。市内日常通勤、客户招待、团建活动不适用本制度，另按相关办法执行。",
            "员工在出差期间因个人原因延长停留所产生的费用，由个人承担。出差期间恰逢法定节假日的，按加班管理办法另行处理，不影响本制度的报销标准。"
          ]
        },
        {
          h1: "员工差旅报销制度", h2: "第二章 住宿标准",
          concepts: { lodging: 1.0, travel_policy: 0.35, reimburse_flow: 0.2 },
          paras: [
            "住宿费按城市等级实行限额管理，凭酒店发票实报实销，超出限额部分由个人承担。",
            "- 一线城市（北京、上海、广州、深圳）：每人每晚不超过 600 元。",
            "- 二线城市（省会城市及计划单列市）：每人每晚不超过 400 元。",
            "- 其他城市：每人每晚不超过 300 元。",
            "两名及以上同性员工同行时，原则上应合住标准间。因公司统一安排会议或培训导致酒店由主办方指定的，凭会议通知按实际发生额报销，不受上述限额限制。"
          ]
        },
        {
          h1: "员工差旅报销制度", h2: "第三章 交通标准",
          concepts: { transport: 1.0, travel_policy: 0.3, approval: 0.35 },
          paras: [
            "- 高铁及动车：乘坐二等座，行程超过 6 小时的可乘坐一等座。",
            "- 飞机：乘坐经济舱。需要乘坐公务舱的，须由部门负责人和分管副总共同审批。",
            "- 飞机出行须提前 7 天提交申请，以便比价和锁定低价票；因紧急事务无法提前申请的，须在申请中说明原因。",
            "- 市内交通：优先选择公共交通，网约车单次不超过 100 元，超过部分需说明事由。",
            "自驾出差的，按每公里 1.2 元补贴燃油及车辆损耗，过路费、停车费凭票据实报实销。"
          ]
        },
        {
          h1: "员工差旅报销制度", h2: "第四章 餐饮补贴",
          concepts: { meal: 1.0, travel_policy: 0.3 },
          paras: [
            "餐饮补贴按出差自然日计算，无需发票，随报销单一并发放。",
            "- 一线城市：每人每天 150 元。",
            "- 二线城市：每人每天 120 元。",
            "- 其他城市：每人每天 100 元。",
            "出差期间如已由客户或主办方安排用餐，相应餐次的补贴不再发放。补贴按半天计算的，减半发放。"
          ]
        },
        {
          h1: "员工差旅报销制度", h2: "第五章 报销流程",
          concepts: { reimburse_flow: 1.0, approval: 0.45, travel_policy: 0.2 },
          paras: [
            "1. 出差结束后 10 个工作日内，在 OA 系统提交报销单。",
            "2. 上传发票、行程单、出差审批单三项材料，缺一不可。",
            "3. 直属主管审批后，转财务复核；财务复核一般在 3 个工作日内完成。",
            "4. 复核通过后，报销款于次月 15 日随工资一并发放。",
            "超过 30 个工作日未提交的报销单，需由部门负责人出具书面说明，否则财务有权拒收。跨年度费用原则上不予报销。"
          ]
        },
        {
          h1: "员工差旅报销制度", h2: "第六章 不予报销的情形",
          concepts: { travel_policy: 0.75, reimburse_flow: 0.5, approval: 0.25 },
          paras: [
            "- 个人消费、娱乐、购物等与公务无关的支出。",
            "- 未经审批的升舱、酒店升级、延长住宿。",
            "- 因个人原因产生的罚款、赔偿、行李超重费。",
            "- 发票抬头不是公司全称，或发票内容与实际业务不符。",
            "- 同一笔费用重复报销。"
          ]
        },
        {
          h1: "员工差旅报销制度", h2: "第七章 附则",
          concepts: { travel_policy: 0.6 },
          paras: [
            "本制度由财务部负责解释，自发布之日起施行。此前发布的相关规定与本制度不一致的，以本制度为准。"
          ]
        }
      ]
    },

    {
      id: "leave",
      name: "员工年假管理办法.md",
      short: "年假管理",
      dept: "人力资源部",
      owner: "hr@example.com",
      updated: "2026-06-30",
      version: "v2.1",
      color: "#34d399",
      sections: [
        {
          h1: "员工年假管理办法", h2: null,
          concepts: { annual_leave: 0.7, leave_apply: 0.2 },
          paras: [
            "为保障员工休息休假权利，结合公司实际，制定本办法。年假与国家法定节假日、休息日分别计算，不互相抵扣。"
          ]
        },
        {
          h1: "员工年假管理办法", h2: "年假天数",
          concepts: { annual_leave: 1.0, leave_apply: 0.2 },
          paras: [
            "年假天数按员工累计工作年限确定，入职当年度按剩余日历天数折算。",
            "- 累计工作满 1 年不满 10 年：每年 5 天。",
            "- 累计工作满 10 年不满 20 年：每年 10 天。",
            "- 累计工作满 20 年以上：每年 15 天。",
            "新入职员工当年度年假 = 全年应享天数 × 当年度剩余日历天数 ÷ 365，折算后不足 1 整天的部分不享受。累计工作年限以社保缴纳记录或前单位离职证明为准。"
          ]
        },
        {
          h1: "员工年假管理办法", h2: "申请流程",
          concepts: { leave_apply: 1.0, approval: 0.4, annual_leave: 0.3 },
          paras: [
            "1. 员工在 OA 系统提交休假申请，注明起止日期。",
            "2. 年假须提前 3 个工作日申请，连续休假超过 5 天的须提前 10 个工作日申请。",
            "3. 直属主管审批通过后生效；涉及跨部门协作的，需同步告知相关同事。",
            "4. 因项目紧急无法休假的，可与主管协商顺延，顺延最晚不超过次年 3 月 31 日。"
          ]
        },
        {
          h1: "员工年假管理办法", h2: "未休年假折算",
          concepts: { leave_convert: 1.0, annual_leave: 0.35 },
          paras: [
            "公司鼓励员工合理安排休假。确因工作需要未能休完当年年假的，经员工本人书面同意后，可按日工资的 300% 折算工资，其中包含正常工作期间的工资收入。",
            "折算部分于次年第一季度随工资发放。员工主动放弃休假的，需签署书面声明；未签署声明且未休完的，视为公司安排原因，按上述标准折算。"
          ]
        },
        {
          h1: "员工年假管理办法", h2: "其他规定",
          concepts: { annual_leave: 0.6, leave_apply: 0.45 },
          paras: [
            "- 年假可以分段使用，每次不少于半天。",
            "- 年假不与病假、事假冲抵。",
            "- 员工离职时，当年度应休未休年假按上述标准折算，随最后一期工资发放。"
          ]
        },
        {
          h1: "员工年假管理办法", h2: "附则",
          concepts: { annual_leave: 0.35 },
          paras: [
            "本办法由人力资源部负责解释，自发布之日起施行。"
          ]
        }
      ]
    },

    {
      id: "security",
      name: "信息系统安全规范.md",
      short: "信息安全",
      dept: "信息安全部",
      owner: "security@example.com",
      updated: "2026-08-18",
      version: "v4.0",
      color: "#f59e0b",
      sections: [
        {
          h1: "信息系统安全规范", h2: null,
          concepts: { data_class: 0.4, endpoint: 0.3, password: 0.2 },
          paras: [
            "本规范适用于公司所有员工、外包人员及实习人员。违反本规范造成损失的，公司将依法依规追究责任。"
          ]
        },
        {
          h1: "信息系统安全规范", h2: "账号与密码",
          concepts: { password: 1.0, vpn: 0.15 },
          paras: [
            "- 公司账号密码长度不得少于 12 位，必须同时包含大写字母、小写字母、数字和特殊符号。",
            "- 密码每 90 天更换一次，且不得与前 5 次使用过的密码重复。",
            "- 禁止在多个系统使用同一密码，禁止将密码写在便签、文档或代码注释中。",
            "- 连续 5 次输入错误将锁定账号 30 分钟，需联系 IT 服务台解锁。"
          ]
        },
        {
          h1: "信息系统安全规范", h2: "VPN 与远程办公",
          concepts: { vpn: 1.0, endpoint: 0.25 },
          paras: [
            "- 在公司网络之外访问内部系统，必须通过公司 VPN。",
            "- VPN 账号仅限本人使用，禁止共享或转借。",
            "- 远程办公时不得使用公共电脑登录内部系统，不得在公共场所大声讨论涉密信息。",
            "- VPN 连接连续 8 小时无操作会自动断开，需重新认证。"
          ]
        },
        {
          h1: "信息系统安全规范", h2: "数据分级",
          concepts: { data_class: 1.0, approval: 0.2 },
          paras: [
            "公司数据分为公开、内部、机密、绝密四级。",
            "- 公开数据：可对外发布，如宣传材料。",
            "- 内部数据：仅限公司内部使用，如会议纪要、组织架构。",
            "- 机密数据：仅限项目相关人员访问，如客户合同、财务数据。",
            "- 绝密数据：仅限授权人员访问，如核心算法、并购信息。",
            "机密及以上数据禁止通过个人邮箱、个人网盘、即时通讯工具外传。确需外发的，须经数据所有者审批并使用公司加密通道。"
          ]
        },
        {
          h1: "信息系统安全规范", h2: "终端安全",
          concepts: { endpoint: 1.0 },
          paras: [
            "- 办公电脑必须安装公司统一的终端防护软件，不得私自卸载。",
            "- 操作系统和办公软件的安全补丁须在发布后 7 天内完成安装。",
            "- 禁止安装来源不明的软件，禁止关闭防火墙。",
            "- 笔记本电脑离开工位时必须锁屏，遗失或被盗须在 2 小时内报告 IT 服务台。"
          ]
        },
        {
          h1: "信息系统安全规范", h2: "事件报告",
          concepts: { incident: 1.0, endpoint: 0.2 },
          paras: [
            "发现钓鱼邮件、异常登录、数据泄露等安全事件，应在 1 小时内通过安全事件热线报告，不得自行处理或隐瞒。误点钓鱼链接的，及时报告可免除处罚。"
          ]
        },
        {
          h1: "信息系统安全规范", h2: "附则",
          concepts: { data_class: 0.3 },
          paras: [
            "本规范由信息安全部负责解释，每年评审一次。"
          ]
        }
      ]
    },

    {
      id: "it",
      name: "IT 服务台故障码与权限速查.md",
      short: "IT 服务台",
      dept: "IT 服务台",
      owner: "it@example.com",
      updated: "2026-10-20",
      version: "v1.3",
      color: "#f472b6",
      sections: [
        {
          h1: "IT 服务台故障码与权限速查", h2: null,
          concepts: { err_code: 0.6, support: 0.4 },
          paras: [
            "本文汇总线上系统最常见的故障码与权限申请规则，供自助排查使用。无法解决时请联系服务台。"
          ]
        },
        {
          h1: "IT 服务台故障码与权限速查", h2: "E1024 数据库连接超时",
          concepts: { err_code: 1.0, support: 0.2 },
          paras: [
            "E1024 表示数据库连接超时，通常是连接池耗尽导致。先检查慢查询和当前连接数，再考虑重启服务实例。",
            "出现 E1024 时页面一般会持续转圈，重试不会恢复，需要先释放连接。"
          ]
        },
        {
          h1: "IT 服务台故障码与权限速查", h2: "E1025 鉴权令牌过期",
          concepts: { err_code: 1.0, permission: 0.2 },
          paras: [
            "E1025 表示登录令牌（token）已过期。重新登录或刷新 token 即可，不需要重启服务。",
            "如果反复出现 E1025，检查客户端时间是否与服务器同步。"
          ]
        },
        {
          h1: "IT 服务台故障码与权限速查", h2: "E2024 文件存储配额不足",
          concepts: { err_code: 1.0 },
          paras: [
            "E2024 表示对象存储配额不足。清理回收站或提交扩容工单，扩容审批一般需要 2 个工作日。"
          ]
        },
        {
          h1: "IT 服务台故障码与权限速查", h2: "E3001 网关限流",
          concepts: { err_code: 1.0 },
          paras: [
            "E3001 表示请求触发网关限流（QPS 上限）。请按响应头里的 Retry-After 退避重试，不要立即重放。"
          ]
        },
        {
          h1: "IT 服务台故障码与权限速查", h2: "权限申请",
          concepts: { permission: 1.0, approval: 0.45 },
          paras: [
            "- 工号 A-2024-7781 可申请三级权限（只读 + 导出）。",
            "- 申请入口：OA → IT 服务 → 权限申请，审批人为主管和系统负责人。",
            "- 二级及以上权限每 6 个月复核一次，离职当日回收。"
          ]
        },
        {
          h1: "IT 服务台故障码与权限速查", h2: "服务台联系方式",
          concepts: { support: 1.0 },
          paras: [
            "7×24 值班热线 8888；非紧急问题请在工单系统提交，工作日 4 小时内响应。"
          ]
        }
      ]
    }
  ];

  /* ---------------------------------------------------------------- 问题集
   * concepts —— 用来构造「示意查询向量」的权重；
   * facts    —— 判定答案是否真的被检索到的关键事实（同时用于 rerank 的答案覆盖度）；
   * rewrite / multi / hyde —— 查询理解阶段的演示产物。
   */
  const QUERIES = [
    {
      id: "q1",
      label: "上海住宿能报多少",
      text: "上海出差住宿一晚最多能报销多少",
      concepts: { lodging: 1.0, travel_policy: 0.2 },
      facts: ["600 元", "一线城市"],
      goldSection: "第二章 住宿标准",
      goldDoc: "travel",
      kind: "数值题",
      note: "典型「单跳」问题：答案是一个明确数字，关键在定位到对应城市等级。",
      hallucination: "上海住宿费标准约为每人每晚 500 元（参考中央国家机关差旅标准）。",
      rewrite: "上海出差期间的住宿费报销上限是多少元每晚",
      multi: ["上海住宿费报销上限", "一线城市住宿标准 每晚限额", "差旅住宿费超出限额怎么办"],
      hyde: "上海属于一线城市，员工出差住宿费每人每晚不超过 600 元，超出限额部分由个人承担。"
    },
    {
      id: "q2",
      label: "多久内要交单据",
      text: "出差回来后最晚什么时候交单据",
      concepts: { reimburse_flow: 0.95, approval: 0.15 },
      facts: ["10 个工作日", "报销单"],
      goldSection: "第五章 报销流程",
      goldDoc: "travel",
      kind: "同义改写题",
      note: "「交单据」和文档里的「提交报销单」用词完全不重合，是向量检索的主场、关键词检索的盲区。",
      hallucination: "出差回来后 15 天内提交报销单即可，超过一个月才需要说明。",
      rewrite: "出差结束后提交报销单的时限是多少个工作日",
      multi: ["报销单提交时限", "出差结束多久内报销", "报销流程 材料 时限"],
      hyde: "员工应在出差结束后 10 个工作日内在 OA 系统提交报销单，并上传发票、行程单和出差审批单。"
    },
    {
      id: "q3",
      label: "密码最少几位",
      text: "公司账号密码最少要多少位",
      concepts: { password: 0.95 },
      facts: ["12 位", "特殊符号"],
      goldSection: "账号与密码",
      goldDoc: "security",
      kind: "规则题",
      note: "规则类问题：答案是一串硬性约束，不能靠语义近似，必须原文核对。",
      hallucination: "密码至少 8 位，包含数字和字母即可，每半年更换一次。",
      rewrite: "公司账号密码的长度和字符组成要求是什么",
      multi: ["密码长度要求", "密码复杂度 特殊符号", "账号安全规范"],
      hyde: "公司账号密码长度不得少于 12 位，必须同时包含大写字母、小写字母、数字和特殊符号。"
    },
    {
      id: "q4",
      label: "E1024 是什么错误",
      text: "E1024 是什么错误",
      concepts: { err_code: 1.0 },
      facts: ["E1024", "数据库连接超时"],
      goldSection: "E1024 数据库连接超时",
      goldDoc: "it",
      kind: "精确编号题",
      note: "编号题：E1024 / E1025 / E2024 字面极像，BM25 能精确命中，向量容易在几个相似编号之间摇摆。",
      hallucination: "E1024 一般是网络抖动引起的，多刷新几次页面就会恢复。",
      rewrite: "系统错误码 E1024 表示什么问题，应该怎么处理",
      multi: ["E1024 报错含义", "数据库连接超时 错误码", "服务异常 错误码 排查"],
      hyde: "E1024 表示数据库连接超时，通常由连接池耗尽引起，需要检查慢查询与连接数。"
    },
    {
      id: "q5",
      label: "没休完年假怎么折算",
      text: "没休完的年假怎么折算工资",
      concepts: { leave_convert: 0.95, annual_leave: 0.2 },
      facts: ["300%", "日工资"],
      goldSection: "未休年假折算",
      goldDoc: "leave",
      kind: "口语题",
      note: "口语化提问：没有出现「折算」以外的制度用词，考的是语义召回。",
      hallucination: "未休年假按日工资的 200% 折算，年底一次性发放。",
      rewrite: "应休未休年假的工资折算标准和发放时间",
      multi: ["未休年假 折算标准", "年假 300% 工资", "离职年假结算"],
      hyde: "确因工作需要未休完当年年假的，经员工书面同意，按日工资的 300% 折算工资，次年第一季度发放。"
    },
    {
      id: "q6",
      label: "公司年会几月办（无答案）",
      text: "公司年会在每年几月份举办",
      concepts: {},
      facts: [],
      goldSection: null,
      goldDoc: null,
      kind: "拒答题",
      note: "知识库里根本没有这个信息。RAG 的正确行为是拒答，而不是让模型自由发挥。",
      hallucination: "公司年会一般在每年 1 月中旬举办，具体日期由行政部另行通知。",
      rewrite: "公司年会的举办时间",
      multi: ["年会时间", "公司年会 几月", "年度会议安排"],
      hyde: "公司年会一般在每年 1 月举办。"
    }
  ];

  /* 自由输入时的关键词兜底：从问题里认出概念 */
  const QUERY_HINTS = [
    { re: /(住宿|酒店|房费)/, concept: "lodging" },
    { re: /(机票|飞机|高铁|动车|交通|打车|网约车|自驾)/, concept: "transport" },
    { re: /(餐补|餐饮|吃饭|用餐)/, concept: "meal" },
    { re: /(报销|单据|发票)/, concept: "reimburse_flow" },
    { re: /(审批|谁批|批准)/, concept: "approval" },
    { re: /(年假|休假)/, concept: "annual_leave" },
    { re: /(折算|未休)/, concept: "leave_convert" },
    { re: /(密码|账号|登录)/, concept: "password" },
    { re: /(vpn|远程|外网)/i, concept: "vpn" },
    { re: /(机密|绝密|数据分级|外传)/, concept: "data_class" },
    { re: /(补丁|防火墙|锁屏|电脑)/, concept: "endpoint" },
    { re: /(钓鱼|泄露|安全事件)/, concept: "incident" },
    { re: /(e\d{4}|错误码|故障码|报错)/i, concept: "err_code" },
    { re: /(权限|工号)/, concept: "permission" },
    { re: /(服务台|热线|工单)/, concept: "support" }
  ];

  /* ------------------------------------------------------------ 技术全景
   * status: "demo" = 本页可交互演示；"note" = 仅文字说明（本页不模拟）
   */
  const PANORAMA = [
    {
      phase: "离线：建库",
      color: "#7dd3fc",
      items: [
        { name: "多源接入", en: "Ingestion", status: "note", tip: "PDF / Word / HTML / 飞书 / 数据库；按部门与权限分区" },
        { name: "解析与清洗", en: "Parsing", status: "demo", tip: "版式还原、表格、OCR、去噪、去重（SimHash）" },
        { name: "分块", en: "Chunking", status: "demo", tip: "固定 / 递归 / 标题 / 语义 / 父子块；块大小与 overlap 是权衡" },
        { name: "元数据", en: "Metadata", status: "demo", tip: "来源、章节、时间、部门、密级 —— 过滤和引用都靠它" },
        { name: "向量化", en: "Embedding", status: "demo", tip: "bge / text-embedding-3；归一化、批量、维度、领域微调" },
        { name: "稀疏表示", en: "Sparse", status: "note", tip: "BM25 倒排、SPLADE、learned sparse —— 精确词与编号" },
        { name: "向量索引", en: "ANN Index", status: "demo", tip: "HNSW / IVF-PQ / DiskANN；召回率与延迟、内存的三角权衡" },
        { name: "分片与副本", en: "Sharding", status: "note", tip: "水平扩展、多副本、增量更新与版本回滚" }
      ]
    },
    {
      phase: "在线：查询理解",
      color: "#f0abfc",
      items: [
        { name: "查询改写", en: "Rewrite", status: "demo", tip: "补全指代、去除口语噪声；有跑偏风险" },
        { name: "多查询扩展", en: "Multi-Query", status: "demo", tip: "生成 3~5 个变体，分别召回后融合" },
        { name: "假设文档", en: "HyDE", status: "demo", tip: "先让模型写一段假答案，再用它去检索" },
        { name: "意图路由", en: "Routing", status: "demo", tip: "FAQ 直答 / 检索 / 调工具 / 转人工" },
        { name: "查询向量缓存", en: "Cache", status: "note", tip: "热点问题与语义缓存，直接省掉检索" }
      ]
    },
    {
      phase: "在线：检索",
      color: "#22d3ee",
      items: [
        { name: "混合召回", en: "Hybrid", status: "demo", tip: "dense（语义）+ sparse（关键词）双路并行" },
        { name: "元数据过滤", en: "Filtering", status: "demo", tip: "权限、时效、部门；pre-filter 与 post-filter 影响召回" },
        { name: "近邻搜索", en: "ANN", status: "demo", tip: "HNSW 分层图：上层跳远、下层收窄" },
        { name: "排名融合", en: "RRF", status: "demo", tip: "只看名次不看分数，免调权重" },
        { name: "多样性", en: "MMR", status: "note", tip: "避免 Top-K 全是同一段话的复制块" },
        { name: "重排序", en: "Rerank", status: "demo", tip: "cross-encoder 精排 Top-20/50，贵但准" }
      ]
    },
    {
      phase: "生成与治理",
      color: "#fbbf24",
      items: [
        { name: "上下文组装", en: "Context", status: "demo", tip: "去重、压缩、token 预算、首尾放强证据" },
        { name: "提示词", en: "Prompt", status: "demo", tip: "角色、约束、引用编号、拒答条件" },
        { name: "流式生成", en: "Streaming", status: "demo", tip: "首 token 延迟比总耗时更影响体感" },
        { name: "引用与溯源", en: "Citation", status: "demo", tip: "句级引用、可点击回原文" },
        { name: "忠实度校验", en: "Groundedness", status: "demo", tip: "逐句检查是否被上下文支持，低于阈值就拒答" },
        { name: "评测", en: "Evaluation", status: "demo", tip: "Recall@K / MRR / RAGAS；黄金集要有难例" },
        { name: "可观测与成本", en: "Observability", status: "demo", tip: "分阶段耗时、token 成本、失败率" },
        { name: "安全", en: "Security", status: "note", tip: "文档投毒、prompt injection、PII 脱敏、越权检索" }
      ]
    }
  ];

  global.RAG_DATA = { CONCEPTS, DOCS, QUERIES, QUERY_HINTS, PANORAMA };
})(window);
