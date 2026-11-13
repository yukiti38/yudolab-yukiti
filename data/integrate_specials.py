#!/usr/bin/env python3
# 中央・非リステッド特別競走の調査結果(details_*.txt)を国内マスターへ統合する
# 使い方: python3 integrate_specials.py          … ドライラン(報告のみ)
#         python3 integrate_specials.py --write  … domestic_races.jsonへ追記
import json, re, sys, glob, unicodedata, datetime, collections

BASE = "/home/hatch/workspace/keiba-game/data"
WRITE = "--write" in sys.argv

# ---------- 名前正規化(dedupe_specials.pyのnormを拡張) ----------
def norm(s, loose=False):
    s = unicodedata.normalize("NFKC", s)
    s = s.replace(" ", "").replace("　", "")
    for p in ["農林水産省賞典", "サマーマイルシリーズ", "サマースプリントシリーズ",
              "サマー2000シリーズ", "サマー2000", "ジャパン・オータムインターナショナル"]:
        s = s.replace(p, "")
    s = re.sub(r"^(日刊スポーツ賞|サンケイスポーツ賞|サンケイスポーツ杯|スポーツニッポン賞|"
               r"フジテレビ賞|ローレル競馬場賞|報知杯|テレビ東京杯|東海テレビ杯|中日スポーツ賞|"
               r"北海道新聞杯|テレビ西日本賞|デルマーサラブレッドクラブ賞|ウッドバイン競馬場賞|"
               r"オーストラリアターフクラブ賞|レーシングオーストラリア賞|フランスギャロ賞|"
               r"スポーツ報知杯|ロンジン賞|KBS京都賞|MBS賞|ARF杯|IFHA杯)", "", s)
    s = s.replace("ステークス", "S").replace("ハンデキャップ", "H")
    s = s.replace("カップ", "C").replace("トロフィー", "T").replace("フィリーズ", "F")
    for a, b in [("優駿牝馬", "オークス"), ("東京優駿", "日本ダービー"),
                 ("東京スポーツ杯2歳S", "東スポ杯2歳S"),
                 ("アメリカジョッキークラブC", "アメリカJCC"),
                 ("弥生賞ディープインパクト記念", "弥生賞")]:
        s = s.replace(a, b)
    if loose:
        s = s.replace("ー", "").replace("・", "").replace("ヶ", "ケ")
        for a, b in [("ァ", "ア"), ("ィ", "イ"), ("ゥ", "ウ"), ("ェ", "エ"), ("ォ", "オ"),
                     ("ャ", "ヤ"), ("ュ", "ユ"), ("ョ", "ヨ"), ("ッ", "ツ")]:
            s = s.replace(a, b)
    return s

VENUES = ["札幌", "函館", "福島", "新潟", "東京", "中山", "中京", "京都", "阪神", "小倉"]

# ---------- 入力 ----------
master = json.load(open(f"{BASE}/domestic_races.json", encoding="utf-8"))
candidates = json.load(open(f"{BASE}/special_new.json", encoding="utf-8"))

# enum(全件: 開催マップ種用)
enum = []
venue = None; kai = None; prov = False
for line in open(f"{BASE}/special_enum.md", encoding="utf-8"):
    line = line.rstrip("\n")
    m = re.match(r"## 第(\d+)回(.+?)（(2026|2025年版で代用)）", line)
    if m:
        kai, venue = int(m.group(1)), m.group(2); prov = (m.group(3) != "2026")
        continue
    m = re.match(r"第(\d+)日: (.+)$", line)
    if m and venue:
        for part in m.group(2).split(" / "):
            part = re.sub(r"（.+?）\s*$", "", part.strip()).strip()
            part = part.split("【")[0].strip()
            if part:
                enum.append(dict(kai=kai, venue=venue, day=int(m.group(1)), name=part, prov2025=prov))

# details 行
rows = []
for path in sorted(glob.glob(f"{BASE}/details_*.txt")):
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or " | " not in line:
            continue
        parts = [p.strip() for p in line.split(" | ")]
        if parts[1] == "見つからず":
            rows.append(dict(name=parts[0], found=False))
            continue
        name, date_raw, code, sd, cls, cond = parts[:6]
        note = ""
        m = re.search(r"【(.*)】", cond)
        if m:
            note = m.group(1); cond = cond.replace(m.group(0), "").strip()
        dm = re.match(r"(\d{4})-(\d{2})-(\d{2})", date_raw)
        cm = re.match(r"(\d+)(.+?)(\d+)$", code)
        sm = re.match(r"(芝|ダ|障芝|障)(\d+)$", sd)
        rows.append(dict(name=name, found=True,
                         date=datetime.date(int(dm.group(1)), int(dm.group(2)), int(dm.group(3))),
                         year=int(dm.group(1)),
                         kai=int(cm.group(1)), venue=cm.group(2), day=int(cm.group(3)),
                         surface={"芝": "芝", "ダ": "ダート", "障": "障害", "障芝": "障害"}[sm.group(1)],
                         dist=int(sm.group(2)), cls=cls, cond=cond, note=note))
