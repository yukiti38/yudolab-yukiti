#!/usr/bin/env python3
"""Integrate collected racedb 2025 winner's-prize data into overseas_races_2025.json.

Reads prize_batches/batch_NN.json (race lists) + result_NN.txt (TSV: name, amount|なし, currency label)
(+ optional result_retry.txt supplementing batches 8 and 21), matches each batch entry to a
master record in the prototype target set (G1 all + G2/G3 with a parseable distance, same rule
as prototype/build.py), converts to JPY at fixed rates, and writes prize fields.

Usage: python3 integrate_prizes.py [--apply]   (default: dry-run report only)
"""
import json, os, re, sys, shutil
from collections import defaultdict

DATA = os.path.dirname(os.path.abspath(__file__))
BATCH_DIR = os.path.join(DATA, "prize_batches")
APPLY = "--apply" in sys.argv

FX = {"USD": 150, "EUR": 162, "GBP": 194, "AUD": 96, "NZD": 88,
      "HKD": 19, "AED": 41, "SAR": 40, "CAD": 107}
LABEL2CODE = {
    "オーストラリアドル": "AUD", "ニュージーランドドル": "NZD", "NZドル": "NZD",
    "香港ドル": "HKD", "カナダドル": "CAD", "ユーロ": "EUR", "ポンド": "GBP",
    "ディルハム": "AED", "リヤル": "SAR",
}
DOLLAR_BY_COUNTRY = {  # bare 「ドル」 label resolved by the race's country
    "アメリカ": "USD", "サウジアラビア": "USD", "アラブ首長国連邦": "USD",
    "オーストラリア": "AUD", "カナダ": "CAD", "ニュージーランド": "NZD", "香港": "HKD",
}

def parse_dist(r):
    txt = ((r.get("conditions_raw") or "") + " " + (r.get("distance_raw") or ""))
    m = re.search(r"(\d{3,4})\s*メートル", txt)
    if m: return int(m.group(1))
    m = re.search(r"(\d+(?:\.\d+)?)\s*ハロン", txt)
    if m: return int(round(float(m.group(1)) * 201.168 / 50.0) * 50)
    m = re.search(r"(\d+(?:\.\d+)?)\s*マイル", txt)
    if m: return int(round(float(m.group(1)) * 1609.34 / 50.0) * 50)
    return None

def load_results(path):
    out = {}
    if not os.path.exists(path):
        return out
    for line in open(path, encoding="utf-8"):
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 2 or not parts[0]:
            continue
        name, amount = parts[0], parts[1]
        ccy = parts[2] if len(parts) > 2 else ""
        out.setdefault(name, []).append((amount, ccy))
    return out

master = json.load(open(os.path.join(DATA, "overseas_races_2025.json")))
targets = [r for r in master if r["grade"] == "G1" or parse_dist(r) is not None]
print(f"master {len(master)} records; prototype target set: {len(targets)}")

# index target records for matching
by_url = {}
by_key = defaultdict(list)
for r in targets:
    if r.get("race_page_url"):
        by_url.setdefault(r["race_page_url"], []).append(r)
    by_key[(r["name"], r["grade"], r["country"])].append(r)
for k in by_key:
    by_key[k].sort(key=lambda r: (r.get("month") or 0, r.get("date_2025") or ""))

retry = load_results(os.path.join(BATCH_DIR, "result_retry.txt"))
claimed = {}   # id(record) -> (amount_str, ccy_label, batch_no)
problems = []
stats = {"found": 0, "missing": 0}
currency_anomalies = []

