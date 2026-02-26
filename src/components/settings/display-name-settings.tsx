'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { User, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateDisplayName } from '@/app/(dashboard)/dashboard/settings/actions';

interface DisplayNameSettingsProps {
  initialName: string;
}

export function DisplayNameSettings({ initialName }: DisplayNameSettingsProps) {
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const hasChanged = name.trim() !== initialName && name.trim().length > 0;

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateDisplayName(name);

      if (result.success) {
        toast({ title: 'Name updated', description: `Your display name is now "${result.name}"` });
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Display Name
        </CardTitle>
        <CardDescription>This is the name shown to coaches and clients</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="display-name">Name</Label>
          <div className="flex items-center gap-3">
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
              maxLength={100}
              disabled={isPending}
              className="max-w-md"
            />
            <Button onClick={handleSave} disabled={!hasChanged || isPending} size="sm">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
