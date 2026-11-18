import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Expand,
  HeartHandshake,
  MapPin,
  Navigation,
  PhoneCall,
  Radio,
  Route as RouteIcon,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Badge, Button, Card, GlassCard, Modal, Skeleton } from '@/components/ui';
import { EASE_SMOOTH, fadeUp, floatY, scaleIn, stagger } from '@/lib/motion';
import { fetchNearbyPartners } from '@/services/api';
import type { PartnerItem } from '@/types';

const HERO_WORDS = ['Find', 'Help.', 'Reach', 'Safety.', 'Stay', 'Connected.'];

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Detect or Pin Location',
    body: 'Tap once to use GPS with live accuracy feedback, or search any street in India or drop a pin manually.',
    icon: MapPin,
  },
  {
    step: '02',
    title: 'Choose a Verified SafePlace',
    body: 'Filter admin-approved pharmacies, hospitals, petrol stations, hotels, shops, and campus gates — separate from unverified OSM listings.',
    icon: ShieldCheck,
  },
  {
    step: '03',
    title: 'Partner Confirms Readiness',
    body: 'Send a discreet help request with optional live location consent. The partner accepts or declines in real time.',
    icon: CheckCircle2,
  },
  {
    step: '04',
    title: 'Navigate & Confirm Arrival',
    body: 'Follow walking or driving directions on the map, confirm safe arrival, and all temporary location pings are deleted automatically.',
    icon: Navigation,
  },
];

const SEVEN_CHALLENGES = [
  'Poor street lighting & unlit last-mile stretches',
  'Harassment at public transit hubs & bus stops',
  'Isolated footpaths after evening shop closures',
  'Delayed access to trustworthy nearby shelter',
  'Lack of verifiable real-time check-in trails',
  'Under-reporting due to stigma or fear of exposure',
  'Fragmented awareness of emergency helplines (112 / 181)',
];

function HalftoneMegaphoneGraphic({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { amount: 0.3 });

  return (
    <div ref={ref} className="relative flex h-64 w-full items-center justify-center">
      {/* Three pulsing pink sound-wave arcs (paused off-screen with useInView) */}
      {[0, 1, 2].map((idx) => (
        <motion.span
          key={idx}
          aria-hidden="true"
          className="pointer-events-none absolute right-[14%] h-24 w-24 rounded-full border-2 border-[var(--color-pink)]/50"
          initial={{ scale: 0.65, opacity: 0 }}
          animate={
            inView && !reduced
              ? { scale: [0.7, 1.55 + idx * 0.35], opacity: [0.65, 0] }
              : { scale: 1, opacity: 0.2 }
          }
          transition={
            inView && !reduced
              ? { duration: 2.4, delay: idx * 0.55, repeat: Infinity, ease: 'easeOut' }
              : { duration: 0.2 }
          }
        />
      ))}

      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.82, rotate: -6 }}
        whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="relative z-10 flex h-44 w-56 items-center justify-center rounded-glass bg-charcoal/95 p-5 shadow-elev-3"
      >
        {/* Clean pink halftone megaphone inline SVG (no checkerboard artifacts) */}
        <svg
          viewBox="0 0 220 150"
          className="h-full w-full"
          role="img"
          aria-label="Pink halftone megaphone symbolising community voices speaking up"
        >
          <defs>
            <pattern id="halftonePink" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="1.4" fill="#F9B4D5" fillOpacity="0.45" />
            </pattern>
            <linearGradient id="megaBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#E96BA8" />
              <stop offset="100%" stopColor="#C44684" />
            </linearGradient>
          </defs>
          {/* Handle */}
          <path
            d="M52 84 L68 134 C70 140 78 140 82 136 L90 128 L75 84 Z"
            fill="url(#megaBody)"
            stroke="#22252A"
            strokeWidth="3"
          />
          {/* Rear cap */}
          <rect
            x="24"
            y="50"
            width="46"
            height="42"
            rx="12"
            fill="url(#megaBody)"
            stroke="#111316"
            strokeWidth="3"
          />
          <rect x="24" y="50" width="46" height="42" rx="12" fill="url(#halftonePink)" />
          {/* Cone */}
          <path
            d="M70 50 L156 18 L156 124 L70 92 Z"
            fill="#F7F7F3"
            stroke="#111316"
            strokeWidth="3"
          />
          <path d="M70 50 L156 18 L156 124 L70 92 Z" fill="url(#halftonePink)" />
          {/* Rim */}
          <ellipse
            cx="158"
            cy="71"
            rx="16"
            ry="53"
            fill="#22252A"
            stroke="#F7F7F3"
            strokeWidth="2.5"
          />
          <ellipse cx="158" cy="71" rx="7" ry="18" fill="#A7E8D2" />
          {/* Sound burst lines */}
          <path
            d="M182 40 L204 28 M186 71 L212 71 M182 102 L204 114"
            stroke="#E96BA8"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>
    </div>
  );
}

