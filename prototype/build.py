#!/usr/bin/env python3
"""Build prototype/index.html from template.html + data files in ../data/.
v0.26 (2026-11-13): weight_type（負担重量区分）と labels（路線／トライアル）を
レースデータに載せるようになった。
v0.27 (2026-11-13): 海外レースの性別条件パースを修正（「牡馬牝馬限定」を牝馬限定と
誤判定していた問題）。
v0.28 (2026-11-13): データ監査（data/DATA_AUDIT_2026-11-13.md）対応。年齢条件パースの
全面修正（全角数字・2歳以上・4歳・誤記 upward）、牡馬限定の符号化、ハロン＋ヤード距離、
ドバイシーマクラシックの追加、馬場反転2件と競馬場表記ゆれの訂正。
v0.29 (2026-11-13): 地方シリーズのルートラベル追加（グランダム・ジャパン各シーズン／
未来優駿。出典：NAR公式 keiba.go.jp/raceseries 2026年度）。ゲーム本体の変更は
template.html 側（重ね登録・成長型の内部細分化・状態回復・若馬売却・斤量区分の見直し）。
v1.00 (2026-11-14): 週の割り当てを日曜始まり基準に再編（month_wom）。第5週のある月
（3・5・8・11月）を立て、1年52週にした。ダービーとオークスの同週衝突の解消。
同 (2026-11-15): 平日レースのバケットを「次の日曜」から「週を始める日曜」に変更
（Terai決定）。土曜＝翌日の日曜、日曜＝当日は不変。"""
import json, re, math, datetime, os

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "..", "data")

tpl = open(os.path.join(BASE, "template.html")).read()
dom = json.load(open(os.path.join(DATA, "domestic_races.json")))
ov = json.load(open(os.path.join(DATA, "overseas_races_2025.json")))
st = json.load(open(os.path.join(DATA, "stallions_full.json"))) # v3.0：統合ロスター137頭（年齢・体重込み）

# ===== 週の割り当て（v1.00・Terai決定「1/1が日曜スタート」） =====
# 週は日曜始まり。レースは「その週の日曜」の週に置く：
#   日曜＝当日、土曜＝翌日の日曜（土日は同じJRA開催週末なので週末の日曜に寄せる）、
#   平日（月〜金）＝その週（日〜土）を始める日曜＝直近の日曜。
# 平日の扱いは Terai の追加決定（2026-11-15）：当初は全レースを「次の日曜」に
# 寄せていたが、月曜開催のかきつばた記念（2026-02-23）が3月第1週に飛ぶなど
# 平日レースが月をまたぎすぎたため、平日だけ週の始まりの日曜に改めた。
# (月, 第何週) = バケット日曜の月と、その月の何番目の日曜か。
# 年の端の例外：平日レースのバケット日曜が前年に食み出す年初分（1/1〜2）は
# (1,1) へ、土曜のバケット日曜が翌年に食み出す年末分は (12,4) へ寄せる。
# 月の週数は2026年の暦どおり（日曜が5回ある 3・5・8・11月だけ第5週）= 1年52週。
# 旧方式（ceil(日/7) を第4週で頭打ち）は第5週末を第4週に潰し、ダービーが
# オークスの週に重なる不具合の原因だった（2026-11-14、Terai がプレイ中に発見）。
WEEKS_IN_MONTH = [4, 4, 5, 4, 5, 4, 4, 5, 4, 4, 5, 4]

def month_wom(dt):
    wd = dt.weekday()  # Mon=0 .. Sat=5, Sun=6
    if wd == 6:        # 日曜：当日
        sun = dt
    elif wd == 5:      # 土曜：翌日の日曜（同じ開催週末）
        sun = dt + datetime.timedelta(days=1)
    else:              # 平日：その週を始める日曜（直近の日曜）
        sun = dt - datetime.timedelta(days=wd + 1)
    if sun.year < dt.year:   # 年初分：バケット日曜が前年の年末にある平日レース
        return (1, 1)
    if sun.year > dt.year:   # 年末分：土曜の翌日曜が翌年に食み出す場合
        return (12, 4)
    wom = (sun.day - 1) // 7 + 1
    # 2025年基準の海外日程など、ゲームの月週数を超えたら末週へ寄せる
    return (sun.month, min(wom, WEEKS_IN_MONTH[sun.month - 1]))

