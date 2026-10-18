/* Each entry is a complete authored design. Anatomy, colour and fins are never cross-combined. */
(() => {
'use strict';
const species=[
  {id:'amber-fantail',name:'琥珀扇尾',subtitle:'圆润 · 暖金 · 宽叉尾',family:'暖湾鱼',kind:0,heritage:true,height:.53,depth:.3,size:.87,speed:.54,
    traits:{size:2,schooling:3,danger:1,activity:3,speed:2},
    palette:['#ad5921','#efb959','#ffe5ae'],finColor:'#e9b961',pattern:'amber',tail:'classic-fork',
    dorsal:[[.58,0],[.30,.30],[-.12,.39],[-.6,.25],[-.86,0]],anal:[[.22,0],[-.2,.20],[-.72,.17],[-.86,0]],
    description:'像一枚缓缓游动的琥珀。饱满的椭圆身体与展开的金色叉尾相衬，背鳍保留最初的折扇轮廓。',
    features:['椭圆鱼身','宽叉扇尾','折扇背鳍'],temperament:'舒缓巡游，转身时先收速再摆尾。'},
  {id:'celadon-sail',name:'青瓷帆鳍',subtitle:'圆润 · 湖蓝 · 高帆鳍',family:'浅湾鱼',kind:1,heritage:true,height:.59,depth:.3,size:.9,speed:.56,
    traits:{size:2,schooling:3,danger:1,activity:2,speed:2},
    palette:['#235e77','#6bc5cf','#d2ebe2'],finColor:'#79cbd0',pattern:'celadon',tail:'classic-fork',
    dorsal:[[.62,0],[.25,.39],[-.2,.56],[-.64,.34],[-.89,0]],anal:[[.22,0],[-.25,.24],[-.73,.22],[-.87,0]],
    description:'湖蓝的圆身上横落三道青色水纹，宽叉尾与高高展开的帆鳍形成完整的蓝色剪影。',
    features:['圆身青纹','高帆背鳍','对称宽叉尾'],temperament:'游速平缓，喜欢在开阔的中层水域穿行。'},
  {id:'moon-angelfish',name:'月纱神仙',subtitle:'高身 · 银杏白 · 长腹须',family:'月湾鱼',kind:2,heritage:true,height:.94,depth:.21,size:.76,speed:.46,
    traits:{size:2,schooling:2,danger:1,activity:1,speed:1},
    palette:['#797d5c','#e1dfbd','#f8eed6'],finColor:'#e4d8ad',pattern:'moon',tail:'moon-fan',
    dorsal:[[.56,0],[.16,.42],[-.32,.91],[-.69,.47],[-.91,0]],anal:[[.3,0],[-.12,.66],[-.63,.49],[-.86,0]],
    description:'银杏白的高身与墨绿竖纹构成月光般的轮廓。上下长鳍互相呼应，两条细长腹须随水流垂落。',
    features:['高身墨纹','上下长帆鳍','一对细长腹须'],temperament:'性情安静，常在原处轻摆长鳍停留，偶尔慢慢滑行。'},
  {id:'coral-silktail',name:'霞金绸尾',subtitle:'流线 · 杏橙 · 圆绸尾',family:'暖流鱼',kind:0,heritage:false,height:.46,depth:.26,size:.83,speed:.63,
    traits:{size:2,schooling:3,danger:1,activity:3,speed:3},
    palette:['#a95036','#eea574','#fce0b2'],finColor:'#eab386',pattern:'coral',tail:'round-fan',
    dorsal:[[.58,0],[.22,.19],[-.19,.32],[-.63,.22],[-.91,0]],anal:[[.26,0],[-.21,.17],[-.68,.15],[-.88,0]],
    description:'杏橙色的流线身体向尾柄自然收窄，圆形绸尾与低弧背鳍像一小片柔软的晚霞。',
    features:['流线杏橙身','圆绸扇尾','低弧背鳍'],temperament:'轻快地沿水流巡游，尾缘起伏柔和。'},
  {id:'tidal-swallow',name:'碧潮燕尾',subtitle:'流线 · 碧蓝 · 深叉燕尾',family:'潮汐鱼',kind:1,heritage:false,height:.51,depth:.24,size:.88,speed:1.05,
    traits:{size:2,schooling:3,danger:1,activity:5,speed:4},
    palette:['#175370','#48afc5','#b4e6d8'],finColor:'#6dbecb',pattern:'tidal',tail:'swallow',
    dorsal:[[.58,0],[.12,.40],[-.40,.28],[-.9,0]],anal:[[.26,0],[-.23,.23],[-.74,.19],[-.89,0]],
    description:'碧蓝鱼身饰有后倾水纹。扫向后方的背鳍与深叉燕尾共同强调前进的方向，和圆身帆鳍鱼截然不同。',
    features:['后倾碧纹','后掠背鳍','深叉燕尾'],temperament:'精力充沛，喜欢在上层水域探索，顺着水流轻快穿梭，偶尔短促冲刺。'},
  {id:'starlight-tetra',name:'星河灯鱼',subtitle:'纤小 · 青绿 · 红色侧线',family:'星河鱼',kind:3,heritage:false,height:.31,depth:.17,size:.43,speed:.84,
    traits:{size:1,schooling:5,danger:1,activity:4,speed:4},
    palette:['#174c60','#39b0b6','#c1e5d4'],finColor:'#7bcac2',pattern:'neon',tail:'small-fork',
    dorsal:[[.4,0],[.04,.19],[-.57,.15],[-.82,0]],anal:[[.2,0],[-.26,.12],[-.68,.11],[-.83,0]],
    description:'纤小的青绿色鱼身上，一条浅蓝亮线与朱红侧线并行。短背鳍和轻巧叉尾让它像水中的一颗流星。',
    features:['纤小流线身','蓝红双侧线','轻巧小叉尾'],temperament:'最喜欢结群的小鱼，主动靠近同类、跟随同伴一起转向；遇到鲨鱼时优先随群避开。'},
  {id:'blue-reef-shark',name:'蓝礁巡游鲨',subtitle:'巨型 · 银背白腹 · 宽吻闭颌',family:'礁湾鲨',kind:4,predator:true,heritage:false,height:.26,depth:.23,size:4.65,speed:.96,
    traits:{size:5,schooling:1,danger:5,activity:3,speed:4},
    palette:['#697980','#a6b3b5','#faf9f1'],finColor:'#87999f',pattern:'shark',tail:'shark-sickle',
    dorsal:[[.12,0],[-.01,.18],[-.22,.38],[-.32,.20],[-.29,.06],[-.49,0]],anal:[[-.73,0],[-.86,.10],[-1.04,0]],
    description:'银灰背部与乳白腹部之间有清晰的分界。宽而扁的短吻沿上唇前伸，下颌自然闭合。头肩之后，修长的躯干逐渐收向细尾柄；后掠胸鳍、偏后的镰形背鳍和上长下短的尾鳍，构成礁鲨的流畅剪影。',
    features:['银背白腹','宽吻闭合唇线','后掠镰形背鳍'],temperament:'喜欢独自巡游，与同类保持距离。危险程度最高，其他鱼会提前远离，靠近时明显加速避开；不争抢颗粒鱼饵，偶尔与小鱼短暂追逐玩耍。'},
  {id:'silver-dart',name:'电光银梭',subtitle:'梭形 · 银白鱼身 · 镰形叉尾',family:'疾流鱼',kind:5,heritage:false,locomotion:'burst-rest',height:.21,depth:.14,size:.62,speed:2.65,
    traits:{size:2,schooling:1,danger:1,activity:3,speed:5},
    palette:['#8e9ca4','#e6ebee','#ffffff'],finColor:'#c4cfd4',pattern:'silver-dart',tail:'racing-sickle',
    dorsal:[[.22,0],[-.10,.20],[-.50,.12],[-.72,0]],anal:[[-.30,0],[-.54,.11],[-.79,0]],
    description:'像一枚掠过水面的银白色飞梭。尖吻、前厚后细的修长身体与紧收尾柄连成一条流线；窄而后掠的胸鳍、镰形深叉尾和沿体侧延伸的金色亮线，让它静止时也带着向前的速度感。冲刺时尾鳍上下叶轻轻收拢，休息后恢复展开。',
    features:['尖吻梭形身','淡金线银白侧腹','窄镰形深叉尾'],temperament:'馆内速度最快。选定远处一片水域后迅速冲刺，抵达前收速，在附近轻摆鱼鳍休息较长时间，再向另一处冲刺；每条鱼独立选择目的地与休息时间。'}
];
const habitats={
  'amber-fantail':{zone:'bottom',min:-3.3,max:.3,environment:'沙地与低层水域',diet:'底部藻屑、沉落的食物',habit:'多数时间贴近沙地慢游，偶尔到中下层探索，很少接近水面。'},
  'celadon-sail':{zone:'open',min:-.5,max:4,environment:'开阔的中层水域',diet:'浮游生物与细小食物',habit:'偏爱开阔中层，偶尔上浮或下潜，不会一直固定在同一高度。'},
  'moon-angelfish':{zone:'grass',min:-2.3,max:1.4,environment:'右侧海草丛边缘',diet:'藻类与细小食物',habit:'喜欢在海草旁停留、缓慢穿行，偶尔离开草丛探索中层。'},
  'coral-silktail':{zone:'reef',min:-2.6,max:.4,environment:'左侧礁洞与珊瑚边缘',diet:'礁面藻类与细小食物',habit:'偏爱礁石提供的遮蔽，会从拱洞中穿过，也会短暂游到外侧。'},
  'tidal-swallow':{zone:'surface',min:3.4,max:7.4,environment:'上层透光水域',diet:'浮游植物与细小浮游生物',habit:'大多在上层追随水流觅食，偶尔下降到中层，不贴着水面不动。'},
  'starlight-tetra':{zone:'grass',min:-1.4,max:2.3,environment:'海草边缘的中下层',diet:'微小浮游生物',habit:'喜欢沿海草边缘结群，受惊时一起散开，平静后回到熟悉的水域。'},
  'silver-dart':{zone:'open',min:1.8,max:5.5,environment:'中上层开阔水域',diet:'细小浮游生物与颗粒饵',habit:'偶尔突然蹬尾，沿着选好的方向冲刺 1–2 秒；抵达后在原处附近静息 24–42 秒，恢复体力再出发，真正危险迫近时才快速逃离。'},
  'blue-reef-shark':{zone:'open',min:.5,max:3.5,environment:'礁外开阔的中层水域',diet:'本馆不捕食居民，也不争抢颗粒饵',habit:'独自绕行，偶尔选一条小鱼短暂追玩；靠近或数秒后就放慢离开，不伤害小鱼。'}
};
for(const item of species){item.habitat=Object.freeze(habitats[item.id]);Object.freeze(item.traits);Object.freeze(item.palette);Object.freeze(item.features);for(const key of ['dorsal','anal']){item[key].forEach(Object.freeze);Object.freeze(item[key]);}Object.freeze(item);}
globalThis.AQUARIUM_SPECIES=Object.freeze(species);
// Sparse accents among the slower residents: 1 / 2 / 2 / 2 / 3 at the five densities.
const ordinary=[0,5,1,5,2,5,3,5,4,5];
globalThis.AQUARIUM_FISH_PLAN=Object.freeze(Array.from({length:52},(_,i)=>[2,18,42].includes(i)?7:ordinary[i%ordinary.length]));
})();
