'use client';

import { Button } from '@/components/ui/button';
import { List, Folder } from 'lucide-react';

export type GroupViewMode = 'all' | 'by-group';

interface GroupToggleProps {
  mode: GroupViewMode;
  onChange: (mode: GroupViewMode) => void;
}

export function GroupToggle({ mode, onChange }: GroupToggleProps) {
  return (
    <div className="flex items-center rounded-md border bg-background p-0.5">
      <Button
        variant={mode === 'all' ? 'default' : 'ghost'}
        size="sm"
        className={`h-7 gap-1.5 px-3 text-xs ${
          mode === 'all'
            ? 'bg-burgundy text-white hover:bg-burgundy-light'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => onChange('all')}
      >
        <List className="h-3.5 w-3.5" />
        All
      </Button>
      <Button
        variant={mode === 'by-group' ? 'default' : 'ghost'}
        size="sm"
        className={`h-7 gap-1.5 px-3 text-xs ${
          mode === 'by-group'
            ? 'bg-burgundy text-white hover:bg-burgundy-light'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => onChange('by-group')}
      >
        <Folder className="h-3.5 w-3.5" />
        By Group
      </Button>
    </div>
  );
}
