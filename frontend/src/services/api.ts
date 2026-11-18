import type {
  AdminAnalyticsResponse,
  AuthResponse,
  AuthUser,
  CompanionItem,
  CompanionRequestItem,
  DashboardSummary,
  HealthResponse,
  HelpRequestCreatePayload,
  HelpRequestFeedback,
  HelpRequestItem,
  JourneyItem,
  NearbyPartnersResponse,
  NotificationItem,
  PartnerAvailabilityInfo,
  PartnerAvailabilityStatus,
  PartnerCreatePayload,
  PartnerItem,
  PartnerOwnerItem,
  PartnerVerificationStatus,
  ProfileUpdatePayload,
  RegisterPayload,
  SafetyIntelligenceSummary,
  SafetyReportCategory,
  SafetyReportItem,
  SafetyReportReviewStatus,
  TrustedContactItem,
} from '@/types';

const DEFAULT_API_URL = import.meta.env.DEV ? 'http://127.0.0.1:8000/api' : '/api';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_URL
).replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const ACCESS_TOKEN_KEY = 'safestop_access_token';
const REFRESH_TOKEN_KEY = 'safestop_refresh_token';

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (access: string, refresh?: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    }
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

function extractErrorMessage(parsed: unknown, status: number): string {
  if (typeof parsed === 'string' && parsed.trim()) {
    return parsed.slice(0, 200);
  }
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.detail === 'string') return obj.detail;
    if (Array.isArray(obj.non_field_errors) && obj.non_field_errors.length > 0) {
      return String(obj.non_field_errors[0]);
    }
    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val) && val.length > 0) {
        const label = key === 'non_field_errors' ? '' : `${key.replace(/_/g, ' ')}: `;
        return `${label}${String(val[0])}`;
      }
      if (typeof val === 'string') {
        return `${key.replace(/_/g, ' ')}: ${val}`;
      }
    }
  }
  return `Request failed with status ${status}`;
}

let refreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
      .then(async (res) => {
        if (!res.ok) {
          tokenStorage.clear();
          return null;
        }
        const data = (await res.json()) as { access?: string; refresh?: string };
        if (data.access) {
          tokenStorage.setTokens(data.access, data.refresh);
          return data.access;
        }
        tokenStorage.clear();
        return null;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean; _retried?: boolean } = {}
): Promise<T> {
  const { skipAuth = false, _retried = false, headers = {}, ...rest } = options;
  const mergedHeaders = new Headers(headers);
  if (!mergedHeaders.has('Content-Type') && rest.body) {
    mergedHeaders.set('Content-Type', 'application/json');
  }
  if (!skipAuth) {
    const token = tokenStorage.getAccess();
    if (token) {
      mergedHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...rest,
    headers: mergedHeaders,
  });

  if (response.status === 401 && !skipAuth && !_retried && tokenStorage.getRefresh()) {
    const newAccess = await attemptTokenRefresh();
    if (newAccess) {
      return apiRequest<T>(path, { ...options, _retried: true });
    }
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(parsed, response.status), response.status, parsed);
  }

  return parsed as T;
}

export function fetchHealthCheck(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health/', { skipAuth: true });
}

// --- Authentication & Profile ---

export function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export function loginUser(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
}

export function logoutUser(refresh: string | null): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>('/auth/logout/', {
    method: 'POST',
    body: JSON.stringify({ refresh: refresh || '' }),
  });
}

export function fetchCurrentUser(): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth/me/');
}

export function updateCurrentUser(payload: ProfileUpdatePayload): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth/me/', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>('/auth/change-password/', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export function fetchNotifications(): Promise<{
  unread_count: number;
  results: NotificationItem[];
}> {
  return apiRequest('/auth/notifications/');
}

export function markNotificationRead(id: string): Promise<NotificationItem> {
  return apiRequest(`/auth/notifications/${id}/read/`, { method: 'POST' });
}

export function markAllNotificationsRead(): Promise<{ marked_read: number }> {
  return apiRequest('/auth/notifications/read-all/', { method: 'POST' });
}

export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>('/auth/dashboard-summary/');
}

// --- Partners & Nearby SafePlaces ---

export function fetchNearbyPartners(params: {
  lat: number;
  lng: number;
  radius_km?: number;
  category?: string;
  search?: string;
  available_only?: boolean;
}): Promise<NearbyPartnersResponse> {
  const query = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    radius_km: String(params.radius_km ?? 25),
  });
  if (params.category && params.category !== 'ALL') {
    query.set('category', params.category);
  }
  if (params.search?.trim()) {
    query.set('search', params.search.trim());
  }
  if (params.available_only) {
    query.set('available_only', 'true');
  }
  return apiRequest<NearbyPartnersResponse>(`/partners/nearby/?${query.toString()}`, {
    skipAuth: true,
  });
}

export function fetchPartnerDetail(id: string): Promise<PartnerItem> {
  return apiRequest<PartnerItem>(`/partners/${id}/`);
}

