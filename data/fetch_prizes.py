#!/usr/bin/env python3
"""Collect real winner's prize money from racedb 2025 race pages for the
585 overseas races shipped in the prototype. Results -> data/prize_results.json
(keyed by record index in data/overseas_races_2025.json). Resumable."""
import json, os, re, sys, time, unicodedata, urllib.request, urllib.error

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE, "overseas_races_2025.json")
RESULTS_FILE = os.path.join(BASE, "prize_results.json")
CACHE = "/tmp/prize_pages"
os.makedirs(CACHE, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

def parse_dist(r):
    txt = ((r.get("conditions_raw") or "") + " " + (r.get("distance_raw") or ""))
    m = re.search(r"(\d{3,4})\s*メートル", txt)
    if m: return int(m.group(1))
    m = re.search(r"(\d+(?:\.\d+)?)\s*ハロン", txt)
    if m: return int(round(float(m.group(1)) * 201.168 / 50.0) * 50)
    m = re.search(r"(\d+(?:\.\d+)?)\s*マイル", txt)
    if m: return int(round(float(m.group(1)) * 1609.34 / 50.0) * 50)
    return None

def fetch(url, cache_name=None):
    if cache_name:
        path = os.path.join(CACHE, cache_name)
        if os.path.exists(path) and os.path.getsize(path) > 500:
            return open(path, encoding="utf-8", errors="replace").read()
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
    html = raw.decode("utf-8", errors="replace")
    if cache_name:
        open(os.path.join(CACHE, cache_name), "w", encoding="utf-8").write(html)
    time.sleep(0.35)
    return html

def norm_name(s):
    s = unicodedata.normalize("NFKC", s or "")
    s = re.sub(r"\s+", "", s)
    return s.lower()

CUR_MAP = [
    ("ニュージーランド", "NZD"),
    ("オーストラリア", "AUD"),
    ("香港", "HKD"),
    ("カナダ", "CAD"),
    ("ディルハム", "AED"),
    ("リヤル", "SAR"),
    ("リヤード", "SAR"),
    ("ユーロ", "EUR"),
    ("ポンド", "GBP"),
    ("ドル", "USD"),
]
EXPECTED = {"アメリカ": "USD", "オーストラリア": "AUD", "ニュージーランド": "NZD",
            "イギリス": "GBP", "フランス": "EUR", "アイルランド": "EUR", "ドイツ": "EUR",
            "イタリア": "EUR", "香港": "HKD", "カナダ": "CAD",
            "アラブ首長国連邦": "AED", "サウジアラビア": "SAR"}
RATES = {"USD": 150, "EUR": 162, "GBP": 194, "AUD": 96, "NZD": 88,
         "HKD": 19, "AED": 41, "SAR": 40, "CAD": 107}

def parse_prize(html):
    """Return (amount_local, currency_code, raw_snippet) or None."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = unicodedata.normalize("NFKC", text)
    m = re.search(r"1着賞金\s*([0-9][0-9,]*\.?[0-9]*)\s*(億|万)?\s*([^\s0-9、。<]{1,16})", text)
    if not m:
        return None
    num = float(m.group(1).replace(",", ""))
    if m.group(2) == "万": num *= 10000
    elif m.group(2) == "億": num *= 100000000
    cur_text = m.group(3)
    code = None
    for key, c in CUR_MAP:
        if key in cur_text:
            code = c; break
    return (num, code, m.group(0)[:60])

def main():
    data = json.load(open(DATA_FILE, encoding="utf-8"))
    targets = [i for i, r in enumerate(data)
               if r["grade"] == "G1" or parse_dist(r) is not None]
    print(f"targets: {len(targets)}", flush=True)

    results = {}
    if os.path.exists(RESULTS_FILE):
        results = json.load(open(RESULTS_FILE, encoding="utf-8"))
        results = {int(k): v for k, v in results.items()}

    # ---- build link map from grade index pages (all grades x countries) ----
    codes = set()
    for r in data:
        su = r.get("source_url") or ""
        m = re.search(r"/g[123]-([a-z]+)\.htm", su)
        if m: codes.add(m.group(1))
    linkmap = {}  # (code, norm_name) -> url
    for code in sorted(codes):
        for g in (1, 2, 3):
            url = f"https://racedb.com/grade/2025/g{g}-{code}.htm"
            try:
                html = fetch(url, cache_name=f"idx_g{g}-{code}.htm")
            except Exception as e:
                print(f"index fetch failed {url}: {e}", flush=True); continue
            for href, txt in re.findall(r'<a href="(/k/[^"]+)"[^>]*>(.*?)</a>', html, re.S):
                t = re.sub(r"<[^>]+>", "", txt).strip()
                if t:
                    linkmap.setdefault((code, norm_name(t)), "https://racedb.com" + href)
    print(f"linkmap entries: {len(linkmap)}", flush=True)

    def code_of(r):
        m = re.search(r"/g[123]-([a-z]+)\.htm", r.get("source_url") or "")
        return m.group(1) if m else None

    todo = [i for i in targets if i not in results]
    print(f"to fetch: {len(todo)}", flush=True)
    done = 0
    for i in todo:
        r = data[i]
        url = r.get("race_page_url")
        if url:
            url = url.replace("www.racedb.com", "racedb.com")
        else:
            url = linkmap.get((code_of(r), norm_name(r["name"])))
        entry = {"name": r["name"], "grade": r["grade"], "country": r["country"], "url": url}
        if not url:
            entry["status"] = "no_page"
            results[i] = entry; continue
        fname = url.rsplit("/", 1)[-1]
        try:
            html = fetch(url, cache_name=fname)
        except Exception as e:
            entry["status"] = "http_error"; entry["error"] = str(e)[:120]
            results[i] = entry; continue
        p = parse_prize(html)
        if p is None:
            entry["status"] = "no_prize_line"
        else:
            amount, code, snippet = p
            entry["snippet"] = snippet
            if code is None:
                entry["status"] = "currency_unknown"
            else:
                entry["status"] = "ok"
                entry["prize_first_local"] = amount
                entry["prize_currency"] = code
                entry["prize_first_jpy"] = round(amount * RATES[code] / 10000)
                exp = EXPECTED.get(r["country"])
                if exp and exp != code:
                    entry["currency_note"] = f"page currency {code} != country-expected {exp}"
        results[i] = entry
        done += 1
        if done % 50 == 0:
            json.dump(results, open(RESULTS_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print(f"progress {done}/{len(todo)}", flush=True)
    json.dump(results, open(RESULTS_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    from collections import Counter
    print(Counter(v["status"] for v in results.values()), flush=True)
    print("DONE", flush=True)

if __name__ == "__main__":
    main()
