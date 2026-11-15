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


// ---- v0.52 stage3: affinities ----
T('snapBand nearest', snapBand(2050) === 2000 && snapBand(2150) === 2200 && snapBand(900) === 1000);
{
  let viol = 0, rootO = 0, distHold = 0, courseHold = 0, yusoN = 0;
  const N = 600;
  for (let i = 0; i < N; i++) {
    const h = mk({}); const a = genAffinities(h, 2000);
    if ((a.rootAff === '○' && a.nonRoot === '○') || (a.rootAff === '✕' && a.nonRoot === '✕')) viol++;
    if (a.rootAff === '○') rootO++;
    if (Object.keys(a.distAff).length) distHold++;
    if (Object.keys(a.courseAff).length) courseHold++;
    if (a.yuso) yusoN++;
  }
  T('root/nonRoot same-direction never generated', viol === 0);
  T('root O rate ~35%', rootO / N > 0.27 && rootO / N < 0.43);
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
  T('v57 footer bumped', src.includes('競馬シミュレーター（趣味） v1.02')); /* フッターは現行版に追随（v1.01） */
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
  T('v58 build: footer bumped', src.includes('競馬シミュレーター（趣味） v1.02')); /* フッターは現行版に追随（v1.01） */
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
  const h = buildDebugHorse({ age: 3, distMin: 1600, distMax: 2400, rootDist: 2400, rootAff: '○', nonRoot: '○', yuso: true, distBulk: '○', courseBulk: '✕' });
  T('v59 debug aff root explicit', h.aff.rootDist === 2400 && h.aff.rootAff === '○');
  T('v59 debug aff explicit beats root/nonRoot exclusion', h.aff.nonRoot === '○');
  T('v59 debug aff yuso explicit', h.aff.yuso === true);
  T('v59 debug aff dist bulk applies in range only', [1600, 1800, 2000, 2200, 2400].every(b => h.aff.distAff[b] === '○') && h.aff.distAff[1000] === undefined);
  T('v59 debug aff course bulk applies to all 10', COURSES10.every(c => h.aff.courseAff[c] === '✕'));
  T('v59 debug aff predictions ready at age>=2', !!h.aff.pred);
  const sec = affinitySection(h);
  T('v59 debug horse page shows affinity section immediately', sec.includes('相性') && sec.includes('根幹距離 2400m'));
}
{
  freshS({ year: 2026 });
  const h = buildDebugHorse({ age: 4, distBulk: '-', courseBulk: '-' });
  T('v59 debug aff bulk minus clears marks', Object.keys(h.aff.distAff).length === 0 && Object.keys(h.aff.courseAff).length === 0);
  const r = buildDebugHorse({ age: 4 });
  T('v59 debug aff random base generated', !!r.aff && AFF_BANDS.includes(r.aff.rootDist) && typeof r.aff.yuso === 'boolean');
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
  T('v59 gift aff initialised at creation', !!g.aff && AFF_BANDS.includes(g.aff.rootDist) && !!g.aff.pred);
  S.giftQueue = [g];
  acceptGift('');
  const acc = S.horses[S.horses.length - 1];
  T('v59 accepted gift keeps aff', !!acc.aff);
  T('v59 accepted gift page shows affinity section', affinitySection(acc).includes('相性'));
  const g1 = makeGift('decFilly');
  T('v59 gift 1yo aff initialised (pred comes at 2)', !!g1.aff && AFF_BANDS.includes(g1.aff.rootDist));
}
{
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v59 build: debug pedigree selects + dam input present', src.includes('"dbgSire"') && src.includes("id='dbgDam'") && src.includes('"dbgBms"'));
  T('v59 build: affinity controls present', src.includes('"dbgRootDist"') && src.includes('"dbgYuso"') && src.includes('"dbgCourseBulk"'));
  T('v59 build: param range note present', src.includes('パラメータ通常 35〜85'));
  T('v59 build: footer bumped', src.includes('競馬シミュレーター（趣味） v1.02'));
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
  T('v100 build: footer bumped', src.includes('競馬シミュレーター（趣味） v1.02'));
  T('v100 build: skip week 5 option exists', src.includes('<option>5</option>'));
}

