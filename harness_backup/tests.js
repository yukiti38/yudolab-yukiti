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
T('stallions 60', DATA.stallions.length === 60);
T('templates 41 (incl. Big Okojo)', DATA.mareTemplates.length === 41);

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
  T('all stallions have line data', DATA.stallions.every(s => Array.isArray(s.line) && s.line.length >= 3)); /* v1.01: サンダースノー/タワーオブロンドンは大系マーカーまで4段のチェーンを持つ */
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
  T('template groups: 10/10/10/11', ['sunday', 'kingmambo', 'overseas'].every(g => DATA.mareTemplates.filter(t => t.group === g).length === 10) && DATA.mareTemplates.filter(t => t.group === 'other').length === 11);
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
  T('roster sync restores 60', S.stallions.length === 60);
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
T('save key is v8 (old saves not loaded)', SAVE_KEY === 'nkc_whc_keiba_proto_v8'); /* v1.00：カレンダー再編で v7→v8 */
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


// ---- v0.51 stage2: stables, transport tiers, staying, expeditions, weight burden ----
T('course regions', courseRegion('東京') === 'east' && courseRegion('京都') === 'west' && courseRegion('札幌') === 'hokkaido' && courseRegion('函館') === 'hokkaido' && courseRegion('大井') === null);
{
  freshS({ year: 2032, month: 4, week: 1 });
  const miho = mk({ name: '美浦馬', birthYear: 2028, stable: '美浦' });
  const ritto = mk({ name: '栗東馬', birthYear: 2028, stable: '栗東' });
  const race = (course) => ({ name: 'テスト', grade: 'OP', sector: 'central', racecourse: course, surface: '芝', distance_m: 2000, general: false, conditions: '', weight_type: '馬齢' });
  T('miho tiers', transportFatigue(miho, race('東京')) === 5 && transportFatigue(miho, race('新潟')) === 12 && transportFatigue(miho, race('京都')) === 20 && transportFatigue(miho, race('札幌')) === 20);
  T('ritto tiers', transportFatigue(ritto, race('阪神')) === 5 && transportFatigue(ritto, race('中京')) === 12 && transportFatigue(ritto, race('中山')) === 20 && transportFatigue(ritto, race('函館')) === 20);
  const two = mk({ name: '二歳馬', birthYear: 2030, stable: '美浦' });
  T('2yo transport x1.5 ceil', transportFatigue(two, race('東京')) === 8 && transportFatigue(two, race('京都')) === 30);
  miho.stayRegion = 'west'; miho.stayUntilAbs = absWeek() + 8;
  T('staying treats far region as near', transportFatigue(miho, race('京都')) === 5 && transportFatigue(miho, race('阪神')) === 5);
  miho.stayUntilAbs = absWeek() - 1;
  T('staying expires after ~2 months', transportFatigue(miho, race('京都')) === 20);
}
T('weight burden curve', weightBurden(54) === 0 && weightBurden(57) === 5 && weightBurden(62) === 12 && weightBurden(48) === 0);
T('injury chance weight add-on', Math.abs(injuryChance(57) - 0.35) < 1e-9 && Math.abs(injuryChance(62) - 0.45) < 1e-9 && Math.abs(injuryChance(50) - 0.35) < 1e-9);
{
  freshS({ year: 2032, month: 4, week: 1, funds: 5000 });
  const h = mk({ name: '遠征馬', birthYear: 2028, stable: '美浦', gradedWin: true, wins: 3 });
  setParams(h, 75, 75, 75);
  h.fatigue = 10; h.condition = 90;
  S.horses = [h];
  const race = { name: 'テストG1', grade: 'GI', sector: 'overseas', racecourse: 'ロンシャン（フランス）', surface: '芝', distance_m: 2400, general: false, conditions: '', weight_type: '馬齢' };
  runRace(race, [h]);
  T('expedition fee 1000 charged', S.funds <= 5000 - 1000 + 100000);
  T('expedition fee deducted exactly once', (() => { const f = S.funds; return f === 5000 - 1000 + prizePayout(h.results[0].prize || 0).net; })()); /* v0.56：資金に入るのは手取り */
  T('return week set after overseas race', h.expedReturnAbs === absWeek() + 1);
  T('no domestic transport for overseas', h.results[0].transport === 0);
}
{
  freshS({ year: 2032, month: 4, week: 1 });
  const h = mk({ name: '遠方馬', birthYear: 2028, stable: '美浦' });
  setParams(h, 70, 70, 70);
  h.fatigue = 0; h.condition = 90;
  S.horses = [h];
  const race = { name: '京都テスト', grade: 'OP', sector: 'central', racecourse: '京都', surface: '芝', distance_m: 2000, general: false, conditions: '', weight_type: '馬齢' };
  runRace(race, [h]);
  T('far race applies transport 20 before race', h.results[0].transport === 20);
  T('far race sets staying', h.stayRegion === 'west' && h.stayUntilAbs === absWeek() + 8);
}
{
  freshS({ year: 2032, month: 4, week: 1 });
  const h = mk({ name: '出発週馬', birthYear: 2028, policy: 'rest' });
  h.fatigue = 50; h.condition = 60;
  h.entries = {}; h.entries[absWeek() + 1] = { key: 'x', sector: 'overseas' };
  S.horses = [h];
  advanceWeek();
  T('travel week adds fatigue 10, no recovery', h.fatigue === 60 && h.condition === 60);
}
{
  freshS({ year: 2032, month: 4, week: 1 });
  const h = mk({ name: '帰国週馬', birthYear: 2028, policy: 'train' });
  h.fatigue = 60; h.condition = 50; h.expedReturnAbs = absWeek();
  S.horses = [h];
  advanceWeek();
  T('return week recovers at rest rate', h.fatigue === 20 && h.condition === 60);
}
{
  freshS({ year: 2032, month: 4, week: 1 });
  const h = mk({ name: '登録判定', birthYear: 2028, gradedWin: true, wins: 2 });
  setParams(h, 70, 70, 70);
  S.horses = [h];
  const ov = { name: '海外G1', grade: 'GI', sector: 'overseas', racecourse: 'アスコット（イギリス）', surface: '芝', distance_m: 2000, general: false, conditions: '' };
  entryWeekAhead = 0;
  T('overseas same-week entry blocked', /当週登録できません/.test(eligibility(h, ov) || ''));
  entryWeekAhead = 1;
  T('overseas advance entry allowed', eligibility(h, ov) === null);
  const dom = { name: '国内OP', grade: 'OP', sector: 'central', racecourse: '東京', surface: '芝', distance_m: 2000, general: false, conditions: '' };
  h.entries = {}; h.entries[absWeek() + 1] = { key: 'x', sector: 'overseas' };
  entryWeekAhead = 0;
  T('travel week blocks domestic entry', /出発・検疫週/.test(eligibility(h, dom) || ''));
  entryWeekAhead = 0;
}


// ---- v0.52 stage3: affinities （根幹は v1.1 でカテゴリ適性に変更） ----
{
  let viol = 0, rootO = 0, rootX = 0, distHold = 0, courseHold = 0, yusoN = 0;
  const N = 600;
  for (let i = 0; i < N; i++) {
    const h = mk({}); const a = genAffinities(h);
    if ((a.rootAff === '○' && a.nonRoot === '○') || (a.rootAff === '✕' && a.nonRoot === '✕')) viol++;
    if (a.rootAff === '○') rootO++;
    if (a.rootAff === '✕') rootX++;
    if (Object.keys(a.distAff).length) distHold++;
    if (Object.keys(a.courseAff).length) courseHold++;
    if (a.yuso) yusoN++;
  }
  T('root/nonRoot same-direction never generated', viol === 0);
  T('v11 root O rate ~20% (same as nonRoot)', rootO / N > 0.13 && rootO / N < 0.27);
  T('v11 root X rate ~12% (same as nonRoot)', rootX / N > 0.06 && rootX / N < 0.18);
  T('distance affinity hold rate ~45%', distHold / N > 0.36 && distHold / N < 0.54);
  T('course affinity hold rate ~50%', courseHold / N > 0.41 && courseHold / N < 0.59);
  T('yuso rate ~20%', yusoN / N > 0.13 && yusoN / N < 0.27);
}
{
  const h = mk({});
  h.aff = { rootDist: 2000, rootAff: '○', nonRoot: '-', distAff: { 2000: '○' }, distKnown: {}, courseAff: { '東京': '○' }, courseKnown: {}, known: { root: false, nonRoot: false, yuso: false }, yuso: false };
  T('affinity stacking capped at 1.10', Math.abs(affinityFactor(h, { racecourse: '東京', distance_m: 2000 }) - 1.10) < 1e-9);
  h.aff.rootAff = '✕'; h.aff.distAff = { 2000: '✕' }; h.aff.courseAff = { '東京': '✕' };
  T('affinity downside capped at 0.90', Math.abs(affinityFactor(h, { racecourse: '東京', distance_m: 2000 }) - 0.90) < 1e-9);
  h.aff = { rootDist: 2000, rootAff: '-', nonRoot: '○', distAff: {}, distKnown: {}, courseAff: {}, courseKnown: {}, known: { root: false, nonRoot: false, yuso: false }, yuso: false };
  T('non-root mark applies at 1800 only', Math.abs(affinityFactor(h, { racecourse: '東京', distance_m: 1800 }) - 1.05) < 1e-9 && affinityFactor(h, { racecourse: '東京', distance_m: 2000 }) === 1);
}
{
  freshS({ year: 2032, month: 4, week: 1 });
  let correct = 0, total = 0;
  for (let i = 0; i < 300; i++) {
    const h = mk({ name: '予測' + i, birthYear: 2028 });
    ensureAffinities(h);
    if (h.aff.pred.root === h.aff.rootAff) correct++;
    total++;
  }
  T('root prediction accuracy ~70%', correct / total > 0.58 && correct / total < 0.86);
  const foal = mk({ name: '当歳', birthYear: 2032, status: 'foal' });
  ensureAffinities(foal);
  T('foal has affinities but no predictions yet', !!foal.aff && !foal.aff.pred);
}
{
  freshS({ year: 2032, month: 4, week: 1 });
  const h = mk({ name: '確定テスト', birthYear: 2028, stable: '美浦' });
  setParams(h, 72, 72, 72);
  h.fatigue = 0; h.condition = 90;
  h.aff = { rootDist: 2000, rootAff: '○', nonRoot: '-', distAff: {}, distKnown: {}, courseAff: {}, courseKnown: {}, known: { root: false, nonRoot: false, yuso: false }, yuso: true, pred: { root: '○', nonRoot: '-', yuso: '○', dist: { 2000: '-' }, course: { '東京': '-' } } };
  S.horses = [h];
  const race = { name: '東京テスト', grade: 'OP', sector: 'central', racecourse: '東京', surface: '芝', distance_m: 2000, general: false, conditions: '', weight_type: '馬齢' };
  runRace(race, [h]);
  T('racing reveals root, course, dist, yuso', h.aff.known.root === true && h.aff.courseKnown['東京'] === true && h.aff.distKnown[2000] === true && h.aff.known.yuso === true);
  T('yuso halves transport', transportFatigue(h, { racecourse: '京都', sector: 'central' }) === 10);
}


// ---- v0.53 stage4: body weight (pure flavour), white coat, Big Okojo ----
T('all stallions have mature weights', DATA.stallions.every(s => s.weight >= 400 && s.weight <= 600));
T('all templates have weights', DATA.mareTemplates.every(t => t.weight >= 400 && t.weight <= 560));
{
  const t = DATA.mareTemplates.find(x => x.name === 'ビッグオコジョ');
  T('Big Okojo template per spec', !!t && t.group === 'other' && t.rank === 'B' && t.coat === '白毛' && t.sire === 'クロフネ' && t.dam === 'シロオコジョ' && t.bms === 'ゴールドシップ' && t.grandam === 'ハクノユキ' && t.gbms === 'ステイゴールド' && t.surface === '芝' && t.dist[0] === 1600 && t.dist[1] === 2200 && t.growth === '普通' && t.weight === 540 && t.sireLine[0] === 'クロフネ' && t.sireLine[1] === 'フレンチデピュティ');
  freshS({});
  const m = makeTemplateMare(t);
  T('Big Okojo mare is white and 540kg', m.coat === '白毛' && m.matureWeight === 540);
}
{
  const origRandom = Math.random;
  Math.random = () => 0.4;
  T('white inherits 50% from one parent', inheritCoat('白毛', '鹿毛') === '白毛');
  Math.random = () => 0.6;
  T('white can be missed at 50%', inheritCoat('白毛', '鹿毛') !== '白毛');
  Math.random = () => 0.7;
  T('white inherits 75% from both parents', inheritCoat('白毛', '白毛') === '白毛');
  Math.random = () => 0.8;
  T('white can be missed at 75%', inheritCoat('白毛', '白毛') !== '白毛');
  Math.random = origRandom;
  let whiteSeen = false;
  for (let i = 0; i < 300; i++) if (randomCoat() === '白毛') whiteSeen = true;
  T('random coat never yields white', !whiteSeen);
}
{
  freshS({ year: 2032, month: 1, week: 1 });
  const h = mk({ name: '体重馬', birthYear: 2032, status: 'foal', matureWeight: 500 });
  T('foal displays ~55%', weightNow(h) === 275);
  h.birthYear = 2031; T('1yo displays ~75%', weightNow(h) === 375);
  h.birthYear = 2030; T('2yo displays ~90%', weightNow(h) === 450);
  h.birthYear = 2029; T('3yo displays ~97%', weightNow(h) === 485);
  h.birthYear = 2028; T('4yo displays 100%', weightNow(h) === 500);
}
{
  freshS({ year: 2032, month: 1, week: 1 });
  const mare = mk({ name: '体重母', sex: '牝', status: 'broodmare', birthYear: 2024, matureWeight: 480 });
  setParams(mare, 70, 70, 70);
  mare.pregnant = { sire: 'ゴールドシップ', dueYear: 2032 };
  S.horses = [mare];
  onNewYear();
  const foal = S.horses.find(h => h.status === 'foal');
  const sireW = DATA.stallions.find(s => s.name === 'ゴールドシップ').weight;
  T('foal weight is parental average +-20', !!foal && Math.abs(foal.matureWeight - (sireW + 480) / 2) <= 20);
}
{
  // body weight must not affect any calculation: identical horses, different weights
  freshS({ year: 2032, month: 4, week: 1 });
  const a = mk({ name: '軽い馬', birthYear: 2028, stable: '美浦', matureWeight: 420 });
  const b = mk({ name: '重い馬', birthYear: 2028, stable: '美浦', matureWeight: 580 });
  setParams(a, 72, 72, 72); setParams(b, 72, 72, 72);
  a.condition = b.condition = 90; a.fatigue = b.fatigue = 10;
  a.aff = b.aff = { rootDist: 2000, rootAff: '○', nonRoot: '-', distAff: {}, distKnown: {}, courseAff: {}, courseKnown: {}, known: { root: false, nonRoot: false, yuso: false }, yuso: false };
  const race = { racecourse: '京都', distance_m: 2000, surface: '芝', sector: 'central' };
  T('weight does not affect race base', raceBase(a, race) === raceBase(b, race));
  T('weight does not affect affinity factor', affinityFactor(a, race) === affinityFactor(b, race));
  T('weight does not affect transport', transportFatigue(a, race) === transportFatigue(b, race));
  T('weight does not affect injury chance inputs', injuryChance(assignedWeight({ weight_type: '馬齢' }, a)) === injuryChance(assignedWeight({ weight_type: '馬齢' }, b)));
}


