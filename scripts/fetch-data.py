#!/usr/bin/env python3
"""Data fetcher — runs in GitHub Actions (Azure runners).

Uses yfinance, which talks to Yahoo through curl_cffi (a real Chrome TLS
fingerprint), so it is not served the 429 bot-wall that a plain fetch/requests
gets from Vercel or from raw HTTP. Writes static JSON snapshots to data/live/*.json
that the Vercel-hosted frontend reads directly. No API keys.
"""
import json, os, math, time, datetime as dt
import pandas as pd
import yfinance as yf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "live")
os.makedirs(OUT, exist_ok=True)
NOW = dt.datetime.now(dt.timezone.utc).isoformat()

LISTINGS = [
    {"key": "US", "symbol": "FER",    "market": "Nasdaq",             "currency": "USD", "flag": "\U0001F1FA\U0001F1F8"},
    {"key": "ES", "symbol": "FER.MC", "market": "BME (Madrid)",       "currency": "EUR", "flag": "\U0001F1EA\U0001F1F8"},
    {"key": "NL", "symbol": "FER.AS", "market": "Euronext Amsterdam", "currency": "EUR", "flag": "\U0001F1F3\U0001F1F1"},
]
PRIMARY = "FER.MC"
PEERS = [
    {"symbol": "FER.MC",  "name": "Ferrovial",  "currency": "EUR", "type": "Concessions / Construction", "self": True},
    {"symbol": "DG.PA",   "name": "Vinci",      "currency": "EUR", "type": "Concessions / Construction"},
    {"symbol": "FGR.PA",  "name": "Eiffage",    "currency": "EUR", "type": "Concessions / Construction"},
    {"symbol": "ACS.MC",  "name": "ACS",        "currency": "EUR", "type": "Construction / Services"},
    {"symbol": "SCYR.MC", "name": "Sacyr",      "currency": "EUR", "type": "Concessions / Construction"},
    {"symbol": "TCL.AX",  "name": "Transurban", "currency": "AUD", "type": "Toll roads (pure-play)"},
    {"symbol": "AENA.MC", "name": "Aena",       "currency": "EUR", "type": "Airports"},
]
SHARES = {"FER": 729555372, "FER.MC": 729555372, "FER.AS": 729555372,
          "DG.PA": 580000000, "FGR.PA": 95000000, "ACS.MC": 255000000,
          "SCYR.MC": 720000000, "TCL.AX": 3085000000, "AENA.MC": 150000000}
PEER_MULTIPLES = {
    "FER.MC": {"pe": 50, "evEbitda": 31, "dividendYield": 1.0, "ebitdaMargin": 15},
    "DG.PA": {"pe": 13, "evEbitda": 7, "dividendYield": 4.2, "ebitdaMargin": 18},
    "FGR.PA": {"pe": 9, "evEbitda": 7, "dividendYield": 4.0, "ebitdaMargin": 16},
    "ACS.MC": {"pe": 13, "evEbitda": 8, "dividendYield": 5.0, "ebitdaMargin": 7},
    "SCYR.MC": {"pe": 15, "evEbitda": 9, "dividendYield": 5.0, "ebitdaMargin": 20},
    "TCL.AX": {"pe": 60, "evEbitda": 22, "dividendYield": 5.0, "ebitdaMargin": 70},
    "AENA.MC": {"pe": 17, "evEbitda": 12, "dividendYield": 4.2, "ebitdaMargin": 60},
}

def num(v):
    try:
        if v is None: return None
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    except (TypeError, ValueError):
        return None

def write(name, obj):
    obj["generatedAt"] = NOW
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(obj, f, default=lambda o: None)
    print("  wrote", name)

def returns_from(closes):
    if closes is None or closes.empty: return {}
    last = float(closes.iloc[-1]); now = closes.index[-1]
    def at(days):
        s = closes[closes.index <= now - pd.Timedelta(days=days)]
        return float(s.iloc[-1]) if not s.empty else None
    def pct(frm):
        return None if (frm is None or frm == 0) else (last - frm) / frm * 100
    ystart = pd.Timestamp(year=now.year, month=1, day=1, tz=now.tz)
    cy = closes[closes.index >= ystart]
    ytd_base = float(cy.iloc[0]) if not cy.empty else float(closes.iloc[0])
    prev = float(closes.iloc[-2]) if len(closes) > 1 else None
    return {"last": last, "asOf": now.isoformat(), "1d": pct(prev), "1w": pct(at(7)),
            "1m": pct(at(30)), "3m": pct(at(91)), "6m": pct(at(182)),
            "ytd": pct(ytd_base), "1y": pct(at(365)), "5y": pct(float(closes.iloc[0]))}

