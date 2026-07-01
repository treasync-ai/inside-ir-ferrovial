#!/usr/bin/env python3
"""Convert Ferrovial's official Investor Pack (.xlsx) into JSON the app reads.

Drop the pack into data/sources/ (any *.xlsx whose name contains "investor-pack")
and run:  python3 scripts/build-pack.py
Writes: data/pack-financials.json, data/pack-assets.json, data/pack-stock.json
"""
import glob, json, os, math
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sorted(glob.glob(os.path.join(ROOT, "data", "sources", "*investor-pack*.xlsx")))
if not src:
    raise SystemExit("No investor-pack .xlsx in data/sources/")
F = src[-1]
print("Reading", os.path.basename(F))

def clean(v):
    try:
        if v is None or (isinstance(v, float) and math.isnan(v)):
            return None
        return round(float(v), 4)
    except (TypeError, ValueError):
        return None

def load(sheet):
    """Return (years[list[int]], rows[list[(label, values_aligned_to_years, raw_row_index)]])."""
    df = pd.read_excel(F, sheet_name=sheet, header=None)
    hdr_i, year_cols = None, {}
    for i in range(min(10, len(df))):
        yrs = {}
        for j in range(df.shape[1]):
            try:
                iv = int(float(df.iat[i, j]))
                if 2010 <= iv <= 2031:
                    yrs[j] = iv
            except (TypeError, ValueError):
                pass
        if len(yrs) >= 6:
            hdr_i, year_cols = i, yrs
            break
    if hdr_i is None:
        return [], []
    cols = sorted(year_cols)
    years = [year_cols[j] for j in cols]
    first_year_col = cols[0]
    rows = []
    for i in range(len(df)):
        label = None
        for j in range(first_year_col):
            v = df.iat[i, j]
            if isinstance(v, str) and v.strip():
                label = v.strip(); break
        vals = [clean(df.iat[i, j]) for j in cols]
        rows.append((label, vals, i))
    return years, rows

def find(rows, substr, start=0):
    s = substr.lower()
    for k in range(start, len(rows)):
        if rows[k][0] and s in rows[k][0].lower():
            return rows[k][1], k
    return None, -1

def series(rows, substr, start=0):
    v, _ = find(rows, substr, start)
    return v

def zipy(years, vals):
    return [{"year": y, "v": vals[i] if vals and i < len(vals) else None} for i, y in enumerate(years)]

# ---------------- FINANCIALS ----------------
yi, ri = load("Consolidated Income Statement")
fin = {"years": yi,
       "revenue": series(ri, "Revenue"),
       "adjEbitda": series(ri, "Adjusted EBITDA"),
       "adjEbit": series(ri, "Adjusted EBIT"),
       "operatingProfit": series(ri, "Operating profit"),
       "netAttrib": series(ri, "attributed to the"),
       "division": {}}
# division block (after "Main Figures by Division")
_, div_i = find(ri, "Main Figures by Division")
for name in ["Highways", "Airports", "Construction", "Services", "Energy"]:
    fin["division"][name.lower()] = series(ri, name, div_i if div_i > 0 else 0)

yn, rn = load("Consolidated Net debt")
nd = {"years": yn,
      "exInfra": series(rn, "net debt of ex-"),
      "projects": series(rn, "net debt of inf"),
      "consolidated": None, "buckets": {}}
# consolidated total net debt (row labelled exactly "Consolidated net debt*")
for lab, vals, _ in rn:
    if lab and lab.lower().startswith("consolidated net debt"):
        nd["consolidated"] = vals
# section blocks: a row whose label marks a section then %fixed / avg rate / avg maturity follow
section = None
for k, (lab, vals, _) in enumerate(rn):
    if lab and "ex-infrastructure project" in lab.lower():
        section = "exInfra"
    elif lab and "infrastructure project compa" in lab.lower():
        section = "projects"
    elif lab and lab.strip().lower() == "consolidated":
        section = "consolidated"
    if section and lab:
        ll = lab.lower()
        if "% fixed" in ll: nd["buckets"].setdefault(section, {})["fixed"] = vals
        elif "average rate" in ll: nd["buckets"].setdefault(section, {})["rate"] = vals
        elif "average maturity" in ll: nd["buckets"].setdefault(section, {})["maturity"] = vals

# debt maturity schedule — read raw rows (values sit outside the year columns)
maturities = []
dfnd = pd.read_excel(F, sheet_name="Consolidated Net debt", header=None)
for i in range(len(dfnd)):
    c1 = dfnd.iat[i, 1] if dfnd.shape[1] > 1 else None
    if isinstance(c1, str) and "debt matur" in c1.lower():
        for j in range(i + 1, min(i + 9, len(dfnd))):
            lab = dfnd.iat[j, 1]
            if isinstance(lab, str):
                key = lab.strip().rstrip("*")
            elif isinstance(lab, (int, float)) and not (isinstance(lab, float) and math.isnan(lab)):
                key = str(int(lab))
            else:
                key = ""
            if key.isdigit() or key.startswith(">"):
                row = list(dfnd.iloc[j])[2:]  # skip the label/year columns
                amt = next((v for v in reversed(row) if isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v))), None)
                if amt is not None:
                    maturities.append({"year": key, "amount": round(float(amt), 2)})
            elif key == "" and maturities:
                break
        break