found_rows = [r for r in rows if r["found"]]
print(f"details行: {len(rows)} (見つからず {sum(1 for r in rows if not r['found'])})")

# ---------- 開催日マップ ----------
HOLIDAY_MON = {datetime.date(2026, 1, 12), datetime.date(2026, 7, 20), datetime.date(2026, 9, 21),
               datetime.date(2026, 10, 12), datetime.date(2026, 11, 23)}
def is_race_day(d):
    return d.weekday() in (5, 6) or d in HOLIDAY_MON

maps = collections.defaultdict(dict)
def put(kai, venue, day, date, force=False):
    cur = maps[(kai, venue)].get(day)
    if cur and cur != date and not force:
        print(f"  [map conflict] {kai}{venue} D{day}: {cur} vs {date}")
    maps[(kai, venue)][day] = date

for r in found_rows:
    if r["year"] == 2026:
        put(r["kai"], r["venue"], r["day"], r["date"])
master_by_key = {}
for r in master:
    master_by_key.setdefault((r["racecourse"], norm(r["name"], loose=True)), r)
for e in enum:
    mr = master_by_key.get((e["venue"], norm(e["name"], loose=True)))
    if mr and not e["prov2025"]:
        put(e["kai"], e["venue"], e["day"], datetime.date.fromisoformat(mr["date"]))
PROV_DEC = {(5, "中山"), (5, "阪神"), (5, "中京")}
for r in found_rows:
    if r["year"] == 2025 and (r["kai"], r["venue"]) in PROV_DEC:
        put(r["kai"], r["venue"], r["day"], r["date"] + datetime.timedelta(days=364), force=True)

def fill_map(kai, venue, want_days):
    known = dict(maps.get((kai, venue), {}))
    out = {d: (dt, False) for d, dt in known.items()}
    if not known:
        return out
    days_sorted = sorted(known)
    def race_days_between(a, b):
        res = []
        d = a + datetime.timedelta(days=1)
        while d < b:
            if is_race_day(d):
                res.append(d)
            d += datetime.timedelta(days=1)
        return res
    for want in want_days:
        if want in out:
            continue
        prev = max([d for d in days_sorted if d < want], default=None)
        nxt = min([d for d in days_sorted if d > want], default=None)
        est = None
        if prev is not None and nxt is not None:
            cands = race_days_between(known[prev], known[nxt])
            need = nxt - prev - 1
            if len(cands) >= need and need > 0:
                est = cands[want - prev - 1]
            else:
                span = (known[nxt] - known[prev]).days
                est = known[prev] + datetime.timedelta(days=round(span * (want - prev) / (nxt - prev)))
        elif prev is not None:
            seq = []
            d = known[prev]; dd = prev
            while dd < want:
                d += datetime.timedelta(days=1)
                if is_race_day(d):
                    dd += 1; seq.append(d)
            est = seq[-1] if seq else None
        elif nxt is not None:
            seq = []
            d = known[nxt]; dd = nxt
            while dd > want:
                d -= datetime.timedelta(days=1)
                if is_race_day(d):
                    dd -= 1; seq.append(d)
            est = seq[-1] if seq else None
        if est:
            out[want] = (est, True)
    return out

# ---------- 突合せ ----------
EXCLUDE = {"レジェンドジョッキーカップ", "レジェンドトレーナーカップ"}
by_loose = collections.defaultdict(list)
for r in found_rows:
    by_loose[(r["venue"], norm(r["name"], loose=True))].append(r)

def parse_meeting(m):
    mm = re.match(r"第(\d+)回(.+)$", m)
    return int(mm.group(1)), mm.group(2)

