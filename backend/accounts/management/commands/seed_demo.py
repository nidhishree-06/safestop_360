"""Idempotent demo seed command for SafeStop 360 (Mysuru, Karnataka).

Usage:
    python manage.py seed_demo

Creates clearly labelled demo accounts, 10 approved Mysuru partners, 2 pending partners,
8 demo safety reports, 2 demo companions, and trusted contacts.
"""

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import AuditLog, Notification, User, UserProfile
from companions.models import Companion
from journeys.models import TrustedContact
from partners.models import Partner, PartnerAvailability, PartnerVerification
from reports.models import SafetyReport


APPROVED_MYSURU_PARTNERS = [
    {
        "name": "Demo MedPlus Pharmacy — Sayyaji Rao Road",
        "category": Partner.Category.PHARMACY,
        "area": "Sayyaji Rao Road",
        "address": "114 Sayyaji Rao Road, Near KR Circle, Mysuru 570001",
        "latitude": Decimal("12.307800"),
        "longitude": Decimal("76.652500"),
        "contact_phone": "+91-821-242-0101",
        "operating_hours": "24/7",
        "support_services": ["Safe well-lit waiting area", "Phone charging", "Staff call assistance"],
        "availability": PartnerAvailability.Status.AVAILABLE,
        "status_note": "Night pharmacist on duty",
    },
    {
        "name": "Demo Apollo BGS Hospital — Kuvempunagar",
        "category": Partner.Category.HOSPITAL,
        "area": "Kuvempunagar",
        "address": "Adichunchanagiri Road, Kuvempunagar, Mysuru 570023",
        "latitude": Decimal("12.288900"),
        "longitude": Decimal("76.628800"),
        "contact_phone": "+91-821-256-8888",
        "operating_hours": "24/7 Emergency Reception",
        "support_services": ["24/7 security desk", "Medical first aid", "Protected reception lounge"],
        "availability": PartnerAvailability.Status.AVAILABLE,
        "status_note": "Main reception & security active",
    },
    {
        "name": "Demo IndianOil Fuel Station — Hunsur Road",
        "category": Partner.Category.PETROL_STATION,
        "area": "Vijayanagar / Hunsur Road",
        "address": "Hunsur Main Road, Near SJCE Junction, Mysuru 570006",
        "latitude": Decimal("12.315400"),
        "longitude": Decimal("76.615200"),
        "contact_phone": "+91-821-251-0202",
        "operating_hours": "24/7",
        "support_services": ["CCTV forecourt", "Manager cabin shelter", "Drinking water"],
        "availability": PartnerAvailability.Status.AVAILABLE,
        "status_note": "Forecourt lit & staffed",
    },
    {
        "name": "Demo JSS Science & Tech Campus Security Gate",
        "category": Partner.Category.COLLEGE_FACILITY,
        "area": "Manasagangothri / SJCE",
        "address": "Campus Main Gate, TI Road, Mysuru 570006",
        "latitude": Decimal("12.313300"),
        "longitude": Decimal("76.613400"),
        "contact_phone": "+91-821-254-8285",
        "operating_hours": "24/7 Campus Security",
        "support_services": ["Campus security guards", "Safe waiting booth", "Verified auto call"],
        "availability": PartnerAvailability.Status.AVAILABLE,
        "status_note": "Main gate guard post active",
    },
    {
        "name": "Demo Radisson Blu Plaza Reception — MG Road",
        "category": Partner.Category.HOTEL,
        "area": "Indiranagar / MG Road",
        "address": "1 MG Road, Indiranagar Extension, Mysuru 570010",
        "latitude": Decimal("12.297400"),
        "longitude": Decimal("76.664500"),
        "contact_phone": "+91-821-710-1234",
        "operating_hours": "24/7 Front Desk",
        "support_services": ["24/7 lobby reception", "Women front-desk staff", "Safe cab booking"],
        "availability": PartnerAvailability.Status.AVAILABLE,
        "status_note": "Lobby desk open",
    },
    {
        "name": "Demo Loyal World Market — Vontikoppal",
        "category": Partner.Category.SHOP,
        "area": "Vontikoppal",
        "address": "2nd Main, Kalidasa Road, Vontikoppal, Mysuru 570002",
        "latitude": Decimal("12.323600"),
        "longitude": Decimal("76.629100"),
        "contact_phone": "+91-821-241-0404",
        "operating_hours": "07:00 – 23:00",
        "support_services": ["Indoor seating", "Store supervisor desk", "Phone charging"],
        "availability": PartnerAvailability.Status.AVAILABLE,
        "status_note": "Store open and staffed",
    },
    {
        "name": "Demo JSS Hospital Reception — MG Road",
        "category": Partner.Category.HOSPITAL,
        "area": "Agrahara / MG Road",
        "address": "Mahatma Gandhi Road, Mysuru 570004",
        "latitude": Decimal("12.295100"),
        "longitude": Decimal("76.654200"),
        "contact_phone": "+91-821-233-5555",
        "operating_hours": "24/7",
        "support_services": ["24/7 helpdesk", "Women support desk", "Emergency medical care"],
        "availability": PartnerAvailability.Status.AVAILABLE,
        "status_note": "Emergency desk ready",
    },
    {
        "name": "Demo Saraswathipuram 24x7 Pharmacy",
        "category": Partner.Category.PHARMACY,
        "area": "Saraswathipuram",
        "address": "14th Main, Saraswathipuram, Mysuru 570009",
        "latitude": Decimal("12.301600"),
        "longitude": Decimal("76.634700"),
        "contact_phone": "+91-821-254-0909",
        "operating_hours": "24/7",
        "support_services": ["Bright storefront", "Waiting bench", "Charging point"],
        "availability": PartnerAvailability.Status.AVAILABLE,
        "status_note": "Counter open",
    },
    {
        "name": "Demo HPCL Highway Fuel Point — Ring Road",
        "category": Partner.Category.PETROL_STATION,
        "area": "Bogadi Ring Road",
        "address": "Outer Ring Road Junction, Bogadi, Mysuru 570026",
        "latitude": Decimal("12.299500"),
        "longitude": Decimal("76.607800"),
        "contact_phone": "+91-821-259-0707",
        "operating_hours": "24/7",
        "support_services": ["Well-lit station", "Office waiting area", "Phone charging"],
        "availability": PartnerAvailability.Status.BUSY,
        "status_note": "Peak shift; short wait",
    },
    {
        "name": "Demo Southern Star Hotel — Vinoba Road",
        "category": Partner.Category.HOTEL,
        "area": "Lakshmipuram / Vinoba Road",
        "address": "13-14 Vinoba Road, Mysuru 570005",
        "latitude": Decimal("12.309900"),
        "longitude": Decimal("76.643100"),
        "contact_phone": "+91-821-242-6426",
        "operating_hours": "24/7",
        "support_services": ["24/7 concierge", "Safe lounge", "Verified taxi assistance"],
        "availability": PartnerAvailability.Status.AVAILABLE,
        "status_note": "Concierge ready",
    },
]

