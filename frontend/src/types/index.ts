export type UserRole = 'WOMAN' | 'PARTNER' | 'ADMIN';

export interface UserProfile {
  phone: string;
  city: string;
  emergency_note: string;
  location_sharing_default: boolean;
  updated_at?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active?: boolean;
  created_at?: string;
  unread_notifications?: number;
  profile: UserProfile;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  role: 'WOMAN' | 'PARTNER';
  phone?: string;
  city?: string;
}

export interface ProfileUpdatePayload {
  full_name?: string;
  phone?: string;
  city?: string;
  emergency_note?: string;
  location_sharing_default?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: 'ASSISTANCE' | 'JOURNEY' | 'PARTNER' | 'REPORT' | 'COMPANION' | 'SYSTEM';
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface HealthResponse {
  service: string;
  status: 'ok' | 'degraded';
  database: {
    connected: boolean;
    vendor: string;
  };
  timestamp: string;
  emergency_helplines_india: {
    emergency: string;
    women_helpline: string;
    notice: string;
  };
}

export type PartnerCategory =
  | 'PHARMACY'
  | 'HOSPITAL'
  | 'PETROL_STATION'
  | 'SHOP'
  | 'HOTEL'
  | 'COLLEGE_FACILITY'
  | 'OTHER';

export type PartnerVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type PartnerAvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export type HelpRequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'ARRIVED'
  | 'CLOSED'
  | 'CANCELLED';

export type JourneyStatus = 'ACTIVE' | 'OVERDUE' | 'COMPLETED' | 'CANCELLED';

export type SafetyReportCategory =
  | 'POOR_LIGHTING'
  | 'HARASSMENT'
  | 'ISOLATED_AREA'
  | 'UNSAFE_INFRASTRUCTURE'
  | 'OTHER';

export type SafetyReportReviewStatus =
  | 'UNREVIEWED'
  | 'UNDER_REVIEW'
  | 'REVIEWED'
  | 'DISMISSED';

export interface PartnerAvailabilityInfo {
  status: PartnerAvailabilityStatus;
  status_display?: string;
  status_note: string;
  updated_at?: string;
}

export interface PartnerItem {
  id: string;
  name: string;
  category: PartnerCategory;
  category_display: string;
  description: string;
  address: string;
  area: string;
  city: string;
  latitude: string | number;
  longitude: string | number;
  contact_phone: string;
  operating_hours: string;
  support_services: string[];
  verification_status: PartnerVerificationStatus;
  verification_status_display?: string;
  is_demo: boolean;
  availability: PartnerAvailabilityInfo | null;
  distance_km?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface PartnerVerificationRecord {
  id: string;
  status: PartnerVerificationStatus;
  notes: string;
  reviewed_by_name: string;
  reviewed_at: string;
}

export interface PartnerOwnerItem extends PartnerItem {
  owner_email: string;
  owner_name: string;
  verifications: PartnerVerificationRecord[];
}

export interface PartnerCreatePayload {
  name: string;
  category: PartnerCategory;
  description: string;
  address: string;
  area: string;
  city: string;
  latitude: number | string;
  longitude: number | string;
  contact_phone: string;
  operating_hours: string;
  support_services: string[];
}

export interface HelpRequestFeedback {
  id: string;
  rating: number;
  felt_safe: boolean;
  comment: string;
  created_at: string;
}

export interface HelpRequestItem {
  id: string;
  requester: string;
  requester_name: string;
  partner: string;
  partner_name: string;
  partner_category: string;
  partner_address: string;
  partner_area: string;
  partner_phone: string;
  partner_hours: string;
  partner_latitude: string | number;
  partner_longitude: string | number;
  status: HelpRequestStatus;
  status_display: string;
  note: string;
  partner_response_note: string;
  requester_latitude?: string | number | null;
  requester_longitude?: string | number | null;
  estimated_arrival_minutes?: number | null;
  accepted_at?: string | null;
  arrived_at?: string | null;
  closed_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
  feedback?: HelpRequestFeedback | null;
}

export interface HelpRequestCreatePayload {
  partner: string;
  note?: string;
  requester_latitude?: number | null;
  requester_longitude?: number | null;
  estimated_arrival_minutes?: number | null;
}

export interface TrustedContactItem {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  notify_on_journey_start: boolean;
  notify_on_missed_checkin: boolean;
  notify_on_arrival: boolean;
  is_primary: boolean;
  created_at?: string;
}

export interface JourneyCheckInItem {
  id: string;
  status: 'SAFE' | 'DELAYED' | 'ARRIVED' | 'MISSED_REMINDER';
  status_display: string;
  note: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  created_at: string;
}

export interface JourneyItem {
  id: string;
  origin_label: string;
  destination_label: string;
  expected_arrival_at: string;
  checkin_interval_minutes: number;
  status: JourneyStatus;
  status_display: string;
  location_sharing_enabled: boolean;
  last_known_latitude?: string | number | null;
  last_known_longitude?: string | number | null;
  last_checkin_at?: string | null;
  completed_at?: string | null;
  next_checkin_due_at?: string | null;
  is_checkin_overdue: boolean;
  trusted_contacts: TrustedContactItem[];
  checkins: JourneyCheckInItem[];
  created_at: string;
}

export interface SafetyReportItem {
  id: string;
  category: SafetyReportCategory;
  category_display: string;
  description: string;
  area_label: string;
  city: string;
  latitude: string | number;
  longitude: string | number;
  incident_time?: string | null;
  review_status: SafetyReportReviewStatus;
  review_status_display: string;
  is_unreviewed: boolean;
  is_demo: boolean;
  ai_classification?: {
    declared_category: string;
    matched_themes: string[];
    matched_keywords: string[];
  };
  admin_notes?: string;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface SafetyClusterItem {
  cluster_id: string;
  primary_area: string;
  area_labels: string[];
  city: string;
  center_lat: number;
  center_lng: number;
  report_count: number;
  unreviewed_count: number;
  is_repeated_pattern: boolean;
  dominant_category: SafetyReportCategory;
  dominant_category_count: number;
  category_breakdown: Record<string, number>;
}

export interface SafetyIntelligenceSummary {
  total_active_reports: number;
  review_breakdown: {
    unreviewed: number;
    under_review: number;
    reviewed: number;
  };
  category_distribution: Array<{
    category: SafetyReportCategory;
    label: string;
    count: number;
    percentage: number;
  }>;
  time_of_day_trends: Array<{
    window: string;
    count: number;
  }>;
  daily_frequency: Array<{
    date: string;
    count: number;
  }>;
  spatial_clusters: SafetyClusterItem[];
  repeated_report_clusters: SafetyClusterItem[];
  summary_notes: string[];
  methodology_and_limitations: string;
}

export interface CompanionItem {
  id: string;
  user: string;
  user_email?: string;
  display_name: string;
  bio: string;
  service_areas: string[];
  languages: string[];
  verification_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  verification_status_display: string;
  is_available: boolean;
  is_demo: boolean;
  verified_at?: string | null;
  created_at: string;
}

export interface CompanionRequestItem {
  id: string;
  requester: string;
  requester_name: string;
  companion: string;
  companion_name: string;
  pickup_area: string;
  destination_area: string;
  scheduled_for: string;
  note: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED';
  status_display: string;
  response_note: string;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  summary: string;
  actor_email: string;
  created_at: string;
}

export interface AdminAnalyticsResponse {
  counts: {
    users_total: number;
    users_woman: number;
    users_partner: number;
    partners_approved: number;
    partners_pending: number;
    partners_available_now: number;
    requests_total: number;
    requests_active: number;
    requests_closed: number;
    reports_total: number;
    reports_unreviewed: number;
    companions_approved: number;
    companions_pending: number;
    active_journeys_count: number;
  };
  intelligence: SafetyIntelligenceSummary;
  recent_requests: HelpRequestItem[];
  audit_logs: AuditLogItem[];
  map_overview: {
    partners: PartnerItem[];
    reports: SafetyReportItem[];
  };
}

export interface NearbyPartnersResponse {
  origin: { lat: number; lng: number };
  radius_km: number;
  count: number;
  results: PartnerItem[];
}

export interface DashboardSummary {
  approved_partners_count: number;
  available_partners_count: number;
  active_help_request: {
    id: string;
    status: HelpRequestStatus;
    partner_id: string;
    partner_name: string;
    partner_area: string;
    created_at: string;
  } | null;
  active_journey: {
    id: string;
    destination_label: string;
    status: JourneyStatus;
    expected_arrival_at: string;
    location_sharing_enabled: boolean;
    trusted_contacts_count: number;
  } | null;
  trusted_contacts_count: number;
  trusted_contacts: Array<{
    id: string;
    name: string;
    relationship: string;
    phone: string;
    is_primary: boolean;
  }>;
  recent_reports: Array<{
    id: string;
    category: SafetyReportCategory;
    area_label: string;
    city: string;
    review_status: SafetyReportReviewStatus;
    is_demo: boolean;
    created_at: string;
  }>;
  unread_notifications_count: number;
}
