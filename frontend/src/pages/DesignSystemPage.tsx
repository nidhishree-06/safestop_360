import { useState } from 'react';
import { MapPin, ShieldCheck, Sparkles } from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  GlassCard,
  Input,
  Modal,
  Select,
  Skeleton,
  StatusTimeline,
  Switch,
  Tabs,
} from '@/components/ui';
import { useToast } from '@/context/ToastContext';

const SWATCHES = [
  { name: 'Mint', hex: '#A7E8D2', cls: 'bg-[#A7E8D2]' },
  { name: 'Mint Dark', hex: '#68BFA3', cls: 'bg-[#68BFA3]' },
  { name: 'Warm White', hex: '#F7F7F3', cls: 'bg-[#F7F7F3] border border-border-soft' },
  { name: 'Charcoal', hex: '#22252A', cls: 'bg-[#22252A]' },
  { name: 'Pink Accent', hex: '#E96BA8', cls: 'bg-[#E96BA8]' },
  { name: 'Violet Accent', hex: '#9A7BEA', cls: 'bg-[#9A7BEA]' },
  { name: 'Blue Accent', hex: '#74B9F4', cls: 'bg-[#74B9F4]' },
  { name: 'Warning', hex: '#F0D98A', cls: 'bg-[#F0D98A]' },
  { name: 'Error', hex: '#E58A8A', cls: 'bg-[#E58A8A]' },
];

export function DesignSystemPage() {
  const { pushToast } = useToast();
  const [chipSelected, setChipSelected] = useState('pharmacy');
  const [activeTab, setActiveTab] = useState('overview');
  const [switchOn, setSwitchOn] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-warm-white">
      <Navbar />
      <main className="mx-auto max-w-6xl space-y-10 px-4 pb-20 pt-28 sm:px-6">
        <header className="space-y-3">
          <Badge tone="mint">SafeStop 360 Design System</Badge>
          <h1 className="font-display text-3xl font-extrabold text-charcoal sm:text-5xl">
            Matte, Soft Neumorphism &amp; Liquid Glass
          </h1>
          <p className="max-w-2xl text-base text-charcoal-muted">
            Interactive preview of every UI token, surface, control, and accessible status primitive
            powering SafeStop 360. Typography uses self-hosted Manrope via @fontsource.
          </p>
        </header>

        {/* Palette */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold text-charcoal">Colour Tokens</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {SWATCHES.map((s) => (
              <Card key={s.name} className="p-3">
                <div className={`h-14 w-full rounded-control ${s.cls}`} />
                <p className="mt-2 text-sm font-semibold text-charcoal">{s.name}</p>
                <p className="text-xs text-charcoal-muted tabular-nums">{s.hex}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Buttons & Chips */}
        <section className="grid gap-6 md:grid-cols-2">
          <Card className="space-y-4 p-6">
            <h2 className="font-display text-lg font-bold text-charcoal">Buttons</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                onClick={() =>
                  pushToast({
                    title: 'Primary mint neumorphic action triggered.',
                    tone: 'success',
                  })
                }
              >
                <ShieldCheck className="h-4 w-4" />
                Primary Mint
              </Button>
              <Button variant="secondary" onClick={() => setModalOpen(true)}>
                Open Glass Modal
              </Button>
              <Button variant="ghost">Ghost Action</Button>
              <Button variant="danger">Danger Action</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {(['pharmacy', 'hospital', 'fuel', 'college'] as const).map((cat) => (
                <Chip
                  key={cat}
                  selected={chipSelected === cat}
                  onClick={() => setChipSelected(cat)}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Chip>
              ))}
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="font-display text-lg font-bold text-charcoal">
              Badges, Tabs &amp; Switch
            </h2>
            <div className="flex flex-wrap gap-2">
              <Badge tone="mint">Verified SafePlace</Badge>
              <Badge tone="pink">Speak Up</Badge>
              <Badge tone="violet">Demo</Badge>
              <Badge tone="blue">Live GPS</Badge>
              <Badge tone="warning">Pending</Badge>
              <Badge tone="error">Declined</Badge>
            </div>
            <Tabs
              active={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'overview', label: 'Overview', badge: 3 },
                { id: 'map', label: 'Map Layer' },
                { id: 'history', label: 'History' },
              ]}
            />
            <Switch
              checked={switchOn}
              onChange={setSwitchOn}
              label="Share live location until request closes"
              description="Opt-in per help request. Pings are deleted when the request completes."
            />
          </Card>
        </section>

        {/* Forms & GlassCard */}
        <section className="grid gap-6 md:grid-cols-2">
          <Card className="space-y-4 p-6">
            <h2 className="font-display text-lg font-bold text-charcoal">Inputs &amp; Select</h2>
            <Input
              label="Search area or landmark"
              placeholder="e.g. Sayyaji Rao Road, Mysuru"
              hint="Uses /api/geo/search/ proxy when GPS is unavailable."
            />
            <Select
              label="SafePlace Category"
              options={[
                { value: 'PHARMACY', label: 'Pharmacy' },
                { value: 'HOSPITAL', label: 'Hospital / Clinic' },
                { value: 'FUEL_STATION', label: 'Petrol Station' },
                { value: 'COLLEGE', label: 'College / Campus Facility' },
              ]}
            />
          </Card>

          <div className="relative overflow-hidden rounded-glass bg-gradient-to-br from-mint/45 via-warm-white to-accent-pink/25 p-6">
            <GlassCard className="space-y-3 p-6">
              <div className="flex items-center gap-2 text-mint-deep">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Liquid Glass</span>
              </div>
              <h3 className="font-display text-xl font-bold text-charcoal">
                Floating Overlay Surface
              </h3>
              <p className="text-sm text-charcoal-muted">
                Used exclusively for floating navigation, hero callouts, map controls, and focus-
                trapped modals with an automatic solid fallback.
              </p>
            </GlassCard>
          </div>
        </section>

        {/* Timeline, Skeleton, EmptyState */}
        <section className="grid gap-6 md:grid-cols-3">
          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-charcoal">Status Timeline</h2>
            <StatusTimeline
              steps={[
                { id: '1', label: 'Request Sent', detail: '14:12 IST', state: 'completed' },
                { id: '2', label: 'Partner Accepted', detail: 'Counter ready', state: 'current' },
                { id: '3', label: 'Arrival Confirmed', state: 'upcoming' },
                { id: '4', label: 'Closed Safely', state: 'upcoming' },
              ]}
            />
          </Card>

          <Card className="space-y-3 p-6">
            <h2 className="font-display text-lg font-bold text-charcoal">Loading Skeletons</h2>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-24 w-full rounded-card" />
          </Card>

          <EmptyState
            icon={<MapPin className="h-5 w-5" />}
            title="No verified partners in 1 km"
            description="Expand your search radius or enable the OpenStreetMap places layer."
            action={
              <Button size="sm" variant="secondary">
                Try 5 km radius
              </Button>
            }
          />
        </section>
      </main>
      <Footer />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Focus-Trapped Liquid Glass Modal"
        subtitle="Press Escape or click outside to close."
      >
        <p className="text-sm text-charcoal-muted">
          Tab and Shift+Tab remain trapped inside this modal while open, and focus returns to the
          triggering button when closed.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Close
          </Button>
          <Button
            onClick={() => {
              setModalOpen(false);
              pushToast({ title: 'Modal action confirmed.', tone: 'success' });
            }}
          >
            Confirm
          </Button>
        </div>
      </Modal>
    </div>
  );
}
