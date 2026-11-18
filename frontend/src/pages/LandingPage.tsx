import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Navigation,
  Sparkles,
  Building2,
  HeartHandshake,
  PhoneCall,
  ArrowRight,
  Lock,
  EyeOff,
  Radio,
  Hospital,
  Pill,
  Fuel,
  Store,
  Hotel,
  GraduationCap,
  FileText,
  Brain,
} from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

const partnerCategories = [
  { name: 'Pharmacies', icon: Pill, detail: 'Well-lit counters, late-evening access & phone charging' },
  { name: 'Hospitals & Clinics', icon: Hospital, detail: '24/7 staffed reception & trained security personnel' },
  { name: 'Petrol Stations', icon: Fuel, detail: 'CCTV-covered forecourts & manager safe-waiting bays' },
  { name: 'Neighbourhood Shops', icon: Store, detail: 'Daytime & evening verified local establishments' },
  { name: 'Hotels', icon: Hotel, detail: '24-hour staffed lobbies & verified cab pickup support' },
  { name: 'College Facilities', icon: GraduationCap, detail: 'Campus gatehouses & student security desks' },
];

const loopSteps = [
  {
    state: 'PENDING',
    label: '1. Discreet Request Sent',
    tone: 'warning' as const,
    summary:
      'You select an approved nearby partner and send a quiet assistance request with an optional note.',
  },
  {
    state: 'ACCEPTED',
    label: '2. Partner Confirms Ready',
    tone: 'mint' as const,
    summary:
      'The establishment reviews and accepts your request. You immediately receive confirmation, directions, and front-desk details.',
  },
  {
    state: 'ARRIVED',
    label: '3. Safe Arrival Confirmed',
    tone: 'blue' as const,
    summary:
      'Once you step inside the verified SafeStop, you tap Confirm Arrival so the loop stays verified on both ends.',
  },
  {
    state: 'CLOSED',
    label: '4. Support Completed',
    tone: 'violet' as const,
    summary:
      'When you are ready to continue safely, the partner marks the request closed and you may leave optional feedback.',
  },
];