PENDING_MYSURU_PARTNERS = [
    {
        "name": "Demo Gokulam Corner Books & Cafe",
        "category": Partner.Category.SHOP,
        "area": "Gokulam 3rd Stage",
        "address": "Contour Road, Gokulam 3rd Stage, Mysuru 570002",
        "latitude": Decimal("12.327800"),
        "longitude": Decimal("76.621900"),
        "contact_phone": "+91-821-251-8899",
        "operating_hours": "08:00 – 22:30",
        "support_services": ["Safe indoor seating", "Wi-Fi & charging"],
    },
    {
        "name": "Demo Jayalakshmipuram Wellness Pharmacy",
        "category": Partner.Category.PHARMACY,
        "area": "Jayalakshmipuram",
        "address": "Temple Road, Jayalakshmipuram, Mysuru 570012",
        "latitude": Decimal("12.319500"),
        "longitude": Decimal("76.623800"),
        "contact_phone": "+91-821-241-6677",
        "operating_hours": "07:00 – 23:30",
        "support_services": ["Well-lit counter", "Phone charging"],
    },
]

DEMO_MYSURU_REPORTS = [
    {
        "category": SafetyReport.Category.POOR_LIGHTING,
        "area_label": "Suburban Bus Stand Rear Lane",
        "description": "Demo report: Three streetlights along the rear footpath near the suburban bus stand are unlit after 8 PM.",
        "latitude": Decimal("12.311200"),
        "longitude": Decimal("76.659800"),
        "hours_ago": 14,
        "review_status": SafetyReport.ReviewStatus.UNREVIEWED,
    },
    {
        "category": SafetyReport.Category.ISOLATED_AREA,
        "area_label": "Suburban Bus Stand Rear Lane",
        "description": "Demo report: Isolated stretch behind the bus shelter becomes deserted late at night with broken streetlights.",
        "latitude": Decimal("12.311500"),
        "longitude": Decimal("76.660100"),
        "hours_ago": 38,
        "review_status": SafetyReport.ReviewStatus.UNREVIEWED,
    },
    {
        "category": SafetyReport.Category.HARASSMENT,
        "area_label": "Kukkarahalli Lake South Gate",
        "description": "Demo report: Verbal comments from a group loitering near the unlit lake gate around 7:30 PM.",
        "latitude": Decimal("12.305400"),
        "longitude": Decimal("76.632200"),
        "hours_ago": 26,
        "review_status": SafetyReport.ReviewStatus.REVIEWED,
    },
    {
        "category": SafetyReport.Category.POOR_LIGHTING,
        "area_label": "Kukkarahalli Lake South Gate",
        "description": "Demo report: Dim pathway lamps near the south entrance make evening walks uncomfortable.",
        "latitude": Decimal("12.305800"),
        "longitude": Decimal("76.632600"),
        "hours_ago": 52,
        "review_status": SafetyReport.ReviewStatus.UNREVIEWED,
    },
    {
        "category": SafetyReport.Category.UNSAFE_INFRASTRUCTURE,
        "area_label": "Mysuru Railway Station Foot Overbridge",
        "description": "Demo report: Broken railings and poor lighting on the west side pedestrian ramp near the auto stand.",
        "latitude": Decimal("12.315900"),
        "longitude": Decimal("76.645100"),
        "hours_ago": 70,
        "review_status": SafetyReport.ReviewStatus.UNDER_REVIEW,
    },
    {
        "category": SafetyReport.Category.ISOLATED_AREA,
        "area_label": "Bogadi Ring Road Service Lane",
        "description": "Demo report: Shops close early along the service road and waiting for a cab feels isolated after 9 PM.",
        "latitude": Decimal("12.299100"),
        "longitude": Decimal("76.609400"),
        "hours_ago": 96,
        "review_status": SafetyReport.ReviewStatus.UNREVIEWED,
    },
    {
        "category": SafetyReport.Category.POOR_LIGHTING,
        "area_label": "Kuvempunagar Complex Bus Stop",
        "description": "Demo report: Flickering bus shelter tube light leaves commuters waiting in darkness.",
        "latitude": Decimal("12.288200"),
        "longitude": Decimal("76.630500"),
        "hours_ago": 110,
        "review_status": SafetyReport.ReviewStatus.REVIEWED,
    },
    {
        "category": SafetyReport.Category.HARASSMENT,
        "area_label": "Kalidasa Road Evening Auto Stand",
        "description": "Demo report: Persistent staring and intrusive remarks near the corner auto stand after 8:30 PM.",
        "latitude": Decimal("12.323100"),
        "longitude": Decimal("76.628400"),
        "hours_ago": 140,
        "review_status": SafetyReport.ReviewStatus.UNREVIEWED,
    },
]