# ===== レースのラベル（SPEC.md「レースのラベル」） =====
ROUTES_DOM = {
    "牡馬三冠": ["皐月賞", "日本ダービー", "菊花賞"],
    "牝馬三冠": ["桜花賞", "オークス", "秋華賞"],
    "ダート三冠": ["羽田盃", "東京ダービー", "ジャパンダートクラシック"],
    "春古馬三冠": ["大阪杯", "天皇賞（春）", "宝塚記念"],
    "秋古馬三冠": ["天皇賞（秋）", "ジャパンC", "有馬記念"],
    "春秋マイル": ["安田記念", "マイルチャンピオンシップ"],
    "春秋スプリント": ["高松宮記念", "スプリンターズS"],
    "春秋グランプリ": ["宝塚記念", "有馬記念"],
}
# 対象レース -> そのトライアル（国内確定分。宝塚・有馬・ジャパンC・2歳G1には付けない）
TRIALS_DOM = {
    "フェブラリーS": ["プロキオンS", "根岸S"],
    "高松宮記念": ["阪急杯", "オーシャンS"],
    "大阪杯": ["中山記念", "金鯱賞"],
    "桜花賞": ["チューリップ賞", "フィリーズレビュー", "アネモネステークス"],
    "皐月賞": ["弥生賞", "スプリングS", "若葉ステークス"],
    "天皇賞（春）": ["阪神大賞典", "日経賞"],
    "NHKマイルC": ["ニュージーランドT", "チャーチルダウンズC"],
    "ヴィクトリアマイル": ["阪神牝馬S", "福島牝馬S"],
    "オークス": ["フローラS", "スイートピーステークス"],
    "日本ダービー": ["青葉賞", "プリンシパルステークス"],
    "安田記念": ["マイラーズC", "京王杯スプリングC"],
    "スプリンターズS": ["キーンランドC", "セントウルS"],
    "秋華賞": ["紫苑S", "ローズS"],
    "菊花賞": ["セントライト記念", "神戸新聞杯"],
    "天皇賞（秋）": ["オールカマー", "毎日王冠", "京都大賞典"],
    "エリザベス女王杯": ["アイルランドT"],
    "マイルチャンピオンシップ": ["富士S", "スワンS"],
    "チャンピオンズC": ["みやこS", "武蔵野S"],
}
# 地方シリーズ（v0.29）：NAR公式シリーズ競走（keiba.go.jp/raceseries、2026年度）より。
# グランダム・ジャパン＝世代別牝馬シリーズ（指定交流＝Jpn格付け分のみ当ゲーム収録）、未来優駿＝秋の2歳シリーズ
ROUTES_REG = {
    "グランダム・ジャパン（古馬・春）": ["クイーン賞", "兵庫女王盃", "エンプレス杯（キヨフジ記念）"],
    "グランダム・ジャパン（古馬・秋）": ["スパーキングレディーカップ（ホクトベガメモリアル）", "ブリーダーズゴールドカップ", "レディスプレリュード", "JBCレディスクラシック"],
    "グランダム・ジャパン（3歳）": ["関東オークス"],
    "グランダム・ジャパン（2歳）": ["エーデルワイス賞"],
    "未来優駿": ["JBC2歳優駿", "兵庫ジュニアグランプリ", "全日本2歳優駿"],
}
def dom_labels(name):
    labs = [route for route, names in ROUTES_DOM.items() if name in names]
    labs += [route for route, names in ROUTES_REG.items() if name in names]
    labs += ["トライアル：" + t for t, trials in TRIALS_DOM.items() if name in trials]
    return labs

import unicodedata
def _norm(s):
    # NFKCで全角英字（Ｓ・Ｃ・Ａ等）を半角へ揃えてから空白を除く
    return unicodedata.normalize("NFKC", s or "").replace(" ", "").replace("　", "")
