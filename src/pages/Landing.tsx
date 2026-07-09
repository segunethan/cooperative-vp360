import { Link } from "react-router-dom";
import { useRef, useEffect, useState } from "react";
import { motion, useInView, useAnimation, AnimatePresence } from "framer-motion";
import {
  Users,
  PiggyBank,
  CreditCard,
  TrendingUp,
  Shield,
  FileText,
  ArrowRight,
  CheckCircle2,
  Lock,
  Zap,
  Globe,
  ChevronRight,
  Menu,
  X,
  RefreshCw,
  Megaphone,
  Package,
  CalendarDays,
  BadgeCheck,
  Banknote,
} from "lucide-react";

/* ── Animation helpers ───────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (delay = 0) => ({
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut", delay },
  }),
};

const staggerChildren = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};

function FadeSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      custom={delay}
    >
      {children}
    </motion.div>
  );
}

/* ── Animated counter ──────────────────────────────────────────────── */
function Counter({ target, prefix = "", suffix = "" }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

/* ── Data ─────────────────────────────────────────────────────────── */

const features = [
  {
    icon: Users,
    title: "Member Management",
    desc: "Full lifecycle from invite to exit — KYC verification, unique member IDs, bulk CSV import, and status management in one place.",
    accent: "from-primary/8 to-primary/4",
  },
  {
    icon: RefreshCw,
    title: "Rotational Savings (Ajo/Esusu)",
    desc: "Run structured Ajo and Esusu cycles digitally. Track rotation schedules, who's collecting next, and ensure every member contributes on time — no spreadsheet, no arguments.",
    accent: "from-emerald-500/8 to-emerald-500/4",
  },
  {
    icon: PiggyBank,
    title: "Contribution Tracking",
    desc: "Every kobo posted to an append-only double-entry ledger. Approve, reject, or query any payment with a full audit trail.",
    accent: "from-blue-500/8 to-blue-500/4",
  },
  {
    icon: Package,
    title: "Loan Products Catalogue",
    desc: "Define Personal, Emergency, Business, and Agricultural loan products — each with its own interest rate, max tenure, and eligibility criteria. Members apply, committee approves.",
    accent: "from-violet-500/8 to-violet-500/4",
  },
  {
    icon: TrendingUp,
    title: "Dividend Distribution",
    desc: "Declare dividends with a qualification date. Jollify calculates every member's entitlement automatically — integer arithmetic, zero rounding errors.",
    accent: "from-amber-500/8 to-amber-500/4",
  },
  {
    icon: Megaphone,
    title: "Announcements & Communications",
    desc: "Publish AGM notices, payment reminders, and policy updates to all members — or target just active members, board members, or delinquent borrowers.",
    accent: "from-rose-500/8 to-rose-500/4",
  },
  {
    icon: Shield,
    title: "Bank-Grade Security",
    desc: "Row-Level Security at the Postgres layer. Cooperative A cannot read a single byte of Cooperative B's data.",
    accent: "from-primary/8 to-primary/4",
  },
  {
    icon: FileText,
    title: "Immutable Audit Trail",
    desc: "Every admin action — approvals, disbursements, declarations — logged with actor ID and timestamp. Permanent, tamper-proof.",
    accent: "from-blue-500/8 to-blue-500/4",
  },
];

const loanProducts = [
  { icon: Banknote, name: "Personal Loan", desc: "For member welfare and personal needs", rate: "From 2% / month" },
  { icon: Zap, name: "Emergency Loan", desc: "Fast-tracked for urgent situations", rate: "From 1.5% / month" },
  { icon: TrendingUp, name: "Business Loan", desc: "For member SME and trading capital", rate: "From 3% / month" },
  { icon: Package, name: "Agricultural Loan", desc: "Seasonal disbursement for farmers", rate: "From 2.5% / month" },
];

const announcementTypes = [
  { icon: CalendarDays, label: "AGM Notices", desc: "Notify all members of upcoming general meetings with date, time, and agenda." },
  { icon: TrendingUp, label: "Dividend Alerts", desc: "Automatically inform members when dividends are declared and ready for payout." },
  { icon: BadgeCheck, label: "Policy Updates", desc: "Communicate changes to loan terms, contribution schedules, or cooperative rules." },
  { icon: Megaphone, label: "Payment Reminders", desc: "Target delinquent members with automated contribution reminders before deadlines." },
];

const stats = [
  { value: 5000, prefix: "", suffix: "+", label: "Registered cooperatives in Nigeria" },
  { value: 2.1, prefix: "₦", suffix: "T", label: "Total assets under management", raw: true },
  { value: 12, prefix: "", suffix: "M+", label: "Cooperative members nationwide", raw: true },
];

const plans = [
  {
    name: "Starter",
    price: "₦15,000",
    members: "Up to 50 members",
    features: ["Members & contributions", "Loan processing", "Announcements", "Email invitations"],
    highlight: false,
  },
  {
    name: "Growth",
    price: "₦45,000",
    members: "Up to 500 members",
    features: ["Everything in Starter", "Dividends module", "Bulk CSV import", "API access", "CSV export"],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "₦120,000",
    members: "Unlimited members",
    features: ["Everything in Growth", "Member self-service portal", "Custom domain", "Compliance reports", "Priority support"],
    highlight: false,
  },
];

/* ── Component ────────────────────────────────────────────────────── */

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans antialiased">

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "border-b border-border/60 bg-background/90 backdrop-blur-xl shadow-sm" : "bg-transparent"
        }`}
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <motion.div
              className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0"
              whileHover={{ scale: 1.08 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <span className="text-primary font-bold text-sm font-display">J</span>
            </motion.div>
            <span className={`font-display font-bold text-lg tracking-tight transition-colors duration-300 ${scrolled ? "text-foreground" : "text-white"}`}>
              Jollify
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            {["Features", "How it works", "Pricing", "API"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                className={`relative transition-colors duration-200 group ${scrolled ? "text-muted-foreground hover:text-foreground" : "text-white/80 hover:text-white"}`}
              >
                {item}
                <span className={`absolute -bottom-0.5 left-0 h-px w-0 group-hover:w-full transition-all duration-300 ${scrolled ? "bg-primary" : "bg-white"}`} />
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className={`text-sm font-medium transition-colors px-3 py-2 ${scrolled ? "text-muted-foreground hover:text-foreground" : "text-white/80 hover:text-white"}`}
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${scrolled ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-white text-primary hover:bg-white/90"}`}
            >
              Sign up free
            </Link>
          </div>

          {/* Mobile menu button */}
          <motion.button
            className={`md:hidden p-2 rounded-lg transition-colors ${scrolled ? "text-muted-foreground hover:text-foreground hover:bg-muted/50" : "text-white/80 hover:text-white hover:bg-white/10"}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            whileTap={{ scale: 0.92 }}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </motion.button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              className="md:hidden bg-background border-b border-border px-6 pb-4"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <nav className="flex flex-col gap-3 pt-2">
                {["Features", "How it works", "Pricing", "API"].map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground py-2 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item}
                  </a>
                ))}
                <div className="flex gap-3 pt-1 border-t border-border">
                  <Link
                    to="/login"
                    className="flex-1 text-center text-sm font-medium text-muted-foreground border border-border rounded-lg py-2.5 hover:text-foreground transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    className="flex-1 text-center text-sm font-semibold bg-primary text-primary-foreground rounded-lg py-2.5 hover:bg-primary/90 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign up free
                  </Link>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-hero-gradient pt-16">
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(146 53% 84%) 1px, transparent 0)`,
            backgroundSize: "30px 30px",
          }}
        />

        {/* Glow blobs */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-green-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-64 h-64 bg-emerald-400/8 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-28 text-center">

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 text-xs font-semibold text-green-100 mb-8 tracking-wide uppercase"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
            Built for Nigerian Cooperative Societies
          </motion.div>

          <motion.h1
            className="font-display text-5xl md:text-7xl font-extrabold text-white leading-[1.05] tracking-[-1.5px] mb-6 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            The modern OS for{" "}
            <span
              className="inline-block"
              style={{
                background: "linear-gradient(135deg, hsl(146 53% 84%), hsl(153 41% 65%), hsl(146 53% 84%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              cooperatives
            </span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-white/55 max-w-2xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.28 }}
          >
            Manage members, track contributions, process loans, and distribute
            dividends — from one secure, auditable platform. No spreadsheets. No WhatsApp groups.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.36 }}
          >
            <motion.div whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.975 }}>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 bg-white text-primary font-semibold px-7 py-3.5 rounded-xl text-sm hover:bg-green-50 transition-colors duration-200 shadow-xl shadow-black/20"
              >
                Create free account <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-white/80 font-medium px-6 py-3.5 rounded-xl text-sm border border-white/20 hover:bg-white/10 transition-colors duration-200"
              >
                Log in to your account
              </Link>
            </motion.div>
          </motion.div>

          {/* Trust bar */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-6 mt-14"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            {[
              { icon: Lock, text: "Double-entry ledger" },
              { icon: Shield, text: "Postgres RLS isolation" },
              { icon: Zap, text: "Real-time dashboard" },
              { icon: Globe, text: "Public REST API" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-sm text-white/45">
                <Icon className="h-3.5 w-3.5 text-green-300/60" />
                <span>{text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center"
            variants={staggerChildren}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
          >
            {stats.map(({ value, prefix, suffix, label, raw }) => (
              <motion.div key={label} variants={fadeUp}>
                <div className="font-display text-4xl md:text-5xl font-extrabold text-primary mb-2 tracking-tight tabular-nums">
                  {raw ? (
                    <span>{prefix}{value}{suffix}</span>
                  ) : (
                    <Counter target={value as number} prefix={prefix} suffix={suffix} />
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="py-28 max-w-6xl mx-auto px-6">
        <FadeSection className="text-center mb-16">
          <p className="text-xs font-semibold tracking-[3px] uppercase text-primary/60 mb-3">Platform Features</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-4">
            Everything your cooperative needs
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-base leading-relaxed">
            The disciplines that make Jollify bank-grade are built in from day one — not bolted on later.
          </p>
        </FadeSection>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={staggerChildren}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {features.map(({ icon: Icon, title, desc, accent }) => (
            <motion.div
              key={title}
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2, ease: "easeOut" } }}
              className="group bg-white rounded-2xl p-6 border border-border hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300 cursor-default"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110`}>
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-2 text-base">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Ajo/Esusu spotlight ──────────────────────────────────────── */}
      <section className="py-24 bg-white border-y border-border">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <FadeSection>
              <p className="text-xs font-semibold tracking-[3px] uppercase text-primary/60 mb-4">Rotational Savings</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-5 leading-tight">
                Ajo and Esusu,<br />finally done right.
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed mb-6">
                Millions of Nigerians participate in rotating savings — but most are still managed over WhatsApp and paper. Jollify brings your Ajo and Esusu cycles online: define the rotation order, track who has collected, flag missed contributions, and give every member a clear view of when their turn comes.
              </p>
              <ul className="space-y-3">
                {[
                  "Set contribution amounts and collection schedule upfront",
                  "Auto-track who is next in the rotation queue",
                  "Flag and notify members who miss their contribution",
                  "Full history of every cycle — no disputes, no 'I paid already'",
                  "Run multiple Ajo groups under one cooperative account",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </FadeSection>

            <FadeSection delay={0.15}>
              <div className="bg-background rounded-2xl border border-border p-6 space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display font-bold text-foreground text-sm">Ajo Cycle — July 2026</span>
                  <span className="text-xs bg-primary/8 text-primary font-semibold px-2.5 py-1 rounded-full">Round 4 of 12</span>
                </div>
                {[
                  { name: "Ngozi Adeyemi", amount: "₦50,000", status: "Collected", turn: "Jan" },
                  { name: "Emeka Okafor", amount: "₦50,000", status: "Collected", turn: "Feb" },
                  { name: "Fatima Bello", amount: "₦50,000", status: "Collected", turn: "Mar" },
                  { name: "Chidi Eze", amount: "₦50,000", status: "Collecting now", turn: "Apr", active: true },
                  { name: "Aisha Mohammed", amount: "₦50,000", status: "Upcoming", turn: "May" },
                  { name: "Taiwo Ogundimu", amount: "₦50,000", status: "Upcoming", turn: "Jun" },
                ].map((row) => (
                  <div
                    key={row.name}
                    className={`flex items-center justify-between p-3 rounded-xl text-sm ${
                      row.active
                        ? "bg-primary text-white"
                        : "bg-white border border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${row.active ? "bg-white/20 text-white" : "bg-primary/8 text-primary"}`}>
                        {row.name[0]}
                      </div>
                      <span className={`font-medium ${row.active ? "text-white" : "text-foreground"}`}>{row.name}</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold tabular-nums ${row.active ? "text-white" : "text-foreground"}`}>{row.amount}</div>
                      <div className={`text-xs ${row.active ? "text-white/70" : row.status === "Collected" ? "text-primary" : "text-muted-foreground"}`}>{row.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </FadeSection>
          </div>
        </div>
      </section>

      {/* ── Loan Products ─────────────────────────────────────────────── */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <FadeSection className="text-center mb-14">
          <p className="text-xs font-semibold tracking-[3px] uppercase text-primary/60 mb-3">Loan Products</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">
            Every cooperative has different lending needs.
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-base leading-relaxed">
            Configure as many loan products as you need — each with its own interest rate, tenure cap, and approval workflow. Members apply, committee approves, disbursement is tracked.
          </p>
        </FadeSection>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={staggerChildren}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {loanProducts.map(({ icon: Icon, name, desc, rate }) => (
            <motion.div
              key={name}
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group bg-white rounded-2xl p-6 border border-border hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center mb-4 group-hover:bg-primary/14 transition-colors">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display font-bold text-foreground mb-1.5 text-base">{name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{desc}</p>
              <div className="text-xs font-semibold text-primary bg-primary/6 rounded-lg px-3 py-1.5 w-fit">{rate}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Announcements ─────────────────────────────────────────────── */}
      <section className="py-24 bg-white border-y border-border">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <FadeSection delay={0.1}>
              <div className="space-y-4">
                {announcementTypes.map(({ icon: Icon, label, desc }) => (
                  <motion.div
                    key={label}
                    className="flex gap-4 p-4 rounded-xl border border-border hover:border-primary/20 hover:bg-primary/2 transition-all duration-200 cursor-default"
                    whileHover={{ x: 4, transition: { duration: 0.15 } }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-display font-semibold text-foreground text-sm mb-1">{label}</div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </FadeSection>

            <FadeSection>
              <p className="text-xs font-semibold tracking-[3px] uppercase text-primary/60 mb-4">Announcements</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-5 leading-tight">
                Reach every member.<br />Every time.
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed mb-6">
                Stop chasing members over WhatsApp. Publish official announcements directly from the platform — AGM dates, dividend notices, loan policy changes — and target exactly who needs to see it.
              </p>
              <div className="flex flex-wrap gap-2">
                {["All members", "Active only", "Board members", "Delinquent borrowers", "New members"].map((tag) => (
                  <span key={tag} className="text-xs font-medium text-primary bg-primary/8 border border-primary/12 rounded-full px-3 py-1.5">
                    {tag}
                  </span>
                ))}
              </div>
            </FadeSection>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 bg-white border-y border-border">
        <div className="max-w-6xl mx-auto px-6">
          <FadeSection className="text-center mb-16">
            <p className="text-xs font-semibold tracking-[3px] uppercase text-primary/60 mb-3">How it works</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-4">
              Up and running in minutes
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-base">
              No setup fees. No lengthy onboarding. Your cooperative is live the moment you register.
            </p>
          </FadeSection>

          <motion.div
            className="grid md:grid-cols-3 gap-10"
            variants={staggerChildren}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
          >
            {[
              {
                step: "01",
                title: "Register your cooperative",
                desc: "Create an account and your cooperative gets a unique Cooperative ID (e.g. COOP000001). Takes under 2 minutes.",
              },
              {
                step: "02",
                title: "Add your members",
                desc: "Register members one by one or bulk-import from a CSV spreadsheet. Each member gets a cooperative-specific serial ID like LAG000001.",
              },
              {
                step: "03",
                title: "Manage & grow",
                desc: "Record contributions, process loans, declare dividends, and send announcements — all from your dashboard.",
              },
            ].map(({ step, title, desc }, i) => (
              <motion.div key={step} variants={fadeUp} className="relative">
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-[calc(100%+10px)] w-[calc(100%-20px)] h-px bg-gradient-to-r from-border to-transparent" />
                )}
                <motion.div
                  className="font-display text-8xl font-extrabold text-primary/6 leading-none mb-4 select-none"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                >
                  {step}
                </motion.div>
                <h3 className="font-display font-bold text-foreground text-xl mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── API callout ──────────────────────────────────────────────── */}
      <section id="api" className="py-28 max-w-6xl mx-auto px-6">
        <FadeSection>
          <div className="bg-hero-gradient rounded-3xl p-10 md:p-16 flex flex-col md:flex-row items-start gap-12 relative overflow-hidden">
            {/* Dot grid overlay */}
            <div
              className="absolute inset-0 opacity-[0.04] rounded-3xl"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, hsl(146 53% 84%) 1px, transparent 0)`,
                backgroundSize: "28px 28px",
              }}
            />

            <div className="relative flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1 text-[11px] font-semibold text-green-200 mb-5 uppercase tracking-widest">
                <Globe className="h-3 w-3" /> Public REST API
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight mb-4 leading-tight">
                Integrate with anything.<br />Build on top of Jollify.
              </h2>
              <p className="text-white/55 text-base leading-relaxed max-w-md mb-6">
                The full platform is available as a versioned REST API at{" "}
                <code className="text-green-300 font-mono text-sm bg-white/10 px-1.5 py-0.5 rounded">api.jollify.app/v1/</code>.
                Authenticate once, then manage members, contributions, loans, and dividends from any system.
              </p>
              <div className="flex flex-wrap gap-3">
                {["Members", "Contributions", "Loans", "Dividends", "Announcements"].map((r) => (
                  <span key={r} className="text-xs font-medium text-white/60 bg-white/10 border border-white/10 rounded-full px-3 py-1">
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <motion.div
              className="relative flex-1 min-w-0 w-full"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="bg-black/40 backdrop-blur rounded-2xl border border-white/10 p-6 font-mono text-sm leading-loose">
                <div className="flex items-center gap-1.5 mb-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className="ml-2 text-white/25 text-xs">GET /v1/members/LAG000042</span>
                </div>
                <div className="text-green-200/70">
                  <div><span className="text-white/30">{"{"}</span></div>
                  <div className="pl-4"><span className="text-blue-300">"member_number"</span><span className="text-white/30">: </span><span className="text-amber-300">"LAG000042"</span><span className="text-white/30">,</span></div>
                  <div className="pl-4"><span className="text-blue-300">"full_name"</span><span className="text-white/30">: </span><span className="text-amber-300">"Adaeze Okonkwo"</span><span className="text-white/30">,</span></div>
                  <div className="pl-4"><span className="text-blue-300">"status"</span><span className="text-white/30">: </span><span className="text-green-300">"ACTIVE"</span><span className="text-white/30">,</span></div>
                  <div className="pl-4"><span className="text-blue-300">"total_contributions"</span><span className="text-white/30">: </span><span className="text-purple-300">1250000</span></div>
                  <div><span className="text-white/30">{"}"}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/8 text-white/20 text-[11px]">
                  // amounts always in kobo — integer arithmetic, no floats
                </div>
              </div>
            </motion.div>
          </div>
        </FadeSection>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section id="pricing" className="py-28 bg-white border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <FadeSection className="text-center mb-16">
            <p className="text-xs font-semibold tracking-[3px] uppercase text-primary/60 mb-3">Pricing</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-4">
              Simple, predictable pricing
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto text-base">
              No transaction fees on contributions. No hidden charges. Pay monthly, cancel anytime.
            </p>
          </FadeSection>

          <motion.div
            className="grid md:grid-cols-3 gap-5 items-stretch"
            variants={staggerChildren}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
          >
            {plans.map((plan) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                whileHover={plan.highlight ? {} : { y: -4, transition: { duration: 0.2 } }}
                className={`rounded-2xl p-8 flex flex-col border transition-shadow duration-300 ${
                  plan.highlight
                    ? "bg-primary text-white border-primary shadow-2xl shadow-primary/25 scale-[1.02]"
                    : "bg-white border-border hover:border-primary/20 hover:shadow-lg hover:shadow-primary/6"
                }`}
              >
                {plan.highlight && (
                  <div className="text-[10px] font-bold tracking-[2px] uppercase text-primary bg-white rounded-full px-3 py-1 w-fit mb-4">
                    Most popular
                  </div>
                )}
                <div className={`text-sm font-semibold mb-1 ${plan.highlight ? "text-white/60" : "text-muted-foreground"}`}>
                  {plan.name}
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`font-display text-4xl font-extrabold tracking-tight ${plan.highlight ? "text-white" : "text-foreground"}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.highlight ? "text-white/45" : "text-muted-foreground"}`}>/month</span>
                </div>
                <div className={`text-xs mb-7 ${plan.highlight ? "text-white/45" : "text-muted-foreground"}`}>{plan.members}</div>

                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle2 className={`h-4 w-4 mt-0.5 flex-shrink-0 ${plan.highlight ? "text-green-200" : "text-primary"}`} />
                      <span className={`text-sm ${plan.highlight ? "text-white/75" : "text-muted-foreground"}`}>{f}</span>
                    </li>
                  ))}
                </ul>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    to="/signup"
                    className={`w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                      plan.highlight
                        ? "bg-white text-primary hover:bg-green-50"
                        : "bg-primary/7 text-primary hover:bg-primary/12 border border-primary/15"
                    }`}
                  >
                    Get started <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="py-28 max-w-6xl mx-auto px-6 text-center">
        <FadeSection>
          <div className="max-w-2xl mx-auto">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-5 leading-tight">
              Your cooperative deserves{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, hsl(158 96% 12%), hsl(153 41% 35%))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                better tools.
              </span>
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed mb-10">
              Join cooperatives across Nigeria that have moved from spreadsheets and WhatsApp groups
              to a proper, auditable financial platform.
            </p>
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="inline-block"
            >
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-9 py-4 rounded-xl text-base hover:bg-primary/90 transition-colors duration-200 shadow-xl shadow-primary/25"
              >
                Start for free today <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </FadeSection>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-white">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs font-display">J</span>
            </div>
            <span className="font-display font-bold text-foreground">Jollify</span>
            <span className="text-muted-foreground text-sm">— Cooperative Finance Platform</span>
          </div>
          <p className="text-xs text-muted-foreground order-last md:order-none">© 2026 Jollify. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span className="hover:text-foreground cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Security</span>
            <Link to="/cooperative" className="text-primary font-medium hover:text-primary/80 transition-colors">
              Sign in →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
