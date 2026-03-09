import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

interface ParsedStats {
  metrics: Record<string, string>;
  eoyReturns: { year: number; returnPct: number; cumulative: string }[];
  drawdowns: { started: string; recovered: string; drawdown: number; days: number }[];
  dateRange: string;
  equity: { date: string; value: number }[];
  drawdownChart: { date: string; value: number }[];
}

function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

const STRATEGY_CSV: Record<string, string> = {
  basket50: "Basket_50.csv",
  basket70: "Basket_70.csv",
  basket70tf: "Basket_70_TF.csv",
  quantumalpha: "iqsf_daily.csv",
};

const statsCache: Record<string, { data: ParsedStats; time: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000;

async function fetchQuantumAlphaStats(): Promise<ParsedStats> {
  const credentials = Buffer.from("report:_-3xT!jaTtNfi_iB").toString("base64");
  const authHeaders = { Authorization: `Basic ${credentials}`, "User-Agent": "Mozilla/5.0" };

  const [equityRes, ddRes, csvRes] = await Promise.all([
    fetch("https://drive.fund-iq.com/daily/basket/iqsf_equity.json", { headers: authHeaders }),
    fetch("https://drive.fund-iq.com/daily/basket/iqsf_drawdown.json", { headers: authHeaders }),
    fetch("https://stat.tenets.pro/iqsf_daily.csv"),
  ]);

  if (!equityRes.ok) throw new Error(`Failed to fetch iqsf_equity.json: ${equityRes.status}`);
  const equityData = await equityRes.json() as Record<string, number>;

  const entries = Object.entries(equityData)
    .map(([dateStr, val]) => ({ date: dateStr.substring(0, 10), value: val as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const equity = entries.map(e => ({ date: e.date, value: parseFloat(e.value.toFixed(4)) }));

  let drawdownChart: { date: string; value: number }[] = [];
  if (ddRes.ok) {
    const ddData = await ddRes.json() as Record<string, number>;
    drawdownChart = Object.entries(ddData)
      .map(([dateStr, val]) => ({ date: dateStr.substring(0, 10), value: parseFloat((val as number).toFixed(4)) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  let dailyRetsPct: number[] = [];
  let dailyDates: string[] = [];
  if (csvRes.ok) {
    const csvText = await csvRes.text();
    const csvLines = csvText.trim().split("\n").slice(1);
    for (const line of csvLines) {
      const [date, ret] = line.split(",");
      if (date && ret) {
        dailyDates.push(date.trim());
        dailyRetsPct.push(parseFloat(ret.trim()));
      }
    }
  } else {
    dailyRetsPct = entries.map((e, i) => i === 0 ? e.value : e.value - entries[i - 1].value);
    dailyDates = entries.map(e => e.date);
  }

  const dailyPnl = dailyDates.map((date, i) => ({
    date,
    value: parseFloat(dailyRetsPct[i].toFixed(4)),
  }));

  const compMonthMap = new Map<string, number>();
  for (let i = 0; i < dailyDates.length; i++) {
    const ym = dailyDates[i].substring(0, 7);
    if (!compMonthMap.has(ym)) compMonthMap.set(ym, 1.0);
    compMonthMap.set(ym, compMonthMap.get(ym)! * (1 + dailyRetsPct[i] / 100));
  }
  const monthlyGrid = [...compMonthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, v]) => ({ ym, ret: parseFloat(((v - 1) * 100).toFixed(4)) }));

  const n = dailyRetsPct.length;
  const lastVal = entries[entries.length - 1].value;
  const firstDate = new Date(entries[0].date);
  const lastDate = new Date(entries[entries.length - 1].date);
  const years = (lastDate.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

  let compVal = 1.0, compPeak = 1.0, maxDD = 0.0;
  for (const r of dailyRetsPct) {
    compVal *= (1 + r / 100);
    if (compVal > compPeak) compPeak = compVal;
    const dd = (compVal - compPeak) / compPeak;
    if (dd < maxDD) maxDD = dd;
  }
  if (drawdownChart.length === 0) {
    let cv = 1.0, cp = 1.0;
    drawdownChart = dailyDates.map((date, i) => {
      cv *= (1 + dailyRetsPct[i] / 100);
      if (cv > cp) cp = cv;
      return { date, value: parseFloat((((cv - cp) / cp) * 100).toFixed(4)) };
    });
  }

  const compCagr = years > 0 ? (Math.pow(compVal, 1 / years) - 1) * 100 : 0;
  const additiveCagr = years > 0 ? (Math.pow(1 + lastVal / 100, 1 / years) - 1) * 100 : 0;

  const ANN = 252;
  const mean = dailyRetsPct.reduce((a, b) => a + b, 0) / n;
  const variance = dailyRetsPct.reduce((a, r) => a + (r - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const annVol = stdDev * Math.sqrt(ANN);

  const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(ANN) : 0;
  const downArr = dailyRetsPct.map(r => Math.min(r, 0));
  const downSqMean = downArr.reduce((s, v) => s + v * v, 0) / n;
  const downStd = Math.sqrt(downSqMean);
  const sortino = downStd > 0 ? (mean / downStd) * Math.sqrt(ANN) : 0;

  const calmar = Math.abs(maxDD) > 0 ? (compCagr / 100) / Math.abs(maxDD) : 0;

  const winDays = dailyRetsPct.filter(v => v > 0).length;
  const lossDays = dailyRetsPct.filter(v => v < 0).length;

  const monthlyRets = monthlyGrid.map(mg => mg.ret);
  const upMonths = monthlyRets.filter(v => v > 0);
  const downMonthsArr = monthlyRets.filter(v => v < 0);

  const quarterMap = new Map<string, number>();
  for (const mg of monthlyGrid) {
    const [y, mo] = mg.ym.split("-");
    const q = `${y}-Q${Math.ceil(parseInt(mo) / 3)}`;
    quarterMap.set(q, (quarterMap.get(q) || 0) + mg.ret);
  }
  const quarterRets = Array.from(quarterMap.values());

  const addYearMap = new Map<string, number>();
  const compYearMap = new Map<string, number>();
  for (let i = 0; i < dailyDates.length; i++) {
    const y = dailyDates[i].substring(0, 4);
    if (!addYearMap.has(y)) { addYearMap.set(y, 0); compYearMap.set(y, 1.0); }
    addYearMap.set(y, addYearMap.get(y)! + dailyRetsPct[i]);
    compYearMap.set(y, compYearMap.get(y)! * (1 + dailyRetsPct[i] / 100));
  }
  const yearRets = [...addYearMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([y, v]) => ({
    year: parseInt(y),
    ret: v,
    compRet: (compYearMap.get(y)! - 1) * 100,
  }));

  const gains = dailyRetsPct.filter(r => r > 0).reduce((s, v) => s + v, 0);
  const lossesAbs = Math.abs(dailyRetsPct.filter(r => r < 0).reduce((s, v) => s + v, 0));

  const avgWin = gains / (winDays || 1);
  const avgLoss = lossesAbs / (lossDays || 1);
  const winRate = winDays / n;
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
  const kelly = avgLoss > 0 ? (winRate - (1 - winRate) / payoffRatio) * 100 : 0;

  const profitFactor = lossesAbs > 0 ? gains / lossesAbs : 0;
  const totalSum = dailyRetsPct.reduce((s, v) => s + v, 0);
  const gainPainRatio = lossesAbs > 0 ? totalSum / lossesAbs : 0;

  const m3 = dailyRetsPct.reduce((s, v) => s + (v - mean) ** 3, 0) / n;
  const m4 = dailyRetsPct.reduce((s, v) => s + (v - mean) ** 4, 0) / n;
  const skew = stdDev > 0 ? m3 / (stdDev ** 3) : 0;
  const kurtosis = stdDev > 0 ? m4 / (stdDev ** 4) : 0;

  let maxConsWins = 0, maxConsLosses = 0, cw = 0, cl = 0;
  for (const v of dailyRetsPct) {
    if (v > 0) { cw++; cl = 0; maxConsWins = Math.max(maxConsWins, cw); }
    else if (v < 0) { cl++; cw = 0; maxConsLosses = Math.max(maxConsLosses, cl); }
  }

  const ddValues = drawdownChart.map(d => d.value);
  const minDD = Math.min(...ddValues);
  let longestDDDays = 0, ddStart = 0;
  for (let i = 0; i < ddValues.length; i++) {
    if (ddValues[i] === 0) { ddStart = i; }
    else { longestDDDays = Math.max(longestDDDays, i - ddStart); }
  }

  const ddPeriods: number[] = [];
  let ddPeriodStart = -1;
  for (let i = 0; i < ddValues.length; i++) {
    if (ddValues[i] < 0 && ddPeriodStart === -1) ddPeriodStart = i;
    if (ddValues[i] === 0 && ddPeriodStart !== -1) { ddPeriods.push(i - ddPeriodStart); ddPeriodStart = -1; }
  }
  if (ddPeriodStart !== -1) ddPeriods.push(ddValues.length - 1 - ddPeriodStart);
  const avgDDDays = ddPeriods.length > 0 ? Math.round(ddPeriods.reduce((s, v) => s + v, 0) / ddPeriods.length) : 0;
  const negDD = ddValues.filter(v => v < 0);
  const avgDD = negDD.length > 0 ? negDD.reduce((s, v) => s + v, 0) / negDD.length : 0;

  const sorted = [...dailyRetsPct].sort((a, b) => a - b);
  const varIdx = Math.floor(0.05 * n);
  const varParam = mean - 1.6449 * stdDev;
  const cvarHist = sorted.slice(0, varIdx + 1);
  const cvarVal = cvarHist.length > 0 ? cvarHist.reduce((s, v) => s + v, 0) / cvarHist.length : 0;

  const annualizedReturn = lastVal / years;
  const recoveryFactor = Math.abs(maxDD * 100) > 0 ? annualizedReturn / Math.abs(maxDD * 100) : 0;

  const p95 = sorted[Math.floor(0.95 * n)];
  const p05 = sorted[Math.floor(0.05 * n)];
  const tailRatio = Math.abs(p05) > 0 ? Math.abs(p95 / p05) : 0;
  const commonSenseRatio = tailRatio * profitFactor;

  const omega = lossesAbs > 0 ? (1 + gains / lossesAbs) : 0;

  const q95wins = sorted.slice(Math.floor(0.95 * n));
  const q05losses = sorted.slice(0, Math.floor(0.05 * n) + 1);
  const avgReturn = mean;
  const outlierWinRatio = q95wins.length > 0 && Math.abs(avgReturn) > 1e-10 ? (q95wins.reduce((s, v) => s + v, 0) / q95wins.length) / Math.abs(avgReturn) : 0;
  const outlierLossRatio = q05losses.length > 0 && Math.abs(avgReturn) > 1e-10 ? Math.abs(q05losses.reduce((s, v) => s + v, 0) / q05losses.length) / Math.abs(avgReturn) : 0;

  const sqDD = ddValues.map(v => v * v);
  const ulcerIndex = Math.sqrt(sqDD.reduce((s, v) => s + v, 0) / ddValues.length) / 100;
  const serenityIndex = ulcerIndex > 0 ? (totalSum / 100) / ulcerIndex / years : 0;

  const cpcIndex = profitFactor * payoffRatio * winRate;

  const smartSharpe = stdDev > 0 ? sharpe * (1 - skew / (4 * sharpe) + (kurtosis - 3) / (8 * sharpe * sharpe)) ** (-1) : 0;
  const smartSortino = downStd > 0 ? sortino * (1 - skew / (4 * sortino) + (kurtosis - 3) / (8 * sortino * sortino)) ** (-1) : 0;

  const metricMap: Record<string, string> = {};
  metricMap["Cumulative Return"] = lastVal.toFixed(2) + "%";
  metricMap["CAGR"] = additiveCagr.toFixed(2) + "%";
  metricMap["Volatility (ann.)"] = annVol.toFixed(2) + "%";
  metricMap["Sharpe"] = sharpe.toFixed(2);
  const srStar = 0;
  const srDiff = sharpe - srStar;
  const denom = Math.sqrt((1 - skew * sharpe + ((kurtosis - 1) / 4) * sharpe * sharpe) / (n - 1));
  const probSharpeZ = denom > 0 ? srDiff / denom : 0;
  const probSharpe = 0.5 * (1 + erf(probSharpeZ / Math.sqrt(2)));
  metricMap["Prob. Sharpe Ratio"] = (probSharpe * 100).toFixed(1) + "%";
  metricMap["Smart Sharpe"] = smartSharpe.toFixed(2);
  metricMap["Sortino"] = sortino.toFixed(2);
  metricMap["Smart Sortino"] = smartSortino.toFixed(2);
  metricMap["Sortino/√2"] = (sortino / Math.sqrt(2)).toFixed(2);
  metricMap["Smart Sortino/√2"] = (smartSortino / Math.sqrt(2)).toFixed(2);
  metricMap["Max Drawdown"] = (maxDD * 100).toFixed(2) + "%";
  metricMap["Longest DD Days"] = longestDDDays.toString();
  metricMap["Calmar"] = calmar.toFixed(2);
  metricMap["Skew"] = skew.toFixed(2);
  metricMap["Kurtosis"] = kurtosis.toFixed(2);
  metricMap["Expected Daily"] = mean.toFixed(2) + "%";
  metricMap["Expected Monthly"] = (mean * 21).toFixed(2) + "%";
  metricMap["Expected Yearly"] = (mean * ANN).toFixed(2) + "%";
  metricMap["Kelly Criterion"] = kelly.toFixed(2) + "%";
  metricMap["Risk of Ruin"] = "0.0%";
  metricMap["Daily Value-at-Risk"] = varParam.toFixed(2) + "%";
  metricMap["Expected Shortfall (cVaR)"] = cvarVal.toFixed(2) + "%";
  metricMap["Max Consecutive Wins"] = maxConsWins.toString();
  metricMap["Max Consecutive Losses"] = maxConsLosses.toString();
  metricMap["Gain/Pain Ratio"] = gainPainRatio.toFixed(2);
  metricMap["Payoff Ratio"] = payoffRatio.toFixed(2);
  metricMap["Profit Factor"] = profitFactor.toFixed(2);
  metricMap["Common Sense Ratio"] = commonSenseRatio.toFixed(2);
  metricMap["CPC Index"] = cpcIndex.toFixed(2);
  metricMap["Tail Ratio"] = tailRatio.toFixed(2);
  metricMap["Outlier Win Ratio"] = outlierWinRatio.toFixed(1);
  metricMap["Outlier Loss Ratio"] = outlierLossRatio.toFixed(2);
  metricMap["Omega"] = omega.toFixed(2);

  metricMap["Best Day"] = "+" + Math.max(...dailyRetsPct).toFixed(2) + "%";
  metricMap["Worst Day"] = Math.min(...dailyRetsPct).toFixed(2) + "%";
  metricMap["Best Month"] = "+" + Math.max(...monthlyRets).toFixed(2) + "%";
  metricMap["Worst Month"] = Math.min(...monthlyRets).toFixed(2) + "%";
  metricMap["Best Year"] = "+" + Math.max(...yearRets.map(y => y.ret)).toFixed(2) + "%";
  metricMap["Worst Year"] = (Math.min(...yearRets.map(y => y.ret)) >= 0 ? "+" : "") + Math.min(...yearRets.map(y => y.ret)).toFixed(2) + "%";

  metricMap["Avg. Up Month"] = upMonths.length > 0 ? "+" + (upMonths.reduce((s, v) => s + v, 0) / upMonths.length).toFixed(2) + "%" : "---";
  metricMap["Avg. Down Month"] = downMonthsArr.length > 0 ? (downMonthsArr.reduce((s, v) => s + v, 0) / downMonthsArr.length).toFixed(2) + "%" : "---";

  metricMap["Win Days"] = ((winDays / n) * 100).toFixed(2) + "%";
  metricMap["Win Month"] = ((upMonths.length / monthlyRets.length) * 100).toFixed(2) + "%";
  metricMap["Win Quarter"] = ((quarterRets.filter(v => v > 0).length / quarterRets.length) * 100).toFixed(1) + "%";
  const winYearCount = yearRets.filter(y => y.ret > 0).length;
  metricMap["Win Year"] = ((winYearCount / yearRets.length) * 100).toFixed(1) + "%";

  metricMap["Avg. Drawdown"] = avgDD.toFixed(2) + "%";
  metricMap["Avg. Drawdown Days"] = avgDDDays.toString();
  metricMap["Recovery Factor"] = recoveryFactor.toFixed(2);
  metricMap["Ulcer Index"] = ulcerIndex.toFixed(2);
  metricMap["Serenity Index"] = serenityIndex.toFixed(2);

  const today = new Date(entries[entries.length - 1].date);
  const findReturn = (daysBack: number) => {
    const target = new Date(today);
    target.setDate(target.getDate() - daysBack);
    const targetStr = target.toISOString().substring(0, 10);
    let closest = entries[0];
    for (const e of entries) { if (e.date <= targetStr) closest = e; }
    return lastVal - closest.value;
  };
  const currentMonth = today.toISOString().substring(0, 7);
  const mtdStart = entries.find(e => e.date.startsWith(currentMonth));
  metricMap["MTD"] = mtdStart ? (lastVal - (entries[entries.indexOf(mtdStart) > 0 ? entries.indexOf(mtdStart) - 1 : 0].value)).toFixed(2) + "%" : "---";
  metricMap["3M"] = findReturn(90).toFixed(2) + "%";
  metricMap["6M"] = findReturn(180).toFixed(2) + "%";
  const currentYear = today.getFullYear().toString();
  const ytdStart = entries.find(e => e.date.startsWith(currentYear));
  metricMap["YTD"] = ytdStart ? (lastVal - (entries[entries.indexOf(ytdStart) > 0 ? entries.indexOf(ytdStart) - 1 : 0].value)).toFixed(2) + "%" : "---";
  metricMap["1Y"] = findReturn(365).toFixed(2) + "%";
  metricMap["3Y (ann.)"] = (findReturn(365 * 3) / 3).toFixed(2) + "%";
  metricMap["5Y (ann.)"] = (findReturn(365 * 5) / 5).toFixed(2) + "%";
  metricMap["All-time (ann.)"] = additiveCagr.toFixed(2) + "%";

  const eoyReturns = yearRets.map(yr => ({
    year: yr.year,
    returnPct: parseFloat(yr.ret.toFixed(2)),
    cumulative: yr.compRet.toFixed(2),
  }));

  const lastYear = parseInt(entries[entries.length - 1].date.substring(0, 4));
  const additiveEoyReturns = computeEoyReturns(entries);
  const fullYearReturns = additiveEoyReturns.filter(yr => yr.year < lastYear);
  if (fullYearReturns.length > 0) {
    const avgYearly = fullYearReturns.reduce((s, y) => s + y.returnPct, 0) / fullYearReturns.length;
    metricMap["Avg Yearly"] = avgYearly.toFixed(2) + "%";
  }

  const drawdowns: { started: string; recovered: string; drawdown: number; days: number }[] = [];
  let ddS = -1, ddPeakIdx = 0;
  for (let i = 0; i < ddValues.length; i++) {
    if (ddValues[i] < 0 && ddS === -1) { ddS = i; ddPeakIdx = i - 1 >= 0 ? i - 1 : 0; }
    if ((ddValues[i] === 0 || i === ddValues.length - 1) && ddS !== -1) {
      const minInPeriod = Math.min(...ddValues.slice(ddS, i + 1));
      drawdowns.push({
        started: drawdownChart[ddPeakIdx]?.date || drawdownChart[ddS].date,
        recovered: ddValues[i] === 0 ? drawdownChart[i].date : "ongoing",
        drawdown: parseFloat(minInPeriod.toFixed(2)),
        days: i - ddS,
      });
      ddS = -1;
    }
  }
  drawdowns.sort((a, b) => a.drawdown - b.drawdown);

  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  };
  const dateRange = `${fmtDate(entries[0].date)} - ${fmtDate(entries[entries.length - 1].date)}`;

  return {
    metrics: metricMap,
    eoyReturns,
    drawdowns,
    dateRange,
    equity,
    drawdownChart,
    monthlyGrid,
    dailyPnl,
  };
}

function computeEoyReturns(entries: { date: string; value: number }[]): { year: number; returnPct: number; cumulative: string }[] {
  const yearMap = new Map<number, { last: number; prevYearEnd: number }>();
  let prevYearEnd = 0;
  for (const e of entries) {
    const year = parseInt(e.date.substring(0, 4));
    if (!yearMap.has(year)) {
      yearMap.set(year, { last: e.value, prevYearEnd });
    } else {
      yearMap.get(year)!.last = e.value;
    }
    prevYearEnd = e.value;
  }
  const result: { year: number; returnPct: number; cumulative: string }[] = [];
  for (const [year, data] of yearMap) {
    const returnPct = parseFloat((data.last - data.prevYearEnd).toFixed(2));
    const cumReturn = data.last;
    const sign = cumReturn >= 0 ? "+" : "";
    result.push({ year, returnPct, cumulative: sign + cumReturn.toFixed(1) + "%" });
  }
  return result;
}

function computeStats(csvText: string): ParsedStats {
  const lines = csvText.trim().split("\n");
  const rows: { date: string; pnl: number }[] = [];
  for (const line of lines.slice(1)) {
    const [date, pnlStr] = line.split(",");
    if (!date || !pnlStr) continue;
    rows.push({ date: date.trim(), pnl: parseFloat(pnlStr.trim()) / 100 });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));

  const allReturns = rows.map(r => r.pnl);

  // Compounded equity
  let val = 1.0;
  const equity: { date: string; value: number }[] = [];
  for (const r of rows) {
    val = val * (1 + r.pnl);
    equity.push({ date: r.date, value: parseFloat(((val - 1) * 100).toFixed(2)) });
  }
  const finalEquityVal = 1 + val - 1;

  // Dates
  const startDate = new Date(rows[0].date);
  const endDate = new Date(rows[rows.length - 1].date);
  const years = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

  // Totals
  const totalReturn = (val - 1) * 100;
  const cagr = (Math.pow(val, 1 / years) - 1) * 100;

  // Volatility
  // Use actual data frequency (n/years) instead of hardcoded 252.
  // The CSV contains calendar-day rows (~365/year), not just trading days (252/year).
  // Annualising with sqrt(252) on calendar-day data understates vol and inflates Sharpe/Sortino.
  const n = allReturns.length;
  const periodsPerYear = n / years;               // ≈365 for calendar-day CSVs
  const mean = allReturns.reduce((a, b) => a + b, 0) / n;
  const variance = allReturns.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const annVol = stdDev * Math.sqrt(periodsPerYear) * 100;

  // Sharpe: CAGR / annualised vol  (matches quantstats update)
  const cagrDecimal = cagr / 100;
  const sharpe = cagrDecimal / (annVol / 100);

  // Sortino: CAGR / annualised downside std
  // downside = population std of (r < 0 ? r : 0) array, then annualise
  const downsideArr = allReturns.map(r => r < 0 ? r : 0);
  const downsideMeanVal = downsideArr.reduce((a, b) => a + b, 0) / n;
  const downsideStdPop = Math.sqrt(downsideArr.reduce((a, r) => a + Math.pow(r - downsideMeanVal, 2), 0) / n);
  const downsideAnn = downsideStdPop * Math.sqrt(periodsPerYear);
  const sortino = cagrDecimal / downsideAnn;

  // Max Drawdown on compounded equity
  let peak = 1.0;
  let maxDD = 0.0;
  let compVal = 1.0;
  const drawdownChart: { date: string; value: number }[] = [];
  for (const r of rows) {
    compVal = compVal * (1 + r.pnl);
    if (compVal > peak) peak = compVal;
    const dd = (compVal - peak) / peak;
    if (dd < maxDD) maxDD = dd;
    drawdownChart.push({ date: r.date, value: parseFloat((dd * 100).toFixed(4)) });
  }

  // Calmar
  const calmar = (cagr / 100) / Math.abs(maxDD);

  // Recovery factor (using additive total return, consistent with displayed equity)
  const additiveReturn = allReturns.reduce((s, r) => s + r, 0) * 100;
  const recoveryFactor = additiveReturn / (Math.abs(maxDD) * 100);

  // Win days
  const winDays = allReturns.filter(r => r > 0).length;

  // VaR / CVaR (5%)
  const sorted = [...allReturns].sort((a, b) => a - b);
  const varIdx = Math.floor(0.05 * sorted.length);
  const dailyVaR = sorted[varIdx] * 100;
  const cvarVals = sorted.slice(0, varIdx);
  const cvar = cvarVals.length > 0 ? (cvarVals.reduce((a, b) => a + b, 0) / cvarVals.length) * 100 : 0;

  // Monthly returns (compounded within month)
  const monthlyMap: Record<string, number[]> = {};
  for (const r of rows) {
    const ym = r.date.substring(0, 7);
    if (!monthlyMap[ym]) monthlyMap[ym] = [];
    monthlyMap[ym].push(r.pnl);
  }
  const monthlyReturns = Object.entries(monthlyMap)
    .map(([ym, rets]) => ({
      ym,
      ret: rets.reduce((acc, r) => acc * (1 + r), 1) - 1,
    }))
    .sort((a, b) => a.ym.localeCompare(b.ym));

  const monthRets = monthlyReturns.map(m => m.ret);
  const winMonths = monthRets.filter(r => r > 0).length;
  const bestMonth = Math.max(...monthRets) * 100;
  const worstMonth = Math.min(...monthRets) * 100;
  const upMonths = monthRets.filter(r => r > 0);
  const downMonths = monthRets.filter(r => r < 0);
  const avgUpMonth = upMonths.length > 0 ? upMonths.reduce((a, b) => a + b, 0) / upMonths.length * 100 : 0;
  const avgDownMonth = downMonths.length > 0 ? downMonths.reduce((a, b) => a + b, 0) / downMonths.length * 100 : 0;

  // Yearly returns (additive for QA: sum of daily %)
  const yearlyDailyMap: Record<string, number[]> = {};
  for (const r of rows) {
    const yr = r.date.substring(0, 4);
    if (!yearlyDailyMap[yr]) yearlyDailyMap[yr] = [];
    yearlyDailyMap[yr].push(r.pnl);
  }
  const yearlyReturnsList = Object.entries(yearlyDailyMap)
    .map(([yr, rets]) => ({
      year: parseInt(yr),
      ret: rets.reduce((s, r) => s + r, 0),
    }))
    .sort((a, b) => a.year - b.year);

  const winYears = yearlyReturnsList.filter(y => y.ret > 0).length;
  const bestYear = Math.max(...yearlyReturnsList.map(y => y.ret)) * 100;
  const worstYear = Math.min(...yearlyReturnsList.map(y => y.ret)) * 100;

  // EOY returns with compounded cumulative from equity curve
  const equityYearEnd: Record<number, number> = {};
  for (const e of equity) {
    const yr = parseInt(e.date.substring(0, 4));
    equityYearEnd[yr] = e.value;
  }
  const eoyReturns = yearlyReturnsList.map(({ year, ret }) => {
    const cumReturn = equityYearEnd[year] ?? 0;
    const sign = cumReturn >= 0 ? "+" : "";
    return {
      year,
      returnPct: parseFloat((ret * 100).toFixed(2)),
      cumulative: sign + cumReturn.toFixed(1) + "%",
    };
  });

  // Omega / Profit Factor
  const gains = allReturns.filter(r => r > 0).reduce((a, b) => a + b, 0);
  const losses = Math.abs(allReturns.filter(r => r < 0).reduce((a, b) => a + b, 0));
  const omega = losses > 0 ? gains / losses : 0;
  const profitFactor = omega;

  // Skewness
  const skew = allReturns.reduce((a, r) => a + Math.pow((r - mean) / stdDev, 3), 0) / n;

  // Kelly
  const winRate = winDays / n;
  const avgWin = winDays > 0 ? allReturns.filter(r => r > 0).reduce((a, b) => a + b, 0) / winDays : 0;
  const lossDays = n - winDays;
  const avgLoss = lossDays > 0 ? Math.abs(allReturns.filter(r => r < 0).reduce((a, b) => a + b, 0)) / lossDays : 1;
  const kelly = avgLoss > 0 ? winRate - (1 - winRate) / (avgWin / avgLoss) : 0;

  // Longest DD days + Avg DD days
  let longestDDDays = 0;
  let allDDDays: number[] = [];
  let inDD = false;
  let curDDStart: Date | null = null;
  let peakCompVal = 1.0;
  let compVal2 = 1.0;
  for (const r of rows) {
    compVal2 = compVal2 * (1 + r.pnl);
    if (compVal2 >= peakCompVal) {
      if (inDD && curDDStart) {
        const days = (new Date(r.date).getTime() - curDDStart.getTime()) / (24 * 60 * 60 * 1000);
        if (days > longestDDDays) longestDDDays = days;
        allDDDays.push(days);
        inDD = false;
      }
      peakCompVal = compVal2;
    } else if (!inDD) {
      inDD = true;
      curDDStart = new Date(r.date);
    }
  }
  if (inDD && curDDStart) {
    const days = (new Date(rows[rows.length - 1].date).getTime() - curDDStart.getTime()) / (24 * 60 * 60 * 1000);
    if (days > longestDDDays) longestDDDays = days;
    allDDDays.push(days);
  }
  const avgDDDays = allDDDays.length > 0 ? allDDDays.reduce((a, b) => a + b, 0) / allDDDays.length : 0;

  // Avg drawdown
  let ddPeriods: number[] = [];
  let inDDp = false;
  let peakCV = 1.0;
  let curMinVal = 1.0;
  let compVal3 = 1.0;
  for (const r of rows) {
    compVal3 = compVal3 * (1 + r.pnl);
    if (compVal3 >= peakCV) {
      if (inDDp) {
        ddPeriods.push((curMinVal - peakCV) / peakCV);
        inDDp = false;
      }
      peakCV = compVal3;
    } else {
      if (!inDDp) { inDDp = true; curMinVal = compVal3; }
      else if (compVal3 < curMinVal) curMinVal = compVal3;
    }
  }
  if (inDDp) ddPeriods.push((curMinVal - peakCV) / peakCV);
  const avgDD = ddPeriods.length > 0 ? ddPeriods.reduce((a, b) => a + b, 0) / ddPeriods.length * 100 : 0;

  // Top drawdown periods
  let ddPeriodsData: { started: string; recovered: string | null; drawdown: number; days: number }[] = [];
  let inDDQ = false;
  let dpPeak = 1.0;
  let dpDate = rows[0].date;
  let dpMinVal = 1.0;
  let compVal4 = 1.0;
  for (const r of rows) {
    compVal4 = compVal4 * (1 + r.pnl);
    if (compVal4 >= dpPeak) {
      if (inDDQ) {
        ddPeriodsData.push({
          started: dpDate,
          recovered: r.date,
          drawdown: parseFloat(((dpMinVal - dpPeak) / dpPeak * 100).toFixed(2)),
          days: Math.round((new Date(r.date).getTime() - new Date(dpDate).getTime()) / (24 * 60 * 60 * 1000)),
        });
        inDDQ = false;
      }
      dpPeak = compVal4;
      dpDate = r.date;
    } else {
      if (!inDDQ) { inDDQ = true; dpMinVal = compVal4; }
      else if (compVal4 < dpMinVal) dpMinVal = compVal4;
    }
  }
  if (inDDQ) {
    ddPeriodsData.push({
      started: dpDate,
      recovered: null,
      drawdown: parseFloat(((dpMinVal - dpPeak) / dpPeak * 100).toFixed(2)),
      days: Math.round((new Date(rows[rows.length - 1].date).getTime() - new Date(dpDate).getTime()) / (24 * 60 * 60 * 1000)),
    });
  }
  ddPeriodsData.sort((a, b) => a.drawdown - b.drawdown);
  const drawdowns = ddPeriodsData.slice(0, 10).map(d => ({
    started: d.started,
    recovered: d.recovered || "Active",
    drawdown: d.drawdown,
    days: d.days,
  }));

  // Quarterly returns (compounded)
  const quarterlyMap: Record<string, number[]> = {};
  for (const { ym, ret } of monthlyReturns) {
    const [yr, mo] = ym.split("-").map(Number);
    const q = Math.ceil(mo / 3);
    const key = `${yr}-Q${q}`;
    if (!quarterlyMap[key]) quarterlyMap[key] = [];
    quarterlyMap[key].push(ret);
  }
  const quarterlyReturns = Object.entries(quarterlyMap)
    .map(([key, rets]) => ({ key, ret: rets.reduce((acc, r) => acc * (1 + r), 1) - 1 }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const winQuarters = quarterlyReturns.filter(q => q.ret > 0).length;
  const totalQuarters = quarterlyReturns.length;
  const winQuarterPct = totalQuarters > 0 ? (winQuarters / totalQuarters * 100).toFixed(1) + "%" : "---";

  // Max Consecutive Wins / Losses (daily)
  let maxConsecWins = 0;
  let maxConsecLosses = 0;
  let curWins = 0;
  let curLosses = 0;
  for (const r of allReturns) {
    if (r > 0) { curWins++; curLosses = 0; if (curWins > maxConsecWins) maxConsecWins = curWins; }
    else if (r < 0) { curLosses++; curWins = 0; if (curLosses > maxConsecLosses) maxConsecLosses = curLosses; }
    else { curWins = 0; curLosses = 0; }
  }

  // Date range
  const fmt = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  };
  const dateRange = `${fmt(rows[0].date)} - ${fmt(rows[rows.length - 1].date)}`;

  const worstYearSign = worstYear >= 0 ? "+" : "";

  const metrics: Record<string, string> = {
    "Total Return": totalReturn.toFixed(2) + "%",
    "CAGR": cagr.toFixed(2) + "%",
    "Sharpe": sharpe.toFixed(2),
    "Sortino": sortino.toFixed(2),
    "Calmar": calmar.toFixed(2),
    "Max Drawdown": (maxDD * 100).toFixed(2) + "%",
    "Volatility (ann.)": annVol.toFixed(2) + "%",
    "Win Days": (winDays / n * 100).toFixed(1) + "%",
    "Win Month": (winMonths / monthRets.length * 100).toFixed(1) + "%",
    "Win Quarter": winQuarterPct,
    "Win Year": winYears + " of " + yearlyReturnsList.length,
    "Best Month": "+" + bestMonth.toFixed(2) + "%",
    "Worst Month": worstMonth.toFixed(2) + "%",
    "Avg. Up Month": "+" + avgUpMonth.toFixed(2) + "%",
    "Avg. Down Month": avgDownMonth.toFixed(2) + "%",
    "Best Year": "+" + bestYear.toFixed(2) + "%",
    "Worst Year": worstYearSign + worstYear.toFixed(2) + "%",
    "Omega": omega.toFixed(2),
    "Profit Factor": profitFactor.toFixed(2),
    "Kelly Criterion": (kelly * 100).toFixed(2) + "%",
    "Skew": skew.toFixed(2),
    "Daily Value-at-Risk": dailyVaR.toFixed(2) + "%",
    "Expected Shortfall (cVaR)": cvar.toFixed(2) + "%",
    "Recovery Factor": recoveryFactor.toFixed(2),
    "Longest DD Days": Math.round(longestDDDays).toString(),
    "Avg. Drawdown": avgDD.toFixed(2) + "%",
    "Avg. Drawdown Days": Math.round(avgDDDays).toString(),
    "Max Consecutive Wins": maxConsecWins.toString(),
    "Max Consecutive Losses": maxConsecLosses.toString(),
    "Gain/Pain Ratio": (gains / (gains + losses)).toFixed(2),
  };

  const monthlyGrid = monthlyReturns.map(({ ym, ret }) => ({
    ym,
    ret: parseFloat((ret * 100).toFixed(4)),
  }));

  const dailyPnl = rows.map(r => ({
    date: r.date,
    value: parseFloat((r.pnl * 100).toFixed(4)),
  }));

  return { metrics, eoyReturns, drawdowns, dateRange, equity, drawdownChart, monthlyGrid, dailyPnl };
}

async function fetchStats(strategy: string = "basket50"): Promise<ParsedStats> {
  const now = Date.now();
  const cached = statsCache[strategy];
  if (cached && now - cached.time < CACHE_DURATION) {
    return cached.data;
  }

  const credentials = Buffer.from("report:_-3xT!jaTtNfi_iB").toString("base64");

  if (strategy === "quantumalpha") {
    const data = await fetchQuantumAlphaStats();
    statsCache[strategy] = { data, time: now };
    return data;
  }

  const csvFile = STRATEGY_CSV[strategy] || STRATEGY_CSV["basket50"];
  const res = await fetch(`https://drive.fund-iq.com/daily/basket/${csvFile}`, {
    headers: { Authorization: `Basic ${credentials}`, "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${csvFile}: ${res.status}`);
  const csvText = await res.text();
  const data = computeStats(csvText);
  statsCache[strategy] = { data, time: now };
  return data;
}

const PDF_CACHE_PATH = path.join("/tmp", "factsheet_basket50.pdf");
const PDF_CACHE_DURATION = 24 * 60 * 60 * 1000;

function isPdfCacheFresh(): boolean {
  try {
    if (!fs.existsSync(PDF_CACHE_PATH)) return false;
    const stat = fs.statSync(PDF_CACHE_PATH);
    return Date.now() - stat.mtimeMs < PDF_CACHE_DURATION;
  } catch {
    return false;
  }
}

async function generateFactSheetPDF(stats: ParsedStats): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 20, bottom: 20, left: 35, right: 35 },
      info: {
        Title: "Basket 50 - Fund Fact Sheet",
        Author: "Управляющая компания",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const NL = { lineBreak: false } as const;
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const leftM = 35;
    const contentW = pageW - leftM - 35;
    const m = stats.metrics;

    const cyan = "#00B8D4";
    const darkBg = "#0A0E27";
    const darkCard = "#111633";
    const lightText = "#E8EAED";
    const dimText = "#9BA3B5";
    const white = "#FFFFFF";
    const green = "#4ADE80";
    const red = "#F87171";

    doc.rect(0, 0, pageW, pageH).fill(darkBg);

    doc.rect(leftM, 22, contentW, 42).fill(darkCard);
    doc.fillColor(cyan).fontSize(16).font("Helvetica-Bold")
      .text("BASKET 50", leftM + 12, 28, NL);
    doc.fillColor(dimText).fontSize(8).font("Helvetica")
      .text("Управляющая компания — Momentum & Mean Reversion Strategy", leftM + 12, 48, NL);

    const genDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    doc.fillColor(dimText).fontSize(6.5).font("Helvetica")
      .text(`Generated: ${genDate}`, pageW - 35 - 220, 30, { width: 205, align: "right", lineBreak: false });
    if (stats.dateRange) {
      doc.fillColor(dimText).fontSize(6.5).font("Helvetica")
        .text(`Period: ${stats.dateRange}`, pageW - 35 - 220, 42, { width: 205, align: "right", lineBreak: false });
    }

    let y = 72;

    function sectionTitle(title: string, yPos: number): number {
      doc.rect(leftM, yPos, contentW, 16).fill(darkCard);
      doc.fillColor(cyan).fontSize(8).font("Helvetica-Bold")
        .text(title.toUpperCase(), leftM + 8, yPos + 4, NL);
      return yPos + 20;
    }

    y = sectionTitle("Key Performance Metrics", y);

    const kpiData = [
      { label: "Total Return", value: m?.["Total Return"] || "---" },
      { label: "CAGR", value: m?.["CAGR"] || "---" },
      { label: "Sharpe Ratio", value: m?.["Sharpe"] || "---" },
      { label: "Sortino Ratio", value: m?.["Sortino"] || "---" },
      { label: "Max Drawdown", value: m?.["Max Drawdown"] || "---" },
      { label: "Calmar Ratio", value: m?.["Calmar"] || "---" },
    ];

    const kpiCols = 3;
    const kpiColW = contentW / kpiCols;
    for (let i = 0; i < kpiData.length; i++) {
      const col = i % kpiCols;
      const row = Math.floor(i / kpiCols);
      const x = leftM + col * kpiColW;
      const cellY = y + row * 30;
      doc.rect(x + 2, cellY, kpiColW - 4, 27).fill(darkCard);
      doc.fillColor(dimText).fontSize(6).font("Helvetica")
        .text(kpiData[i].label, x + 6, cellY + 4, { width: kpiColW - 12, lineBreak: false });
      doc.fillColor(white).fontSize(10).font("Helvetica-Bold")
        .text(kpiData[i].value, x + 6, cellY + 14, { width: kpiColW - 12, lineBreak: false });
    }
    y += Math.ceil(kpiData.length / kpiCols) * 30 + 6;

    y = sectionTitle("Performance Charts", y);

    const chartGap = 10;
    const chartW = (contentW - chartGap) / 2;
    const chartH = 130;

    function drawChart(
      data: { date: string; value: number }[],
      chartX: number, chartY: number, cW: number, cH: number,
      lineColor: string, _areaColor: string, title: string
    ) {
      if (!data || data.length < 2) return;

      doc.fillColor(dimText).fontSize(5).font("Helvetica-Bold")
        .text(title, chartX, chartY, NL);

      const plotY = chartY + 10;
      const plotH = cH - 18;
      doc.rect(chartX, plotY, cW, plotH).fill(darkCard);

      const step = Math.max(1, Math.floor(data.length / 150));
      const sampled = data.filter((_: any, i: number) => i % step === 0 || i === data.length - 1);
      const values = sampled.map((d: any) => d.value);
      const minV = Math.min(...values);
      const maxV = Math.max(...values);
      const range = maxV - minV || 1;
      const inset = 3;

      for (let g = 0; g <= 3; g++) {
        const gy = plotY + inset + ((plotH - 2 * inset) * g) / 3;
        doc.save();
        doc.moveTo(chartX + inset, gy).lineTo(chartX + cW - inset, gy)
          .strokeColor("#1E2550").lineWidth(0.3).stroke();
        doc.restore();
        const val = maxV - (range * g) / 3;
        doc.fillColor(dimText).fontSize(3.5).font("Helvetica")
          .text(val.toFixed(val > 10 ? 0 : 2), chartX + inset + 1, gy - 3, NL);
      }

      const pts = sampled.map((d: any, i: number) => ({
        px: chartX + inset + ((cW - 2 * inset) * i) / (sampled.length - 1),
        py: plotY + inset + ((plotH - 2 * inset) * (maxV - d.value)) / range,
      }));

      doc.save();
      doc.moveTo(pts[0].px, plotY + plotH - inset);
      doc.lineTo(pts[0].px, pts[0].py);
      for (const p of pts.slice(1)) doc.lineTo(p.px, p.py);
      doc.lineTo(pts[pts.length - 1].px, plotY + plotH - inset);
      doc.closePath();
      doc.fillOpacity(0.15).fillColor(lineColor).fill();
      doc.restore();

      doc.save();
      doc.moveTo(pts[0].px, pts[0].py);
      for (const p of pts.slice(1)) doc.lineTo(p.px, p.py);
      doc.strokeColor(lineColor).lineWidth(0.7).stroke();
      doc.restore();

      const yearSet = new Set(sampled.map((d: any) => d.date.substring(0, 4)));
      const years = Array.from(yearSet);
      for (const yr of years) {
        const idx = sampled.findIndex((d: any) => d.date.startsWith(yr));
        if (idx >= 0) {
          const lx = chartX + inset + ((cW - 2 * inset) * idx) / (sampled.length - 1);
          doc.fillColor(dimText).fontSize(3.5).font("Helvetica")
            .text(yr, lx - 6, plotY + plotH - inset + 2, NL);
        }
      }
    }

    drawChart(stats.equity, leftM, y, chartW, chartH, cyan, cyan, "Accumulated Profit (Compounded)");
    (doc as any).y = y;
    drawChart(stats.drawdownChart, leftM + chartW + chartGap, y, chartW, chartH, red, red, "Drawdown");
    (doc as any).y = y;
    y += chartH + 6;

    y = sectionTitle("End of Year Returns", y);

    const tableColWidths = [80, 120, 120];
    const tableHeaders = ["Year", "Annual Return", "Cumulative"];
    const tableX = leftM + (contentW - tableColWidths.reduce((a, b) => a + b, 0)) / 2;
    const tableW = tableColWidths.reduce((a, b) => a + b, 0);

    doc.rect(tableX, y, tableW, 22).fill(darkCard);
    let tx = tableX;
    for (let i = 0; i < tableHeaders.length; i++) {
      doc.fillColor(cyan).fontSize(7.5).font("Helvetica-Bold")
        .text(tableHeaders[i], tx + 10, y + 5, { width: tableColWidths[i] - 20, lineBreak: false });
      tx += tableColWidths[i];
    }
    y += 22;

    for (let r = 0; r < stats.eoyReturns.length; r++) {
      const row = stats.eoyReturns[r];
      const rowBg = r % 2 === 0 ? darkBg : darkCard;
      doc.rect(tableX, y, tableW, 19).fill(rowBg);
      tx = tableX;
      doc.fillColor(lightText).fontSize(7.5).font("Helvetica")
        .text(String(row.year), tx + 10, y + 5, { width: tableColWidths[0] - 20, lineBreak: false });
      tx += tableColWidths[0];
      const retColor = row.returnPct >= 0 ? green : red;
      doc.fillColor(retColor).fontSize(7.5).font("Helvetica-Bold")
        .text(`${row.returnPct >= 0 ? "+" : ""}${row.returnPct.toFixed(1)}%`, tx + 10, y + 5, { width: tableColWidths[1] - 20, lineBreak: false });
      tx += tableColWidths[1];
      doc.fillColor(lightText).fontSize(7.5).font("Helvetica")
        .text(row.cumulative, tx + 10, y + 5, { width: tableColWidths[2] - 20, lineBreak: false });
      y += 19;
    }
    y += 8;

    y = sectionTitle("Performance Statistics", y);

    const perfStats = [
      { label: "Win Days", value: m?.["Win Days"] || "---" },
      { label: "Win Month", value: m?.["Win Month"] || "---" },
      { label: "Win Year", value: m?.["Win Year"] || "---" },
      { label: "Best Month", value: m?.["Best Month"] || "---" },
      { label: "Worst Month", value: m?.["Worst Month"] || "---" },
      { label: "Best Year", value: m?.["Best Year"] || "---" },
      { label: "Worst Year", value: m?.["Worst Year"] || "---" },
      { label: "Omega", value: m?.["Omega"] || "---" },
      { label: "Profit Factor", value: m?.["Profit Factor"] || "---" },
      { label: "Kelly Criterion", value: m?.["Kelly Criterion"] || "---" },
      { label: "Gain/Pain Ratio", value: m?.["Gain/Pain Ratio"] || "---" },
      { label: "Skew", value: m?.["Skew"] || "---" },
    ];

    const statCols = 4;
    const statColW = contentW / statCols;
    const statRowH = 20;
    for (let i = 0; i < perfStats.length; i++) {
      const col = i % statCols;
      const row = Math.floor(i / statCols);
      const x = leftM + col * statColW;
      const cellY = y + row * statRowH;
      doc.fillColor(dimText).fontSize(6.5).font("Helvetica")
        .text(perfStats[i].label, x + 8, cellY + 4, { width: statColW * 0.55, lineBreak: false });
      doc.fillColor(lightText).fontSize(7.5).font("Helvetica-Bold")
        .text(perfStats[i].value, x + statColW * 0.55, cellY + 4, { width: statColW * 0.4, align: "right", lineBreak: false });
    }
    y += Math.ceil(perfStats.length / statCols) * statRowH + 8;

    y = sectionTitle("Risk Metrics", y);

    const riskStats = [
      { label: "Max Drawdown", value: m?.["Max Drawdown"] || "---" },
      { label: "Longest DD Days", value: m?.["Longest DD Days"] || "---" },
      { label: "Avg. Drawdown", value: m?.["Avg. Drawdown"] || "---" },
      { label: "Daily VaR", value: m?.["Daily Value-at-Risk"] || "---" },
      { label: "CVaR", value: m?.["Expected Shortfall (cVaR)"] || "---" },
      { label: "Recovery Factor", value: m?.["Recovery Factor"] || "---" },
      { label: "Calmar Ratio", value: m?.["Calmar"] || "---" },
    ];

    const riskCols = 4;
    const riskColW = contentW / riskCols;
    const riskRowH = 20;
    for (let i = 0; i < riskStats.length; i++) {
      const col = i % riskCols;
      const row = Math.floor(i / riskCols);
      const x = leftM + col * riskColW;
      const cellY = y + row * riskRowH;
      doc.fillColor(dimText).fontSize(6.5).font("Helvetica")
        .text(riskStats[i].label, x + 8, cellY + 4, { width: riskColW * 0.55, lineBreak: false });
      doc.fillColor(lightText).fontSize(7.5).font("Helvetica-Bold")
        .text(riskStats[i].value, x + riskColW * 0.55, cellY + 4, { width: riskColW * 0.4, align: "right", lineBreak: false });
    }
    y += Math.ceil(riskStats.length / riskCols) * riskRowH + 8;

    y = sectionTitle("Investment Terms", y);

    const terms = [
      { label: "Minimum Investment", value: "$1,000,000" },
      { label: "Management Fee", value: "2%" },
      { label: "Performance Fee", value: "25%" },
      { label: "High Water Mark", value: "Yes" },
      { label: "Lock-up Period", value: "3 months" },
      { label: "Fee Distribution", value: "Quarterly" },
      { label: "Custody", value: "CeFu, Copper" },
      { label: "Investment Structure", value: "BVI Approved Fund" },
      { label: "Execution", value: "Binance, Bybit, OKX" },
      { label: "Capacity", value: "$100M" },
      { label: "Base Currency", value: "USD" },
      { label: "Subscriptions", value: "Monthly (1st calendar day)" },
      { label: "Redemptions", value: "Monthly with 30 days notice" },
      { label: "Early Redemption Fee", value: "1% during lock-up period" },
    ];

    const termCols = 2;
    const termColW = contentW / termCols;
    const termRowH = 20;
    for (let i = 0; i < terms.length; i++) {
      const col = i % termCols;
      const row = Math.floor(i / termCols);
      const x = leftM + col * termColW;
      const cellY = y + row * termRowH;
      doc.fillColor(dimText).fontSize(6.5).font("Helvetica")
        .text(terms[i].label, x + 8, cellY + 4, { width: termColW * 0.45, lineBreak: false });
      doc.fillColor(lightText).fontSize(7.5).font("Helvetica-Bold")
        .text(terms[i].value, x + termColW * 0.45, cellY + 4, { width: termColW * 0.5, align: "right", lineBreak: false });
    }

    const footerY = pageH - 45;
    doc.rect(leftM, footerY, contentW, 0.5).fill(darkCard);

    const disclaimerText = "Disclaimer: Investment in the Fund involves significant risks and is suitable only for sophisticated investors. Digital assets are highly volatile and speculative. The strategy may experience material drawdowns during adverse market conditions. Cryptocurrency markets are subject to evolving and uncertain regulatory environments. Exchange counterparty risk exists, including potential for exchange failure or security breaches. Past performance, including backtested results, is not indicative of future results. Investors should have a sufficiently strong balance sheet to tolerate loss of a substantial portion or all of their investment. The Fund is not suitable for investors who cannot tolerate material capital loss or who require liquidity on short notice.";
    doc.fontSize(3.5).font("Helvetica").fillColor(dimText);
    const disclaimerW = contentW - 8;
    const words = disclaimerText.split(" ");
    let line = "";
    let lineY = footerY + 3;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (doc.widthOfString(test) > disclaimerW && line) {
        const lw = doc.widthOfString(line);
        doc.text(line, leftM + 4 + (disclaimerW - lw) / 2, lineY, NL);
        lineY += 6;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      const lw = doc.widthOfString(line);
      doc.text(line, leftM + 4 + (disclaimerW - lw) / 2, lineY, NL);
    }

    const copText = `\u00A9 ${new Date().getFullYear()} Управляющая компания. All rights reserved.`;
    const copW = doc.widthOfString(copText);
    doc.text(copText, leftM + (contentW - copW) / 2, pageH - 14, NL);

    doc.end();
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/stats", async (req, res) => {
    try {
      const strategy = (req.query.strategy as string) || "basket50";
      if (!STRATEGY_CSV[strategy]) {
        res.status(400).json({ error: "Unknown strategy" });
        return;
      }
      const stats = await fetchStats(strategy);
      res.json(stats);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      res.status(500).json({ error: "Failed to fetch strategy data" });
    }
  });

  app.get("/api/qa-multipliers", async (_req, res) => {
    try {
      const cacheKey = "qa-multipliers";
      const cached = statsCache[cacheKey];
      if (cached && Date.now() - cached.time < CACHE_DURATION) {
        res.json(cached.data);
        return;
      }

      const credentials = Buffer.from("report:_-3xT!jaTtNfi_iB").toString("base64");
      const authHeaders = { Authorization: `Basic ${credentials}`, "User-Agent": "Mozilla/5.0" };
      const suffixes = ["", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9", "_10"];

      const csvPromises = suffixes.map(s =>
        fetch(`https://drive.fund-iq.com/daily/basket/iqsf_daily${s}.csv`, { headers: authHeaders })
          .then(r => r.ok ? r.text() : "")
      );
      const csvTexts = await Promise.all(csvPromises);

      const multipliers = csvTexts.map((csv, idx) => {
        if (!csv) return { multiplier: idx + 1, cagr: 0, maxDD: 0, totalReturn: 0, avgYearly: 0 };
        const lines = csv.trim().split("\n").slice(1);
        const rets = lines.map(l => parseFloat(l.split(",")[1]));
        const addTotal = rets.reduce((s, v) => s + v, 0);
        let comp = 1.0, peak = 1.0, maxDD = 0;
        for (const r of rets) {
          comp *= (1 + r / 100);
          if (comp > peak) peak = comp;
          const dd = (comp - peak) / peak;
          if (dd < maxDD) maxDD = dd;
        }
        const firstDate = lines[0].split(",")[0];
        const lastDate = lines[lines.length - 1].split(",")[0];
        const years = (new Date(lastDate).getTime() - new Date(firstDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        const cagr = years > 0 ? (Math.pow(1 + addTotal / 100, 1 / years) - 1) * 100 : 0;
        const avgYearly = years > 0 ? addTotal / years : 0;
        return {
          multiplier: idx + 1,
          cagr: parseFloat(cagr.toFixed(2)),
          maxDD: parseFloat((maxDD * 100).toFixed(2)),
          totalReturn: parseFloat(addTotal.toFixed(2)),
          avgYearly: parseFloat(avgYearly.toFixed(2)),
        };
      });

      const result = { multipliers };
      statsCache[cacheKey] = { data: result as any, time: Date.now() };
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch QA multipliers:", error);
      res.status(500).json({ error: "Failed to fetch multiplier data" });
    }
  });

  app.get("/api/csv", async (req, res) => {
    try {
      const strategy = (req.query.strategy as string) || "basket50";
      if (!STRATEGY_CSV[strategy]) {
        res.status(400).json({ error: "Unknown strategy" });
        return;
      }
      const csvFile = STRATEGY_CSV[strategy];
      const response = await fetch(`https://drive.fund-iq.com/daily/basket/${csvFile}`, {
        headers: {
          Authorization: "Basic " + Buffer.from("report:_-3xT!jaTtNfi_iB").toString("base64"),
        },
      });
      if (!response.ok) {
        res.status(502).json({ error: "Failed to fetch CSV" });
        return;
      }
      const text = await response.text();
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${csvFile}"`);
      res.send(text);
    } catch (error) {
      console.error("Failed to download CSV:", error);
      res.status(500).json({ error: "Failed to download CSV" });
    }
  });

  app.get("/api/factsheet", async (_req, res) => {
    try {
      if (isPdfCacheFresh()) {
        const cached = fs.readFileSync(PDF_CACHE_PATH);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="Basket_50_Fact_Sheet.pdf"');
        res.send(cached);
        return;
      }

      const stats = await fetchStats();
      const pdfBuffer = await generateFactSheetPDF(stats);

      fs.writeFileSync(PDF_CACHE_PATH, pdfBuffer);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="Basket_50_Fact_Sheet.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Failed to generate fact sheet:", error);
      res.status(500).json({ error: "Failed to generate fact sheet" });
    }
  });

  const STRATEGY_NAMES: Record<string, string> = {
    basket50: "Basket 50",
    basket70: "Basket 70",
    basket70tf: "Basket 70 TF",
    quantumalpha: "Quantum Alpha",
  };

  const STRATEGY_HTML: Record<string, string> = {
    basket50: "Basket_50.html",
    basket70: "Basket_70.html",
    basket70tf: "Basket_70_TF.html",
    quantumalpha: "iqsf_report.html",
  };

  app.get("/api/quantstats", async (req, res) => {
    try {
      const strategy = (req.query.strategy as string) || "basket50";
      const htmlFile = STRATEGY_HTML[strategy];
      if (!htmlFile) {
        res.status(400).json({ error: "Unknown strategy" });
        return;
      }
      const response = await fetch(`https://drive.fund-iq.com/daily/basket/${htmlFile}`, {
        headers: { Authorization: "Basic " + Buffer.from("report:_-3xT!jaTtNfi_iB").toString("base64") },
      });
      if (!response.ok) {
        res.status(502).json({ error: "Failed to fetch report from upstream" });
        return;
      }
      const html = await response.text();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${htmlFile}"`);
      res.send(html);
    } catch (error) {
      console.error("Failed to fetch QuantStats report:", error);
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  return httpServer;
}
