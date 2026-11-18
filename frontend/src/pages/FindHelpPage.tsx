import { useNavigate } from 'react-router-dom';

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SafePlacesMap } from '@/components/map/SafePlacesMap';
import { EmergencyBanner } from '@/components/ui/EmergencyBanner';
import { Badge } from '@/components/ui/Badge';
import type { PartnerItem } from '@/types';

export function FindHelpPage({ embeddedInDashboard = false }: { embeddedInDashboard?: boolean }) {
  const navigate = useNavigate();

  const handleRequestShortcut = (partner: PartnerItem, origin: { lat: number; lng: number }) => {
    navigate(
      `/app/requests?partner=${partner.id}&lat=${origin.lat}&lng=${origin.lng}`
    );
  };

  if (embeddedInDashboard) {
    return (
      <DashboardLayout
        title="Nearby Verified SafePlaces"
        subtitle="Explore admin-approved establishments with live availability, distances, and directions. Demo locations are clearly labelled."
      >
        <SafePlacesMap onRequestAssistance={handleRequestShortcut} />
        <EmergencyBanner />
      </DashboardLayout>
    );
  }

  return (
    <div className="min-h-screen bg-warm-white text-charcoal">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
        <div className="space-y-2">
          <Badge tone="mint">Live OpenStreetMap Directory</Badge>
          <h1 className="font-display text-3xl font-extrabold text-charcoal sm:text-4xl">
            Find Verified Nearby SafePlaces
          </h1>
          <p className="max-w-2xl text-sm text-charcoal-muted sm:text-base">
            Browse admin-approved establishments, filter by category and live availability,
            and get walking directions. Local development displays clearly labelled{' '}
            <strong>[DEMO]</strong> Bengaluru establishments.
          </p>
        </div>

        <SafePlacesMap />
        <EmergencyBanner />
      </main>
      <Footer />
    </div>
  );
}
