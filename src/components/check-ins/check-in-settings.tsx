'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays } from 'lucide-react';

const DAYS = [
  { value: '1', label: 'Lunedì' },
  { value: '2', label: 'Martedì' },
  { value: '3', label: 'Mercoledì' },
  { value: '4', label: 'Giovedì' },
  { value: '5', label: 'Venerdì' },
  { value: '6', label: 'Sabato' },
  { value: '0', label: 'Domenica' },
] as const;

interface CheckInSettingsProps {
  clientId?: string;
}

export function CheckInSettings({ clientId }: CheckInSettingsProps) {
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState('3'); // default Wednesday
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!clientId) {
      toast({
        title: 'Info',
        description: 'Seleziona un cliente per configurare il giorno del check-in.',
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/check-ins/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          checkInDay: parseInt(selectedDay, 10),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Salvato', description: 'Giorno del check-in aggiornato.' });
      } else {
        toast({
          title: 'Errore',
          description: json.error?.message || 'Impossibile salvare',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Errore', description: 'Errore di rete', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Check-in Settimanale
        </CardTitle>
        <CardDescription>
          Configura il giorno predefinito per i check-in settimanali.
          {!clientId && ' Le impostazioni per singolo cliente sono disponibili nella scheda del cliente.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="checkin-day">Giorno del check-in</Label>
          <Select value={selectedDay} onValueChange={setSelectedDay}>
            <SelectTrigger id="checkin-day" className="w-full sm:w-[240px]">
              <SelectValue placeholder="Seleziona giorno" />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((day) => (
                <SelectItem key={day.value} value={day.value}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {clientId && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-burgundy text-white hover:bg-burgundy-light"
          >
            {saving ? 'Salvataggio...' : 'Salva'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
