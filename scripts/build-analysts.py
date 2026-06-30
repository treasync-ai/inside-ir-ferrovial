#!/usr/bin/env python3
"""Convert Ferrovial's official analyst-coverage spreadsheet into JSON.

Drop the latest export from Ferrovial IR into data/sources/ (any *.xlsx whose
name contains "analyst") and run:  python3 scripts/build-analysts.py
It writes data/analysts-coverage.json, which the Analysts page reads.
"""
import glob, json, os, statistics
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_files = sorted(glob.glob(os.path.join(ROOT, "data", "sources", "*analyst*.xlsx")))
if not src_files:
    raise SystemExit("No analyst .xlsx found in data/sources/")
SRC = src_files[-1]
print("Reading", os.path.basename(SRC))

df = pd.read_excel(SRC, sheet_name=0)
cols = {c.lower().strip(): c for c in df.columns}
def col(*names):
    for n in names:
        if n in cols: return cols[n]
    return None
c_ent, c_an = col("entity", "broker", "firm"), col("analyst")
c_rec, c_tp = col("recommendation", "rating"), col("target price", "target", "price target")
c_dt = col("date")

def bucket(rec):
    g = (rec or "").lower()
    if any(x in g for x in ["outperform", "buy", "overweight", "add", "accumulate", "positive"]):
        return "buy"
    if any(x in g for x in ["underperform", "sell", "underweight", "reduce", "negative"]):
        return "sell"
    return "hold"

rows = []
for _, r in df.iterrows():
    ent = str(r[c_ent]).strip() if c_ent else ""
    if not ent or ent.lower() == "nan":
        continue
    try:
        tp = float(r[c_tp]) if (c_tp and pd.notna(r[c_tp])) else None
    except (ValueError, TypeError):
        tp = None
    date = ""
    if c_dt and pd.notna(r[c_dt]):
        date = str(r[c_dt]).replace("/", "-")[:10]
    rec = str(r[c_rec]).strip() if c_rec else ""
    rows.append({"entity": ent, "analyst": (str(r[c_an]).strip() if c_an and pd.notna(r[c_an]) else ""),
                 "recommendation": rec, "bucket": bucket(rec), "target": tp, "date": date})

buy = sum(1 for x in rows if x["bucket"] == "buy")
hold = sum(1 for x in rows if x["bucket"] == "hold")
sell = sum(1 for x in rows if x["bucket"] == "sell")
targets = [x["target"] for x in rows if x["target"]]
mean = round(sum(targets) / len(targets), 2) if targets else None
median = round(statistics.median(targets), 2) if targets else None
hi = max(targets) if targets else None
lo = min(targets) if targets else None
hi_firm = next((x["entity"] for x in rows if x["target"] == hi), None)
lo_firm = next((x["entity"] for x in rows if x["target"] == lo), None)
score = (buy * 1 + hold * 2 + sell * 3) / len(rows) if rows else 2
label = "Buy" if score <= 1.6 else "Hold" if score <= 2.4 else "Sell"
as_of = max((x["date"] for x in rows if x["date"]), default="")

# sort: Outperform group first, then Hold, then Underperform; within, by target desc
order = {"buy": 0, "hold": 1, "sell": 2}
rows.sort(key=lambda x: (order[x["bucket"]], -(x["target"] or 0)))

out = {
    "source": "Ferrovial Investor Relations — analyst coverage",
    "asOf": as_of, "currency": "EUR", "analysts": rows,
    "summary": {"total": len(rows), "distribution": {"buy": buy, "hold": hold, "sell": sell},
                "consensusLabel": label,
                "target": {"mean": mean, "median": median, "high": hi, "highFirm": hi_firm, "low": lo, "lowFirm": lo_firm}},
}
dest = os.path.join(ROOT, "data", "analysts-coverage.json")
with open(dest, "w") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(f"Wrote {dest}: {len(rows)} analysts · {buy} buy / {hold} hold / {sell} sell · mean target {mean}")
