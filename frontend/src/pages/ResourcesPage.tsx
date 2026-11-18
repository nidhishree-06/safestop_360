import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PhoneCall, ShieldCheck, FileText, EyeOff, MapPin, CheckCircle2 } from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';

export function ResourcesPage() {
  const [posterOpen, setPosterOpen] = useState(false);

  return (
    <div className="min-h-screen bg-warm-white text-charcoal">
      <Navbar />

      <main className="mx-auto max-w-6xl space-y-10 px-4 pb-16 pt-10 sm:px-6">
        <div className="max-w-3xl space-y-3">
          <Badge tone="pink">Safety Resources &amp; Emergency Support</Badge>
          <h1 className="font-display text-3xl font-extrabold text-charcoal sm:text-4xl">
            Official helplines, practical travel habits, and your privacy rights
          </h1>
          <p className="text-base leading-relaxed text-charcoal-muted">
            SafeStop 360 is an independent local assistance platform and does{' '}
            <strong>not</strong> replace official emergency services. In any immediate
            emergency, dial the official Indian helplines below first.
          </p>
        </div>

        {/* Official Helplines */}
        <section className="grid gap-5 md:grid-cols-2">
          <a
            href="tel:112"
            className="surface-matte border-[var(--color-error)] p-6 transition-colors hover:bg-[var(--color-error-soft)]/50"
          >
            <div className="flex items-center justify-between">
              <Badge tone="error">All-in-One Emergency · India</Badge>
              <PhoneCall className="h-5 w-5 text-[var(--color-error-deep)]" aria-hidden="true" />
            </div>
            <p className="mt-4 font-display text-4xl font-extrabold text-[var(--color-error-deep)] tabular-nums">
              112
            </p>
            <p className="mt-2 text-sm text-charcoal-muted">
              Unified national emergency response for Police, Fire, and Medical Ambulance
              across India (24/7).
            </p>
          </a>

          <a
            href="tel:181"
            className="surface-matte border-[var(--color-pink)]/60 p-6 transition-colors hover:bg-[var(--color-pink-soft)]/50"
          >
            <div className="flex items-center justify-between">
              <Badge tone="pink">National Women Helpline · India</Badge>
              <PhoneCall className="h-5 w-5 text-[#9b2c63]" aria-hidden="true" />
            </div>
            <p className="mt-4 font-display text-4xl font-extrabold text-[#9b2c63] tabular-nums">
              181
            </p>
            <p className="mt-2 text-sm text-charcoal-muted">
              24-hour toll-free helpline providing immediate assistance, crisis counselling,
              and referral support for women in distress.
            </p>
          </a>
        </section>

        {/* Practical Safety Checklist + Poster Reference */}
        <section className="grid gap-6 lg:grid-cols-12">
          <Card surface="matte" className="space-y-4 p-6 lg:col-span-7">
            <div className="flex items-center gap-2 text-mint-deep">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <h2 className="font-display text-xl font-bold text-charcoal">
                Practical Everyday Commute Habits
              </h2>
            </div>
            <ul className="space-y-3 text-sm text-charcoal-muted">
              {[
                'Before late-evening travel, save 2 trusted contacts and set an opt-in Journey Watch ETA.',
                'When unsure about a street or waiting area, check the SafePlaces map for an available verified pharmacy, clinic, or staffed hotel lobby.',
                'Send an Assistance Request ahead of arriving so front-desk staff confirm they are expecting you.',
                'Share vehicle registration details with a trusted contact before boarding night cabs or autos.',
                'Report broken streetlamps or isolated dark stretches so local patterns are logged for review.',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-deep" aria-hidden="true" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card surface="glass" className="flex flex-col justify-between space-y-4 p-6 lg:col-span-5">
            <div className="space-y-3">
              <Badge tone="violet">Educational Reference</Badge>
              <h2 className="font-display text-xl font-bold text-charcoal">
                Personal Safety Awareness Poster
              </h2>
              <p className="text-sm leading-relaxed text-charcoal-muted">
                View the complete illustrated safety guide in a clear, readable modal
                viewer covering night transit, vehicle safety, home privacy, and helplines.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" size="md" type="button" onClick={() => setPosterOpen(true)}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                Open Reference Poster
              </Button>
              <Link to="/find-help">
                <Button variant="secondary" size="md" type="button">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  Find Nearby Help
                </Button>
              </Link>
            </div>
          </Card>
        </section>

        {/* Privacy Rights */}
        <Card surface="matte-subtle" className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint-soft text-mint-deep">
            <EyeOff className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-charcoal">
              Your Privacy Pledge on SafeStop 360
            </h2>
            <p className="mt-1 text-sm text-charcoal-muted">
              SafeStop never tracks your location silently in the background, never plots
              live user locations on public maps, and never publishes reporter identities on
              community safety reports.
            </p>
          </div>
        </Card>
      </main>

      <Footer />

      <Modal
        open={posterOpen}
        onClose={() => setPosterOpen(false)}
        title="Women's Personal Safety Reference Guide"
        subtitle="Call 112 (Emergency) or 181 (Women Helpline) immediately in urgent danger."
        maxWidth="lg"
      >
        <div className="overflow-hidden rounded-2xl border border-border-soft bg-pure-white p-2">
          <img
            src="/assets/safety-awareness-poster.jpg"
            alt="Women's safety awareness infographic covering personal safety tips and emergency numbers"
            className="mx-auto max-h-[70vh] w-auto rounded-xl object-contain"
          />
        </div>
      </Modal>
    </div>
  );
}