export function fetchMyPartners(): Promise<{ count: number; results: PartnerOwnerItem[] }> {
  return apiRequest('/partners/mine/');
}

export function registerPartnerEstablishment(
  payload: PartnerCreatePayload
): Promise<PartnerOwnerItem> {
  return apiRequest<PartnerOwnerItem>('/partners/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updatePartnerEstablishment(
  id: string,
  payload: Partial<PartnerCreatePayload>
): Promise<PartnerOwnerItem> {
  return apiRequest<PartnerOwnerItem>(`/partners/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function updatePartnerAvailability(
  id: string,
  status: PartnerAvailabilityStatus,
  statusNote = ''
): Promise<{ partner_id: string; availability: PartnerAvailabilityInfo }> {
  return apiRequest(`/partners/${id}/availability/`, {
    method: 'PATCH',
    body: JSON.stringify({ status, status_note: statusNote }),
  });
}

export function fetchAdminPartners(
  statusFilter = 'ALL'
): Promise<{ count: number; results: PartnerOwnerItem[] }> {
  const qs = statusFilter && statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
  return apiRequest(`/admin/partners/${qs}`);
}

export function reviewAdminPartner(
  id: string,
  status: PartnerVerificationStatus,
  notes: string
): Promise<PartnerOwnerItem> {
  return apiRequest<PartnerOwnerItem>(`/admin/partners/${id}/review/`, {
    method: 'POST',
    body: JSON.stringify({ status, notes }),
  });
}

// --- Assistance Confirmation Loop ---

export function fetchHelpRequests(params?: {
  status?: string;
  partner_id?: string;
}): Promise<{ count: number; results: HelpRequestItem[] }> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'ALL') query.set('status', params.status);
  if (params?.partner_id) query.set('partner_id', params.partner_id);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiRequest(`/requests/${qs}`);
}

export function createHelpRequest(
  payload: HelpRequestCreatePayload
): Promise<HelpRequestItem> {
  return apiRequest<HelpRequestItem>('/requests/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function acceptHelpRequest(
  id: string,
  responseNote = ''
): Promise<HelpRequestItem> {
  return apiRequest<HelpRequestItem>(`/requests/${id}/accept/`, {
    method: 'POST',
    body: JSON.stringify({ response_note: responseNote }),
  });
}

export function declineHelpRequest(
  id: string,
  responseNote = ''
): Promise<HelpRequestItem> {
  return apiRequest<HelpRequestItem>(`/requests/${id}/decline/`, {
    method: 'POST',
    body: JSON.stringify({ response_note: responseNote }),
  });
}

export function markHelpRequestArrived(id: string): Promise<HelpRequestItem> {
  return apiRequest<HelpRequestItem>(`/requests/${id}/arrived/`, {
    method: 'POST',
  });
}

export function closeHelpRequest(
  id: string,
  responseNote = ''
): Promise<HelpRequestItem> {
  return apiRequest<HelpRequestItem>(`/requests/${id}/close/`, {
    method: 'POST',
    body: JSON.stringify({ response_note: responseNote }),
  });
}

export function cancelHelpRequest(id: string): Promise<HelpRequestItem> {
  return apiRequest<HelpRequestItem>(`/requests/${id}/cancel/`, {
    method: 'POST',
  });
}

export function submitHelpRequestFeedback(
  id: string,
  payload: { rating: number; felt_safe: boolean; comment: string }
): Promise<HelpRequestFeedback> {
  return apiRequest<HelpRequestFeedback>(`/requests/${id}/feedback/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// --- Journey Watch & Trusted Contacts ---

export function fetchTrustedContacts(): Promise<{
  count: number;
  results: TrustedContactItem[];
}> {
  return apiRequest('/journeys/contacts/');
}

export function createTrustedContact(
  payload: Omit<TrustedContactItem, 'id' | 'created_at'>
): Promise<TrustedContactItem> {
  return apiRequest<TrustedContactItem>('/journeys/contacts/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTrustedContact(
  id: string,
  payload: Partial<Omit<TrustedContactItem, 'id' | 'created_at'>>
): Promise<TrustedContactItem> {
  return apiRequest<TrustedContactItem>(`/journeys/contacts/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteTrustedContact(id: string): Promise<void> {
  return apiRequest(`/journeys/contacts/${id}/`, { method: 'DELETE' });
}

export function fetchJourneys(): Promise<{ count: number; results: JourneyItem[] }> {
  return apiRequest('/journeys/');
}

export function startJourney(payload: {
  origin_label?: string;
  destination_label: string;
  expected_arrival_at: string;
  checkin_interval_minutes: number;
  location_sharing_enabled: boolean;
  trusted_contact_ids: string[];
}): Promise<JourneyItem> {
  return apiRequest<JourneyItem>('/journeys/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function checkInJourney(
  id: string,
  payload: {
    status: 'SAFE' | 'DELAYED';
    note?: string;
    latitude?: number | null;
    longitude?: number | null;
  }
): Promise<JourneyItem> {
  return apiRequest<JourneyItem>(`/journeys/${id}/checkin/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function completeJourney(id: string): Promise<JourneyItem> {
  return apiRequest<JourneyItem>(`/journeys/${id}/complete/`, { method: 'POST' });
}

export function stopJourneySharing(
  id: string,
  endJourney = false
): Promise<JourneyItem> {
  return apiRequest<JourneyItem>(`/journeys/${id}/stop-sharing/`, {
    method: 'POST',
    body: JSON.stringify({ end_journey: endJourney }),
  });
}

// --- Community Safety Reports & Rule-Based AI Intelligence ---

export function fetchSafetyReports(params?: {
  category?: string;
  review_status?: string;
}): Promise<{ count: number; results: SafetyReportItem[] }> {
  const query = new URLSearchParams();
  if (params?.category && params.category !== 'ALL') query.set('category', params.category);
  if (params?.review_status && params.review_status !== 'ALL') {
    query.set('review_status', params.review_status);
  }
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiRequest(`/reports/${qs}`);
}

export function createSafetyReport(payload: {
  category: SafetyReportCategory;
  description: string;
  area_label: string;
  city: string;
  latitude: number;
  longitude: number;
  incident_time?: string | null;
}): Promise<SafetyReportItem> {
  return apiRequest<SafetyReportItem>('/reports/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchSafetyIntelligence(): Promise<SafetyIntelligenceSummary> {
  return apiRequest<SafetyIntelligenceSummary>('/reports/intelligence/');
}

export function fetchAdminReports(reviewStatus = 'ALL'): Promise<{
  count: number;
  results: SafetyReportItem[];
  intelligence: SafetyIntelligenceSummary;
}> {
  const qs = reviewStatus && reviewStatus !== 'ALL' ? `?review_status=${reviewStatus}` : '';
  return apiRequest(`/admin/reports/${qs}`);
}

export function reviewAdminReport(
  id: string,
  reviewStatus: SafetyReportReviewStatus,
  adminNotes: string
): Promise<SafetyReportItem> {
  return apiRequest<SafetyReportItem>(`/admin/reports/${id}/review/`, {
    method: 'PATCH',
    body: JSON.stringify({ review_status: reviewStatus, admin_notes: adminNotes }),
  });
}

// --- Companions & Admin Governance ---

export function fetchApprovedCompanions(params?: {
  area?: string;
  available_only?: boolean;
}): Promise<{ count: number; results: CompanionItem[] }> {
  const query = new URLSearchParams();
  if (params?.area?.trim()) query.set('area', params.area.trim());
  if (params?.available_only) query.set('available_only', 'true');
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiRequest(`/companions/${qs}`);
}

export function fetchMyCompanionProfile(): Promise<{ companion: CompanionItem | null }> {
  return apiRequest('/companions/me/');
}

export function registerCompanion(payload: {
  display_name: string;
  bio: string;
  service_areas: string[];
  languages: string[];
}): Promise<CompanionItem> {
  return apiRequest<CompanionItem>('/companions/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function toggleCompanionAvailability(isAvailable: boolean): Promise<CompanionItem> {
  return apiRequest<CompanionItem>('/companions/availability/', {
    method: 'PATCH',
    body: JSON.stringify({ is_available: isAvailable }),
  });
}

export function fetchCompanionRequests(): Promise<{
  count: number;
  results: CompanionRequestItem[];
}> {
  return apiRequest('/companions/requests/');
}

export function createCompanionRequest(payload: {
  companion: string;
  pickup_area: string;
  destination_area: string;
  scheduled_for: string;
  note?: string;
}): Promise<CompanionRequestItem> {
  return apiRequest<CompanionRequestItem>('/companions/requests/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actOnCompanionRequest(
  id: string,
  action: 'accept' | 'decline' | 'complete' | 'cancel',
  responseNote = ''
): Promise<CompanionRequestItem> {
  return apiRequest<CompanionRequestItem>(`/companions/requests/${id}/${action}/`, {
    method: 'POST',
    body: JSON.stringify({ response_note: responseNote }),
  });
}

export function fetchAdminCompanions(
  statusFilter = 'ALL'
): Promise<{ count: number; results: CompanionItem[] }> {
  const qs = statusFilter && statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
  return apiRequest(`/admin/companions/${qs}`);
}

export function reviewAdminCompanion(
  id: string,
  status: 'APPROVED' | 'REJECTED' | 'SUSPENDED'
): Promise<CompanionItem> {
  return apiRequest<CompanionItem>(`/admin/companions/${id}/review/`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export function fetchAdminAnalytics(): Promise<AdminAnalyticsResponse> {
  return apiRequest<AdminAnalyticsResponse>('/admin/analytics/');
}
