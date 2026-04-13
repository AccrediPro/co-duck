'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, User } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';

interface ProfileData {
  name: string;
  bio: string;
  dateOfBirth: string;
  city: string;
  occupation: string;
  goals: string;
}

const EMPTY_PROFILE: ProfileData = {
  name: '',
  bio: '',
  dateOfBirth: '',
  city: '',
  occupation: '',
  goals: '',
};

export function ClientProfileForm() {
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [initial, setInitial] = useState<ProfileData>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/users/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const loaded: ProfileData = {
            name: data.data.name || '',
            bio: data.data.bio || '',
            dateOfBirth: data.data.dateOfBirth || '',
            city: data.data.city || '',
            occupation: data.data.occupation || '',
            goals: data.data.goals || '',
          };
          setProfile(loaded);
          setInitial(loaded);
        }
      })
      .catch(() => {
        toast({
          title: 'Error',
          description: 'Failed to load profile',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasChanges =
    profile.name !== initial.name ||
    profile.bio !== initial.bio ||
    profile.dateOfBirth !== initial.dateOfBirth ||
    profile.city !== initial.city ||
    profile.occupation !== initial.occupation ||
    profile.goals !== initial.goals;

  const handleChange = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/users/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
        });

        const data = await res.json();

        if (data.success) {
          const updated: ProfileData = {
            name: data.data.name || '',
            bio: data.data.bio || '',
            dateOfBirth: data.data.dateOfBirth || '',
            city: data.data.city || '',
            occupation: data.data.occupation || '',
            goals: data.data.goals || '',
          };
          setProfile(updated);
          setInitial(updated);
          toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
        } else {
          toast({
            title: 'Error',
            description: data.error?.message || 'Failed to update profile',
            variant: 'destructive',
          });
        }
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to update profile',
          variant: 'destructive',
        });
      }
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            My Profile
          </CardTitle>
          <CardDescription>Manage your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading profile...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          My Profile
        </CardTitle>
        <CardDescription>Manage your personal information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="client-name">Name</Label>
          <Input
            id="client-name"
            value={profile.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Your full name"
            maxLength={100}
            disabled={isPending}
            className="max-w-md"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-bio">Bio</Label>
          <Textarea
            id="client-bio"
            value={profile.bio}
            onChange={(e) => handleChange('bio', e.target.value)}
            placeholder="Tell us a bit about yourself"
            maxLength={2000}
            disabled={isPending}
            className="max-w-md"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Date of Birth</Label>
          <DatePicker
            value={profile.dateOfBirth ? new Date(profile.dateOfBirth) : undefined}
            onChange={(date) => handleChange('dateOfBirth', date ? date.toISOString() : '')}
            placeholder="Select date of birth"
            disabled={isPending}
            className="max-w-md"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-city">City</Label>
          <Input
            id="client-city"
            value={profile.city}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="Your city"
            maxLength={100}
            disabled={isPending}
            className="max-w-md"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-occupation">Occupation</Label>
          <Input
            id="client-occupation"
            value={profile.occupation}
            onChange={(e) => handleChange('occupation', e.target.value)}
            placeholder="Your occupation"
            maxLength={100}
            disabled={isPending}
            className="max-w-md"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-goals">Goals</Label>
          <Textarea
            id="client-goals"
            value={profile.goals}
            onChange={(e) => handleChange('goals', e.target.value)}
            placeholder="What are your coaching goals?"
            maxLength={2000}
            disabled={isPending}
            className="max-w-md"
            rows={3}
          />
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={!hasChanges || isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
