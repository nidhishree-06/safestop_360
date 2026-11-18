import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { LandingPage } from '@/pages/LandingPage';
import { DesignSystemPage } from '@/pages/DesignSystemPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ResourcesPage } from '@/pages/ResourcesPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { FindHelpPage } from '@/pages/FindHelpPage';
import { WomanDashboardPage } from '@/pages/WomanDashboardPage';
import { AssistanceLoopPage } from '@/pages/AssistanceLoopPage';
import { JourneyWatchPage } from '@/pages/JourneyWatchPage';
import { SharedJourneyPage } from '@/pages/SharedJourneyPage';
import { SafetyReportsPage } from '@/pages/SafetyReportsPage';
import { CompanionsPage } from '@/pages/CompanionsPage';
import { PartnerDashboardPage } from '@/pages/PartnerDashboardPage';
import { PartnerEstablishmentPage } from '@/pages/PartnerEstablishmentPage';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';
import { AdminPartnersPage } from '@/pages/AdminPartnersPage';
import { AdminReportsPage } from '@/pages/AdminReportsPage';
import { AdminCompanionsPage } from '@/pages/AdminCompanionsPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public Website */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/design-system" element={<DesignSystemPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/find-help" element={<FindHelpPage />} />
            <Route path="/journey-status/:token" element={<SharedJourneyPage />} />

            {/* Authenticated Shared Profile */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Women's Application (Role: WOMAN) */}
            <Route
              path="/app"
              element={
                <ProtectedRoute allowedRoles={['WOMAN']}>
                  <WomanDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/map"
              element={
                <ProtectedRoute allowedRoles={['WOMAN']}>
                  <FindHelpPage embeddedInDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/requests"
              element={
                <ProtectedRoute allowedRoles={['WOMAN']}>
                  <AssistanceLoopPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/journey"
              element={
                <ProtectedRoute allowedRoles={['WOMAN']}>
                  <JourneyWatchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/reports"
              element={
                <ProtectedRoute allowedRoles={['WOMAN']}>
                  <SafetyReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/companions"
              element={
                <ProtectedRoute allowedRoles={['WOMAN']}>
                  <CompanionsPage />
                </ProtectedRoute>
              }
            />

            {/* Partner Dashboard (Role: PARTNER) */}
            <Route
              path="/partner"
              element={
                <ProtectedRoute allowedRoles={['PARTNER']}>
                  <PartnerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/partner/establishment"
              element={
                <ProtectedRoute allowedRoles={['PARTNER']}>
                  <PartnerEstablishmentPage />
                </ProtectedRoute>
              }
            />

            {/* Administrator Dashboard (Role: ADMIN) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/partners"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminPartnersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/companions"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminCompanionsPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
