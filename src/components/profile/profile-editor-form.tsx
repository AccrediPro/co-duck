'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  coachBasicInfoSchema,
  coachBioSpecialtiesSchema,
  sessionTypeSchema,
  SUPPORTED_CURRENCIES,
  SESSION_DURATIONS,
  COACH_SPECIALTIES,
  type SessionTypeFormData,
} from '@/lib/validators/coach-onboarding';
import { getDetectedTimezone, TIMEZONES, isValidTimezone } from '@/lib/timezones';
import { saveProfile, togglePublishProfile } from '@/app/(dashboard)/dashboard/profile/actions';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  X,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Save,
  Camera,
  Upload,
} from 'lucide-react';

const MAX_IMAGE_DIMENSION = 800;
const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500KB

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
          width = MAX_IMAGE_DIMENSION;
        } else {
          width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
          height = MAX_IMAGE_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            if (blob.size > MAX_FILE_SIZE_BYTES && quality > 0.3) {
              quality -= 0.1;
              tryCompress();
              return;
            }

            resolve(blob);
          },
          'image/webp',
          quality
        );
      };

      tryCompress();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

// Combined schema for full profile
const profileEditorSchema = z.object({
  displayName: coachBasicInfoSchema.shape.displayName,
  headline: coachBasicInfoSchema.shape.headline,
  profilePhotoUrl: coachBasicInfoSchema.shape.profilePhotoUrl,
  timezone: coachBasicInfoSchema.shape.timezone,
  bio: coachBioSpecialtiesSchema.shape.bio,
  specialties: coachBioSpecialtiesSchema.shape.specialties,
  hourlyRate: z.number().min(0).optional().nullable(),
  currency: z.string().refine((val) => SUPPORTED_CURRENCIES.some((c) => c.code === val)),
  sessionTypes: z.array(sessionTypeSchema).min(1, 'At least one session type is required'),
});

type ProfileEditorFormData = z.infer<typeof profileEditorSchema>;

interface ProfileEditorFormProps {
  initialData: {
    displayName: string;
    profilePhotoUrl: string;
    headline: string;
    bio: string;
    specialties: string[];
    timezone: string;
    hourlyRate: number | null;
    currency: string;
    sessionTypes: SessionTypeFormData[];
    isPublished: boolean;
    profileCompletionPercentage: number;
    slug: string;
  };
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function ProfileEditorForm({ initialData }: ProfileEditorFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [isPublished, setIsPublished] = useState(initialData.isPublished);
  const [completionPercentage, setCompletionPercentage] = useState(
    initialData.profileCompletionPercentage
  );
  const [currentSlug, setCurrentSlug] = useState(initialData.slug);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect timezone on mount
  const [detectedTimezone, setDetectedTimezone] = useState<string>('America/New_York');

  useEffect(() => {
    const tz = getDetectedTimezone();
    if (isValidTimezone(tz)) {
      setDetectedTimezone(tz);
    }
  }, []);

  const form = useForm<ProfileEditorFormData>({
    resolver: zodResolver(profileEditorSchema),
    defaultValues: {
      displayName: initialData.displayName,
      headline: initialData.headline,
      profilePhotoUrl: initialData.profilePhotoUrl,
      timezone: initialData.timezone || detectedTimezone,
      bio: initialData.bio,
      specialties: initialData.specialties,
      hourlyRate: initialData.hourlyRate,
      currency: initialData.currency,
      sessionTypes:
        initialData.sessionTypes.length > 0
          ? initialData.sessionTypes
          : [{ id: generateSessionId(), name: '', duration: 60, price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'sessionTypes',
  });

  const handlePhotoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: 'Please upload a JPG, PNG, or WebP image.',
        });
        return;
      }

      setIsUploading(true);

      try {
        const compressed = await compressImage(file);

        const formData = new FormData();
        formData.append('file', compressed, 'avatar.webp');

        const response = await fetch('/api/upload/avatar', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Upload failed');
        }

        form.setValue('profilePhotoUrl', result.url, { shouldValidate: true });
        toast({
          title: 'Photo uploaded',
          description: 'Your profile photo has been updated.',
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Upload failed',
          description: error instanceof Error ? error.message : 'Failed to upload photo.',
        });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [form, toast]
  );

  // Watch all form values for live updates
  const watchedDisplayName = form.watch('displayName');
  const watchedHeadline = form.watch('headline');
  const watchedProfilePhotoUrl = form.watch('profilePhotoUrl');
  const watchedTimezone = form.watch('timezone');
  const watchedBio = form.watch('bio');
  const watchedSpecialties = form.watch('specialties');
  const watchedCurrency = form.watch('currency');
  const watchedSessionTypes = form.watch('sessionTypes');
  const bioLength = watchedBio?.length || 0;

  const currencySymbol =
    SUPPORTED_CURRENCIES.find((c) => c.code === watchedCurrency)?.symbol || '$';

  // Calculate live completion percentage
  useEffect(() => {
    let score = 0;

    // Step 1 fields (25%)
    const step1FieldWeight = 25 / 4;
    if (watchedDisplayName && watchedDisplayName.length >= 2) score += step1FieldWeight;
    if (watchedHeadline && watchedHeadline.length >= 10) score += step1FieldWeight;
    if (watchedProfilePhotoUrl) score += step1FieldWeight;
    if (watchedTimezone) score += step1FieldWeight;

    // Step 2 fields (25%)
    const step2FieldWeight = 25 / 2;
    if (watchedBio && watchedBio.length > 0) score += step2FieldWeight;
    if (watchedSpecialties && watchedSpecialties.length > 0) score += step2FieldWeight;

    // Step 3 fields (25%)
    const step3FieldWeight = 25 / 2;
    if (watchedCurrency) score += step3FieldWeight;
    if (watchedSessionTypes && watchedSessionTypes.length > 0) {
      const hasValidSession = watchedSessionTypes.some((st) => st.name && st.name.length > 0);
      if (hasValidSession) score += step3FieldWeight;
    }

    // Editor bonus (25%)
    if (score >= 75) score += 25;

    setCompletionPercentage(Math.round(score));
  }, [
    watchedDisplayName,
    watchedHeadline,
    watchedProfilePhotoUrl,
    watchedTimezone,
    watchedBio,
    watchedSpecialties,
    watchedCurrency,
    watchedSessionTypes,
  ]);

  const toggleSpecialty = (specialty: string) => {
    const currentSpecialties = form.getValues('specialties');
    if (currentSpecialties.includes(specialty)) {
      form.setValue(
        'specialties',
        currentSpecialties.filter((s) => s !== specialty),
        { shouldValidate: true }
      );
    } else {
      form.setValue('specialties', [...currentSpecialties, specialty], { shouldValidate: true });
    }
  };

  const addCustomSpecialty = () => {
    const trimmed = customSpecialty.trim();
    if (trimmed && !watchedSpecialties.includes(trimmed)) {
      form.setValue('specialties', [...watchedSpecialties, trimmed], { shouldValidate: true });
      setCustomSpecialty('');
    }
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomSpecialty();
    }
  };

