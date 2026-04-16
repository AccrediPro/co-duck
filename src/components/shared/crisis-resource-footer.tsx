import { PhoneCall } from 'lucide-react';

interface CrisisResourceFooterProps {
  compact?: boolean;
}

export function CrisisResourceFooter({ compact = false }: CrisisResourceFooterProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
        <PhoneCall className="h-4 w-4 flex-shrink-0 text-amber-700" />
        <span>
          If you&apos;re in crisis, help is available 24/7:{' '}
          <a
            href="tel:988"
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            Call or text 988
          </a>{' '}
          &middot;{' '}
          <a
            href="sms:741741&body=HOME"
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            Text HOME to 741741
          </a>
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="mb-3 flex items-center gap-2">
        <PhoneCall className="h-5 w-5 text-amber-700" />
        <h3 className="font-semibold text-amber-900">
          If you&apos;re in crisis, help is available 24/7
        </h3>
      </div>
      <ul className="space-y-1.5 text-sm text-amber-900">
        <li>
          <a
            href="tel:988"
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            988
          </a>{' '}
          — Suicide &amp; Crisis Lifeline (call or text)
        </li>
        <li>
          <span className="font-semibold">Crisis Text Line</span> — Text{' '}
          <a
            href="sms:741741&body=HOME"
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            HOME to 741741
          </a>
        </li>
        <li>
          <a
            href="tel:18006786673"
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            1-800-RUNAWAY
          </a>{' '}
          — National Runaway Safeline
        </li>
      </ul>
    </div>
  );
}
