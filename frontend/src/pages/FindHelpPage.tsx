import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SafeStopMap } from '@/components/map/SafeStopMap';

export function FindHelpPage({ embeddedInDashboard = false }: { embeddedInDashboard?: boolean }) {
  if (embeddedInDashboard) {
    return (
      <DashboardLayout
        title="Find Verified SafePlaces"
        subtitle="Detect your GPS location or search manually, filter verified partners, and get walking or driving directions."
      >
        <SafeStopMap />
      </DashboardLayout>
    );
  }

  return (
    <div className="min-h-screen bg-warm-white text-charcoal">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-7xl space-y-5 px-4 pb-16 pt-24 sm:px-6">
        <header className="space-y-1.5">
          <h1 className="font-display text-2xl font-extrabold text-charcoal sm:text-3xl">
            Find Verified SafePlaces Nearby
          </h1>
          <p className="max-w-2xl text-sm text-charcoal-muted">
            Click &ldquo;Use my current location&rdquo; for GPS or search any street in India.
            Verified SafeStop partners appear in green; OpenStreetMap listings are an optional
            separate unverified layer.
          </p>
        </header>
        <SafeStopMap />
      </main>
      <Footer />
    </div>
  );
}
