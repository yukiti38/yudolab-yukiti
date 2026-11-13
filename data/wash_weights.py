#!/usr/bin/env python3
"""WS2: 国内965件に weight_type（定量/別定/ハンデ/馬齢）と weight_confidence を付与する。
海外は全件デフォルト「定量」、著名ハンデ戦のみ例外リストで「ハンデ」。
分類根拠:
- JRA重賞（平地）はレース単位の実条件（2025/2026年番組・JRA発表で確認したものを含む）。
  検証済み: アイルランドT=別定, 小倉牝馬S=ハンデ, 府中牝馬S=ハンデ, クイーンS=別定,
  チャレンジC=ハンデ(2025年から), 鳴尾記念=別定, しらさぎS=別定。
- 障害重賞: 中山大障害・中山グランドジャンプ=定量、その他=別定。
- 地方交流重賞(Jpn): 単一年齢限定=馬齢、古馬混合=定量。
- リステッド: 単一年齢限定=馬齢、古馬混合=別定（オクトーバーSのみハンデ＝番組表確認）。
- オープン特別: 別定を標準（番組表の別定A/Bが多数派）。名前に「ハンデ」を含むものはハンデ。
- 条件特別: 単一年齢限定=馬齢。古馬混合はハンデを標準とする（JRAの命名条件特別は
  ハンデ戦が多数派という番組パターンに基づく仮定 → confidence low、オーナー確認対象）。
"""
import json, shutil, os, collections

BASE = os.path.dirname(os.path.abspath(__file__))

# ---------- JRA平地重賞：レース単位の実分類 ----------
GRADED_HANDICAP = {
    # GII
    "日経新春杯", "目黒記念", "アルゼンチン共和国杯",
    # GIII
    "中山金杯", "京都金杯", "小倉牝馬S", "シルクロードS", "ダイヤモンドS", "小倉大賞典",
    "中山牝馬S", "東京新聞杯", "愛知杯", "ダービー卿チャレンジT", "マーチS", "新潟大賞典",
    "CBC賞", "函館記念", "七夕賞", "北九州記念", "小倉記念", "中京記念", "新潟記念",
    "京成杯オータムH", "福島記念", "中日新聞杯", "シリウスS", "ターコイズS", "府中牝馬S",
    "チャレンジC", "ラジオNIKKEI賞",
}
GRADED_TEIRYO = {  # 定量（古馬混合GI中心）
    "フェブラリーS", "高松宮記念", "大阪杯", "天皇賞（春）", "ヴィクトリアマイル",
    "安田記念", "宝塚記念", "スプリンターズS", "天皇賞（秋）", "エリザベス女王杯",
    "マイルチャンピオンシップ", "ジャパンC", "チャンピオンズC", "有馬記念", "東京大賞典",
    "札幌記念", "阪神C",  # GII定量
}
GRADED_JUMP_TEIRYO = {"中山大障害", "中山グランドジャンプ"}

def age_only(cond):
    """単一年齢限定（2歳/3歳のみ）かどうか。"""
    c = (cond or "").replace("3（4）歳以上", "3歳以上")
    return c.startswith("2歳") or (c.startswith("3歳") and "以上" not in c)