def rsi(series, n=14):
    d = series.diff()
    up = d.clip(lower=0).rolling(n).mean()
    down = (-d.clip(upper=0)).rolling(n).mean()
    rs = up / down.replace(0, float("nan"))
    return (100 - 100 / (1 + rs)).fillna(100)

def fin_get(df, *labels):
    """Pull a row from a yfinance statement DataFrame by trying several labels."""
    if df is None or df.empty: return {}
    out = {}
    for lab in labels:
        if lab in df.index:
            for col in df.columns:
                out[str(col.date()) if hasattr(col, "date") else str(col)] = num(df.loc[lab, col])
            return out
    return {}

def build_financials(t):
    def rows_for(income, balance, cash):
        periods = {}
        def merge(field, src):
            for d, v in src.items():
                periods.setdefault(d, {"period": d, "year": int(d[:4])})[field] = v
        merge("revenue", fin_get(income, "Total Revenue", "Operating Revenue"))
        merge("grossProfit", fin_get(income, "Gross Profit"))
        merge("ebitda", fin_get(income, "EBITDA", "Normalized EBITDA"))
        merge("ebit", fin_get(income, "EBIT", "Operating Income"))
        merge("netIncome", fin_get(income, "Net Income", "Net Income Common Stockholders"))
        merge("dilutedEPS", fin_get(income, "Diluted EPS", "Basic EPS"))
        merge("totalAssets", fin_get(balance, "Total Assets"))
        merge("totalDebt", fin_get(balance, "Total Debt"))
        merge("cash", fin_get(balance, "Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments"))
        merge("equity", fin_get(balance, "Stockholders Equity", "Common Stock Equity"))
        merge("operatingCF", fin_get(cash, "Operating Cash Flow", "Cash Flow From Continuing Operating Activities"))
        merge("capex", fin_get(cash, "Capital Expenditure"))
        merge("freeCashFlow", fin_get(cash, "Free Cash Flow"))
        rows = []
        for d in sorted(periods):
            o = periods[d]
            rev, eb, ni = o.get("revenue"), o.get("ebitda"), o.get("netIncome")
            o["ebitdaMargin"] = (eb / rev * 100) if (eb and rev) else None
            o["netMargin"] = (ni / rev * 100) if (ni and rev) else None
            if o.get("freeCashFlow") is None and o.get("operatingCF") is not None and o.get("capex") is not None:
                o["freeCashFlow"] = o["operatingCF"] + o["capex"]
            td, csh = o.get("totalDebt"), o.get("cash")
            o["netDebt"] = (td - csh) if (td is not None and csh is not None) else None
            rows.append(o)
        return rows
    annual = rows_for(t.income_stmt, t.balance_sheet, t.cashflow)
    quarterly = rows_for(t.quarterly_income_stmt, t.quarterly_balance_sheet, t.quarterly_cashflow)
    return annual, quarterly