# 海外の路線（SPEC: G1路線のみ。国と正規化名の完全一致で照合する）
OV_ROUTES = [
    ("アメリカクラシック三冠", "アメリカ", ["ケンタッキーダービー", "プリークネスS", "ベルモントS"]),
    ("アメリカ芝三冠", "アメリカ", ["ベルモントダービー招待S", "サラトガダービー招待S", "ジョッキークラブダービー招待S"]),
    ("アメリカ牝馬三冠", "アメリカ", ["エイコーンS", "CCAオークス招待S", "アラバマS"]),
    ("アメリカ芝牝馬三冠", "アメリカ", ["ベルモントオークス招待S", "サラトガオークス招待S", "ジョッキークラブオークス"]),
    ("イギリス三冠", "イギリス", ["2000ギニーS", "ダービーS", "セントレジャーS"]),
    ("イギリス牝馬三冠", "イギリス", ["1000ギニーS", "オークス", "セントレジャーS"]),
    ("アイルランド三冠", "アイルランド", ["アイリッシュ2000ギニー", "アイリッシュダービー", "アイリッシュセントレジャーS"]),
    ("香港三冠", "香港", ["スチュワーズカップ", "香港ゴールドカップ", "チャンピオンズアンドチェイターカップ"]),
    ("豪州2歳三冠", "オーストラリア", ["ゴールデンスリッパー", "サイヤーズプロデュースS", "シャンパンS"]),
]
# 海外の前哨戦（v5.5）：(国, 前哨戦名) -> 本番のランタイム名。国内の TRIALS_DOM と同じ
# 「トライアル：X」ラベルで結び、勝利時の自動指定も同じ仕組みに乗せる（条件は海外側が厳しい）。
# ドバイシティオブゴールド→シーマクラシック、ターンブルS→メルボルンC は Terai 判断で対象外。
OV_TRIALS = {
    ("アラブ首長国連邦", "UAEダービー"): "ケンタッキーダービー",
    ("サウジアラビア", "サウジダービー"): "UAEダービー",
    ("フランス", "フォワ賞"): "アルクドゥトリオンフ賞（凱旋門賞）",
    ("フランス", "ニエル賞"): "アルクドゥトリオンフ賞（凱旋門賞）",
}
def ov_labels(r):
    n = _norm(r["name"])
    labs = [route for route, country, names in OV_ROUTES
            if r["country"] == country and n in [_norm(x) for x in names]]
    t = OV_TRIALS.get((r["country"], n))
    if t: labs.append("トライアル：" + t)
    return labs

