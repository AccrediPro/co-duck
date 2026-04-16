'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PackageIcon, PlusIcon, PencilIcon, TrashIcon } from 'lucide-react';

interface Package {
  id: number;
  title: string;
  description: string | null;
  sessionCount: number;
  sessionDuration: number;
  priceCents: number;
  originalPriceCents: number | null;
  validityDays: number;
  isPublished: boolean;
}

interface PackageFormData {
  title: string;
  description: string;
  sessionCount: number;
  sessionDuration: number;
  priceCents: number;
  originalPriceCents: number | null;
  validityDays: number;
  isPublished: boolean;
}

const DEFAULT_FORM: PackageFormData = {
  title: '',
  description: '',
  sessionCount: 6,
  sessionDuration: 60,
  priceCents: 90000, // $900
  originalPriceCents: null,
  validityDays: 180,
  isPublished: false,
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export default function PackagesDashboardPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PackageFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSlug().then((s) => {
      setSlug(s);
      if (s) fetchPackages(s);
    });
  }, []);

  async function fetchSlug(): Promise<string | null> {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      return data?.data?.coachProfile?.slug ?? null;
    } catch {
      return null;
    }
  }

  async function fetchPackages(coachSlug: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/coaches/${coachSlug}/packages`);
      if (!res.ok) throw new Error('Failed to load packages');
      const data = await res.json();
      setPackages(data.data ?? []);
    } catch {
      setError('Could not load packages. Please refresh.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setError(null);
    setIsDialogOpen(true);
  }

  function openEdit(pkg: Package) {
    setEditingId(pkg.id);
    setForm({
      title: pkg.title,
      description: pkg.description ?? '',
      sessionCount: pkg.sessionCount,
      sessionDuration: pkg.sessionDuration,
      priceCents: pkg.priceCents,
      originalPriceCents: pkg.originalPriceCents,
      validityDays: pkg.validityDays,
      isPublished: pkg.isPublished,
    });
    setError(null);
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!slug) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...form,
        priceCents: Math.round(form.priceCents),
        originalPriceCents: form.originalPriceCents ? Math.round(form.originalPriceCents) : null,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/packages/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/coaches/${slug}/packages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? 'Failed to save package.');
        return;
      }

      setIsDialogOpen(false);
      fetchPackages(slug);
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!slug || !confirm('Delete this package? This cannot be undone if there are no active purchases.')) return;
    const res = await fetch(`/api/packages/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error?.message ?? 'Could not delete package.');
      return;
    }
    fetchPackages(slug);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Packages</h1>
          <p className="text-muted-foreground">
            Sell multi-session bundles to your clients at a special rate.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <PlusIcon className="mr-2 h-4 w-4" />
              New Package
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Package' : 'Create Package'}</DialogTitle>
              <DialogDescription>
                Set up a bundle of sessions clients can purchase upfront.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="space-y-1">
                <Label htmlFor="title">Package title</Label>
                <Input
                  id="title"
                  placeholder="e.g. 6-Session Transformation Package"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What's included, who it's for, outcomes..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Sessions</Label>
                  <Input
                    type="number"
                    min={2}
                    max={50}
                    value={form.sessionCount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sessionCount: parseInt(e.target.value) || 2 }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Duration (min)</Label>
                  <Input
                    type="number"
                    min={15}
                    max={180}
                    step={15}
                    value={form.sessionDuration}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sessionDuration: parseInt(e.target.value) || 60 }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Bundle price ($)</Label>
                  <Input
                    type="number"
                    min={1}
                    step={0.01}
                    value={(form.priceCents / 100).toFixed(2)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        priceCents: Math.round(parseFloat(e.target.value) * 100) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Original price ($) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    type="number"
                    min={1}
                    step={0.01}
                    placeholder="for save badge"
                    value={form.originalPriceCents ? (form.originalPriceCents / 100).toFixed(2) : ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        originalPriceCents: e.target.value
                          ? Math.round(parseFloat(e.target.value) * 100)
                          : null,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Validity (days)</Label>
                <Input
                  type="number"
                  min={30}
                  max={730}
                  value={form.validityDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, validityDays: parseInt(e.target.value) || 180 }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Sessions must be used within this many days of purchase.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="isPublished"
                  checked={form.isPublished}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isPublished: v }))}
                />
                <Label htmlFor="isPublished">Publish (visible on your profile)</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create package'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading packages…</div>
      ) : packages.length === 0 ? (
        <Card className="py-12 text-center">
          <PackageIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No packages yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first bundle to start selling multi-session packages.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{pkg.title}</CardTitle>
                  <Badge variant={pkg.isPublished ? 'default' : 'secondary'}>
                    {pkg.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                {pkg.description && (
                  <CardDescription className="line-clamp-2">{pkg.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pb-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>
                    <span className="font-medium">{pkg.sessionCount}</span> sessions ×{' '}
                    {pkg.sessionDuration} min
                  </span>
                  <span className="font-semibold text-primary">{formatPrice(pkg.priceCents)}</span>
                  {pkg.originalPriceCents && (
                    <span className="text-muted-foreground line-through">
                      {formatPrice(pkg.originalPriceCents)}
                    </span>
                  )}
                  <span className="text-muted-foreground">Valid {pkg.validityDays} days</span>
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(pkg)}>
                  <PencilIcon className="mr-1 h-3 w-3" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleDelete(pkg.id)}
                >
                  <TrashIcon className="mr-1 h-3 w-3" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