// ---- v0.54: sire-line traits （系統の個性） + broodmare jizoku display ----
{
  const EXPECT = {
    'キタサンブラック':'サンデーサイレンス系','コントレイル':'サンデーサイレンス系','オルフェーヴル':'サンデーサイレンス系','ゴールドシップ':'サンデーサイレンス系','スワーヴリチャード':'サンデーサイレンス系','フィエールマン':'サンデーサイレンス系','ワールドプレミア':'サンデーサイレンス系','シュヴァルグラン':'サンデーサイレンス系','イスラボニータ':'サンデーサイレンス系','アドマイヤマーズ':'サンデーサイレンス系','サリオス':'サンデーサイレンス系','ミッキーアイル':'サンデーサイレンス系','コパノリッキー':'サンデーサイレンス系','エスポワールシチー':'サンデーサイレンス系','ドウデュース':'サンデーサイレンス系','シャフリヤール':'サンデーサイレンス系','イクイノックス':'サンデーサイレンス系','ソールオリエンス':'サンデーサイレンス系','ディープボンド':'サンデーサイレンス系','ダイワメジャー':'サンデーサイレンス系','デュランダル':'サンデーサイレンス系',
    'Sea The Stars':'ノーザンダンサー系','Kingman':'ノーザンダンサー系','Frankel':'ノーザンダンサー系','グレナディアガーズ':'ノーザンダンサー系','ヘニーヒューズ':'ノーザンダンサー系','ドレフォン':'ノーザンダンサー系','Justify':'ノーザンダンサー系','Lope de Vega':'ノーザンダンサー系','Into Mischief':'ノーザンダンサー系','Siyouni':'ノーザンダンサー系','サトノクラウン':'ノーザンダンサー系','タスティエーラ':'ノーザンダンサー系','マインドユアビスケッツ':'ノーザンダンサー系','ジオグリフ':'ノーザンダンサー系','アダイヤー':'ノーザンダンサー系','サンダースノー':'ノーザンダンサー系',
    'サートゥルナーリア':'キングマンボ系','タイトルホルダー':'キングマンボ系','ロードカナロア':'キングマンボ系','リオンディーズ':'キングマンボ系','ホッコータルマエ':'キングマンボ系','ルーラーシップ':'キングマンボ系','レイデオロ':'キングマンボ系','チュウワウィザード':'キングマンボ系',
    'Dubawi':'ミスタープロスペクター系','Wootton Bassett':'ミスタープロスペクター系','ニューイヤーズデイ':'ミスタープロスペクター系','Gun Runner':'ミスタープロスペクター系','フォーウィールドライブ':'ミスタープロスペクター系','タワーオブロンドン':'ミスタープロスペクター系',
    'エピファネイア':'ロベルト系','エフフォーリア':'ロベルト系','モーリス':'ロベルト系','ピクシーナイト':'ロベルト系',
    'シニスターミニスター':'シアトルスルー系','マジェスティックウォリアー':'シアトルスルー系',
    'ビッグアーサー':'ナスルーラ系','メルトスイート':'ナスルーラ系',
    'カルストンライトオ':'マンノウォー系'
  };
  let allOk = Object.keys(EXPECT).length === 60;
  for(const st of DATA.stallions){ const got = stallionMajorLine(st); if(got !== EXPECT[st.name]){ allOk = false; console.log('line mismatch:', st.name, 'got', got, 'want', EXPECT[st.name]); } }
  T('all 60 stallions map to the confirmed major lines', allOk);
  T('every line trait is balanced (one +1.5 / one -1.5, sum zero)', Object.keys(LINE_TRAITS).every(ln => { const b = lineBlend(ln, null); const vs = [b.spd, b.sta, b.gut]; return Math.max(...vs) === 1.5 && Math.min(...vs) === -1.5 && vs.reduce((a, v) => a + v, 0) === 0; }));
  T('all 41 template sires resolve to a major line', DATA.mareTemplates.every(t => !!majorLineOfChain([t.sire].concat(t.sireLine || []))));
  const bmsNulls = DATA.mareTemplates.filter(t => !majorLineOfChain([t.bms].concat(t.bmsLine || []))).map(t => t.bms);
  T('template BMS resolve except Mejiro McQueen (documented minor line)', bmsNulls.length === 2 && bmsNulls.every(n => n === 'メジロマックイーン'));
  T('name resolution spot checks', majorLineOfName('キングカメハメハ') === 'キングマンボ系' && majorLineOfName('トニービン') === 'ナスルーラ系' && majorLineOfName('クロフネ') === 'ノーザンダンサー系' && majorLineOfName('ゴールドシップ') === 'サンデーサイレンス系' && majorLineOfName('メジロマックイーン') === null && majorLineOfName('存在しない馬') === null);
  freshS({});
  T('homebred stallion inherits its sire line', stallionMajorLine({ name: '自家テスト', sire: 'コントレイル', surface: '芝', dist: [1600, 2400], growth: '普通', fee_tier: 'B' }) === 'サンデーサイレンス系');
}
{
  const bl = lineBlend('サンデーサイレンス系', 'ミスタープロスペクター系');
  T('blend params include BMS half weight', bl.gut === 1.5 && bl.spd === -0.75 && bl.sta === -0.75);
  T('blend distance includes BMS half weight', bl.dist === -150);
  T('blend surface includes BMS half weight', bl.surf === 2.5);
  T('blend nudges are sire 10% / BMS 5%', bl.nudges.length === 2 && bl.nudges[0][0] === '晩成' && bl.nudges[0][1] === 0.10 && bl.nudges[1][0] === '早熟' && bl.nudges[1][1] === 0.05);
  T('blend with unresolvable BMS line is sire only', lineBlend('ロベルト系', null).dist === 200 && lineBlend('ロベルト系', null).nudges.length === 1);
  const origRandom = Math.random;
  Math.random = () => 0;
  T('growth nudge shifts one step toward target', nudgeGrowthType('普通', '晩成', 0.10) === '普通遅' && nudgeGrowthType('晩成', '早熟', 0.10) === '普通遅');
  T('growth nudge is a no-op inside the target family', nudgeGrowthType('晩成', '晩成', 0.10) === '晩成');
  Math.random = () => 0.99;
  T('growth nudge respects its probability', nudgeGrowthType('普通', '晩成', 0.10) === '普通');
  Math.random = origRandom;
}
{
  // birth wiring: same parents, only the sire line differs (seeded LCG -> deterministic)
  let seed = 987654321;
  const origRandom = Math.random;
  const lcg = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  function birthRound(sireName){
    seed = 987654321; Math.random = lcg;
    freshS({ year: 2032, month: 1, week: 1 });
    const st = S.stallions.find(s => s.name === sireName);
    st.genSpd = 70; st.genSta = 70; st.genGut = 70; st.genTemp = 55; st.gtype = '普通'; st.dist = [1600, 2400];
    const mares = [];
    for(let i = 0; i < 250; i++){
      const mare = mk({ name: '系統母' + i, sex: '牝', status: 'broodmare', birthYear: 2024, sire: 'キングカメハメハ', surface: '芝', distMin: 1600, distMax: 2400 });
      setParams(mare, 70, 70, 70);
      mare.pregnant = { sire: sireName, dueYear: 2032 };
      mares.push(mare);
    }
    S.horses = mares;
    onNewYear();
    Math.random = origRandom;
    return S.horses.filter(h => h.status === 'foal');
  }
  const ssF = birthRound('コントレイル'); // SS: gut +1.5 / spd -1.5, dist 0
  const mpF = birthRound('Dubawi');       // MrP: spd +1.5 / sta -1.5, dist -300 (BMS Kingmambo: spd +0.75, dist -50 in both rounds)
  const mean = (arr, f) => arr.reduce((a, h) => a + f(h), 0) / arr.length;
  T('line-trait birth rounds produce all foals', ssF.length === 250 && mpF.length === 250);
  const dSpd = mean(mpF, h => h.spd) - mean(ssF, h => h.spd);
  const dGut = mean(ssF, h => h.gut) - mean(mpF, h => h.gut);
  const dDist = mean(ssF, h => (h.distMin + h.distMax) / 2) - mean(mpF, h => (h.distMin + h.distMax) / 2);
  T('param centre shifts by sire line at birth (spd, expected ~3.0)', dSpd > 1.8 && dSpd < 4.2);
  T('param centre shifts by sire line at birth (gut, expected ~1.5)', dGut > 0.5 && dGut < 2.5);
  T('distance centre shifts by sire line at birth (expected ~300)', dDist > 180 && dDist < 420);
}
{
  // surface wiring: 芝 sire x ダート mare; only the lines' turf/dirt bias differs
  let seed = 555777;
  const origRandom = Math.random;
  const lcg = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  function surfRound(sireName, bmsName){
    seed = 555777; Math.random = lcg;
    freshS({ year: 2032, month: 1, week: 1 });
    const st = S.stallions.find(s => s.name === sireName);
    st.genSpd = 70; st.genSta = 70; st.genGut = 70; st.genTemp = 55; st.gtype = '普通';
    const mares = [];
    for(let i = 0; i < 300; i++){
      const mare = mk({ name: '馬場母' + i, sex: '牝', status: 'broodmare', birthYear: 2024, sire: bmsName, surface: 'ダート', distMin: 1200, distMax: 1800 });
      setParams(mare, 70, 70, 70);
      mare.pregnant = { sire: sireName, dueYear: 2032 };
      mares.push(mare);
    }
    S.horses = mares;
    onNewYear();
    Math.random = origRandom;
    return S.horses.filter(h => h.status === 'foal');
  }
  const turfF = surfRound('Frankel', 'Galileo');        // ND x ND: net turf +15pp -> P(芝) ~0.60
  const dirtF = surfRound('Dubawi', 'フォーティナイナー'); // MrP x MrP: net dirt -22.5pp -> P(芝) ~0.225
  const pT = turfF.filter(h => h.surface === '芝').length / turfF.length;
  const pD = dirtF.filter(h => h.surface === '芝').length / dirtF.length;
  T('surface bias moves foals toward the line-preferred surface', turfF.length === 300 && dirtF.length === 300 && pT - pD > 0.22 && pT > 0.5 && pD < 0.32);
}
{
  freshS({});
  const html = viewStallions();
  T('stallion list shows major lines and qualitative phrases', html.includes('系統') && html.includes('サンデーサイレンス系') && html.includes('根性に寄る・晩成気味') && html.includes('マンノウォー系'));
  T('stallion list leaks no trait numbers', !html.includes('pp') && !html.includes('1.5') && !html.includes('±'));
}
{
  freshS({ year: 2032, month: 3, week: 1 });
  const mare = mk({ name: '配合母', sex: '牝', status: 'broodmare', birthYear: 2026, sire: 'キングカメハメハ', surface: '芝', distMin: 1600, distMax: 2400 });
  S.horses = [mare];
  mateMareId = null;
  const html = broodmareTable();
  T('mating screen shows the combined colour in words', html.includes('配合の色'));
  T('mating screen leaks no trait numbers', !html.includes('pp') && !html.includes('1.5') && !html.includes('±'));
}
{
  const names = Object.keys(LINE_TRAITS);
  let clean = true;
  for(const a of names) for(const b of names){ const t = lineColourText(lineBlend(a, b)); if(/[0-9０-９±]/.test(t) || t.includes('pp')) clean = false; }
  T('all 64 sire x BMS colour texts are number-free', clean);
  T('line phrases are number-free', Object.values(LINE_TRAITS).every(t => !/[0-9０-９±]/.test(t.phrase) && !t.phrase.includes('pp')));
}
{
  T('broodmare with unrevealed jizoku shows no row', jizokuRow(mk({ status: 'broodmare', sex: '牝', jizoku: true })) === '' && jizokuRow(mk({ status: 'broodmare', sex: '牝', jizoku: false })) === '');
  T('broodmare with revealed jizoku shows the trait', jizokuRow(mk({ status: 'broodmare', sex: '牝', jizoku: true, jizokuRevealed: true })).includes('持続の特性あり'));
  T('stallion jizoku display unchanged', jizokuRow(mk({ status: 'stallion', jizoku: true })).includes('持続の特性あり') && jizokuRow(mk({ status: 'stallion', jizoku: false })).includes('なし'));
  T('racehorse with unrevealed jizoku shows no row', jizokuRow(mk({ status: 'racehorse' })) === '');
}

{
  // v0.54 exception (Terai, 2026-11-14): Mejiro McQueen stays lineless/colourless, but as the
  // dam-record BMS he adds a stamina-only plus at the normal BMS weight (+1.5 x 0.5 = +0.75)
  const sireOnly = lineBlend('サンデーサイレンス系', null);
  const mj = lineBlend('サンデーサイレンス系', null, 'メジロマックイーン');
  T('Mejiro McQueen BMS bonus is exactly stamina +0.75', mj.sta === 0.75 && mj.sta === sireOnly.sta + 0.75);
  T('Mejiro bonus touches no other blend component', mj.spd === sireOnly.spd && mj.gut === sireOnly.gut && mj.dist === sireOnly.dist && mj.surf === sireOnly.surf && JSON.stringify(mj.nudges) === JSON.stringify(sireOnly.nudges));
  T('Mejiro bonus stacks additively on a resolved BMS line', lineBlend('ロベルト系', 'キングマンボ系', 'メジロマックイーン').sta === lineBlend('ロベルト系', 'キングマンボ系').sta + 0.75);
  T('other BMS names trigger no Mejiro bonus', lineBlend('ロベルト系', null, 'キングカメハメハ').sta === lineBlend('ロベルト系', null).sta && !lineBlend('ロベルト系', null, 'キングカメハメハ').mejiroSta && !lineBlend('ロベルト系', null).mejiroSta);
  T('Mejiro McQueen line resolution stays null', majorLineOfName('メジロマックイーン') === null);
  T('the two Mejiro templates keep null BMS line yet trigger the bonus', ['コハクドリーム', 'ツキノプリンセス'].every(nm => { const t = DATA.mareTemplates.find(x => x.name === nm); return !!t && t.bms === 'メジロマックイーン' && majorLineOfChain([t.bms].concat(t.bmsLine || [])) === null && lineBlend('ロベルト系', null, t.bms).sta === 0.75; }));
  let mjNamed = true, mjClean = true;
  for(const a of Object.keys(LINE_TRAITS)){ const t = lineColourText(lineBlend(a, null, 'メジロマックイーン')); if(!t.includes('スタミナ寄り')) mjNamed = false; if(/[0-9０-９±]/.test(t) || t.includes('pp')) mjClean = false; }
  T('Mejiro colour text names the stamina lean for every sire line', mjNamed);
  T('Mejiro colour texts stay number-free', mjClean);
}
{
  freshS({ year: 2032, month: 3, week: 1 });
  const mare = mk({ name: 'メジロ母', sex: '牝', status: 'broodmare', birthYear: 2026, sire: 'キングカメハメハ', bms: 'メジロマックイーン', surface: '芝', distMin: 1600, distMax: 2400 });
  S.horses = [mare];
  mateMareId = null;
  const html = broodmareTable();
  T('mating screen shows the Mejiro stamina lean in words', html.includes('配合の色') && html.includes('スタミナ寄り'));
  T('mating screen with Mejiro BMS leaks no trait numbers', !html.includes('pp') && !html.includes('1.5') && !html.includes('±'));
}
{
  // birth wiring: paired LCG rounds, identical except the dam-record bms name
  let seed = 424242;
  const origRandom = Math.random;
  const lcg = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  function mjBirthRound(bmsName){
    seed = 424242; Math.random = lcg;
    freshS({ year: 2032, month: 1, week: 1 });
    const st = S.stallions.find(s => s.name === 'コントレイル');
    st.genSpd = 70; st.genSta = 70; st.genGut = 70; st.genTemp = 55; st.gtype = '普通'; st.dist = [1600, 2400];
    const mares = [];
    for(let i = 0; i < 250; i++){
      const mare = mk({ name: '系統母' + i, sex: '牝', status: 'broodmare', birthYear: 2024, sire: 'キングカメハメハ', bms: bmsName, surface: '芝', distMin: 1600, distMax: 2400 });
      setParams(mare, 70, 70, 70);
      mare.pregnant = { sire: 'コントレイル', dueYear: 2032 };
      mares.push(mare);
    }
    S.horses = mares;
    onNewYear();
    Math.random = origRandom;
    return S.horses.filter(h => h.status === 'foal');
  }
  const ctlF = mjBirthRound('ダイワメジャー');
  const mjF = mjBirthRound('メジロマックイーン');
  const mean = (arr, f) => arr.reduce((a, h) => a + f(h), 0) / arr.length;
  T('Mejiro birth rounds produce all foals', ctlF.length === 250 && mjF.length === 250);
  const bSta = mean(mjF, h => h.sta) - mean(ctlF, h => h.sta);
  const bSpd = mean(mjF, h => h.spd) - mean(ctlF, h => h.spd);
  const bGut = mean(mjF, h => h.gut) - mean(ctlF, h => h.gut);
  T('Mejiro BMS shifts foal stamina centre by +0.75 at birth', bSta > 0.4 && bSta < 1.1);
  T('Mejiro BMS leaves foal speed/guts centres unchanged at birth', Math.abs(bSpd) < 0.2 && Math.abs(bGut) < 0.2);
}

// ---- v0.55: 牝系図（牝系の計算・成立条件・系図表示・馬ページの牝系表示） ----
function g1win(){ return { finish:1, grade:'GI', race:'テスト記念', when:'2035年5月第1週', prize:10000, course:'東京', surface:'芝', dist:2000, field:16, time:'2:00.0', agari:'34.0' }; }
function buildFamily(P, dauCount, grandPer){
  const all = [];
  const F = mk({ name: P+'根元', sex:'牝', birthYear:2028, dam:'外部の母'+P, status:'broodmare' });
  all.push(F);
  const daus = [];
  for(let i=1;i<=dauCount;i++){
    const d = mk({ name: P+'娘'+i, sex:'牝', birthYear:2030+i, dam:F.name, status:'broodmare' });
    daus.push(d); all.push(d);
  }
  const grands = [];
  for(const d of daus){
    for(let j=1;j<=grandPer;j++){
      const g = mk({ name: d.name+'の子'+j, sex:(j%2 ? '牝' : '牡'), birthYear:2036+j, dam:d.name, status:'racehorse' });
      grands.push(g); all.push(g);
    }
  }
  return { F, daus, grands, all };
}
{
  freshS({ year: 2040 });
  const fam = buildFamily('リン', 5, 3); // 直仔5 + 孫15 = 子孫20（ちょうど閾値）
  S.horses = fam.all;
  fam.grands[0].results = [g1win()];
  fam.grands[1].results = [g1win()];
  fam.daus[0].results = [g1win()];
  const lines = femaleLines();
  T('v55 founder detected (dam outside farm)', lines.length === 1 && lines[0].founder.name === 'リン根元');
  T('v55 direct kids counted', lines[0].directKids.length === 5);
  T('v55 descendants counted', lines[0].descendants.length === 20);
  T('v55 G1 winners counted', lines[0].g1Winners.length === 3);
  const est = establishedLines();
  T('v55 established at exact thresholds', est.length === 1 && est[0].name === 'リン根元系');
  T('v55 colt grandchild is a member', !!lineOfHorse(fam.grands[1]) && lineOfHorse(fam.grands[1]).name === 'リン根元系');
  T('v55 founder belongs to own line', !!lineOfHorse(fam.F) && lineOfHorse(fam.F).name === 'リン根元系');
  T('v55 profile row shows family name', familyLineRow(fam.grands[0]).includes('牝系') && familyLineRow(fam.grands[0]).includes('リン根元系'));
  const html = viewLineage();
  T('v55 view names the line', html.includes('リン根元系'));
  T('v55 view order founder < daughter < grandkid', html.indexOf('リン根元') < html.indexOf('リン娘1') && html.indexOf('リン娘1') < html.indexOf('リン娘1の子1'));
  T('v55 grandkid nested under its dam (before next daughter)', html.indexOf('リン娘1の子1') < html.indexOf('リン娘2'));
  T('v55 card notes sire', html.includes('父 コントレイル'));
  T('v55 card marks representative G1 win', html.includes('🏆') && html.includes('テスト記念（GI）'));
  T('v55 tree has collapse toggles', html.includes('data-ltoggle'));
  lineCollapsed.add(fam.daus[0].id);
  const htmlC = viewLineage();
  T('v55 collapsed branch hides its grandkids, shows count', !htmlC.includes('リン娘1の子1') && htmlC.includes('子孫 3頭'));
  T('v55 collapse leaves other branches open', htmlC.includes('リン娘2の子1'));
  lineCollapsed.delete(fam.daus[0].id);
  T('v55 re-expanded branch shows grandkids again', viewLineage().includes('リン娘1の子1'));
}
{
  freshS({ year: 2040 });
  const fam = buildFamily('ソラ', 4, 4); // 直仔4 + 孫16 = 子孫20・G1 3頭でも直仔不足で未成立
  S.horses = fam.all;
  fam.grands[0].results = [g1win()]; fam.grands[1].results = [g1win()]; fam.grands[2].results = [g1win()];
  T('v55 4 offspring fails despite 20 descendants + 3 G1', femaleLines()[0].directKids.length === 4 && femaleLines()[0].descendants.length === 20 && establishedLines().length === 0);
  T('v55 unestablished member has no profile row', familyLineRow(fam.grands[0]) === '');
  T('v55 view excludes unestablished line', !viewLineage().includes('ソラ根元系') && viewLineage().includes('まだ成立した牝系はありません'));
}
{
  freshS({ year: 2040 });
  const fam = buildFamily('ツキ', 5, 3);
  S.horses = fam.all.slice(0, -1); // 孫を1頭欠いて子孫19
  fam.grands[0].results = [g1win()]; fam.grands[1].results = [g1win()]; fam.grands[2].results = [g1win()];
  T('v55 19 descendants fails', femaleLines()[0].descendants.length === 19 && establishedLines().length === 0);
}
{
  freshS({ year: 2040 });
  const fam = buildFamily('ハナ', 5, 3);
  S.horses = fam.all;
  fam.grands[0].results = [g1win(), g1win()]; // 同じ馬のG1 2勝は1頭分
  fam.grands[1].results = [g1win()];
  T('v55 two distinct G1 winners fails (same horse counts once)', femaleLines()[0].g1Winners.length === 2 && establishedLines().length === 0);
  fam.grands[2].results = [g1win()];
  T('v55 third distinct G1 winner establishes', establishedLines().length === 1);
}
{
  freshS({ year: 2040 });
  const colt = mk({ name:'流れ者', sex:'牡', dam:'外部の母Z' });
  const orphanMare = mk({ name:'孤高', sex:'牝', dam:'売却された母', status:'broodmare' });
  S.horses = [colt, orphanMare];
  const fl = femaleLines();
  T('v55 colt with external dam is no founder; mare with absent dam is', fl.length === 1 && fl[0].founder.name === '孤高');
  T('v55 colt belongs to no line', lineOfHorse(colt) === null && familyLineRow(colt) === '');
}
{
  freshS({ year: 2040 });
  S.horses = [];
  T('v55 no horses -> no lines, empty message', establishedLines().length === 0 && viewLineage().includes('まだ成立した牝系はありません'));
}
{
  freshS({ year: 2040 });
  const big = buildFamily('オオ', 6, 4); // 子孫30・全31頭の合成ライン
  const small = buildFamily('チイ', 2, 1);
  S.horses = big.all.concat(small.all);
  big.grands[0].results = [g1win()]; big.grands[1].results = [g1win()]; big.daus[0].results = [g1win()];
  const html = viewLineage();
  T('v55 ~30-horse line renders as the only established line', establishedLines().length === 1 && html.includes('オオ根元系') && html.includes('子孫30頭'));
  T('v55 small line not rendered at all', !html.includes('チイ根元'));
  T('v55 deepest grandkid present in tree', html.includes('オオ娘6の子4'));
}
{
  const multi = mk({ name:'複数G1', results: [Object.assign(g1win(), { race:'小さい記念', prize:5000 }), Object.assign(g1win(), { race:'大きい記念', prize:20000 })] });
  T('v55 representative G1 win picks richest', repG1Win(multi).race === '大きい記念');
  const g2only = mk({ name:'G2のみ', results: [Object.assign(g1win(), { grade:'GII' })] });
  T('v55 G2 win is not a G1 win', repG1Win(g2only) === null && !hasG1Win(g2only));
}