nd["maturities"] = maturities

json.dump({"currency": "EUR", "unit": "EUR million", "income": fin, "netDebt": nd},
          open(os.path.join(ROOT, "data", "pack-financials.json"), "w"), ensure_ascii=False)
print("financials: revenue2025", fin["revenue"][-1] if fin["revenue"] else None,
      "| exInfra netdebt2025", nd["exInfra"][-1] if nd["exInfra"] else None)

# ---------------- ASSETS ----------------
y4, r4 = load("ETR 407")
_, pnl4 = find(r4, "P&L")  # revenue lives in the P&L block, below "Avg Revenue per trip"
etr = {"currency": "CAD", "years": y4,
       "trips": series(r4, "Traffic/trips"), "vkt": series(r4, "VKTs"),
       "avgTrip": series(r4, "Avg trip length"), "revPerTrip": series(r4, "Avg Revenue per trip"),
       "revenue": series(r4, "Revenue", pnl4 if pnl4 > 0 else 0), "ebitda": series(r4, "EBITDA"),
       "netIncome": series(r4, "Net Income"), "contribution": series(r4, "Contribution to Ferrov"),
       "dividends": series(r4, "Dividends"), "netDebt": series(r4, "Net Debt")}

yl, rl = load("US Managed Lanes")
def ml_asset(name):
    # per-asset P&L block = the asset-name row whose NEXT labelled row is "Revenue"
    for k in range(len(rl)):
        lab = rl[k][0]
        if lab and lab.strip() == name:
            nxt = rl[k + 1][0] if k + 1 < len(rl) else ""
            if nxt and "revenue" in nxt.lower():
                return {"revenue": series(rl, "Revenue", k), "ebitda": series(rl, "Adjusted EBITDA", k),
                        "contribution": series(rl, "Contribution to Ferrov", k)}
    return {}
_, traf_i = find(rl, "Traffic (million")
_, rpt_i = find(rl, "Revenue per Transaction")
lanes = {"currency": "USD", "years": yl, "assets": {}}
for a in ["NTE", "LBJ", "NTE 35W", "I-77", "I-66"]:
    lanes["assets"][a] = {"traffic": series(rl, a, traf_i), "revPerTx": series(rl, a, rpt_i), **ml_asset(a)}

yd, rd = load("Dalaman & NTO (JFK)")
dalaman = {"currency": "EUR", "years": yd, "pax": series(rd, "Total Dalaman"),
           "revenue": series(rd, "Revenue"), "ebitda": series(rd, "Adjusted EBITDA"),
           "contribution": series(rd, "Contribution to Ferrov"), "netDebt": series(rd, "Net Debt")}

yc, rc = load("Construction")
_, bud_i = find(rc, "Budimex")
_, web_i = find(rc, "Webber")
constr = {"currency": "EUR", "years": yc,
          "revenue": series(rc, "Revenue"), "adjEbitda": series(rc, "Adjusted EBITDA"),
          "adjEbit": series(rc, "Adjusted EBIT"), "orderBook": series(rc, "Order book"),
          "budimex": {"revenue": series(rc, "Revenue", bud_i), "ebitda": series(rc, "Adjusted EBITDA", bud_i), "orderBook": series(rc, "Order book", bud_i)},
          "webber": {"revenue": series(rc, "Revenue", web_i), "ebitda": series(rc, "Adjusted EBITDA", web_i)}}

ye, re_ = load("Energy")
energy = {"currency": "EUR", "years": ye, "revenue": series(re_, "Revenue"), "adjEbitda": series(re_, "Adjusted EBITDA")}

ya, ra = load("Airports")
airports = {"currency": "EUR", "years": ya, "revenue": series(ra, "Revenue"), "adjEbitda": series(ra, "Adjusted EBITDA")}

json.dump({"etr407": etr, "managedLanes": lanes, "dalaman": dalaman,
           "construction": constr, "energy": energy, "airports": airports},
          open(os.path.join(ROOT, "data", "pack-assets.json"), "w"), ensure_ascii=False)
print("etr407 rev2025", etr["revenue"][-1] if etr["revenue"] else None,
      "| lanes NTE ebitda2025", lanes["assets"]["NTE"].get("ebitda", [None])[-1])

# ---------------- STOCK ----------------
ys, rs = load("Historical Stock Data")
_, es_i = find(rs, "Ferrovial SM")
_, us_i = find(rs, "Ferrovial US")
stock = {"years": ys,
         "madrid": {"close": series(rs, "Close", es_i), "cap": series(rs, "Capitalization", es_i)},
         "nasdaq": {"close": series(rs, "Close", us_i), "cap": series(rs, "Capitalization", us_i)},
         "dividendsDeclared": series(rs, "Dividends declared")}
json.dump(stock, open(os.path.join(ROOT, "data", "pack-stock.json"), "w"), ensure_ascii=False)
print("stock madrid close2025", stock["madrid"]["close"][-1] if stock["madrid"]["close"] else None)
print("Done.")