// ---- v1.01: first-year gifts replaced with fixed model horses ----
{
  // April 2026 trigger: exactly two 2yo gifts queued together (colt first, then filly)
  freshS({ year: 2026, month: 4, week: 1 });
  S.giftQueue = [];
  weeklyEvents();
  T('v101 April queues exactly 2 gifts', S.giftQueue.length === 2 && S.giftAprDone === true);
  const c = S.giftQueue[0], f = S.giftQueue[1];
  T('v101 April colt is the Efforia model', c.sex === '牡' && c.sire === 'エピファネイア' && c.dam === 'ケイティーズハート' && c.bms === 'ハーツクライ' && c.grandam === 'ケイティーズファースト' && c.gbms === 'クリス');
  T('v101 April colt aptitude + growth subtype', c.surface === '芝' && c.distMin === 1800 && c.distMax === 2500 && c.gtype === '普通早' && c.growth === '普通' && c.status === 'racehorse');
  T('v101 April filly is the Soul Stirring model', f.sex === '牝' && f.sire === 'Frankel' && f.dam === 'スタセリタ' && f.bms === 'モンズーン' && f.grandam === 'ソワニエ' && f.gbms === 'ダッシングブレイド');
  T('v101 April filly aptitude + growth subtype', f.surface === '芝' && f.distMin === 1600 && f.distMax === 2400 && f.gtype === '早熟' && f.growth === '早熟' && f.status === 'racehorse');
  T('v101 April filly has no explicit jizoku spec (trait is not forced)', GIFT_SPECS.aprFilly.jizoku == null);
  T('v101 April filly sire line resolves to Northern Dancer via the roster (Frankel)', majorLineOfName(f.sire) === 'ノーザンダンサー系');
  T('v101 Monsun chain supplemented like a template bmsLine (real sire Koenigsstuhl)', sireChainOf('モンズーン').includes('ケーニヒスシュトゥール'));
  T('v101 Monsun stays a side line (Blandford branch reaches no major-line marker)', majorLineOfName('モンズーン') === null);
  T('v101 April gifts are B-rank overall', rankOf(Math.round((c.spd + c.sta + c.gut) / 3)) === 'B' && rankOf(Math.round((f.spd + f.sta + f.gut) / 3)) === 'B');
  // each April horse is independently acceptable / refusable through the existing panel flow
  acceptGift('');
  T('v101 April colt accepted, filly still queued', S.horses.some(h => h.sire === 'エピファネイア') && S.giftQueue.length === 1 && S.giftQueue[0].sire === 'Frankel');
  refuseGift();
  T('v101 April filly refused independently', S.giftQueue.length === 0 && !S.horses.some(h => h.sire === 'Frankel'));
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
  // B-rank guarantee across repeated generations of all three gifts
  freshS({ year: 2026 });
  let allB = true, allInBand = true;
  for(let i = 0; i < 60; i++){
    for(const k of ['aprColt', 'aprFilly', 'decFilly']){
      const g = makeGift(k);
      if(rankOf(Math.round((g.spd + g.sta + g.gut) / 3)) !== 'B') allB = false;
      if([g.spd, g.sta, g.gut].some(v => v < 35 || v > 85)) allInBand = false;
    }
  }
  T('v101 all three gifts always land on B overall (180 generations)', allB);
  T('v101 gift params stay inside the 35-85 scale', allInBand);
  let fillyJizokuCount = 0;
  for(let i = 0; i < 60; i++){ if(makeGift('aprFilly').jizoku === true) fillyJizokuCount++; }
  T('v101 Soul Stirring filly jizoku is not forced (60 generations, not all true)', fillyJizokuCount < 60);
}
{
  const src = fs.readFileSync('/home/hatch/workspace/keiba-game/prototype/index.html', 'utf8');
  T('v101 build: fixed gift models present', src.includes('ケイティーズハート') && src.includes('スタセリタ') && src.includes('エンドスウィープ'));
  T('v101 build: footer bumped', src.includes('競馬シミュレーター（趣味） v1.02'));
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
  T('v102 build: footer bumped', src.includes('競馬シミュレーター（趣味） v1.02'));
  T('v102 build: compact media queries present', src.includes('@media (max-width:640px), (max-height:500px)'));
  T('v102 build: tscroll wrapper css', src.includes('.tscroll { overflow-x:auto'));
  T('v102 build: wrapTables defined', src.includes('function wrapTables(root)'));
  T('v102 build: wrapTables hooked in render', src.includes('wrapTables(b)'));
  T('v102 build: wrapTables hooked in horse modal', src.includes('wrapTables($("#horseModalBox"))'));
  T('v102 build: tabs single-row scroll in compact', src.includes('.tabs { flex-wrap:nowrap; overflow-x:auto'));
  T('v102 build: touch target min-height 36px', src.includes('button { min-height:36px; }'));
  T('v102 build: sticky first column in compact', src.includes('table:not(.ped) td:first-child { position:sticky; left:0'));
  T('v102 build: modal dvh heights', src.includes('max-height:88dvh') && src.includes('max-height:96dvh'));
  T('v102 build: lineage tree compact max-height', src.includes('.ltree-scroll { max-height:62dvh; overflow-y:auto; }'));
  const style = (src.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  let bal = 0, okB = style.length > 0;
  for (const ch of style) { if (ch === '{') bal++; else if (ch === '}') { bal--; if (bal < 0) { okB = false; break; } } }
  T('v102 build: style braces balanced', okB && bal === 0);
}

console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
