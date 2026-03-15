# Algo Strategy - Landing Page

## Overview
Single-page professional landing website for an algorithmic crypto trading service. Dark fintech theme with animated particle background, glassmorphism effects, and responsive design. Russian-language content. Performance data fetched live from stat.tenets.pro.

## Architecture
- **Frontend**: React + Vite, Tailwind CSS, Shadcn UI components
- **Backend**: Express with /api/stats and /api/factsheet endpoints
- **Data Source**: stat.tenets.pro (QuantStats HTML report) - scraped and cached for 5 minutes
- **No database needed** - data comes from external source

## Project Structure
- `client/src/pages/home.tsx` - Main landing page with all sections
- `client/src/App.tsx` - Router setup
- `client/src/index.css` - Theme tokens (dark mode default)
- `client/index.html` - SEO meta tags
- `server/routes.ts` - API endpoint that fetches and parses stat.tenets.pro

## Page Structure (Simplified)
1. Hero section (large heading, pulsing CTA, equity chart preview)
2. Exchanges bar (crypto exchange logos with label)
3. Social proof bar (key trust signals with checkmarks)
4. Results section (equity chart with period filters)
5. Annual performance (bar chart)
6. Key metrics (5 clean cards without icons)
7. How it works (3 steps)
8. Why copy trading (4 advantages with minimal styling)
9. Drawdown chart
10. Monthly returns table
11. Risk profile (metrics + drawdown table)
12. Terms (clean table-style list)
13. CTA section ("Ready to connect")
14. FAQ accordion
15. Footer with disclaimer

## API Endpoints
- `GET /api/stats` - Returns parsed data including metrics, equity, drawdowns, EOY returns
- `GET /api/factsheet` - Generates PDF fact sheet

## Design
- Dark theme (#0a0e27 variant via CSS vars)
- Accent color: cyan/blue (#00d4ff)
- Font: Inter + JetBrains Mono
- Scroll-triggered fade-in animations
- Alternating section backgrounds for visual separation
- Clean, no-icon metric displays
- Pulsing CTA buttons

## Running
- `npm run dev` starts the development server on port 5000