// ---- v0.56: 進上金・源泉徴収（賞金の支払い） ----
{
  const gi = prizePayout(20000); // GI 1着 2億円（万円単位）
  T('v56 GI split 10/5/5, owner 80%', gi.trainer === 2000 && gi.jockey === 1000 && gi.groom === 1000 && gi.owner === 16000);
  T('v56 GI withholding (20000-50)*10.21% floored to 万円 = 2036', gi.tax === 2036);
  T('v56 GI net to funds = 13964万円', gi.net === 13964);
  const sh = prizePayout(550); // 未勝利 1着 550万円
  T('v56 small prize split floors each share', sh.trainer === 55 && sh.jockey === 27 && sh.groom === 27 && sh.owner === 441);
  T('v56 small prize withholding = 51', sh.tax === 51 && sh.net === 390);
  T('v56 prize exactly 50万円: no withholding', prizePayout(50).tax === 0 && prizePayout(50).net === 41);
  T('v56 prize below 50万円: no withholding', prizePayout(49).tax === 0 && prizePayout(10).tax === 0);
  T('v56 withholding starts appearing at 60万円', prizePayout(51).tax === 0 && prizePayout(60).tax === 1);
  T('v56 zero prize pays nothing', prizePayout(0).net === 0 && prizePayout(0).owner === 0);
  T('v56 shares always sum to gross', [1, 7, 49, 50, 51, 550, 12345, 20000, 99999].every(p => { const x = prizePayout(p); return x.trainer + x.jockey + x.groom + x.owner === p && x.net === x.owner - x.tax; }));
  const dummy = { name: '内訳馬' };
  T('v56 breakdown text shows withholding for big prize', payoutText(dummy, gi).includes('進上金') && payoutText(dummy, gi).includes('源泉徴収 −') && payoutText(dummy, gi).includes('手取り'));
  T('v56 breakdown text omits withholding when none', !payoutText(dummy, prizePayout(40)).includes('源泉徴収'));
}
{
  freshS({ year: 2032, month: 4, week: 1, funds: 10000 });
  const h = mk({ name: '賞金テスト', birthYear: 2029, stable: '美浦' });
  setParams(h, 85, 85, 85);
  h.fatigue = 0; h.condition = 100;
  S.horses = [h];
  ensureMile(); // 実プレイではロード時の migrateV029 が先に初期化する（freshS 直後の mile:null を実フローに合わせる）
  const race = { name: '未勝利テスト', grade: '未勝利', sector: 'central', racecourse: '東京', surface: '芝', distance_m: 2000, general: false, conditions: '', weight_type: '馬齢' };
  const out = runRace(race, [h]);
  const prize = h.results[0].prize || 0;
  T('v56 strong horse wins the maiden', out[0].finish === 1 && prize > 0);
  T('v56 earnings record stays gross', h.earnings === prize && S.farmPrize === prize);
  T('v56 funds receive net only', S.funds === 10000 + prizePayout(prize).net && prizePayout(prize).net < prize);
  T('v56 payout breakdown topic shown', S.topics.some(t => t.includes('進上金') && t.includes(h.name)));
}

// ---- v0.56: 経費の項目立て（月末精算） ----
{
  freshS({ year: 2032, month: 3, week: 1, funds: 10000 });
  const r1 = mk({ name: '現役A', status: 'racehorse' });
  const r2 = mk({ name: '現役B', status: 'racehorse', policy: 'pasture' }); // 放牧中も委託費
  const colt = mk({ name: '引退牡', status: 'racehorse' }); colt.retired = true; // 引退牡馬は対象外
  const foal = mk({ name: '当歳馬', status: 'foal', birthYear: 2032 });
  const yrl = mk({ name: '一歳馬', status: 'yearling', birthYear: 2031 });
  const mare = mk({ name: '繁殖牝', status: 'broodmare', sex: '牝' });
  const stud = mk({ name: '自家種牡', status: 'stallion' });
  S.horses = [r1, r2, colt, foal, yrl, mare, stud];
  const total = monthlyCosts(3);
  T('v56 monthly costs total: 委託2x50+育成2x20+繋養2x20+経営100=280', total === 280 && S.funds === 10000 - 280);
  const topicText = S.topics[S.topics.length - 1] || '';
  T('v56 settlement topic is itemised', topicText.includes('委託費 2頭×50万円＝100万円') && topicText.includes('育成費 2頭×20万円＝40万円') && topicText.includes('繋養費 2頭×20万円＝40万円') && topicText.includes('経営費 100万円') && topicText.includes('合計 280万円'));
}
{
  freshS({ year: 2032, month: 3, week: 1, funds: 500 });
  S.horses = [];
  const total = monthlyCosts(3);
  T('v56 empty farm pays 経営費 only', total === 100 && S.funds === 400);
}
{
  freshS({ year: 2032, month: 3, week: 5, funds: 10000 }); /* v1.00：3月は第5週まであるため月末は第5週 */
  const r1 = mk({ name: '月替わり現役', status: 'racehorse', birthYear: 2029 });
  S.horses = [r1];
  advanceWeek(); // 3月第5週 → 4月第1週で3月分を精算
  T('v56 month rollover charges costs once', S.month === 4 && S.funds === 10000 - 150);
  advanceWeek(); advanceWeek(); advanceWeek(); // 4月内の週送りでは精算しない
  T('v56 no mid-month re-charge', S.funds === 10000 - 150);
}

// ---- v0.57: colt retirement 3-way choice ----
{
  freshS({ funds: 10000 });
  const q = mk({ name: '資格牡', sex: '牡', status: 'racehorse', gradedWin: true });
  const price = youngPrice(q);
  const html = coltRetireMenuHtml(q, price);
  T('v57 qualified colt menu shows 3 options', html.includes("id='retireStudBtn'") && html.includes("id='retirePlainBtn'") && html.includes("id='retireSellColtBtn'"));
  T('v57 qualified colt menu labels', html.includes('種牡馬として引退する') && html.includes('引退馬として残る') && html.includes('売却して引退する') && html.includes('種牡馬入りの資格があります'));
  T('v57 qualified colt menu shows frozen price', html.includes(man(price)) && html.includes('で売却されます'));
  T('v57 colt price is youngPrice (deterministic)', youngPrice(q) === price);
}
{
  freshS({ funds: 10000 });
  const u = mk({ name: '無資格牡', sex: '牡', status: 'racehorse', earnings: 5000 });
  const price = youngPrice(u);
  const html = coltRetireMenuHtml(u, price);
  T('v57 unqualified colt menu shows 2 options (no stud)', !html.includes("id='retireStudBtn'") && html.includes("id='retirePlainBtn'") && html.includes("id='retireSellColtBtn'"));
  T('v57 unqualified colt menu shows price', html.includes(man(price)));
}
{
  freshS({ funds: 1000 });
  const c = mk({ name: '売却牡', sex: '牡', status: 'racehorse' });
  S.horses = [c];
  const price = youngPrice(c);
  doRetireSellColt(c, price);
  T('v57 sell credits exact displayed price', S.funds === 1000 + price);
  T('v57 sell removes the horse', S.horses.length === 0 && !S.horses.some(x => x.id === c.id));
  const t = S.topics[S.topics.length - 1] || '';
  T('v57 sell topic matches filly wording', t.includes('引退・売却しました') && t.includes(man(price)));
}
{
  freshS({ funds: 1000 });
  const c = mk({ name: '残留牡', sex: '牡', status: 'racehorse' });
  S.horses = [c];
  doRetireColt(c, false);
  T('v57 stay keeps horse, retired=true, funds unchanged', S.horses.some(x => x.id === c.id) && c.retired === true && c.status === 'racehorse' && S.funds === 1000);
}
{
  freshS({ funds: 1000 });
  const c = mk({ name: '種牡馬牡', sex: '牡', status: 'racehorse', gradedWin: true });
  S.horses = [c];
  doRetireColt(c, true);
  const t = S.topics[S.topics.length - 1] || '';
  T('v57 stud path unchanged', c.status === 'stallion' && c.retired === true && S.stallions.some(s => s.name === '種牡馬牡') && t.includes('種牡馬入りしました') && S.funds === 1000);
}
{
  // HoF consistency with fillies: sell path must NOT fire checkHofMilestone; stay path keeps firing it
  freshS({ funds: 1000 });
  const seller = mk({ name: '殿堂級売却牡', sex: '牡', status: 'racehorse', earnings: 60000 });
  seller.results = [g1win()];
  S.horses = [seller];
  doRetireSellColt(seller, youngPrice(seller));
  T('v57 sell path does not fire HoF milestone (mirrors filly sell)', !(S.mile && S.mile.hof));
  const stayer = mk({ name: '殿堂級残留牡', sex: '牡', status: 'racehorse', earnings: 60000 });
  stayer.results = [g1win()];
  S.horses = [stayer];
  doRetireColt(stayer, false);
  T('v57 stay path still fires HoF milestone', !!(S.mile && S.mile.hof));
}
{
  // filly flow untouched (source-level): filly buttons + marePrice-based freeze still present, old colt label gone
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v57 filly retirement flow untouched in build', src.includes("id='retireSellBtn'") && src.includes("id='retireBroodBtn'") && src.includes('繁殖入りしない場合は、そのまま'));
  T('v57 old colt label removed', !src.includes('種牡馬にせず引退する'));
  T('v57 footer bumped', src.includes('競馬シミュレーター（趣味） v2.2')); /* フッターは現行版に追随（v1.01） */
}

// ---- v0.58: kanmuri applies to gift / debug auto-names (regression: suite had NO kanmuri coverage) ----
{
  // distinctive kanmuri: plain foal names (FOAL_A+FOAL_B combos) can never start with it
  freshS({});
  S.kanmuri = 'テストカンムリ';
  const n1 = farmFoalName();
  T('v58 farmFoalName applies kanmuri when set', n1.startsWith('テストカンムリ') && n1.length > 'テストカンムリ'.length);
  S.kanmuri = '';
  const n2 = farmFoalName();
  T('v58 farmFoalName is plain when kanmuri unset', !n2.startsWith('テストカンムリ') && FOAL_A.some(a => n2.startsWith(a)));
}
{
  freshS({ year: 2030, month: 1, week: 1 });
  S.kanmuri = 'テストカンムリ';
  const y = mk({ name: 'テスト母の28', sex: '牝', status: 'yearling', birthYear: 2028, unnamed: true });
  S.horses = [y];
  onNewYear();
  T('v58 age-2 auto-name in onNewYear applies kanmuri', y.status === 'racehorse' && y.unnamed === false && y.name.startsWith('テストカンムリ'));
}
{
  freshS({ year: 2026, month: 4, week: 1 });
  S.kanmuri = 'テストカンムリ';
  const g2 = makeGift('aprColt');
  T('v58 gift 2yo name carries kanmuri', g2.name.startsWith('テストカンムリ'));
  T('v58 gift 2yo dam name has NO kanmuri', !g2.dam.startsWith('テストカンムリ'));
  const g1 = makeGift('decFilly');
  T('v58 gift 1yo name carries kanmuri, dam does not', g1.name.startsWith('テストカンムリ') && !g1.dam.startsWith('テストカンムリ'));
  S.kanmuri = '';
  const g0 = makeGift('aprColt');
  T('v58 gift name is plain when kanmuri unset', !g0.name.startsWith('テストカンムリ'));
}
{
  // external horses must NOT get the kanmuri: starting candidates / sale-pool mares from makeMare
  freshS({});
  S.kanmuri = 'テストカンムリ';
  const m = makeMare(S.stallions);
  T('v58 external mare has NO kanmuri (own/dam/grandam)', !m.name.startsWith('テストカンムリ') && !m.dam.startsWith('テストカンムリ') && !m.grandam.startsWith('テストカンムリ'));
}
{
  // debug horse: player-owned, so its auto-name (blank input) carries the kanmuri; its fictional dam does not
  freshS({ year: 2030 });
  S.kanmuri = 'テストカンムリ';
  let dbgErr = null, d = null;
  try { createDebugHorse(); d = S.horses[S.horses.length - 1]; } catch(e) { dbgErr = e; }
  T('v58 debug horse auto-name carries kanmuri', !dbgErr && !!d && d.name.startsWith('テストカンムリ'));
  T('v58 debug horse dam has NO kanmuri', !dbgErr && !!d && !d.dam.startsWith('テストカンムリ'));
}
{
  // naming-candidate suggestion rendered on an unnamed foal's horse page
  freshS({ year: 2029, month: 6, week: 1 });
  S.kanmuri = 'テストカンムリ';
  const f = mk({ name: 'テスト母の29', sex: '牝', status: 'yearling', birthYear: 2029, unnamed: true });
  S.horses = [f];
  const origQS = document.querySelector;
  const box = { innerHTML: '' };
  document.querySelector = (sel) => sel === '#horseModalBox' ? box : origQS(sel);
  let pageErr = null;
  try { openHorse(f.id); } catch(e) { pageErr = e; } finally { document.querySelector = origQS; }
  T('v58 naming candidate on horse page includes kanmuri', !pageErr && box.innerHTML.includes('候補：テストカンムリ'));
}
{
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v58 build: makeGift uses farmFoalName', src.includes('name:farmFoalName()'));
  T('v58 build: debug fallback uses farmFoalName', src.includes(': farmFoalName()')); /* v0.59 で buildDebugHorse に分離されても自動名は farmFoalName のまま */
  T('v58 build: footer bumped', src.includes('競馬シミュレーター（趣味） v2.2')); /* フッターは現行版に追随（v1.01） */
}

// ---- v0.59: debug creator brought up to current spec + gift affinities initialised at creation ----
{
  freshS({ year: 2026 });
  const h = buildDebugHorse({ name: 'デバ検証', sex: '牝', age: 3, sire: 'コントレイル', bms: 'キタサンブラック', dam: 'デバ母', spd: 80, sta: 70, gut: 60 });
  T('v59 debug pedigree stored verbatim', h.sire === 'コントレイル' && h.bms === 'キタサンブラック' && h.dam === 'デバ母');
  T('v59 debug sire line resolves like a real foal', stallionMajorLine(S.stallions.find(s => s.name === h.sire)) === 'サンデーサイレンス系');
  T('v59 debug params honoured', h.spd === 80 && h.sta === 70 && h.gut === 60);
}
{
  freshS({ year: 2026 });
  T('v59 debug params clamp at 99 (old 150 scale gone)', (() => { const h = buildDebugHorse({ spd: 150, sta: 120, gut: 100 }); return h.spd === 99 && h.sta === 99 && h.gut === 99; })());
  T('v59 debug params clamp at 1 below', buildDebugHorse({ spd: 0 }).spd === 1);
  T('v59 debug params default 85', (() => { const h = buildDebugHorse({}); return h.spd === 85 && h.sta === 85 && h.gut === 85; })());
}
{
  freshS({ year: 2026 });
  const a = buildDebugHorse({ gtype: '普通遅' });
  T('v59 debug gtype subtype kept, display derived via G_DISP', a.gtype === '普通遅' && a.growth === '普通');
  const b = buildDebugHorse({ gtype: '超早熟' });
  T('v59 debug gtype 超早熟 displays 早熟', b.gtype === '超早熟' && b.growth === '早熟');
  const c = buildDebugHorse({ gtype: '超晩成' });
  T('v59 debug gtype 超晩成 displays 超晩成', c.gtype === '超晩成' && c.growth === '超晩成');
  const d = buildDebugHorse({ gtype: '存在しない型' });
  T('v59 debug invalid gtype falls back to 普通', d.gtype === '普通' && d.growth === '普通');
}
{
  freshS({ year: 2026 });
  T('v59 debug jizoku honoured', buildDebugHorse({ jizoku: true }).jizoku === true);
  T('v59 debug jizoku defaults to none', buildDebugHorse({}).jizoku === false);
}
{
  freshS({ year: 2026 });
  T('v59 debug stable honoured at age>=2', buildDebugHorse({ age: 3, stable: '栗東' }).stable === '栗東' && buildDebugHorse({ age: 2, stable: '美浦' }).stable === '美浦');
  T('v59 debug stable not applied before age 2', !buildDebugHorse({ age: 1, stable: '栗東' }).stable && !buildDebugHorse({ age: 0, stable: '美浦' }).stable);
}
{
  freshS({ year: 2026 });
  T('v59 debug mature weight honoured', buildDebugHorse({ weight: 512 }).matureWeight === 512);
  T('v59 debug weight auto-generated when unset', buildDebugHorse({}).matureWeight != null);
}
{
  freshS({ year: 2026 });
  const h = buildDebugHorse({ age: 3, distMin: 1600, distMax: 2400, rootAff: '○', nonRoot: '○', yuso: true, distBulk: '○', courseBulk: '✕' });
  T('v59 debug aff root explicit', h.aff.rootAff === '○' && !('rootDist' in h.aff));
  T('v59 debug aff explicit beats root/nonRoot exclusion', h.aff.nonRoot === '○');
  T('v59 debug aff yuso explicit', h.aff.yuso === true);
  T('v59 debug aff dist bulk applies in range only', [1600, 1800, 2000, 2200, 2400].every(b => h.aff.distAff[b] === '○') && h.aff.distAff[1000] === undefined);
  T('v59 debug aff course bulk applies to all 10', COURSES10.every(c => h.aff.courseAff[c] === '✕'));
  T('v59 debug aff predictions ready at age>=2', !!h.aff.pred);
  const sec = affinitySection(h);
  T('v59 debug horse page shows affinity section immediately', sec.includes('相性') && sec.includes('根幹距離：') && !/根幹距離 \d/.test(sec));
}
{
  freshS({ year: 2026 });
  const h = buildDebugHorse({ age: 4, distBulk: '-', courseBulk: '-' });
  T('v59 debug aff bulk minus clears marks', Object.keys(h.aff.distAff).length === 0 && Object.keys(h.aff.courseAff).length === 0);
  const r = buildDebugHorse({ age: 4 });
  T('v59 debug aff random base generated', !!r.aff && !('rootDist' in r.aff) && ['○', '✕', '-'].includes(r.aff.rootAff) && typeof r.aff.yuso === 'boolean');
}
{
  // dam name typed to match an existing mare attaches the debug horse to her female line (name matching only, no special code)
  freshS({ year: 2040 });
  const fam = buildFamily('デバ', 5, 3);
  S.horses = fam.all.slice();
  fam.grands[0].results = [g1win()]; fam.grands[1].results = [g1win()]; fam.daus[0].results = [g1win()];
  T('v59 synthetic line established', establishedLines().length === 1 && establishedLines()[0].name === 'デバ根元系');
  const h = buildDebugHorse({ name: 'デバ接続仔', sex: '牝', age: 3, dam: fam.daus[1].name });
  S.horses.push(h);
  T('v59 debug horse joins line via dam name', !!lineOfHorse(h) && lineOfHorse(h).name === 'デバ根元系');
  T('v59 debug horse profile shows family row', familyLineRow(h).includes('デバ根元系'));
}
{
  freshS({ year: 2026, month: 4, week: 1 });
  const g = makeGift('aprColt');
  T('v59 gift aff initialised at creation', !!g.aff && !('rootDist' in g.aff) && !!g.aff.pred);
  S.giftQueue = [g];
  acceptGift('');
  const acc = S.horses[S.horses.length - 1];
  T('v59 accepted gift keeps aff', !!acc.aff);
  T('v59 accepted gift page shows affinity section', affinitySection(acc).includes('相性'));
  const g1 = makeGift('decFilly');
  T('v59 gift 1yo aff initialised (pred comes at 2)', !!g1.aff && !('rootDist' in g1.aff));
}
{
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v59 build: debug pedigree selects + dam input present', src.includes('"dbgSire"') && src.includes("id='dbgDam'") && src.includes('"dbgBms"'));
  T('v59 build: affinity controls present', src.includes('"dbgRootAff"') && src.includes('"dbgYuso"') && src.includes('"dbgCourseBulk"'));
  T('v11 build: rootDist debug control removed', !src.includes('dbgRootDist'));
  T('v59 build: param range note present', src.includes('パラメータ通常 35〜85'));
  T('v59 build: footer bumped', src.includes('競馬シミュレーター（趣味） v2.2'));
}