export function LandingPage() {
  const reduced = Boolean(useReducedMotion());
  const heroRef = useRef<HTMLElement | null>(null);
  const problemRef = useRef<HTMLElement | null>(null);
  const stepsRef = useRef<HTMLElement | null>(null);

  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const silhouetteParallax = useTransform(heroScroll, [0, 1], [0, reduced ? 0 : 40]);

  const { scrollYProgress: problemScroll } = useScroll({
    target: problemRef,
    offset: ['start end', 'end start'],
  });
  const nightZoom = useTransform(problemScroll, [0, 1], [1, reduced ? 1 : 1.08]);

  const { scrollYProgress: stepsScroll } = useScroll({
    target: stepsRef,
    offset: ['start 80%', 'end 55%'],
  });
  const lineProgress = useTransform(stepsScroll, [0, 1], [0, 1]);

  const [demoPartners, setDemoPartners] = useState<PartnerItem[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [lightbox, setLightbox] = useState<'poster' | 'issues' | null>(null);

  useEffect(() => {
    let active = true;
    fetchNearbyPartners({ lat: 12.2958, lng: 76.6394, radius_km: 10 })
      .then((res) => {
        if (active) setDemoPartners(res.results.slice(0, 6));
      })
      .catch(() => {
        if (active) setDemoPartners([]);
      })
      .finally(() => {
        if (active) setLoadingPartners(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-warm-white text-charcoal">
      <Navbar />

      {/* 1. HERO SECTION */}
      <section
        ref={heroRef}
        className="relative flex min-h-[86vh] flex-col justify-between overflow-hidden pt-28 sm:pt-32"
      >
        {/* Mint-to-transparent ambient header gradient + two blurred floating blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[72%] bg-gradient-to-b from-mint/45 via-mint-soft/35 to-transparent"
        />
        <motion.div
          aria-hidden="true"
          animate={floatY(reduced, 14, 7.5, 0)}
          className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-mint/45 blur-3xl"
        />
        <motion.div
          aria-hidden="true"
          animate={floatY(reduced, 16, 8.5, 1.2)}
          className="pointer-events-none absolute -right-24 top-32 h-80 w-80 rounded-full bg-[var(--color-pink)]/22 blur-3xl"
        />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6">
          {/* Emergency notice pill */}
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_SMOOTH }}
            className="mb-6 flex flex-wrap items-center justify-center gap-2 text-center"
          >
            <Badge tone="mint">GPS-First Women&apos;s Safety Assistance</Badge>
            <span className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-white/85 px-3 py-1 text-xs font-medium text-charcoal-muted">
              Emergency (India):{' '}
              <a href="tel:112" className="font-bold text-charcoal hover:underline">
                112
              </a>
              <span aria-hidden="true">·</span>
              Women Helpline:{' '}
              <a href="tel:181" className="font-bold text-charcoal hover:underline">
                181
              </a>
            </span>
          </motion.div>

          {/* Word-by-word headline reveal */}
          <h1 className="mx-auto max-w-4xl text-center font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-charcoal sm:text-5xl lg:text-[3.5rem] lg:leading-[4rem]">
            {HERO_WORDS.map((word, idx) => (
              <motion.span
                key={`${word}-${idx}`}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduced ? 0.15 : 0.45,
                  delay: reduced ? 0 : idx * 0.08,
                  ease: EASE_SMOOTH,
                }}
                className={`mr-2.5 inline-block ${
                  idx >= 2 && idx <= 3 ? 'text-mint-deep' : ''
                }`}
              >
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reduced ? 0 : 0.42, ease: EASE_SMOOTH }}
            className="mx-auto mt-5 max-w-2xl text-center text-base leading-relaxed text-charcoal-muted sm:text-lg"
          >
            Detect your location on any phone or desktop, locate admin-verified nearby safe places,
            send a discreet help request with opt-in live tracking, and navigate straight to safety.
          </motion.p>

          {/* Primary CTAs */}
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: reduced ? 0 : 0.54, ease: EASE_SMOOTH }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link to="/find-help">
              <Button size="lg">
                <MapPin className="h-4 w-4" />
                Find Help Nearby
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="secondary" size="lg">
                Create Free Account
              </Button>
            </Link>
            <a href="tel:112">
              <Button variant="ghost" size="lg" aria-label="Call India Emergency 112">
                <PhoneCall className="h-4 w-4 text-mint-deep" />
                Call 112
              </Button>
            </a>
          </motion.div>

          {/* Three floating glass cards (NO fabricated statistics) */}
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <motion.div animate={floatY(reduced, 7, 5.2, 0)}>
              <GlassCard className="h-full p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-control bg-mint-soft text-mint-deep">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <h2 className="font-display text-sm font-bold text-charcoal">
                    Verified SafePlaces
                  </h2>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-charcoal-muted">
                  Admin-reviewed pharmacies, hospitals, fuel stations, hotels, and campus gates —
                  visually separated from unverified OSM results.
                </p>
              </GlassCard>
            </motion.div>

            <motion.div animate={floatY(reduced, 9, 6.0, 0.7)}>
              <GlassCard className="h-full p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-control bg-[var(--color-blue-soft)] text-[#1c598a]">
                    <Navigation className="h-4 w-4" />
                  </span>
                  <h2 className="font-display text-sm font-bold text-charcoal">
                    Live GPS &amp; Directions
                  </h2>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-charcoal-muted">
                  Opt-in geolocation with accuracy readouts, manual search fallback, walking/driving
                  routes, and Google Maps / OSM deep links.
                </p>
              </GlassCard>
            </motion.div>

            <motion.div animate={floatY(reduced, 8, 5.6, 1.3)}>
              <GlassCard className="h-full p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-control bg-[var(--color-violet-soft)] text-[#51379c]">
                    <Radio className="h-4 w-4" />
                  </span>
                  <h2 className="font-display text-sm font-bold text-charcoal">
                    Private Journey Watch
                  </h2>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-charcoal-muted">
                  Expiring read-only links for trusted contacts only. All location pings are purged
                  automatically when you arrive or tap Stop.
                </p>
              </GlassCard>
            </motion.div>
          </div>
        </div>

        {/* Hero silhouettes banner anchored to bottom with mix-blend-mode: multiply & scroll parallax */}
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 60, scale: 1.05 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduced ? 0.25 : 0.85, delay: reduced ? 0 : 0.25, ease: EASE_SMOOTH }}
          style={{ y: silhouetteParallax }}
          className="relative z-0 mx-auto mt-8 w-full max-w-5xl px-4"
        >
          <picture>
            <source srcSet="/assets/silhouettes.webp" type="image/webp" />
            <img
              src="/assets/silhouettes.jpg"
              alt="Overlapping women silhouettes standing together in solidarity"
              width={734}
              height={325}
              className="mx-auto block h-auto w-full max-w-4xl select-none object-contain mix-blend-multiply"
            />
          </picture>
        </motion.div>
      </section>

      {/* 2. THE PROBLEM SECTION (night-street.jpg with scroll-linked zoom + glass overlay) */}
      <section ref={problemRef} id="problem" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="relative overflow-hidden rounded-glass shadow-elev-3 lg:col-span-7">
            <motion.div style={{ scale: nightZoom }} className="will-change-transform">
              <picture>
                <source srcSet="/assets/night-street.webp" type="image/webp" />
                <img
                  src="/assets/night-street.jpg"
                  alt="Woman walking cautiously past a dimly lit bus stop at night"
                  width={736}
                  height={401}
                  loading="lazy"
                  className="h-[340px] w-full object-cover sm:h-[420px]"
                />
              </picture>
            </motion.div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/20 to-transparent"
            />
            <div className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6">
              <GlassCard className="p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-mint-deep">
                  The Everyday Gap
                </p>
                <p className="mt-1 font-display text-base font-bold text-charcoal sm:text-lg">
                  Between feeling uneasy on an unfamiliar street and calling emergency services,
                  most women just need a verified, well-lit doorway nearby.
                </p>
              </GlassCard>
            </div>
          </div>

          <motion.div
            variants={stagger(0.1)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            className="space-y-4 lg:col-span-5"
          >
            <motion.div variants={fadeUp(reduced)}>
              <Badge tone="warning">Why SafeStop 360 Exists</Badge>
              <h2 className="mt-3 font-display text-h2 text-charcoal">
                Turning hesitation into immediate, structured action
              </h2>
            </motion.div>

            {[
              {
                title: 'Uncertain which open shop is actually safe',
                body: 'Generic maps list storefronts without verifying staff readiness or confirming someone is expecting you.',
              },
              {
                title: 'No confirmation loop before you walk there',
                body: 'With SafeStop 360, you know a verified counter has explicitly accepted your request before you change routes.',
              },
              {
                title: 'Privacy risks of permanent location sharing',
                body: 'Live tracking is strictly opt-in per session and every coordinate ping is erased once you arrive.',
              },
            ].map((item) => (
              <motion.div key={item.title} variants={fadeUp(reduced)}>
                <Card className="p-4">
                  <h3 className="font-display text-sm font-bold text-charcoal">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-charcoal-muted">{item.body}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 3. HOW IT WORKS (Scroll-drawn SVG connecting line) */}
      <section ref={stepsRef} id="how-it-works" className="bg-white/70 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge tone="mint">How It Works</Badge>
            <h2 className="mt-3 font-display text-h2 text-charcoal">
              Four calm steps from alert to confirmed safety
            </h2>
          </div>

          <div className="relative mt-12">
            {/* Horizontal connecting SVG line on desktop (draws on scroll via pathLength) */}
            <svg
              aria-hidden="true"
              viewBox="0 0 1000 16"
              className="pointer-events-none absolute left-0 top-10 hidden h-4 w-full lg:block"
              preserveAspectRatio="none"
            >
              <line
                x1="70"
                y1="8"
                x2="930"
                y2="8"
                stroke="#E9E7E2"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <motion.line
                x1="70"
                y1="8"
                x2="930"
                y2="8"
                stroke="#68BFA3"
                strokeWidth="3"
                strokeLinecap="round"
                pathLength={reduced ? 1 : undefined}
                style={reduced ? undefined : { pathLength: lineProgress }}
              />
            </svg>

            <motion.div
              variants={stagger(0.1)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
            >
              {HOW_IT_WORKS_STEPS.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.div key={item.step} variants={fadeUp(reduced)}>
                    <Card interactive className="relative z-10 h-full p-5">
                      <div className="flex items-center justify-between">
                        <span className="flex h-11 w-11 items-center justify-center rounded-control bg-mint-soft text-mint-deep">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="font-display text-xs font-extrabold text-charcoal-muted tabular-nums">
                          {item.step}
                        </span>
                      </div>
                      <h3 className="mt-4 font-display text-base font-bold text-charcoal">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-charcoal-muted">
                        {item.body}
                      </p>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </section>

      {/* 4. CORE CAPABILITIES: Assistance Loop, Journey Watch, Community Intelligence */}
      <section className="mx-auto max-w-6xl space-y-8 px-4 py-20 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="flex flex-col justify-between p-6">
            <div>
              <Badge tone="mint">Assistance Confirmation Loop</Badge>
              <h3 className="mt-3 font-display text-h3 text-charcoal">
                Closed-loop status, zero guesswork
              </h3>
              <p className="mt-2 text-sm text-charcoal-muted">
                Every request moves through a verified state machine: <strong>Pending</strong>{' '}
                (10-min auto-expiry) → <strong>Accepted</strong> → <strong>Arrived</strong> →{' '}
                <strong>Closed</strong>. Live location is opt-in and visible to the assigned partner
                only after acceptance.
              </p>
            </div>
            <div className="mt-5">
              <Link to="/find-help">
                <Button size="sm" variant="secondary">
                  Open Live Help Map
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="flex flex-col justify-between p-6">
            <div>
              <Badge tone="blue">Journey Watch</Badge>
              <h3 className="mt-3 font-display text-h3 text-charcoal">
                Private travel check-ins &amp; expiring contact links
              </h3>
              <p className="mt-2 text-sm text-charcoal-muted">
                Pick your destination on the map, select trusted contacts, and share an unguessable
                read-only status link that revokes and deletes pings automatically on arrival.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-2 text-xs text-charcoal-muted">
              <RouteIcon className="h-4 w-4 text-mint-deep" />
              <span>Foreground browser tracking with 100 m arrival prompt</span>
            </div>
          </Card>

          <Card className="flex flex-col justify-between p-6">
            <div>
              <Badge tone="violet">Community Safety Intelligence</Badge>
              <h3 className="mt-3 font-display text-h3 text-charcoal">
                Explainable 300 m area trends, zero fear-mongering
              </h3>
              <p className="mt-2 text-sm text-charcoal-muted">
                Pure-Python rule-based analysis groups observations within ~300 m using rounded
                coordinates and states plainly: <em>&ldquo;N unverified reports in this area in the
                last 30 days.&rdquo;</em> Never labels neighbourhoods &ldquo;safe&rdquo; or
                &ldquo;dangerous.&rdquo;
              </p>
            </div>
            <div className="mt-5 flex items-center gap-2 text-xs text-charcoal-muted">
              <Compass className="h-4 w-4 text-mint-deep" />
              <span>Transparent keyword &amp; time-of-day rationale</span>
            </div>
          </Card>
        </div>
      </section>

      {/* 5. TRUSTED PARTNERS (Real backend query, strictly Demo-labelled) */}
      <section className="bg-white/75 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone="mint">Verified SafePlaces</Badge>
                <Badge tone="violet">Demo Network — Mysuru</Badge>
              </div>
              <h2 className="mt-3 font-display text-h2 text-charcoal">
                Sample verified establishments ready to assist
              </h2>
              <p className="mt-1 max-w-xl text-sm text-charcoal-muted">
                All sample listings below are clearly marked <strong>Demo</strong> for this
                prototype. In production, every listing requires administrator review.
              </p>
            </div>
            <Link to="/find-help">
              <Button variant="secondary">
                Explore Full Map
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loadingPartners
              ? [1, 2, 3].map((i) => (
                  <Card key={i} className="space-y-3 p-5">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </Card>
                ))
              : demoPartners.map((partner) => (
                  <Card key={partner.id} interactive className="flex flex-col justify-between p-5">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge tone="mint">Verified</Badge>
                        <div className="flex items-center gap-1.5">
                          {partner.is_demo && <Badge tone="violet">Demo</Badge>}
                          <Badge
                            tone={
                              partner.availability?.status === 'AVAILABLE' ? 'mint' : 'warning'
                            }
                          >
                            {partner.availability?.status_display || 'Available'}
                          </Badge>
                        </div>
                      </div>
                      <h3 className="mt-3 font-display text-base font-bold text-charcoal">
                        {partner.name}
                      </h3>
                      <p className="mt-1 text-xs text-charcoal-muted">{partner.address}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-border-soft pt-3 text-xs text-charcoal-muted">
                      <span>{partner.category_display}</span>
                      <span>{partner.operating_hours}</span>
                    </div>
                  </Card>
                ))}
          </div>
        </div>
      </section>

      {/* 6. SPEAK UP & COMMUNITY AWARENESS (Megaphone + crowd-pink + awareness-collage + poster lightbox) */}
      <section id="awareness" className="mx-auto max-w-6xl space-y-16 px-4 py-20 sm:px-6">
        {/* Speak Up row */}
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <HalftoneMegaphoneGraphic reduced={reduced} />
          </div>
          <div className="space-y-4 lg:col-span-7">
            <Badge tone="pink">Speak Up Safely</Badge>
            <h2 className="font-display text-h2 text-charcoal">
              Anonymous local observations help communities light up blind spots
            </h2>
            <p className="text-sm leading-relaxed text-charcoal-muted">
              Reporter identities are never published. Public community maps display rounded
              coordinates and grouped area observations so women can share broken streetlights,
              isolated transit stretches, or harassment patterns without fear of exposure.
            </p>
            <div className="flex flex-wrap items-center gap-5 pt-2">
              {/* Small duotone card for crowd-pink.jpg (max ~300px, tilts on hover) */}
              <motion.div
                whileHover={reduced ? undefined : { rotate: -1.5, scale: 1.03 }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-[260px] overflow-hidden rounded-card border border-[var(--color-pink)]/35 bg-[var(--color-pink-soft)] p-2 shadow-elev-2"
              >
                <picture>
                  <source srcSet="/assets/crowd-pink.webp" type="image/webp" />
                  <img
                    src="/assets/crowd-pink.jpg"
                    alt="Community voices rallying together in pink duotone"
                    width={236}
                    height={148}
                    loading="lazy"
                    className="h-32 w-full rounded-control object-cover"
                  />
                </picture>
                <p className="mt-2 px-1 text-[11px] font-semibold text-[#9b2c63]">
                  Collective awareness without exposing individuals
                </p>
              </motion.div>

              <div className="space-y-2">
                <Link to="/register">
                  <Button variant="primary">Report an Area Observation</Button>
                </Link>
                <p className="text-xs text-charcoal-muted">
                  All reports clearly carry UNREVIEWED / REVIEWED status badges.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Why this matters (awareness-collage.jpg) */}
        <Card className="overflow-hidden p-6 sm:p-8">
          <div className="grid items-center gap-8 md:grid-cols-12">
            <div className="md:col-span-5">
              <div className="overflow-hidden rounded-card border border-border-soft bg-warm-surface">
                <picture>
                  <source srcSet="/assets/awareness-collage.webp" type="image/webp" />
                  <img
                    src="/assets/awareness-collage.jpg"
                    alt="Editorial collage illustrating the emotional weight of stigma and public scrutiny"
                    width={470}
                    height={626}
                    loading="lazy"
                    className="mx-auto max-h-80 w-full object-cover"
                  />
                </picture>
              </div>
              <p className="mt-2 text-center text-xs text-charcoal-muted">
                Calm, dignified assistance replaces stigma and isolation with practical support.
              </p>
            </div>
            <div className="space-y-4 md:col-span-7">
              <Badge tone="neutral">Why This Matters</Badge>
              <h3 className="font-display text-h2 text-charcoal">
                Dignity-first design — calm mint clarity, never panic aesthetics
              </h3>
              <p className="text-sm leading-relaxed text-charcoal-muted">
                Safety tools shouldn&apos;t feel alarmist or draw unwanted attention on a crowded
                street. SafeStop 360 is intentionally designed with calm warm-white and mint
                surfaces so you can check nearby safe places, request support discreetly, and share
                an expiring journey link with people you trust.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-control border border-border-soft bg-warm-white p-3.5">
                  <HeartHandshake className="h-4 w-4 text-mint-deep" />
                  <p className="mt-1.5 text-xs font-bold text-charcoal">Opt-in consent always</p>
                  <p className="mt-0.5 text-xs text-charcoal-muted">
                    GPS starts only when you click, and stops the instant you tap Stop Sharing.
                  </p>
                </div>
                <div className="rounded-control border border-border-soft bg-warm-white p-3.5">
                  <Users className="h-4 w-4 text-mint-deep" />
                  <p className="mt-1.5 text-xs font-bold text-charcoal">Companion foundation</p>
                  <p className="mt-0.5 text-xs text-charcoal-muted">
                    Walk-along companions appear only after explicit administrator verification.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Awareness gallery: safety-poster.jpg (click-to-zoom lightbox) + SVG fallback for safety-issues */}
        <motion.div
          variants={stagger(0.12)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid gap-6 md:grid-cols-2"
        >
          {/* Poster card (small framed click-to-zoom) */}
          <motion.div variants={scaleIn(reduced)}>
            <Card className="flex h-full flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between">
                  <Badge tone="pink">Safety Reference Guide</Badge>
                  <button
                    type="button"
                    onClick={() => setLightbox('poster')}
                    aria-label="Zoom personal safety awareness poster"
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-mint-deep hover:bg-mint-soft"
                  >
                    <Expand className="h-3.5 w-3.5" />
                    Zoom
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setLightbox('poster')}
                  className="mt-3 block w-full overflow-hidden rounded-control border border-border-soft bg-warm-surface text-left transition-transform hover:scale-[1.01]"
                  aria-label="Open personal safety reference poster in full-size lightbox"
                >
                  <picture>
                    <source srcSet="/assets/safety-poster.webp" type="image/webp" />
                    <img
                      src="/assets/safety-poster.jpg"
                      alt="Women personal safety awareness poster with practical tips"
                      width={454}
                      height={639}
                      loading="lazy"
                      className="mx-auto h-64 w-full object-contain bg-white p-2"
                    />
                  </picture>
                </button>
                <p className="mt-3 text-xs text-charcoal-muted">
                  Practical situational awareness checklist for night commutes, transit, and online
                  privacy. Click to inspect full resolution.
                </p>
              </div>
            </Card>
          </motion.div>

          {/* Structured SVG/CSS fallback card (safety-issues.jpg was not among the 13 uploaded images) */}
          <motion.div variants={scaleIn(reduced)}>
            <Card className="flex h-full flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between">
                  <Badge tone="mint">Awareness Summary</Badge>
                  <button
                    type="button"
                    onClick={() => setLightbox('issues')}
                    aria-label="Expand 7 Critical Women Safety Challenges in India graphic"
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-mint-deep hover:bg-mint-soft"
                  >
                    <Expand className="h-3.5 w-3.5" />
                    Expand
                  </button>
                </div>
                <div
                  onClick={() => setLightbox('issues')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setLightbox('issues');
                    }
                  }}
                  className="mt-3 cursor-pointer rounded-control border border-border-soft bg-gradient-to-br from-mint-soft/75 via-white to-[var(--color-pink-soft)]/60 p-4"
                >
                  <p className="font-display text-sm font-extrabold text-charcoal">
                    7 Critical Women Safety Challenges in Everyday Commutes
                  </p>
                  <ol className="mt-2.5 space-y-1.5 text-xs text-charcoal-muted">
                    {SEVEN_CHALLENGES.map((item, i) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-mint text-[10px] font-bold text-mint-deep">
                          {i + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <p className="mt-3 text-xs text-charcoal-muted">
                  Structured awareness summary rendered locally (fallback graphic for the 7
                  Critical Women Safety Issues card).
                </p>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </section>

      {/* 7. EMERGENCY DISCLAIMER + FINAL CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <Card className="border-mint-dark/40 bg-gradient-to-br from-white via-warm-white to-mint-soft/50 p-6 sm:p-10">
          <div className="grid items-center gap-6 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-8">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-mint-deep">
                <ShieldAlert className="h-4 w-4" />
                Independent Assistance Platform — Emergency Disclaimer
              </div>
              <h2 className="font-display text-2xl font-extrabold text-charcoal sm:text-3xl">
                SafeStop 360 complements — never replaces — official emergency services.
              </h2>
              <p className="text-sm text-charcoal-muted">
                In immediate physical danger, always dial India&apos;s National Emergency Helpline{' '}
                <strong>112</strong> or Women Helpline <strong>181</strong> first.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a href="tel:112">
                  <Button variant="primary">
                    <PhoneCall className="h-4 w-4" />
                    Call 112 (Emergency)
                  </Button>
                </a>
                <a href="tel:181">
                  <Button variant="secondary">
                    <PhoneCall className="h-4 w-4" />
                    Call 181 (Women Helpline)
                  </Button>
                </a>
                <Link to="/find-help">
                  <Button variant="ghost">
                    <Sparkles className="h-4 w-4 text-mint-deep" />
                    Open Nearby SafePlaces Map
                  </Button>
                </Link>
              </div>
            </div>
            <div className="rounded-card border border-border-soft bg-white p-5 lg:col-span-4">
              <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
                Ready to try the demo?
              </p>
              <p className="mt-1.5 text-sm text-charcoal">
                Test the full GPS-first workflow with verified Mysuru demo SafePlaces, live
                directions, and partner confirmations.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Link to="/login" className="w-full">
                  <Button className="w-full">Sign In with Demo Account</Button>
                </Link>
                <Link to="/design-system" className="w-full">
                  <Button variant="ghost" className="w-full">
                    Preview Design System
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <Footer />

      {/* Animated Glass Lightbox Modal (Esc closes) */}
      <Modal
        open={lightbox !== null}
        onClose={() => setLightbox(null)}
        title={
          lightbox === 'poster'
            ? 'Personal Safety Awareness Poster'
            : '7 Critical Women Safety Challenges in Everyday Commutes'
        }
        subtitle="Press Escape or click outside to close."
        maxWidth="lg"
      >
        {lightbox === 'poster' ? (
          <div className="flex justify-center">
            <picture>
              <source srcSet="/assets/safety-poster.webp" type="image/webp" />
              <img
                src="/assets/safety-poster.jpg"
                alt="Full-size women personal safety awareness poster"
                className="max-h-[72vh] w-auto rounded-control object-contain"
              />
            </picture>
          </div>
        ) : (
          <div className="space-y-3">
            <ol className="space-y-2.5">
              {SEVEN_CHALLENGES.map((item, idx) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-control border border-border-soft bg-white p-3 text-sm text-charcoal"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-bold text-mint-deep">
                    {idx + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-charcoal-muted">
              Emergency helplines (India): <strong>112</strong> (National Emergency) ·{' '}
              <strong>181</strong> (Women Helpline).
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
