import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import { SiWhatsapp } from "react-icons/si";
import {
  ArrowRight,
  Send,
  CalendarRange,
  CheckCircle,
  Shield,
  Wallet,
  Eye,
  PercentCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface StatsData {
  metrics: Record<string, string>;
  eoyReturns: { year: number; returnPct: number; cumulative: string }[];
  drawdowns: { started: string; recovered: string; drawdown: number; days: number }[];
  dateRange: string;
  equity: { date: string; value: number }[];
  drawdownChart: { date: string; value: number }[];
  monthlyGrid: { ym: string; ret: number }[];
  dailyPnl: { date: string; value: number }[];
}

type StrategyKey = "basket50" | "basket70tf";

interface StrategyConfig {
  key: string;
  apiKey: string;
  label: string;
  pairs: string[];
  approachShort: string;
  approachFull: string;
  desc: string;
  archDesc: string;
  riskDesc: string;
  execDesc: string;
  strategyType: string;
  holdingPeriod: string;
  capacity: string;
}

const STRATEGIES: Record<string, StrategyConfig> = {
  basket50: {
    key: "basket50",
    apiKey: "basket50",
    label: "Algo Momentum",
    pairs: ["BTC/USDT", "ETH/USDT"],
    approachShort: "Мультисистемный количественный подход",
    approachFull: "комбинации нескольких количественных моделей",
    desc: "Портфель из 15 независимых алгоритмических стратегий, работающих на 2 наиболее ликвидных криптовалютных парах — BTC и ETH. Каждая модель использует собственную логику входа и выхода — от краткосрочного моментума до возврата к среднему. Комбинация разных подходов сглаживает кривую доходности и снижает зависимость от одного рыночного режима.",
    archDesc: "Система объединяет 15 независимых алгоритмов на BTC и ETH. Торговля ведётся как в лонг, так и в шорт. Диверсификация по стратегиям обеспечивает стабильность в любых рыночных условиях — от трендов до боковиков.",
    riskDesc: "Каждая позиция открывается с фиксированным риском. Стоп-лоссы и тейк-профиты рассчитываются алгоритмом на основе текущей волатильности. В периоды аномальных движений система автоматически снижает экспозицию.",
    execDesc: "Полностью автоматизированное исполнение 24/7. Алгоритм выбирает тип ордера в зависимости от ликвидности и спреда. Работа без участия человека исключает эмоциональный фактор.",
    strategyType: "Количественная, систематическая",
    holdingPeriod: "< 3 дней",
    capacity: "$200M",
  },
  basket70tf: {
    key: "basket70tf",
    apiKey: "basket70tf",
    label: "Algo Trend",
    pairs: ["BTC/USDT", "ETH/USDT"],
    approachShort: "Следование за трендом с моментум-фильтрами",
    approachFull: "следования за трендом с использованием моментум-эффекта",
    desc: "Портфель из 15 трендовых алгоритмов на BTC и ETH, ориентированных на извлечение прибыли из направленных движений рынка. Стратегии удерживают позиции дольше, позволяя захватывать крупные ценовые импульсы. Встроенные фильтры волатильности отсекают ложные сигналы.",
    archDesc: "15 преимущественно трендовых моделей на BTC и ETH с увеличенным периодом удержания позиций. Комбинация моментума и кластеризации волатильности позволяет ловить сильные направленные движения и оставаться в стороне во время боковика.",
    riskDesc: "Фиксированный риск на каждую сделку без усреднения убытков. Позиции закрываются по стоп-лоссу или трейлинг-стопу, адаптированному к текущей волатильности.",
    execDesc: "Вход и выход осуществляется рыночными или лимитными ордерами в зависимости от глубины стакана и текущего спреда.",
    strategyType: "Трендовая, моментум, систематическая",
    holdingPeriod: "< 14 дней",
    capacity: "$350M",
  },
};

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

function LiveDataBadge({ text, pulse = true }: { text: string; pulse?: boolean }) {
  return (
    <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-emerald-500/25">
      {pulse ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
        </span>
      ) : (
        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500/80"></span>
      )}
      <span className="text-xs font-medium text-cyan-400">{text}</span>
    </div>
  );
}

