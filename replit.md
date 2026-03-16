# Algotrading - Landing Page

## Overview
Single-page professional landing website for algorithmic crypto trading strategies. Dark fintech theme with animated particle background, glassmorphism effects, and responsive design. Russian-language content. Two strategies available: **Algo Momentum** (Basket 50) and **Algo Trend** (Basket 70 TF), with real performance data fetched from drive.fund-iq.com.

## Architecture
- **Frontend**: React + Vite, Tailwind CSS, Shadcn UI components
- **Backend**: Express with /api/stats endpoint that proxies CSV data from drive.fund-iq.com
- **Data Source**: drive.fund-iq.com/daily/basket/ (Basic auth, CSV files with daily PnL)
- **No database needed** - data comes from external source, cached for 5 minutes

## Project Structure
- `client/src/pages/home.tsx` - Main landing page with all sections
- `client/src/App.tsx` - Router setup
- `client/src/index.css` - Theme tokens (dark mode default)
- `client/index.html` - SEO meta tags
- `server/routes.ts` - API endpoint that fetches/parses CSV data and computes all metrics

## Strategies
- **Algo Momentum** (`basket50`): Multi-system quantitative approach, 10 crypto pairs, 5 trading models, <3 day holding
- **Algo Trend** (`basket70tf`): Trend-following with momentum filters, longer holding periods (<14 days)

## Page Structure
1. Hero section (heading, CTA, mini equity chart, CAGR/Sharpe/Track Record metrics)
2. Exchanges bar (Binance, OKX, Bybit, Bitget, BingX)
3. Social proof bar (trust signals)
4. Equity chart with period filters
5. Key metrics cards
6. Results section (yearly returns table + stats)
7. "How the strategy works" (2x2 grid)
8. "How it works" (3 steps)
9. "Why algotrading" (4 advantages)
10. Terms section
11. CTA section
12. FAQ accordion
13. Footer with legal disclaimer

## API Endpoints
- `GET /api/stats?strategy=basket50|basket70tf` - Returns metrics, equity, drawdowns, EOY returns, monthly grid
- `GET /api/csv?strategy=...` - Returns raw CSV data
- `GET /api/factsheet` - Generates PDF fact sheet

## Design
- Dark theme (#0a0e27 variant via CSS vars)
- Accent color: cyan/blue (#00d4ff)
- Font: Inter + JetBrains Mono
- Scroll-triggered fade-in animations
- Alternating section backgrounds
- Strategy selector in navbar (pill-style toggle)
- Logo: "Algotrading" text gradient

## Running
- `npm run dev` starts the development server on port 5000