  const addSessionType = () => {
    append({ id: generateSessionId(), name: '', duration: 60, price: 0 });
  };

  const removeSessionType = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  async function onSubmit(data: ProfileEditorFormData) {
    setIsSubmitting(true);

    try {
      const result = await saveProfile(data);

      if (result.success) {
        setCurrentSlug(result.slug);
        toast({
          title: 'Profile Saved',
          description: 'Your profile has been updated successfully.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTogglePublish() {
    setIsTogglingPublish(true);

    try {
      const newPublishState = !isPublished;
      const result = await togglePublishProfile(newPublishState);

      if (result.success) {
        setIsPublished(result.isPublished);
        toast({
          title: result.isPublished ? 'Profile Published' : 'Profile Unpublished',
          description: result.isPublished
            ? 'Your profile is now visible to clients.'
            : 'Your profile is now hidden from clients.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update publish status.',
      });
    } finally {
      setIsTogglingPublish(false);
    }
  }

  const publicProfileUrl = `/coaches/${currentSlug}`;

  return (
    <div className="space-y-6">
      {/* Profile Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {completionPercentage === 100 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              Profile Completion: {completionPercentage}%
            </span>
            <Badge variant={isPublished ? 'default' : 'secondary'}>
              {isPublished ? 'Published' : 'Draft'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 h-2 w-full rounded-full bg-secondary">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={isPublished}
                onCheckedChange={handleTogglePublish}
                disabled={isTogglingPublish}
              />
              <span className="text-sm">
                {isPublished ? 'Profile is visible to clients' : 'Profile is hidden'}
              </span>
              {isTogglingPublish && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={publicProfileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Preview Profile
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Editor Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Your public profile information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Display Name */}
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
                    </FormControl>
                    <FormDescription>
                      This is how your name will appear on your coach profile.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Headline */}
              <FormField
                control={form.control}
                name="headline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Headline</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Executive Coach helping leaders unlock their potential"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A short tagline that describes what you do ({field.value?.length || 0}/150
                      characters).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Profile Photo Upload */}
              <FormField
                control={form.control}
                name="profilePhotoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Photo</FormLabel>
                    <div className="flex items-center gap-6">
                      <div className="relative group">
                        <div className="h-24 w-24 rounded-full overflow-hidden bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
                          {field.value ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={field.value}
                                alt="Profile preview"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </>
                          ) : (
                            <Camera className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        {isUploading && (
                          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handlePhotoUpload}
                          disabled={isUploading}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              {field.value ? 'Change Photo' : 'Upload Photo'}
                            </>
                          )}
                        </Button>
                        <FormDescription>
                          JPG, PNG, or WebP. Max 800x800px, auto-compressed.
                        </FormDescription>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Timezone */}
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Your timezone for scheduling sessions. Detected: {detectedTimezone}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Bio & Specialties */}
          <Card>
            <CardHeader>
              <CardTitle>Bio & Specialties</CardTitle>
              <CardDescription>Tell potential clients about yourself</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bio */}
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell potential clients about your background, experience, and coaching philosophy..."
                        className="min-h-[200px] resize-y"
                        maxLength={2000}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      <span className={bioLength > 1900 ? 'text-amber-600' : ''}>
                        {bioLength}/2000 characters
                      </span>
                      {bioLength > 1900 && bioLength <= 2000 && ' - approaching limit'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Specialties */}
              <FormField
                control={form.control}
                name="specialties"
                render={() => (
                  <FormItem>
                    <FormLabel>Specialties *</FormLabel>
                    <FormDescription className="mb-3">
                      Select at least one specialty. Click to toggle selection.
                    </FormDescription>

                    {/* Predefined Specialties */}
                    <div className="flex flex-wrap gap-2">
                      {COACH_SPECIALTIES.map((specialty) => {
                        const isSelected = watchedSpecialties.includes(specialty);
                        return (
                          <button
                            key={specialty}
                            type="button"
                            onClick={() => toggleSpecialty(specialty)}
                            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                            }`}
                          >
                            {specialty}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Specialties */}
                    {watchedSpecialties.filter((s) => !COACH_SPECIALTIES.includes(s as never))
                      .length > 0 && (
                      <div className="mt-3">
                        <p className="mb-2 text-sm font-medium text-muted-foreground">
                          Custom Specialties:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {watchedSpecialties
                            .filter((s) => !COACH_SPECIALTIES.includes(s as never))
                            .map((specialty) => (
                              <span
                                key={specialty}
                                className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                              >
                                {specialty}
                                <button
                                  type="button"
                                  onClick={() => toggleSpecialty(specialty)}
                                  className="rounded-full p-0.5 hover:bg-primary-foreground/20"
                                >
                                  <X className="h-3 w-3" />
                                  <span className="sr-only">Remove {specialty}</span>
                                </button>
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Add Custom Specialty */}
                    <div className="mt-4">
                      <p className="mb-2 text-sm font-medium text-muted-foreground">
                        Add a custom specialty:
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g., ADHD Coaching"
                          value={customSpecialty}
                          onChange={(e) => setCustomSpecialty(e.target.value)}
                          onKeyDown={handleCustomKeyDown}
                          className="max-w-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addCustomSpecialty}
                          disabled={!customSpecialty.trim()}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add
                        </Button>
                      </div>
                    </div>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
              <CardDescription>Set your rates and session types</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Currency */}
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SUPPORTED_CURRENCIES.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.symbol} {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Hourly Rate */}
              <FormField
                control={form.control}
                name="hourlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Hourly Rate (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {currencySymbol}
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-8"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            field.onChange(val === '' ? null : parseFloat(val));
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Your base hourly rate for reference. Set specific prices for each session type
                      below.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Session Types */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-medium leading-none">Session Types *</p>
                    <p className="text-sm text-muted-foreground">
                      Define the types of sessions you offer. At least one is required.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addSessionType}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Session
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          Session {index + 1}
                        </span>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSessionType(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove session</span>
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        {/* Session Name */}
                        <FormField
                          control={form.control}
                          name={`sessionTypes.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Discovery Call" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Duration */}
                        <FormField
                          control={form.control}
                          name={`sessionTypes.${index}.duration`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Duration</FormLabel>
                              <Select
                                onValueChange={(val) => field.onChange(parseInt(val))}
                                defaultValue={field.value.toString()}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select duration" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {SESSION_DURATIONS.map((duration) => (
                                    <SelectItem key={duration} value={duration.toString()}>
                                      {duration} minutes
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Price */}
                        <FormField
                          control={form.control}
                          name={`sessionTypes.${index}.price`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Price</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    {currencySymbol}
                                  </span>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="pl-8"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      field.onChange(val === '' ? 0 : parseFloat(val));
                                    }}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </Card>
                ))}

                {form.formState.errors.sessionTypes?.message && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.sessionTypes.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Card>
            <CardContent className="flex justify-end pt-6">
              <Button type="submit" disabled={isSubmitting} size="lg">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Profile
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
