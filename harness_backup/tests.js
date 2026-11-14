// Rebuilt suite (2026-11-14, after /tmp wipe). Helpers:
let pass = 0, fail = 0;
function T(name, cond){ if (cond) pass++; else { fail++; console.log('FAIL: ' + name); } }
function freshS(over){ initState(); Object.assign(S, over || {}); return S; }
let _n = 0;
function mk(o){ return newHorse(Object.assign({ name: 'テスト' + (++_n), sex: '牡', birthYear: 2028, sire: 'コントレイル', dam: 'テスト母', bms: 'キタサンブラック', status: 'racehorse', surface: '芝', distMin: 1600, distMax: 2400, growth: '普通', gtype: '普通' }, o || {})); }
render = function(){};

// ---- data integrity ----
T('domestic races 965', DATA.domestic.length === 965);
T('overseas races 585', DATA.overseas.length === 585);
T('stallions 54', DATA.stallions.length === 54);
T('templates 40', DATA.mareTemplates.length === 40);

// ---- class system ----
T('class winless', horseClass(mk({ wins: 0 })) === '未勝利');
T('class 1 win', horseClass(mk({ wins: 1 })) === '1勝クラス');
T('class 4 wins is OP', horseClass(mk({ wins: 4 })) === 'OP');
T('class graded win is OP', horseClass(mk({ wins: 1, gradedWin: true })) === 'OP');

// ---- fees ----
{
  freshS({});
  const sTier = DATA.stallions.find(s => s.fee_tier === 'S');
  T('external S fee is 3000', stallionFee(sTier) === 3000);
  const home = mk({ name: '自家種牡馬', status: 'stallion' });
  S.horses = [home];
  T('homebred stallion is free', stallionFee({ name: '自家種牡馬', fee_tier: 'S' }) === 0);
}

// ---- stud entry qualification ----
T('stud needs graded win or 100M', canEnterStud(mk({ sex: '牡', gradedWin: true })) && canEnterStud(mk({ sex: '牡', earnings: 10000 })) && !canEnterStud(mk({ sex: '牡', earnings: 9999 })) && !canEnterStud(mk({ sex: '牝', gradedWin: true })));

// ---- elderly mares ----
{
  freshS({ year: 2040 });
  const young = mk({ status: 'broodmare', sex: '牝', birthYear: 2036 });
  const old = mk({ status: 'broodmare', sex: '牝', birthYear: 2023 });
  T('mare breedable at 4', mareBreedable(young) === true);
  T('mare not breedable at 17', mareBreedable(old) === false);
  T('conception 85% at <=9', conceptionRate(mk({ status: 'broodmare', sex: '牝', birthYear: 2033 })) === 0.85);
  T('conception declines at 16', conceptionRate(mk({ status: 'broodmare', sex: '牝', birthYear: 2024 })) === 0.45);
  T('foaling risk curve', foalingRisk(13) === 0 && foalingRisk(14) === 0.08 && foalingRisk(16) === 0.22 && foalingRisk(17) === 0.30);
}

// ---- v0.41/42: roster expansion, lines, Melt stallion ----
{
  const names = DATA.stallions.map(s => s.name);
  T('favourites added', ['カルストンライトオ', 'デュランダル', 'ディープボンド'].every(n => names.includes(n)));
  T('favourites are C tier', DATA.stallions.filter(s => ['カルストンライトオ', 'デュランダル', 'ディープボンド'].includes(s.name)).every(s => s.fee_tier === 'C'));
  T('all stallions have line data', DATA.stallions.every(s => Array.isArray(s.line) && s.line.length === 3));
  T('personRec resolves Deep Impact line', personRec('ディープインパクト').sire === 'サンデーサイレンス');
  T('personRec resolves Tesco line', personRec('テスコボーイ').sire === 'プリンスリーギフト');
  T('personRec resolves Bago line', personRec('バゴ').sire === 'ナシュワン');
  const meltSt = DATA.stallions.find(s => s.name === 'メルトスイート');
  T('melt sweet is a mutation stallion', !!meltSt && meltSt.mutation === true && meltSt.fee_tier === 'C' && meltSt.surface === 'ダート');
  T('no special mares embedded', DATA.specialMares === undefined);
  freshS({});
  const subj = mk({ name: 'ライン仔', sire: 'コントレイル', dam: '母' });
  S.horses = [subj];
  const ped = pedigreeTable(subj);
  T('pedigree reaches Halo via lines', ped.includes('ヘイロー') && ped.includes('サンデーサイレンス'));
}

