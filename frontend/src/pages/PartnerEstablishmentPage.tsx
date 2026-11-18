import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Phone, Clock, Save, PlusCircle } from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import {
  ApiError,
  fetchMyPartners,
  registerPartnerEstablishment,
  updatePartnerEstablishment,
} from '@/services/api';
import type { PartnerCategory, PartnerOwnerItem } from '@/types';

const CATEGORIES: Array<{ value: PartnerCategory; label: string }> = [
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'HOSPITAL', label: 'Hospital / Clinic' },
  { value: 'PETROL_STATION', label: 'Petrol Station' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'COLLEGE_FACILITY', label: 'College Facility' },
  { value: 'OTHER', label: 'Other Approved Establishment' },
];

export function PartnerEstablishmentPage() {
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const [existing, setExisting] = useState<PartnerOwnerItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<PartnerCategory>('PHARMACY');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('Mysuru');
  const [latitude, setLatitude] = useState('12.295800');
  const [longitude, setLongitude] = useState('76.639400');
  const [contactPhone, setContactPhone] = useState('');
  const [operatingHours, setOperatingHours] = useState('24/7');
  const [servicesText, setServicesText] = useState(
    'Well-lit waiting space, Phone charging, Staff assistance'
  );

  const populateForm = (item: PartnerOwnerItem | null) => {
    if (!item) {
      setEditingId(null);
      setName('');
      setCategory('PHARMACY');
      setDescription('');
      setAddress('');
      setArea('');
      setCity('Mysuru');
      setLatitude('12.295800');
      setLongitude('76.639400');
      setContactPhone('');
      setOperatingHours('24/7');
      setServicesText('Well-lit waiting space, Phone charging, Staff assistance');
      return;
    }
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setDescription(item.description || '');
    setAddress(item.address);
    setArea(item.area || '');
    setCity(item.city || 'Bengaluru');
    setLatitude(String(item.latitude));
    setLongitude(String(item.longitude));
    setContactPhone(item.contact_phone);
    setOperatingHours(item.operating_hours || '24/7');
    setServicesText((item.support_services || []).join(', '));
  };

  useEffect(() => {
    fetchMyPartners()
      .then((res) => {
        setExisting(res.results);
        if (res.results.length > 0) {
          populateForm(res.results[0]);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      category,
      description: description.trim(),
      address: address.trim(),
      area: area.trim(),
      city: city.trim() || 'Bengaluru',
      latitude: Number(latitude),
      longitude: Number(longitude),
      contact_phone: contactPhone.trim(),
      operating_hours: operatingHours.trim() || '24/7',
      support_services: servicesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      if (editingId) {
        const updated = await updatePartnerEstablishment(editingId, payload);
        setExisting((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        pushToast({
          tone: 'success',
          title: 'Establishment updated',
          description: `${updated.name} changes have been saved.`,
        });
      } else {
        const created = await registerPartnerEstablishment(payload);
        setExisting((prev) => [created, ...prev]);
        setEditingId(created.id);
        pushToast({
          tone: 'success',
          title: 'Submitted for admin approval',
          description: `${created.name} is now in the administrator verification queue.`,
        });
        navigate('/partner');
      }
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Submission failed',
        description: err instanceof ApiError ? err.message : 'Please verify all fields.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const activeRecord = existing.find((p) => p.id === editingId) || null;

  return (
    <DashboardLayout
      title="Establishment Registration & Details"
      subtitle="Submit a new establishment for administrator verification or keep your approved listing up to date."
    >
      <div className="flex flex-wrap items-center gap-2">
        {existing.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => populateForm(item)}
            className={`neu-chip px-3.5 py-1.5 text-xs font-semibold ${
              editingId === item.id ? 'neu-chip-active' : ''
            }`}
          >
            {item.name} ({item.verification_status})
          </button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => populateForm(null)}
        >
          <PlusCircle className="h-3.5 w-3.5" />
          New Establishment
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card surface="matte" className="p-6 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-charcoal">
              {editingId ? 'Edit Establishment Profile' : 'Register New SafeStop Partner'}
            </h2>
            {activeRecord && (
              <Badge
                tone={
                  activeRecord.verification_status === 'APPROVED'
                    ? 'mint'
                    : activeRecord.verification_status === 'PENDING'
                      ? 'warning'
                      : 'error'
                }
              >
                {activeRecord.verification_status}
              </Badge>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Establishment Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Koramangala 24x7 Care Pharmacy"
                leftIcon={<Building2 className="h-4 w-4" />}
                required
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold tracking-wide text-charcoal">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PartnerCategory)}
                  className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Input
              label="Full Street Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="100 Feet Road, HAL 2nd Stage, Indiranagar"
              leftIcon={<MapPin className="h-4 w-4" />}
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Neighbourhood / Area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Indiranagar"
              />
              <Input
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Bengaluru"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Latitude"
                type="number"
                step="0.000001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
              />
              <Input
                label="Longitude"
                type="number"
                step="0.000001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Front-Desk Contact Phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91-80-0000-0000"
                leftIcon={<Phone className="h-4 w-4" />}
                required
              />
              <Input
                label="Operating Hours"
                value={operatingHours}
                onChange={(e) => setOperatingHours(e.target.value)}
                placeholder="24/7 or 08:00 - 23:00"
                leftIcon={<Clock className="h-4 w-4" />}
                required
              />
            </div>

            <Input
              label="Available Support Services (comma-separated)"
              value={servicesText}
              onChange={(e) => setServicesText(e.target.value)}
              placeholder="Well-lit waiting area, Phone charging, Verified cab wait"
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold tracking-wide text-charcoal">
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your entrance, lighting, seating, and front-desk assistance."
                className="neu-input-pill w-full px-3.5 py-2.5 text-sm text-charcoal focus:outline-none"
              />
            </div>

            <Button type="submit" variant="primary" size="md" disabled={submitting}>
              <Save className="h-4 w-4" />
              {submitting
                ? 'Saving...'
                : editingId
                  ? 'Save Establishment Changes'
                  : 'Submit for Admin Approval'}
            </Button>
          </form>
        </Card>

        <Card surface="matte" className="h-fit space-y-4 p-6 lg:col-span-4">
          <h3 className="font-display text-base font-bold text-charcoal">
            Verification History
          </h3>
          {activeRecord && activeRecord.verifications.length > 0 ? (
            <ul className="space-y-3">
              {activeRecord.verifications.map((v) => (
                <li
                  key={v.id}
                  className="rounded-2xl border border-border-soft bg-warm-white p-3.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <Badge tone={v.status === 'APPROVED' ? 'mint' : 'warning'}>
                      {v.status}
                    </Badge>
                    <span className="text-charcoal-muted">
                      {new Date(v.reviewed_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 font-medium text-charcoal">By: {v.reviewed_by_name}</p>
                  {v.notes && <p className="mt-1 text-charcoal-muted">{v.notes}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs leading-relaxed text-charcoal-muted">
              No administrator review records yet. New registrations start as{' '}
              <strong>PENDING</strong> until verified by a SafeStop 360 administrator.
            </p>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
