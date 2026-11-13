#!/usr/bin/env python3
# 特別レース名解説の洗い出し結果(special_enum.md)を既存マスター(domestic_races.json)と突合せする
import json, re, unicodedata, sys

BASE = "/home/hatch/workspace/keiba-game/data"

def norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = s.replace(" ", "").replace("　", "")
    # 冠・シリーズ名を除去
    for p in ["農林水産省賞典", "サマーマイルシリーズ", "サマースプリントシリーズ",
              "サマー2000シリーズ", "サマー2000", "ジャパン・オータムインターナショナル"]:
        s = s.replace(p, "")
    # スポンサー冠（〜賞/〜杯で始まる接頭辞）を、既知のものだけ除去
    s = re.sub(r"^(日刊スポーツ賞|サンケイスポーツ賞|サンケイスポーツ杯|スポーツニッポン賞|"
               r"フジテレビ賞|ローレル競馬場賞|報知杯|テレビ東京杯|東海テレビ杯|中日スポーツ賞|"
               r"北海道新聞杯|テレビ西日本賞|デルマーサラブレッドクラブ賞|ウッドバイン競馬場賞|"
               r"オーストラリアターフクラブ賞|レーシングオーストラリア賞|フランスギャロ賞|"
               r"スポーツ報知杯|ロンジン賞|KBS京都賞|MBS賞|ARF杯|IFHA杯)", "", s)
    s = s.replace("ステークス", "S")
    s = s.replace("ハンデキャップ", "H")
    s = s.replace("カップ", "C")
    s = s.replace("トロフィー", "T")
    s = s.replace("フィリーズ", "F")
    # 別名・略称の統一
    for a, b in [("優駿牝馬", "オークス"), ("東京優駿", "日本ダービー"),
                 ("東京スポーツ杯2歳S", "東スポ杯2歳S"),
                 ("アメリカジョッキークラブC", "アメリカJCC"),
                 ("弥生賞ディープインパクト記念", "弥生賞")]:
        s = s.replace(a, b)
    return s

# --- enum 読み込み ---
enum = []  # (meeting, venue, year_note, day, name_raw, grade_mark)
venue = None; meeting = None; prov2025 = False
for line in open(f"{BASE}/special_enum.md", encoding="utf-8"):
    line = line.rstrip("\n")
    m = re.match(r"## 第(\d+)回(.+?)（(2026|2025年版で代用)）", line)
    if m:
        meeting = f"第{m.group(1)}回{m.group(2)}"
        venue = m.group(2)
        prov2025 = (m.group(3) != "2026")
        continue
    m = re.match(r"第(\d+)日: (.+)$", line)
    if m and venue:
        day = int(m.group(1))
        for part in m.group(2).split(" / "):
            part = part.strip()
            note = ""
            if "【" in part:
                note = part[part.index("【"):]
                part = part[:part.index("【")].strip()
            gm = re.search(r"（(.+?)）\s*$", part)
            grade = gm.group(1) if gm else ""
            name = re.sub(r"（.+?）\s*$", "", part).strip()
            enum.append(dict(meeting=meeting, venue=venue, prov2025=prov2025,
                             day=day, name=name, grade_mark=grade, note=note))

# --- master 読み込み ---
master = json.load(open(f"{BASE}/domestic_races.json", encoding="utf-8"))
central = [r for r in master if r.get("sector") == "central"]
bykey = {}
for r in central:
    bykey.setdefault((r["racecourse"], norm(r["name"])), r)

def find_match(e):
    k = norm(e["name"])
    # 完全一致
    if (e["venue"], k) in bykey:
        return bykey[(e["venue"], k)]
    # enum名がmaster名で終わる / master名がenum名で終わる（冠の残り対策）
    for (v, mk), r in bykey.items():
        if v != e["venue"]:
            continue
        if k.endswith(mk) or mk.endswith(k):
            if min(len(k), len(mk)) >= 3:
                return r
    return None

new_list, graded_unmatched, matched = [], [], 0
for e in enum:
    hit = find_match(e)
    if hit:
        matched += 1
    elif e["grade_mark"]:
        graded_unmatched.append(e)
    else:
        new_list.append(e)

print(f"enum total: {len(enum)}  matched: {matched}  graded-unmatched: {len(graded_unmatched)}  new: {len(new_list)}")
print("\n=== 格付けありなのにマスターに無い（要確認） ===")
for e in graded_unmatched:
    print(f'{e["meeting"]} 第{e["day"]}日 {e["name"]}（{e["grade_mark"]}）{" [2025代用]" if e["prov2025"] else ""}')
json.dump(new_list, open(f"{BASE}/special_new.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\n新規候補 {len(new_list)} 件を special_new.json に保存")
from collections import Counter
print(Counter(e["venue"] for e in new_list))