// ---- v1.00: calendar rework (Sunday-start basis, 5-week months, 52-week year) ----
{
  T('v100 WEEKS_IN_MONTH sums to 52', WEEKS_IN_MONTH.reduce((a, b) => a + b, 0) === 52);
  T('v100 WEEKS_BEFORE is cumulative', WEEKS_BEFORE.every((v, i) => i === 0 ? v === 0 : v === WEEKS_BEFORE[i - 1] + WEEKS_IN_MONTH[i - 1]));
  T('v100 5-week months are Mar/May/Aug/Nov', [3, 5, 8, 11].every(m => WEEKS_IN_MONTH[m - 1] === 5) && WEEKS_IN_MONTH.filter(w => w === 5).length === 4);
  T('v100 absOf samples', absOf(2026, 1, 1) === 0 && absOf(2026, 5, 5) === 21 && absOf(2026, 12, 4) === 51 && absOf(2027, 1, 1) === 52 && absOf(2026, 3, 5) === 12);
  T('v100 fromAbs inverts absOf', [[2026,1,1],[2026,3,5],[2026,5,4],[2026,5,5],[2026,6,1],[2026,8,5],[2026,11,5],[2026,12,4],[2027,1,1],[2030,8,5]].every(t => { const u = fromAbs(absOf(t[0], t[1], t[2])); return u[0] === t[0] && u[1] === t[1] && u[2] === t[2]; }));
  T('v100 shiftWeek crosses 5th week and month ends', (() => { const a = shiftWeek(2026, 5, 4, 1); const b = shiftWeek(2026, 5, 5, 1); const c = shiftWeek(2026, 12, 4, 1); return a[1] === 5 && a[2] === 5 && b[1] === 6 && b[2] === 1 && c[0] === 2027 && c[1] === 1 && c[2] === 1; })());
  T('v100 absLabel shows week 5', absLabel(absOf(2026, 11, 5)) === '11月第5週' && absLabel(absOf(2026, 5, 4)) === '5月第4週');
}
{
  const slot = n => { const r = DATA.domestic.find(x => x.name === n); return r ? r.month * 100 + r.wom : -1; };
  T('v100 Oaks (2026-05-24) -> May w4', slot('オークス') === 504);
  T('v100 Derby (2026-05-31) -> May w5', slot('日本ダービー') === 505);
  T('v100 Oaks and Derby no longer share a slot', slot('オークス') !== slot('日本ダービー'));
  T('v100 Victoria Mile (05-17) -> May w3', slot('ヴィクトリアマイル') === 503);
  T('v100 Yasuda Kinen (06-07) -> Jun w1', slot('安田記念') === 601);
  T('v100 Takamatsunomiya (03-29) -> Mar w5', slot('高松宮記念') === 305);
  T('v100 Nikkei Sho (03-28, same weekend) -> Mar w5', slot('日経賞') === 305);
  T('v100 Oka Sho (04-12) -> Apr w2', slot('桜花賞') === 402);
  T('v100 Satsuki Sho (04-19) -> Apr w3', slot('皐月賞') === 403);
  T('v100 Kikuka Sho (10-25) -> Oct w4', slot('菊花賞') === 1004);
  T('v100 Shuka Sho (10-18) -> Oct w3', slot('秋華賞') === 1003);
  T('v100 Mile CS (11-22) -> Nov w4', slot('マイルチャンピオンシップ') === 1104);
  T('v100 Japan Cup (11-29) -> Nov w5', slot('ジャパンC') === 1105);
  T('v100 Niigata Nisai (08-23) -> Aug w4', slot('新潟2歳S') === 804);
  T('v100 Niigata Kinen (08-30) -> Aug w5', slot('新潟記念') === 805);
  T('v100 Arima Kinen (12-27) -> Dec w4', slot('有馬記念') === 1204);
  T('v100 Tokyo Daishoten (12-29 Tue, weekday rule: week starts Sun 12-27) -> Dec w4', slot('東京大賞典') === 1204);
  /* v1.00 refinement (Terai, 2026-11-15): weekday races anchor to the Sunday STARTING their week;
     Sat keeps the next Sunday, Sun keeps itself — the Sat/Sun slots above must not move */
  T('v100r Kakitsubata Kinen (2026-02-23 Mon) -> Feb w4 (was Mar w1 under next-Sunday rule)', slot('かきつばた記念') === 204);
  T('v100r JBC Classic (2026-11-03 Tue, week starts Sun 11-01) -> Nov w1', slot('JBCクラシック') === 1101);
  T('v100r Daio Lite Kinen (2026-03-11 Wed, week starts Sun 03-08) -> Mar w2', slot('ダイオライト記念') === 302);
  T('v100r Teio Sho (2026-07-01 Wed, week starts Sun 06-28) -> Jun w4', slot('帝王賞') === 604);
  T('v100 every race wom within its month length', DATA.domestic.concat(DATA.overseas).every(r => r.wom >= 1 && r.wom <= WEEKS_IN_MONTH[r.month - 1]));
  T('v100 graded races exist in all four 5th weeks', [3, 5, 8, 11].every(m => DATA.domestic.some(r => r.month === m && r.wom === 5 && ['GI','GII','GIII','JpnI','JpnII','JpnIII'].includes(r.grade))));
  T('v100 October stays 4 weeks (Oct 31 races sit in Nov w1)', !DATA.domestic.some(r => r.month === 10 && r.wom === 5) && DATA.domestic.some(r => r.month === 11 && r.wom === 1));
}
{
  freshS({ year: 2026, month: 1, week: 1, phase: 'play' });
  S.horses = [];
  const seen = [];
  let mono = true, prev = absWeek();
  for (let i = 0; i < 52; i++) {
    seen.push(S.year * 10000 + S.month * 100 + S.week);
    advanceWeek();
    if (absWeek() !== prev + 1) mono = false;
    prev = absWeek();
  }
  T('v100 walking a year visits 52 distinct weeks', new Set(seen).size === 52);
  T('v100 absWeek strictly increases by 1 each advance', mono);
  T('v100 after 52 advances it is 2027 Jan w1', S.year === 2027 && S.month === 1 && S.week === 1 && absWeek() === 52);
}
{
  freshS({ year: 2026, month: 5, week: 1, phase: 'play' });
  S.horses = [];
  const derby = DATA.domestic.find(r => r.name === '日本ダービー');
  const h = mk({ name: 'カレンダー登録馬', status: 'racehorse' });
  const key = absOf(S.year, 5, derby.wom) + '@' + derby.name + '|' + derby.racecourse + '|' + derby.grade;
  h.entries = {}; h.entries[absOf(S.year, 5, derby.wom)] = { key, style: null };
  S.horses = [h];
  calMonth = 5;
  const html = viewCalendar();
  T('v100 calendar tab renders week-5 section', html.includes('第5週'));
  T('v100 calendar tab shows Derby in week 5', html.includes('日本ダービー'));
  T('v100 calendar tab marks week-5 entry', html.includes('登録：カレンダー登録馬'));
  calMonth = 0;
}
{
  freshS({ year: 2030, month: 5, week: 5, funds: 12345 });
  T('v100 new state is stamped calVer 2', S.calVer === 2);
  save();
  const keptFunds = S.funds;
  S.funds = -999; S.year = 1999;
  T('v100 save/load roundtrip under v8 key', load() === true && S.funds === keptFunds && S.year === 2030 && S.month === 5 && S.week === 5 && S.calVer === 2);
}
{
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v100 build: SAVE_KEY bumped to v8', src.includes('nkc_whc_keiba_proto_v8'));
  T('v100 build: import refuses pre-rework saves', src.includes('data.calVer !== 2') && src.includes('カレンダー再編（v1.00）より前の形式のため読み込めません'));
  T('v100 build: footer bumped', src.includes('競馬シミュレーター（趣味） v2.2'));
  T('v100 build: skip week 5 option exists', src.includes('<option>5</option>'));
}

// ---- v1.01: first-year gifts replaced with fixed model horses ----
{
  // April 2026 trigger: exactly two 2yo gifts queued together (colt first, then filly).
  // v1.2: the pair is one of two sets — here the set is pinned to A (turf colt + dirt filly).
  // Set B and the roll itself are covered in the v1.2 block below.
  freshS({ year: 2026, month: 4, week: 1, giftSet: 'A' });
  S.giftQueue = [];
  weeklyEvents();
  T('v101 April queues exactly 2 gifts', S.giftQueue.length === 2 && S.giftAprDone === true);
  const c = S.giftQueue[0], f = S.giftQueue[1];
  T('v101 April colt is the Efforia model', c.sex === '牡' && c.sire === 'エピファネイア' && c.dam === 'ケイティーズハート' && c.bms === 'ハーツクライ' && c.grandam === 'ケイティーズファースト' && c.gbms === 'クリス');
  T('v101 April colt aptitude + growth subtype', c.surface === '芝' && c.distMin === 1800 && c.distMax === 2500 && c.gtype === '普通早' && c.growth === '普通' && c.status === 'racehorse');
  T('v101 set A filly is the Marche Lorraine model', f.sex === '牝' && f.sire === 'オルフェーヴル' && f.dam === 'ヴィートマルシェ' && f.bms === 'フレンチデピュティ' && f.grandam === 'キョウエイマーチ' && f.gbms === 'ダンシングブレーヴ');
  T('v101 April filly has no explicit jizoku spec (trait is not forced)', GIFT_SPECS.aprFilly.jizoku == null);
  T('v101 Monsun chain supplemented like a template bmsLine (real sire Koenigsstuhl)', sireChainOf('モンズーン').includes('ケーニヒスシュトゥール'));
  T('v101 Monsun stays a side line (Blandford branch reaches no major-line marker)', majorLineOfName('モンズーン') === null);
  T('v101 April gifts are B-rank overall', rankOf(Math.round((c.spd + c.sta + c.gut) / 3)) === 'B' && rankOf(Math.round((f.spd + f.sta + f.gut) / 3)) === 'B');
  // each April horse is independently acceptable / refusable through the existing panel flow
  acceptGift('');
  T('v101 April colt accepted, filly still queued', S.horses.some(h => h.sire === 'エピファネイア') && S.giftQueue.length === 1 && S.giftQueue[0].sire === 'オルフェーヴル');
  refuseGift();
  T('v101 April filly refused independently', S.giftQueue.length === 0 && !S.horses.some(h => h.sire === 'オルフェーヴル'));
}
{
  // December 2026 trigger: exactly one 1yo filly with the fixed pedigree
  freshS({ year: 2026, month: 12, week: 1 });
  S.giftQueue = [];
  weeklyEvents();
  T('v101 December queues exactly 1 gift', S.giftQueue.length === 1 && S.giftDecDone === true);
  const d = S.giftQueue[0];
  T('v101 December filly fixed pedigree', d.sex === '牝' && d.sire === 'キタサンブラック' && d.bms === 'キングカメハメハ' && d.gbms === 'エンドスウィープ' && d.status === 'yearling');
  T('v101 December filly growth subtype + B rank', d.gtype === '普通遅' && rankOf(Math.round((d.spd + d.sta + d.gut) / 3)) === 'B');
  // her dam resolves through the pedigree holder lookup, like a mare template's would
  S.horses.push(d);
  const damRec = personRec(d.dam), gdamRec = personRec(d.grandam);
  T('v101 December pedigree plumbing (dam -> King Kamehameha, grandam -> End Sweep)', !!damRec && damRec.sire === 'キングカメハメハ' && !!gdamRec && gdamRec.sire === 'エンドスウィープ');
  T('v101 December BMS line resolves to Kingmambo', majorLineOfName(d.bms) === 'キングマンボ系');
  T('v101 End Sweep chain supplemented like a template gbmsLine', sireChainOf('エンドスウィープ').includes('フォーティナイナー'));
}
{
  // April filly pedigree plumbing: her dam/grandam resolve through the pedigree holder lookup
  freshS({ year: 2026 });
  const f2 = makeGift('aprFilly');
  S.horses.push(f2);
  const damRec2 = personRec(f2.dam), gdamRec2 = personRec(f2.grandam);
  T('v101 April filly pedigree plumbing (dam -> Monsun, grandam -> Dashing Blade)', !!damRec2 && damRec2.sire === 'モンズーン' && !!gdamRec2 && gdamRec2.sire === 'ダッシングブレイド');
  T('v101 April filly coat is dark bay like the real Soul Stirring', f2.coat === '青鹿毛');
}
{
  // gifts fire in the first year (2026) only
  freshS({ year: 2027, month: 4, week: 1 });
  S.giftQueue = [];
  weeklyEvents();
  T('v101 no April gifts in 2027', S.giftQueue.length === 0 && !S.giftAprDone);
  freshS({ year: 2027, month: 12, week: 1 });
  S.giftQueue = [];
  weeklyEvents();
  T('v101 no December gifts in 2027', S.giftQueue.length === 0 && !S.giftDecDone);
}
{
  // B-rank guarantee across repeated generations of all five gifts (v1.2: two dirt models added)
  freshS({ year: 2026 });
  let allB = true, allInBand = true, allAvg = true;
  for(let i = 0; i < 60; i++){
    for(const k of ['aprColt', 'aprFilly', 'decFilly', 'aprColtDirt', 'aprFillyDirt']){
      const g = makeGift(k);
      const avg = Math.round((g.spd + g.sta + g.gut) / 3);
      if(rankOf(avg) !== 'B') allB = false;
      if(avg < 73 || avg > 77) allAvg = false;
      if([g.spd, g.sta, g.gut].some(v => v < 35 || v > 85)) allInBand = false;
    }
  }
  T('v101 all five gifts always land on B overall (300 generations)', allB);
  T('v101 gift averages stay inside the 73-77 B band', allAvg);
  T('v101 gift params stay inside the 35-85 scale', allInBand);
  let fillyJizokuCount = 0;
  for(let i = 0; i < 60; i++){ if(makeGift('aprFilly').jizoku === true) fillyJizokuCount++; }
  T('v101 Soul Stirring filly jizoku is not forced (60 generations, not all true)', fillyJizokuCount < 60);
}
{
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v101 build: fixed gift models present', src.includes('ケイティーズハート') && src.includes('スタセリタ') && src.includes('エンドスウィープ'));
  T('v101 build: footer bumped', src.includes('競馬シミュレーター（趣味） v2.2'));
}

// ---- v1.01: roster expansion 54 -> 60 (Terai, 2026-11-15) ----
{
  const NEW6 = {
    'チュウワウィザード': { tier: 'C', surface: 'ダート', dist: [1800, 2100], sire: 'キングカメハメハ', dam: 'チュウワブロッサム', bms: 'デュランダル' },
    'ジオグリフ': { tier: 'B', surface: '芝', dist: [1600, 2000], sire: 'ドレフォン', dam: 'アロマティコ', bms: 'キングカメハメハ' },
    'ピクシーナイト': { tier: 'C', surface: '芝', dist: [1200, 1400], sire: 'モーリス', dam: 'ピクシーホロウ', bms: 'キングヘイロー' },
    'アダイヤー': { tier: 'B', surface: '芝', dist: [2000, 2400], sire: 'Frankel', dam: 'アンナサライ', bms: 'Dubawi' },
    'サンダースノー': { tier: 'C', surface: 'ダート', dist: [1600, 2000], sire: 'ヘルメット', dam: 'イースタンジョイ', bms: 'ドバイデスティネーション' },
    'タワーオブロンドン': { tier: 'C', surface: '芝', dist: [1200, 1600], sire: 'レイヴンズパス', dam: 'スノーパイン', bms: 'ダラカニ' }
  };
  for(const nm of Object.keys(NEW6)){
    const st = DATA.stallions.find(s => s.name === nm), e = NEW6[nm];
    T('v101 roster: ' + nm + ' record shape', !!st && st.fee_tier === e.tier && st.surface === e.surface && st.dist[0] === e.dist[0] && st.dist[1] === e.dist[1] && st.sire === e.sire && st.dam === e.dam && st.bms === e.bms && !!st.grandam && !!st.gbms && Array.isArray(st.bmsLine) && st.weight >= 400 && st.weight <= 600);
  }
  T('v101 roster: census is SS21/ND16/KM8/MrP6/Roberto4/Seattle2/Nasrullah2/MoW1', (() => {
    const c = {};
    for(const st of DATA.stallions){ const ln = stallionMajorLine(st); c[ln] = (c[ln] || 0) + 1; }
    return c['サンデーサイレンス系'] === 21 && c['ノーザンダンサー系'] === 16 && c['キングマンボ系'] === 8 && c['ミスタープロスペクター系'] === 6 && c['ロベルト系'] === 4 && c['シアトルスルー系'] === 2 && c['ナスルーラ系'] === 2 && c['マンノウォー系'] === 1 && Object.keys(c).length === 8;
  })());
  T('v101 roster: pinned growth subtypes for Geoglyph / Tower of London', stGtype(DATA.stallions.find(s => s.name === 'ジオグリフ')) === '普通早' && stGtype(DATA.stallions.find(s => s.name === 'タワーオブロンドン')) === '普通早');
  T('v101 roster: personRec resolves new dam sides', personRec('チュウワウィザード').dam === 'チュウワブロッサム' && personRec('オータムブリーズ').sire === 'ティンバーカントリー' && personRec('アロマティコ').dam === 'ナスカ' && personRec('スノーパイン').dam === 'シンコウエルメス' && personRec('シンコウエルメス').sire === "Sadler's Wells");
  freshS({});
  T('v101 roster: new sire names resolve to their major lines', majorLineOfName('チュウワウィザード') === 'キングマンボ系' && majorLineOfName('ジオグリフ') === 'ノーザンダンサー系' && majorLineOfName('ピクシーナイト') === 'ロベルト系' && majorLineOfName('アダイヤー') === 'ノーザンダンサー系' && majorLineOfName('サンダースノー') === 'ノーザンダンサー系' && majorLineOfName('タワーオブロンドン') === 'ミスタープロスペクター系');
}
{
  // mating with each new stallion produces a valid foal
  for(const nm of ['チュウワウィザード', 'ジオグリフ', 'ピクシーナイト', 'アダイヤー', 'サンダースノー', 'タワーオブロンドン']){
    freshS({ year: 2032, month: 1, week: 1 });
    const mare = mk({ name: '配合母' + nm, sex: '牝', status: 'broodmare', birthYear: 2024, surface: '芝', distMin: 1600, distMax: 2400 });
    setParams(mare, 70, 70, 70); mare.temp = 55; mare.matureWeight = 480; mare.coat = '鹿毛';
    mare.pregnant = { sire: nm, dueYear: 2032 };
    S.horses = [mare];
    onNewYear();
    const foal = S.horses.find(h => h.status === 'foal' && h.sire === nm);
    T('v101 roster: mating with ' + nm + ' produces a valid foal', !!foal && [foal.spd, foal.sta, foal.gut].every(v => typeof v === 'number' && v >= 35 && v <= 85) && foal.distMin < foal.distMax && ['芝', 'ダート', '両刀'].includes(foal.surface));
  }
}
{
  // a 54-stallion save gains the six through roster sync; homebred stallion untouched
  freshS({});
  const NEWNAMES = ['チュウワウィザード', 'ジオグリフ', 'ピクシーナイト', 'アダイヤー', 'サンダースノー', 'タワーオブロンドン'];
  const old = JSON.parse(JSON.stringify(DATA.stallions.filter(s => !NEWNAMES.includes(s.name))));
  old[0].genSpd = 71;
  const homebred = { name: '自家テスト種牡馬', sire: 'コントレイル', region: 'domestic', surface: '芝', dist: [1600, 2400], growth: '普通', fee_tier: 'B', fresh: true };
  S.stallions = old.concat([JSON.parse(JSON.stringify(homebred))]);
  T('v101 roster sync: fixture is 54 + homebred', S.stallions.length === 55);
  migrateV029();
  T('v101 roster sync: 54-stallion save gains all six (60 + homebred)', S.stallions.length === 61 && NEWNAMES.every(n => { const r = S.stallions.find(s => s.name === n); return !!r && !!r.dam && !!r.bms && !!r.grandam; }));
  T('v101 roster sync: homebred stallion untouched', (() => { const hb = S.stallions.find(s => s.name === '自家テスト種牡馬'); return !!hb && hb.sire === 'コントレイル' && hb.fee_tier === 'B' && hb.dam === undefined; })());
  T('v101 roster sync: genetic cache preserved', S.stallions.find(s => s.name === old[0].name).genSpd === 71);
}

