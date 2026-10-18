/* Each entry is a complete authored design. Anatomy, colour and fins are never cross-combined. */
(() => {
'use strict';
const species=[
  {id:'amber-fantail',name:'琥珀扇尾',subtitle:'圆润 · 暖金 · 宽叉尾',family:'暖湾鱼',kind:0,heritage:true,height:.53,depth:.3,size:.87,speed:.54,
    palette:['#ad5921','#efb959','#ffe5ae'],finColor:'#e9b961',pattern:'amber',tail:'classic-fork',
    dorsal:[[.58,0],[.30,.30],[-.12,.39],[-.6,.25],[-.86,0]],anal:[[.22,0],[-.2,.20],[-.72,.17],[-.86,0]],
    description:'像一枚缓缓游动的琥珀。饱满的椭圆身体与展开的金色叉尾相衬，背鳍保留最初的折扇轮廓。',
    features:['椭圆鱼身','宽叉扇尾','折扇背鳍'],temperament:'舒缓巡游，转身时先收速再摆尾。'},
  {id:'celadon-sail',name:'青瓷帆鳍',subtitle:'圆润 · 湖蓝 · 高帆鳍',family:'浅湾鱼',kind:1,heritage:true,height:.59,depth:.3,size:.9,speed:.56,
    palette:['#235e77','#6bc5cf','#d2ebe2'],finColor:'#79cbd0',pattern:'celadon',tail:'classic-fork',
    dorsal:[[.62,0],[.25,.39],[-.2,.56],[-.64,.34],[-.89,0]],anal:[[.22,0],[-.25,.24],[-.73,.22],[-.87,0]],
    description:'湖蓝的圆身上横落三道青色水纹，宽叉尾与高高展开的帆鳍形成完整的蓝色剪影。',
    features:['圆身青纹','高帆背鳍','对称宽叉尾'],temperament:'游速平缓，喜欢在开阔的中层水域穿行。'},
  {id:'moon-angelfish',name:'月纱神仙',subtitle:'高身 · 银杏白 · 长腹须',family:'月湾鱼',kind:2,heritage:true,height:.94,depth:.21,size:.76,speed:.46,
    palette:['#797d5c','#e1dfbd','#f8eed6'],finColor:'#e4d8ad',pattern:'moon',tail:'moon-fan',
    dorsal:[[.56,0],[.16,.42],[-.32,.91],[-.69,.47],[-.91,0]],anal:[[.3,0],[-.12,.66],[-.63,.49],[-.86,0]],
    description:'银杏白的高身与墨绿竖纹构成月光般的轮廓。上下长鳍互相呼应，两条细长腹须随水流垂落。',
    features:['高身墨纹','上下长帆鳍','一对细长腹须'],temperament:'六种鱼中最从容的一种，轻摆长鳍慢慢滑行。'},
  {id:'coral-silktail',name:'霞金绸尾',subtitle:'流线 · 杏橙 · 圆绸尾',family:'暖流鱼',kind:0,heritage:false,height:.46,depth:.26,size:.83,speed:.63,
    palette:['#a95036','#eea574','#fce0b2'],finColor:'#eab386',pattern:'coral',tail:'round-fan',
    dorsal:[[.58,0],[.22,.19],[-.19,.32],[-.63,.22],[-.91,0]],anal:[[.26,0],[-.21,.17],[-.68,.15],[-.88,0]],
    description:'杏橙色的流线身体向尾柄自然收窄，圆形绸尾与低弧背鳍像一小片柔软的晚霞。',
    features:['流线杏橙身','圆绸扇尾','低弧背鳍'],temperament:'轻快地沿水流巡游，尾缘起伏柔和。'},
  {id:'tidal-swallow',name:'碧潮燕尾',subtitle:'流线 · 碧蓝 · 深叉燕尾',family:'潮汐鱼',kind:1,heritage:false,height:.51,depth:.24,size:.88,speed:.71,
    palette:['#175370','#48afc5','#b4e6d8'],finColor:'#6dbecb',pattern:'tidal',tail:'swallow',
    dorsal:[[.58,0],[.12,.40],[-.40,.28],[-.9,0]],anal:[[.26,0],[-.23,.23],[-.74,.19],[-.89,0]],
    description:'碧蓝鱼身饰有后倾水纹。扫向后方的背鳍与深叉燕尾共同强调前进的方向，和圆身帆鳍鱼截然不同。',
    features:['后倾碧纹','后掠背鳍','深叉燕尾'],temperament:'中层巡游较快，转弯时以燕尾轻轻修正方向。'},
  {id:'starlight-tetra',name:'星河灯鱼',subtitle:'纤小 · 青绿 · 红色侧线',family:'星河鱼',kind:3,heritage:false,height:.31,depth:.17,size:.43,speed:.84,
    palette:['#174c60','#39b0b6','#c1e5d4'],finColor:'#7bcac2',pattern:'neon',tail:'small-fork',
    dorsal:[[.4,0],[.04,.19],[-.57,.15],[-.82,0]],anal:[[.2,0],[-.26,.12],[-.68,.11],[-.83,0]],
    description:'纤小的青绿色鱼身上，一条浅蓝亮线与朱红侧线并行。短背鳍和轻巧叉尾让它像水中的一颗流星。',
    features:['纤小流线身','蓝红双侧线','轻巧小叉尾'],temperament:'游动轻快，常和同伴在较近的水域穿梭。'}
];
for(const item of species){Object.freeze(item.palette);Object.freeze(item.features);for(const key of ['dorsal','anal']){item[key].forEach(Object.freeze);Object.freeze(item[key]);}Object.freeze(item);}
globalThis.AQUARIUM_SPECIES=Object.freeze(species);
})();
