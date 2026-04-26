import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

const TIPS = [
  "Start each session with a brief check-in to understand your client's current state of mind.",
  'Use open-ended questions to encourage deeper reflection from your clients.',
  'End sessions with clear action items so clients know exactly what to focus on.',
  'Keep detailed session notes — they help you track progress across sessions.',
  'Set up your weekly availability to make it easy for clients to book sessions.',
  'Respond to messages within 24 hours to build trust and rapport with your clients.',
  'Celebrate small wins with your clients — progress is progress, no matter the size.',
  'Use the action items feature to hold clients accountable between sessions.',
  'Update your profile regularly to reflect new specialties or certifications.',
  'Ask for reviews after successful sessions — social proof helps attract new clients.',
  "Block off time for self-care on your calendar — you can't pour from an empty cup.",
  'Review your session notes before each meeting to pick up where you left off.',
  'Consider offering a discovery session to help new clients feel comfortable.',
  'Set clear boundaries around communication hours to maintain work-life balance.',
  'Track your revenue trends monthly to understand your business growth.',
  'Personalize your approach — what works for one client may not work for another.',
  'Stay curious and keep learning — the best coaches are lifelong students.',
  'Use silence strategically in sessions — give clients space to think and process.',
  'Create a warm, welcoming profile bio that speaks directly to your ideal client.',
  'Follow up on action items at the start of each session to show you care.',
];

export function DailyTip() {
  const today = new Date().getDate();
  const tip = TIPS[today % TIPS.length];

  return (
    <Card className="border-gold/20 bg-gold/5">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15">
          <Lightbulb className="h-4 w-4 text-gold-dark" />
        </div>
        <div>
          <p className="text-xs font-medium text-gold-dark">Tip of the Day</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{tip}</p>
        </div>
      </CardContent>
    </Card>
  );
}