batch_files = sorted(f for f in os.listdir(BATCH_DIR) if re.fullmatch(r"batch_\d+\.json", f))
for bf in batch_files:
    bno = int(re.search(r"\d+", bf).group())
    batch = json.load(open(os.path.join(BATCH_DIR, bf)))
    results = load_results(os.path.join(BATCH_DIR, f"result_{bno:02d}.txt"))
    # result lines consumed in order per name (a name may repeat within a batch)
    consumed = defaultdict(int)
    def take(name):
        lst = results.get(name, [])
        i = consumed[name]
        if i < len(lst):
            consumed[name] += 1
            return lst[i]
        if lst:  # same race listed twice in the batch but reported once: reuse the line
            return lst[-1]
        return None
    for entry in batch["races"]:
        name, grade, country = entry["name"], entry["grade"], entry["country"]
        res = take(name)
        if res is None and name in retry:  # retry supplements batches 8 / 21
            res = retry[name][0]
        if res is None:
            problems.append(f"batch {bno}: no result line for {name}")
            continue
        amount, ccy = res
        if amount == "なし" and name in retry:
            amount, ccy = retry[name][0]
        # find the master record(s)
        recs = []
        if batch["kind"] == "direct" and entry.get("url"):
            recs = [r for r in by_url.get(entry["url"], []) if id(r) not in claimed]
            if not recs:
                recs = [r for r in by_key.get((name, grade, country), []) if id(r) not in claimed]
        else:
            recs = [r for r in by_key.get((name, grade, country), []) if id(r) not in claimed]
        if not recs:
            problems.append(f"batch {bno}: no unclaimed master record for {name} ({grade}/{country})")
            continue
        rec = recs[0]  # by_key lists are month-sorted: earliest unclaimed edition first
        claimed[id(rec)] = (amount, ccy, bno, rec)

print(f"claimed records: {len(claimed)} / {len(targets)}")
unclaimed = [r for r in targets if id(r) not in claimed]
for r in unclaimed:
    problems.append(f"UNCLAIMED target: {r['name']} ({r['grade']}/{r['country']}/month {r.get('month')})")

updates = {}
for rid, (amount, ccy_label, bno, rec) in claimed.items():
    if amount == "なし":
        stats["missing"] += 1
        continue
    try:
        local = int(amount)
    except ValueError:
        problems.append(f"batch {bno}: non-numeric amount {amount!r} for {rec['name']}")
        continue
    if ccy_label == "ドル":
        code = DOLLAR_BY_COUNTRY.get(rec["country"])
        if code is None:
            problems.append(f"batch {bno}: bare ドル with unknown country {rec['country']} ({rec['name']})")
            continue
    else:
        code = LABEL2CODE.get(ccy_label)
        if code is None:
            problems.append(f"batch {bno}: unknown currency label {ccy_label!r} ({rec['name']})")
            continue
    expected = {"アメリカ": "USD", "フランス": "EUR", "ドイツ": "EUR", "アイルランド": "EUR",
                "イギリス": "GBP", "オーストラリア": "AUD", "ニュージーランド": "NZD",
                "香港": "HKD", "カナダ": "CAD", "サウジアラビア": "USD"}.get(rec["country"])
    if expected and code != expected and not (rec["country"] == "アラブ首長国連邦" and code in ("USD", "AED")):
        currency_anomalies.append(f"{rec['name']} ({rec['country']}): label {ccy_label} -> {code}, expected {expected}")
    jpy_man = round(local * FX[code] / 10000)
    updates[rid] = {"prize_first_local": local, "prize_currency": code,
                    "prize_first_jpy": jpy_man, "prize_source": "racedb_2025",
                    "_name": rec["name"]}
    stats["found"] += 1

print(f"prizes found: {stats['found']}, missing (なし): {stats['missing']}")
print(f"currency anomalies: {len(currency_anomalies)}")
for a in currency_anomalies: print("  ANOMALY:", a)
print(f"problems: {len(problems)}")
for p in problems: print("  PROBLEM:", p)

top = sorted(updates.values(), key=lambda u: -u["prize_first_jpy"])[:10]
print("top prizes (万円):", [(u["_name"], u["prize_first_jpy"]) for u in top])
for probe in ("サウジカップ", "テレグラフ", "ドバイワールドカップ", "凱旋門賞", "香港カップ"):
    hit = [u for u in updates.values() if u["_name"] == probe]
    print(f"  spot {probe}: {[(u['prize_first_local'], u['prize_currency'], u['prize_first_jpy']) for u in hit]}")

if APPLY:
    backup = os.path.join(DATA, "overseas_races_2025_backup_pre_prize.json")
    if not os.path.exists(backup):
        shutil.copyfile(os.path.join(DATA, "overseas_races_2025.json"), backup)
        print("backup written:", backup)
    by_id = {id(r): r for r in master}
    for rid, u in updates.items():
        rec = by_id[rid]
        for k in ("prize_first_local", "prize_currency", "prize_first_jpy", "prize_source"):
            rec[k] = u[k]
    with open(os.path.join(DATA, "overseas_races_2025.json"), "w", encoding="utf-8") as f:
        json.dump(master, f, ensure_ascii=False, indent=1)
    print(f"APPLIED: {len(updates)} records updated")
else:
    print("dry-run only (pass --apply to write)")