// ---- v1.01: 引退馬リスト／繁殖引退の枠外し／繁殖牝馬ランク表示（Terai決定 2026-11-15） ----
{
  // 17歳の自動繁殖引退でステータスが retired になり、頭数枠から外れる
  freshS({ year: 2043, month: 1, week: 1 });
  const old = mk({ name: '高齢繁殖牝', sex: '牝', status: 'broodmare', birthYear: 2026 });
  S.horses = [old];
  T('v101 breed-retire: mare counts toward cap before 17', mareCount() === 1);
  onNewYear();
  T('v101 breed-retire: 17yo mare auto-retires from breeding', old.breedRetired === true && old.status === 'retired' && old.retired === true);
  T('v101 breed-retire: cap freed at 17', mareCount() === 0);
  T('v101 breed-retire: no longer breedable', mareBreedable(old) === false);
}
{
  // 繋養費：繁殖牝馬は対象、繁殖引退後は対象外（経営費のみ）
  freshS({ year: 2032, month: 3, week: 1, funds: 10000 });
  const mare = mk({ name: '繋養テスト牝', sex: '牝', status: 'broodmare', birthYear: 2026 });
  S.horses = [mare];
  T('v101 costs: active broodmare pays 繋養費 (20+経営100=120)', monthlyCosts(3) === 120);
  retireFromBreeding(mare);
  T('v101 costs: breeding-retired mare pays no 繋養費 (経営費のみ)', monthlyCosts(3) === 100 && S.funds === 10000 - 220);
}
{
  // 手動の繁殖引退：可能判定と受胎中ブロック
  freshS({ year: 2032 });
  const m1 = mk({ name: '手動引退牝', sex: '牝', status: 'broodmare', birthYear: 2026 });
  const m2 = mk({ name: '受胎中牝', sex: '牝', status: 'broodmare', birthYear: 2026 });
  m2.pregnant = { sire: 'コントレイル', dueYear: 2033 };
  S.horses = [m1, m2];
  T('v101 manual breed-retire: allowed when not pregnant', canBreedRetire(m1) === true);
  T('v101 manual breed-retire: blocked while pregnant', canBreedRetire(m2) === false);
  retireFromBreeding(m1);
  T('v101 manual breed-retire: status flips and cap frees', m1.status === 'retired' && mareCount() === 1);
  T('v101 manual breed-retire: retireFromBreeding is a no-op for non-broodmares', (() => { const r = mk({ status: 'racehorse' }); retireFromBreeding(r); return r.status === 'racehorse' && !r.breedRetired; })());
}
{
  // 繁殖引退した牝馬は繁殖タブの一覧から消え、牝系図と産駒一覧には残る
  freshS({ year: 2032, month: 9, week: 1 });
  const founder = mk({ name: 'ライン根元牝', sex: '牝', status: 'broodmare', birthYear: 2020, dam: '外の母' });
  const daughter = mk({ name: 'ライン娘', sex: '牝', status: 'racehorse', birthYear: 2028, dam: 'ライン根元牝' });
  const active = mk({ name: '現役繁殖牝', sex: '牝', status: 'broodmare', birthYear: 2026 });
  S.horses = [founder, daughter, active];
  retireFromBreeding(founder);
  const breedHtml = broodmareTable();
  T('v101 retired mare: gone from broodmare table', !breedHtml.includes('ライン根元牝') && breedHtml.includes('現役繁殖牝'));
  const line = femaleLines().find(L => L.founder.name === 'ライン根元牝');
  T('v101 retired mare: still founder of her female line', !!line && line.members.some(m => m.id === founder.id) && line.members.some(m => m.id === daughter.id));
  T('v101 retired mare: produce list still works on her profile', produceSection(founder).includes('ライン娘'));
  T('v101 retired mare: still on the farm (profile data intact)', S.horses.some(x => x.id === founder.id));
}
{
  // 競走引退馬は所有馬リストの全絞込みから外れ、引退馬リスト側に載る
  freshS({ year: 2032 });
  const colt = mk({ name: '引退牡テスト', sex: '牡', status: 'racehorse', birthYear: 2027 }); colt.retired = true;
  const active = mk({ name: '現役牡テスト', sex: '牡', status: 'racehorse', birthYear: 2027 });
  const stud = mk({ name: '種牡馬テスト', sex: '牡', status: 'stallion', birthYear: 2020 }); stud.retired = true; // 引退して種牡馬入りした馬は現役種牡馬なので引退馬リストには載せない
  S.horses = [colt, active, stud];
  const filters = ['all', 'active', 'racehorse', 'young', 'breeding'];
  T('v101 main list: racing-retired excluded from every filter', filters.every(f => { horseFilter = f; return !mainListMatch(colt); }));
  horseFilter = 'all';
  T('v101 main list: active racehorse still listed', mainListMatch(active) === true);
  T('v101 alumni: stud stallion is not alumni', isAlumni(stud) === false && isAlumni(colt) === true);
  const entries = retiredListEntries();
  T('v101 retired list: racing-retired appears, stallion does not', entries.some(e => e.horse && e.horse.id === colt.id) && !entries.some(e => e.horse && e.horse.id === stud.id));
  horseFilter = 'active';
}
{
  // 購入馬タグ：開始時の選択・セール購入のどちらでも origin が付き、引退馬リストで「購入馬」と出る
  freshS({ funds: 10000, phase: 'play' });
  const cand = S.candidates[0];
  chooseMare(cand.id);
  T('v101 origin: starting mare tagged 購入', cand.origin === '購入' && S.horses.some(x => x.id === cand.id));
  freshS({ funds: 10000, phase: 'play' });
  const saleMare = makeMare(S.stallions, 'A'); saleMare.price = 1000;
  S.salePool = [saleMare];
  buyMare(saleMare.id);
  T('v101 origin: bought mare tagged 購入 and keeps her sale rank', saleMare.origin === '購入' && S.horses.some(x => x.id === saleMare.id) && saleMare.rank === 'A');
  retireFromBreeding(saleMare);
  const html = retiredListHtml();
  T('v101 retired list: purchased ex-broodmare shows 購入馬 and her rank', html.includes(saleMare.name) && html.includes('購入馬') && html.includes('繁殖引退') && html.includes('ランクA'));
  // 移行：旧セーブの購入牝馬（rank あり・母が牧場外）は origin を推定して付ける。自家生産（母が牧場内）は付けない
  freshS({});
  const damInFarm = mk({ name: '牧場の母', sex: '牝', status: 'broodmare', birthYear: 2020 });
  const oldBought = mk({ name: '旧購入牝', sex: '牝', status: 'broodmare', birthYear: 2024, dam: '外の母', rank: 'B' });
  const homebred = mk({ name: '自家製牝', sex: '牝', status: 'broodmare', birthYear: 2028, dam: '牧場の母', rank: 'B' });
  S.horses = [damInFarm, oldBought, homebred];
  migrateV029();
  T('v101 origin migration: purchased mare inferred, homebred not tagged', oldBought.origin === '購入' && homebred.origin == null);
  // 移行：繁殖引退済みの牝馬は新ステータスへ。受胎中は出産まで据え置き
  const doneMare = mk({ name: '移行繁殖引退牝', sex: '牝', status: 'broodmare', birthYear: 2020 }); doneMare.breedRetired = true;
  const pregMare = mk({ name: '移行受胎牝', sex: '牝', status: 'broodmare', birthYear: 2020 }); pregMare.breedRetired = true; pregMare.pregnant = { sire: 'コントレイル', dueYear: 2027 };
  S.horses = [doneMare, pregMare];
  migrateV029();
  T('v101 migration: breedRetired mare converts to retired status', doneMare.status === 'retired' && mareCount() === 1);
  T('v101 migration: pregnant breedRetired mare stays broodmare until foaling', pregMare.status === 'broodmare');
}
{
  // 売却：記録が残り、馬は S.horses から消える。売却した牝馬は牝系に戻らない
  freshS({ year: 2033, funds: 1000 });
  const colt = mk({ name: '売却牡テスト', sex: '牡', status: 'racehorse', birthYear: 2029, wins: 3, earnings: 5000 });
  S.horses = [colt];
  doRetireSellColt(colt, 800);
  T('v101 sale: colt leaves the farm and funds increase', !S.horses.some(x => x.id === colt.id) && S.funds === 1800);
  T('v101 sale: sold record appended with career snapshot', S.soldHorses.length === 1 && S.soldHorses[0].name === '売却牡テスト' && S.soldHorses[0].year === 2033 && S.soldHorses[0].price === 800 && S.soldHorses[0].wins === 3 && S.soldHorses[0].earnings === 5000 && S.soldHorses[0].wasBroodmare === false);
  T('v101 sale: sold record shows in retired list as 売却', retiredListHtml().includes('売却牡テスト') && retiredListHtml().includes('売却'));
  const mare = mk({ name: '売却牝テスト', sex: '牝', status: 'broodmare', birthYear: 2025, dam: '外の母', rank: 'B', origin: '購入' });
  const herDaughter = mk({ name: '売却牝の娘', sex: '牝', status: 'racehorse', birthYear: 2030, dam: '売却牝テスト' });
  S.horses = [mare, herDaughter];
  recordSale(mare, 1500); S.horses = S.horses.filter(x => x.id !== mare.id);
  T('v101 sale: sold broodmare record keeps 購入馬 origin and rank', S.soldHorses.length === 2 && S.soldHorses[1].wasBroodmare === true && S.soldHorses[1].origin === '購入' && S.soldHorses[1].rank === 'B');
  T('v101 sale: sold broodmare does not re-enter female lines', !femaleLines().some(L => L.members.some(m => m.name === '売却牝テスト')));
  T('v101 sale: sold broodmare shows 購入馬 in retired list', retiredListHtml().includes('売却牝テスト') && retiredListHtml().includes('購入馬'));
}
{
  // ランク表示：購入牝馬はセール時の保存ランクがそのまま出る（パラメータ平均のランクと食い違っても保存ランク優先）
  freshS({ funds: 10000, phase: 'play' });
  const m = makeMare(S.stallions, 'S');
  setParams(m, 68, 68, 68); // 素質平均は C 帯まで下げる
  m.price = 1000; S.salePool = [m];
  buyMare(m.id);
  T('v101 rank: stored sale rank wins over param average', mareRankOf(m) === 'S' && rankOf(Math.round((m.spd + m.sta + m.gut) / 3)) === 'C');
  horseFilter = 'breeding';
  const html = viewHorses();
  T('v101 rank: horse list shows the sale rank by her name', html.includes(m.name) && html.includes('ランクS'));
  // 自家製の繁殖牝馬は素質総合のランクで表示される
  const home = mk({ name: '自家製繁殖牝', sex: '牝', status: 'broodmare', birthYear: 2028, dam: '牧場の母' });
  setParams(home, 80, 80, 80);
  S.horses.push(home);
  T('v101 rank: homebred mare falls back to 素質 overall rank', home.rank == null && mareRankOf(home) === 'A');
  T('v101 rank: homebred mare rank shows in the list', viewHorses().includes('自家製繁殖牝') && viewHorses().includes('ランクA'));
  horseFilter = 'active';
}

