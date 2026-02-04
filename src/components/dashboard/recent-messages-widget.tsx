import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, ArrowRight } from 'lucide-react';
import type { MessagePreview } from '@/app/(dashboard)/dashboard/actions';

interface RecentMessagesWidgetProps {
  messages: MessagePreview[];
  unreadCount: number;
}

export function RecentMessagesWidget({ messages, unreadCount }: RecentMessagesWidgetProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Messages
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
              {unreadCount}
            </Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/messages">
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <Link
                key={msg.conversationId}
                href={`/dashboard/messages/${msg.conversationId}`}
                className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={msg.otherUserAvatar || undefined} />
                  <AvatarFallback>
                    {msg.otherUserName?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {msg.otherUserName || 'User'}
                    </p>
                    {msg.unreadCount > 0 && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {msg.lastMessageContent || 'No messages'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