def build_analysts():
    for sym in ["FER.MC", "FER"]:
        try:
            t = yf.Ticker(sym)
            rec = t.recommendations
            if rec is None or rec.empty:
                continue
            row = rec.iloc[0]  # period "0m" = current
            dist = {k: int(row[k]) for k in ["strongBuy", "buy", "hold", "sell", "strongSell"]}
            total = sum(dist.values())
            if total == 0:
                continue
            score = (dist["strongBuy"] + dist["buy"] * 2 + dist["hold"] * 3 + dist["sell"] * 4 + dist["strongSell"] * 5) / total
            label = ("Strong Buy" if score <= 1.5 else "Buy" if score <= 2.5 else "Hold" if score <= 3.5 else "Sell" if score <= 4.5 else "Strong Sell")
            pt = t.analyst_price_targets or {}
            cur, mean = num(pt.get("current")), num(pt.get("mean"))
            upside = ((mean - cur) / cur * 100) if (mean and cur) else None
            actions, seen = [], set()
            try:
                u = t.upgrades_downgrades
                if u is not None and not u.empty:
                    for idx, r in u.iterrows():
                        firm = str(r.get("Firm") or "").strip()
                        if not firm or firm in seen:
                            continue
                        seen.add(firm)
                        actions.append({"firm": firm, "grade": str(r.get("ToGrade") or ""), "fromGrade": str(r.get("FromGrade") or ""),
                                        "action": str(r.get("Action") or ""),
                                        "date": idx.date().isoformat() if hasattr(idx, "date") else str(idx),
                                        "target": num(r.get("currentPriceTarget"))})
                        if len(actions) >= 25:
                            break
            except Exception:
                pass
            ccy = "EUR" if sym.endswith(".MC") else "USD"
            print("  analysts", sym, "→", total, "analysts,", label)
            return {"symbol": sym, "currency": ccy, "distribution": dist, "total": total,
                    "consensusScore": score, "consensusLabel": label,
                    "priceTarget": {"current": cur, "low": num(pt.get("low")), "mean": mean,
                                    "high": num(pt.get("high")), "median": num(pt.get("median")),
                                    "currency": ccy, "upsidePct": upside},
                    "actions": actions}
        except Exception as e:
            print("  analysts", sym, "ERR", e)
    return {"distribution": None}

def build_dividends(sym="FER.MC"):
    try:
        d = yf.Ticker(sym).dividends
        if d is None or d.empty:
            return {"symbol": sym, "currency": "EUR", "payments": [], "byYear": []}
        payments = [{"date": idx.date().isoformat(), "amount": num(v)} for idx, v in d.items()]
        by = {}
        for p in payments:
            y = int(p["date"][:4]); by[y] = by.get(y, 0) + (p["amount"] or 0)
        by_year = [{"year": y, "total": by[y]} for y in sorted(by)]
        cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=365)).date().isoformat()
        ttm = sum((p["amount"] or 0) for p in payments if p["date"] >= cutoff)
        last = payments[-1] if payments else {}
        print("  dividends", sym, "→", len(payments), "payments, ttm", round(ttm, 4))
        return {"symbol": sym, "currency": "EUR", "payments": payments[-24:], "byYear": by_year,
                "ttm": ttm, "lastAmount": last.get("amount"), "lastDate": last.get("date")}
    except Exception as e:
        print("  dividends ERR", e)
        return {"symbol": sym, "currency": "EUR", "payments": [], "byYear": []}