function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, isVisible } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }[] = [];

    function resize() {
      if (!canvas || !ctx) return;
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    resize();
    window.addEventListener("resize", resize);

    const count = Math.min(80, Math.floor((canvas.offsetWidth * canvas.offsetHeight) / 12000));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${p.opacity})`;
        ctx.fill();
      });

      const maxDist = 120;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 212, 255, ${0.08 * (1 - dist / maxDist)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}

const NAV_ITEMS = [
  { label: "Результаты", href: "#results" },
  { label: "Показатели", href: "#metrics" },
  { label: "Как работает", href: "#how-it-works" },
  { label: "FAQ", href: "#faq" },
];

const STRATEGY_OPTIONS: { key: StrategyKey; label: string }[] = [
  { key: "basket50", label: "Algo Momentum" },
  { key: "basket70tf", label: "Algo Trend" },
];

function Navbar({ strategy, onStrategyChange }: { strategy: StrategyKey; onStrategyChange: (k: StrategyKey) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollTo = useCallback((href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <nav
      data-testid="navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 h-16">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2 shrink-0"
            data-testid="link-logo"
          >
            <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent tracking-tight">Algotrading</span>
          </button>

          <div className="hidden md:flex items-center gap-0.5 shrink-0">
            <div className="w-px h-4 bg-border/50 mx-2" />
            {STRATEGY_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => onStrategyChange(opt.key)}
                data-testid={`button-strategy-${opt.key}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  strategy === opt.key
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <div className="w-px h-4 bg-border/50 mx-2" />
          </div>

          <div className="hidden md:flex items-center gap-1 ml-auto">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.href}
                onClick={() => scrollTo(item.href)}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md"
                data-testid={`link-nav-${item.label.toLowerCase()}`}
              >
                {item.label}
              </button>
            ))}
            <Button
              size="sm"
              className="ml-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs"
              onClick={() => window.open("https://t.me/", "_blank")}
              data-testid="button-nav-contact"
            >
              <Send className="w-3 h-3 mr-1.5" />
              Написать нам
            </Button>
            <Button
              size="sm"
              className="bg-[#25D366] hover:bg-[#1fb855] text-white text-xs"
              onClick={() => window.open("https://wa.me/", "_blank")}
              data-testid="button-nav-whatsapp"
            >
              <SiWhatsapp className="w-3 h-3 mr-1.5" />
              WhatsApp
            </Button>
          </div>

          <button
            className="md:hidden p-2 text-foreground ml-auto"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-menu"
          >
            <div className="w-5 flex flex-col gap-1">
              <span className={`h-0.5 bg-foreground transition-all duration-200 ${mobileOpen ? "rotate-45 translate-y-1.5" : ""}`} />
              <span className={`h-0.5 bg-foreground transition-all duration-200 ${mobileOpen ? "opacity-0" : ""}`} />
              <span className={`h-0.5 bg-foreground transition-all duration-200 ${mobileOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
            </div>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border/50">
          <div className="px-4 py-3 flex flex-col gap-1">
            <div className="flex gap-1 pb-2 border-b border-border/30 mb-1">
              {STRATEGY_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => onStrategyChange(opt.key)}
                  data-testid={`button-mobile-strategy-${opt.key}`}
                  className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                    strategy === opt.key
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.href}
                onClick={() => scrollTo(item.href)}
                className="px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors text-left rounded-md"
                data-testid={`link-mobile-nav-${item.label.toLowerCase()}`}
              >
                {item.label}
              </button>
            ))}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Button
                className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm w-full"
                onClick={() => { setMobileOpen(false); window.open("https://t.me/", "_blank"); }}
                data-testid="button-mobile-contact"
              >
                <Send className="w-4 h-4 mr-2" />
                Telegram
              </Button>
              <Button
                className="bg-[#25D366] hover:bg-[#1fb855] text-white text-sm w-full"
                onClick={() => { setMobileOpen(false); window.open("https://wa.me/", "_blank"); }}
                data-testid="button-mobile-whatsapp"
              >
                <SiWhatsapp className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function getMetricValue(metrics: Record<string, string> | undefined, key: string, fallback: string): string {
  if (!metrics) return fallback;
  return metrics[key] || fallback;
}

function HeroEquityChart({ stats }: { stats?: StatsData }) {
  const [points, setPoints] = useState<string>("");
  const [fillPoints, setFillPoints] = useState<string>("");

  useEffect(() => {
    const w = 400, h = 100, pad = 8;
    const equity = stats?.equity;
    if (equity && equity.length > 10) {
      const step = Math.max(1, Math.floor(equity.length / 120));
      const sampled = equity.filter((_: unknown, i: number) => i % step === 0 || i === equity.length - 1);
      const values = sampled.map((p: { value: number }) => p.value);
      const minV = Math.min(...values);
      const maxV = Math.max(...values);
      const range = maxV - minV || 1;
      const pts: string[] = [];
      for (let i = 0; i < sampled.length; i++) {
        const x = (i / (sampled.length - 1)) * w;
        const y = pad + (1 - (values[i] - minV) / range) * (h - 2 * pad);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      setPoints(pts.join(" "));
      setFillPoints(pts.join(" ") + ` ${w},${h} 0,${h}`);
    } else {
      const pts: string[] = [];
      const returns = [0,1,0.5,2,-1,1.5,3,-2,1,4,-1.5,3,2,-3,5,1,2,-1,4,3,-2,6,1,-1,3,5,-2,4,7,-3,5,2,8,-1,6,3,9,1,-2,7,4,10,2,5,12,-3,8,6,14,3,7,16,-2,9,5,18,4,8,20,-4,12,7,22,5,15,25,-5,18,10,28,8,20,32,-6,22,15,35,12,25,40];
      let cumulative = 0;
      const vals: number[] = [];
      for (const r of returns) { cumulative += r; vals.push(cumulative); }
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const range = maxV - minV || 1;
      for (let i = 0; i < vals.length; i++) {
        const x = (i / (vals.length - 1)) * w;
        const y = pad + (1 - (vals[i] - minV) / range) * (h - 2 * pad);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      setPoints(pts.join(" "));
      setFillPoints(pts.join(" ") + ` ${w},${h} 0,${h}`);
    }
  }, [stats?.equity]);

  if (!points) return null;

  return (
    <div className="h-28 sm:h-36 relative overflow-hidden rounded-lg">
      <svg viewBox="0 0 400 100" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(6,182,212)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(6,182,212)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={fillPoints} fill="url(#heroGrad)" />
        <polyline points={points} fill="none" stroke="rgb(6,182,212)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function HeroSection({ stats, sc }: { stats?: StatsData; sc: StrategyConfig }) {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center overflow-hidden -mt-16 pt-16" data-testid="section-hero">
      <ParticleCanvas />
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/8 rounded-full blur-[100px]" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div className="text-left">
            <AnimatedSection>
              <div className="inline-flex items-center gap-2 mb-6 px-5 py-2 text-sm font-mono tracking-[0.15em] border border-cyan-500/30 text-cyan-400 rounded-full bg-cyan-500/5 uppercase">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
                </span>
                Алгоритмический трейдинг 24/7
              </div>
            </AnimatedSection>

            <AnimatedSection delay={100}>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-[1.08] tracking-tight">
                Алгоритм торгует.<br />
                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Вы зарабатываете.</span>
              </h1>
            </AnimatedSection>

            <AnimatedSection delay={200}>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground/80 mb-8 max-w-lg leading-relaxed">
                Алгоритмические стратегии торгуют криптовалюту 24/7. Полностью автоматизированный трейдинг по API — средства всегда на вашем счёте.
              </p>
            </AnimatedSection>

            <AnimatedSection delay={300}>
              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-12 py-7 text-lg rounded-xl cta-pulse transition-all"
                  onClick={() => window.open("https://t.me/", "_blank")}
                >
                  Подключиться
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-border/50 text-foreground bg-transparent px-8 py-6 text-base"
                  onClick={() => document.querySelector("#equity")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Результаты <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </AnimatedSection>
          </div>

          <div>
            <AnimatedSection delay={400}>
              <div className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground font-medium">{sc.label}</span>
                  <span className="text-lg sm:text-xl font-bold text-cyan-400 font-mono">
                    Кривая доходности
                  </span>
                </div>
                <HeroEquityChart stats={stats} />
              </div>
            </AnimatedSection>
            <AnimatedSection delay={500}>
              <div className="grid grid-cols-3 divide-x divide-border/20 rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm mt-4">
                {[
                  { label: "Годовой доход", value: getMetricValue(stats?.metrics, "CAGR", "—") },
                  { label: "Коэфф. Шарпа", value: getMetricValue(stats?.metrics, "Sharpe", "—") },
                  { label: "Трек-рекорд", value: stats?.dateRange ? stats.dateRange.replace(/.*?(\d{4}).*?(\d{4}).*/, "$1–$2") : "—" },
                ].map((item) => (
                  <div key={item.label} className="text-center py-5">
                    <div className="text-lg sm:text-xl font-bold text-foreground font-mono">{item.value}</div>
                    <div className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </div>
    </section>
  );
}

function ExchangesBar() {
  const exchanges = [
    { name: "Bybit", url: "https://www.bybit.com", icon: null },
    { name: "Binance", url: "https://www.binance.com", icon: "/exchanges/si_binance.svg" },
    { name: "Bitget", url: "https://www.bitget.com", icon: null },
    { name: "OKX", url: "https://www.okx.com", icon: "/exchanges/si_okx.svg" },
    { name: "BingX", url: "https://www.bingx.com", icon: null },
  ];
  return (
    <section className="py-12 px-4 sm:px-6 bg-card/40 border-y border-cyan-500/10">
      <div className="max-w-5xl mx-auto text-center">
        <AnimatedSection>
          <p className="text-lg sm:text-xl text-white font-semibold mb-8 tracking-wide">
            Доступно по API:
          </p>
          <div className="flex items-center justify-center gap-4 sm:gap-5 flex-wrap">
            {exchanges.map((ex) => (
              <a
                key={ex.name}
                href={ex.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-center gap-2.5 h-14 sm:h-16 px-5 sm:px-7 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all"
              >
                {ex.icon && (
                  <img src={ex.icon} alt="" className="h-5 sm:h-6 w-auto opacity-70 group-hover:opacity-100 transition-opacity" />
                )}
                <span className="text-base sm:text-lg font-bold tracking-wider text-white/70 group-hover:text-white transition-colors"
                  style={{ fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif" }}
                >{ex.name.toUpperCase()}</span>
              </a>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

function SocialProofBar() {
  return (
    <section className="-mt-1 py-10 px-4 sm:px-6 bg-gradient-to-r from-cyan-500/10 via-blue-500/8 to-cyan-500/10 border-y border-cyan-500/15">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 max-w-2xl mx-auto">
          {[
            "Работаем с 2018 года",
            "Прозрачная онлайн-статистика",
            "Тысячи подключённых аккаунтов",
            "Крупнейшие криптобиржи",
            "Без передачи средств",
            "Автоматическая торговля 24/7",
          ].map((text) => (
            <div key={text} className="flex items-center gap-3 text-sm sm:text-base text-white font-semibold pl-4 sm:pl-6">
              <CheckCircle className="w-5 h-5 text-cyan-400 shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function localizeDate(s: string): string {
  const months: Record<string, string> = {
    January: "января", February: "февраля", March: "марта", April: "апреля",
    May: "мая", June: "июня", July: "июля", August: "августа",
    September: "сентября", October: "октября", November: "ноября", December: "декабря",
  };
  return s.replace(/(\w+)\s+(\d+),\s+(\d+)/g, (_m, mon, day, year) => `${day} ${months[mon] ?? mon} ${year}`);
}

function calcAvgYearly(m: Record<string, string> | undefined, _dateRange: string | undefined): string {
  if (!m) return "---";
  return m["CAGR"] || "---";
}

function MetricsSection({ stats, isLoading, strategyKey }: { stats?: StatsData; isLoading: boolean; strategyKey?: string }) {
  const m = stats?.metrics;
  const metricsCards = [
    {
      label: "Общий доход",
      value: getMetricValue(m, "Cumulative Return", getMetricValue(m, "Total Return", "---")),
    },
    {
      label: "Годовой доход",
      value: calcAvgYearly(m, stats?.dateRange),
    },
    {
      label: "Коэффициент Шарпа",
      value: getMetricValue(m, "Sharpe", "---"),
    },
    {
      label: "Макс. просадка",
      value: getMetricValue(m, "Max Drawdown", "---"),
    },
  ];

  return (
    <section id="metrics" className="py-12 px-4 sm:px-6 relative bg-card/30 border-y border-border/10" data-testid="section-metrics">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Ключевые показатели
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              {stats?.dateRange ? `Период: ${localizeDate(stats.dateRange)}` : "Загрузка данных..."}
            </p>
            <LiveDataBadge text="Реальный торговый счёт" />
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metricsCards.map((metric, i) => (
            <AnimatedSection key={metric.label} delay={i * 80}>
              <div className="text-center py-6 px-4 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm" data-testid={`card-metric-${metric.label.toLowerCase().replace(/\s/g, "-")}`}>
                {isLoading ? (
                  <Skeleton className="h-8 w-20 mx-auto mb-2" />
                ) : (
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-foreground mb-2" data-testid={`text-metric-${metric.label.toLowerCase().replace(/\s/g, "-")}`}>
                    {metric.value}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">{metric.label}</div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChartPeriodFilter({
  allData,
  onFilter,
  rebaseOnFilter = false,
  additiveRebase = false,
}: {
  allData: { date: string; value: number }[];
  onFilter: (filtered: { date: string; value: number }[]) => void;
  rebaseOnFilter?: boolean;
  additiveRebase?: boolean;
}) {
  const years = Array.from(new Set(allData.map((d) => d.date.substring(0, 4)))).sort();
  const [active, setActive] = useState<string>("all");
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [calOpen, setCalOpen] = useState(false);
  const [leftMonth, setLeftMonth] = useState<Date | undefined>(undefined);
  const [rightMonth, setRightMonth] = useState<Date | undefined>(undefined);

  const allowedDates = useMemo(
    () => new Set(allData.map((d) => d.date)),
    [allData]
  );

  function toLocalISO(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const minDate = allData.length ? new Date(allData[0].date + "T00:00:00") : undefined;
  const maxDate = allData.length ? new Date(allData[allData.length - 1].date + "T00:00:00") : undefined;

  function isDisabled(date: Date) {
    if (!minDate || !maxDate) return true;
    return date < minDate || date > maxDate;
  }

  function maybeRebase(slice: { date: string; value: number }[]) {
    if (!rebaseOnFilter || slice.length === 0) return slice;
    if (additiveRebase) {
      const base = slice[0].value;
      return slice.map((d) => ({ ...d, value: parseFloat((d.value - base).toFixed(4)) }));
    }
    const baseMul = 1 + slice[0].value / 100;
    return slice.map((d) => ({ ...d, value: parseFloat((((1 + d.value / 100) / baseMul - 1) * 100).toFixed(4)) }));
  }

  function applyYearOrAll(period: string) {
    setRange(undefined);
    setActive(period);
    if (period === "all") {
      onFilter(allData);
    } else {
      onFilter(maybeRebase(allData.filter((d) => d.date.startsWith(period))));
    }
  }

  function handleRangeSelect(r: DateRange | undefined) {
    setRange(r);
    if (!r) { onFilter(allData); return; }
    const from = r.from ? toLocalISO(r.from) : null;
    const to = r.to ? toLocalISO(r.to) : null;
    if (from && to) {
      const [lo, hi] = from <= to ? [from, to] : [to, from];
      const filtered = allData.filter((d) => d.date >= lo && d.date <= hi);
      if (filtered.length > 0) {
        onFilter(maybeRebase(filtered));
      } else {
        const nearIdx = allData.findIndex((d) => d.date >= lo);
        if (nearIdx >= 0) {
          onFilter(maybeRebase(allData.slice(nearIdx, nearIdx + 1)));
        }
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto" data-testid="chart-period-filter">
      <button
        onClick={() => applyYearOrAll("all")}
        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${active === "all" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40" : "bg-background/50 border border-border/50 text-muted-foreground hover:text-foreground"}`}
        data-testid="button-filter-all"
      >
        Всё время
      </button>
      {years.map((y) => (
        <button
          key={y}
          onClick={() => applyYearOrAll(y)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${active === y ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40" : "bg-background/50 border border-border/50 text-muted-foreground hover:text-foreground"}`}
          data-testid={`button-filter-${y}`}
        >
          {y}
        </button>
      ))}
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <button
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${range?.from ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40" : "bg-background/50 border border-border/50 text-muted-foreground hover:text-foreground"}`}
            data-testid="button-filter-calendar"
          >
            <CalendarRange className="w-3 h-3" />
            Период
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-card border-border/50" align="start">
          <div className="flex gap-0 p-3 calendar-dark-dropdowns">
            <CalendarPicker
              mode="range"
              selected={range}
              onSelect={handleRangeSelect}
              disabled={isDisabled}
              numberOfMonths={1}
              captionLayout="dropdown"
              fromYear={minDate?.getFullYear()}
              toYear={maxDate?.getFullYear()}
              month={leftMonth || minDate}
              onMonthChange={setLeftMonth}
            />
            <CalendarPicker
              mode="range"
              selected={range}
              onSelect={handleRangeSelect}
              disabled={isDisabled}
              numberOfMonths={1}
              captionLayout="dropdown"
              fromYear={minDate?.getFullYear()}
              toYear={maxDate?.getFullYear()}
              month={rightMonth || maxDate}
              onMonthChange={setRightMonth}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ChartLiveBadge({ text }: { text: string }) {
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
      </span>
      <span className="text-[10px] text-emerald-400/80">{text}</span>
    </div>
  );
}

function EquityChartSection({ stats, isLoading, strategyKey }: { stats?: StatsData; isLoading: boolean; strategyKey: StrategyKey }) {
  const equityRaw = stats?.equity ?? [];
  const [filteredData, setFilteredData] = useState(equityRaw);

  useEffect(() => {
    setFilteredData(equityRaw);
  }, [equityRaw]);

  return (
    <section id="equity" className="py-12 px-4 sm:px-6 relative" data-testid="section-equity">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Результаты стратегии
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Рост капитала и эквити стратегии
            </p>
            <LiveDataBadge text="Обновляется ежедневно · API Binance" />
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-sm font-semibold text-foreground">Кривая доходности</h3>
              {equityRaw.length > 0 && (
                <ChartPeriodFilter allData={equityRaw} onFilter={setFilteredData} rebaseOnFilter additiveRebase />
              )}
            </div>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : filteredData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Нет данных</div>
            ) : (
              <div className="h-[300px] sm:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickFormatter={(v: string) => {
                        const d = new Date(v);
                        if (filteredData.length <= 90) return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
                        if (filteredData.length <= 365) return d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
                        return d.getFullYear().toString();
                      }}
                      interval={Math.max(1, Math.floor(filteredData.length / 8))}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => v.toFixed(0) + "%"}
                      width={45}
                    />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload?.length) return null;
                        const val = payload[0].value as number;
                        const dateStr = new Date(label).toLocaleDateString("ru-RU", { month: "long", day: "numeric", year: "numeric" });
                        return (
                          <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-xl min-w-[200px]">
                            <p className="text-sm font-bold text-foreground mb-1">{dateStr}</p>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-xs text-muted-foreground">Доходность</span>
                              <span className={`text-sm font-bold font-mono ${val >= 0 ? "text-cyan-400" : "text-red-400"}`}>
                                {val >= 0 ? "+" : ""}{val.toFixed(2)}%
                              </span>
                            </div>
                            <ChartLiveBadge text="Реальный счёт" />
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#06b6d4"
                      strokeWidth={1.5}
                      fill="url(#equityGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: "#06b6d4", stroke: "#0a0e27", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}

function ResultsSection({ stats, isLoading }: { stats?: StatsData; isLoading: boolean }) {
  const m = stats?.metrics;
  const eoyReturns = stats?.eoyReturns ?? [];

  const resultStats = [
    { label: "Прибыльных месяцев", value: getMetricValue(m, "Win Month", "—") },
    { label: "Лучший месяц", value: getMetricValue(m, "Best Month", "—") },
    { label: "Худший месяц", value: getMetricValue(m, "Worst Month", "—") },
    { label: "Ср. прибыльный месяц", value: getMetricValue(m, "Avg. Up Month", "—") },
    { label: "Ср. убыточный месяц", value: getMetricValue(m, "Avg. Down Month", "—") },
    { label: "Лучший год", value: getMetricValue(m, "Best Year", "—") },
    { label: "Худший год", value: getMetricValue(m, "Worst Year", "—") },
    { label: "Прибыльных лет", value: getMetricValue(m, "Win Year", "—") },
  ];

  return (
    <section id="results" className="py-12 px-4 sm:px-6 relative bg-card/30 border-y border-border/10" data-testid="section-results">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Результаты
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Годовые доходности и ключевая статистика
            </p>
            <LiveDataBadge text="На основе верифицированных реальных результатов по API" />
          </div>
        </AnimatedSection>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <AnimatedSection delay={100}>
            <Card className="overflow-hidden bg-card/50 backdrop-blur-sm border-border/50">
              <div className="p-4 border-b border-border/30">
                <h3 className="text-sm font-semibold text-foreground">Годовые доходности</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Год</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Доходность</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-cyan-400">Накопленная</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eoyReturns.map((row) => (
                      <tr key={row.year} className="border-b border-border/20 last:border-0">
                        <td className="px-4 py-3 font-semibold text-sm text-foreground">{row.year}</td>
                        <td className={`px-4 py-3 text-center font-mono text-sm ${row.returnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {row.returnPct >= 0 ? '+' : ''}{row.returnPct.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-cyan-400">{row.cumulative}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </AnimatedSection>

          <AnimatedSection delay={200}>
            <Card className="overflow-hidden bg-card/50 backdrop-blur-sm border-border/50">
              <div className="p-4 border-b border-border/30">
                <h3 className="text-sm font-semibold text-foreground">Статистика результатов</h3>
              </div>
              <div className="p-4 space-y-0">
                {resultStats.map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-border/20 last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-mono font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

const ACCESS_TERMS_BASE = [
  { label: "Минимальная аллокация", value: "$500" },
  { label: "Комиссия за управление", value: "0%" },
  { label: "Комиссия за результат", value: "30%" },
  { label: "Принцип «высшей отметки»", value: "Применяется" },
  { label: "Срок блокировки", value: "Отсутствует" },
  { label: "Распределение комиссий", value: "Раз в квартал" },
  { label: "Формат подключения", value: "API-ключ через биржу" },
  { label: "Торговые активы", value: "10 торговых пар, 5 подходов" },
  { label: "Обеспечение", value: "USDT" },
  { label: "Биржи", value: "Binance, OKX, Bybit, Bitget, BingX" },
];

function AccessTermsSection({ sc }: { sc: StrategyConfig }) {
  const terms = ACCESS_TERMS_BASE;
  return (
    <section id="terms" className="py-12 px-4 sm:px-6 relative bg-card/30 border-y border-border/10" data-testid="section-terms">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Условия подключения
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Автоматический алготрейдинг — просто и безопасно
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {terms.map((term) => (
              <Card key={term.label} className="p-5 bg-card/50 backdrop-blur-sm border-border/50 h-full" data-testid={`card-term-${term.label.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="text-xs text-muted-foreground mb-1.5">{term.label}</div>
                <div className="text-sm font-semibold text-foreground">{term.value}</div>
              </Card>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

function ExchangeLogos({ strategyKey }: { strategyKey: string }) {
  return null;
}

function buildFaqItems(sc: StrategyConfig) {
  return [
    {
      q: "Как работает сервис?",
      a: `Управляющая компания подключается к субаккаунту клиента на бирже через API и управляет торговлей по стратегии ${sc.label}. Систематический портфель на основе ${sc.approachFull} работает непрерывно и полностью автоматически — без дискреционного вмешательства. Ваш капитал всегда остаётся на вашем счёте на бирже.`,
    },
    {
      q: "Где хранятся мои средства?",
      a: "Ваш капитал остаётся на вашем субаккаунте на бирже (OKX, Binance или любой другой). Управляющая компания получает только торговый API-доступ — без разрешения на вывод или перевод средств. Вы сохраняете полный контроль над своими средствами.",
    },
    {
      q: "Как начать работу?",
      a: "Свяжитесь с нами через Telegram для начала онбординга. Мы поможем вам создать API-ключ на бирже (без возможности вывода средств, разрешения только на торговлю) и подключим вашу учётную запись к алгоритму. Процесс занимает менее 10 минут.",
    },
    {
      q: "Каков минимальный размер аллокации?",
      a: "Минимальная аллокация — $500. Мы поддерживаем все основные криптовалютные биржи.",
    },
    {
      q: "Какие комиссии применяются?",
      a: "Комиссия за управление составляет 0%, плюс комиссия за результат 30% с принципом «высшей отметки». Комиссии рассчитываются и распределяются ежеквартально. Срок блокировки средств отсутствует.",
    },
    {
      q: "Какие биржи поддерживаются?",
      a: "Binance, OKX, Bybit, Bitget, BingX. Подключение через API-ключ биржи.",
    },
    {
      q: "Какие активы торгуются?",
      a: "Стратегии торгуют бессрочными фьючерсами на BTC и ETH.",
    },
    {
      q: "Какие меры управления рисками применяются?",
      a: `Каждая сделка открывается с фиксированным риском. Стоп-лоссы и тейк-профиты калибруются автоматически с учётом текущей волатильности. В периоды аномальной волатильности система снижает активность. Круглосуточный автоматический мониторинг.`,
    },
    {
      q: "Данные о результатах — бэктест или реальная торговля?",
      a: "Представленные на сайте данные основаны на результатах реальной алгоритмической торговли. Прошлые результаты не являются показателем будущих результатов.",
    },
  ];
}

function FAQSection({ sc }: { sc: StrategyConfig }) {
  const FAQ_ITEMS = buildFaqItems(sc);
  return (
    <section id="faq" className="py-12 px-4 sm:px-6 relative bg-card/30 border-y border-border/10" data-testid="section-faq">
      <div className="max-w-3xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Часто задаваемые вопросы
            </h2>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-border/30 rounded-md px-4 bg-card/30 backdrop-blur-sm"
              >
                <AccordionTrigger
                  className="text-sm font-medium text-foreground hover:no-underline py-4 text-left"
                  data-testid={`button-faq-${i}`}
                >
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AnimatedSection>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/30" data-testid="section-footer">
      <div className="px-4 sm:px-6 pb-10">
        <div className="max-w-7xl mx-auto pt-8">
          <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-5xl mx-auto text-center">
            <strong>Отказ от ответственности:</strong> Алгоритмическая торговля цифровыми активами сопряжена со значительными рисками и подходит только для квалифицированных клиентов. Цифровые активы высоко волатильны и носят спекулятивный характер. Стратегии могут испытывать существенные просадки в неблагоприятных рыночных условиях. Рынки криптовалют подвержены развивающейся и неопределённой нормативной среде. Существует биржевой риск контрагента, включая возможность отказа биржи или нарушений безопасности. Прошлые результаты не являются показателем будущих результатов. Клиенты должны иметь достаточный баланс, чтобы переносить потерю значительной части или всего вложенного капитала. Данный сервис не подходит для клиентов, которые не могут перенести существенные потери капитала или которым требуется ликвидность в короткие сроки.
          </p>
          <div className="mt-4 text-xs text-muted-foreground/40 text-center">
            &copy; {new Date().getFullYear()} Управляющая компания. Все права защищены.
          </div>
        </div>
      </div>
    </footer>
  );
}

function LegalDisclaimerModal() {
  const [accepted, setAccepted] = useState(false);

  if (accepted) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col bg-card border border-border/50 rounded-md shadow-2xl">
        <div className="px-6 pt-6 pb-4 border-b border-border/30">
          <h2 className="text-lg font-semibold text-foreground">Важная правовая информация</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm text-muted-foreground leading-relaxed custom-scrollbar">
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Только информационные цели</h3>
            <p>Настоящий сайт предоставлен исключительно в информационных целях и не является предложением о продаже, запросом на предложение или какой-либо формой инвестиционного совета. Доступ к данному сервису предоставляется только квалифицированным клиентам, соответствующим применимым критериям приемлемости, и заключившим соглашение об оказании услуг с Управляющая компания.</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Не является инвестиционным советом</h3>
            <p>Ничто на этом сайте не является инвестиционным, юридическим, налоговым или иным советом. Потенциальным клиентам следует проконсультироваться с собственными профессиональными советниками относительно пригодности данного сервиса для их обстоятельств.</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Риск потерь</h3>
            <p>Алгоритмическая торговля цифровыми активами сопряжена со значительными рисками, включая возможную потерю всей или значительной части вложенного капитала. Цифровые активы высоко волатильны и носят спекулятивный характер. Данный сервис подходит только для клиентов, которые могут позволить себе потерять всю аллокацию.</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Прошлые результаты</h3>
            <p>Прошлые результаты не являются показателем будущих результатов. Представленные на сайте данные отражают результаты реальной алгоритмической торговли. Исторические результаты не являются гарантией будущей доходности и не отражают влияние всех возможных рыночных сценариев на результаты стратегии.</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Отсутствие гарантий</h3>
            <p>Нет гарантии, что стратегии достигнут своих целей. Целевая доходность и метрики риска являются целями, а не гарантиями. Существенные просадки могут возникать в неблагоприятных рыночных условиях.</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Биржевые и контрагентские риски</h3>
            <p>Средства клиентов остаются на собственном субаккаунте клиента на бирже. Управляющая компания имеет только API-доступ для торговли без разрешения на вывод средств. Существует биржевой риск контрагента, включая возможность отказа биржи или нарушений безопасности, оценка которых лежит на клиенте.</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Прогнозные заявления</h3>
            <p>Этот сайт может содержать прогнозные заявления. Такие заявления подвержены рискам и неопределённостям, которые могут привести к существенным отличиям фактических результатов. Управляющая компания не берёт на себя обязательства по обновлению прогнозных заявлений.</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Доступ по инициативе клиента</h3>
            <p>Содержание этого сайта доступно только лицам, получившим к нему доступ по собственной инициативе, без какого-либо прямого или косвенного привлечения со стороны Управляющая компания. Если вы не заходили на этот сайт по собственной инициативе, вам следует немедленно покинуть его.</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Ограниченные юрисдикции</h3>
            <p>Информация на этом сайте не предназначена для распространения среди лиц или организаций в какой-либо юрисдикции или стране, где такое распространение или использование противоречило бы местному законодательству или нормативным требованиям.</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border/30 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => window.location.href = "https://www.google.com"}
            data-testid="button-leave-site"
          >
            Покинуть сайт
          </Button>
          <Button
            onClick={() => setAccepted(true)}
            data-testid="button-accept-disclaimer"
          >
            Принимаю
          </Button>
        </div>
      </div>
    </div>
  );
}

const STRATEGY_SLUG_MAP: Record<string, StrategyKey> = {
  basket50: "basket50",
  basket70tf: "basket70tf",
};

function getStrategyFromPath(): StrategyKey {
  const path = window.location.pathname.replace(/^\//, "").toLowerCase();
  return STRATEGY_SLUG_MAP[path] || "basket50";
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [strategy, setStrategyState] = useState<StrategyKey>(getStrategyFromPath);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setStrategy = useCallback((key: StrategyKey) => {
    setStrategyState(key);
    setLocation(`/${key}`);
  }, [setLocation]);
  const sc = STRATEGIES[strategy];

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/stats?strategy=${strategy}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setStats(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [strategy]);

  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      <LegalDisclaimerModal />
      <Navbar strategy={strategy} onStrategyChange={setStrategy} />
      <HeroSection stats={stats ?? undefined} sc={sc} />

      <ExchangesBar />
      <SocialProofBar />

      <EquityChartSection stats={stats ?? undefined} isLoading={isLoading} strategyKey={strategy} />
      <MetricsSection stats={stats ?? undefined} isLoading={isLoading} strategyKey={strategy} />
      <ResultsSection stats={stats ?? undefined} isLoading={isLoading} />

      <section className="py-12 px-4 sm:px-6 relative" data-testid="section-strategy">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Как устроена стратегия</h2>
              <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
                15 торговых систем на 2 наиболее ликвидных парах — BTC и ETH. Полностью автоматизированное исполнение с встроенным контролем рисков.
              </p>
            </div>
          </AnimatedSection>
          <div className="grid sm:grid-cols-2 gap-px bg-border/20 rounded-2xl overflow-hidden border border-border/30">
            {[
              {
                num: "01",
                title: "Диверсификация",
                desc: "15 независимых торговых систем снижают зависимость от одного рыночного режима. Торговля ведётся на BTC и ETH — как в лонг, так и в шорт.",
                accent: "from-cyan-500/30 to-cyan-600/10",
              },
              {
                num: "02",
                title: "Контроль рисков",
                desc: "Каждая позиция ограничена по размеру и имеет стоп-лосс. Общий риск портфеля контролируется на уровне корреляций между стратегиями.",
                accent: "from-blue-500/30 to-blue-600/10",
              },
              {
                num: "03",
                title: "Автоматизация",
                desc: "Алгоритм исполняет сделки 24/7 без участия человека. Решения основаны на математических моделях.",
                accent: "from-violet-500/30 to-violet-600/10",
              },
              {
                num: "04",
                title: "Адаптивность",
                desc: "15 стратегий используют моментум, возврат к среднему и кластеризацию волатильности — подходы для разных рыночных фаз.",
                accent: "from-emerald-500/30 to-emerald-600/10",
              },
            ].map((item, i) => (
              <AnimatedSection key={item.num} delay={i * 80}>
                <div className="p-4 sm:p-6 bg-card/60 backdrop-blur-sm h-full relative group hover:bg-card/80 transition-colors flex gap-3 sm:gap-4">
                  <div className={`w-1 shrink-0 rounded-full bg-gradient-to-b ${item.accent}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1 sm:mb-2">
                      <h3 className="text-sm sm:text-base font-semibold text-foreground">{item.title}</h3>
                      <span className="text-2xl sm:text-3xl font-black text-border/30 select-none leading-none ml-2">{item.num}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-12 px-4 sm:px-6 relative">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Как это работает</h2>
              <p className="text-muted-foreground text-sm max-w-lg mx-auto">Алготрейдинг через API биржи — просто и быстро</p>
            </div>
          </AnimatedSection>
          <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3 sm:gap-6">
            {[
              { step: "01", title: "Откройте счёт на бирже", desc: "Binance, OKX, Bybit, Bitget, BingX. Минимум — $500." },
              { step: "02", title: "Свяжитесь с нами", desc: "Telegram / WhatsApp. Подключение через API-ключ за 10 минут." },
              { step: "03", title: "Алгоритм работает за вас", desc: "Торговля 24/7. Комиссия 30% с прибыли. Без блокировки средств." },
            ].map((item) => (
              <AnimatedSection key={item.step} delay={parseInt(item.step) * 100}>
                <div className="flex sm:flex-col items-center sm:text-center gap-4 sm:gap-0 p-4 sm:p-6 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm h-full">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 shrink-0 sm:mx-auto sm:mb-5 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm sm:text-lg">{item.step}</span>
                  </div>
                  <div className="flex-1 sm:flex-none">
                    <h3 className="text-sm sm:text-lg font-semibold text-foreground mb-1 sm:mb-3">{item.title}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section id="advantages" className="py-12 px-4 sm:px-6 relative bg-card/30 border-y border-border/10">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Почему алготрейдинг по API</h2>
              <p className="text-muted-foreground text-sm max-w-lg mx-auto">Преимущества алгоритмической торговли</p>
            </div>
          </AnimatedSection>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: Shield, title: "Без передачи средств", desc: "Деньги всегда на вашем биржевом счёте." },
              { icon: Wallet, title: "Вывод в любой момент", desc: "Нет блокировки средств." },
              { icon: Eye, title: "Полная прозрачность", desc: "Каждая сделка видна в приложении биржи." },
              { icon: PercentCircle, title: "Честная комиссия", desc: "30% только с прибыли." },
            ].map((item, i) => (
              <AnimatedSection key={item.title} delay={i * 80}>
                <div className="p-4 sm:p-6 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm h-full text-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center">
                    <item.icon className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1 sm:mb-2">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>


      <section className="py-12 px-4 sm:px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Готовы подключиться?</h2>
          <p className="text-muted-foreground text-sm mb-8 max-w-lg mx-auto">
            Свяжитесь с нашей командой напрямую. Мы расскажем о стратегии, подключении и процессе онбординга.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 mb-8 text-sm text-muted-foreground max-w-xs sm:max-w-md mx-auto">
            {[
              "Многолетний опыт",
              "Тысячи аккаунтов",
              "Прозрачная статистика",
              "10 минут на подключение",
              "Поддержка 24/7",
              "Без передачи средств",
            ].map((text) => (
              <div key={text} className="flex items-center gap-2 pl-2">
                <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 min-w-[200px] cta-pulse transition-all"
              onClick={() => window.open("https://t.me/", "_blank")}
            >
              <Send className="w-4 h-4 mr-2" />
              Написать нам в Telegram
            </Button>
            <Button
              size="lg"
              className="bg-[#25D366] hover:bg-[#1fb855] text-white shadow-lg shadow-green-500/20 min-w-[200px]"
              onClick={() => window.open("https://wa.me/", "_blank")}
            >
              <SiWhatsapp className="w-4 h-4 mr-2" />
              Написать нам в WhatsApp
            </Button>
          </div>
        </div>
      </section>

      <FAQSection sc={sc} />

      <Footer />
    </div>
  );
}
