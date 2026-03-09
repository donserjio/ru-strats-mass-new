import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import { SiBinance, SiOkx, SiKucoin, SiWhatsapp } from "react-icons/si";
import {
  TrendingUp,
  TrendingDown,
  Shield,
  Zap,
  BarChart3,
  ArrowRight,
  ChevronUp,
  Activity,
  Target,
  Layers,
  Clock,
  DollarSign,
  Lock,
  ExternalLink,
  Wallet,
  Calendar,
  FileText,
  Download,
  Send,
  CalendarRange,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
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

type StrategyKey = "basket50";

interface StrategyConfig {
  key: StrategyKey;
  label: string;
  count: number;
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

const STRATEGIES: Record<StrategyKey, StrategyConfig> = {
  basket50: {
    key: "basket50",
    label: "Algo Strategy",
    count: 50,
    approachShort: "Систематический алгоритмический подход",
    approachFull: "комбинации количественных торговых систем",
    desc: "Алгоритмическая стратегия, торгующая 10 криптовалютных пар с использованием 5 торговых подходов. Комбинация нескольких количественных систем обеспечивает стабильную доходность в различных фазах рынка. Стратегия ориентирована на краткосрочные движения и эффективно работает как на растущем, так и на падающем рынке.",
    archDesc: "Алгоритм использует 5 независимых торговых подходов на 10 криптовалютных парах. Диверсификация по стратегиям снижает зависимость от одного рыночного режима. Система торгует как в лонг, так и в шорт, адаптируясь к текущим условиям рынка.",
    riskDesc: "Каждая сделка открывается с заранее определённым риском. Стоп-лоссы и тейк-профиты калибруются автоматически с учётом текущей волатильности. В периоды аномальной волатильности система снижает активность для защиты капитала.",
    execDesc: "Исполнение сделок полностью автоматизировано. Алгоритм выбирает оптимальный тип ордера в зависимости от рыночных условий. Круглосуточный мониторинг обеспечивает стабильную работу без участия трейдера.",
    strategyType: "Количественная, систематическая",
    holdingPeriod: "< 3 дней",
    capacity: "$200M",
  },
  basket70: {
    key: "basket70",
    label: "Basket 70",
    count: 70,
    approachShort: "Моментум и возврат к среднему значению",
    approachFull: "эффекта моментума и кластеризации волатильности с возвратом к среднему значению",
    desc: "Корзина нескольких активных трендовых стратегий, основанных на эффекте моментума и усиленных за счёт кластеризации волатильности, с компонентом возврата к среднему значению для повышения эффективности портфеля.",
    archDesc: "Basket 70 сочетает активное следование за трендом на основе эффекта моментума и кластеризации волатильности с компонентом возврата к среднему значению. Каждая сделка открывается с фиксированным риском — убыточные позиции не усредняются, прибыльные могут наращиваться через пирамидинг. Стратегия работает как в лонг, так и в шорт, всегда в одну сторону на сделку. Сильные направленные движения рынка чаще являются источником дохода, а не риска.",
    riskDesc: "Надёжная система, основные компоненты которой остаются неизменными более 12 лет, с историей реальной торговли на крипторынке свыше 6 лет. Фиксированный риск на сделку со стоп-лоссами и тейк-профитами, откалиброванными под волатильность рынка. Кластеризация волатильности встроена для улучшения определения режима рынка и калибровки риска. Отсутствие сделок в периоды экстремальной волатильности — намеренный аспект стратегии.",
    execDesc: "Вход в рынок осуществляется рыночными или лимитными ордерами в зависимости от условий рынка. Для крупных объёмов доступен высокоскоростной алгоритм TWAP. Каждый компонент тщательно протестирован на FORTS, Forex, сырьевых товарах и крипторынке на протяжении более десяти лет. Моделирование методом Монте-Карло применяется как вспомогательный инструмент. Вся торговля полностью автоматизирована с круглосуточным мониторингом.",
    strategyType: "Моментум и возврат к среднему значению, систематическая",
    holdingPeriod: "< 3 дней",
    capacity: "$200M",
  },
  basket70tf: {
    key: "basket70tf",
    label: "Basket 70 TF",
    count: 70,
    approachShort: "Следование за трендом",
    approachFull: "следования за трендом на основе эффекта моментума",
    desc: "Портфель активных торговых систем, ориентированных преимущественно на извлечение прибыли из направленных рыночных движений и эффекта моментума, с ограниченной долей стратегий возврата к среднему значению. Отдельные компоненты удерживают позиции до двух недель для извлечения прибыли из устойчивых рыночных трендов.",
    archDesc: "Basket 70 TF включает более высокую долю чистых трендовых систем, удерживающих позиции более длительное время — за рамками краткосрочных импульсов. Кластеризация волатильности используется для улучшения качества точек входа и управления рисками. Убыточные позиции никогда не усредняются — прибыльные могут наращиваться через пирамидинг в направлении тренда. Стратегия ориентирована на получение выгоды от устойчивых ценовых движений, а не от краткосрочных колебаний.",
    riskDesc: "Фиксированный риск на позицию без усреднения убытков. Стоп-лоссы и тейк-профиты учитывают волатильность рынка. Стратегия ставит во главу угла сохранение капитала в условиях экстремальной волатильности — в таких условиях алгоритмы намеренно сокращают или полностью прекращают торговую активность. Этот подход основан на историческом анализе и отражает долгосрочный фокус на контроле рисков.",
    execDesc: "Вход в рынок осуществляется рыночными или лимитными ордерами. Алгоритм TWAP доступен для исполнения крупных ордеров. Отдельные трендовые компоненты способны удерживать позиции до 14 дней для захвата продолжительных и чётко сформированных рыночных трендов. Каждая система протестирована на FORTS, Forex, сырьевых товарах и крипторынке более десяти лет. Полностью автоматизировано с круглосуточным мониторингом.",
    strategyType: "Моментум, возврат к среднему значению, следование за трендом, систематическая",
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
  { label: "Показатели", href: "#metrics" },
  { label: "Как работает", href: "#how-it-works" },
  { label: "Преимущества", href: "#advantages" },
  { label: "Эквити", href: "#equity" },
  { label: "Риски", href: "#risk" },
  { label: "Условия", href: "#terms" },
  { label: "FAQ", href: "#faq" },
];

const STRATEGY_OPTIONS: { key: StrategyKey; label: string }[] = [
  { key: "basket50", label: "Algo Strategy" },
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
            <div className="h-7 w-24 border border-dashed border-cyan-500/30 rounded flex items-center justify-center text-muted-foreground/50 text-xs">ЛОГО</div>
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
            <div className="flex gap-2 mt-1">
              <Button
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm"
                onClick={() => { setMobileOpen(false); window.open("https://t.me/", "_blank"); }}
                data-testid="button-mobile-contact"
              >
                <Send className="w-4 h-4 mr-2" />
                Написать нам
              </Button>
              <Button
                className="bg-[#25D366] hover:bg-[#1fb855] text-white text-sm px-4"
                onClick={() => { setMobileOpen(false); window.open("https://wa.me/", "_blank"); }}
                data-testid="button-mobile-whatsapp"
              >
                <SiWhatsapp className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function getMetricValue(_metrics: Record<string, string> | undefined, _key: string, _fallback: string): string {
  return "—";
}
function _getMetricValueReal(metrics: Record<string, string> | undefined, key: string, fallback: string): string {
  if (!metrics) return fallback;
  return metrics[key] || fallback;
}

function StrategyLabel({ label }: { label: string }) {
  const textRef = useRef<SVGTextElement>(null);
  const [svgWidth, setSvgWidth] = useState(560);

  useLayoutEffect(() => {
    const update = () => {
      if (textRef.current) {
        try {
          const bbox = textRef.current.getBBox();
          if (bbox.width > 0) setSvgWidth(Math.ceil(bbox.x + bbox.width) + 4);
        } catch {}
      }
    };
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(update);
    } else {
      update();
    }
  }, [label]);

  return (
    <svg
      viewBox={`0 0 ${svgWidth} 114`}
      className="h-10 sm:h-[4rem] md:h-[6.6rem] shrink-0"
      aria-label={label}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="stratLabelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
      <text
        ref={textRef}
        x="0"
        y="88.49"
        fontSize="99"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontWeight="300"
        fill="url(#stratLabelGrad)"
        letterSpacing="-2"
      >
        {label}
      </text>
    </svg>
  );
}

function HeroEquityChart() {
  const [points, setPoints] = useState<string>("");
  const [fillPoints, setFillPoints] = useState<string>("");

  useEffect(() => {
    const w = 400, h = 100, pad = 5;
    const pts: string[] = [];
    for (let i = 0; i <= 80; i++) {
      const x = (i / 80) * w;
      const progress = i / 80;
      const base = pad + (1 - (progress * 0.7 + 0.1)) * (h - 2 * pad);
      const noise = Math.sin(i * 0.5) * 4 + Math.sin(i * 1.3) * 2 + Math.cos(i * 0.3) * 3;
      const y = Math.max(pad, Math.min(h - pad, base + noise));
      pts.push(`${x},${y}`);
    }
    setPoints(pts.join(" "));
    setFillPoints(pts.join(" ") + ` ${w},${h} 0,${h}`);
  }, []);

  if (!points) return null;

  return (
    <div className="h-24 sm:h-32 relative overflow-hidden rounded-lg">
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
      <div className="absolute bottom-2 right-3 text-xs text-cyan-400/30">equity curve</div>
    </div>
  );
}

function HeroSection({ stats, sc }: { stats?: StatsData; sc: StrategyConfig }) {
  const m = stats?.metrics;
  const avgYearly = sc.key === "quantumalpha" ? getMetricValue(m, "Avg Yearly", "---") : calcAvgYearly(m, stats?.dateRange);
  const avgYearlyLabel = sc.key === "quantumalpha" ? "Ср. в год" : "Годовой доход";
  const sharpe = getMetricValue(m, "Sharpe", "---");
  const maxDD = getMetricValue(m, "Max Drawdown", "---");

  return (
    <section className="relative min-h-screen flex items-start overflow-hidden" data-testid="section-hero">
      <ParticleCanvas />
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/8 rounded-full blur-[100px]" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Two-column hero layout */}
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center pt-16 sm:pt-20">
          {/* LEFT: Text + CTA */}
          <div className="text-left">
            <AnimatedSection>
              <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 text-xs font-mono tracking-[0.2em] border border-cyan-500/30 text-cyan-400/80 rounded-full bg-cyan-500/5 uppercase">
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                Автоматический трейдинг
              </div>
            </AnimatedSection>

            <AnimatedSection delay={100}>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.8rem] font-bold text-foreground mb-4 leading-[1.15]">
                Алгоритм торгует.<br />
                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Вы зарабатываете.</span>
              </h1>
            </AnimatedSection>

            <AnimatedSection delay={200}>
              <p className="text-sm sm:text-base text-muted-foreground/70 mb-6 max-w-md leading-relaxed">
                Алгоритм торгует 10 криптовалютных пар 24/7. Подключение через официальный копитрейдинг бирж — средства всегда на вашем счёте, без передачи капитала третьим лицам.
              </p>
            </AnimatedSection>

            <AnimatedSection delay={300}>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold px-8"
                  onClick={() => window.open("https://t.me/", "_blank")}
                >
                  Подключиться
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-border/50 text-foreground bg-transparent"
                  onClick={() => document.querySelector("#metrics")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Результаты <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </AnimatedSection>
          </div>

          {/* RIGHT: Chart + metrics */}
          <div>
            <AnimatedSection delay={400}>
              <div className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground font-medium">Algo Strategy · Equity Curve</span>
                  <span className="text-lg sm:text-xl font-bold text-cyan-400 font-mono">
                    Equity Curve
                  </span>
                </div>
                <HeroEquityChart />
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/20">
                  {[
                    { label: "CAGR", value: "—" },
                    { label: "SHARPE", value: "—" },
                    { label: "TRACK RECORD", value: "—" },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <div className="text-lg sm:text-xl font-bold text-foreground font-mono">{item.value}</div>
                      <div className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>

        {/* Bottom: exchanges bar */}
        <AnimatedSection delay={550}>
          <div className="flex items-center justify-center gap-5 sm:gap-8 mt-10 pb-4">
            <a href="https://www.binance.com" target="_blank" rel="noopener noreferrer"><img src="/exchanges/binance.svg" alt="Binance" className="h-4 sm:h-5 opacity-40 hover:opacity-70 transition-opacity cursor-pointer" /></a>
            <a href="https://www.okx.com" target="_blank" rel="noopener noreferrer"><img src="/exchanges/okx.svg" alt="OKX" className="h-4 sm:h-5 opacity-40 hover:opacity-70 transition-opacity cursor-pointer" /></a>
            <a href="https://www.bybit.com" target="_blank" rel="noopener noreferrer"><img src="/exchanges/bybit.svg" alt="Bybit" className="h-4 sm:h-5 opacity-40 hover:opacity-70 transition-opacity cursor-pointer" /></a>
            <a href="https://www.bitget.com" target="_blank" rel="noopener noreferrer"><img src="/exchanges/bitget.svg" alt="Bitget" className="h-4 sm:h-5 opacity-40 hover:opacity-70 transition-opacity cursor-pointer" /></a>
            <a href="https://www.bingx.com" target="_blank" rel="noopener noreferrer"><img src="/exchanges/bingx.svg" alt="BingX" className="h-4 sm:h-5 opacity-40 hover:opacity-70 transition-opacity cursor-pointer" /></a>
          </div>
        </AnimatedSection>
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

function getMetricsCards(m: Record<string, string> | undefined, dateRange: string | undefined, strategyKey?: string) {
  const isQA = strategyKey === "quantumalpha";
  return [
    {
      label: "Общий доход",
      value: getMetricValue(m, "Cumulative Return", getMetricValue(m, "Total Return", "---")),
      icon: TrendingUp,
      color: "from-cyan-500 to-blue-500",
    },
    {
      label: isQA ? "Ср. в год" : "Годовой доход",
      value: isQA ? getMetricValue(m, "Avg Yearly", "---") : calcAvgYearly(m, dateRange),
      icon: BarChart3,
      color: "from-blue-500 to-indigo-500",
    },
    {
      label: "Коэффициент Шарпа",
      value: getMetricValue(m, "Sharpe", "---"),
      icon: Target,
      color: "from-indigo-500 to-purple-500",
    },
    {
      label: "Макс. просадка",
      value: getMetricValue(m, "Max Drawdown", "---"),
      icon: Shield,
      color: "from-emerald-500 to-teal-500",
    },
    {
      label: "Волатильность",
      value: getMetricValue(m, "Volatility (ann.)", "---"),
      icon: Activity,
      color: "from-amber-500 to-orange-500",
    },
    {
      label: "Сортино",
      value: getMetricValue(m, "Sortino", "---"),
      icon: Zap,
      color: "from-rose-500 to-pink-500",
    },
  ];
}

function MetricsSection({ stats, isLoading, strategyKey }: { stats?: StatsData; isLoading: boolean; strategyKey?: string }) {
  const metricsCards = getMetricsCards(stats?.metrics, stats?.dateRange, strategyKey);

  return (
    <section id="metrics" className="py-20 px-4 sm:px-6 relative" data-testid="section-metrics">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Ключевые показатели
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              {stats?.dateRange ? `Период: ${localizeDate(stats.dateRange)}` : "Загрузка данных..."}
            </p>
            <LiveDataBadge text="Реальный торговый счёт" />
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {metricsCards.map((m, i) => (
            <AnimatedSection key={m.label} delay={i * 80}>
              <Card className="p-4 sm:p-5 text-center bg-card/50 backdrop-blur-sm border-border/50 group" data-testid={`card-metric-${m.label.toLowerCase().replace(/\s/g, "-")}`}>
                <div className={`w-10 h-10 mx-auto mb-3 rounded-md bg-gradient-to-br ${m.color} flex items-center justify-center opacity-80`}>
                  <m.icon className="w-5 h-5 text-white" />
                </div>
                {isLoading ? (
                  <Skeleton className="h-7 w-20 mx-auto mb-1" />
                ) : (
                  <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mb-1" data-testid={`text-metric-${m.label.toLowerCase().replace(/\s/g, "-")}`}>
                    {m.value}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">{m.label}</div>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function StrategyArchSection({ sc }: { sc: StrategyConfig }) {
  return (
    <section className="py-20 px-4 sm:px-6 relative">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Как устроена стратегия</h2>
            <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
              5 торговых подходов на 10 криптовалютных парах. Полностью автоматизированное исполнение с встроенным контролем рисков.
            </p>
          </div>
        </AnimatedSection>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: Layers, title: "Диверсификация", desc: "Несколько независимых подходов снижают зависимость от одного рыночного режима. Система торгует как в лонг, так и в шорт, адаптируясь к условиям рынка." },
            { icon: Shield, title: "Контроль рисков", desc: "Каждая сделка с фиксированным риском. Стоп-лоссы калибруются под текущую волатильность. В аномальные периоды система снижает активность." },
            { icon: Zap, title: "Автоматическое исполнение", desc: "Сделки исполняются 24/7 без участия человека. Алгоритм выбирает оптимальный тип ордера для минимального проскальзывания." },
            { icon: Activity, title: "Мониторинг", desc: "Круглосуточный автоматический мониторинг всех позиций и состояния рынка. Моментальная реакция на изменение условий." },
          ].map((item, i) => (
            <AnimatedSection key={item.title} delay={i * 80}>
              <Card className="p-5 bg-card/50 backdrop-blur-sm border-border/50 h-full">
                <item.icon className="w-6 h-6 text-cyan-400 mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function StrategySection({ sc }: { sc: StrategyConfig }) {
  return (
    <section id="strategy" className="py-20 px-4 sm:px-6 relative" data-testid="section-strategy">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Обзор стратегии
            </h2>
            <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
              {sc.key === "quantumalpha"
                ? <>Алгоритм — полностью автоматизированная систематическая торговая система, построенная на трёх источниках доходности: ставка финансирования, статистический арбитраж и захват направленного импульса. Без постоянного направленного уклона. 20–30 сделок в месяц.</>
                : <>{sc.label} — систематический портфель на основе {sc.approachFull}.<br />Все подключения идут через официальный копитрейдинг бирж. Средства клиента всегда остаются на его счёте.</>

              }
            </p>
          </div>
        </AnimatedSection>

        <div className="grid lg:grid-cols-2 gap-6">
          <AnimatedSection>
            <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50 h-full">
              <h3 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                Ключевые параметры
              </h3>
              <div className="space-y-4">
                {(sc.key === "quantumalpha" ? [
                  { label: "Тип стратегии", value: "Количественная, систематическая, следование за трендом" },
                  { label: "Класс активов", value: "10 торговых пар, 5 торговых подходов" },
                  { label: "Срок удержания", value: sc.holdingPeriod },
                  { label: "Стиль торговли", value: "Long/Short, без фиксированного уклона" },
                  { label: "Частота сделок", value: "20–30 сделок в месяц" },
                ] : [
                  { label: "Тип стратегии", value: sc.strategyType },
                  { label: "Класс активов", value: "10 торговых пар, 5 торговых подходов" },
                  { label: "Срок удержания", value: sc.holdingPeriod },
                  { label: "Стиль торговли", value: "Long/Short, без фиксированного уклона" },
                  { label: "Портфель", value: "Систематический, диверсифицированный по таймфреймам" },
                ]).map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-3 border-b border-border/30 last:border-0"
                  >
                    <span className="text-sm text-muted-foreground">
                      {item.label}
                    </span>
                    <span className="text-sm font-medium text-foreground font-mono">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </AnimatedSection>

          <AnimatedSection delay={150}>
            <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50 h-full flex flex-col">
              <h3 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                {sc.key === "quantumalpha" ? "Архитектура алгоритма" : "Логика торговли"}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {sc.key === "quantumalpha"
                  ? "Алгоритм построен как системная архитектура, где производительность и риск определяются прежде всего взаимодействием между стратегиями, а не отдельными сигналами. 40 независимых моделей работают в области следования за трендом, статистического арбитража и систем на ставке финансирования, при этом капитал распределяется избирательно так, что в каждый момент задействована лишь часть счёта. Такая структура снижает корреляцию между компонентами и ограничивает просадки в неблагоприятных рыночных режимах, особенно в боковых или высокошумовых условиях."
                  : sc.archDesc}
              </p>
              <div className="mt-auto grid grid-cols-2 gap-3">
                {(sc.key === "quantumalpha" ? [
                  { val: "40", desc: "Независимых моделей" },
                  { val: "3", desc: "Типов стратегий" },
                  { val: "5", desc: "Торговых пар" },
                  { val: "24/7", desc: "Автоматизировано" },
                ] : [
                  { val: "12+", desc: "Лет исследований" },
                  { val: "5", desc: "Типов подходов" },
                  { val: "10", desc: "Торговых пар" },
                  { val: "24/7", desc: "Автоматизировано" },
                ]).map((s) => (
                  <div
                    key={s.desc}
                    className="bg-background/50 rounded-md p-3 text-center"
                  >
                    <div className="text-lg font-bold font-mono text-cyan-400">
                      {s.val}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {s.desc}
                    </div>
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
  const years = [...new Set(allData.map((d) => d.date.substring(0, 4)))].sort();
  const [active, setActive] = useState<string>("all");
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [calOpen, setCalOpen] = useState(false);

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
      setCalOpen(false);
    } else if (from) {
      const filtered = allData.filter((d) => d.date >= from);
      onFilter(maybeRebase(filtered.length > 0 ? filtered : allData));
    }
  }

  const rangeLabel = useMemo(() => {
    if (!range?.from) return "Выбрать период";
    const fmt = (d: Date) => d.toLocaleDateString("ru-RU", { month: "short", day: "numeric", year: "numeric" });
    if (range.to) return `${fmt(range.from)} — ${fmt(range.to)}`;
    return `С ${fmt(range.from)}`;
  }, [range]);

  const btnClass = (key: string) =>
    `px-3 py-1 rounded text-xs font-medium transition-all ${
      active === key
        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
        : "bg-background/50 border border-border/50 text-muted-foreground hover:border-cyan-500/40 hover:text-foreground"
    }`;

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-1.5">
        <button
          className={btnClass("all")}
          onClick={() => applyYearOrAll("all")}
          data-testid="button-period-all"
        >
          Всё время
        </button>
        {years.map((y) => (
          <button
            key={y}
            className={btnClass(y)}
            onClick={() => applyYearOrAll(y)}
            data-testid={`button-period-${y}`}
          >
            {y}
          </button>
        ))}
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <button
              className={btnClass("custom")}
              onClick={() => setActive("custom")}
              data-testid="button-period-custom"
            >
              <CalendarRange className="w-3 h-3 inline mr-1" />
              {active === "custom" && range?.from ? rangeLabel : "Период"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" data-testid="popover-period-calendar">
            <CalendarPicker
              mode="range"
              captionLayout="dropdown"
              selected={range}
              onSelect={handleRangeSelect}
              disabled={isDisabled}
              fromDate={minDate}
              toDate={maxDate}
              defaultMonth={maxDate ? new Date(maxDate.getFullYear(), maxDate.getMonth() - 1) : undefined}
              numberOfMonths={2}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function ChartLiveBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/30">
      <span className="inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
      <span className="text-[10px] text-cyan-400/90">{text}</span>
    </div>
  );
}

function ZoomableChart({
  data,
  color,
  gradientId,
  valueSuffix,
  valueLabel,
  valueDecimals,
  height,
  rebaseOnZoom = false,
  additiveRebase = false,
  yearlyTicks = false,
  yMin,
  liveBadgeText,
}: {
  data: { date: string; value: number }[];
  color: string;
  gradientId: string;
  valueSuffix: string;
  valueLabel: string;
  valueDecimals: number;
  height: string;
  rebaseOnZoom?: boolean;
  additiveRebase?: boolean;
  yearlyTicks?: boolean;
  yMin?: number;
  liveBadgeText?: string;
}) {
  const [left, setLeft] = useState<string | null>(null);
  const [right, setRight] = useState<string | null>(null);
  const [refLeft, setRefLeft] = useState<string | null>(null);
  const [refRight, setRefRight] = useState<string | null>(null);
  const [zoomedData, setZoomedData] = useState(data);

  useEffect(() => {
    setZoomedData(data);
  }, [data]);

  const isZoomed = zoomedData.length < data.length;

  const handleMouseDown = (e: any) => {
    if (e?.activeLabel) setRefLeft(e.activeLabel);
  };

  const handleMouseMove = (e: any) => {
    if (refLeft && e?.activeLabel) setRefRight(e.activeLabel);
  };

  const handleMouseUp = () => {
    if (refLeft && refRight && refLeft !== refRight) {
      const leftIdx = data.findIndex((d) => d.date === refLeft);
      const rightIdx = data.findIndex((d) => d.date === refRight);
      const [from, to] = leftIdx < rightIdx ? [leftIdx, rightIdx] : [rightIdx, leftIdx];
      if (to - from > 1) {
        const sliced = data.slice(from, to + 1);
        if (rebaseOnZoom && sliced.length > 0) {
          if (additiveRebase) {
            const base = sliced[0].value;
            setZoomedData(sliced.map((d) => ({ ...d, value: parseFloat((d.value - base).toFixed(4)) })));
          } else {
            const baseMul = 1 + sliced[0].value / 100;
            setZoomedData(sliced.map((d) => ({ ...d, value: parseFloat((((1 + d.value / 100) / baseMul - 1) * 100).toFixed(4)) })));
          }
        } else {
          setZoomedData(sliced);
        }
        setLeft(refLeft);
        setRight(refRight);
      }
    }
    setRefLeft(null);
    setRefRight(null);
  };

  const handleReset = () => {
    setZoomedData(data);
    setLeft(null);
    setRight(null);
  };

  return (
    <div>
      {isZoomed && (
        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-border/50"
            onClick={handleReset}
            data-testid="button-chart-reset-zoom"
          >
            Сбросить зум
          </Button>
        </div>
      )}
      <div className={height}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={zoomedData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={yearlyTicks} />
            <XAxis
              dataKey="date"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, dy: 10 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                if (isZoomed) return d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
                return yearlyTicks ? d.getFullYear().toString() : d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
              }}
              ticks={yearlyTicks && !isZoomed ? (() => {
                const seen = new Set<number>();
                return zoomedData.filter((d) => {
                  const y = new Date(d.date).getFullYear();
                  if (seen.has(y)) return false;
                  seen.add(y);
                  return true;
                }).map((d) => d.date);
              })() : undefined}
              interval={yearlyTicks && !isZoomed ? 0 : Math.floor(zoomedData.length / 8)}
            />
            <YAxis
              type="number"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v.toFixed(valueDecimals > 2 ? 1 : 0)}${valueSuffix}`}
              width={55}
              domain={yMin !== undefined ? [yMin, 'auto'] : ['auto', 'auto']}
              allowDataOverflow={yMin !== undefined}
              tickCount={10}
            />
            <Tooltip
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const val = payload[0].value as number;
                const dateStr = new Date(label).toLocaleDateString("ru-RU", { month: "long", day: "numeric", year: "numeric" });
                const formatted = `${val >= 0 ? "+" : ""}${val.toFixed(valueDecimals)}${valueSuffix}`;
                const valColor = val >= 0 ? color : "#f87171";
                return (
                  <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-xl min-w-[200px]">
                    <p className="text-sm font-bold text-foreground mb-2">{dateStr}</p>
                    <div className="flex items-center justify-between gap-6">
                      <span className="text-xs text-muted-foreground">{valueLabel}</span>
                      <span className="text-sm font-bold font-mono" style={{ color: valColor }}>{formatted}</span>
                    </div>
                    {liveBadgeText && <ChartLiveBadge text={liveBadgeText} />}
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: "#0a0e27", strokeWidth: 2 }}
            />
            {refLeft && refRight && (
              <ReferenceArea
                x1={refLeft}
                x2={refRight}
                strokeOpacity={0.2}
                stroke="rgba(6,182,212,0.3)"
                fill="rgba(6,182,212,0.05)"
                fillOpacity={1}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!isZoomed && (
        <p className="text-[10px] text-muted-foreground/40 text-center mt-2">
          Нажмите и перетащите на графике для увеличения
        </p>
      )}
    </div>
  );
}

function EquityChartSection({ stats, isLoading, strategyKey }: { stats?: StatsData; isLoading: boolean; strategyKey?: string }) {
  // Schematic equity curve
  const pts: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * 800;
    const progress = i / 100;
    const base = 280 - progress * 220;
    const noise = Math.sin(i * 0.4) * 8 + Math.sin(i * 1.1) * 5 + Math.cos(i * 0.25) * 6;
    pts.push(`${x},${Math.max(10, Math.min(290, base + noise))}`);
  }
  const line = pts.join(" ");
  const fill = line + " 800,300 0,300";

  return (
    <section id="equity" className="py-20 px-4 sm:px-6 relative" data-testid="section-equity">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Накопленная прибыль</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">Рост капитала с реинвестированием с момента запуска</p>
          </div>
        </AnimatedSection>
        <AnimatedSection delay={100}>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 p-4 sm:p-6">
            <div className="h-[300px] sm:h-[400px] relative">
              <svg viewBox="0 0 800 300" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="eqGradT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(6,182,212)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(6,182,212)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon points={fill} fill="url(#eqGradT)" />
                <polyline points={line} fill="none" stroke="rgb(6,182,212)" strokeWidth="2" />
              </svg>
            </div>
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}

function DrawdownChartSection({ stats, isLoading }: { stats?: StatsData; isLoading: boolean }) {
  const pts: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * 800;
    const spike = (i % 15 < 3) ? -Math.random() * 80 - 20 : 0;
    const base = -Math.abs(Math.sin(i * 0.3) * 15 + Math.sin(i * 0.7) * 10);
    pts.push(`${x},${150 + base + spike}`);
  }
  const line = pts.join(" ");
  const fill = "0,150 " + line + " 800,150";

  return (
    <section className="py-20 px-4 sm:px-6 relative" data-testid="section-drawdown-chart">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Просадка</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">Процентное снижение от максимума</p>
          </div>
        </AnimatedSection>
        <AnimatedSection delay={100}>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 p-4 sm:p-6">
            <div className="h-[250px] sm:h-[300px] relative">
              <svg viewBox="0 0 800 300" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="ddGradT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(239,68,68)" stopOpacity="0" />
                    <stop offset="100%" stopColor="rgb(239,68,68)" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="150" x2="800" y2="150" stroke="rgb(255,255,255)" strokeOpacity="0.1" strokeWidth="1" />
                <polygon points={fill} fill="url(#ddGradT)" />
                <polyline points={line} fill="none" stroke="rgb(239,68,68)" strokeOpacity="0.7" strokeWidth="1.5" />
              </svg>
            </div>
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}

function PerformanceSection({ stats, isLoading }: { stats?: StatsData; isLoading: boolean }) {
  const eoyReturns = [
    { year: "2020", return: "—", cumulative: "—" },
    { year: "2021", return: "—", cumulative: "—" },
    { year: "2022", return: "—", cumulative: "—" },
    { year: "2023", return: "—", cumulative: "—" },
    { year: "2024", return: "—", cumulative: "—" },
    { year: "2025", return: "—", cumulative: "—" },
  ];
  const m = stats?.metrics || {};

  const additionalMetrics = [
    { label: "Прибыльных месяцев", value: getMetricValue(m, "Win Month", "---") },
    { label: "Лучший месяц", value: getMetricValue(m, "Best Month", "---") },
    { label: "Худший месяц", value: getMetricValue(m, "Worst Month", "---") },
    { label: "Ср. прибыльный месяц", value: getMetricValue(m, "Avg. Up Month", "---") },
    { label: "Ср. убыточный месяц", value: getMetricValue(m, "Avg. Down Month", "---") },
    { label: "Лучший год", value: getMetricValue(m, "Best Year", "---") },
    { label: "Худший год", value: getMetricValue(m, "Worst Year", "---") },
    { label: "Прибыльных лет", value: getMetricValue(m, "Win Year", "---") },
  ];

  return (
    <section id="performance" className="py-20 px-4 sm:px-6 relative" data-testid="section-performance">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Результаты
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Годовые доходности и ключевая статистика
            </p>
            <LiveDataBadge text="На основе верифицированных реальных результатов" pulse={false} />
          </div>
        </AnimatedSection>

        <div className="grid lg:grid-cols-2 gap-6">
          <AnimatedSection delay={100}>
            <Card className="overflow-hidden bg-card/50 backdrop-blur-sm border-border/50 h-full">
              <div className="p-4 border-b border-border/30">
                <h3 className="text-sm font-semibold text-foreground">Годовые доходности</h3>
              </div>
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-performance">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Год</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Доходность</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-cyan-400">Накопленная</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eoyReturns.map((row) => (
                        <tr key={row.year} className="border-b border-border/20 last:border-0">
                          <td className="px-4 py-3 font-semibold text-foreground font-mono" data-testid={`text-year-${row.year}`}>
                            {row.year}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono ${row.returnPct >= 0 ? "text-cyan-400" : "text-red-400"}`} data-testid={`text-return-${row.year}`}>
                            {row.returnPct >= 0 ? "+" : ""}{row.returnPct.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-cyan-400 font-semibold" data-testid={`text-cumulative-${row.year}`}>
                            {row.cumulative}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </AnimatedSection>

          <AnimatedSection delay={200}>
            <Card className="overflow-hidden bg-card/50 backdrop-blur-sm border-border/50 h-full">
              <div className="p-4 border-b border-border/30">
                <h3 className="text-sm font-semibold text-foreground">Статистика результатов</h3>
              </div>
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-6 w-full" />)}
                </div>
              ) : (
                <div className="p-4 space-y-0">
                  {additionalMetrics.map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className={`text-sm font-mono font-medium ${
                        item.value.startsWith("-") ? "text-red-400" : "text-foreground"
                      }`} data-testid={`text-stat-${item.label.toLowerCase().replace(/[\s.]/g, "-")}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

function buildSystemDesign(sc: StrategyConfig) {
  if (sc.key === "quantumalpha") {
    return [
      {
        icon: Layers,
        title: "Комплексный алгоритм из множества систем",
        items: [
          "~40 независимых моделей",
          "Следование за трендом, статистический арбитраж, системы на ставке финансирования",
          "В каждый момент активна только часть счёта",
        ],
      },
      {
        icon: Shield,
        title: "Управление рисками",
        items: [
          "Размер позиции на основе волатильности",
          "Динамическое рыночное воздействие",
          "Дельта-нейтральные спот-фьючерсные структуры",
          "Автоматические контроли исполнения",
        ],
      },
      {
        icon: Zap,
        title: "Качество исполнения",
        items: [
          "Умная логика исполнения",
          "Оптимизация потока ордеров мейкера",
          "Минимальный слиппаж и комиссии",
          "Полная автоматизация, без дискреции",
        ],
      },
    ];
  }
  return [
    {
      icon: Layers,
      title: "Торговое преимущество",
      items: [
        "Не HFT, машинное обучение не используется — преимущество основано на хорошо изученном эффекте моментума",
        "Систематический портфель, диверсифицированный по нескольким таймфреймам",
        "Компоненты системы регулярно тестируются и оптимизируются",
        "Многолетняя история реальной торговли на крипторынке",
        "Регулярное стресс-тестирование и симуляции",
      ],
    },
    {
      icon: Zap,
      title: "Исполнение",
      items: [
        "Рыночные или лимитные ордера в зависимости от условий рынка",
        "Высокоскоростной алгоритм TWAP для входа большого объёма",
        "Исполнение через API на субаккаунте клиента на бирже",
        "Протестировано на множестве рынков и классов активов",
        "Полная автоматизация — без дискреционного вмешательства",
      ],
    },
    {
      icon: Shield,
      title: "Управление рисками",
      items: [
        "Фиксированный риск на сделку с заранее определёнными стоп-лоссами и тейк-профитами",
        "Убыточные позиции никогда не усредняются",
        "Круглосуточный мониторинг автоматическими системами и сотрудниками фонда",
        "Надёжная API-интеграция с собственным программным обеспечением",
        "Поддержка нескольких бирж для операционной надёжности",
      ],
    },
  ];
}

function SystemDesignSection({ sc }: { sc: StrategyConfig }) {
  const systemDesign = buildSystemDesign(sc);
  return (
    <section className="py-20 px-4 sm:px-6 relative" data-testid="section-system-design">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Архитектура системы
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              {sc.key === "quantumalpha"
                ? "Инфраструктура уровня enterprise для стабильной генерации альфа"
                : "Стабильная доходность за счёт диверсификации между стратегиями"}
            </p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-6 mb-10">
          {systemDesign.map((section, i) => (
            <AnimatedSection key={section.title} delay={i * 120}>
              <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50 h-full">
                <div className="w-11 h-11 rounded-md bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center mb-4">
                  <section.icon className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-4">
                  {section.title}
                </h3>
                <ul className="space-y-2.5">
                  {section.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <div className="w-1 h-1 rounded-full bg-cyan-400 mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </AnimatedSection>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          <AnimatedSection delay={400}>
            <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50 h-full">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-400" />
                {sc.key === "quantumalpha" ? "Управление рисками" : "Надёжность стратегии"}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {sc.key === "quantumalpha"
                  ? "Управление рисками встроено на нескольких уровнях. Размер позиции определяется до входа в сделку на основе режимов волатильности конкретных инструментов, тогда как рыночное воздействие динамически регулируется через диверсификацию, хеджирование и контроли исполнения. Алгоритм использует спот-фьючерсные структуры для дельта-нейтрального позиционирования и оптимизации ставки финансирования, что помогает сглаживать колебания эквити и повышать эффективность капитала."
                  : sc.riskDesc}
              </p>
            </Card>
          </AnimatedSection>
          <AnimatedSection delay={500}>
            <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50 h-full">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                {sc.key === "quantumalpha" ? "Качество исполнения" : "Бэктестирование и валидация"}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {sc.key === "quantumalpha"
                  ? "Качество исполнения — ключевой вклад в доходность. Сделки исполняются через собственную умную логику исполнения, которая адаптирует скорость и стиль размещения ордеров к рыночным условиям, преимущественно опираясь на поток ордеров мейкера для минимизации слиппажа и комиссий. Все процессы полностью автоматизированы без дискреционного вмешательства."
                  : sc.execDesc}
              </p>
            </Card>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection({ sc }: { sc: StrategyConfig }) {
  const boxes = [
    {
      title: "Архитектура стратегии",
      items: [
        "Систематический портфель, диверсифицированный по инструментам и таймфреймам",
        sc.key === "basket70tf"
          ? "Более высокая доля трендовых систем, удерживающих позиции длительное время"
          : "Сочетание подходов моментума и возврата к среднему значению",
        sc.key === "basket70"
          ? "Кластеризация волатильности для улучшения определения режима и выбора точек входа"
          : sc.key === "basket70tf"
          ? "Кластеризация волатильности для улучшения тайминга трендов и управления рисками"
          : "Краткосрочный фокус на локальных трендах, всплесках волатильности и возврате к среднему значению",
        "Диверсифицированное воздействие по нескольким таймфреймам и инструментам одновременно",
      ],
    },
    {
      title: "Контроль рисков на уровне сделки",
      items: [
        "Фиксированный риск на сделку — убыточные позиции не усредняются",
        "Заранее определённые стоп-лоссы и тейк-профиты для каждой сделки",
        sc.key === "basket70tf"
          ? "Намеренное сокращение или прекращение торговли в условиях экстремальной волатильности"
          : "Намеренное сокращение торговой активности, когда размеры SL делают соотношение риск/прибыль невыгодным",
        "Пирамидинг прибыльных позиций допустим в направлении движения",
      ],
    },
    {
      title: "Преимущество на уровне портфеля",
      items: [
        "Низкая корреляция между отдельными компонентами стратегии",
        sc.key === "basket70tf"
          ? "Ориентировано на извлечение ценности из устойчивых, чётко сформированных рыночных трендов"
          : "Ориентировано на получение альфа как в трендовых, так и в разворотных рыночных режимах",
        "Устойчивость при изменении волатильности и рыночной структуры",
        "Полная автоматизация — дисциплинированно, последовательно, без дискреционного вмешательства",
      ],
    },
    {
      title: "Входные данные для принятия решений",
      items: [
        "Фундаментальный анализ: 0%",
        sc.key === "basket70tf"
          ? "Технические сигналы: ~95% (прайс-экшн, направление тренда, моментум, кластеризация волатильности)"
          : "Технические сигналы: ~95% (прайс-экшн, моментум, волатильность, сигналы возврата к среднему значению)",
        "Ограничения исполнения и риска: ~5% (фильтры ликвидности, размер позиции, калибровка стопов)",
      ],
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 relative" data-testid="section-architecture">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Архитектура и управление рисками
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Систематическое построение портфеля: стратегии {sc.approachFull}
            </p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          {boxes.map((box, i) => (
            <AnimatedSection key={box.title} delay={i * 100}>
              <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50 h-full" data-testid={`card-arch-${i}`}>
                <h3 className="text-base font-semibold text-foreground mb-4">
                  {box.title}
                </h3>
                <ul className="space-y-2.5">
                  {box.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <div className="w-1 h-1 rounded-full bg-cyan-400 mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function RiskSection({ stats, isLoading }: { stats?: StatsData; isLoading: boolean }) {
  const drawdowns = Array.from({length: 10}, () => ({ started: "—", recovered: "—", drawdown: 0, days: 0 }));

  const riskMetrics = [
    { label: "Макс. просадка", value: "—" },
    { label: "Макс. срок просадки (дней)", value: "—" },
    { label: "Ср. просадка", value: "—" },
    { label: "Ср. срок просадки", value: "—" },
    { label: "Дневной VaR", value: "—" },
    { label: "CVaR", value: "—" },
    { label: "Коэффициент Кальмара", value: "—" },
    { label: "Фактор восстановления", value: "—" },
  ];

  return (
    <section id="risk" className="py-20 px-4 sm:px-6 relative" data-testid="section-risk">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Профиль риска
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Комплексные метрики риска и наихудшие периоды просадок
            </p>
          </div>
        </AnimatedSection>

        <div className="grid lg:grid-cols-2 gap-6 items-stretch">
          <AnimatedSection delay={100} className="flex">
            <Card className="overflow-hidden bg-card/50 backdrop-blur-sm border-border/50 w-full flex flex-col">
              <div className="p-4 border-b border-border/30">
                <h3 className="text-sm font-semibold text-foreground">Метрики риска</h3>
              </div>
              {isLoading ? (
                <div className="p-4 space-y-3 flex-1">
                  {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-6 w-full" />)}
                </div>
              ) : (
                <div className="p-4 space-y-0 flex-1 flex flex-col justify-evenly">
                  {riskMetrics.map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className={`text-sm font-mono font-medium ${
                        item.value.startsWith("-") ? "text-red-400" : "text-foreground"
                      }`} data-testid={`text-risk-${item.label.toLowerCase().replace(/[\s.]/g, "-")}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </AnimatedSection>

          <AnimatedSection delay={200} className="flex">
            <Card className="overflow-hidden bg-card/50 backdrop-blur-sm border-border/50 w-full">
              <div className="p-4 border-b border-border/30">
                <h3 className="text-sm font-semibold text-foreground">Наихудшие просадки</h3>
              </div>
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-drawdowns">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground">Начало</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground">Восстановление</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground">Просадка</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground">Дней</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drawdowns.map((row, i) => (
                        <tr key={i} className="border-b border-border/20 last:border-0">
                          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                            {row.started}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                            {row.recovered}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                            —
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                            —
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

const ACCESS_TERMS_BASE = [
  { icon: DollarSign, label: "Минимальная аллокация", value: "$500" },
  { icon: FileText, label: "Комиссия за управление", value: "0%" },
  { icon: BarChart3, label: "Комиссия за результат", value: "30%" },
  { icon: TrendingUp, label: "принцип «высшей отметки»", value: "Применяется" },
  { icon: Lock, label: "Срок блокировки", value: "Отсутствует" },
  { icon: Clock, label: "Распределение комиссий", value: "Раз в квартал" },
  { icon: Layers, label: "Формат подключения", value: "Копитрейдинг через биржу" },
  { icon: Activity, label: "Торговые активы", value: "10 торговых пар, 5 торговых подходов" },
  { icon: Wallet, label: "Обеспечение", value: "USDT / BTC / ETH (любой токен для расширенный маржинальный режим)" },
  { icon: ExternalLink, label: "Биржи", value: "Binance, OKX, Bybit, Bitget, BingX" },
];

interface MultiplierData {
  multiplier: number;
  cagr: number;
  maxDD: number;
  totalReturn: number;
  avgYearly: number;
}

function QAROICalculator({ stats }: { stats?: StatsData }) {
  const { data: multData } = useQuery<{ multipliers: MultiplierData[] }>({
    queryKey: ["/api/qa-multipliers"],
  });

  const m = stats?.metrics;
  const fallbackAvgYearly = parseFloat(m?.["Avg Yearly"] || "0");
  const fallbackMaxDD = Math.abs(parseFloat(m?.["Max Drawdown"] || "0"));

  const CAPITALS = [
    { label: "$500", value: 500 },
    { label: "$2,500", value: 2_500 },
    { label: "$5,000", value: 5_000 },
    { label: "$50,000", value: 50_000 },
    { label: "$100,000", value: 100_000 },
  ];

  const [capitalIdx, setCapitalIdx] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const capital = CAPITALS[capitalIdx].value;

  const getMultData = (x: number): MultiplierData => {
    const found = multData?.multipliers?.find(md => md.multiplier === x);
    if (found) return found;
    return {
      multiplier: x,
      cagr: fallbackAvgYearly * x,
      maxDD: -fallbackMaxDD * x,
      totalReturn: 0,
      avgYearly: fallbackAvgYearly * x,
    };
  };

  const current = getMultData(multiplier);
  const apy = current.avgYearly / 100;
  const projectedValue = capital * (1 + apy);
  const totalReturn = projectedValue - capital;
  const maxDDPct = Math.abs(current.maxDD) / 100;
  const maxDDDollar = capital * maxDDPct;

  const fmtMoney = (v: number) => {
    if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "M";
    return "$" + v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  };

  return (
    <section id="roi" className="py-20 px-4 sm:px-6 relative" data-testid="section-roi-calculator">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Калькулятор ROI</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Оценка годовой доходности: Ср. в год {current.avgYearly.toFixed(2)}%
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <Card className="p-6 sm:p-8 bg-card/50 backdrop-blur-sm border-border/50">
            <div className="space-y-8">
              <div className="text-center">
                <label className="text-sm text-muted-foreground mb-3 block">Начальный капитал</label>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {CAPITALS.map((c, i) => (
                    <Button
                      key={c.label}
                      variant={capitalIdx === i ? "default" : "outline"}
                      size="sm"
                      className={capitalIdx === i
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 border-cyan-500 text-white"
                        : "border-border/50"}
                      onClick={() => setCapitalIdx(i)}
                      data-testid={`button-investment-${c.value}`}
                    >
                      {c.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm text-muted-foreground">Множитель</label>
                  <span className="text-sm font-mono font-semibold text-cyan-400" data-testid="text-multiplier">
                    {multiplier}x
                  </span>
                </div>
                <Slider
                  value={[multiplier]}
                  onValueChange={(v) => setMultiplier(v[0])}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                  data-testid="slider-multiplier"
                />
                <div className="flex justify-between mt-3 text-[10px] text-muted-foreground/50">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i + 1}>{i + 1}x</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border/30">
                <div className="bg-background/50 rounded-md p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-2">Прогнозная стоимость</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-foreground" data-testid="text-projected-value">
                    {fmtMoney(projectedValue)}
                  </div>
                </div>
                <div className="bg-cyan-500/5 rounded-md p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-2">Суммарный доход</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-400" data-testid="text-total-return">
                    +{fmtMoney(totalReturn)}
                  </div>
                </div>
                <div className="bg-cyan-500/5 rounded-md p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-2">Ср. в год</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-400" data-testid="text-apy">
                    {current.avgYearly.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-red-500/5 rounded-md p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-2">Макс. просадка ({Math.abs(current.maxDD).toFixed(2)}%)</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-red-400" data-testid="text-max-drawdown">
                    -{fmtMoney(maxDDDollar)}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/30">
                <div className="text-xs text-muted-foreground mb-3 text-center">Сравнение по множителям</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-multiplier-comparison">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="py-2 px-3 text-left text-xs text-muted-foreground font-medium">Множитель</th>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((x) => (
                          <th key={x} className={`py-2 px-3 text-center text-xs font-mono font-medium ${x === multiplier ? "text-cyan-400" : "text-muted-foreground"}`}>
                            {x}x
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/20">
                        <td className="py-2 px-3 text-xs text-muted-foreground">Ср. год. %</td>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((x) => {
                          const md = getMultData(x);
                          return (
                            <td key={x} className={`py-2 px-3 text-center font-mono text-xs ${x === multiplier ? "text-cyan-400 font-semibold" : "text-cyan-400/80"}`}>
                              {md.avgYearly.toFixed(1)}%
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-xs text-muted-foreground">Макс. просадка %</td>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((x) => {
                          const md = getMultData(x);
                          return (
                            <td key={x} className={`py-2 px-3 text-center font-mono text-xs ${x === multiplier ? "text-cyan-400 font-semibold" : "text-red-400/80"}`}>
                              {Math.abs(md.maxDD).toFixed(1)}%
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground/60 text-center">
                На основе исторической накопленной доходности. Прошлые результаты не являются гарантией будущей доходности.
              </p>
            </div>
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}

function ROIGrowthSection({ stats, strategyKey }: { stats?: StatsData; strategyKey?: string }) {
  if (strategyKey === "quantumalpha") {
    return <QAROICalculator stats={stats} />;
  }
  const CAPITALS = [
    { label: "$500", value: 500 },
    { label: "$2,500", value: 2_500 },
    { label: "$5,000", value: 5_000 },
    { label: "$50,000", value: 50_000 },
    { label: "$100,000", value: 100_000 },
  ];

  const [capitalIdx, setCapitalIdx] = useState(0);
  const [sliderIdx, setSliderIdx] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const capital = CAPITALS[capitalIdx].value;

  const equityData = stats?.equity ?? [];

  const firstDate = equityData[0]?.date ?? "";
  const lastDate = equityData[equityData.length - 1]?.date ?? "";

  const [startDate, setStartDate] = useState(firstDate);

  useEffect(() => {
    if (firstDate && !startDate) setStartDate(firstDate);
  }, [firstDate]);

  const handleSetStartDate = useCallback((date: string) => {
    setStartDate(date);
    setHasInteracted(true);
  }, []);

  useEffect(() => {
    setSliderIdx(0);
    setHasInteracted(false);
  }, [capitalIdx]);

  const chartData = useMemo(() => {
    const startIdx = Math.max(0, equityData.findIndex((d) => d.date >= startDate));
    const baseEquity = 1 + (equityData[startIdx]?.value ?? 0) / 100;
    return equityData.slice(startIdx).map((d) => ({
      date: d.date,
      value: capital * (1 + d.value / 100) / baseEquity,
    }));
  }, [equityData, capital, startDate]);

  const maxIdx = Math.max(0, chartData.length - 1);

  useEffect(() => {
    if (hasInteracted) {
      setSliderIdx(0);
    }
  }, [startDate]);

  const visibleData = useMemo(() => chartData.slice(0, sliderIdx + 1), [chartData, sliderIdx]);

  const chartDisplayData = useMemo(() => chartData.map((d, i) => ({
    ...d,
    displayValue: i <= sliderIdx ? d.value : null,
  })), [chartData, sliderIdx]);

  const currentValue = visibleData.length > 0 ? visibleData[visibleData.length - 1].value : capital;
  const profit = currentValue - capital;
  const currentDate = visibleData.length > 0 ? visibleData[visibleData.length - 1].date : chartData[0]?.date ?? "";

  const peakValue = useMemo(() => {
    if (visibleData.length === 0) return capital;
    return Math.max(...visibleData.map((d) => d.value));
  }, [visibleData, capital]);
  const currentDDPct = peakValue > 0 ? ((currentValue - peakValue) / peakValue) * 100 : 0;
  const currentDDDollar = currentValue - peakValue;

  const maxDrawdown = useMemo(() => {
    if (visibleData.length < 2) return { pct: 0, dollar: 0 };
    let peak = visibleData[0].value;
    let worstPct = 0;
    let worstDollar = 0;
    for (const d of visibleData) {
      if (d.value > peak) peak = d.value;
      const ddPct = (d.value - peak) / peak * 100;
      if (ddPct < worstPct) {
        worstPct = ddPct;
        worstDollar = d.value - peak;
      }
    }
    return { pct: worstPct, dollar: worstDollar };
  }, [visibleData]);

  const availableYears = useMemo(() => {
    if (equityData.length === 0) return [];
    const seen = new Set<string>();
    return equityData
      .map((d) => d.date.substring(0, 4))
      .filter((y) => { if (seen.has(y)) return false; seen.add(y); return true; })
      .sort();
  }, [equityData]);

  const yMin = useMemo(() => {
    if (visibleData.length < 2) return capital * 0.8;
    return Math.min(...visibleData.map((d) => d.value)) * 0.97;
  }, [visibleData, capital]);

  const yMax = useMemo(() => {
    if (visibleData.length < 2) return capital * 1.2;
    return Math.max(...visibleData.map((d) => d.value)) * 1.03;
  }, [visibleData, capital]);

  function fmtDollar(v: number) {
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "+";
    if (abs >= 1_000_000) return sign + "$" + (abs / 1_000_000).toFixed(2) + "M";
    if (abs >= 1_000) return sign + "$" + Math.round(abs / 1_000) + "K";
    return sign + "$" + Math.round(abs);
  }

  function fmtValue(v: number) {
    if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "M";
    if (v >= 1_000) return "$" + Math.round(v / 1_000) + "K";
    return "$" + Math.round(v);
  }

  function fmtYAxis(v: number) {
    if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(1) + "M";
    if (v >= 100_000) return "$" + Math.round(v / 1_000) + "K";
    if (v >= 1_000) return "$" + (v / 1_000).toFixed(1) + "K";
    return "$" + Math.round(v);
  }

  const sliderPct = maxIdx > 0 ? (sliderIdx / maxIdx) * 100 : 0;

  return (
    <section id="roi" className="py-20 px-4 sm:px-6 relative" data-testid="section-roi-growth">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Рост капитала</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Перетащите таймлайн, чтобы увидеть рост вашей аллокации за период стратегии при стандартном риске (×1)
            </p>
            <LiveDataBadge text="Проекция на основе данных реальной торговли" pulse={false} />
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <Card className="p-6 sm:p-8 bg-card/50 backdrop-blur-sm border-border/50">
            <div className="mb-8">
              <p className="text-sm text-muted-foreground text-center sm:text-left mb-4">Начальный капитал</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                {CAPITALS.map((c, i) => (
                  <button
                    key={c.label}
                    onClick={() => setCapitalIdx(i)}
                    data-testid={`button-growth-capital-${c.label}`}
                    className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${
                      capitalIdx === i
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                        : "bg-background/50 border border-border/50 text-muted-foreground hover:text-foreground hover:border-cyan-500/40"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
              <Card className="p-4 bg-background/50 border-border/30 text-center h-[88px] flex flex-col justify-center">
                <p className="text-xs text-muted-foreground mb-2">Начальный капитал</p>
                <p className="text-xl sm:text-2xl font-bold font-mono text-foreground" data-testid="text-growth-start">
                  {fmtValue(capital)}
                </p>
              </Card>
              <Card className="p-4 bg-background/50 border-border/30 text-center h-[88px] flex flex-col justify-center">
                <p className="text-xs text-muted-foreground mb-2">Текущая стоимость</p>
                <p className="text-xl sm:text-2xl font-bold font-mono transition-colors text-blue-400" data-testid="text-growth-current">
                  {fmtValue(currentValue)}
                </p>
              </Card>
              <Card className="p-4 bg-background/50 border-border/30 text-center h-[88px] flex flex-col justify-center">
                <p className="text-xs text-muted-foreground mb-0.5">Прибыль / Убыток</p>
                <p className={`text-xl sm:text-2xl font-bold font-mono transition-colors ${profit >= 0 ? "text-cyan-400" : "text-red-400"}`} data-testid="text-growth-profit">
                  {fmtDollar(profit)}
                </p>
                <p className={`text-[10px] font-mono ${profit >= 0 ? "text-cyan-400/70" : "text-red-400/70"}`} data-testid="text-growth-profit-pct">
                  {profit >= 0 ? "+" : ""}{((profit / capital) * 100).toFixed(2)}%
                </p>
              </Card>
              <Card className="p-4 bg-background/50 border-border/30 text-center h-[88px] flex flex-col justify-center">
                <p className="text-xs text-muted-foreground mb-0.5">Текущая просадка</p>
                <p className={`text-xl sm:text-2xl font-bold font-mono ${currentDDPct < -0.01 ? "text-red-400" : "text-muted-foreground/50"}`} data-testid="text-growth-dd-pct">
                  {currentDDPct < -0.01 ? currentDDPct.toFixed(2) + "%" : "—"}
                </p>
                <p className={`text-[10px] font-mono ${currentDDPct < -0.01 ? "text-red-400/70" : "text-transparent"}`} data-testid="text-growth-dd-dollar">
                  {currentDDPct < -0.01 ? fmtDollar(currentDDDollar) : "\u00A0"}
                </p>
              </Card>
              <Card className="p-4 bg-background/50 border-border/30 text-center h-[88px] flex flex-col justify-center">
                <p className="text-xs text-muted-foreground mb-0.5">Макс. просадка</p>
                <p className={`text-xl sm:text-2xl font-bold font-mono ${maxDrawdown.pct < -0.01 ? "text-red-400" : "text-muted-foreground/50"}`} data-testid="text-growth-maxdd-pct">
                  {maxDrawdown.pct < -0.01 ? maxDrawdown.pct.toFixed(2) + "%" : "—"}
                </p>
                <p className="text-[10px] font-mono text-transparent" data-testid="text-growth-maxdd-dollar">
                  {"\u00A0"}
                </p>
              </Card>
              <Card className="p-4 bg-background/50 border-border/30 text-center h-[88px] flex flex-col justify-center">
                <p className="text-xs text-muted-foreground mb-2">На дату</p>
                <p className="text-base sm:text-lg font-bold font-mono text-muted-foreground" data-testid="text-growth-date">
                  {currentDate ? `${new Date(currentDate).toLocaleDateString("ru-RU", { month: "short" }).replace(".", "")} ${new Date(currentDate).getFullYear()}` : "—"}
                </p>
              </Card>
            </div>

            <div className="relative h-64 sm:h-80 mb-2">
              {visibleData.length < 2 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none select-none">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-lg sm:text-xl font-semibold text-cyan-400/80 animate-pulse tracking-wide">
                      Перетащите слайдер для отображения роста
                    </span>
                    <div className="flex items-center gap-2 text-cyan-400/60">
                      <span className="text-2xl">←</span>
                      <div className="w-12 h-1 rounded-full bg-gradient-to-r from-cyan-500/60 to-blue-500/60" />
                      <span className="text-2xl">→</span>
                    </div>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDisplayData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="growthGradient2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, dy: 8 }}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickFormatter={(v: string) => {
                        const d = new Date(v);
                        const spanDays = chartData.length;
                        if (spanDays <= 180) return d.toLocaleDateString("ru-RU", { month: "short", day: "numeric" });
                        if (spanDays <= 730) return d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
                        return d.getFullYear().toString();
                      }}
                      interval={Math.max(1, Math.floor(chartData.length / 6))}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={fmtYAxis}
                      width={65}
                      domain={[yMin, yMax]}
                      allowDataOverflow
                      tickCount={6}
                    />
                    <Tooltip
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload?.length) return null;
                        const val = payload[0].value;
                        if (val == null) return null;
                        const dateStr = new Date(label).toLocaleDateString("ru-RU", { month: "long", day: "numeric", year: "numeric" });
                        const returnPct = ((val - capital) / capital) * 100;
                        const returnStr = `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}%`;
                        return (
                          <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-xl min-w-[220px]">
                            <p className="text-sm font-bold text-foreground mb-2">{dateStr}</p>
                            <div className="flex items-center justify-between gap-6 mb-1">
                              <span className="text-xs text-muted-foreground">Стоимость портфеля</span>
                              <span className="text-sm font-bold font-mono text-foreground">{fmtValue(val)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-6">
                              <span className="text-xs text-muted-foreground">Доходность</span>
                              <span className={`text-sm font-bold font-mono ${returnPct >= 0 ? "text-cyan-400" : "text-red-400"}`}>{returnStr}</span>
                            </div>
                            <ChartLiveBadge text="Данные реальной торговли · Реальный счёт · Обновляется ежедневно через API" />
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="linear"
                      dataKey="displayValue"
                      stroke="#06b6d4"
                      connectNulls={false}
                      strokeWidth={1.5}
                      fill="url(#growthGradient2)"
                      dot={false}
                      activeDot={{ r: 4, fill: "#06b6d4", stroke: "#0a0e27", strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="px-1 mb-2">
              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={maxIdx}
                  step={1}
                  value={sliderIdx}
                  onChange={(e) => {
                    setSliderIdx(Number(e.target.value));
                    if (!hasInteracted) setHasInteracted(true);
                  }}
                  data-testid="input-growth-timeline"
                  className="w-full h-3 appearance-none rounded-full cursor-ew-resize growth-slider"
                  style={{
                    background: `linear-gradient(to right, #06b6d4 0%, #3b82f6 ${sliderPct}%, hsl(var(--border)) ${sliderPct}%, hsl(var(--border)) 100%)`,
                  }}
                />
                {!hasInteracted && (
                  <div className="absolute -top-9 left-0 flex items-center gap-2 pointer-events-none select-none">
                    <span className="text-sm font-semibold text-cyan-400 animate-pulse">← Перетащите слайдер →</span>
                  </div>
                )}
              </div>

              <div className="flex items-start justify-between mt-3 gap-4">
                <div className="flex flex-wrap gap-1.5">
                  {availableYears.map((y) => {
                    const yearStart = equityData.find((d) => d.date.startsWith(y))?.date ?? "";
                    const isActive = startDate === yearStart;
                    return (
                      <button
                        key={y}
                        onClick={() => handleSetStartDate(yearStart)}
                        data-testid={`button-growth-year-${y}`}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                          isActive
                            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                            : "bg-background/50 border border-border/50 text-muted-foreground hover:text-foreground hover:border-cyan-500/40"
                        }`}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      data-testid="input-growth-start-date"
                      className="bg-background/50 border border-border/50 text-foreground text-xs font-mono rounded-md px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-cyan-500/60 hover:border-cyan-500/40 transition-colors flex items-center gap-1.5"
                    >
                      <CalendarRange className="w-3 h-3 text-muted-foreground" />
                      {startDate ? new Date(startDate + "T00:00:00").toLocaleDateString("ru-RU", { month: "short", day: "numeric", year: "numeric" }) : "Выбрать дату"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarPicker
                      mode="single"
                      captionLayout="dropdown"
                      selected={startDate ? new Date(startDate + "T00:00:00") : undefined}
                      onSelect={(d: Date | undefined) => {
                        if (d) handleSetStartDate(d.toISOString().substring(0, 10));
                      }}
                      fromDate={firstDate ? new Date(firstDate + "T00:00:00") : undefined}
                      toDate={lastDate ? new Date(lastDate + "T00:00:00") : undefined}
                      defaultMonth={startDate ? new Date(startDate + "T00:00:00") : undefined}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/40 text-center mt-3">
              На основе исторических результатов стратегии при риске ×1. Прошлые результаты не являются гарантией будущей доходности.
            </p>
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}

const BASKET_EXCHANGES = [
  { name: "Binance", icon: SiBinance, url: "https://www.binance.com" },
  { name: "OKX", icon: SiOkx, url: "https://www.okx.com" },
  { name: "Bybit", icon: null, url: "https://www.bybit.com" },
  { name: "Bitget", icon: null, url: "https://www.bitget.com" },
  { name: "BingX", icon: null, url: "https://www.bingx.com" },
];

const QA_EXCHANGES = [
  { name: "Binance", icon: SiBinance, url: "https://www.binance.com" },
  { name: "OKX", icon: SiOkx, url: "https://www.okx.com" },
  { name: "Bybit", icon: null, url: "https://www.bybit.com" },
];

function ExchangeLogos({ strategyKey }: { strategyKey: string }) {
  const exchanges = strategyKey === "quantumalpha" ? QA_EXCHANGES : BASKET_EXCHANGES;
  return (
    <div className="mt-10">
      <AnimatedSection delay={200}>
        <div className="text-center mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">{strategyKey === "quantumalpha" ? "Доступно через MSA" : "Доступно через API"}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {exchanges.map((ex) => (
            <a
              key={ex.name}
              href={ex.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 opacity-50 hover:opacity-90 transition-opacity"
              data-testid={`logo-exchange-${ex.name.toLowerCase()}`}
            >
              {ex.icon ? (
                <ex.icon className="w-5 h-5 text-white/70" />
              ) : null}
              <span className="text-sm font-semibold tracking-wide text-white/70">{ex.name}</span>
            </a>
          ))}
        </div>
      </AnimatedSection>
    </div>
  );
}

function AccessTermsSection({ sc }: { sc: StrategyConfig }) {
  const terms = sc.key === "quantumalpha" ? [
    { icon: DollarSign, label: "Минимальная аллокация", value: "USD 500" },
    { icon: TrendingUp, label: "принцип «высшей отметки»", value: "Применяется" },
    { icon: BarChart3, label: "Структура комиссий", value: "30% Performance Fee" },
    { icon: Lock, label: "Срок блокировки", value: "14 дней" },
    { icon: Clock, label: "Распределение комиссии за результат", value: "Раз в квартал" },
    { icon: Layers, label: "Формат подключения", value: "Копитрейдинг через биржу" },
    { icon: Wallet, label: "Залоговые токены", value: "USDT / BTC / ETH (или любой токен для расширенный маржинальный режим)" },
    { icon: Target, label: "Ёмкость", value: sc.capacity },
  ] : [
    ...ACCESS_TERMS_BASE.filter(t => t.label !== "Биржи"),
    { icon: Target, label: "Ёмкость", value: sc.capacity },
  ];
  return (
    <section id="terms" className="py-20 px-4 sm:px-6 relative" data-testid="section-terms">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              {sc.key === "quantumalpha" ? "Условия подключения" : "Условия подключения"}
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Подключение через биржевой копитрейдинг — просто и безопасно
            </p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {terms.map((term, i) => (
            <AnimatedSection key={term.label} delay={i * 60}>
              <Card className="p-5 bg-card/50 backdrop-blur-sm border-border/50 h-full" data-testid={`card-term-${term.label.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-md bg-gradient-to-br from-cyan-500/15 to-blue-600/15 flex items-center justify-center shrink-0">
                    <term.icon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">
                      {term.label}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {term.value}
                    </div>
                  </div>
                </div>
              </Card>
            </AnimatedSection>
          ))}
        </div>

        <ExchangeLogos strategyKey={sc.key} />
      </div>
    </section>
  );
}

const MONTH_LABELS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

function MonthlyReturnsSection({ stats, isLoading }: { stats?: StatsData; isLoading: boolean }) {
  const grid = stats?.monthlyGrid ?? [];

  const tableData = useMemo(() => {
    if (grid.length === 0) return { years: [] as number[], data: {} as Record<number, Record<number, number | null>>, yearTotals: {} as Record<number, number> };
    const data: Record<number, Record<number, number | null>> = {};
    for (const { ym, ret } of grid) {
      const [y, m] = ym.split("-").map(Number);
      if (!data[y]) data[y] = {};
      data[y][m] = ret;
    }
    const years = Object.keys(data).map(Number).sort();
    const yearTotals: Record<number, number> = {};
    for (const y of years) {
      const rets = Object.values(data[y]).filter((v): v is number => v !== null);
      yearTotals[y] = (rets.reduce((acc, r) => acc * (1 + r / 100), 1) - 1) * 100;
    }
    return { years, data, yearTotals };
  }, [grid]);

  function cellColor(v: number | null | undefined) {
    if (v == null) return "";
    if (v > 0) return "text-cyan-400";
    if (v < 0) return "text-red-400";
    return "text-muted-foreground";
  }

  return (
    <section className="py-20 px-4 sm:px-6 relative" data-testid="section-monthly-returns">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Ежемесячные результаты</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Помесячная доходность по годам (с реинвестированием)
            </p>
            <LiveDataBadge text="Обновляется ежедневно · API Binance" pulse={false} />
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 p-4 sm:p-6 overflow-x-auto">
            {false ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <table className="w-full text-xs sm:text-sm font-mono" data-testid="table-monthly-returns">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="py-2 px-2 text-left text-cyan-400 font-semibold">Год</th>
                    {MONTH_LABELS.map((m) => (
                      <th key={m} className="py-2 px-1.5 text-center text-cyan-400 font-semibold">{m}</th>
                    ))}
                    <th className="py-2 px-2 text-center text-cyan-400 font-semibold border-l border-cyan-500/20 bg-cyan-500/5">Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.years.map((y) => (
                    <tr key={y} className="border-b border-border/10 hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 px-2 text-cyan-400 font-semibold">{y}</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                        const v = tableData.data[y]?.[m];
                        return (
                          <td key={m} className={`py-2 px-1.5 text-center rounded-sm ${cellColor(v)}`}>
                            {v != null ? (v >= 0 ? "+" : "") + v.toFixed(2) + "%" : ""}
                          </td>
                        );
                      })}
                      <td className={`py-2 px-2 text-center font-bold border-l border-cyan-500/20 bg-cyan-500/5 ${cellColor(tableData.yearTotals[y])}`}>
                        {(tableData.yearTotals[y] >= 0 ? "+" : "") + tableData.yearTotals[y].toFixed(2) + "%"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}

function DailyPnlSection({ stats, isLoading, strategyKey }: { stats?: StatsData; isLoading: boolean; strategyKey: StrategyKey }) {
  const dailyData = stats?.dailyPnl ?? [];
  const [filteredData, setFilteredData] = useState(dailyData);
  const [zoomedData, setZoomedData] = useState<typeof dailyData | null>(null);
  const [refLeft, setRefLeft] = useState<string | null>(null);
  const [refRight, setRefRight] = useState<string | null>(null);

  useEffect(() => {
    setFilteredData(dailyData);
  }, [stats]);

  useEffect(() => {
    setZoomedData(null);
  }, [filteredData]);

  const displayData = zoomedData ?? filteredData;
  const isZoomed = zoomedData !== null;

  const handleMouseDown = (e: any) => {
    if (e?.activeLabel) setRefLeft(e.activeLabel);
  };
  const handleMouseMove = (e: any) => {
    if (refLeft && e?.activeLabel) setRefRight(e.activeLabel);
  };
  const handleMouseUp = () => {
    if (refLeft && refRight && refLeft !== refRight) {
      const leftIdx = filteredData.findIndex((d) => d.date === refLeft);
      const rightIdx = filteredData.findIndex((d) => d.date === refRight);
      const [from, to] = leftIdx < rightIdx ? [leftIdx, rightIdx] : [rightIdx, leftIdx];
      if (to - from > 1) {
        setZoomedData(filteredData.slice(from, to + 1));
      }
    }
    setRefLeft(null);
    setRefRight(null);
  };

  const chartBarData = useMemo(() => {
    const minBar = displayData.length > 0 ? Math.max(...displayData.map(d => Math.abs(d.value))) * 0.02 : 0.01;
    return displayData.map((d) => ({
      ...d,
      displayValue: Math.abs(d.value) < 0.0001 ? minBar : d.value,
    }));
  }, [displayData]);

  const yExtreme = useMemo(() => {
    if (displayData.length === 0) return 2;
    const maxAbs = Math.max(...displayData.map((d) => Math.abs(d.value)));
    return Math.ceil(maxAbs * 1.1 * 10) / 10;
  }, [displayData]);

  return (
    <section className="py-20 px-4 sm:px-6 relative" data-testid="section-daily-pnl">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Ежедневный P&L</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Распределение ежедневной доходности стратегии
            </p>
            <LiveDataBadge text="P&L реального торгового счёта" pulse={false} />
            <div className="flex items-center justify-center gap-3 mt-4">
              <TooltipProvider delayDuration={0}>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={`/api/csv?strategy=${strategyKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="link-daily-pnl-csv"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Скачать CSV
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Данные обновляются ежедневно через API с аккаунта Binance</p>
                  </TooltipContent>
                </UITooltip>
                {strategyKey !== "quantumalpha" && (
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={`/api/quantstats?strategy=${strategyKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="link-quantstats-report"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Отчёт QuantStats
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Данные обновляются ежедневно через API с аккаунта Binance</p>
                    </TooltipContent>
                  </UITooltip>
                )}
              </TooltipProvider>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 p-4 sm:p-6">
            {false ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <>
                <ChartPeriodFilter allData={dailyData} onFilter={setFilteredData} />
                {isZoomed && (
                  <div className="flex justify-end mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-border/50"
                      onClick={() => setZoomedData(null)}
                      data-testid="button-daily-pnl-reset-zoom"
                    >
                      Сбросить зум
                    </Button>
                  </div>
                )}
                <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartBarData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--border))" }}
                        tickFormatter={(v: string) => {
                          const d = new Date(v);
                          return d.toLocaleDateString("ru-RU", { month: "short", day: "numeric" });
                        }}
                        interval={Math.max(1, Math.floor(filteredData.length / 8))}
                      />
                      <YAxis
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => v.toFixed(1) + "%"}
                        width={50}
                        domain={[-yExtreme, yExtreme]}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        content={({ active, payload, label }: any) => {
                          if (!active || !payload?.length) return null;
                          const val = payload[0].value as number;
                          if (val == null) return null;
                          const dateStr = new Date(label).toLocaleDateString("ru-RU", { month: "long", day: "numeric", year: "numeric" });
                          const formatted = `${val >= 0 ? "+" : ""}${val.toFixed(4)}%`;
                          return (
                            <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-xl min-w-[200px]">
                              <p className="text-sm font-bold text-foreground mb-2">{dateStr}</p>
                              <div className="flex items-center justify-between gap-6">
                                <span className="text-xs text-muted-foreground">Ежедневный P&L</span>
                                <span className={`text-sm font-bold font-mono ${val >= 0 ? "text-cyan-400" : "text-red-400"}`}>{formatted}</span>
                              </div>
                              <ChartLiveBadge text="Данные реальной торговли · Реальный счёт · Обновляется ежедневно через API" />
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="displayValue" radius={[1, 1, 0, 0]} maxBarSize={4}>
                        {displayData.map((entry, idx) => {
                          const isZero = Math.abs(entry.value) < 0.0001;
                          return (
                            <Cell key={idx} fill={isZero ? "#475569" : entry.value >= 0 ? "#34d399" : "#f87171"} fillOpacity={isZero ? 0.4 : 0.8} />
                          );
                        })}
                      </Bar>
                      {refLeft && refRight && (
                        <ReferenceArea x1={refLeft} x2={refRight} strokeOpacity={0.2} stroke="rgba(6,182,212,0.3)" fill="rgba(6,182,212,0.05)" fillOpacity={1} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {!isZoomed && (
                  <p className="text-[10px] text-muted-foreground/40 text-center mt-1">Нажмите и перетащите на графике для увеличения</p>
                )}
              </>
            )}
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}

function DetailedStatsSection({ stats, isLoading }: { stats?: StatsData; isLoading: boolean }) {
  const m = stats?.metrics;
  if (!m && !isLoading) return null;

  const groups = [
    {
      title: "Показатели с учётом риска",
      items: [
        { label: "Коэф. Шарпа", key: "Sharpe" },
        { label: "Коэф. Сортино", key: "Sortino" },
        { label: "Коэф. Кальмара", key: "Calmar" },
        { label: "Коэф. Омега", key: "Omega" },
        { label: "Критерий Келли", key: "Kelly Criterion" },
        { label: "Фактор прибыли", key: "Profit Factor" },
        { label: "Доход/Убыток", key: "Gain/Pain Ratio" },
      ],
    },
    {
      title: "Статистика",
      items: [
        { label: "Прибыльных дней", key: "Win Days" },
        { label: "Прибыльных месяцев", key: "Win Month" },
        { label: "Прибыльных кварталов", key: "Win Quarter" },
        { label: "Прибыльных лет", key: "Win Year" },
        { label: "Макс. серия прибыльных подряд", key: "Max Consecutive Wins" },
        { label: "Макс. серия убыточных подряд", key: "Max Consecutive Losses" },
        { label: "Асимметрия (Skew)", key: "Skew" },
      ],
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 relative" data-testid="section-detailed-stats">
      <div className="max-w-7xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Расширенная статистика
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Детальный количественный анализ
            </p>
            <LiveDataBadge text="Рассчитано по данным реального счёта" pulse={false} />
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
          {groups.map((group, gi) => (
            <AnimatedSection key={group.title} delay={gi * 120}>
              <Card className="overflow-hidden bg-card/50 backdrop-blur-sm border-border/50 h-full">
                <div className="p-4 border-b border-border/30">
                  <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                </div>
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-5 w-full" />)}
                  </div>
                ) : (
                  <div className="p-4 space-y-0">
                    {group.items.map((item) => {
                      const val = getMetricValue(m, item.key, "---");
                      return (
                        <div key={item.key} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                          <span className={`text-xs font-mono font-medium ${
                            val.startsWith("-") ? "text-red-400" : "text-foreground"
                          }`}>
                            {val}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function buildFaqItems(sc: StrategyConfig) {
  if (sc.key === "quantumalpha") {
    return [
      {
        q: "Как работает алгоритм?",
        a: "Quantum Alpha — полностью автоматизированный количественный торговый алгоритм с ~40 независимыми моделями, работающими одновременно по трём типам стратегий: следование за трендом, статистический арбитраж и захват ставки финансирования. Управляющая компания подключается к субаккаунту клиента через API — ваш капитал всегда остаётся на вашем счёте.",
      },
      {
        q: "Сколько моделей работает в системе?",
        a: "40 независимых количественных моделей работают одновременно по трём типам стратегий: следование за трендом, статистический арбитраж и захват ставки финансирования. В каждый момент активно задействована лишь часть счёта.",
      },
      {
        q: "Какие активы торгует алгоритм?",
        a: "Алгоритм торгует 10 криптовалютных пар по капитализации. Залог может размещаться в USDT, BTC, ETH или любом токене для счетов расширенный маржинальный режим.",
      },
      {
        q: "Какие биржи поддерживаются?",
        a: "Binance, Bybit и OKX. Залог может быть в USDT, BTC, ETH или любом токене для счетов расширенный маржинальный режим.",
      },
      {
        q: "Какова типичная частота сделок и срок удержания?",
        a: "Алгоритм совершает 20–30 сделок в месяц со средним временем удержания 1 день и максимальным — 20 дней.",
      },
      {
        q: "Какие токены принимаются как обеспечение?",
        a: "USDT, BTC и ETH — основные варианты залога. Счета расширенный маржинальный режим могут использовать любой поддерживаемый токен в качестве залога.",
      },
      {
        q: "Как алгоритм управляет рисками и просадками?",
        a: "Размер позиции определяется на основе волатильности с автоматическими контролями исполнения. Инфраструктура уровня enterprise для стабильной генерации альфа. Комплексные метрики риска и наихудшие периоды просадок постоянно мониторятся.",
      },
      {
        q: "Какова общая ёмкость алгоритма?",
        a: "$500M (при множителе 1x). Ёмкость масштабируется с выбранным множителем риска.",
      },
      {
        q: "Данные о результатах — бэктест или реальная торговля?",
        a: "Представленные на сайте данные отражают результаты реальной торговли. Прошлые результаты не являются показателем будущих результатов.",
      },
    ];
  }
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
      a: "Свяжитесь с нами через Telegram для начала онбординга. Подключение идёт через официальный копитрейдинг биржи — вы подписываетесь на стратегию в несколько кликов. Процесс настройки прост и занимает менее 10 минут.",
    },
    {
      q: "Каков минимальный размер аллокации?",
      a: "Минимальная аллокация — $500. Мы поддерживаем все основные криптовалютные биржи.",
    },
    {
      q: "Какие комиссии применяются?",
      a: "Комиссия за управление составляет 0%, плюс комиссия за результат 30% с принцип «высшей отметки». Комиссии рассчитываются и распределяются ежеквартально. Срок блокировки средств отсутствует.",
    },
    {
      q: "Какие биржи поддерживаются?",
      a: "Binance, OKX, Bybit, Bitget, BingX. Подключение через официальный копитрейдинг биржи.",
    },
    {
      q: "Какие активы торгуются?",
      a: "Стратегии торгуют бессрочными фьючерсами на BTC и ETH. Обеспечение может быть в USDT, BTC, ETH или любом токене на счёте расширенный маржинальный режим.",
    },
    {
      q: "Как долго удерживаются позиции?",
      a: sc.key === "basket70tf"
        ? "Системы на основе моментума удерживают позиции до 3 дней. Трендовые компоненты Basket 70 TF способны удерживать позиции до нескольких недель для захвата продолжительных и чётко сформированных рыночных трендов."
        : `Системы на основе моментума в ${sc.label} удерживают позиции до 3 дней, ориентируясь на краткосрочные локальные тренды, всплески волатильности и возврат к среднему значению. Отдельные системы портфеля могут удерживать позиции до нескольких недель.`,
    },
    {
      q: "Какие меры управления рисками применяются?",
      a: `Каждая сделка открывается с фиксированным риском. Стоп-лоссы и тейк-профиты калибруются автоматически с учётом текущей волатильности. В периоды аномальной волатильности система снижает активность. Круглосуточный автоматический мониторинг.`,
    },
    {
      q: "Данные о результатах — бэктест или реальная торговля?",
      a: "Представленные на сайте данные отражают результаты реальной торговли SMA. Верифицированная история доступна через GenieAI. Прошлые результаты не являются показателем будущих результатов.",
    },
  ];
}

function FAQSection({ sc }: { sc: StrategyConfig }) {
  const FAQ_ITEMS = buildFaqItems(sc);
  return (
    <section className="py-20 px-4 sm:px-6 relative" data-testid="section-faq">
      <div className="max-w-3xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
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
                  className="text-sm font-medium text-foreground hover:no-underline py-4"
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

function ExchangesBlock() {
  const exchanges = [
    { name: "Binance", logo: "/exchanges/binance.svg" },
    { name: "OKX", logo: "/exchanges/okx.svg" },
    { name: "Bybit", logo: "/exchanges/bybit.svg" },
    { name: "Aster (ex-Bullish)", logo: "/exchanges/bybit.svg" },
  ];
  return (
    <section className="py-16 px-4 sm:px-6 relative" data-testid="section-exchanges">
      <div className="max-w-4xl mx-auto text-center">
        <AnimatedSection>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">Поддерживаемые биржи</h2>
          <p className="text-muted-foreground text-sm mb-8">Подключение через API на субаккаунте клиента. Средства всегда остаются на вашем счёте.</p>
        </AnimatedSection>
        <AnimatedSection delay={100}>
          <div className="flex items-center justify-center gap-8 sm:gap-14 flex-wrap">
            {exchanges.map((ex) => (
              <div key={ex.name} className="flex flex-col items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                <img src={ex.logo} alt={ex.name} className="h-10 sm:h-12 brightness-0 invert rounded-lg" />
                <span className="text-xs text-muted-foreground">{ex.name}</span>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/30" data-testid="section-footer">
      <div className="py-16 px-4 sm:px-6 text-center" data-testid="section-footer-cta">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Начните зарабатывать с алгоритмом</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-lg mx-auto">
            Подключение через биржевой копитрейдинг занимает несколько минут. Напишите нам — поможем с настройкой.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 min-w-[200px]"
              onClick={() => window.open("https://t.me/", "_blank")}
              data-testid="button-footer-contact"
            >
              <Send className="w-4 h-4 mr-2" />
              Написать нам в Telegram
            </Button>
            <Button
              size="lg"
              className="bg-[#25D366] hover:bg-[#1fb855] text-white shadow-lg shadow-green-500/20 min-w-[200px]"
              onClick={() => window.open("https://wa.me/", "_blank")}
              data-testid="button-footer-whatsapp"
            >
              <SiWhatsapp className="w-4 h-4 mr-2" />
              Написать нам в WhatsApp
            </Button>
          </div>
        </div>
      </div>
      <div className="px-4 sm:px-6 pb-10 border-t border-border/20">
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
            <p>Прошлые результаты не являются показателем будущих результатов. Представленные на сайте данные отражают результаты реальной торговли SMA. Исторические результаты не являются гарантией будущей доходности и не отражают влияние всех возможных рыночных сценариев на результаты стратегии.</p>
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
  basket70: "basket70",
  basket70tf: "basket70tf",
  quantumalpha: "quantumalpha",
};

function getStrategyFromPath(): StrategyKey {
  const path = window.location.pathname.replace(/^\//, "").toLowerCase();
  return STRATEGY_SLUG_MAP[path] || "basket50";
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [strategy, setStrategyState] = useState<StrategyKey>(getStrategyFromPath);

  const setStrategy = useCallback((key: StrategyKey) => {
    setStrategyState(key);
    setLocation(`/${key}`);
  }, [setLocation]);
  const sc = STRATEGIES[strategy];

  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats", strategy],
    queryFn: () => Promise.resolve({ metrics: {}, equity: [], drawdownChart: [], eoyReturns: [], drawdowns: [], monthlyGrid: [], dailyPnl: [], dateRange: "" }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      <LegalDisclaimerModal />
      <Navbar strategy={strategy} onStrategyChange={setStrategy} />
      <HeroSection stats={stats} sc={sc} />

      {/* Social Proof — separate section */}
      <section className="py-10 px-4 sm:px-6 bg-card/20 border-y border-border/10">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {[
              "Работаем с 2018 года",
              "Прозрачная онлайн-статистика",
              "Тысячи подключённых аккаунтов",
              "Крупнейшие криптобиржи",
              "Без передачи средств",
            ].map((text) => (
              <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <svg className="w-4 h-4 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MetricsSection stats={stats} isLoading={isLoading} strategyKey={strategy} />

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 relative">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Как это работает</h2>
              <p className="text-muted-foreground text-sm max-w-lg mx-auto">Подключение через биржевой копитрейдинг — просто и быстро</p>
            </div>
          </AnimatedSection>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Откройте счёт на бирже", desc: "Зарегистрируйтесь на одной из поддерживаемых бирж (Binance, OKX, Bybit, Bitget, BingX) и пополните баланс." },
              { step: "02", title: "Подпишитесь на стратегию", desc: "Найдите нашу стратегию в разделе копитрейдинга биржи и подпишитесь в один клик. Средства остаются на вашем счёте." },
              { step: "03", title: "Алгоритм работает за вас", desc: "Сделки копируются автоматически 24/7. Отслеживайте результаты в приложении биржи в реальном времени." },
            ].map((item) => (
              <AnimatedSection key={item.step} delay={parseInt(item.step) * 100}>
                <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50 h-full text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>
      {/* Advantages */}
      <section id="advantages" className="py-20 px-4 sm:px-6 relative">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Почему копитрейдинг</h2>
              <p className="text-muted-foreground text-sm max-w-lg mx-auto">Преимущества подключения через биржевой копитрейдинг</p>
            </div>
          </AnimatedSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Shield, title: "Без передачи средств", desc: "Деньги всегда на вашем биржевом счёте. Никто кроме вас не имеет к ним доступа." },
              { icon: Lock, title: "Вывод в любой момент", desc: "Нет блокировки средств. Отключитесь от стратегии или выведите деньги когда захотите." },
              { icon: Activity, title: "Контроль в приложении", desc: "Отслеживайте каждую сделку в реальном времени через мобильное приложение биржи." },
              { icon: DollarSign, title: "Без скрытых комиссий", desc: "0% за управление. Комиссия 30% только с прибыли. Не заработали — не платите." },
            ].map((item, i) => (
              <AnimatedSection key={item.title} delay={i * 80}>
                <Card className="p-5 bg-card/50 backdrop-blur-sm border-border/50 h-full">
                  <div className="w-10 h-10 mb-3 rounded-md bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1.5">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <StrategyArchSection sc={sc} />
      <EquityChartSection stats={stats} isLoading={isLoading} strategyKey={strategy} />
      <PerformanceSection stats={stats} isLoading={isLoading} />
      <RiskSection stats={stats} isLoading={isLoading} />
      <DrawdownChartSection stats={stats} isLoading={isLoading} />
      <MonthlyReturnsSection stats={stats} isLoading={isLoading} />
      <DailyPnlSection stats={stats} isLoading={isLoading} strategyKey={strategy} />
      <DetailedStatsSection stats={stats} isLoading={isLoading} />
      <ROIGrowthSection stats={stats} strategyKey={strategy} />
      <AccessTermsSection sc={sc} />
      {/* Taglines */}
      <section className="py-16 px-4 sm:px-6 border-t border-border/10">
        <div className="max-w-4xl mx-auto space-y-6 text-center">
          {[
            "Ваши деньги работают, пока вы отдыхаете",
            "Без эмоций. Без догадок. Только математика.",
            "Ваш капитал — на вашей бирже. Наш алгоритм — на связи 24/7.",
          ].map((line, i) => (
            <p key={i} className="text-lg sm:text-xl md:text-2xl font-light text-muted-foreground/60 italic">
              «{line}»
            </p>
          ))}
        </div>
      </section>

      {/* CTA before FAQ */}
      <section className="py-16 px-4 sm:px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Готовы подключиться?</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-lg mx-auto">
            Свяжитесь с нашей командой напрямую. Мы расскажем о стратегии, подключении через копитрейдинг и процессе онбординга.
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-8 text-sm text-muted-foreground">
            {[
              "Многолетний опыт алгоритмической торговли",
              "Тысячи подключённых аккаунтов",
              "Прозрачная онлайн-статистика",
              "Подключение за 10 минут",
              "Поддержка 24/7",
            ].map((text) => (
              <div key={text} className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span>{text}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 min-w-[200px]"
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