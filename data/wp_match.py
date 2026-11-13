# WP10海外リストと overseas_races_2025.json のG2/G3欠損レコードを突合し、
# WP収録レースにだけ距離・条件を流し込む（detail_source=WP10 を付ける）。
import json, re, sys

DATA = '/home/hatch/workspace/keiba-game/data/overseas_races_2025.json'
TSV = '/home/hatch/workspace/keiba-game/data/wp10_overseas.tsv'

REGION_COUNTRIES = {
    'usa': {'アメリカ', 'カナダ'},
    'eur': {'イギリス', 'フランス', 'アイルランド', 'ドイツ', 'イタリア'},
    'aus': {'オーストラリア'},
    'sdh': {'アラブ首長国連邦', '香港', 'サウジアラビア'},
}

FW = str.maketrans('０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ',
                   '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')

def norm(s):
    s = s.translate(FW)
    s = s.replace('．', '.').replace('・', '').replace(' ', '').replace('　', '').replace('.', '')
    s = s.replace('＆', '&')
    # カナ揺れ吸収
    s = s.replace('ヴァ', 'バ').replace('ヴィ', 'ビ').replace('ヴェ', 'ベ').replace('ヴォ', 'ボ').replace('ヴ', 'ブ')
    s = s.replace('二世', '2').replace('Ⅱ', '2').replace('Ⅲ', '3').replace('Ⅳ', '4').replace('Ⅰ', '1')
    s = s.upper()
    return s

SMALL = str.maketrans('ィゥェォャュョァ', 'イウエオヤユヨア')
DAKU = str.maketrans('ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポヴ', 'カキクケコサシスセソタチツテトハヒフヘホハヒフヘホウ')

def core(s):
    """語尾・小文字カナ・濁点・長音の表記差を吸収した照合キー"""
    s = norm(s).translate(SMALL).translate(DAKU).replace('ッ', '').replace('ー', '')
    s = re.sub(r'(ステークス|ハンデキャップ|ハンデ|選手権|記念|招待|賞)$', '', s)
    s = re.sub(r'[SHC]$', '', s)
    s = re.sub(r'(ステークス|ハンデキャップ|ハンデ|選手権|記念|招待)', '', s)
    return s

# 手作業エイリアス: WP名 -> racedb名（改名・表記差が大きいもの）
ALIASES = {
    'オーサムアゲインS': 'グッドウッドＳ',
    'オールドフォレスターターフクラシック': 'ターフクラシックＳ',
    'クールモアターフマイルS': 'ターフマイルＳ',
    'ジョッキークラブゴールドC': 'ジョッキークラブＧＣＳ',
    'マクダイアーミダS': 'マックディアミダＳ',
    'ウッティーステファンズS': 'ウッディスティーヴンスＳ',
    'オグデンフィリップスS': 'オグデンフィップスＳ',
    'ユナイテットネーションズS': 'ユナイテッドネイションズＳ',
    'シャンペンS': 'シャンパンＳ',
    'アルシビアデスS': 'アルシバイアディーズＳ',
    'アメリカンファラオS': 'アメリカンフェイローＳ',
    'デルマーデビュターントS': 'デルマーデビュータントＳ',
    'チッピングノートンS': 'ヴェリーエレガントＳ',
    'ランウェッドS': 'ランヴェットＳ',
    'タンクレッドS': 'ヘンリー・ユージン・タンクレッドＳ',
    'ドンカスターマイル': 'ドンカスターＨ',
    'トゥーラックハンデ': 'トゥーラックＨ',
    'ダーレーチャンピオンズスプリント': 'チャンピオンズスプリント',
    'カンタラS': 'チャンピオンズマイル',
    'マッキノンS': 'チャンピオンズＳ',
    'レットシーターフH': 'レッドシーターフハンデキャップ',
    'フランスダービー': 'ジョッケクルブ賞',
    'フランスオークス': 'ディアヌ賞',
    'セントジェイムズパレスS': 'セントジェームズパレスＳ',
    '香港チャンピオンズ＆チャターカップS': 'チャンピオンズ＆チャターカップ',
    'キングジョージⅣ&クイーンエリザベスS': 'キングジョージ六世＆クイーンエリザベスＳ',
    'スワニーS': 'スワニーリバーＳ',
    'シャムステークス': 'シャムＳ',
    'ドボガンS': 'トボガンＳ',
    'エルクボーンS': 'エルクホーンＳ',
    'ハリウッドカップS': 'ハリウッドターフカップＳ',
    'マイルS': 'サンダウンマイルＳ',
    'レイチェルアレクサンドラS': 'レイチェルアレキサンドラＳ',
    'W・L・マクナイトS': 'ウィリアム・Ｌ・マクナイトＳ',
    'ヒアカムズザブライドS': 'ヒヤーカムズザブライドＳ',
    'ロイヤルヒロインマイルS': 'ロイヤルヒロインＳ',
    'トランシルヴェニアS': 'トランシルヴァニアＳ',
    'チャールズウィッテンガム記念S': 'チャールズウィッティンガムＳ',
    'サンカピストラーノS': 'サンファンカピストラーノＳ',
    'サンクレメンテh': 'サンクレメントＨ',
    'ポーリンググリーンS': 'ボウリンググリーンＳ',
    'ポールストンスパスS': 'ボールストンスパＳ',
    'フラワーボールS': 'フラワーボウルＳ',
    'ベルデームS': 'ベルデイムＳ',
    'アルクール賞': 'アークール賞',
    'ヘンリーⅡ世S': 'ヘンリー二世Ｓ',
    'リブルスデイルS': 'リブルスデールＳ',
    'キングエドワード7世S': 'キングエドワード七世Ｓ',
    'ハンザ賞': 'ハンザ大賞',
    'フィニークススプリントS': 'フェニックススプリントＳ',
    'ゴンドービロ賞': 'ゴントービロン賞',
    'ゴルデネパイチェ': 'ゴールデネパイシェ',
    'プランスドランジェ賞': 'プランスドランジュ賞',
    'ダニエルウィルデンスタイン賞': 'ダニエルウィルデンシュタイン賞',
    'ストーンサイドボーモントS': 'ボーモントＳ',
    'ウッドウォードS': 'ウッドワードＳ',
    'サンヴィセンテS': 'サンヴィセントＳ',
}