# 海外G1の「行きやすさ」スコア（v5.5・Teraiと擦り合わせ）：5=S（日本馬が毎年のように参戦・
# 好走する）／4=A（行く年が多く勝ち馬もいる）／3=B（たまに行く・主要戦）／2=C（ほぼ行かない）／
# 1=D（2歳限定戦など日本馬の遠征対象にならない）。軸は日本馬の参戦実績と遠征のしやすさ。
# 明示表に無いG1は C(2)、2歳限定戦は D(1) を既定とする。豪州は「メルボルンCでも3年に1頭」
# （Terai）として全体に低く、ジェベルハッタは前哨戦イメージが無いため既定の C に置く。
_OV_ACCESS_ROWS = [
    # S=5
    ("香港", "香港カップ", 5), ("香港", "香港マイル", 5), ("香港", "香港スプリント", 5),
    ("香港", "香港ヴァーズ", 5), ("香港", "クイーンエリザベス二世カップ", 5),
    ("香港", "チャンピオンズマイル", 5), ("香港", "チェアマンズスプリントプライズ", 5),
    ("アラブ首長国連邦", "ドバイシーマクラシック", 5), ("アラブ首長国連邦", "ドバイターフ", 5),
    ("アラブ首長国連邦", "ドバイワールドカップ", 5), ("アラブ首長国連邦", "ドバイゴールデンシャヒーン", 5),
    ("アラブ首長国連邦", "アルクォーツスプリント", 5),
    ("サウジアラビア", "サウジカップ", 5), ("サウジアラビア", "ネオムターフカップ", 5),
    ("フランス", "アルクドゥトリオンフ賞（凱旋門賞）", 5),
    ("イギリス", "プリンスオブウェールズＳ", 5), ("イギリス", "インターナショナルＳ", 5),
    ("アメリカ", "ブリーダーズカップターフ", 5), ("アメリカ", "ブリーダーズカップフィリーアンドメアターフ", 5),
    # A=4
    ("フランス", "ヴェルメイユ賞", 4), ("フランス", "オペラ賞", 4), ("フランス", "フォレ賞", 4),
    ("フランス", "ジャックルマロワ賞", 4), ("フランス", "ガネー賞", 4),
    ("イギリス", "キングジョージ六世＆クイーンエリザベスＳ", 4), ("イギリス", "チャンピオンＳ", 4),
    ("イギリス", "クイーンアンＳ", 4), ("イギリス", "ナッソーＳ", 4),
    ("イギリス", "ジュライカップＳ", 4), ("イギリス", "サセックスＳ", 4),
    ("アイルランド", "アイリッシュチャンピオンＳ", 4),
    ("アメリカ", "ブリーダーズカップクラシック", 4), ("アメリカ", "ブリーダーズカップマイル", 4),
    ("アメリカ", "ケンタッキーダービー", 4),
    # B=3
    ("香港", "スチュワーズカップ", 3), ("香港", "香港ゴールドカップ", 3),
    ("香港", "チャンピオンズアンドチェイターカップ", 3), ("香港", "センテナリースプリントカップ", 3),
    ("香港", "クイーンズシルバージュビリーカップ", 3),
    ("フランス", "ムーランドロンシャン賞", 3), ("フランス", "イスパーン賞", 3),
    ("フランス", "サンクルー大賞典", 3), ("フランス", "パリ大賞典", 3),
    ("フランス", "アベイユドロンシャン賞", 3), ("フランス", "ロワイヤルオーク賞", 3),
    ("フランス", "カドラン賞", 3), ("フランス", "ジャンロマネ賞", 3),
    ("フランス", "ロートシルト賞", 3), ("フランス", "モーリスドゲスト賞", 3),
    ("イギリス", "クイーンエリザベス二世Ｓ", 3), ("イギリス", "エクリプスＳ", 3),
    ("イギリス", "コロネーションカップ", 3), ("イギリス", "ゴールドカップ", 3),
    ("イギリス", "ファルマスＳ", 3), ("イギリス", "ヨークシャーオークス", 3),
    ("イギリス", "ナンソープＳ", 3), ("イギリス", "スプリントカップ", 3),
    ("イギリス", "クイーンエリザベス二世ジュビリーＳ", 3), ("イギリス", "キングチャールズ三世Ｓ", 3),
    ("イギリス", "ロッキンジＳ", 3), ("イギリス", "サンチャリオットＳ", 3),
    ("イギリス", "ブリティッシュチャンピオンズフィリーズアンドメアーズＳ", 3),
    ("アイルランド", "タタソールズゴールドカップ", 3), ("アイルランド", "プリティーポリーＳ", 3),
    ("アイルランド", "メイトロンＳ", 3), ("アイルランド", "フライングファイブＳ", 3),
    ("アメリカ", "ペガサスワールドカップ招待Ｓ", 3), ("アメリカ", "ペガサスワールドカップターフ招待Ｓ", 3),
    ("アメリカ", "ブリーダーズカップダートマイル", 3), ("アメリカ", "ブリーダーズカップスプリント", 3),
    ("アメリカ", "ブリーダーズカップディスタフ", 3), ("アメリカ", "ブリーダーズカップターフスプリント", 3),
    ("アメリカ", "ブリーダーズカップフィリーアンドメアスプリント", 3),
    ("オーストラリア", "メルボルンカップ", 3), ("オーストラリア", "コーフィールドカップ", 3),
    ("オーストラリア", "コックスプレート", 3),
]
OV_ACCESS = {(c, _norm(n)): v for c, n, v in _OV_ACCESS_ROWS}
def ov_access(r):
    v = OV_ACCESS.get((r["country"], _norm(r["name"])))
    if v is not None: return v
    cond = parse_cond(r)
    if cond.startswith("2歳") and "以上" not in cond: return 1
    return 2

