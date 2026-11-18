"""Idempotent command to seed clearly labelled [DEMO] Bengaluru data for local development."""

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import AuditLog, Notification, User, UserProfile
from companions.models import Companion
from journeys.models import TrustedContact
from partners.models import Partner, PartnerAvailability, PartnerVerification
from reports.models import SafetyReport


class Command(BaseCommand):
    help = "Seed clearly labelled [DEMO] Bengaluru accounts, partners, companions, and reports."

    def handle(self, *args, **options):
        admin_user, _ = self._get_or_create_user(
            email="admin@demo.safestop360.local",
            full_name="SafeStop Demo Admin",
            role=User.Role.ADMIN,
            password="DemoAdmin@2026!",
            is_staff=True,
            is_superuser=True,
        )
        woman_user, _ = self._get_or_create_user(
            email="ananya@demo.safestop360.local",
            full_name="Ananya Rao (Demo User)",
            role=User.Role.WOMAN,
            password="DemoWoman@2026!",
        )
        partner_user, _ = self._get_or_create_user(
            email="partner@demo.safestop360.local",
            full_name="Indiranagar SafeStop Coordinator (Demo)",
            role=User.Role.PARTNER,
            password="DemoPartner@2026!",
        )
        pending_partner_user, _ = self._get_or_create_user(
            email="pending.partner@demo.safestop360.local",
            full_name="HSR Community Pharmacy (Demo Applicant)",
            role=User.Role.PARTNER,
            password="DemoPartner@2026!",
        )

        # Clearly labelled [DEMO] Bengaluru Partner Establishments
        demo_partners = [
            {
                "owner": partner_user,
                "name": "[DEMO] Indiranagar 24x7 Care Pharmacy",
                "category": Partner.Category.PHARMACY,
                "description": "Demo establishment for local testing. Offers a well-lit front counter, seating, and phone charging.",
                "address": "100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038",
                "area": "Indiranagar",
                "latitude": Decimal("12.978369"),
                "longitude": Decimal("77.640836"),
                "contact_phone": "+91-80-0000-0101",
                "operating_hours": "24/7",
                "support_services": ["Well-lit waiting space", "Phone charging", "Verified cab pickup wait"],
                "verification_status": Partner.VerificationStatus.APPROVED,
                "availability": PartnerAvailability.Status.AVAILABLE,
            },
            {
                "owner": partner_user,
                "name": "[DEMO] Koramangala Women's Wellness Clinic & ER",
                "category": Partner.Category.HOSPITAL,
                "description": "Demo hospital reception desk for local testing with trained front-desk staff and security.",
                "address": "80 Feet Road, 4th Block, Koramangala, Bengaluru 560034",
                "area": "Koramangala",
                "latitude": Decimal("12.935193"),
                "longitude": Decimal("77.624481"),
                "contact_phone": "+91-80-0000-0102",
                "operating_hours": "24/7",
                "support_services": ["24/7 Reception", "Medical first-aid", "Security personnel on site"],
                "verification_status": Partner.VerificationStatus.APPROVED,
                "availability": PartnerAvailability.Status.AVAILABLE,
            },
            {
                "owner": partner_user,
                "name": "[DEMO] MG Road Central Fuel & Safe Bay",
                "category": Partner.Category.PETROL_STATION,
                "description": "Demo petrol station safe-bay for late-evening transit assistance.",
                "address": "Mahatma Gandhi Road, Craig Park Layout, Bengaluru 560001",
                "area": "MG Road",
                "latitude": Decimal("12.975596"),
                "longitude": Decimal("77.606612"),
                "contact_phone": "+91-80-0000-0103",
                "operating_hours": "05:00 - 01:00",
                "support_services": ["CCTV covered forecourt", "Manager office waiting area", "Emergency call support"],
                "verification_status": Partner.VerificationStatus.APPROVED,
                "availability": PartnerAvailability.Status.AVAILABLE,
            },
            {
                "owner": partner_user,
                "name": "[DEMO] Jayanagar 4th Block Book & Coffee Corner",
                "category": Partner.Category.SHOP,
                "description": "Demo neighborhood shop participating in SafeStop daytime and evening safe-harbor network.",
                "address": "11th Main Road, 4th Block, Jayanagar, Bengaluru 560011",
                "area": "Jayanagar",
                "latitude": Decimal("12.929869"),
                "longitude": Decimal("77.583539"),
                "contact_phone": "+91-80-0000-0104",
                "operating_hours": "08:00 - 22:30",
                "support_services": ["Indoor seating", "Wi-Fi & charging", "Staff assistance"],
                "verification_status": Partner.VerificationStatus.APPROVED,
                "availability": PartnerAvailability.Status.BUSY,
            },
            {
                "owner": partner_user,
                "name": "[DEMO] Malleswaram Heritage Residency Lobby",
                "category": Partner.Category.HOTEL,
                "description": "Demo hotel reception offering a secure, staffed 24-hour lobby.",
                "address": "Sampige Road, Malleswaram, Bengaluru 560003",
                "area": "Malleswaram",
                "latitude": Decimal("13.003110"),
                "longitude": Decimal("77.564320"),
                "contact_phone": "+91-80-0000-0105",
                "operating_hours": "24/7",
                "support_services": ["24/7 Front Desk", "Verified taxi hailing", "CCTV lobby"],
                "verification_status": Partner.VerificationStatus.APPROVED,
                "availability": PartnerAvailability.Status.AVAILABLE,
            },
            {
                "owner": partner_user,
                "name": "[DEMO] Whitefield Tech Campus Security & Student Center",
                "category": Partner.Category.COLLEGE_FACILITY,
                "description": "Demo campus facility gatehouse with trained female security staff.",
                "address": "ITPL Main Road, Whitefield, Bengaluru 560066",
                "area": "Whitefield",
                "latitude": Decimal("12.985042"),
                "longitude": Decimal("77.736410"),
                "contact_phone": "+91-80-0000-0106",
                "operating_hours": "06:00 - 23:00",
                "support_services": ["Campus security desk", "Safe waiting lounge", "Shuttle coordination"],
                "verification_status": Partner.VerificationStatus.APPROVED,
                "availability": PartnerAvailability.Status.AVAILABLE,
            },
            {
                "owner": pending_partner_user,
                "name": "[DEMO] HSR Sector 2 Night Pharmacy (Pending Approval)",
                "category": Partner.Category.PHARMACY,
                "description": "Demo pending establishment submitted for administrator verification testing.",
                "address": "27th Main Road, Sector 2, HSR Layout, Bengaluru 560102",
                "area": "HSR Layout",
                "latitude": Decimal("12.912118"),
                "longitude": Decimal("77.644555"),
                "contact_phone": "+91-80-0000-0107",
                "operating_hours": "24/7",
                "support_services": ["Well-lit counter", "Phone charging"],
                "verification_status": Partner.VerificationStatus.PENDING,
                "availability": PartnerAvailability.Status.OFFLINE,
            },
        ]

        for item in demo_partners:
            avail_status = item.pop("availability")
            partner, created = Partner.objects.get_or_create(
                name=item["name"],
                defaults={**item, "city": "Bengaluru", "is_demo": True},
            )
            PartnerAvailability.objects.get_or_create(
                partner=partner,
                defaults={"status": avail_status, "status_note": "Demo operational status"},
            )
            if created and partner.verification_status == Partner.VerificationStatus.APPROVED:
                PartnerVerification.objects.create(
                    partner=partner,
                    reviewed_by=admin_user,
                    status=Partner.VerificationStatus.APPROVED,
                    notes="Seeded as clearly labelled DEMO establishment for local development.",
                )

        # Demo Trusted Contacts for Woman demo user
        TrustedContact.objects.get_or_create(
            owner=woman_user,
            name="Meera Rao (Demo Contact)",
            defaults={
                "relationship": "Sister",
                "phone": "+91-90000-00001",
                "email": "meera.demo@example.invalid",
                "is_primary": True,
            },
        )
        TrustedContact.objects.get_or_create(
            owner=woman_user,
            name="Kavya Nair (Demo Contact)",
            defaults={
                "relationship": "Close Friend",
                "phone": "+91-90000-00002",
                "email": "kavya.demo@example.invalid",
                "is_primary": False,
            },
        )

        # Demo Companions (2 approved demo companions + 1 pending)
        comp1_user, _ = self._get_or_create_user(
            email="companion.divya@demo.safestop360.local",
            full_name="Divya K (Demo Companion)",
            role=User.Role.WOMAN,
            password="DemoWoman@2026!",
        )
        Companion.objects.get_or_create(
            user=comp1_user,
            defaults={
                "display_name": "[DEMO] Divya K.",
                "bio": "Demo verified walking & metro-commute companion around Indiranagar and MG Road.",
                "service_areas": ["Indiranagar", "MG Road", "Ulsoor"],
                "languages": ["English", "Kannada", "Hindi"],
                "verification_status": Companion.VerificationStatus.APPROVED,
                "is_available": True,
                "is_demo": True,
                "verified_by": admin_user,
                "verified_at": timezone.now(),
            },
        )
        comp2_user, _ = self._get_or_create_user(
            email="companion.sneha@demo.safestop360.local",
            full_name="Sneha M (Demo Companion)",
            role=User.Role.WOMAN,
            password="DemoWoman@2026!",
        )
        Companion.objects.get_or_create(
            user=comp2_user,
            defaults={
                "display_name": "[DEMO] Sneha M.",
                "bio": "Demo verified campus & transit companion serving Koramangala and HSR Layout.",
                "service_areas": ["Koramangala", "HSR Layout", "BTM Layout"],
                "languages": ["English", "Kannada", "Tamil"],
                "verification_status": Companion.VerificationStatus.APPROVED,
                "is_available": True,
                "is_demo": True,
                "verified_by": admin_user,
                "verified_at": timezone.now(),
            },
        )
        comp3_user, _ = self._get_or_create_user(
            email="companion.pending@demo.safestop360.local",
            full_name="Ritu S (Demo Applicant)",
            role=User.Role.WOMAN,
            password="DemoWoman@2026!",
        )
        Companion.objects.get_or_create(
            user=comp3_user,
            defaults={
                "display_name": "[DEMO] Ritu S. (Pending Verification)",
                "bio": "Demo unverified companion application awaiting admin review.",
                "service_areas": ["Jayanagar", "JP Nagar"],
                "languages": ["English", "Hindi"],
                "verification_status": Companion.VerificationStatus.PENDING,
                "is_available": False,
                "is_demo": True,
            },
        )

        # Clearly labelled DEMO Community Safety Reports (for map & AI analysis testing)
        now = timezone.now()
        demo_reports = [
            {
                "category": SafetyReport.Category.POOR_LIGHTING,
                "description": "[DEMO REPORT] Three streetlamps near the Indiranagar metro feeder lane were not functioning after 8 PM.",
                "area_label": "Indiranagar 100ft Feeder Lane (Demo)",
                "latitude": Decimal("12.978900"),
                "longitude": Decimal("77.639500"),
                "incident_time": now - timedelta(hours=18),
                "review_status": SafetyReport.ReviewStatus.REVIEWED,
            },
            {
                "category": SafetyReport.Category.POOR_LIGHTING,
                "description": "[DEMO REPORT] Dark pedestrian stretch beside the Indiranagar metro exit during evening commute.",
                "area_label": "Indiranagar Metro Exit B (Demo)",
                "latitude": Decimal("12.978100"),
                "longitude": Decimal("77.638900"),
                "incident_time": now - timedelta(days=1, hours=3),
                "review_status": SafetyReport.ReviewStatus.UNREVIEWED,
            },
            {
                "category": SafetyReport.Category.ISOLATED_AREA,
                "description": "[DEMO REPORT] Quiet underpass near Koramangala Sony Signal with minimal pedestrian visibility late evening.",
                "area_label": "Koramangala Sony World Junction (Demo)",
                "latitude": Decimal("12.936200"),
                "longitude": Decimal("77.626900"),
                "incident_time": now - timedelta(hours=10),
                "review_status": SafetyReport.ReviewStatus.UNREVIEWED,
            },
            {
                "category": SafetyReport.Category.UNSAFE_INFRASTRUCTURE,
                "description": "[DEMO REPORT] Broken footpath forcing pedestrians onto the main carriageway near Silk Board bus stop.",
                "area_label": "HSR / Silk Board Bus Bay (Demo)",
                "latitude": Decimal("12.917500"),
                "longitude": Decimal("77.623100"),
                "incident_time": now - timedelta(days=2),
                "review_status": SafetyReport.ReviewStatus.UNDER_REVIEW,
            },
        ]
        for rep in demo_reports:
            SafetyReport.objects.get_or_create(
                area_label=rep["area_label"],
                defaults={
                    **rep,
                    "reporter": woman_user,
                    "city": "Bengaluru",
                    "is_demo": True,
                },
            )

        Notification.objects.get_or_create(
            recipient=woman_user,
            title="Welcome to SafeStop 360 (Demo Mode)",
            defaults={
                "body": "All pre-loaded Bengaluru establishments and companions are clearly marked [DEMO] for local demonstration.",
                "category": Notification.Category.SYSTEM,
            },
        )
        AuditLog.objects.get_or_create(
            action="DEMO_SEED_COMPLETED",
            target_type="SYSTEM",
            target_id="bengaluru-demo",
            defaults={
                "actor": admin_user,
                "summary": "Seeded clearly labelled [DEMO] Bengaluru establishments, companions, and safety reports.",
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                "SafeStop 360 [DEMO] Bengaluru data seeded successfully.\n"
                "  Woman demo login:   ananya@demo.safestop360.local / DemoWoman@2026!\n"
                "  Partner demo login: partner@demo.safestop360.local / DemoPartner@2026!\n"
                "  Admin demo login:   admin@demo.safestop360.local / DemoAdmin@2026!"
            )
        )

    def _get_or_create_user(
        self,
        *,
        email: str,
        full_name: str,
        role: str,
        password: str,
        is_staff: bool = False,
        is_superuser: bool = False,
    ):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "full_name": full_name,
                "role": role,
                "is_staff": is_staff,
                "is_superuser": is_superuser,
            },
        )
        if created:
            user.set_password(password)
            user.save()
        UserProfile.objects.get_or_create(user=user, defaults={"city": "Bengaluru"})
        return user, created
