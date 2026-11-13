#!/usr/bin/env python3
"""Build prototype/index.html from template.html + data files in ../data/."""
import json, re, math, datetime, os

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "..", "data")

tpl = open(os.path.join(BASE, "template.html")).read()
dom = json.load(open(os.path.join(DATA, "domestic_races.json")))
ov = json.load(open(os.path.join(DATA, "overseas_races_2025.json")))
st = json.load(open(os.path.join(DATA, "stallions_draft.json")))

def wom_from_day(d):
    return min(4, math.ceil(d / 7))

dom_out = []
for r in dom:
    dt = datetime.date.fromisoformat(r["date"])
    cond = r["conditions"].replace("3（4）歳以上", "3歳以上")
    dom_out.append({
        "name": r["name"], "grade": r["grade"], "sector": r["sector"], "category": r["category"],
        "racecourse": r["racecourse"], "surface": r["surface"], "distance_m": r["distance_m"],
        "conditions": cond, "month": dt.month, "wom": wom_from_day(dt.day),
    })

def parse_dist(r):
    txt = ((r.get("conditions_raw") or "") + " " + (r.get("distance_raw") or ""))
    m = re.search(r"(\d{3,4})\s*メートル", txt)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d+(?:\.\d+)?)\s*ハロン", txt)
    if m:
        return int(round(float(m.group(1)) * 201.168 / 50.0) * 50)
    m = re.search(r"(\d+(?:\.\d+)?)\s*マイル", txt)
    if m:
        return int(round(float(m.group(1)) * 1609.34 / 50.0) * 50)
    return None

def parse_cond(r):
    raw = (r.get("conditions_raw") or "")
    if re.search(r"４歳以上|4歳以上|Four year old and upward", raw):
        age = "4歳以上"
    elif re.search(r"３歳以上|3歳以上|Three year old and upward", raw):
        age = "3歳以上"
    elif re.search(r"Two year old and upward", raw):
        age = ""
    elif re.search(r"2歳|Two year", raw):
        age = "2歳"
    elif re.search(r"３歳|3歳|Three year old", raw):
        age = "3歳"
    else:
        age = "3歳以上"
    sex = "牝" if re.search(r"牝|fillies|mares", raw, re.I) else ""
    return (age + sex) if (age or sex) else "3歳以上"

ov_out = []
for r in ov:
    # G1は全件、G2/G3は距離が入っているもの（WP10収録分）だけをゲームに載せる
    if r["grade"] != "G1" and parse_dist(r) is None:
        continue
    ov_out.append({
        # 海外のグレード表記（G1等）は国内表記（GI等）に統一する。賞金・相手強さ・重賞勝ち判定などが
        # すべて国内表記前提のため、ここで揃えないと海外重賞が全部「格なし」扱いになる。
        "name": r["name"], "grade": {"G1": "GI", "G2": "GII", "G3": "GIII"}.get(r["grade"], r["grade"]),
        "sector": "overseas", "category": "graded", "country": r["country"],
        "racecourse": (r["racecourse"] or "") + "（" + r["country"] + "）", "surface": r["surface"],
        "distance_m": parse_dist(r), "conditions": parse_cond(r),
        "prize_first": r.get("prize_first_jpy"),
        "month": r["month"], "wom": min(4, r["week_of_month"]),
    })

data = {"domestic": dom_out, "overseas": ov_out, "stallions": st["stallions"]}
blob = "const DATA = " + json.dumps(data, ensure_ascii=False) + ";"
html = tpl.replace("/*__DATA__*/", blob)
out = os.path.join(BASE, "index.html")
open(out, "w").write(html)
print("domestic", len(dom_out), "overseasG1", len(ov_out),
      "withDist", sum(1 for r in ov_out if r["distance_m"]), "stallions", len(st["stallions"]))
print("index.html bytes", len(html))