def main():
    print("Fetching Ferrovial data via yfinance…")
    blocks = {}
    for l in LISTINGS:
        sym = l["symbol"]
        try:
            t = yf.Ticker(sym)
            hist = t.history(period="5y", interval="1d", auto_adjust=False)
            if hist.empty:
                time.sleep(4); hist = t.history(period="5y", interval="1d", auto_adjust=False)
            if hist.empty: raise RuntimeError("empty history")
            closes = hist["Close"].dropna()
            if closes.empty: raise RuntimeError("no valid closes")
            fi = {}
            try: fi = dict(t.fast_info)
            except Exception: fi = {}
            last_idx = closes.index[-1]
            last_bar = hist.loc[last_idx]
            price = num(fi.get("last_price")) or num(closes.iloc[-1])
            prev = num(fi.get("previous_close")) or (num(closes.iloc[-2]) if len(closes) > 1 else None)
            shares = SHARES.get(sym)
            mcap = num(fi.get("market_cap")) or ((price * shares) if (price and shares) else None)
            w52h = num(fi.get("year_high")); w52l = num(fi.get("year_low"))
            quote = {
                "key": l["key"], "symbol": sym, "market": l["market"], "currency": fi.get("currency") or l["currency"],
                "flag": l["flag"], "name": "Ferrovial", "price": price, "prevClose": prev,
                "open": num(last_bar["Open"]), "dayHigh": num(last_bar["High"]), "dayLow": num(last_bar["Low"]),
                "volume": num(last_bar["Volume"]), "marketCap": mcap,
                "change": (price - prev) if (price and prev) else None,
                "changePercent": ((price - prev) / prev * 100) if (price and prev) else None,
                "week52High": w52h, "week52Low": w52l, "exchange": l["market"], "marketState": None,
            }
            # history series + returns + ytd dividends
            series5y = [{"t": idx.isoformat(), "c": num(v)} for idx, v in closes.items()]
            rets = returns_from(closes)
            year = dt.datetime.now(dt.timezone.utc).year
            divs = t.dividends
            ytd_divs = []
            if divs is not None and not divs.empty:
                ytd_divs = [{"date": idx.date().isoformat(), "amount": num(v)} for idx, v in divs.items() if idx.year == year]
            ytd_cash = sum(d["amount"] for d in ytd_divs if d["amount"]) if ytd_divs else 0
            cy = closes[closes.index >= pd.Timestamp(year=year, month=1, day=1, tz=closes.index[-1].tz)]
            ystart = float(cy.iloc[0]) if not cy.empty else float(closes.iloc[0])
            div_ret = (ytd_cash / ystart * 100) if (ystart and ytd_cash) else 0
            intraday = []
            try:
                idf = t.history(period="1d", interval="5m")
                intraday = [{"t": idx.isoformat(), "c": num(v)} for idx, v in idf["Close"].dropna().items()]
            except Exception: pass
            # technicals
            sma20 = closes.rolling(20).mean(); sma50 = closes.rolling(50).mean(); sma200 = closes.rolling(200).mean()
            r = rsi(closes)
            price_t = float(closes.iloc[-1])
            s50 = num(sma50.iloc[-1]); s200 = num(sma200.iloc[-1]); rsi14 = num(r.iloc[-1])
            trend = ("Uptrend (50d > 200d)" if (s50 and s200 and s50 > s200) else "Downtrend (50d < 200d)") if (s50 and s200) else None
            rsi_state = (None if rsi14 is None else "Overbought" if rsi14 >= 70 else "Oversold" if rsi14 <= 30 else "Neutral")
            tech_series = []
            for idx in closes.index[-300:]:
                tech_series.append({"t": idx.date().isoformat(), "c": num(closes[idx]),
                                    "sma20": num(sma20.get(idx)), "sma50": num(sma50.get(idx)),
                                    "sma200": num(sma200.get(idx)), "rsi": num(r.get(idx))})
            blocks[sym] = {
                "quote": quote,
                "history": {"symbol": sym, "currency": quote["currency"], "series5y": series5y, "intraday": intraday,
                            "returns": rets, "ytd": {"priceReturn": rets.get("ytd"), "dividendReturn": div_ret,
                            "totalReturn": (rets.get("ytd") or 0) + div_ret, "dividendsPaid": ytd_cash}, "dividends": ytd_divs},
                "technicals": {"symbol": sym, "currency": quote["currency"],
                               "indicators": {"price": price_t, "sma20": num(sma20.iloc[-1]), "sma50": s50, "sma200": s200,
                               "ema20": num(closes.ewm(span=20).mean().iloc[-1]), "ema50": num(closes.ewm(span=50).mean().iloc[-1]),
                               "rsi14": rsi14, "trend": trend, "rsiState": rsi_state,
                               "vsSma200": ((price_t - s200) / s200 * 100) if s200 else None}, "series": tech_series},
                "closes": closes, "w52h": w52h, "w52l": w52l,
            }
            print("  listing", sym, "→", price)
        except Exception as e:
            print("  listing", sym, "FAILED:", e)
        time.sleep(1.5)

    # quotes.json + momentum sentiment
    sentiment = None
    pb = blocks.get(PRIMARY)
    if pb is not None:
        c = pb["closes"]; last = float(c.iloc[-1])
        def ago(b): return float(c.iloc[-1 - b]) if len(c) > b else float(c.iloc[0])
        r1m = (last / ago(21) - 1) * 100; r3m = (last / ago(63) - 1) * 100
        hi, lo = pb["w52h"], pb["w52l"]
        pos = (last - lo) / (hi - lo) if (hi and lo and hi > lo) else 0.5
        clamp = lambda v, a, b: max(a, min(b, v))
        index = round(max(0, min(100, 50 + clamp(r3m, -20, 20) / 20 * 25 + clamp(r1m, -10, 10) / 10 * 15 + (pos - 0.5) * 20)))
        label = ("Bullish" if index >= 70 else "Moderately bullish" if index >= 58 else "Neutral" if index >= 42
                 else "Moderately bearish" if index >= 30 else "Bearish")
        sentiment = {"index": index, "label": label, "basis": "momentum", "r1m": r1m, "r3m": r3m, "pos52": pos * 100}
    listings_out = [blocks[l["symbol"]]["quote"] if l["symbol"] in blocks else
                    {"key": l["key"], "symbol": l["symbol"], "market": l["market"], "currency": l["currency"],
                     "flag": l["flag"], "name": "Ferrovial", "price": None} for l in LISTINGS]
    write("quotes.json", {"listings": listings_out, "sentiment": sentiment})
    for l in LISTINGS:
        b = blocks.get(l["symbol"])
        if b:
            write(f"history-{l['symbol']}.json", b["history"])
            write(f"technicals-{l['symbol']}.json", b["technicals"])

    # financials
    try:
        annual, quarterly = build_financials(yf.Ticker(PRIMARY))
        write("financials.json", {"symbol": PRIMARY, "currency": "EUR", "annual": annual, "quarterly": quarterly})
    except Exception as e:
        print("  financials FAILED:", e); write("financials.json", {"annual": [], "quarterly": []})

    # peers
    rows = []
    for p in PEERS:
        row = {"symbol": p["symbol"], "name": p["name"], "type": p["type"], "self": p.get("self", False),
               "currency": p["currency"], **PEER_MULTIPLES.get(p["symbol"], {}), "indicativeMultiples": True}
        try:
            t = yf.Ticker(p["symbol"])
            h = t.history(period="1y", interval="1wk")["Close"].dropna()
            fi = dict(t.fast_info)
            price = num(fi.get("last_price")) or (num(h.iloc[-1]) if not h.empty else None)
            row["currency"] = fi.get("currency") or p["currency"]
            row["price"] = price
            row["changePercent"] = None
            sh = SHARES.get(p["symbol"])
            row["marketCap"] = num(fi.get("market_cap")) or ((price * sh) if (price and sh) else None)
            row["ret1y"] = ((price - float(h.iloc[0])) / float(h.iloc[0]) * 100) if (price and not h.empty) else None
            try:
                info = t.info
                if info.get("trailingPE"): row["pe"] = num(info["trailingPE"])
                if info.get("enterpriseToEbitda"): row["evEbitda"] = num(info["enterpriseToEbitda"]); row["indicativeMultiples"] = False
                if info.get("dividendYield"): row["dividendYield"] = num(info["dividendYield"])
            except Exception: pass
            print("  peer", p["symbol"], "→", price)
        except Exception as e:
            print("  peer", p["symbol"], "FAILED:", e)
        rows.append(row)
    write("peers.json", {"rows": rows})

    # analyst coverage + dividends
    write("analysts.json", build_analysts())
    time.sleep(0.5)
    write("dividends.json", build_dividends("FER.MC"))

    # news
    try:
        items, seen = [], set()
        for q in ["FER.MC", "FER"]:
            try: raw = yf.Ticker(q).news or []
            except Exception: raw = []
            for n in raw:
                c = n.get("content", n)
                title = c.get("title") or n.get("title")
                url = (c.get("clickThroughUrl") or c.get("canonicalUrl") or {}).get("url") if isinstance(c.get("clickThroughUrl") or c.get("canonicalUrl"), dict) else n.get("link")
                if not title or not url: continue
                k = title.lower()[:50]
                if k in seen: continue
                seen.add(k)
                pub = (c.get("provider") or {}).get("displayName") if isinstance(c.get("provider"), dict) else n.get("publisher")
                pd_ = c.get("pubDate") or n.get("providerPublishTime")
                published = pd_ if isinstance(pd_, str) else (dt.datetime.fromtimestamp(pd_, dt.timezone.utc).isoformat() if pd_ else None)
                thumb = (c.get("thumbnail") or {}).get("originalUrl") if isinstance(c.get("thumbnail"), dict) else None
                items.append({"title": title, "url": url, "source": pub, "publishedAt": published, "image": thumb, "provider": "Yahoo Finance"})
        items.sort(key=lambda x: x["publishedAt"] or "", reverse=True)
        write("news.json", {"items": items[:40], "sources": ["Yahoo Finance"]})
    except Exception as e:
        print("  news FAILED:", e); write("news.json", {"items": [], "sources": []})

    print("Done.")

if __name__ == "__main__":
    main()