dom_out = []
for r in dom:
    dt = datetime.date.fromisoformat(r["date"])
    cond = r["conditions"].replace("3（4）歳以上", "3歳以上")
    mon, wom = month_wom(dt)
    dom_out.append({
        "name": r["name"], "grade": r["grade"], "sector": r["sector"], "category": r["category"],
        "racecourse": r["racecourse"], "surface": r["surface"], "distance_m": r["distance_m"],
        "conditions": cond, "month": mon, "wom": wom,
        "weight_type": r.get("weight_type") or "定量",
        "labels": dom_labels(r["name"]),
    })

def parse_dist(r):
    txt = ((r.get("conditions_raw") or "") + " " + (r.get("distance_raw") or ""))
    m = re.search(r"(\d{3,4})\s*メートル", txt)
    if m:
        return int(m.group(1))
    # ハロン＋ヤードの複合表記（英国式）はヤード分も換算する（旧実装は切り捨てていた。
    # 監査 Check 4：セントジェームズパレスS 1400→1600 等、出荷G1 14件が短くなっていた）
    m = re.search(r"(\d+(?:\.\d+)?)\s*ハロン(?:\s*(\d+(?:\.\d+)?)\s*ヤード)?", txt)
    if m:
        metres = float(m.group(1)) * 201.168
        if m.group(2):
            metres += float(m.group(2)) * 0.9144
        return int(round(metres / 50.0) * 50)
    m = re.search(r"(\d+(?:\.\d+)?)\s*マイル", txt)
    if m:
        return int(round(float(m.group(1)) * 1609.34 / 50.0) * 50)
    return None

_FW_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")

def parse_cond(r):
    # 全角数字（２歳・３歳以上など）を半角に正規化してから判定する。旧実装は半角の
    # 「2歳」しか見ておらず、全角表記の2歳限定戦59件（出荷分）が既定値「3歳以上」に
    # 落下していた（監査 Check 5・型A）。racedb 原文の upward 誤記
    # （upwarwd / upwawrd）もここで正規化する（同 Check 5・型C）。
    raw = (r.get("conditions_raw") or "").translate(_FW_DIGITS)
    raw = re.sub(r"upwarwd|upwawrd", "upward", raw, flags=re.I)
    # 年齢：「以上」付きを先に判定する。旧実装は "Two year old and upward" で年齢を
    # 空にし、最終的に「3歳以上」へ落下させていた（2歳以上戦60件。同 Check 5・型B）。
    # UAE の半球別表記（北半球産4歳以上／南半球産3歳以上）は従来どおり「4歳以上」
    # （4歳以上の分岐が先に一致するため。ゲームに半球の概念がないことによる仕様差）。
    if re.search(r"4歳以上|Four year old and upward", raw, re.I):
        age = "4歳以上"
    elif re.search(r"3歳以上|Three year old and upward", raw, re.I):
        age = "3歳以上"
    elif re.search(r"2歳以上|Two year old and upward", raw, re.I):
        age = "2歳以上"
    elif re.search(r"2歳|Two year old", raw, re.I):
        age = "2歳"
    elif re.search(r"3歳|Three year old", raw, re.I):
        age = "3歳"
    elif re.search(r"4歳|Four year old", raw, re.I):
        age = "4歳"
    else:
        age = "3歳以上"
    # 牝馬限定の判定：「牡馬牝馬限定」は牡牝混合（オープン）を意味するので牝にしない。
    # 現データの実パターンは「牝馬限定」177件／「牡馬牝馬限定」21件で、英語表記
    # （fillies/mares/colts）は現データに存在しないが、将来の取り込み用に併記する。
    hin = ("牝馬限定" in raw and "牡馬牝馬限定" not in raw) or \
          (re.search(r"fillies|mares", raw, re.I) and not re.search(r"colts", raw, re.I))
    # 牡馬限定／牡馬せん馬限定（監査 Check 1）：旧実装は落としていたため牝馬が出走
    # できてしまっていた。せん馬はプレイヤー馬の性別に無いので「牡」として扱い、
    # eligibility() の「牡を含み牝を含まない＝牡馬限定」判定にそのまま乗せる。
    bo = (("牡馬限定" in raw or "牡馬せん馬限定" in raw) and "牡馬牝馬限定" not in raw) or \
         (re.search(r"colts", raw, re.I) and not re.search(r"fillies|mares", raw, re.I))
    sex = "牝" if hin else ("牡" if bo else "")
    return (age + sex) if (age or sex) else "3歳以上"

