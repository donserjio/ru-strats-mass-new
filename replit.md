# Quantum Alpha 4 - Quantitative Fund

## Overview
Single-page professional landing website for Quantum Alpha 4, a systematic multi-strategy quantitative fund for digital assets. Positioned as an investment fund. Dark fintech theme with animated particle background, glassmorphism effects, and responsive design. All performance data is fetched live from stat.tenets.pro.

## Architecture
- **Frontend**: React + Vite, Tailwind CSS, Shadcn UI components
- **Backend**: Express with /api/stats and /api/factsheet endpoints
- **Data Source**: stat.tenets.pro (QuantStats HTML report) - scraped and cached for 5 minutes
- **PDF Generation**: pdfkit library generates Fund Fact Sheet PDF, cached for 24 hours in /tmp
- **No database needed** - data comes from external source

## Project Structure
- `client/src/pages/home.tsx` - Main landing page with all sections
- `client/src/App.tsx` - Router setup
- `client/src/index.css` - Theme tokens (dark mode default)
- `client/index.html` - SEO meta tags
- `server/routes.ts` - API endpoint that fetches and parses stat.tenets.pro

## API Endpoints
- `GET /api/stats` - Returns parsed data from stat.tenets.pro including:
  - `metrics`: Key-value pairs of all QuantStats metrics (Total Return, CAGR, Sharpe, Sortino, Volatility, Drawdown, etc.)
  - `eoyReturns`: Array of {year, returnPct, cumulative} for each year
  - `drawdowns`: Array of {started, recovered, drawdown, days} for worst drawdowns
  - `dateRange`: String with the track record date range
- `GET /api/factsheet` - Generates and serves a PDF Fund Fact Sheet
  - Dark-themed professional PDF with key metrics, EOY returns, performance stats, risk metrics, and investment terms
  - Cached for 24 hours in /tmp/factsheet.pdf, regenerated after expiry
  - Downloads as "Quantum_Alpha_4_Fact_Sheet.pdf"

## Data Source URLs
- `https://stat.tenets.pro/amp_4_2.html` - Main stats HTML page
- `https://stat.tenets.pro/amp_equity_4_2.json` - Equity chart data
- `https://stat.tenets.pro/amp_drawdown_4_2.json` - Drawdown chart data

## Key Sections
1. Hero with particle canvas animation + live metrics
2. Key metrics cards (6 KPIs from live data)
3. Strategy overview (parameters + fund architecture)
4. Performance section (EOY returns table + performance statistics)
5. System design (3-column layout)
6. Risk profile (risk metrics + worst drawdowns table - all 10 entries)
7. Detailed Statistics (3-column breakdown of all metrics)
8. Access terms (9 cards)
9. FAQ accordion
10. Footer with contact info

## Design
- Dark theme (#0a0e27 variant via CSS vars)
- Accent color: cyan/blue (#00d4ff)
- Font: Inter + JetBrains Mono
- Scroll-triggered fade-in animations
- Responsive breakpoints handled by Tailwind
- Loading skeletons while data fetches

## Running
- `npm run dev` starts the development server on port 5000