// ---- mutation on the sire side ----
{
  freshS({ year: 2032, month: 1, week: 1 });
  const mare = mk({ name: 'テスト母', sex: '牝', status: 'broodmare', birthYear: 2022, surface: 'ダート', distMin: 1000, distMax: 1400 });
  mare.pregnant = { sire: 'メルトスイート', dueYear: 2032 };
  S.horses = [mare];
  const origRandom = Math.random;
  Math.random = () => 0.005;
  try { onNewYear(); } finally { Math.random = origRandom; }
  const foal = S.horses.find(h => h.status === 'foal');
  T('mutation foal is born', !!foal);
  T('mutation flips surface under stub', !!foal && foal.surface === '芝');
  T('mutation is not chronicled (v0.48)', !S.chronicle.some(c => c.text.indexOf('【変異】') >= 0));
}

// ---- v0.43: dam sides, templates, ranks, annual sale ----
{
  T('all stallions have dam and bms', DATA.stallions.every(s => s.dam && s.bms));
  freshS({});
  T('personRec stallion dam', personRec('キタサンブラック').dam === 'シュガーハート');
  T('personRec dam resolves bms+grandam', (() => { const r = personRec('シュガーハート'); return r && r.sire === 'サクラバクシンオー' && r.dam === 'オトメゴコロ'; })());
  T('personRec grandam resolves gbms', personRec('オトメゴコロ').sire === 'ジャッジアンジェルーチ');
  T('templates in 4 groups of 10', ['sunday', 'kingmambo', 'overseas', 'other'].every(g => DATA.mareTemplates.filter(t => t.group === g).length === 10));
  T('templates carry rank and 3 sires', DATA.mareTemplates.every(t => t.rank && t.sire && t.bms && t.gbms));
}
{
  freshS({ year: 2030 });
  const m = makeMare(S.stallions);
  T('random mare has depth and rank', !!m.grandam && !!m.gbms && ['S', 'A', 'B', 'C'].includes(m.rank));
  T('random mare price in rank band', m.price >= RANK_PRICE[m.rank][0] && m.price <= RANK_PRICE[m.rank][1]);
  T('random mare age fits current year', m.birthYear <= 2026 && m.birthYear >= 2023);
}
{
  freshS({ phase: 'play', year: 2031, saleYear: 2030, usedTemplates: [] });
  refreshSale();
  T('sale refresh makes 10', S.salePool.length === 10 && S.saleYear === 2031);
  T('sale covers all groups', ['sunday', 'kingmambo', 'overseas', 'other'].every(g => S.salePool.some(m => m.group === g)));
  T('sale mares all ranked', S.salePool.every(m => m.rank && m.price >= 600 && m.price <= 5000));
  const firstNames = S.salePool.map(m => m.name);
  S.saleYear = 2031; S.year = 2032;
  refreshSale();
  T('second year draws fresh templates', S.salePool.length === 10 && S.salePool.every(m => !firstNames.includes(m.name)) && S.usedTemplates.length === 20);
}
{
  freshS({ phase: 'play', year: 2031 });
  const tm = makeTemplateMare(DATA.mareTemplates[0]);
  S.horses = [tm];
  const foal = mk({ name: '深さ仔', sire: 'コントレイル', dam: tm.name, bms: tm.sire });
  S.horses.push(foal);
  const ped = pedigreeTable(foal);
  T('foal pedigree shows grandam and gbms', ped.includes(tm.grandam) && ped.includes(tm.gbms));
}
{
  freshS({ phase: 'play', salePool: [{ name: '架空テスト', special: true }, { name: '通常候補' }] });
  migrateV029();
  T('migration strips special mares from pool', S.salePool.length === 1 && S.salePool[0].name === '通常候補');
}
{
  freshS({ year: 2031 }); S.saleYear = undefined; S.usedTemplates = undefined;
  migrateV029();
  T('migration seeds saleYear for refresh', S.saleYear === 2030 && Array.isArray(S.usedTemplates));
}