def classify(r):
    name, cat, cond, grade = r["name"], r["category"], r["conditions"], r["grade"]
    surf = r["surface"]
    if cat == "international":
        return "定量", "high", "国際GI・定量"
    if cat == "dirt_graded":
        return ("馬齢", "high", "地方交流重賞・単一年齢限定=馬齢") if age_only(cond) \
            else ("定量", "medium", "地方交流重賞・古馬混合=定量")
    if cat == "graded":
        if surf == "障害" or grade.startswith("J-"):
            if name in GRADED_JUMP_TEIRYO:
                return "定量", "high", "障害GI=定量"
            return "別定", "medium", "障害重賞=別定（標準パターン）"
        if name in GRADED_HANDICAP:
            return "ハンデ", "high", "重賞・実条件でハンデ確認"
        if name in GRADED_TEIRYO:
            return "定量", "high", "重賞・実条件で定量確認"
        if age_only(cond):
            return "馬齢", "high", "重賞・単一年齢限定=馬齢"
        return "別定", "high", "重賞・古馬混合=別定（標準パターン）"
    if cat == "special_listed":
        if name == "オクトーバーステークス":
            return "ハンデ", "high", "番組表でハンデ確認"
        if age_only(cond):
            return "馬齢", "medium", "リステッド・単一年齢限定=馬齢"
        return "別定", "medium", "リステッド・古馬混合=別定（別定A等の標準）"
    if cat == "special_open":
        if "ハンデ" in name:
            return "ハンデ", "high", "レース名にハンデ明記"
        return "別定", "medium", "オープン特別=別定（別定A/Bの標準パターン）"
    if cat == "special_condition":
        if "ハンデ" in name:
            return "ハンデ", "high", "レース名にハンデ明記"
        if age_only(cond):
            return "馬齢", "medium", "条件特別・単一年齢限定=馬齢"
        return "ハンデ", "low", "条件特別・古馬混合=ハンデ（JRA番組パターンに基づく仮定）"
    return "定量", "low", "未分類カテゴリのため既定値"