export function LandingPage() {
  const [activeStepIndex, setActiveStepIndex] = useState(1);
  const [posterModalOpen, setPosterModalOpen] = useState(false);

  const activeStep = loopSteps[activeStepIndex];

  return (
    <div className="min-h-screen bg-warm-white text-charcoal">
      <Navbar />

      <main id="main-content" className="mx-auto max-w-7xl space-y-24 px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
        {/* 1. HERO SECTION */}
        <section className="relative overflow-hidden rounded-[32px] border border-border-soft bg-warm-white px-6 pb-40 pt-12 shadow-matte sm:px-12 sm:pb-48 sm:pt-16 lg:px-16 lg:pb-52">
          {/* Ambient soft mint & subtle pink/violet glow */}
          <div
            className="ambient-mint-glow pointer-events-none absolute -right-20 -top-24 h-[28rem] w-[28rem] rounded-full blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -left-24 top-32 h-72 w-72 rounded-full bg-[var(--color-pink-soft)]/70 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Badge tone="mint">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  SafeStop 360 · Verified Local Assistance Network
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.08 }}
                className="font-display text-4xl font-extrabold leading-[1.1] text-charcoal sm:text-5xl lg:text-[3.5rem]"
              >
                Your Safety. Your Choice.{' '}
                <span className="text-mint-deep">Your Support Network.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.16 }}
                className="max-w-xl text-base leading-relaxed text-charcoal-muted sm:text-lg"
              >
                Find verified nearby assistance, request help discreetly and stay connected
                with people you trust.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.24 }}
                className="flex flex-wrap items-center gap-3.5 pt-1"
              >
                <Link to="/find-help">
                  <Button size="lg" variant="primary" type="button">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    Find Nearby Help
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button size="lg" variant="secondary" type="button">
                    Explore SafeStop
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.34 }}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs font-medium text-charcoal-muted"
              >
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-mint-deep" aria-hidden="true" />
                  Admin-verified establishments
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <EyeOff className="h-4 w-4 text-mint-deep" aria-hidden="true" />
                  Opt-in private location only
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <PhoneCall className="h-4 w-4 text-[#9b2c63]" aria-hidden="true" />
                  Complements 112 &amp; 181
                </span>
              </motion.div>
            </div>

            {/* Floating Liquid Glass & Selective 3D Glassmorphism Cards */}
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative space-y-4"
            >
              <Card surface="glass-3d" className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="mint">
                    <Radio className="h-3 w-3" aria-hidden="true" />
                    Assistance Confirmation Loop
                  </Badge>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted">
                    Closed-Loop
                  </span>
                </div>
                <p className="mt-3.5 font-display text-lg font-bold text-charcoal">
                  Know someone is ready before you arrive
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-charcoal-muted">
                  Unlike silent panic buttons, SafeStop confirms a real, verified
                  establishment has accepted your request and is waiting at the front desk.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white/75 px-2 py-2">
                    <p className="text-[11px] font-bold text-mint-deep">1. Request</p>
                    <p className="text-[10px] text-charcoal-muted">Discreet tap</p>
                  </div>
                  <div className="rounded-xl bg-white/75 px-2 py-2">
                    <p className="text-[11px] font-bold text-[#51379c]">2. Confirm</p>
                    <p className="text-[10px] text-charcoal-muted">Partner accepts</p>
                  </div>
                  <div className="rounded-xl bg-white/75 px-2 py-2">
                    <p className="text-[11px] font-bold text-[#9b2c63]">3. Arrive</p>
                    <p className="text-[10px] text-charcoal-muted">Safe check-in</p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <Card surface="glass" className="p-4">
                  <Navigation className="h-4 w-4 text-mint-deep" aria-hidden="true" />
                  <p className="mt-2 font-display text-sm font-bold text-charcoal">
                    Journey Watch
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-charcoal-muted">
                    Private check-ins with trusted contacts &amp; 1-tap stop sharing.
                  </p>
                </Card>
                <Card surface="glass" className="p-4">
                  <Lock className="h-4 w-4 text-[#51379c]" aria-hidden="true" />
                  <p className="mt-2 font-display text-sm font-bold text-charcoal">
                    Your Privacy First
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-charcoal-muted">
                    Zero silent tracking. Live user locations are never public.
                  </p>
                </Card>
              </div>
            </motion.div>
          </div>

          {/* Original Uploaded Diverse Women Silhouettes Artwork — layered cleanly */}
          <motion.img
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 0.9, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            src="/assets/hero-women-silhouettes.jpg"
            alt="Diverse women profile silhouettes representing community strength and empowerment"
            className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto max-h-44 w-full object-contain object-bottom mix-blend-multiply sm:max-h-56 lg:max-h-60"
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-warm-white via-warm-white/60 to-transparent"
            aria-hidden="true"
          />
        </section>

        {/* 2. THE PROBLEM */}
        <motion.section
          id="about"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="grid items-center gap-10 lg:grid-cols-12"
        >
          <div className="space-y-5 lg:col-span-7">
            <Badge tone="pink">Why SafeStop 360 Exists</Badge>
            <h2 className="font-display text-3xl font-extrabold text-charcoal sm:text-4xl">
              Safety shouldn&apos;t wait until a situation becomes an emergency.
            </h2>
            <p className="text-base leading-relaxed text-charcoal-muted">
              Many uneasy moments happen in the everyday space between &ldquo;everything is
              fine&rdquo; and &ldquo;call emergency services&rdquo;—a dimly lit bus stop, a
              delayed late-evening commute, a dying phone battery, or an uncomfortable walk
              alone.
            </p>
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <Card surface="matte" className="p-5">
                <h3 className="font-display text-base font-bold text-charcoal">
                  Uncertain Where to Step In
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-charcoal-muted">
                  Even when open pharmacies, clinics, or hotels are metres away, it is hard
                  to know which establishment is staffed, welcoming, and ready to help.
                </p>
              </Card>
              <Card surface="matte" className="p-5">
                <h3 className="font-display text-base font-bold text-charcoal">
                  Disconnected Check-Ins
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-charcoal-muted">
                  Texting family repeatedly while navigating transit is stressful. SafeStop
                  brings structured check-ins and verified local safe harbors together.
                </p>
              </Card>
            </div>
          </div>

          <div className="lg:col-span-5">
            <Card surface="matte" className="overflow-hidden p-3">
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src="/assets/awareness-vulnerability.jpg"
                  alt="Editorial illustration depicting feelings of vulnerability and the need for calm, supportive spaces"
                  className="h-72 w-full object-cover object-center sm:h-80"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal/85 via-charcoal/40 to-transparent p-5 text-white">
                  <p className="font-display text-sm font-bold">
                    From isolation to verified local support
                  </p>
                  <p className="mt-1 text-xs text-white/85">
                    SafeStop 360 bridges everyday public spaces with calm, accountable
                    community assistance.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </motion.section>

        {/* 3. HOW SAFESTOP WORKS */}
        <motion.section
          id="how-it-works"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="space-y-8"
        >
          <div className="max-w-2xl space-y-3">
            <Badge tone="mint">How It Works</Badge>
            <h2 className="font-display text-3xl font-extrabold text-charcoal sm:text-4xl">
              Four calm, structured steps to verified safety
            </h2>
            <p className="text-base text-charcoal-muted">
              Designed for one-handed mobile clarity when you are travelling—no cluttered
              screens, no confusing menus.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: '01',
                title: 'Locate Nearby SafeStops',
                body: 'Use opt-in GPS or enter your neighbourhood to see admin-verified establishments and live availability.',
                icon: MapPin,
              },
              {
                step: '02',
                title: 'Send a Discreet Request',
                body: 'Choose an available partner and send a quiet assistance request with an optional note—no loud sirens.',
                icon: ShieldCheck,
              },
              {
                step: '03',
                title: 'Partner Confirms Ready',
                body: 'The partner accepts on their live operational console so you know staff are expecting you with directions.',
                icon: CheckCircle2,
              },
              {
                step: '04',
                title: 'Reach & Close the Loop',
                body: 'Confirm your safe arrival, rest or wait for verified transport, and close the request when ready.',
                icon: HeartHandshake,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.step} surface="matte" interactive className="flex flex-col p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint-soft text-mint-deep">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="font-display text-xs font-extrabold tracking-widest text-charcoal-muted">
                      STEP {item.step}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-lg font-bold text-charcoal">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal-muted">
                    {item.body}
                  </p>
                </Card>
              );
            })}
          </div>
        </motion.section>

        {/* 4. FIND VERIFIED ASSISTANCE */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="space-y-8"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-2xl space-y-3">
              <Badge tone="blue">Find Verified Assistance</Badge>
              <h2 className="font-display text-3xl font-extrabold text-charcoal sm:text-4xl">
                Everyday places, verified for safety
              </h2>
              <p className="text-base text-charcoal-muted">
                Filter nearby establishments by category, see live availability status, and
                get direct walking or transit directions.
              </p>
            </div>
            <Link to="/find-help">
              <Button variant="primary" size="md" type="button">
                Open SafePlaces Map
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {partnerCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <Card key={cat.name} surface="matte" interactive className="flex items-start gap-4 p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warm-white border border-border-soft text-mint-deep">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-charcoal">
                      {cat.name}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-charcoal-muted">
                      {cat.detail}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </motion.section>

        {/* 5. ASSISTANCE CONFIRMATION LOOP */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="relative overflow-hidden rounded-[28px] border border-border-soft bg-pure-white p-6 shadow-matte sm:p-10"
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[var(--color-violet-soft)] blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10 grid items-center gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-5">
              <Badge tone="violet">Core Workflow</Badge>
              <h2 className="font-display text-3xl font-extrabold text-charcoal">
                The Assistance Confirmation Loop
              </h2>
              <p className="text-sm leading-relaxed text-charcoal-muted">
                Every request follows validated state transitions on our backend—so you
                never see a fake confirmation and always know the exact live response from
                the establishment.
              </p>
              <div className="flex flex-wrap gap-2 pt-2" role="tablist" aria-label="Assistance loop stages">
                {loopSteps.map((step, idx) => (
                  <button
                    key={step.state}
                    type="button"
                    role="tab"
                    aria-selected={idx === activeStepIndex}
                    onClick={() => setActiveStepIndex(idx)}
                    className={`neu-chip px-3.5 py-1.5 text-xs font-semibold ${
                      idx === activeStepIndex ? 'neu-chip-active' : ''
                    }`}
                  >
                    {step.state}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7">
              <Card surface="glass-3d" className="p-6 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={activeStep.tone}>Status: {activeStep.state}</Badge>
                  <span className="text-xs font-medium text-charcoal-muted">
                    Stage {activeStepIndex + 1} of {loopSteps.length}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-xl font-bold text-charcoal">
                  {activeStep.label}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal-muted">
                  {activeStep.summary}
                </p>
                <div className="mt-6 flex items-center gap-2">
                  {loopSteps.map((s, idx) => (
                    <div
                      key={s.state}
                      className={`h-2 flex-1 rounded-full transition-colors ${
                        idx <= activeStepIndex ? 'bg-mint-dark' : 'bg-border-soft'
                      }`}
                    />
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </motion.section>

        {/* 6. JOURNEY WATCH */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="grid items-center gap-8 lg:grid-cols-12"
        >
          <div className="space-y-4 lg:col-span-6">
            <Badge tone="mint">Journey Watch</Badge>
            <h2 className="font-display text-3xl font-extrabold text-charcoal sm:text-4xl">
              Stay connected with people you trust—strictly on your terms
            </h2>
            <p className="text-base leading-relaxed text-charcoal-muted">
              Set your destination, expected arrival time, and chosen trusted contacts.
              Check in with one tap, receive gentle missed check-in reminders, and revoke
              location sharing instantly at any moment.
            </p>
            <ul className="space-y-2.5 pt-2 text-sm text-charcoal">
              {[
                '100% opt-in location sharing with a visible Stop Sharing button',
                'Private journey data—never visible on public community maps',
                'Custom notification preferences per trusted contact',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-deep" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-6">
            <Card surface="matte" className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mint-soft text-mint-deep">
                    <Navigation className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-display text-sm font-bold text-charcoal">
                      Journey Watch Privacy Model
                    </p>
                    <p className="text-xs text-charcoal-muted">
                      Example workflow preview
                    </p>
                  </div>
                </div>
                <Badge tone="mint">Opt-In Only</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border-soft bg-warm-white p-4">
                  <Clock className="h-4 w-4 text-mint-deep" aria-hidden="true" />
                  <p className="mt-2 text-xs font-bold text-charcoal">Scheduled Check-Ins</p>
                  <p className="mt-1 text-xs text-charcoal-muted">
                    Choose 5–180 minute check-in intervals and mark safe arrival in one tap.
                  </p>
                </div>
                <div className="rounded-2xl border border-border-soft bg-warm-white p-4">
                  <EyeOff className="h-4 w-4 text-[#9b2c63]" aria-hidden="true" />
                  <p className="mt-2 text-xs font-bold text-charcoal">Instant Revocation</p>
                  <p className="mt-1 text-xs text-charcoal-muted">
                    Pause or stop sharing immediately—you stay in full control of your data.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </motion.section>

        {/* 7. COMMUNITY SAFETY INTELLIGENCE */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="grid items-center gap-8 lg:grid-cols-12"
        >
          <div className="order-2 lg:order-1 lg:col-span-5">
            {/* Dark charcoal matte card harmonizes cleanly with the megaphone artwork */}
            <div className="relative overflow-hidden rounded-[26px] border border-charcoal/15 bg-[#1e2024] p-6 text-white shadow-matte">
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[var(--color-pink)]/25 blur-2xl"
                aria-hidden="true"
              />
              <img
                src="/assets/community-megaphone.jpg"
                alt="Pink and white megaphone illustration symbolizing community safety voice"
                className="mx-auto max-h-56 w-full rounded-2xl object-contain"
              />
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/80">
                <span>Anonymous community reporting</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-mint">
                  Explainable Rules
                </span>
              </div>
            </div>
          </div>

          <div className="order-1 space-y-4 lg:order-2 lg:col-span-7">
            <Badge tone="violet">
              <Brain className="h-3.5 w-3.5" aria-hidden="true" />
              Community Safety Intelligence
            </Badge>
            <h2 className="font-display text-3xl font-extrabold text-charcoal sm:text-4xl">
              Speak up safely. Spot patterns transparently.
            </h2>
            <p className="text-base leading-relaxed text-charcoal-muted">
              Report poor lighting, isolated stretches, harassment, or unsafe public
              infrastructure without exposing your personal identity publicly. Unreviewed
              reports are always clearly labelled until reviewed by administrators.
            </p>
            <Card surface="matte-subtle" className="p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-charcoal">
                Responsible AI Boundary
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-charcoal-muted">
                Our Python rule-based intelligence module clusters nearby reports, highlights
                repeated concerns, and summarizes time-of-day trends for administrators. It{' '}
                <strong>never</strong> guarantees an area is safe or dangerous and{' '}
                <strong>never</strong> makes automated emergency decisions.
              </p>
            </Card>
          </div>
        </motion.section>

        {/* 8. TRUSTED PARTNERS */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="surface-matte p-7 sm:p-10"
        >
          <div className="grid items-center gap-8 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-8">
              <Badge tone="mint">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                Trusted Partner Network
              </Badge>
              <h2 className="font-display text-2xl font-extrabold text-charcoal sm:text-3xl">
                Every SafeStop partner requires administrative verification
              </h2>
              <p className="text-sm leading-relaxed text-charcoal-muted sm:text-base">
                Establishments cannot appear on the public map merely by signing up. Each
                applicant goes through administrator approval and controls a live
                availability toggle (<code className="rounded bg-warm-surface px-1.5 py-0.5 text-xs">AVAILABLE</code>,{' '}
                <code className="rounded bg-warm-surface px-1.5 py-0.5 text-xs">BUSY</code>, or{' '}
                <code className="rounded bg-warm-surface px-1.5 py-0.5 text-xs">OFFLINE</code>) so women
                only see responsive safe harbors.
              </p>
              <p className="text-xs text-charcoal-muted">
                Note: Local development and demonstration environments use clearly labelled{' '}
                <strong>[DEMO]</strong> Bengaluru establishments.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
              <Link to="/register?role=PARTNER" className="w-full sm:w-auto">
                <Button variant="primary" size="lg" className="w-full" type="button">
                  Register as a Partner
                </Button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <Button variant="secondary" size="md" className="w-full" type="button">
                  Partner Dashboard Login
                </Button>
              </Link>
            </div>
          </div>
        </motion.section>

        {/* 9. WOMEN'S SAFETY AWARENESS */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="grid items-center gap-8 lg:grid-cols-12"
        >
          <div className="space-y-4 lg:col-span-6">
            <Badge tone="pink">Women&apos;s Safety Awareness</Badge>
            <h2 className="font-display text-3xl font-extrabold text-charcoal sm:text-4xl">
              Preparedness, awareness, and collective agency
            </h2>
            <p className="text-base leading-relaxed text-charcoal-muted">
              True safety pairs responsive local infrastructure with practical awareness.
              Explore curated transit safety tips, privacy checklists, and official helpline
              references inside our Safety Resources hub.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/resources">
                <Button variant="primary" size="md" type="button">
                  Explore Safety Resources
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={() => setPosterModalOpen(true)}
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                View Awareness Poster
              </Button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <Card surface="matte" className="overflow-hidden p-3">
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src="/assets/community-voice-rally.jpg"
                  alt="Women raising their voices together with a megaphone for community empowerment and safety"
                  className="h-64 w-full object-cover object-top sm:h-72"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-pink)]/20 via-transparent to-mint/15" />
              </div>
            </Card>
          </div>
        </motion.section>

        {/* 10. EMERGENCY SUPPORT INFORMATION (Zero-delay interactive links) */}
        <section
          aria-labelledby="emergency-support-heading"
          className="surface-matte border-[var(--color-error)]/45 p-6 sm:p-9"
        >
          <div className="grid items-center gap-6 lg:grid-cols-12">
            <div className="space-y-2.5 lg:col-span-7">
              <Badge tone="error">Official Emergency Support · India</Badge>
              <h2
                id="emergency-support-heading"
                className="font-display text-2xl font-extrabold text-charcoal sm:text-3xl"
              >
                In immediate danger, contact official emergency services first
              </h2>
              <p className="text-sm leading-relaxed text-charcoal-muted">
                SafeStop 360 is an independent community assistance platform and does{' '}
                <strong>not</strong> replace police, medical, or government emergency
                dispatch. Keep these official national numbers one tap away:
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-5">
              <a
                href="tel:112"
                className="flex flex-col justify-between rounded-2xl border border-[var(--color-error)] bg-[var(--color-error-soft)] p-5 transition-colors hover:bg-[var(--color-error)]/25"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-error-deep)]">
                  <PhoneCall className="h-4 w-4" aria-hidden="true" />
                  National Emergency
                </span>
                <span className="mt-2 font-display text-4xl font-extrabold text-[var(--color-error-deep)] tabular-nums">
                  112
                </span>
                <span className="mt-1 text-xs text-[var(--color-error-deep)]/85">
                  Police · Fire · Ambulance (24/7)
                </span>
              </a>
              <a
                href="tel:181"
                className="flex flex-col justify-between rounded-2xl border border-[var(--color-pink)]/60 bg-[var(--color-pink-soft)] p-5 transition-colors hover:bg-[var(--color-pink)]/20"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9b2c63]">
                  <PhoneCall className="h-4 w-4" aria-hidden="true" />
                  Women Helpline
                </span>
                <span className="mt-2 font-display text-4xl font-extrabold text-[#9b2c63] tabular-nums">
                  181
                </span>
                <span className="mt-1 text-xs text-[#9b2c63]/85">
                  24/7 Support &amp; Crisis Response
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* 11. FINAL CTA */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="relative overflow-hidden rounded-[30px] border border-border-soft bg-gradient-to-br from-mint-soft/75 via-pure-white to-[var(--color-violet-soft)]/55 p-8 text-center shadow-matte sm:p-14"
        >
          <div className="mx-auto max-w-2xl space-y-5">
            <h2 className="font-display text-3xl font-extrabold text-charcoal sm:text-4xl">
              Travel with calm confidence. Know where help is waiting.
            </h2>
            <p className="text-base text-charcoal-muted">
              Create your SafeStop 360 account to set up trusted contacts, start Journey
              Watch, and request verified assistance whenever you need it.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
              <Link to="/register">
                <Button size="lg" variant="primary" type="button">
                  Get Started with SafeStop 360
                </Button>
              </Link>
              <Link to="/find-help">
                <Button size="lg" variant="secondary" type="button">
                  Browse Nearby SafePlaces
                </Button>
              </Link>
            </div>
          </div>
        </motion.section>
      </main>

      <Footer />

      {/* Safety Awareness Poster Modal (never used as full-screen background) */}
      <Modal
        open={posterModalOpen}
        onClose={() => setPosterModalOpen(false)}
        title="Women's Personal Safety Reference Guide"
        subtitle="Educational awareness poster — always call 112 (Emergency) or 181 (Women Helpline) in immediate danger."
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border-soft bg-pure-white p-2">
            <img
              src="/assets/safety-awareness-poster.jpg"
              alt="Women's safety awareness infographic covering personal safety tips and emergency numbers"
              className="mx-auto max-h-[65vh] w-auto rounded-xl object-contain"
            />
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" type="button" onClick={() => setPosterModalOpen(false)}>
              Close Reference
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