// ---- v0.44: recovery restored so a horse is back within ~1 month ----
{
  freshS({ year: 2030, month: 3, week: 1 });
  const p = mk({ name: '放牧テスト', status: 'racehorse', policy: 'pasture' });
  p.fatigue = 90; p.condition = 55;
  const t = mk({ name: '調教テスト', status: 'racehorse', policy: 'train' });
  t.fatigue = 90; t.condition = 55;
  const r = mk({ name: '休養テスト', status: 'racehorse', policy: 'rest' });
  r.fatigue = 90; r.condition = 55;
  S.horses = [p, t, r];
  for (let i = 0; i < 4; i++) advanceWeek();
  T('pasture fully recovers in 4 weeks', p.fatigue === 0 && p.condition >= 95);
  T('rest fully recovers in 4 weeks', r.fatigue === 0 && r.condition >= 90);
  T('train is raceable again in 4 weeks', t.fatigue <= 15 && t.condition >= 70);
}

// ---- v0.45: stallion roster sync for old saves ----
{
  freshS({});
  const old = JSON.parse(JSON.stringify(DATA.stallions.slice(0, 50)));
  for (const s of old) { delete s.dam; delete s.bms; delete s.line; }
  old[0].genSpd = 77;
  S.stallions = old;
  migrateV029();
  T('roster sync restores 54', S.stallions.length === 54);
  T('roster sync adds Melt with mutation', (() => { const m = S.stallions.find(s => s.name === 'メルトスイート'); return !!m && m.mutation === true; })());
  T('roster sync backfills dam data', S.stallions.find(s => s.name === 'キタサンブラック').dam === 'シュガーハート');
  T('roster sync preserves genetic cache', S.stallions.find(s => s.name === old[0].name).genSpd === 77);
}

// ---- v0.48: chronicle keeps only farm-first records; births counted separately ----
{
  freshS({});
  S.chronicle = [
    { y: 2031, m: 1, w: 1, text: '【初制覇】テスト が 東京優駿 を勝ち、牧場初のクラシック制覇を果たした' },
    { y: 2031, m: 1, w: 2, text: '【二冠】テスト がクラシック二冠を達成し、三冠に王手をかけた' },
    { y: 2031, m: 1, w: 3, text: '【誕生】テスト母 が コントレイル の牡馬を出産。仮名は「テスト31」' },
    { y: 2031, m: 1, w: 4, text: '【誕生】テスト母2 が コントレイル の牝馬を出産。仮名は「テスト32」' },
    { y: 2031, m: 2, w: 1, text: '【故障】テスト が レース後に故障した' },
    { y: 2031, m: 2, w: 2, text: '【重賞初制覇】テスト が テストS を勝ち、重賞初制覇を果たした' },
    { y: 2031, m: 2, w: 3, text: '【命名】テスト31 を「テストウマ」と命名した' },
    { y: 2031, m: 2, w: 4, text: 'テストウマ は引退した' },
    { y: 2031, m: 3, w: 1, text: '【牧場レコード】レコード保持 が通算獲得賞金の牧場記録を更新（15億円）' },
    { y: 2031, m: 3, w: 2, text: '【牧場レコード】レコード未満 が通算獲得賞金の牧場記録を更新（5,000万円）' }
  ];
  S.horses = [ mk({ name: 'レコード保持', earnings: 1500000 }), mk({ name: 'レコード未満', earnings: 50000 }) ];
  S.statsBirths = undefined;
  migrateV029();
  T('chronicle keeps farm-firsts and 1B+ farm records', S.chronicle.length === 3 && S.chronicle.some(c => c.text.indexOf('【牧場レコード】レコード保持') === 0) && !S.chronicle.some(c => c.text.indexOf('レコード未満') >= 0));
  T('statsBirths built from old birth entries', S.statsBirths && S.statsBirths[2031] === 2);
  initState(); T('new saves carry a births counter', !!S.statsBirths);
}