// ---- v1.02: スマホ横画面・小画面対応（表示のみ。構造の確認） ----
{
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v102 build: footer bumped', src.includes('競馬シミュレーター（趣味） v2.2'));
  T('v102 build: compact media queries present', src.includes('@media (max-width:640px), (max-height:500px)'));
  T('v102 build: tscroll wrapper css', src.includes('.tscroll { overflow-x:auto'));
  T('v102 build: wrapTables defined', src.includes('function wrapTables(root)'));
  T('v102 build: wrapTables hooked in render', src.includes('wrapTables(b)'));
  T('v102 build: wrapTables hooked in horse modal', src.includes('wrapTables($("#horseModalBox"))'));
  T('v102 build: tabs single-row scroll in compact', src.includes('.tabs { flex-wrap:nowrap; overflow-x:auto'));
  T('v102 build: touch target min-height 36px', src.includes('button { min-height:36px; font-size:13px;'));
  T('v102 build: sticky first column in compact', src.includes('table:not(.ped) td:first-child { position:sticky; left:0'));
  T('v102 build: modal dvh heights', src.includes('max-height:88dvh') && src.includes('max-height:96dvh'));
  T('v102 build: lineage tree compact max-height', src.includes('.ltree-scroll { max-height:62dvh; overflow-y:auto; }'));
  const style = (src.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  let bal = 0, okB = style.length > 0;
  for (const ch of style) { if (ch === '{') bal++; else if (ch === '}') { bal--; if (bal < 0) { okB = false; break; } } }
  T('v102 build: style braces balanced', okB && bal === 0);
}

// ---- v1.03: compact 表示をもう一段締める（表示のみ。構造の確認） ----
{
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v103 build: footer bumped', src.includes('競馬シミュレーター（趣味） v2.2'));
  T('v103 build: compact base font 13.5px', src.includes('body { font-size:13.5px; line-height:1.5; }'));
  T('v103 build: modal h2 17px', src.includes('.modal h2 { font-size:17px; }'));
  T('v103 build: h3 14.5px', src.includes('h3 { font-size:14.5px; margin:12px 0 6px; }'));
  T('v103 build: panel h2 14.5px', src.includes('.panel h2 { font-size:14.5px; margin:2px 0 6px; }'));
  T('v103 build: kv tightened (74px label, gap, 13px)', src.includes('.kv { grid-template-columns:74px 1fr; gap:3px 8px; font-size:13px; }'));
  T('v103 build: input font 16px guard (iOS zoom)', src.includes('select, input[type=text], textarea { font-size:16px; }'));
  T('v103 build: modal box padding 10px', src.includes('padding:10px; max-height:96dvh; }'));
  // 新ルールが compact メディアクエリの外に漏れていないこと（PC表示を変えない）
  const style = (src.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const mi = style.indexOf('@media (max-width:640px), (max-height:500px)');
  let depth = 0, mk = style.indexOf('{', mi);
  while (mk < style.length) { if (style[mk] === '{') depth++; else if (style[mk] === '}') { depth--; if (depth === 0) break; } mk++; }
  const block = style.slice(mi, mk + 1), outside = style.slice(0, mi) + style.slice(mk + 1);
  const newRules = ['body { font-size:13.5px', '.modal h2 { font-size:17px', '.kv { grid-template-columns:74px', 'textarea { font-size:16px'];
  T('v103 build: new rules stay inside compact media query', mi >= 0 && newRules.every(r => block.includes(r) && !outside.includes(r)));
  let bal = 0, okB = style.length > 0;
  for (const ch of style) { if (ch === '{') bal++; else if (ch === '}') { bal--; if (bal < 0) { okB = false; break; } } }
  T('v103 build: style braces balanced', okB && bal === 0);
}

// ---- v1.04: プルダウン均一化／ツールバーの列揃え／スキップ並び（表示のみ。構造の確認） ----
{
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v104 build: footer bumped', src.includes('競馬シミュレーター（趣味） v2.2'));
  T('v104 build: select height pinned base 32px', src.includes('select { height:32px; padding:0 8px; }'));
  T('v104 build: select height pinned compact 36px', src.includes('select { height:36px; padding:0 8px; }'));
  T('v104 build: horse toolbar uses listtools', src.includes("class='flex listtools'"));
  T('v104: horse toolbar markup has listtools', viewHorses().includes("class='flex listtools'"));
  T('v104 build: skip controls restructured', src.includes('class="skipctl"') && src.includes('class="skiprow"') && src.includes('class="skipwk"'));
  T('v104 build: skip week group nowrap', src.includes('.skipwk { display:inline-flex; gap:6px; align-items:center; white-space:nowrap; }'));
  T('v104 build: skip button below controls in compact', src.includes('.skipctl { flex-direction:column; align-items:flex-start; gap:6px; }'));
  // compact 専用ルールがメディアクエリの外に漏れていないこと（PC表示を変えない）
  const style = (src.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const mi = style.indexOf('@media (max-width:640px), (max-height:500px)');
  let depth = 0, mk = style.indexOf('{', mi);
  while (mk < style.length) { if (style[mk] === '{') depth++; else if (style[mk] === '}') { depth--; if (depth === 0) break; } mk++; }
  const block = style.slice(mi, mk + 1), outside = style.slice(0, mi) + style.slice(mk + 1);
  const compactOnly = ['.listtools { display:grid', '.listtools select { width:100%', '.skipctl { flex-direction:column', '.skiprow input[type=text] { width:4.5em'];
  T('v104 build: compact-only rules stay inside media query', mi >= 0 && compactOnly.every(r => block.includes(r) && !outside.includes(r)));
  let bal = 0, okB = style.length > 0;
  for (const ch of style) { if (ch === '{') bal++; else if (ch === '}') { bal--; if (bal < 0) { okB = false; break; } } }
  T('v104 build: style braces balanced', okB && bal === 0);
}

// ---- v1.05: コントロール群の文字サイズ統一（表示のみ。構造の確認） ----
{
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v105 build: footer bumped', src.includes('競馬シミュレーター（趣味） v2.2'));
  T('v105 build: skip group font unified 13.5px', src.includes('.skipctl .sub, .skipctl button, .skipctl select, .skipctl input[type=text] { font-size:13.5px; }'));
  T('v105 build: toolbar select font matches label base 13.5px', src.includes('.listtools select { font-size:13.5px; }') && src.includes('body { font-size:13.5px; line-height:1.5; }'));
  T('v105 build: typing-input 16px guard kept', src.includes('select, input[type=text], textarea { font-size:16px; }'));
  // 新ルールが compact メディアクエリの外に漏れていないこと（PC表示を変えない）
  const style = (src.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const mi = style.indexOf('@media (max-width:640px), (max-height:500px)');
  let depth = 0, mk = style.indexOf('{', mi);
  while (mk < style.length) { if (style[mk] === '{') depth++; else if (style[mk] === '}') { depth--; if (depth === 0) break; } mk++; }
  const block = style.slice(mi, mk + 1), outside = style.slice(0, mi) + style.slice(mk + 1);
  const newRules = ['.skipctl .sub, .skipctl button, .skipctl select, .skipctl input[type=text] { font-size:13.5px; }', '.listtools select { font-size:13.5px; }'];
  T('v105 build: new rules stay inside compact media query', mi >= 0 && newRules.every(r => block.includes(r) && !outside.includes(r)));
  let bal = 0, okB = style.length > 0;
  for (const ch of style) { if (ch === '{') bal++; else if (ch === '}') { bal--; if (bal < 0) { okB = false; break; } } }
  T('v105 build: style braces balanced', okB && bal === 0);
}

// ---- v1.1: 根幹距離をカテゴリ適性化（400で割り切れる距離すべて。非根幹と対） ----
{
  const h = mk({});
  const base = { rootAff: '○', nonRoot: '-', distAff: {}, distKnown: {}, courseAff: {}, courseKnown: {}, known: { root: false, nonRoot: false, yuso: false }, yuso: false };
  h.aff = Object.assign({}, base);
  T('v11 root O applies at 1600/2000/2400', [1600, 2000, 2400].every(d => Math.abs(affinityFactor(h, { racecourse: '東京', distance_m: d }) - 1.05) < 1e-9));
  T('v11 root O does NOT apply at 1800/2200', [1800, 2200].every(d => affinityFactor(h, { racecourse: '東京', distance_m: d }) === 1));
  h.aff = Object.assign({}, base, { rootAff: '✕' });
  T('v11 root X applies at 2000', Math.abs(affinityFactor(h, { racecourse: '東京', distance_m: 2000 }) - 0.95) < 1e-9);
  T('v11 root X does NOT apply at 1800', affinityFactor(h, { racecourse: '東京', distance_m: 1800 }) === 1);
  // 旧セーブ形式（rootDist を持つ aff）でも rootDist は無視され、カテゴリとして効く
  h.aff = Object.assign({}, base, { rootDist: 1800 });
  T('v11 legacy rootDist field ignored', affinityFactor(h, { racecourse: '東京', distance_m: 1800 }) === 1 && Math.abs(affinityFactor(h, { racecourse: '東京', distance_m: 2000 }) - 1.05) < 1e-9);
}
{
  const h = mk({});
  h.aff = { rootAff: '○', nonRoot: '○', distAff: {}, distKnown: {}, courseAff: {}, courseKnown: {}, known: { root: false, nonRoot: false, yuso: false }, yuso: false, pred: { root: '○', nonRoot: '○', yuso: '-', dist: {}, course: {} } };
  revealAffinities(h, { distance_m: 1800, racecourse: '東京', sector: 'central' }, 0);
  T('v11 racing 1800 reveals nonRoot only', h.aff.known.nonRoot === true && h.aff.known.root === false);
  revealAffinities(h, { distance_m: 2400, racecourse: '東京', sector: 'central' }, 0);
  T('v11 racing 2400 reveals root', h.aff.known.root === true);
}
{
  freshS({ year: 2032, month: 4, week: 1 });
  const h = mk({ name: 'カテゴリ表示', birthYear: 2028 });
  h.aff = { rootAff: '○', nonRoot: '-', distAff: {}, distKnown: {}, courseAff: {}, courseKnown: {}, known: { root: false, nonRoot: false, yuso: false }, yuso: false, pred: { root: '○', nonRoot: '-', yuso: '-', dist: {}, course: {} } };
  const sec = affinitySection(h);
  T('v11 section shows root without a distance', sec.includes('根幹距離：') && !/根幹距離 \d/.test(sec));
  T('v11 hint shows root at 2000', affinityPredHint(h, { distance_m: 2000, racecourse: '東京' }).includes('根幹距離○'));
  T('v11 hint hides root at 1800', !affinityPredHint(h, { distance_m: 1800, racecourse: '東京' }).includes('根幹距離'));
}
{
  freshS({ year: 2026 });
  const h = buildDebugHorse({ age: 3, rootAff: '✕' });
  T('v11 debug builds with rootAff only (no rootDist needed)', h.aff.rootAff === '✕' && !('rootDist' in h.aff));
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v11 build: footer bumped', src.includes('競馬シミュレーター（趣味） v2.2'));
  T('v11 build: no rootDist anywhere in build', !src.includes('rootDist') && !src.includes('snapBand'));
}

// ---- v1.2: April gifts become a two-set lottery (A: turf colt + dirt filly / B: dirt colt + turf filly) ----
{
  // set B pinned: dirt colt (Mick Fire model) first, turf filly (Soul Stirring model) second
  freshS({ year: 2026, month: 4, week: 1, giftSet: 'B' });
  S.giftQueue = [];
  weeklyEvents();
  T('v12 set B queues exactly 2 gifts and keeps the pinned set', S.giftQueue.length === 2 && S.giftSet === 'B' && S.giftAprDone === true);
  const c = S.giftQueue[0], f = S.giftQueue[1];
  T('v12 Mick Fire model pedigree', c.sex === '牡' && c.sire === 'シニスターミニスター' && c.dam === 'マリアージュ' && c.bms === 'ブライアンズタイム' && c.grandam === 'アーミールージュ' && c.gbms === 'ミスワキ');
  T('v12 Mick Fire model aptitude + growth + coat', c.surface === 'ダート' && c.distMin === 1600 && c.distMax === 2000 && c.gtype === '普通早' && c.growth === '普通' && c.status === 'racehorse' && c.coat === '鹿毛');
  T('v12 set B filly is the Soul Stirring model', f.sex === '牝' && f.sire === 'Frankel' && f.dam === 'スタセリタ' && f.bms === 'モンズーン' && f.grandam === 'ソワニエ' && f.gbms === 'ダッシングブレイド');
  T('v12 set B filly aptitude + growth subtype', f.surface === '芝' && f.distMin === 1600 && f.distMax === 2400 && f.gtype === '早熟' && f.growth === '早熟' && f.status === 'racehorse');
  T('v12 April filly sire line resolves to Northern Dancer via the roster (Frankel)', majorLineOfName(f.sire) === 'ノーザンダンサー系');
  T('v12 set B gifts are B-rank overall', rankOf(Math.round((c.spd + c.sta + c.gut) / 3)) === 'B' && rankOf(Math.round((f.spd + f.sta + f.gut) / 3)) === 'B');
}
{
  // set A pinned: full Marche Lorraine assertions (the Efforia colt side is covered by the v101 block)
  freshS({ year: 2026, month: 4, week: 1, giftSet: 'A' });
  S.giftQueue = [];
  weeklyEvents();
  const f = S.giftQueue[1];
  T('v12 Marche Lorraine model pedigree', f.sex === '牝' && f.sire === 'オルフェーヴル' && f.dam === 'ヴィートマルシェ' && f.bms === 'フレンチデピュティ' && f.grandam === 'キョウエイマーチ' && f.gbms === 'ダンシングブレーヴ');
  T('v12 Marche Lorraine model aptitude + growth + coat', f.surface === 'ダート' && f.distMin === 1700 && f.distMax === 2100 && f.gtype === '普通遅' && f.growth === '普通' && f.status === 'racehorse' && f.coat === '鹿毛');
}
{
  // the roll itself: unpinned April triggers produce both sets over repeated new games,
  // and the queue only ever holds the chosen set's pair (the other set never appears)
  let sawA = 0, sawB = 0, rollOk = true;
  for(let i = 0; i < 40; i++){
    freshS({ year: 2026, month: 4, week: 1 });
    S.giftQueue = [];
    weeklyEvents();
    const sires = S.giftQueue.map(h => h.sire);
    if(S.giftSet === 'A'){ sawA++; if(!(sires.length === 2 && sires[0] === 'エピファネイア' && sires[1] === 'オルフェーヴル')) rollOk = false; }
    else if(S.giftSet === 'B'){ sawB++; if(!(sires.length === 2 && sires[0] === 'シニスターミニスター' && sires[1] === 'Frankel')) rollOk = false; }
    else rollOk = false;
  }
  T('v12 roll yields both sets over 40 new games', sawA > 0 && sawB > 0);
  T('v12 queue always matches the rolled set (the other set never appears)', rollOk);
}
{
  // persistence: the rolled set and the pending queue survive a save/load round-trip mid-April
  freshS({ year: 2026, month: 4, week: 1, giftSet: 'B' });
  S.giftQueue = [];
  weeklyEvents();
  save();
  const keptSires = S.giftQueue.map(h => h.sire).join('/');
  S.giftSet = 'A'; S.giftQueue = [];
  T('v12 set choice + pending gifts survive save/load', load() === true && S.giftSet === 'B' && S.giftQueue.map(h => h.sire).join('/') === keptSires);
  // refusing one gift does not re-roll the other
  refuseGift();
  T('v12 refusing the colt keeps the set and the filly', S.giftSet === 'B' && S.giftQueue.length === 1 && S.giftQueue[0].sire === 'Frankel');
}
{
  // pedigree plumbing for both new models (holder lookup through the gift horse itself, like the v101 models)
  freshS({ year: 2026 });
  const mc = makeGift('aprColtDirt');
  S.horses.push(mc);
  const mcDam = personRec(mc.dam), mcGdam = personRec(mc.grandam);
  T('v12 Mick Fire pedigree plumbing (dam -> Brians Time, grandam -> Miswaki)', !!mcDam && mcDam.sire === 'ブライアンズタイム' && !!mcGdam && mcGdam.sire === 'ミスワキ');
  T('v12 Miswaki katakana chain supplemented to Mr. Prospector', sireChainOf('ミスワキ').includes('ミスタープロスペクター') && majorLineOfName('ミスワキ') === 'ミスタープロスペクター系');
  T('v12 Mick Fire sire line is Seattle Slew, BMS line is Roberto', majorLineOfName('シニスターミニスター') === 'シアトルスルー系' && majorLineOfName('ブライアンズタイム') === 'ロベルト系');
  const ml = makeGift('aprFillyDirt');
  S.horses.push(ml);
  const mlDam = personRec(ml.dam), mlGdam = personRec(ml.grandam);
  T('v12 Marche Lorraine pedigree plumbing (dam -> French Deputy, grandam -> Dancing Brave)', !!mlDam && mlDam.sire === 'フレンチデピュティ' && !!mlGdam && mlGdam.sire === 'ダンシングブレーヴ');
  T('v12 Marche Lorraine sire line is Sunday Silence, GBMS line is Northern Dancer', majorLineOfName('オルフェーヴル') === 'サンデーサイレンス系' && majorLineOfName('ダンシングブレーヴ') === 'ノーザンダンサー系');
}
{
  // B-band guarantee for the two new models: 60 generations each, rounded 3-param average always inside 73-77
  freshS({ year: 2026 });
  let avgOk = true, bandOk = true;
  for(let i = 0; i < 60; i++){
    for(const k of ['aprColtDirt', 'aprFillyDirt']){
      const g = makeGift(k);
      const avg = Math.round((g.spd + g.sta + g.gut) / 3);
      if(avg < 73 || avg > 77) avgOk = false;
      if([g.spd, g.sta, g.gut].some(v => v < 35 || v > 85)) bandOk = false;
    }
  }
  T('v12 new gift models always average inside the 73-77 B band (120 generations)', avgOk);
  T('v12 new gift model params stay inside the 35-85 scale', bandOk);
}
{
  // December gift is untouched by the set system
  freshS({ year: 2026, month: 12, week: 1, giftSet: 'B' });
  S.giftQueue = [];
  weeklyEvents();
  T('v12 December still queues only the fixed filly', S.giftQueue.length === 1 && S.giftQueue[0].sire === 'キタサンブラック' && S.giftDecDone === true);
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v12 build: new gift models + set table present', src.includes('マリアージュ') && src.includes('ヴィートマルシェ') && src.includes('ミスワキ') && src.includes('GIFT_SETS'));
  T('v12 build: footer bumped', src.includes('競馬シミュレーター（趣味） v2.2'));
}

// ---- v2.0: 自動出走（オート出走決定） ----
function raceOfEntry(h){
  const keys = Object.keys(h.entries || {});
  if(!keys.length) return null;
  const a = +keys[0], e = h.entries[a];
  const t = fromAbs(a);
  const race = racesThisWeek(t[0], t[1], t[2]).find(r => a + "@" + r.name + "|" + (r.racecourse||"") + "|" + (r.grade||"") === e.key);
  return { abs: a, entry: e, race };
}
{
  freshS({ year: 2032, month: 6, week: 1, phase: 'play' });
  const h = mk({ name: '自動基本', wins: 1, birthYear: 2028 });
  T('v20 new horses default to auto OFF with the standard default rotation', h.autoEntry === false && h.autoRot === null && S.autoRotDefault === 8);
  S.horses = [h];
  autoEntryPass();
  T('v20 OFF horse is never auto-entered', Object.keys(h.entries).length === 0);
  h.autoEntry = true;
  autoEntryPass();
  const got = raceOfEntry(h);
  T('v20 auto pass registers an eligible horse inside the window', !!got && got.abs >= absWeek() && got.abs <= absWeek() + 3);
  T('v20 picked race fits surface/class/distance', !!got && got.race.surface === '芝' && got.race.grade === '1勝クラス' && got.race.distance_m >= 1600 && got.race.distance_m <= 2400);
  T('v20 auto registration is announced in the weekly topics', S.topics.some(t => t.includes('自動出走') && t.includes('自動基本')));
  const target = got.abs;
  let guard = 0;
  while(absWeek() < target && guard++ < 6) advanceWeek();
  advanceWeek();
  T('v20 auto registration is an ordinary registration (the race runs)', h.results.length === 1);
}
{
  freshS({ year: 2032, month: 6, week: 1, phase: 'play' });
  const h = mk({ name: '間隔テスト', wins: 1, birthYear: 2028, autoEntry: true });
  h.lastRaceAbs = absWeek() - 3;
  S.horses = [h];
  autoEntryPass();
  T('v20 rotation minimum (default 中8週) blocks a horse raced 3 weeks ago', Object.keys(h.entries).length === 0);
  h.autoRot = 4;
  h.lastRaceAbs = absWeek() - 5;
  autoEntryPass();
  T('v20 per-horse rotation override (中4週) lets the horse run at a 5-week gap', Object.keys(h.entries).length === 1);
}
{
  // pace-derived spacing, unit level
  freshS({ year: 2032, month: 1, week: 1, phase: 'play' });
  const yStart = absOf(2032, 1, 1);
  const fresh = mk({ name: 'ペース未出走', wins: 1, birthYear: 2028 });
  T('v20 pace: unraced horse first due lands ~7-8 weeks into the year', (() => { const d = autoDueAbs(fresh, 2032, false) - yStart; return d >= 6 && d <= 9; })());
  T('v20 pace: graded due ignores pace (hard guard only, already met)', autoDueAbs(fresh, 2032, true) <= yStart);
  const mid = mk({ name: 'ペース中盤', wins: 1, birthYear: 2028 });
  mid.results = [1, 2, 3].map(() => ({ when: '2032年2月第1週', race: 'テスト', grade: '1勝クラス', finish: 2 }));
  mid.lastRaceAbs = absOf(2032, 3, 1);
  T('v20 pace: 3 used by March spreads the rest (due = last + 14)', autoDueAbs(mid, 2032, false) === absOf(2032, 3, 1) + 14);
  T('v20 pace: graded due for the same horse is just the rotation minimum', autoDueAbs(mid, 2032, true) === absOf(2032, 3, 1) + 9);
  const done = mk({ name: 'ペース目標到達', wins: 4, birthYear: 2027 });
  done.results = [1, 2, 3, 4, 5, 6].map(() => ({ when: '2032年5月第1週', race: 'テスト', grade: 'OP', finish: 2 }));
  done.lastRaceAbs = absOf(2032, 5, 1);
  T('v20 pace: at target (6) ordinary entries stop but graded stays possible', autoDueAbs(done, 2032, false) === Infinity && autoDueAbs(done, 2032, true) === absOf(2032, 5, 1) + 9);
  done.results.push({ when: '2032年6月第1週', race: 'テスト', grade: 'OP', finish: 2 });
  T('v20 cap: at 7 starts everything stops', autoDueAbs(done, 2032, false) === Infinity && autoDueAbs(done, 2032, true) === Infinity);
  const late = mk({ name: 'ペース出遅れ', wins: 1, birthYear: 2028 });
  T('v20 pace: a horse that has not run by November is due immediately (compression)', autoDueAbs(late, 2032, false) <= absOf(2032, 11, 1));
}
{
  freshS({ year: 2032, month: 11, week: 4, phase: 'play' });
  const capped = mk({ name: '上限到達', wins: 1, birthYear: 2028, autoEntry: true });
  capped.results = [1, 2, 3, 4, 5, 6, 7].map(() => ({ when: '2032年8月第1週', race: 'テスト', grade: '1勝クラス', finish: 3 }));
  S.horses = [capped];
  autoEntryPass();
  T('v20 yearly cap (7) blocks any further auto entry', Object.keys(capped.entries).length === 0);
}
{
  freshS({ year: 2032, month: 11, week: 4, phase: 'play' });
  const h3 = mk({ name: '格上禁止', wins: 3, birthYear: 2028, distMin: 1600, distMax: 1600, autoEntry: true });
  const op = mk({ name: '重賞可', wins: 4, birthYear: 2028, distMin: 1600, distMax: 1600, autoEntry: true });
  S.horses = [h3, op];
  autoEntryPass();
  const g3 = raceOfEntry(h3), gOp = raceOfEntry(op);
  T('v20 a 3-win horse is never auto-entered above its class (no Mile CS)', !g3 || (g3.race.name !== 'マイルチャンピオンシップ' && autoRaceRank(g3.race) <= 3));
  T('v20 an OP horse IS auto-entered in a fitting G1 (grade beats the listed race in-window)', !!gOp && gOp.race.name === 'マイルチャンピオンシップ');
}
{
  freshS({ year: 2032, month: 6, week: 1, phase: 'play' });
  const dirt = mk({ name: 'ダート専', wins: 1, birthYear: 2028, surface: 'ダート', distMin: 2000, distMax: 2000, autoEntry: true });
  S.horses = [dirt];
  autoEntryPass();
  const g = raceOfEntry(dirt);
  T('v20 surface mismatch is never chosen (turf 2000 ignored for a dirt-only horse)', !g || g.race.surface === 'ダート');
}
{
  freshS({ year: 2032, month: 12, week: 4, phase: 'play' });
  const op = mk({ name: '地方G1可', wins: 4, birthYear: 2027, surface: 'ダート', distMin: 2000, distMax: 2000, autoEntry: true });
  S.horses = [op];
  autoEntryPass();
  const g = raceOfEntry(op);
  T('v20 a regional (NAR) G1 is auto-enterable (Tokyo Daishoten)', !!g && g.race.name === '東京大賞典' && g.race.sector === 'regional');
}
{
  const setup = (mut) => {
    freshS({ year: 2032, month: 6, week: 1, phase: 'play' });
    const h = mk({ name: 'ガード検証', wins: 1, birthYear: 2028, autoEntry: true });
    mut(h);
    S.horses = [h];
    autoEntryPass();
    return h;
  };
  T('v20 injured horses are skipped', Object.keys(setup(h => { h.injuredUntil = absWeek() + 3; }).entries).length === 0);
  T('v20 fatigued horses are skipped (fatigue 75)', Object.keys(setup(h => { h.fatigue = 75; }).entries).length === 0);
  T('v20 horses in poor condition are skipped (condition 30)', Object.keys(setup(h => { h.condition = 30; }).entries).length === 0);
  T('v20 already-registered horses are skipped (manual entry kept)', (() => { const h = setup(h => { h.entries[absWeek() + 1] = { key: 'manual', style: null, sector: 'central', course: '', dist: null, name: '手動登録' }; }); return Object.keys(h.entries).length === 1; })());
}
{
  freshS({ year: 2032, month: 1, week: 1, phase: 'play' });
  const h = mk({ name: '海外検証', wins: 4, gradedWin: true, birthYear: 2027, distMin: 1000, distMax: 3600, autoEntry: true });
  S.horses = [h];
  let made = 0, overseasSeen = 0;
  for(let a = absOf(2032, 1, 1); a < absOf(2033, 1, 1); a++){
    const t = fromAbs(a); S.year = t[0]; S.month = t[1]; S.week = t[2];
    h.entries = {}; h.results = []; h.lastRaceAbs = -999; h.fatigue = 0; h.condition = 80;
    autoEntryPass();
    for(const k of Object.keys(h.entries)){ made++; if(h.entries[k].sector === 'overseas') overseasSeen++; }
  }
  T('v20 overseas races are never auto-entered (52-week scan)', overseasSeen === 0);
  T('v20 the scan still enters plenty of domestic races', made >= 10);
}
{
  freshS({ year: 2032, month: 6, week: 1, phase: 'play' });
  const r1 = mk({ name: '一括1', wins: 1, birthYear: 2028 });
  const r2 = mk({ name: '一括2', wins: 2, birthYear: 2028 });
  const mare = mk({ name: '一括対象外', sex: '牝', status: 'broodmare', birthYear: 2026 });
  S.horses = [r1, r2, mare];
  setAllAutoEntry(true);
  T('v20 bulk ON enables all racehorses only', r1.autoEntry === true && r2.autoEntry === true && mare.autoEntry === false);
  setAllAutoEntry(false);
  T('v20 bulk OFF disables all racehorses', r1.autoEntry === false && r2.autoEntry === false);
  r1.autoEntry = true; r1.autoRot = 6; S.autoRotDefault = 12;
  autoEntryPass();
  T('v20 bulk-enabled horse actually gets registered', Object.keys(r1.entries).length === 1);
  save();
  r1.autoEntry = false; r1.autoRot = null; S.autoRotDefault = 8; r1.entries = {};
  load();
  const back = S.horses.find(x => x.name === '一括1');
  T('v20 settings + registration survive save/load', back.autoEntry === true && back.autoRot === 6 && S.autoRotDefault === 12 && Object.keys(back.entries).length === 1);
}
{
  // wait for the big one: Mile Championship (G1, Nov wk4) vs a listed race in-window (Nov wk1)
  freshS({ year: 2032, month: 10, week: 4, phase: 'play' });
  const h = mk({ name: '大レース待ち', wins: 4, birthYear: 2028, distMin: 1600, distMax: 1600, autoEntry: true });
  S.horses = [h];
  autoEntryPass();
  T('v20 with a G1 just beyond the window, the lesser listed race is NOT taken', Object.keys(h.entries).length === 0);
  S.month = 11; S.week = 1;
  autoEntryPass();
  const g = raceOfEntry(h);
  T('v20 once the G1 enters the registration window it is taken', !!g && g.race.name === 'マイルチャンピオンシップ');
}
{
  // G1 reserve: summer starvation guard
  const julyHorse = (used) => {
    freshS({ year: 2032, month: 7, week: 1, phase: 'play' });
    const h = mk({ name: 'リザーブ検証', wins: 4, birthYear: 2027, distMin: 2000, distMax: 2400, autoEntry: true });
    h.results = Array.from({ length: used }, () => ({ when: '2032年4月第1週', race: 'テスト', grade: 'OP', finish: 2 }));
    h.lastRaceAbs = absWeek() - 20;
    S.horses = [h];
    return h;
  };
  const hA = julyHorse(5);
  T('v20 reserve counts the 2 remaining fitting autumn G1s', autoG1Reserve(hA, 2032) === 2);
  autoEntryPass();
  T('v20 reserve blocks a summer graded race when it would eat the G1 budget (5 used)', Object.keys(hA.entries).length === 0);
  const hB = julyHorse(3);
  autoEntryPass();
  T('v20 with slack, July still holds for the higher-grade Sapporo Kinen (big-race wait)', Object.keys(hB.entries).length === 0);
  S.month = 8; S.week = 1;
  autoEntryPass();
  const gB = raceOfEntry(hB);
  T('v20 with genuine slack (3 used) a summer graded race IS taken (reserve does not block)', !!gB && gB.race.name === '札幌記念');
  freshS({ year: 2032, month: 7, week: 1, phase: 'play' });
  const hC = mk({ name: 'リザーブ無関係', wins: 3, birthYear: 2028, distMin: 2000, distMax: 2400, autoEntry: true });
  hC.results = [1, 2].map(() => ({ when: '2032年4月第1週', race: 'テスト', grade: '3勝クラス', finish: 2 }));
  hC.lastRaceAbs = absWeek() - 9;
  S.horses = [hC];
  T('v20 a non-G1-class horse has reserve 0', autoG1Reserve(hC, 2032) === 0);
  autoEntryPass();
  T('v20 a non-G1 horse uses summer normally', Object.keys(hC.entries).length === 1);
}
{
  // a G1 entered on the hard-guard interval (pace-soft), reserve counting itself; then pacing re-spreads
  freshS({ year: 2032, month: 11, week: 1, phase: 'play' });
  const h = mk({ name: '秋G1', wins: 4, birthYear: 2027, distMin: 2000, distMax: 2400, autoEntry: true });
  h.results = [1, 2, 3, 4, 5].map(() => ({ when: '2032年6月第1週', race: 'テスト', grade: 'OP', finish: 2 }));
  h.lastRaceAbs = absWeek() - 9; /* rotation minimum exactly met; the pace interval for a 6th ordinary start points at year-end */
  S.horses = [h];
  autoEntryPass();
  const g = raceOfEntry(h);
  T('v20 a fitting G1 is entered on the hard-guard interval, ahead of pace (reserve counts itself)', !!g && g.race.name === '天皇賞（秋）');
  h.results.push({ when: '2032年11月第1週', race: '天皇賞（秋）', grade: 'GI', finish: 3 });
  h.lastRaceAbs = absOf(2032, 11, 1);
  delete h.entries[g.abs];
  S.month = 11; S.week = 5;
  autoEntryPass();
  T('v20 after the G1, pacing re-spreads: the next G1 inside the rotation minimum is not taken', Object.keys(h.entries).length === 0);
}
{
  // full-year campaign through the real weekly path (advanceWeek)
  freshS({ year: 2032, month: 1, week: 1, phase: 'play', funds: 100000 });
  const h = mk({ name: '年間ペース', wins: 1, birthYear: 2028, policy: 'rest' });
  setParams(h, 35, 35, 35);
  h.autoEntry = true;
  S.horses = [h];
  for(let i = 0; i < 52; i++) advanceWeek();
  const starts = h.results.filter(r => parseInt(r.when, 10) === 2032);
  const absList = starts.map(r => { const m = r.when.match(/(\d+)年(\d+)月第(\d+)週/); return absOf(+m[1], +m[2], +m[3]); });
  T('v20 full year of weekly auto passes: campaign lands in the 5-7 band', starts.length >= 5 && starts.length <= 7);
  T('v20 full year: starts reach the autumn (Oct-Dec)', absList.some(a => a >= absOf(2032, 10, 1)));
  T('v20 full year: no 3-month span holds more than 2 starts', absList.every(a => absList.filter(b => b >= a && b <= a + 12).length <= 2));
  T('v20 full year: consecutive starts respect the rotation minimum', absList.every((a, i) => i === 0 || a - absList[i - 1] >= 9));
}
{
  // the same through the actual skip feature (skipTo loops advanceWeek, so the hook cannot be missed)
  freshS({ year: 2032, month: 1, week: 1, phase: 'play', funds: 100000 });
  const h = mk({ name: 'スキップ検証', wins: 1, birthYear: 2028, policy: 'rest' });
  setParams(h, 35, 35, 35);
  h.autoEntry = true;
  S.horses = [h];
  skipTo(2033, 1, 1);
  const starts = h.results.filter(r => parseInt(r.when, 10) === 2032);
  T('v20 a 1-year skip runs the auto pass every week (campaign in the 5-7 band)', starts.length >= 5 && starts.length <= 7 && S.year === 2033);
  T('v20 skip: the horse still has autumn starts (no early-year burn-out)', starts.some(r => +r.when.match(/(\d+)月/)[1] >= 10));
}
{
  // G1-class horse under skip: the reserve keeps its autumn budget intact
  freshS({ year: 2032, month: 1, week: 1, phase: 'play', funds: 100000 });
  const g = mk({ name: 'スキップG1', wins: 4, gradedWin: true, birthYear: 2027, distMin: 2000, distMax: 2400, policy: 'rest' });
  setParams(g, 35, 35, 35);
  g.autoEntry = true;
  S.horses = [g];
  skipTo(2032, 10, 1);
  const usedByOct = g.results.filter(r => parseInt(r.when, 10) === 2032).length;
  T('v20 skip: G1 horse reaches October with budget for the autumn G1s (<=5 used)', usedByOct <= 5);
  skipTo(2033, 1, 1);
  const all = g.results.filter(r => parseInt(r.when, 10) === 2032);
  T('v20 skip: G1 horse finishes the year inside the cap with an autumn start', all.length >= 4 && all.length <= 7 && all.some(r => +r.when.match(/(\d+)月/)[1] >= 10));
}
{
  freshS({ year: 2032, month: 6, week: 1, phase: 'play' });
  const h = mk({ name: 'UI検証', wins: 1, birthYear: 2028 });
  S.horses = [h];
  const ev = viewEntry();
  T('v20 entry view has the bulk controls and the settings button (renamed 自動出走設定 in v2.2)', ev.includes('data-auto-all') && ev.includes('data-auto-defrot') && ev.includes('data-goto-cal') && ev.includes('自動出走設定（カレンダーで確認）'));
  const cal = viewCalendar();
  T('v20 calendar view hosts the auto settings (per-horse on/off + interval; renamed in v2.2)', cal.includes('🤖 自動出走設定') && cal.includes('data-auto-on') && cal.includes('data-auto-rot') && cal.includes('UI検証'));
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v20 build: horse page carries the auto controls next to the policy select', src.includes('autoEntrySel') && src.includes('autoRotSel'));
  T('v20 build: footer bumped', src.includes('競馬シミュレーター（趣味） v2.2'));
}

// ---- v2.1: 世代限定重賞の例外（1勝以上の若馬が2歳重賞・3歳クラシックに出られる） ----
{
  // helper-level parsing, mirroring eligibility()
  T('v21 gen limit parsing mirrors eligibility (2yo)', autoGenLimit({ conditions: '2歳' }) === 2 && autoGenLimit({ conditions: '2歳牝' }) === 2 && autoGenLimit({ conditions: '2歳以上' }) === 0);
  T('v21 gen limit parsing mirrors eligibility (3yo)', autoGenLimit({ conditions: '3歳' }) === 3 && autoGenLimit({ conditions: '3歳牡・牝' }) === 3 && autoGenLimit({ conditions: '3歳以上' }) === 0 && autoGenLimit({ conditions: '' }) === 0);
  freshS({ year: 2033, month: 3, week: 1, phase: 'play' });
  const w3 = mk({ name: '世代例外3歳', wins: 1, birthYear: 2030 });
  const l3 = mk({ name: '世代例外未勝利', wins: 0, birthYear: 2030 });
  const satsuki = { grade: 'GI', conditions: '3歳牡・牝' };
  /* v2.1改訂：世代G2/G3は1勝で開放のまま。世代G1は実績ゲート（autoGenG1LadderOk）を通った馬だけ */
  T('v21 a 1-win 3yo may target a generation G2/G3 (trial tier stays open at 1 win)', autoGenGradedOk(w3, { grade: 'GII', conditions: '3歳' }) === true && autoOverClass(w3, { grade: 'GII', conditions: '3歳' }) === false);
  T('v21 a record-less 1-win 3yo may NOT target a generation G1 (G1 gate)', autoGenGradedOk(w3, satsuki) === false && autoOverClass(w3, satsuki) === true);
  const q3 = mk({ name: '世代例外実績3歳', wins: 1, birthYear: 2030, results: [{ when: '2032年11月第2週', race: 'デイリー杯2歳S', grade: 'GII', finish: 2 }] });
  T('v21 a 1-win 3yo with a generation-graded placing may target a generation G1', autoGenGradedOk(q3, satsuki) === true && autoOverClass(q3, satsuki) === false);
  T('v21 a winless 3yo may NOT (winless stays locked out of graded)', autoGenGradedOk(l3, satsuki) === false && autoOverClass(l3, satsuki) === true);
  T('v21 an open-age G1 stays OP-only for a 1-win 3yo', autoGenGradedOk(w3, { grade: 'GI', conditions: '3歳以上' }) === false && autoOverClass(w3, { grade: 'GI', conditions: '3歳以上' }) === true);
  T('v21 a generation condition race is not part of the exception', autoGenGradedOk(w3, { grade: '1勝クラス', conditions: '3歳' }) === false);
  const w4 = mk({ name: '世代例外4歳', wins: 2, birthYear: 2029 });
  T('v21 a 4yo gets no generation exception (not its own generation)', autoGenGradedOk(w4, satsuki) === false && autoOverClass(w4, satsuki) === true);
  T('v21 a 2-win older horse stays out of an open-age G1 (OP-only preserved)', autoOverClass(w4, { grade: 'GI', conditions: '3歳以上' }) === true);
}
{
  // 1-win 2yo in autumn: a fitting 2yo graded race beats the 1-win class race
  freshS({ year: 2033, month: 11, week: 1, phase: 'play' });
  const h = mk({ name: '二歳重賞', wins: 1, birthYear: 2031, distMin: 1600, distMax: 1600, autoEntry: true });
  S.horses = [h];
  autoEntryPass();
  const g = raceOfEntry(h);
  T('v21 a 1-win 2yo is auto-entered in a fitting 2yo graded race (Daily Hai Nisai S)', !!g && g.race.name === 'デイリー杯2歳S' && g.race.grade === 'GII');
}
{
  // winless 2yo in the same spot: never graded
  freshS({ year: 2033, month: 11, week: 1, phase: 'play' });
  const h = mk({ name: '二歳未勝利', wins: 0, birthYear: 2031, distMin: 1600, distMax: 1600, autoEntry: true });
  S.horses = [h];
  autoEntryPass();
  const g = raceOfEntry(h);
  T('v21 a winless 2yo is never auto-entered in a graded race', !g || g.race.grade === '新馬' || g.race.grade === '未勝利');
}
{
  // 3yo spring: held for the Satsuki Sho, then entered when it reaches the window
  // （v2.1改訂：2連勝の実績でG1ゲートを通る馬。実績のない馬は次のブロックで確認）
  freshS({ year: 2033, month: 3, week: 4, phase: 'play' });
  const h = mk({ name: '皐月狙い', wins: 2, birthYear: 2030, distMin: 2000, distMax: 2000, autoEntry: true,
    results: [{ when: '2032年9月第2週', race: '2歳未勝利', grade: '未勝利', finish: 1 }, { when: '2032年11月第1週', race: '2歳1勝クラス', grade: '1勝クラス', finish: 1 }] });
  S.horses = [h];
  autoEntryPass();
  T('v21 with the Satsuki Sho 4 weeks out, the horse is held (no condition/listed burn)', Object.keys(h.entries).length === 0);
  S.month = 4; S.week = 1;
  autoEntryPass();
  const g = raceOfEntry(h);
  T('v21 once the Satsuki Sho enters the window, the 2-win 3yo is entered in it', !!g && g.race.name === '皐月賞' && g.race.grade === 'GI');
}
{
  // the G1 reserve now protects the spring classics for a gate-qualified 3yo winner
  freshS({ year: 2033, month: 2, week: 1, phase: 'play' });
  const h = mk({ name: 'リザーブ世代', wins: 1, birthYear: 2030, distMin: 1800, distMax: 2400,
    results: [{ when: '2032年11月第2週', race: 'デイリー杯2歳S', grade: 'GII', finish: 2 }] });
  T('v21 reserve counts the fitting spring classics for a gate-qualified 1-win 3yo (Satsuki + Derby)', autoG1Reserve(h, 2033) === 2);
  const p = mk({ name: 'リザーブ無資格', wins: 1, birthYear: 2030, distMin: 1800, distMax: 2400 });
  T('v21 reserve stays 0 for a 1-win 3yo without a ladder record (G1 gate)', autoG1Reserve(p, 2033) === 0);
  const l = mk({ name: 'リザーブ未勝利', wins: 0, birthYear: 2030, distMin: 1800, distMax: 2400 });
  T('v21 reserve stays 0 for a winless 3yo', autoG1Reserve(l, 2033) === 0);
}
{
  // open-age graded stays OP-only end-to-end: a 2-win 4yo in Mile Championship week
  freshS({ year: 2032, month: 11, week: 4, phase: 'play' });
  const h = mk({ name: '古馬格上禁止', wins: 2, birthYear: 2028, distMin: 1600, distMax: 1600, autoEntry: true });
  S.horses = [h];
  autoEntryPass();
  const g = raceOfEntry(h);
  T('v21 a 2-win older horse is NOT auto-entered in an open-age graded race', !g || !AUTO_BIG_GRADES.includes(g.race.grade));
}
{
  // G1 gate routes, one by one (results-ladder hybrid, Terai decision)
  freshS({ year: 2033, month: 3, week: 1, phase: 'play' });
  const satsuki = { grade: 'GI', conditions: '3歳牡・牝' };
  const ri = mk({ name: 'ゲートi', wins: 1, birthYear: 2030, results: [{ when: '2032年12月第3週', race: '朝日杯フューチュリティS', grade: 'GI', finish: 3 }] });
  T('v21 gate (i): a top-3 in a generation graded race qualifies for a generation G1', autoGenG1LadderOk(ri) === true && autoGenGradedOk(ri, satsuki) === true);
  const riL = mk({ name: 'ゲートiL', wins: 1, birthYear: 2030, results: [{ when: '2033年1月第4週', race: '若駒ステークス', grade: 'L', finish: 3 }] });
  T('v21 gate (i): a top-3 in a generation LISTED race also qualifies (trial right)', autoGenG1LadderOk(riL) === true);
  const ri4 = mk({ name: 'ゲートi外', wins: 1, birthYear: 2030, results: [{ when: '2032年12月第3週', race: '朝日杯フューチュリティS', grade: 'GI', finish: 4 }] });
  T('v21 gate (i): 4th in a generation graded race does NOT qualify', autoGenG1LadderOk(ri4) === false && autoGenGradedOk(ri4, satsuki) === false);
  const ro = mk({ name: 'ゲートi古馬', wins: 1, birthYear: 2030, results: [{ when: '2033年2月第2週', race: '京都記念', grade: 'GII', finish: 2 }] });
  T('v21 gate (i): a placing in an OPEN-age graded race does NOT qualify via (i)', autoGenG1LadderOk(ro) === false);
  const rii = mk({ name: 'ゲートii', wins: 2, birthYear: 2030, results: [{ when: '2032年10月第2週', race: '2歳1勝クラス', grade: '1勝クラス', finish: 1 }, { when: '2032年11月第3週', race: '2歳1勝クラス', grade: '1勝クラス', finish: 1 }] });
  T('v21 gate (ii): a 2+ win streak qualifies', autoGenG1LadderOk(rii) === true && autoGenGradedOk(rii, satsuki) === true);
  const riiB = mk({ name: 'ゲートii崩', wins: 2, birthYear: 2030, results: [{ when: '2032年10月第2週', race: '2歳1勝クラス', grade: '1勝クラス', finish: 1 }, { when: '2032年11月第3週', race: '2歳1勝クラス', grade: '1勝クラス', finish: 3 }, { when: '2033年2月第1週', race: '3歳1勝クラス', grade: '1勝クラス', finish: 1 }] });
  T('v21 gate (ii): a broken streak (win, loss, win) does NOT qualify', autoGenG1LadderOk(riiB) === false);
  const riii = mk({ name: 'ゲートiii', wins: 1, birthYear: 2030, results: [{ when: '2033年2月第2週', race: 'テストオープン特別', grade: 'OP', finish: 2 }] });
  T('v21 gate (iii): a top-2 in an OP race qualifies', autoGenG1LadderOk(riii) === true && autoGenGradedOk(riii, satsuki) === true);
  const riiiL = mk({ name: 'ゲートiiiL', wins: 1, birthYear: 2030, results: [{ when: '2033年2月第2週', race: 'テストリステッド', grade: 'L', finish: 1 }] });
  T('v21 gate (iii): a top-2 in a listed race qualifies', autoGenG1LadderOk(riiiL) === true);
  const riii3 = mk({ name: 'ゲートiii外', wins: 1, birthYear: 2030, results: [{ when: '2033年2月第2週', race: 'テストリステッド', grade: 'L', finish: 3 }] });
  T('v21 gate (iii): 3rd in a listed race does NOT qualify via (iii)', autoGenG1LadderOk(riii3) === false);
  const op = mk({ name: 'ゲートOP', wins: 4, birthYear: 2030 });
  T('v21 gate: an OP 3yo is exempt (no ladder record needed)', autoOverClass(op, satsuki) === false);
}
{
  // end-to-end: a record-less 1-win 3yo in the Satsuki window is not thrown into the classic
  freshS({ year: 2033, month: 4, week: 1, phase: 'play' });
  const h = mk({ name: 'ゲート未達', wins: 1, birthYear: 2030, distMin: 2000, distMax: 2000, autoEntry: true });
  S.horses = [h];
  autoEntryPass();
  const g = raceOfEntry(h);
  T('v21 a record-less 1-win 3yo is NOT auto-entered in the Satsuki Sho', !g || g.race.name !== '皐月賞');
}
{
  // policy toggle: 慎重 restores v2.0 behaviour wholesale (entries, reserve, hold)
  freshS({ year: 2033, month: 3, week: 1, phase: 'play' });
  T('v21 policy defaults: global default is 積極 and a new horse follows it', S.autoPolicyDefault === '積極' && autoPolicyOf(mk({})) === '積極');
  const rec = [{ when: '2032年11月第2週', race: 'デイリー杯2歳S', grade: 'GII', finish: 1 }, { when: '2032年12月第3週', race: '朝日杯フューチュリティS', grade: 'GI', finish: 1 }];
  const shy = mk({ name: '慎重馬', wins: 2, birthYear: 2030, autoPolicy: '慎重', results: rec });
  const bold = mk({ name: '積極馬', wins: 2, birthYear: 2030, results: rec });
  const satsuki = { grade: 'GI', conditions: '3歳牡・牝' };
  const trial = { grade: 'GII', conditions: '3歳' };
  T('v21 a 慎重 horse ignores the generation exception entirely (G1 and trials)', autoGenGradedOk(shy, satsuki) === false && autoGenGradedOk(shy, trial) === false && autoOverClass(shy, trial) === true);
  T('v21 the same record under 積極 (default) uses the exception', autoGenGradedOk(bold, satsuki) === true && autoGenGradedOk(bold, trial) === true);
  const shyR = mk({ name: '慎重リザーブ', wins: 1, birthYear: 2030, distMin: 1800, distMax: 2400, autoPolicy: '慎重', results: [{ when: '2032年11月第2週', race: 'デイリー杯2歳S', grade: 'GII', finish: 2 }] });
  T('v21 reserve for a 慎重 horse counts no classics (v2.0 behaviour)', autoG1Reserve(shyR, 2033) === 0);
  const a = mk({ name: '一括1' }); const b = mk({ name: '一括2', status: 'foal' });
  S.horses = [a, b];
  setAllAutoPolicy('慎重');
  T('v21 bulk policy applies to racehorses only', a.autoPolicy === '慎重' && b.autoPolicy == null);
  S.autoPolicyDefault = '慎重';
  T('v21 the global default drives horses without an individual policy', autoPolicyOf(mk({})) === '慎重' && autoPolicyOf(mk({ autoPolicy: '積極' })) === '積極');
  S.autoPolicyDefault = '積極';
  const mig = mk({ name: '移行馬' }); delete mig.autoPolicy; S.horses = [mig]; S.autoPolicyDefault = undefined;
  migrateV029();
  T('v21 migration fills policy defaults (global 積極, per-horse null)', S.autoPolicyDefault === '積極' && mig.autoPolicy === null);
  const keep = mk({ name: '保存馬', autoPolicy: '慎重' }); S.horses = [keep]; S.autoPolicyDefault = '慎重';
  save();
  T('v21 policy settings survive save/load', load() === true && S.autoPolicyDefault === '慎重' && S.horses[0].autoPolicy === '慎重' && autoPolicyOf(S.horses[0]) === '慎重');
}
{
  // end-to-end: a 慎重 3yo with a ladder record still stays out of the classic
  freshS({ year: 2033, month: 4, week: 1, phase: 'play' });
  const h = mk({ name: '慎重クラシック回避', wins: 2, birthYear: 2030, distMin: 2000, distMax: 2000, autoEntry: true, autoPolicy: '慎重',
    results: [{ when: '2032年9月第2週', race: '2歳未勝利', grade: '未勝利', finish: 1 }, { when: '2032年11月第1週', race: '2歳1勝クラス', grade: '1勝クラス', finish: 1 }] });
  S.horses = [h];
  autoEntryPass();
  const g = raceOfEntry(h);
  T('v21 a 慎重 3yo is NOT auto-entered in the Satsuki Sho even with a ladder record', !g || g.race.name !== '皐月賞');
}
{
  // 京成杯 age-boundary: eligibility is judged at the race date, not the registration date
  const keisei = DATA.domestic.find(r => r.name === '京成杯');
  freshS({ year: 2027, month: 12, week: 4, phase: 'play' });
  const h = mk({ name: '京成杯境界', wins: 3, birthYear: 2024, distMin: 1800, distMax: 2200 });
  entryWeekAhead = 3; /* 2027 Dec wk4 + 3 weeks = 2028 Jan wk3, the Keisei Hai week */
  const tgt = fromAbs(absWeek() + entryWeekAhead);
  T('v21 repro setup: the target week is the Keisei Hai week across the year boundary', tgt[0] === 2028 && tgt[1] === 1 && tgt[2] === keisei.wom);
  T('v21 a December registration for a January 3yo-only race is blocked at entry (age at race date)', eligibility(h, keisei) === '3歳限定');
  const h2 = mk({ name: '京成杯年明け3歳', wins: 1, birthYear: 2025, distMin: 1800, distMax: 2200 });
  T('v21 a horse that turns 3 on Jan 1 CAN be registered in December for a January 3yo race', eligibility(h2, keisei) === null);
  entryWeekAhead = 0;
  freshS({ year: 2028, month: 1, week: 3, phase: 'play' });
  const young = mk({ name: '京成杯3歳', wins: 1, birthYear: 2025, distMin: 1800, distMax: 2200 });
  const old = mk({ name: '京成杯4歳', wins: 3, birthYear: 2024, distMin: 1800, distMax: 2200 });
  T('v21 same-week checks unchanged: a 3yo can enter the Keisei Hai, a 4yo cannot', eligibility(young, keisei) === null && eligibility(old, keisei) === '3歳限定');
  /* the 2yo-June rule is also judged at the race date */
  freshS({ year: 2026, month: 5, week: 4, phase: 'play' });
  const june2 = { grade: 'GIII', conditions: '2歳', sector: 'central', surface: '芝', distance_m: 1600, racecourse: '東京' };
  const two = mk({ name: '二歳6月', wins: 1, birthYear: 2024 });
  entryWeekAhead = 2; /* May wk4 + 2 = June wk1 */
  T('v21 the 2yo-June rule is judged at the race date (May registration for a June race is allowed)', eligibility(two, june2) === null);
  entryWeekAhead = 0;
  T('v21 the 2yo-June rule still blocks a May race itself', eligibility(two, june2) === '2歳の重賞出走は6月以降（試作ルール）');
}
{
  // safety net: a stale registration made under the old rule is dropped at race time
  freshS({ year: 2028, month: 1, week: 3, phase: 'play' });
  const keisei = DATA.domestic.find(r => r.name === '京成杯');
  const h = mk({ name: '旧登録馬', wins: 3, birthYear: 2024, distMin: 1800, distMax: 2200 });
  S.horses = [h];
  const key = absWeek() + '@' + keisei.name + '|' + keisei.racecourse + '|' + keisei.grade;
  h.entries[absWeek()] = { key, style: null, sector: keisei.sector, course: keisei.racecourse, dist: keisei.distance_m, name: keisei.name };
  advanceWeek();
  T('v21 safety net: a stale age-ineligible entry is dropped at race time (no result recorded)', !h.results.some(r => r.race === '京成杯'));
  T('v21 safety net: the drop is logged in the week topics', S.topics.some(t => t.includes('京成杯') && t.includes('年齢条件')));
}
{
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v21 build: generation-graded exception present, footer bumped', src.includes('autoGenGradedOk') && src.includes('競馬シミュレーター（趣味） v2.2'));
  T('v21 build: G1 ladder gate, policy toggle and age safety net present', src.includes('autoGenG1LadderOk') && src.includes('autoPolicySel') && src.includes('data-auto-defpolicy') && src.includes('ageRestrictionViolation'));
}

// ---- v2.2: ローテーション（出走指定） ----
{
  // key robustness: names collide (overseas heavily, some domestic), so the key carries the annual slot
  const all = [...DATA.domestic, ...DATA.overseas];
  T('v22 rotation keys are unique across all masters', new Set(all.map(rotationKeyOf)).size === all.length);
  const jc0 = DATA.domestic.find(r => r.name === 'ジャパンC');
  T('v22 rotation key round-trips (Japan Cup)', rotationRaceOf(rotationKeyOf(jc0)) === jc0);
  const ecl = DATA.overseas.filter(r => r.name === 'シャンパンＳ'); /* 豪・英・米に同名の重賞がある */
  T('v22 same-name overseas races resolve to distinct masters', ecl.length >= 3 && new Set(ecl.map(rotationKeyOf)).size === ecl.length && ecl.every(r => rotationRaceOf(rotationKeyOf(r)) === r));
  T('v22 picker scope: domestic graded/listed/OP and overseas G1-G3 only',
    rotationPickable(jc0) === true && rotationPickable(DATA.domestic.find(r => r.grade === 'OP')) === true
    && rotationPickable(DATA.domestic.find(r => r.grade === 'L')) === true
    && rotationPickable(DATA.domestic.find(r => r.grade === '3勝クラス')) === false && rotationPickable(DATA.overseas[0]) === true);
  T('v22 new horses default to an empty, per-horse rotation list', (() => { const a = mk({}), b = mk({}); return Array.isArray(a.rotation) && a.rotation.length === 0 && a.rotation !== b.rotation; })());
}
{
  // designation registers when the window opens; generic auto OFF is fine; NO auto G1 gate (manual semantics)
  const satsuki = DATA.domestic.find(r => r.name === '皐月賞');
  freshS({ year: 2033, month: 3, week: 4, phase: 'play' });
  const h = mk({ name: '指定皐月', wins: 1, birthYear: 2030, distMin: 2000, distMax: 2000 }); /* autoEntry は既定OFF・実績ラダーの記録なし */
  h.rotation = [rotationKeyOf(satsuki)];
  S.horses = [h];
  rotationPass();
  T('v22 outside the window (4 weeks out) nothing is registered yet', Object.keys(h.entries).length === 0);
  S.week = 5;
  rotationPass();
  const g = raceOfEntry(h);
  T('v22 designation registers as soon as the window opens (3 weeks out)', !!g && g.race.name === '皐月賞' && g.abs === absOf(2033, 4, satsuki.wom));
  T('v22 designated entries have the manual shape (cancellable like any registration)', !!g && g.entry.name === '皐月賞' && g.entry.sector === 'central' && g.entry.key === g.abs + '@皐月賞|中山|GI');
  T('v22 the designated registration is announced in the topics', S.topics.some(t => t.includes('ローテーション登録') && t.includes('皐月賞')));
  T('v22 a record-less 1-win 3yo IS registered in a generation G1 by designation (no auto G1 gate)', !!g && autoGenG1LadderOk(h) === false);
}
{
  // winless horse designated for a graded race: the manual block applies; skip notice exactly once, at the race week
  const satsuki = DATA.domestic.find(r => r.name === '皐月賞');
  freshS({ year: 2033, month: 3, week: 5, phase: 'play' });
  const h = mk({ name: '指定未勝利', wins: 0, birthYear: 2030, distMin: 2000, distMax: 2000 });
  h.rotation = [rotationKeyOf(satsuki)];
  S.horses = [h];
  const found = [];
  const tally = () => found.push(...S.topics.filter(t => t.includes('ローテーション見送り')));
  rotationPass(); tally();
  T('v22 a winless horse is NOT registered in a graded race by designation (manual block)', Object.keys(h.entries).length === 0);
  let guard = 0;
  while(absWeek() < absOf(2033, 4, satsuki.wom) && guard++ < 10){ advanceWeek(); tally(); }
  T('v22 skip notice fires exactly once, when the race week arrives', found.length === 1);
  T('v22 skip notice carries the manual block reason', found.length === 1 && found[0].includes('未勝利馬は'));
  advanceWeek(); tally(); advanceWeek(); tally();
  T('v22 no repeated skip notice after the race week has passed', found.length === 1);
}
{
  // injury: eligibility's own reason is what the skip notice reports
  const jc = DATA.domestic.find(r => r.name === 'ジャパンC');
  freshS({ year: 2032, month: 11, week: 4, phase: 'play' });
  const h = mk({ name: '指定故障', wins: 4, birthYear: 2028, distMin: 1800, distMax: 2400 });
  h.injuredUntil = absOf(2032, 12, 4);
  h.rotation = [rotationKeyOf(jc)];
  S.horses = [h];
  rotationPass();
  T('v22 an injured horse is not registered by designation', Object.keys(h.entries).length === 0);
  advanceWeek(); /* arrives at the Japan Cup week; the pass retries and reports the skip */
  T('v22 injury skip notice names the injury', S.topics.some(t => t.includes('ローテーション見送り') && t.includes('ジャパンC') && t.includes('故障')));
}
{
  // overseas: the domestic-graded gate is manual law, so designation honours it too
  const arc = DATA.overseas.find(r => r.name === 'アルクドゥトリオンフ賞（凱旋門賞）');
  freshS({ year: 2032, month: 9, week: 2, phase: 'play' });
  const ng = mk({ name: '指定海外不可', wins: 1, birthYear: 2028, distMin: 2000, distMax: 2400 });
  ng.rotation = [rotationKeyOf(arc)];
  S.horses = [ng];
  rotationPass();
  T('v22 overseas designation honours the domestic-graded gate', Object.keys(ng.entries).length === 0);
  const found = [];
  let guard = 0;
  while(absWeek() < absOf(2032, 10, 1) && guard++ < 8){ advanceWeek(); found.push(...S.topics.filter(t => t.includes('ローテーション見送り'))); }
  T('v22 overseas skip notice carries the gate reason', found.length === 1 && found[0].includes('海外遠征には国内の重賞'));
}
{
  // overseas with the gate met: registers in the window; the expedition fee lands at race time, exactly like manual
  const arc = DATA.overseas.find(r => r.name === 'アルクドゥトリオンフ賞（凱旋門賞）');
  freshS({ year: 2032, month: 9, week: 2, phase: 'play' });
  const ok = mk({ name: '指定海外可', wins: 1, gradedWin: true, birthYear: 2028, distMin: 2000, distMax: 2400 });
  ok.rotation = [rotationKeyOf(arc)];
  S.horses = [ok];
  rotationPass();
  const g = raceOfEntry(ok);
  T('v22 overseas designation registers inside the window when the gate is met', !!g && g.entry.sector === 'overseas' && g.abs === absOf(2032, 10, 1));
  let guard = 0;
  while(absWeek() < absOf(2032, 10, 1) && guard++ < 8) advanceWeek();
  const fundsBefore = S.funds;
  advanceWeek(); /* runs the Arc (same month, so no monthly settlement inside the measured week) */
  const res = ok.results.find(r => r.race === arc.name);
  T('v22 the designated overseas race runs', !!res);
  const expect = (res && res.finish <= 5 ? prizePayout(res.prize).net : 0) - EXPEDITION_FEE;
  T('v22 expedition fee is charged at race time, mirroring manual entry', !!res && S.funds - fundsBefore === expect && ok.expedReturnAbs === absOf(2032, 10, 1) + 1);
}
{
  // two designated races in the same week: list order wins; the loser is told why, once
  const first = DATA.domestic.find(r => r.name === '京葉ステークス');   /* 4月第3週・L・3歳以上 */
  const second = DATA.domestic.find(r => r.name === 'アンタレスS');    /* 4月第3週・GIII・4歳以上 */
  freshS({ year: 2032, month: 4, week: 1, phase: 'play' });
  const h = mk({ name: '指定同週', wins: 4, birthYear: 2027, distMin: 1200, distMax: 2000 });
  h.rotation = [rotationKeyOf(first), rotationKeyOf(second)];
  S.horses = [h];
  rotationPass();
  const g = raceOfEntry(h);
  T('v22 same-week conflict: the earlier designation in the list wins', !!g && g.race.name === first.name && Object.keys(h.entries).length === 1);
  const found = [];
  let guard = 0;
  while(absWeek() < absOf(2032, 4, 3) && guard++ < 6){ advanceWeek(); found.push(...S.topics.filter(t => t.includes('ローテーション見送り'))); }
  T('v22 same-week conflict: the losing designation gets one skip notice citing the other registration', found.length === 1 && found[0].includes(second.name) && found[0].includes('登録済み'));
}
{
  // removing a designation stops future registrations
  const arima = DATA.domestic.find(r => r.name === '有馬記念');
  freshS({ year: 2032, month: 10, week: 1, phase: 'play' });
  const h = mk({ name: '指定解除', wins: 4, birthYear: 2028, distMin: 2000, distMax: 2600 });
  h.rotation = [rotationKeyOf(arima)];
  S.horses = [h];
  h.rotation = [];
  let guard = 0;
  while(absWeek() < absOf(2032, 12, 4) && guard++ < 20) advanceWeek();
  advanceWeek(); /* the Arima week passes */
  T('v22 removing a designation stops future registrations (no Arima start)', !h.results.some(r => r.race === '有馬記念') && Object.keys(h.entries).length === 0);
}
{
  // designations on horses that are not racing yet simply wait
  const jc = DATA.domestic.find(r => r.name === 'ジャパンC');
  freshS({ year: 2032, month: 11, week: 4, phase: 'play' });
  const y = mk({ name: '指定若馬', status: 'yearling', birthYear: 2031 });
  y.rotation = [rotationKeyOf(jc)];
  const b = mk({ name: '指定繁殖', status: 'broodmare', sex: '牝', birthYear: 2026 });
  b.rotation = [rotationKeyOf(jc)];
  S.horses = [y, b];
  rotationPass();
  T('v22 designations on non-racehorses simply wait (no registration, no crash)', Object.keys(y.entries).length === 0 && Object.keys(b.entries).length === 0);
}
{
  // persistence + migration
  const jc = DATA.domestic.find(r => r.name === 'ジャパンC');
  const arima = DATA.domestic.find(r => r.name === '有馬記念');
  freshS({ year: 2032, month: 1, week: 1, phase: 'play' });
  const h = mk({ name: '指定保存', wins: 4, birthYear: 2028 });
  h.rotation = [rotationKeyOf(jc), rotationKeyOf(arima)];
  S.horses = [h];
  save();
  T('v22 designations survive save/load, in order', load() === true && JSON.stringify(S.horses[0].rotation) === JSON.stringify([rotationKeyOf(jc), rotationKeyOf(arima)]));
  const mig = mk({ name: '指定移行' }); delete mig.rotation; delete mig.rotMemo; S.horses = [mig];
  migrateV029();
  T('v22 migration fills an empty rotation for old saves', Array.isArray(mig.rotation) && mig.rotation.length === 0);
}
{
  // exclusivity at unit level: the generic pass ignores a designated horse, and takes it back when the list empties
  const jc = DATA.domestic.find(r => r.name === 'ジャパンC');
  freshS({ year: 2032, month: 6, week: 1, phase: 'play' });
  const h = mk({ name: '指定排他', wins: 1, birthYear: 2028, autoEntry: true });
  h.rotation = [rotationKeyOf(jc)];
  S.horses = [h];
  autoEntryPass();
  T('v22 the generic auto pass skips a horse with designations entirely', Object.keys(h.entries).length === 0);
  h.rotation = [];
  autoEntryPass();
  T('v22 emptying the rotation returns the horse to generic auto entry', Object.keys(h.entries).length === 1);
}
{
  // the motivating case, full year: an 1800-2400 OP horse whose only start all year is the designated Japan Cup
  const jc = DATA.domestic.find(r => r.name === 'ジャパンC');
  freshS({ year: 2032, month: 1, week: 1, phase: 'play' });
  const h = mk({ name: 'ジャパンC狙い', wins: 4, gradedWin: true, birthYear: 2028, surface: '芝', distMin: 1800, distMax: 2400, autoEntry: true });
  h.rotation = [rotationKeyOf(jc)];
  S.horses = [h];
  skipTo(2033, 1, 1);
  T('v22 motivating case: the designated Japan Cup is run in November (not the generic campaign)', h.results.length === 1 && h.results[0].race === 'ジャパンC');
  T('v22 exclusivity over a full-year skip: no generic starts are added around the designation', h.results.length === 1);
}
{
  // calendar mark
  const jc = DATA.domestic.find(r => r.name === 'ジャパンC');
  freshS({ year: 2032, month: 11, week: 1, phase: 'play' });
  const h = mk({ name: 'カレンダー指定馬', wins: 4, birthYear: 2028 });
  h.rotation = [rotationKeyOf(jc)];
  S.horses = [h];
  calMonth = 11;
  const html = viewCalendar();
  T('v22 the calendar marks designated races with 🎯 and the horse name', html.includes('🎯指定：カレンダー指定馬'));
  calMonth = 0;
}
{
  freshS({});
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v22 build: rotation pass and horse-page section present, footer bumped', src.includes('rotationPass') && src.includes('🎯 ローテーション（出走指定）') && src.includes('競馬シミュレーター（趣味） v2.2'));
  T('v22 rename: interval controls no longer wear the rotation name', src.includes('📅 自動出走設定（カレンダーで確認）') && src.includes('🤖 自動出走設定') && !src.includes('📅 ローテ設定') && !src.includes('🤖 ローテ設定'));
  T('v22 interval settings themselves are untouched by the rename', S.autoRotDefault === 8 && autoRotOf(mk({})) === 8 && autoRotOf(mk({ autoRot: 4 })) === 4);
}

// ---- v2.2: debug creator — manual aptitude distance range (lower/upper bounds) ----
{
  freshS({ year: 2026 });
  const h = buildDebugHorse({ distMin: 1800, distMax: 2400 });
  T('v22 debug manual dist range honoured exactly (1800-2400)', h.distMin === 1800 && h.distMax === 2400);
  const n = buildDebugHorse({ distMin: 1700, distMax: 2600 });
  T('v22 debug manual dist range is not snapped to a preset (1700-2600)', n.distMin === 1700 && n.distMax === 2600);
  const w = buildDebugHorse({ distMin: 1000, distMax: 4000 });
  T('v22 debug manual dist range at the sane edges honoured (1000-4000)', w.distMin === 1000 && w.distMax === 4000);
}
{
  freshS({ year: 2026 });
  T('v22 debug dist fallback when min >= max', (() => { const h = buildDebugHorse({ distMin: 2400, distMax: 1800 }); return h.distMin === 1800 && h.distMax === 2400; })());
  T('v22 debug dist fallback when min == max', (() => { const h = buildDebugHorse({ distMin: 2000, distMax: 2000 }); return h.distMin === 1800 && h.distMax === 2400; })());
  T('v22 debug dist fallback when below the sane span', (() => { const h = buildDebugHorse({ distMin: 900, distMax: 2400 }); return h.distMin === 1800 && h.distMax === 2400; })());
  T('v22 debug dist fallback when above the sane span', (() => { const h = buildDebugHorse({ distMin: 1800, distMax: 4200 }); return h.distMin === 1800 && h.distMax === 2400; })());
  T('v22 debug dist default unchanged when unset', (() => { const h = buildDebugHorse({}); return h.distMin === 1800 && h.distMax === 2400; })());
  T('v22 debug dist single-sided spec fills the other side with the default', (() => { const h = buildDebugHorse({ distMin: 1600 }); return h.distMin === 1600 && h.distMax === 2400; })());
}
{
  freshS({ year: 2026 });
  /* downstream consumers read the range generically: race aptitude factor, auto-entry distance fit, distance-band affinities */
  const h = buildDebugHorse({ age: 4, distMin: 1800, distMax: 2400, record: 3 });
  T('v22 debug manual range drives aptitudeFactor (in-range = 1, out-of-range < 1)',
    aptitudeFactor(h, { surface: '芝', distance_m: 2400 }) === 1 && aptitudeFactor(h, { surface: '芝', distance_m: 2600 }) < 1 && aptitudeFactor(h, { surface: '芝', distance_m: 1600 }) < 1);
  T('v22 debug manual range drives autoFitsLite distance fit',
    autoFitsLite(h, { sector: 'domestic', surface: '芝', distance_m: 2400, grade: 'GII', conditions: '' }) === true
    && autoFitsLite(h, { sector: 'domestic', surface: '芝', distance_m: 2600, grade: 'GII', conditions: '' }) === false);
  const a = buildDebugHorse({ age: 3, distMin: 1800, distMax: 2400, distBulk: '○' });
  T('v22 debug manual range scopes distance-band affinities', [1800, 2000, 2200, 2400].every(b => a.aff.distAff[b] === '○') && a.aff.distAff[1600] === undefined && a.aff.distAff[2600] === undefined);
}
{
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v22 build: debug form has manual dist bound inputs wired through createDebugHorse', src.includes("id='dbgDistMin'") && src.includes("id='dbgDistMax'") && src.includes('gv("#dbgDistMin"') && src.includes('gv("#dbgDistMax"'));
}

console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
