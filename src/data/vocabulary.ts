export interface VocabularyItem {
  term: string
  meaning: string
  breakdown: string
}

export const vocabularyByQuestionId: Record<string, VocabularyItem[]> = {
  s01: [
    { term: 'be attributed to', meaning: '被归因于', breakdown: 'attribute A to B 表示“把 A 归因于 B”，被动形式是 A be attributed to B。' },
    { term: 'solely', meaning: '仅仅，完全地', breakdown: '来自 sole“唯一的”，在本句中限制原因范围，表示“不能只怪数字媒体”。' },
  ],
  s02: [
    { term: 'immediate', meaning: '立即的，眼前的', breakdown: 'immediate results 指短期内马上能够观察到的结果。' },
    { term: 'significant', meaning: '显著的，重要的', breakdown: '这里不是“有意义的”直译，而是说长期影响可能很大。' },
  ],
  s03: [
    { term: 'expand access to', meaning: '扩大获得……的机会', breakdown: 'access to education 指接触或获得教育资源的机会。' },
    { term: 'unevenly distributed', meaning: '分配不均', breakdown: 'unevenly 表示不均衡地，distributed 表示被分配、分布。' },
  ],
  s04: [
    { term: 'be concerned with', meaning: '关心，关注', breakdown: '这里的 concerned 不是“担忧的”，而是“把注意力放在……上”。' },
    { term: 'less A than B', meaning: '与其说 A，不如说 B', breakdown: '比较重点落在 B，本句更关心 how，而不是 whether。' },
  ],
  s05: [
    { term: 'correlation', meaning: '相关关系', breakdown: '两个现象一起变化，只能说明有关联，不能自动证明一方导致另一方。' },
    { term: 'causation', meaning: '因果关系', breakdown: '来自 cause“原因”，causation 强调一个因素真正造成了另一个结果。' },
  ],
  s06: [
    { term: 'be inclined to', meaning: '倾向于', breakdown: 'incline 有“使倾斜”的意思，引申为心理上偏向某种选择。' },
    { term: 'reinforce', meaning: '加强，巩固', breakdown: 're- 表示再次，force 表示力量，合起来是让原有信念变得更牢固。' },
  ],
  s07: [
    { term: 'long-held assumption', meaning: '长期持有的假设', breakdown: 'long-held 是过去分词复合形容词，修饰 assumption。' },
    { term: 'genuine', meaning: '真正的，真实的', breakdown: 'genuine progress 指不是表面变化，而是实质性的进步。' },
  ],
  s08: [
    { term: 'efficient', meaning: '高效的', breakdown: '强调用较少时间、金钱或资源取得较好结果。' },
    { term: 'in the long run', meaning: '从长远来看', breakdown: '与 in the short term 相对，用来比较短期表现和长期成本。' },
  ],
  s09: [
    { term: 'equip someone to do', meaning: '使某人具备做某事的能力', breakdown: 'equip 原意是配备工具，这里引申为给予学生所需能力。' },
    { term: 'evaluate evidence', meaning: '评估证据', breakdown: 'evaluate 不只是“看”，而是判断证据的质量、相关性和可信度。' },
  ],
  s10: [
    { term: 'gain popularity', meaning: '变得流行', breakdown: 'gain 表示获得，gain popularity 即获得越来越多人的接受。' },
    { term: 'poorly defined', meaning: '定义不清楚', breakdown: 'poorly 在这里表示“不充分地”，不是经济意义上的“贫穷”。' },
  ],
  s11: [
    { term: 'absence', meaning: '缺少，不存在', breakdown: '来自 absent“缺席的”，absence of evidence 指没有发现证据。' },
    { term: 'not necessarily', meaning: '不一定', breakdown: '它否定的是必然性，不等于完全否定后面的说法。' },
  ],
  s12: [
    { term: 'regulation', meaning: '规定，监管措施', breakdown: '在政策语境中通常指政府或行业制定的约束规则。' },
    { term: 'unintentionally discourage', meaning: '无意中阻碍', breakdown: 'unintentionally 表示并非原本目的，discourage A from doing 表示让 A 不愿或难以做某事。' },
  ],
  s13: [
    { term: 'access', meaning: '获取，接触', breakdown: '这里 access 是动词，access news 表示通过某种方式获取新闻。' },
    { term: 'channel', meaning: '渠道', breakdown: '不是字面的水道，而是新闻传播或信息获取的途径。' },
  ],
  s14: [
    { term: 'unless', meaning: '除非，否则', breakdown: 'unless 引出必要条件，相当于 if...not。' },
    { term: 'fairly evaluated', meaning: '得到公正评价', breakdown: 'fairly 修饰 evaluated，强调评价时不能忽略隐性成本。' },
  ],
  s15: [
    { term: 'tendency', meaning: '倾向，趋势', breakdown: 'the tendency to do 指经常采用某种思考或行动方式。' },
    { term: 'overlook', meaning: '忽视，未注意到', breakdown: '本句中指只看眼前结果，会漏掉多年以后才显现的变化。' },
  ],
  s16: [
    { term: 'be driven by', meaning: '由……驱动', breakdown: '用于说明行为背后的真正动机或推动因素。' },
    { term: 'reputational damage', meaning: '声誉损害', breakdown: 'reputational 来自 reputation“声誉”，指公众评价下降带来的损失。' },
  ],
  s17: [
    { term: 'accurate', meaning: '准确的', breakdown: '强调数据本身没有明显事实错误。' },
    { term: 'biased', meaning: '有偏见的，有倾向性的', breakdown: 'bias 是偏向，biased interpretation 指解释受到立场或预设影响。' },
  ],
  s18: [
    { term: 'lie in', meaning: '在于', breakdown: '这里 lie 不是“说谎”，the challenge lies in 表示困难存在于某个环节。' },
    { term: 'relevant', meaning: '相关的', breakdown: 'relevant information 指与当前问题和判断真正有关的信息。' },
  ],
  s19: [
    { term: 'average user', meaning: '一般用户，典型用户', breakdown: '不是数学题中的简单平均，而是设计时假设的普通使用者。' },
    { term: 'unusual circumstances', meaning: '特殊情况', breakdown: 'circumstance 指环境或条件，unusual 表示偏离常规。' },
  ],
  s20: [
    { term: 'establish cause', meaning: '确立因果关系', breakdown: 'establish 表示用充分证据证明某个关系成立。' },
    { term: 'premature', meaning: '过早的，证据不足的', breakdown: '这里不是医学上的“早产”，而是结论下得太早。' },
  ],
  p01: [
    { term: 'obtain', meaning: '获得', breakdown: '比 get 更正式，常见于学术和说明性文章。' },
    { term: 'lead to', meaning: '导致', breakdown: '表示前面的情况产生后面的结果，本句用了 does not necessarily 限制这种因果。' },
  ],
  p02: [
    { term: 'mixed results', meaning: '不一致的研究结果', breakdown: 'mixed 表示有好有坏、没有形成单一结论。' },
    { term: 'the nature of the task', meaning: '任务的性质', breakdown: 'nature 在这里指任务本身的类型、特点和要求。' },
  ],
  p03: [
    { term: 'uncertainty', meaning: '不确定性', breakdown: '来自 certain“确定的”，前缀 un- 表示否定。' },
    { term: 'acknowledge', meaning: '承认，正视', breakdown: '不是简单知道，而是公开接受某个事实确实存在。' },
  ],
  p04: [
    { term: 'persuade', meaning: '说服', breakdown: 'persuade someone to do 表示使某人愿意采取行动。' },
    { term: 'reliability', meaning: '可靠性', breakdown: '来自 reliable，公共交通语境中包括准点、稳定和可预期。' },
  ],
  p05: [
    { term: 'automation', meaning: '自动化', breakdown: '来自 automatic，指机器或软件接管原本重复的人工过程。' },
    { term: 'adapt', meaning: '适应，调整', breakdown: 'adapt to change 表示根据新环境改变技能或工作方式。' },
  ],
  p06: [
    { term: 'digitize', meaning: '数字化', breakdown: 'digit + -ize，表示把实体材料转换成数字形式。' },
    { term: 'reproduce', meaning: '再现，复制', breakdown: 're- 表示再次，produce 表示产生，本句指数字图像无法完整重现场体验。' },
  ],
  p07: [
    { term: 'living standards', meaning: '生活水平', breakdown: '通常涉及收入、住房、健康和生活条件等综合状况。' },
    { term: 'the gains are distributed', meaning: '收益被分配', breakdown: 'gains 指经济增长带来的好处，distributed 指这些好处流向哪些人。' },
  ],
  p08: [
    { term: 'assume', meaning: '假设，想当然地认为', breakdown: '表示在没有充分证明前先把某个观点当成真的。' },
    { term: 'in practice', meaning: '在实际中', breakdown: '常用来引出真实情况与理论或直觉之间的差异。' },
  ],
  p09: [
    { term: 'campaign', meaning: '宣传活动，倡议行动', breakdown: 'health campaign 指有组织地推动健康知识或行为的活动。' },
    { term: 'be shaped by', meaning: '受到……塑造或影响', breakdown: '强调行为不是单一原因决定，而是被多个条件共同影响。' },
  ],
  p10: [
    { term: 'fluent', meaning: '流畅的', breakdown: '描述语言表达自然顺畅，但本身不代表内容正确。' },
    { term: 'verification', meaning: '核验，验证', breakdown: '来自 verify，指用来源或证据检查说法是否真实。' },
  ],
  p11: [
    { term: 'absorb', meaning: '吸收', breakdown: '森林吸收空气中的二氧化碳，并把碳储存在植物和土壤中。' },
    { term: 'a substitute for', meaning: '……的替代品', breakdown: 'not a substitute for 表示一项措施不能取代另一项必要行动。' },
  ],
  p12: [
    { term: 'historical record', meaning: '历史记录', breakdown: 'record 在这里是名词，指被保存下来的文献、档案和叙述。' },
    { term: 'preserve documents', meaning: '保存文献', breakdown: 'preserve 强调保护某物，使其能够长期留存。' },
  ],
  p13: [
    { term: 'standardized test', meaning: '标准化考试', breakdown: 'standardized 表示使用统一题目、流程或评分标准。' },
    { term: 'sole measure', meaning: '唯一衡量标准', breakdown: 'sole 表示唯一，measure 在这里是衡量成功的方法。' },
  ],
  p14: [
    { term: 'uncommon interest', meaning: '小众兴趣', breakdown: 'uncommon 表示不常见，指参与人数较少的兴趣领域。' },
    { term: 'isolate users from', meaning: '使用户与……隔离', breakdown: '推荐系统可能让用户只看到熟悉内容，接触不到陌生观点。' },
  ],
  p15: [
    { term: 'assumption', meaning: '假设，前提', breakdown: '政策设计时认为会成立、但仍需要验证的判断。' },
    { term: 'be clearly stated', meaning: '被清楚说明', breakdown: 'state 在这里是动词，表示明确表达目标和前提。' },
  ],
  p16: [
    { term: 'barrier to', meaning: '……的障碍', breakdown: 'barrier 原意是屏障，barrier to innovation 指阻碍创新的因素。' },
    { term: 'adopt technology', meaning: '采用技术', breakdown: 'adopt 不只是“收养”，在产品语境中表示开始接受并使用。' },
  ],
  p17: [
    { term: 'sophisticated', meaning: '高深的，复杂精密的', breakdown: '这里指听起来很专业、很有学问，而不一定真的更准确。' },
    { term: 'in fact', meaning: '事实上', breakdown: '用于纠正或反转前面的担忧，引出作者真正认可的判断。' },
  ],
  p18: [
    { term: 'discount', meaning: '折扣', breakdown: 'short-term discounts 指短期降价促销。' },
    { term: 'regular price', meaning: '正常价格，原价', breakdown: '与促销价格相对，指没有折扣时的日常售价。' },
  ],
  p19: [
    { term: 'inefficient', meaning: '低效的', breakdown: '前缀 in- 表示否定，表面看慢读似乎花费更多时间。' },
    { term: 'argument', meaning: '论证，论点体系', breakdown: '学术阅读中通常不是“争吵”，而是由理由和证据组成的观点。' },
  ],
  p20: [
    { term: 'adaptation', meaning: '适应措施', breakdown: '气候语境中指为应对已经发生或将要发生的影响而调整。' },
    { term: 'provided that', meaning: '前提是，只要', breakdown: '引出条件，本句表示借鉴经验必须认真考虑背景差异。' },
  ],
  s21: [
    { term: 'not every', meaning: '并非每一个', breakdown: '表示部分否定，只是否认所有情况都成立，不是完全否定。' },
    { term: 'resource use', meaning: '资源使用', breakdown: '指能源、材料、土地或其他投入的实际消耗量。' },
  ],
  s22: [
    { term: 'not so much A as B', meaning: '与其说 A，不如说 B', breakdown: '用于转移重点，说明真正需要关注的是后面的 B。' },
    { term: 'bear the cost', meaning: '承担成本', breakdown: 'bear 在这里不是“熊”，而是承担费用或不利后果。' },
  ],
  s23: [
    { term: 'hardly enough', meaning: '很难说足够', breakdown: 'hardly 表示几乎不，强调现有证据或数量仍然不足。' },
    { term: 'settle a question', meaning: '解决一个问题', breakdown: 'settle 在研究语境中指形成较确定、可接受的结论。' },
  ],
  s24: [
    { term: 'institution', meaning: '机构，制度性组织', breakdown: '通常指学校、政府、公司等持续运作的正式组织。' },
    { term: 'merely because', meaning: '仅仅因为', breakdown: 'merely 限定原因，表示只有这一因素通常还不充分。' },
  ],
  s25: [
    { term: 'capture a feature', meaning: '捕捉、呈现一个特征', breakdown: 'capture 在模型语境中指成功表示现实中的某个方面。' },
    { term: 'real world', meaning: '现实世界', breakdown: '与模型、理论或实验条件相对，包含更多复杂因素。' },
  ],
  s26: [
    { term: 'be familiar with', meaning: '对……熟悉', breakdown: '表示经常接触或已经认识某个说法、对象或概念。' },
    { term: 'reliable', meaning: '可靠的，可信的', breakdown: '强调信息能够被证据支持，而不是仅仅听起来熟悉。' },
  ],
  s27: [
    { term: 'additional resources', meaning: '新增资源', breakdown: 'additional 表示额外增加的资金、人员或其他投入。' },
    { term: 'effectively', meaning: '有效地', breakdown: '强调资源使用真正帮助实现目标，而不是只有投入数量增加。' },
  ],
  s28: [
    { term: 'main claim', meaning: '主要观点', breakdown: '指作者希望读者接受、并由其他细节支持的核心判断。' },
    { term: 'supporting detail', meaning: '支持性细节', breakdown: '用于解释、证明或具体说明文章主要观点的信息。' },
  ],
  s29: [
    { term: 'communicate a risk', meaning: '说明风险', breakdown: '指及时、清楚地向相关人群传达可能的不利后果。' },
    { term: 'severe', meaning: '严重的，强烈的', breakdown: '在本句中描述公众反应的程度，而不是风险是否存在。' },
  ],
  s30: [
    { term: 'indicator', meaning: '指标', breakdown: '用于衡量表现、状态或变化的具体数字或变量。' },
    { term: 'for convenience', meaning: '为了方便', breakdown: '表示选择依据是操作简单，而不一定是最准确或最合理。' },
  ],
  s31: [
    { term: 'produce a clearer picture', meaning: '形成更清晰的认识', breakdown: 'picture 在这里指对整体情况的理解，而不是一张图片。' },
    { term: 'what is happening', meaning: '正在发生的情况', breakdown: '指数据背后真实的过程、变化及其可能原因。' },
  ],
  s32: [
    { term: 'what matters', meaning: '真正重要的是', breakdown: 'what 引导主语从句，用来突出核心判断标准。' },
    { term: 'change the conclusion', meaning: '改变结论', breakdown: '表示新证据足以让原有判断发生实质调整。' },
  ],
  s33: [
    { term: 'independent check', meaning: '独立检查', breakdown: '由不同人员或方法重新核对，避免同一错误持续存在。' },
    { term: 'remain undetected', meaning: '一直未被发现', breakdown: 'remain 表示持续处于某种状态，undetected 表示没有被察觉。' },
  ],
  s34: [
    { term: 'meaningful comparison', meaning: '有意义的比较', breakdown: '指比较结果能够真实反映对象差异，而不是方法差异。' },
    { term: 'be measured', meaning: '被衡量', breakdown: '指按照某种统一方法收集并计算相关指标。' },
  ],
  s35: [
    { term: 'underestimate', meaning: '低估', breakdown: 'under- 表示不足，指判断的影响或规模比实际更小。' },
    { term: 'gradual change', meaning: '渐进变化', breakdown: '指每一步幅度较小、但长期累积后可能明显的变化。' },
  ],
  s36: [
    { term: 'precise', meaning: '精密的，稳定细致的', breakdown: '强调重复测量接近或数值细致，不必然代表接近真实值。' },
    { term: 'accurate reflection', meaning: '准确反映', breakdown: '表示指标或测量结果真正对应了现实中的目标现象。' },
  ],
  s37: [
    { term: 'widespread agreement', meaning: '广泛共识', breakdown: 'widespread 表示覆盖很多人或地区，agreement 表示意见一致。' },
    { term: 'achieve a goal', meaning: '实现目标', breakdown: 'achieve 强调经过行动最终达到预期结果。' },
  ],
  s38: [
    { term: 'amount of criticism', meaning: '批评的数量', breakdown: 'amount 强调多少，与后面的 quality“质量”形成对照。' },
    { term: 'determine whether', meaning: '决定是否', breakdown: '表示某个因素会影响后面的结果能不能成立。' },
  ],
  s39: [
    { term: 'statistic', meaning: '统计数字', breakdown: '指通过数据汇总或计算得到的数值结果。' },
    { term: 'independently of', meaning: '独立于，脱离', breakdown: '本句是否定形式，表示不能脱离数据收集背景来理解。' },
  ],
  s40: [
    { term: 'valuable', meaning: '有价值的', breakdown: '表示简单解释能够帮助理解，但价值仍然受到准确性的约束。' },
    { term: 'hide a difference', meaning: '掩盖差异', breakdown: '指简化过程中忽略了可能影响判断的重要不同之处。' },
  ],
  p21: [
    { term: 'attract attention', meaning: '吸引关注', breakdown: '表示结果因为新奇或意外而受到更多人注意。' },
    { term: 'reproduce a finding', meaning: '重复验证研究发现', breakdown: '指其他研究者在相似条件下得到相近结果。' },
  ],
  p22: [
    { term: 'waking hours', meaning: '清醒时间', breakdown: '指没有睡眠、可以活动的时间，并不等于高效工作时间。' },
    { term: 'fatigue', meaning: '疲劳', breakdown: '长期缺乏休息产生的身体和注意力下降状态。' },
  ],
  p23: [
    { term: 'reduce heat', meaning: '降低热量或高温影响', breakdown: '城市绿地可通过遮阴和蒸发等方式缓解高温。' },
    { term: 'reach safely', meaning: '安全到达', breakdown: '强调居民前往公园的道路、距离和安全条件。' },
  ],
  p24: [
    { term: 'performance measure', meaning: '绩效指标', breakdown: '用于判断工作效果的数字或评价标准。' },
    { term: 'underlying activity', meaning: '底层实际活动', breakdown: '指指标原本希望反映的真实工作或行为。' },
  ],
  p25: [
    { term: 'past decision', meaning: '过去的决定', breakdown: '指历史人物在当时条件下作出的选择。' },
    { term: 'present knowledge', meaning: '当前知识', breakdown: '指今天已经知道、但过去的人未必能够获得的信息。' },
  ],
  p26: [
    { term: 'food label', meaning: '食品标签', breakdown: '包装上说明成分、营养、日期等信息的文字区域。' },
    { term: 'usefulness declines', meaning: '实用性下降', breakdown: '表示信息虽然存在，但难找难懂会削弱它的实际帮助。' },
  ],
  p27: [
    { term: 'study space', meaning: '学习空间', breakdown: '指能够安静、稳定完成课程和作业的环境。' },
    { term: 'support at home', meaning: '家庭支持', breakdown: '包括设备、时间安排、指导和情绪支持等条件。' },
  ],
  p28: [
    { term: 'news organization', meaning: '新闻机构', breakdown: '指负责采访、编辑和发布新闻的媒体组织。' },
    { term: 'openly fix errors', meaning: '公开纠正错误', breakdown: '不仅修改内容，也向读者承认并说明此前的问题。' },
  ],
  p29: [
    { term: 'deserve credit', meaning: '值得被认为有功', breakdown: '表示某项政策可能对结果产生了积极贡献。' },
    { term: 'claim cause', meaning: '声称存在因果关系', breakdown: '表示进一步断言政策而非其他因素造成了变化。' },
  ],
  p30: [
    { term: 'repeated daily', meaning: '每天重复', breakdown: '表示小行动通过稳定重复形成长期累积效果。' },
    { term: 'meaningful benefit', meaning: '明显而有意义的收益', breakdown: '指虽然单次变化小，长期仍能产生实际帮助。' },
  ],
  p31: [
    { term: 'conservation project', meaning: '自然保护项目', breakdown: '旨在保护生态、物种或自然资源的长期行动。' },
    { term: 'shape the rules', meaning: '参与制定规则', breakdown: 'shape 表示影响规则的内容，而不是只被动接受。' },
  ],
  p32: [
    { term: 'apply the same rule', meaning: '应用同一规则', breakdown: '表示处理表面一致，但输入数据可能包含不同历史背景。' },
    { term: 'earlier inequality', meaning: '过去的不平等', breakdown: '指历史上已经存在并可能进入数据的资源或机会差异。' },
  ],
  p33: [
    { term: 'perfect evidence', meaning: '完全充分的证据', breakdown: '指几乎没有不确定性的理想证据，现实中往往难以及时获得。' },
    { term: 'avoidable harm', meaning: '可以避免的伤害', breakdown: '指如果判断更谨慎，本来有机会减少或阻止的不利后果。' },
  ],
  p34: [
    { term: 'breakthrough', meaning: '重大突破', breakdown: '指研究、技术或认识上产生的重要进展。' },
    { term: 'shared tool', meaning: '共享工具', breakdown: '由许多人共同使用并支持进一步发现的方法或设施。' },
  ],
  p35: [
    { term: 'digital library', meaning: '数字图书馆', breakdown: '通过网络提供电子书、检索和远程访问的资源系统。' },
    { term: 'community activity', meaning: '社区活动', breakdown: '由当地居民共同参与的讲座、学习或公共文化活动。' },
  ],
  p36: [
    { term: 'average price increase', meaning: '平均价格涨幅', breakdown: '把多种商品价格变化汇总成一个整体数字。' },
    { term: 'share of income', meaning: '收入占比', breakdown: '表示某类支出占家庭全部收入的比例。' },
  ],
  p37: [
    { term: 'recognize a word', meaning: '认出一个单词', breakdown: '看到或听到时能够理解，但不一定能主动准确使用。' },
    { term: 'active use', meaning: '主动运用', breakdown: '指在表达中自己选择并正确使用词语。' },
  ],
  p38: [
    { term: 'bear the risk', meaning: '承担风险', breakdown: '指某个群体面对技术可能造成的不利结果。' },
    { term: 'get to decide', meaning: '拥有决定权', breakdown: '强调谁有权选择技术如何设计、部署和使用。' },
  ],
  p39: [
    { term: 'guarantee', meaning: '保证', breakdown: 'does not guarantee 表示某个条件不足以确保结果出现。' },
    { term: 'reorganize ideas', meaning: '重新组织观点', breakdown: '把信息按照自己的理解重新分类、概括和连接。' },
  ],
  p40: [
    { term: 'diverse team', meaning: '多样化团队', breakdown: '成员在经历、知识或观点上存在差异的团队。' },
    { term: 'take a view seriously', meaning: '认真对待一种观点', breakdown: '表示真正考虑不同意见，而不是只允许其被说出来。' },
  ],
}
