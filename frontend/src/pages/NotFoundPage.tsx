import { Link } from 'react-router-dom';
import { Compass, Home, PhoneCall } from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button, Card } from '@/components/ui';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-warm-white">
      <Navbar />
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 pb-16 pt-28">
        <Card className="w-full space-y-5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-soft text-mint-deep">
            <Compass className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-mint-deep">Error 404</p>
            <h1 className="font-display text-3xl font-extrabold text-charcoal">Page not found</h1>
            <p className="text-sm text-charcoal-muted">
              The page you requested does not exist. You can return home or open the nearby help map
              immediately.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link to="/">
              <Button>
                <Home className="h-4 w-4" />
                Return Home
              </Button>
            </Link>
            <Link to="/find-help">
              <Button variant="secondary">Find Help Nearby</Button>
            </Link>
          </div>
          <div className="border-t border-border-soft pt-4 text-xs text-charcoal-muted">
            In immediate danger? Call{' '}
            <a href="tel:112" className="font-bold text-charcoal underline">
              112
            </a>{' '}
            or Women Helpline{' '}
            <a href="tel:181" className="font-bold text-charcoal underline">
              181
            </a>
            .
            <PhoneCall className="ml-1 inline h-3.5 w-3.5 text-mint-deep" />
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
