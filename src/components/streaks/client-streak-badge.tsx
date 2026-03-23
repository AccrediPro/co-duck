import { cn } from '@/lib/utils';

interface ClientStreakBadgeProps {
  currentStreak: number;
  isAtRisk: boolean;
}

export function ClientStreakBadge({ currentStreak, isAtRisk }: ClientStreakBadgeProps) {
  if (currentStreak === 0 && !isAtRisk) return null;

  const color = isAtRisk
    ? 'text-burgundy'
    : currentStreak >= 4
      ? 'text-sage'
      : 'text-gold-dark';

  return (
    <span
      className={cn('inline-flex items-center gap-0.5 text-xs font-medium', color)}
      title={
        isAtRisk
          ? 'Streak a rischio'
          : `${currentStreak} ${currentStreak === 1 ? 'settimana' : 'settimane'} di streak`
      }
    >
      <span role="img" aria-label="fire" className="text-sm">
        🔥
      </span>
      {currentStreak}
    </span>
  );
}