AGE_LABEL = {'2': '２歳', '3': '３歳', '3+': '３歳以上', '4+': '４歳以上', '2+': '２歳以上', '': ''}
SEX_LABEL = {'F': '牝馬限定', 'M': '牡馬せん馬限定', '': ''}

def has_dist(r):
    txt = ((r.get('conditions_raw') or '') + ' ' + (r.get('distance_raw') or '')).translate(FW)
    return bool(re.search(r'\d{3,4}\s*メートル|\d+(?:\.\d+)?\s*ハロン|\d+(?:\.\d+)?\s*マイル', txt))

def main():
    apply = '--apply' in sys.argv
    wp = []
    for line in open(TSV, encoding='utf-8'):
        if line.startswith('#') or not line.strip():
            continue
        parts = line.rstrip('\n').split('\t')
        if len(parts) < 6:
            parts += [''] * (6 - len(parts))
        region, name, grade, dist, age, sex = parts[:6]
        wp.append({'region': region, 'name': name, 'grade': grade, 'dist': int(dist), 'age': age, 'sex': sex})
    d = json.load(open(DATA))
    races = d['races'] if isinstance(d, dict) else d

    # racedb側インデックス（国ごと）
    by_norm = {}
    by_core = {}
    for r in races:
        by_norm.setdefault(norm(r['name']), []).append(r)
        by_core.setdefault(core(r['name']), []).append(r)

    filled = 0
    wp_unmatched = []
    matched_records = set()
    for w in wp:
        targets = []
        cand_names = [w['name']]
        if w['name'] in ALIASES:
            cand_names.append(ALIASES[w['name']])
        for cn in cand_names:
            for r in by_norm.get(norm(cn), []) + by_core.get(core(cn), []):
                if r['country'] in REGION_COUNTRIES[w['region']] and r not in targets:
                    targets.append(r)
        hit = False
        for r in targets:
            if r['grade'] == 'G1':
                hit = True
                continue
            if not has_dist(r):
                cond = 'サラ' + AGE_LABEL.get(w['age'], '') + SEX_LABEL.get(w['sex'], '') + (r.get('surface') or '') + str(w['dist']) + 'メートル'
                if apply:
                    r['conditions_raw'] = cond
                    r['distance_raw'] = str(w['dist']) + 'メートル'
                    r['detail_source'] = 'WP10'
                filled += 1
                hit = True
                matched_records.add(id(r))
        if not hit and w['grade'] in ('G2', 'G3'):
            wp_unmatched.append(w)
    if apply:
        json.dump(d, open(DATA, 'w'), ensure_ascii=False, indent=1)
    miss = [r for r in races if r['grade'] in ('G2', 'G3') and not has_dist(r)]
    print(f'WP rows: {len(wp)}  filled records: {filled}')
    print(f'G2/G3 still missing after merge: {len(miss)}')
    from collections import Counter
    print('missing by grade+country:', dict(Counter((r["grade"], r["country"]) for r in miss)))
    print('--- WP G2/G3 rows with no racedb match (first 80) ---')
    for w in wp_unmatched[:80]:
        print(' ', w['region'], w['name'], w['grade'], w['dist'])
    print(f'(unmatched WP G2/G3 total: {len(wp_unmatched)})')

if __name__ == '__main__':
    main()
