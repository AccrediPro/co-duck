'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GroupSectionProps {
  groupId: number | null;
  groupName: string;
  memberCount: number;
  children: React.ReactNode;
  onRename?: (groupId: number, currentName: string) => void;
  onDelete?: (groupId: number) => void;
  defaultOpen?: boolean;
}

export function GroupSection({
  groupId,
  groupName,
  memberCount,
  children,
  onRename,
  onDelete,
  defaultOpen = true,
}: GroupSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div className="flex items-center gap-2 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-sm font-semibold"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span>{groupName}</span>
          <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
            {memberCount}
          </span>
        </Button>

        {groupId !== null && (
          <div className="ml-auto flex items-center gap-1">
            {onRename && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => onRename(groupId, groupName)}
                title="Rename group"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(groupId)}
                title="Delete group"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {open && <div className="pl-2">{children}</div>}
    </div>
  );
}