class Command(BaseCommand):
    help = "Seed idempotent Mysuru demo data for SafeStop 360 v2."

    def handle(self, *args, **options):
        now = timezone.now()

        # 1. Core demo users
        admin_user, _ = User.objects.get_or_create(
            email="admin@safestop.demo",
            defaults={
                "full_name": "Demo Admin Coordinator",
                "role": User.Role.ADMIN,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        admin_user.role = User.Role.ADMIN
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.set_password("Admin@12345")
        admin_user.save()
        UserProfile.objects.get_or_create(
            user=admin_user, defaults={"city": "Mysuru", "phone": "+91-90000-00001"}
        )

        woman_user, _ = User.objects.get_or_create(
            email="woman@safestop.demo",
            defaults={"full_name": "Meera Nair (Demo)", "role": User.Role.WOMAN},
        )
        woman_user.role = User.Role.WOMAN
        woman_user.set_password("Woman@12345")
        woman_user.save()
        UserProfile.objects.get_or_create(
            user=woman_user,
            defaults={
                "city": "Mysuru",
                "phone": "+91-90000-00002",
                "emergency_note": "Prefer quiet waiting area near reception.",
            },
        )

        partner_user, _ = User.objects.get_or_create(
            email="partner@safestop.demo",
            defaults={"full_name": "Raghavendra Rao (Demo Partner)", "role": User.Role.PARTNER},
        )
        partner_user.role = User.Role.PARTNER
        partner_user.set_password("Partner@12345")
        partner_user.save()
        UserProfile.objects.get_or_create(
            user=partner_user, defaults={"city": "Mysuru", "phone": "+91-90000-00003"}
        )

        # Clean up any legacy Bengaluru demo rows so Mysuru is the clean primary dataset
        Partner.objects.filter(is_demo=True, city="Bengaluru").delete()
        SafetyReport.objects.filter(is_demo=True, city="Bengaluru").delete()

        # 2. 10 Approved Mysuru Demo Partners
        approved_created = 0
        for item in APPROVED_MYSURU_PARTNERS:
            avail_status = item["availability"]
            status_note = item["status_note"]
            partner, created = Partner.objects.update_or_create(
                name=item["name"],
                defaults={
                    "owner": partner_user,
                    "category": item["category"],
                    "area": item["area"],
                    "address": item["address"],
                    "city": "Mysuru",
                    "latitude": item["latitude"],
                    "longitude": item["longitude"],
                    "contact_phone": item["contact_phone"],
                    "operating_hours": item["operating_hours"],
                    "support_services": item["support_services"],
                    "verification_status": Partner.VerificationStatus.APPROVED,
                    "is_demo": True,
                },
            )
            if created:
                approved_created += 1
            PartnerAvailability.objects.update_or_create(
                partner=partner,
                defaults={"status": avail_status, "status_note": status_note},
            )
            if not partner.verifications.exists():
                PartnerVerification.objects.create(
                    partner=partner,
                    reviewed_by=admin_user,
                    status=Partner.VerificationStatus.APPROVED,
                    notes="Demo partner pre-verified for Mysuru showcase.",
                )

        # 3. 2 Pending Mysuru Demo Partners
        pending_created = 0
        for item in PENDING_MYSURU_PARTNERS:
            partner, created = Partner.objects.update_or_create(
                name=item["name"],
                defaults={
                    "owner": partner_user,
                    "category": item["category"],
                    "area": item["area"],
                    "address": item["address"],
                    "city": "Mysuru",
                    "latitude": item["latitude"],
                    "longitude": item["longitude"],
                    "contact_phone": item["contact_phone"],
                    "operating_hours": item["operating_hours"],
                    "support_services": item["support_services"],
                    "verification_status": Partner.VerificationStatus.PENDING,
                    "is_demo": True,
                },
            )
            if created:
                pending_created += 1
            PartnerAvailability.objects.update_or_create(
                partner=partner,
                defaults={
                    "status": PartnerAvailability.Status.OFFLINE,
                    "status_note": "Awaiting administrator verification",
                },
            )

        # 4. 8 Demo Safety Reports around Mysuru
        reports_created = 0
        for rep in DEMO_MYSURU_REPORTS:
            _, created = SafetyReport.objects.get_or_create(
                description=rep["description"],
                defaults={
                    "reporter": woman_user,
                    "category": rep["category"],
                    "area_label": rep["area_label"],
                    "city": "Mysuru",
                    "latitude": rep["latitude"],
                    "longitude": rep["longitude"],
                    "incident_time": now - timedelta(hours=rep["hours_ago"]),
                    "review_status": rep["review_status"],
                    "reviewed_by": admin_user
                    if rep["review_status"] == SafetyReport.ReviewStatus.REVIEWED
                    else None,
                    "reviewed_at": now - timedelta(hours=2)
                    if rep["review_status"] == SafetyReport.ReviewStatus.REVIEWED
                    else None,
                    "is_demo": True,
                },
            )
            if created:
                reports_created += 1

        # 5. 2 Demo Companions (1 approved, 1 pending for admin verification demo)
        comp1_user, _ = User.objects.get_or_create(
            email="companion1@safestop.demo",
            defaults={"full_name": "Kavya Shetty (Demo Companion)", "role": User.Role.WOMAN},
        )
        comp1_user.set_password("Woman@12345")
        comp1_user.save()
        Companion.objects.update_or_create(
            user=comp1_user,
            defaults={
                "display_name": "Demo Companion — Kavya S.",
                "bio": "Postgraduate volunteer supporting evening commutes around Manasagangothri, Saraswathipuram, and Gokulam.",
                "service_areas": ["Saraswathipuram", "Manasagangothri", "Gokulam"],
                "languages": ["Kannada", "English", "Hindi"],
                "verification_status": Companion.VerificationStatus.APPROVED,
                "is_available": True,
                "is_demo": True,
                "verified_by": admin_user,
                "verified_at": now - timedelta(days=3),
            },
        )

        comp2_user, _ = User.objects.get_or_create(
            email="companion2@safestop.demo",
            defaults={"full_name": "Divya Kulkarni (Demo Companion)", "role": User.Role.WOMAN},
        )
        comp2_user.set_password("Woman@12345")
        comp2_user.save()
        Companion.objects.update_or_create(
            user=comp2_user,
            defaults={
                "display_name": "Demo Companion — Divya K.",
                "bio": "Community walk-along volunteer near Kuvempunagar and Railway Station (pending admin review).",
                "service_areas": ["Kuvempunagar", "Mysuru Railway Station", "Vijayanagar"],
                "languages": ["Kannada", "English"],
                "verification_status": Companion.VerificationStatus.PENDING,
                "is_available": False,
                "is_demo": True,
            },
        )

        # 6. Trusted Contacts for woman@safestop.demo
        TrustedContact.objects.get_or_create(
            owner=woman_user,
            phone="+91-98450-11223",
            defaults={
                "name": "Lakshmi Nair (Demo Contact)",
                "relationship": "Mother",
                "email": "lakshmi.demo@safestop.demo",
                "is_primary": True,
            },
        )
        TrustedContact.objects.get_or_create(
            owner=woman_user,
            phone="+91-98450-44556",
            defaults={
                "name": "Sneha Rao (Demo Contact)",
                "relationship": "Hostel Friend",
                "email": "sneha.demo@safestop.demo",
                "is_primary": False,
            },
        )

        # Seed welcome notification & audit log if empty
        if not Notification.objects.filter(recipient=woman_user).exists():
            Notification.objects.create(
                recipient=woman_user,
                title="SafeStop 360 Mysuru Demo Ready",
                body=(
                    "Explore 10 verified demo SafePlaces around Mysuru. Remember: SafeStop 360 "
                    "does not replace official emergency services — call 112 or 181 in emergencies."
                ),
                category=Notification.Category.SYSTEM,
            )

        AuditLog.objects.get_or_create(
            action="DEMO_DATA_SEEDED",
            target_type="SYSTEM",
            target_id="mysuru-v2",
            defaults={
                "actor": admin_user,
                "summary": "Seeded Mysuru demo dataset (10 approved partners, 2 pending, 8 reports, 2 companions)",
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                "SafeStop 360 demo seed complete (Mysuru): "
                f"10 approved partners ({approved_created} new), "
                f"2 pending partners ({pending_created} new), "
                f"8 demo reports ({reports_created} new), "
                "2 demo companions, and demo accounts "
                "(admin@safestop.demo, woman@safestop.demo, partner@safestop.demo)."
            )
        )