new_records = []
unmatched, skipped_dup, excluded = [], [], []
used_rows = set()
for c in candidates:
    kai, venue = parse_meeting(c["meeting"])
    name = c["name"]
    if name in EXCLUDE:
        excluded.append(name); continue
    ALIAS = {"シトリン": "シトリンステークス",
             "ジャパンカップ 2025年ロンジンワールドベストレース受賞記念": "JCベストレース記念"}
    cands = by_loose.get((venue, norm(ALIAS.get(name, name), loose=True)), [])
    if not cands:
        unmatched.append(f"{c['meeting']} D{c['day']} {name}")
        continue
    def score(r):
        return (r["kai"] == kai, r["day"] == c["day"], r["year"] == 2026)
    cands = sorted(cands, key=score, reverse=True)
    row = cands[0]
    if (kai, venue) == (4, "中京"):
        alt2026 = [r for r in cands if r["year"] == 2026 and r["kai"] == 3]
        if alt2026:
            skipped_dup.append(f"{name} (2026年第3回中京で施行済み)")
            continue
    used_rows.add(id(row))
    estimated = False
    if (kai, venue) in PROV_DEC and row["year"] == 2025:
        date = row["date"] + datetime.timedelta(days=364)
        edition = 2025; source = "netkeiba_db_2025_provisional"
    elif (kai, venue) == (4, "中京"):
        mp = fill_map(3, "中京", [c["day"]])
        if c["day"] not in mp:
            unmatched.append(f"{c['meeting']} D{c['day']} {name} (第3回中京マップに日付なし)")
            continue
        date, estimated = mp[c["day"]]
        edition = row["year"]; source = "netkeiba_db_2025_provisional"
    elif row["year"] == 2026:
        date = row["date"]; edition = 2026; source = "netkeiba_db_2026"
    else:
        mp = fill_map(kai, venue, [c["day"]])
        if c["day"] not in mp:
            unmatched.append(f"{c['meeting']} D{c['day']} {name} (開催マップに日付なし)")
            continue
        date, estimated = mp[c["day"]]
        edition = row["year"]; source = f"netkeiba_db_ref{edition}"
    cond = row["cond"]
    filly = "牝馬限定" in cond
    cond = cond.replace("・牝馬限定", "").replace("牝馬限定", "")
    cond = cond.replace("障害", "")
    cond = re.sub(r"（.*?）", "", cond).strip()
    if filly:
        cond += "牝"
    grade = {"OP": "OP", "3勝": "3勝クラス", "2勝": "2勝クラス", "1勝": "1勝クラス",
             "未勝利": "未勝利", "新馬": "新馬"}.get(row["cls"])
    if grade is None:
        unmatched.append(f"{c['meeting']} D{c['day']} {name} (不明クラス {row['cls']})")
        continue
    rec = dict(name=row["name"], grade=grade, sector="central",
               category="special_open" if grade == "OP" else "special_condition",
               racecourse=venue, surface=row["surface"], distance_m=row["dist"],
               conditions=cond, date=date.isoformat(), source=source)
    if edition != 2026:
        rec["edition_year"] = edition
    if estimated:
        rec["date_estimated"] = True
    if row["note"]:
        rec["detail_note"] = row["note"]
    new_records.append(rec)

master_keys = {(norm(r["name"], loose=True), r["racecourse"], r["date"][:7]) for r in master}
final, dup_master = [], []
seen = set()
for rec in new_records:
    k = (norm(rec["name"], loose=True), rec["racecourse"], rec["date"][:7])
    if k in master_keys:
        dup_master.append(rec["name"]); continue
    if k in seen:
        dup_master.append(rec["name"] + "(新規内で重複)"); continue
    seen.add(k); final.append(rec)

print(f"\n候補 {len(candidates)} / 新規レコード {len(final)}")
print(f"未突合 {len(unmatched)}:")
for u in unmatched: print("  ?", u)
print(f"重複除外 {len(skipped_dup)}: {skipped_dup}")
print(f"マスター重複 {len(dup_master)}: {dup_master}")
print(f"意図的除外: {excluded}")
unused = [r for r in found_rows if id(r) not in used_rows]
print(f"未使用details行 {len(unused)}:")
for r in unused: print(f"  - {r['name']} {r['date']} {r['kai']}{r['venue']}{r['day']}")
print(f"\n内訳: OP {sum(1 for r in final if r['grade']=='OP')} / 3勝 {sum(1 for r in final if r['grade']=='3勝クラス')} / 2勝 {sum(1 for r in final if r['grade']=='2勝クラス')} / 1勝 {sum(1 for r in final if r['grade']=='1勝クラス')} / その他 {sum(1 for r in final if r['grade'] not in ('OP','3勝クラス','2勝クラス','1勝クラス'))} / 障害 {sum(1 for r in final if r['surface']=='障害')}")
print(f"出典: {collections.Counter(r['source'] for r in final)}")
print(f"推定日: {sum(1 for r in final if r.get('date_estimated'))}件")
print("条件値:", collections.Counter(r["conditions"] for r in final))

json.dump(final, open("/tmp/new_records.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
if WRITE:
    master.extend(final)
    master.sort(key=lambda r: (r["date"], r["racecourse"], r["name"]))
    json.dump(master, open(f"{BASE}/domestic_races.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"\nWROTE domestic_races.json: {len(master)} records")
else:
    print("\n(dry run: --write で書き込み)")