// ---- v0.50 stage1: new scale, tendential inheritance, decline curves, jizoku ----
T('save key is v7 (old saves not loaded)', SAVE_KEY === 'nkc_whc_keiba_proto_v7');
T('rank bands new scale', rankOf(85) === 'S' && rankOf(83) === 'S' && rankOf(82) === 'A' && rankOf(78) === 'A' && rankOf(77) === 'B' && rankOf(53) === 'F' && rankOf(52) === 'G');
T('clampParam 35..85', clampParam(120) === 85 && clampParam(10) === 35 && clampParam(70) === 70);
{
  const h = mk({}); setParams(h, 95, 20, 70);
  T('setParams clamps to new scale', h.spd === 85 && h.sta === 35 && h.gut === 70);
}
T('TIER_BASE new scale', TIER_BASE.S === 78 && TIER_BASE.A === 73 && TIER_BASE.B === 68 && TIER_BASE.C === 63);
T('rival ranges new scale', JSON.stringify(rivalStrength({ grade: 'GI', sector: 'domestic' })) === '[68,84]' && JSON.stringify(rivalStrength({ grade: 'GI', sector: 'overseas' })) === '[70,85]' && JSON.stringify(rivalStrength({ grade: '未勝利' })) === '[40,55]');
{
  freshS({});
  const g = stallionGen(DATA.stallions.find(s => s.fee_tier === 'S'));
  T('stallion gen within 85 cap', g.spd <= 85 && g.sta <= 85 && g.gut <= 85 && g.spd >= 70);
}
{
  const n = mk({ gtype: '普通', growth: '普通' });
  T('decline at peak is 1', maturityA(n, 4.6) === 1);
  T('decline normal curve', Math.abs(maturityA(n, 5.6) - 0.90) < 0.001 && Math.abs(maturityA(n, 6.6) - 0.77) < 0.001 && Math.abs(maturityA(n, 7.6) - 0.62) < 0.001 && Math.abs(maturityA(n, 9.6) - 0.40) < 0.001 && Math.abs(maturityA(n, 12) - 0.40) < 0.001);
  const j = mk({ gtype: '普通', growth: '普通', jizoku: true });
  T('decline jizoku curve is gentler', Math.abs(maturityA(j, 7.6) - 0.74) < 0.001 && Math.abs(maturityA(j, 10.6) - 0.50) < 0.001 && maturityA(j, 9) > maturityA(n, 9));
}
{
  freshS({ year: 2030, month: 6, week: 1 });
  const h = mk({ policy: 'spd', birthYear: 2027 }); setParams(h, 70, 70, 70);
  h.trained = { spd: 4, sta: 0, gut: 0 };
  S.horses = [h];
  monthlyTraining();
  T('training capped at +4 per param', h.spd === 70 && h.trained.spd === 4);
  const h2 = mk({ policy: 'spd', birthYear: 2027 }); setParams(h2, 84, 70, 70);
  h2.trained = { spd: 3, sta: 0, gut: 0 };
  S.horses = [h2];
  monthlyTraining();
  T('training stops at 85 absolute cap', h2.spd === 85 && h2.trained.spd === 4);
  monthlyTraining();
  T('no training beyond cap', h2.spd === 85);
}
{
  const h = mk({ status: 'yearling' }); setParams(h, 65, 65, 65); h.saleNoise = 1;
  const expected = clamp(Math.round(8 * Math.exp(0.08 * 65) * 1.1 / 10) * 10, 100, 12000);
  T('youngPrice rebased formula', youngPrice(h) === expected);
}
{
  // tendential inheritance: strong parents regress toward 65, weak parents pulled up
  freshS({ year: 2032, month: 1, week: 1 });
  const sire = S.stallions.find(s => s.name === 'キタサンブラック');
  const sg = stallionGen(sire);
  S.horses = [];
  for (let i = 0; i < 40; i++) {
    const mare = mk({ name: '強母' + i, sex: '牝', status: 'broodmare', birthYear: 2024 });
    setParams(mare, 80, 80, 80);
    mare.pregnant = { sire: 'キタサンブラック', dueYear: 2032 };
    S.horses.push(mare);
  }
  onNewYear();
  const foals = S.horses.filter(h => h.status === 'foal');
  const mean = foals.reduce((a, f) => a + (f.spd + f.sta + f.gut) / 3, 0) / foals.length;
  const centre = 65 + 0.65 * (((sg.spd + sg.sta + sg.gut) / 3 + 80) / 2 - 65);
  T('inheritance regresses to mean 65', foals.length === 40 && Math.abs(mean - centre) < 5 && mean < ((((sg.spd + sg.sta + sg.gut) / 3) + 80) / 2));
}
{
  freshS({ year: 2032, month: 1, week: 1 });
  const mare = mk({ name: '持続母', sex: '牝', status: 'broodmare', birthYear: 2024, jizoku: true });
  setParams(mare, 70, 70, 70);
  mare.pregnant = { sire: 'コントレイル', dueYear: 2032 };
  S.horses = [mare];
  const origRandom = Math.random;
  Math.random = () => 0.03;
  try { onNewYear(); } finally { Math.random = origRandom; }
  const foal = S.horses.find(h => h.status === 'foal');
  T('jizoku inherited at 5% from one parent', !!foal && foal.jizoku === true);
}
{
  freshS({ year: 2032, month: 1, week: 1 });
  const mare = mk({ name: '持続母2', sex: '牝', status: 'broodmare', birthYear: 2024, jizoku: true });
  setParams(mare, 70, 70, 70);
  mare.pregnant = { sire: 'ゴールドシップ', dueYear: 2032 };
  S.horses = [mare];
  const origRandom = Math.random;
  Math.random = () => 0.06;
  try { onNewYear(); } finally { Math.random = origRandom; }
  const foal = S.horses.find(h => h.status === 'foal');
  T('jizoku inherited at 7% from both parents', !!foal && foal.jizoku === true);
}
{
  freshS({ year: 2032, month: 1, week: 1 });
  const mare = mk({ name: '通常母', sex: '牝', status: 'broodmare', birthYear: 2024 });
  setParams(mare, 70, 70, 70);
  mare.pregnant = { sire: 'コントレイル', dueYear: 2032 };
  S.horses = [mare];
  const origRandom = Math.random;
  Math.random = () => 0.005;
  try { onNewYear(); } finally { Math.random = origRandom; }
  const foal = S.horses.find(h => h.status === 'foal');
  T('jizoku mutation only 0.1%', !!foal && foal.jizoku === false);
}
T('three roster stallions carry jizoku', DATA.stallions.filter(s => s.jizoku).length === 3 && DATA.stallions.find(s => s.name === 'ゴールドシップ').jizoku === true);
{
  freshS({ year: 2032, month: 1, week: 1 });
  const j = mk({ name: '持続馬', birthYear: 2026, jizoku: true, gtype: '普通', growth: '普通' });
  const n = mk({ name: '通常馬', birthYear: 2026, gtype: '普通', growth: '普通' });
  S.horses = [j, n];
  weeklyEvents();
  T('jizoku revealed after peak only if held', j.jizokuRevealed === true && !n.jizokuRevealed);
}
{
  freshS({ year: 2032, month: 1, week: 1 });
  const old = mk({ name: '老け馬', birthYear: 2024, gtype: '普通', growth: '普通' });
  S.horses = [old];
  weeklyEvents();
  T('retirement advice fires once past peak at <=62%', old.retireAdvised === true);
}
{
  freshS({ year: 2032, month: 3, week: 1 });
  const old = mk({ name: '回復衰え', birthYear: 2023, gtype: '普通', growth: '普通', policy: 'rest' });
  old.fatigue = 90; old.condition = 50;
  S.horses = [old];
  advanceWeek();
  T('fatigue recovery -40% past peak+4y', old.fatigue === 90 - 24);
  const young = mk({ name: '若馬回復', birthYear: 2030, gtype: '普通', growth: '普通', policy: 'rest' });
  young.fatigue = 90; young.condition = 50;
  freshS({ year: 2032, month: 3, week: 1 });
  S.horses = [young];
  advanceWeek();
  T('young horse recovery unchanged', young.fatigue === 90 - 40);
}
{
  freshS({ year: 2032, month: 1, week: 1 });
  const old = mk({ name: '実効テスト', birthYear: 2022, gtype: '普通', growth: '普通' });
  setParams(old, 80, 80, 80);
  T('effAvg reflects decline, not ceiling', effAvg(old) < 40 && effAvg(old) > 20);
}

console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