def ov_month_wom(r):
    # 海外も国内と同じ日曜基準（v1.00）。実日付（date_2025）から割り当てる。
    # 日付が無い行だけ旧来の (month, week_of_month) をゲームの月週数で頭打ちして使う。
    if r.get("date_2025"):
        return month_wom(datetime.date.fromisoformat(r["date_2025"]))
    return (r["month"], min(r["week_of_month"], WEEKS_IN_MONTH[r["month"] - 1]))

ov_out = []
for r in ov:
    # G1は全件、G2/G3は距離が入っているもの（WP10収録分）だけをゲームに載せる
    if r["grade"] != "G1" and parse_dist(r) is None:
        continue
    ov_mon, ov_wom = ov_month_wom(r)
    ov_out.append({
        # 海外のグレード表記（G1等）は国内表記（GI等）に統一する。賞金・相手強さ・重賞勝ち判定などが
        # すべて国内表記前提のため、ここで揃えないと海外重賞が全部「格なし」扱いになる。
        "name": r["name"], "grade": {"G1": "GI", "G2": "GII", "G3": "GIII"}.get(r["grade"], r["grade"]),
        "sector": "overseas", "category": "graded", "country": r["country"],
        "racecourse": (r["racecourse"] or "") + "（" + r["country"] + "）", "surface": r["surface"],
        "distance_m": parse_dist(r), "conditions": parse_cond(r),
        "prize_first": r.get("prize_first_jpy"),
        "weight_type": r.get("weight_type") or "定量",
        "labels": ov_labels(r),
        "access": ov_access(r) if r["grade"] == "G1" else None,  # v5.5：行きやすさスコア（G1のみ）
        "month": ov_mon, "wom": ov_wom,
    })

mt = json.load(open(os.path.join(DATA, "mare_templates.json")))
cr = json.load(open(os.path.join(DATA, "course_records.json"))) # v6.4：JRAコースレコード（基準タイム）
data = {"domestic": dom_out, "overseas": ov_out, "stallions": st["stallions"], "mareTemplates": mt["mareTemplates"], "courseRecords": cr}
blob = "const DATA = " + json.dumps(data, ensure_ascii=False) + ";"
html = tpl.replace("/*__DATA__*/", blob)
out = os.path.join(BASE, "index.html")
open(out, "w").write(html)
print("domestic", len(dom_out), "overseasG1", len(ov_out),
      "withDist", sum(1 for r in ov_out if r["distance_m"]), "stallions", len(st["stallions"]))
print("index.html bytes", len(html))
# ラベル付与の検証：SPECの全レッグがデータに存在するか
dom_names = {r["name"] for r in dom}
for route, names in ROUTES_DOM.items():
    miss = [n for n in names if n not in dom_names]
    if miss: print("WARN domestic route", route, "missing", miss)
for t, trials in TRIALS_DOM.items():
    if t not in dom_names: print("WARN trial target missing", t)
    miss = [n for n in trials if n not in dom_names]
    if miss: print("WARN trials of", t, "missing", miss)
ov_shipped = {(r["country"], _norm(r["name"])) for r in ov_out}
for route, country, names in OV_ROUTES:
    miss = [n for n in names if (country, _norm(n)) not in ov_shipped]
    if miss: print("WARN overseas route", route, "missing", miss)
print("labels: domestic", sum(1 for r in dom_out if r["labels"]), "races labelled;",
      "overseas", sum(1 for r in ov_out if r["labels"]), "races labelled;",
      "weight ハンデ domestic", sum(1 for r in dom_out if r["weight_type"]=="ハンデ"),
      "/ overseas", sum(1 for r in ov_out if r["weight_type"]=="ハンデ"))