def main():
    dom_path = os.path.join(BASE, "domestic_races.json")
    bak = os.path.join(BASE, "domestic_races_backup_pre_weight.json")
    if not os.path.exists(bak):
        shutil.copyfile(dom_path, bak)
        print("backup ->", bak)
    dom = json.load(open(dom_path))
    counts = collections.Counter()
    conf_counts = collections.Counter()
    graded_handicap, low_conf = [], []
    graded_unmatched = []
    for r in dom:
        wt, conf, why = classify(r)
        r["weight_type"] = wt
        r["weight_confidence"] = conf
        counts[wt] += 1
        conf_counts[conf] += 1
        if r["category"] in ("graded", "special_listed", "dirt_graded", "international") and wt == "ハンデ":
            graded_handicap.append(r)
        if conf == "low":
            low_conf.append(r)
        if r["category"] == "graded" and r["surface"] != "障害" and conf != "high":
            graded_unmatched.append(r["name"])
    json.dump(dom, open(dom_path, "w"), ensure_ascii=False, indent=1)
    print("domestic total", len(dom), "counts", dict(counts), "confidence", dict(conf_counts))
    print("graded flat not-high-confidence:", graded_unmatched)

    # ---------- 海外 ----------
    ov_path = os.path.join(BASE, "overseas_races_2025.json")
    bak2 = os.path.join(BASE, "overseas_races_2025_backup_pre_weight.json")
    if not os.path.exists(bak2):
        shutil.copyfile(ov_path, bak2)
        print("backup ->", bak2)
    ov = json.load(open(ov_path))

    def norm(s):
        return (s or "").replace(" ", "").replace("　", "").replace("・", "") \
            .replace("Ｓ", "S").replace("Ｈ", "H").replace("Ｇ", "G").replace("Ｃ", "C")
    # (正規化した名前断片, 国) — 著名ハンデ戦のみ
    EXC = [
        ("メルボルンカップ", "オーストラリア"), ("コーフィールドカップ", "オーストラリア"),
        ("ドンカスターH", "オーストラリア"), ("シドニーカップ", "オーストラリア"),
        ("エプソムH", "オーストラリア"), ("メトロポリタン", "オーストラリア"),
        ("ストラドブロークH", "オーストラリア"), ("ニューマーケットH", "オーストラリア"),
        ("オークレイプレート", "オーストラリア"), ("ザギャラクシー", "オーストラリア"),
        ("トゥーラックH", "オーストラリア"), ("クールモアクラシック", "オーストラリア"),
        ("レイルウェイS", "オーストラリア"), ("サールパートクラークS", "オーストラリア"),
        ("レイルウェイ", "ニュージーランド"), ("テレグラフ", "ニュージーランド"),
        ("レッドシーターフハンデキャップ", "サウジアラビア"),
    ]
    hit = collections.Counter()
    hit_names = []
    for r in ov:
        wt = "定量"
        n = norm(r["name"])
        for frag, country in EXC:
            if r["country"] == country and frag in n:
                # 米国のメトロポリタンH等、同名の非ハンデ戦を国で除外済み
                wt = "ハンデ"
                hit[(frag, country)] += 1
                hit_names.append(r)
                break
        r["weight_type"] = wt
    json.dump(ov, open(ov_path, "w"), ensure_ascii=False, indent=1)
    print("overseas total", len(ov), "exception hits:", dict(hit))
    missing = [(f, c) for f, c in EXC if hit[(f, c)] == 0]
    print("exceptions NOT found in overseas file:", missing)

    # ---------- サマリー ----------
    lines = []
    lines.append("# 負担重量区分（weight_type）洗い出し結果")
    lines.append("")
    lines.append("作成: 2026-11-13（WS2）。区分は 定量 / 別定 / ハンデ / 馬齢 の4種。")
    lines.append("各レコードには weight_type と weight_confidence（high/medium/low）を付与した。")
    lines.append("バックアップ: domestic_races_backup_pre_weight.json / overseas_races_2025_backup_pre_weight.json")
    lines.append("")
    lines.append("## 国内965件：区分ごとの件数")
    lines.append("")
    lines.append("| 区分 | 件数 |")
    lines.append("|---|---|")
    for k in ["定量", "別定", "ハンデ", "馬齢"]:
        lines.append(f"| {k} | {counts[k]} |")
    lines.append(f"| 合計 | {len(dom)} |")
    lines.append("")
    lines.append("信頼度: " + " / ".join(f"{k} {v}件" for k, v in sorted(conf_counts.items())))
    lines.append("")
    lines.append("## 重賞・リステッドのハンデ戦（全件・オーナーのスポットチェック用）")
    lines.append("")
    lines.append("| グレード | レース | 競馬場 | 条件 |")
    lines.append("|---|---|---|---|")
    for r in sorted(graded_handicap, key=lambda x: (x["grade"], x["name"])):
        lines.append(f"| {r['grade']} | {r['name']} | {r['racecourse']} | {r['conditions']} |")
    lines.append(f"\n計 {len(graded_handicap)} 件")
    lines.append("")
    lines.append("## 分類ルール（特別競走）")
    lines.append("")
    lines.append("- オープン特別（85件）: 全件、別定を標準とした（medium）。")
    lines.append("- 条件特別（631件）: 単一年齢限定は馬齢（medium）。名前に「ハンデ」を含む3件")
    lines.append("  （北海ハンデキャップ・大雪ハンデキャップ・グッドラックハンデキャップ）はハンデ（high）。古馬混合はハンデ（low）")
    lines.append("  ― JRAの命名条件特別はハンデ戦が多数派という番組パターンに基づく仮定。個別確定はしていない。")
    lines.append("- リステッド（63件）: 単一年齢限定は馬齢、古馬混合は別定（いずれも medium）。")
    lines.append("  例外: オクトーバーステークスは番組表でハンデ確認（high）。")
    lines.append("")
    lines.append("## 低信頼度（low）の分類一覧 ― 全件")
    lines.append("")
    lines.append(f"計 {len(low_conf)} 件（すべて条件特別の古馬混合＝ハンデ仮定）:")
    lines.append("")
    for r in sorted(low_conf, key=lambda x: x["name"]):
        lines.append(f"- {r['name']}（{r['grade']}・{r['racecourse']}・{r['conditions']}）")
    lines.append("")
    lines.append("## 海外（1,353件）")
    lines.append("")
    lines.append("全件デフォルト「定量」。著名ハンデ戦のみ例外として「ハンデ」を付けた（国も照合）:")
    lines.append("")
    for r in sorted(hit_names, key=lambda x: (x["country"], x["name"])):
        lines.append(f"- {r['name']}（{r['grade']}・{r['country']}・{r['racecourse']}）")
    if missing:
        lines.append("")
        lines.append("データ内に見つからなかった例外候補: " + "、".join(f"{f}（{c}）" for f, c in missing))
    open(os.path.join(BASE, "weight_types_summary.md"), "w").write("\n".join(lines) + "\n")
    print("summary written")

if __name__ == "__main__":
    main()
