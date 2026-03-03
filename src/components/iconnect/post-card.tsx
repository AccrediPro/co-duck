'use client';

import {
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDateShort, formatTime } from '@/lib/date-utils';
import { useToast } from '@/hooks/use-toast';
import {
  CheckSquare,
  Image as ImageIcon,
  ImageOff,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
} from 'lucide-react';
import type { FeedPost, FeedTaskItem } from './feed-view';

const CONTENT_COLLAPSE_THRESHOLD = 300;

export interface PostComment {
  id: number;
  postId: number;
  senderUserId: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
}

export interface PostCardRef {
  addComment: (comment: PostComment) => void;
  removeComment: (commentId: number) => void;
}

interface PostCardProps {
  post: FeedPost;
  currentUserId: string;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) {
    return `Yesterday at ${formatTime(d)}`;
  }
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateShort(d);
}

function PostTypeIcon({ type }: { type: string }) {
  if (type === 'task') return <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />;
  if (type === 'image') return <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />;
  return null;
}

export const PostCard = forwardRef<PostCardRef, PostCardProps>(
  function PostCard({ post, currentUserId }, ref) {
    const isOwnPost = post.sender?.id === currentUserId;
    const [expanded, setExpanded] = useState(false);
    const [imageBroken, setImageBroken] = useState(false);

    // Comments state
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [comments, setComments] = useState<PostComment[]>([]);
    const [commentCount, setCommentCount] = useState(0);
    const [commentsLoaded, setCommentsLoaded] = useState(false);
    const [commentsLoading, setCommentsLoading] = useState(false);

    // Expose addComment/removeComment for Q4 real-time integration
    useImperativeHandle(ref, () => ({
      addComment: (comment: PostComment) => {
        setComments((prev) => {
          if (prev.some((c) => c.id === comment.id)) return prev;
          return [...prev, comment];
        });
        setCommentCount((c) => c + 1);
      },
      removeComment: (commentId: number) => {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentCount((c) => Math.max(0, c - 1));
      },
    }));

    const fetchComments = useCallback(async () => {
      if (commentsLoaded || commentsLoading) return;
      setCommentsLoading(true);
      try {
        const res = await fetch(`/api/iconnect/posts/${post.id}/comments`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        if (json.success && json.data) {
          setComments(json.data.comments);
          setCommentCount(json.data.comments.length);
          setCommentsLoaded(true);
        }
      } catch {
        // Will show empty — user can try toggling again
      } finally {
        setCommentsLoading(false);
      }
    }, [commentsLoaded, commentsLoading, post.id]);

    const handleToggleComments = useCallback(() => {
      const opening = !commentsOpen;
      setCommentsOpen(opening);
      if (opening && !commentsLoaded) {
        fetchComments();
      }
    }, [commentsOpen, commentsLoaded, fetchComments]);

    const handleCommentAdded = useCallback((comment: PostComment) => {
      setComments((prev) => [...prev, comment]);
      setCommentCount((c) => c + 1);
    }, []);

    const handleCommentDeleted = useCallback((commentId: number) => {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentCount((c) => Math.max(0, c - 1));
    }, []);

    const isLongContent =
      post.content != null && post.content.length > CONTENT_COLLAPSE_THRESHOLD;
    const displayContent =
      post.content && isLongContent && !expanded
        ? post.content.slice(0, CONTENT_COLLAPSE_THRESHOLD).trimEnd() + '\u2026'
        : post.content;

    return (
      <Card
        className={cn(
          'overflow-hidden transition-colors',
          isOwnPost ? 'bg-primary/[0.03] border-primary/10' : 'bg-card'
        )}
      >
        <div className="p-3 sm:p-4">
          {/* Header: avatar + name + timestamp */}
          <div className="flex items-center gap-2 sm:gap-3 mb-3">
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarImage src={post.sender?.avatarUrl || undefined} />
              <AvatarFallback className="text-xs">
                {getInitials(post.sender?.name || null)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {post.sender?.name || 'Unknown'}
                </span>
                <PostTypeIcon type={post.type} />
              </div>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(post.createdAt)}
              </span>
            </div>
          </div>

          {/* Content */}
          {displayContent && (
            <div className="mb-3">
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {displayContent}
              </p>
              {isLongContent && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 text-sm font-medium text-primary hover:underline"
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          {/* Image */}
          {post.type === 'image' && post.imageUrl && (
            <div className="mb-3 overflow-hidden rounded-lg">
              {imageBroken ? (
                <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg py-12 text-muted-foreground">
                  <ImageOff className="h-8 w-8 mb-2" />
                  <span className="text-sm">Image could not be loaded</span>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={post.imageUrl}
                  alt="Post image"
                  className="max-h-96 w-full object-contain bg-muted/30 rounded-lg"
                  loading="lazy"
                  onError={() => setImageBroken(true)}
                />
              )}
            </div>
          )}

          {/* Task items */}
          {post.type === 'task' && post.taskItems && post.taskItems.length > 0 && (
            <TaskChecklist items={post.taskItems} />
          )}
        </div>

        {/* Comments toggle + section */}
        <div className="border-t border-border/50">
          <button
            onClick={handleToggleComments}
            className="flex items-center gap-1.5 w-full px-3 sm:px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors min-h-[44px]"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {commentCount > 0
              ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}`
              : 'Add a comment'}
          </button>

          {commentsOpen && (
            <div className="px-3 sm:px-4 pb-3 sm:pb-4">
              {commentsLoading ? (
                <CommentsSkeleton />
              ) : (
                <>
                  {comments.length > 0 && (
                    <div className="space-y-3 mb-3">
                      {comments.map((comment) => (
                        <CommentItem
                          key={comment.id}
                          comment={comment}
                          currentUserId={currentUserId}
                          onDeleted={handleCommentDeleted}
                        />
                      ))}
                    </div>
                  )}
                  <CommentForm
                    postId={post.id}
                    onCommentAdded={handleCommentAdded}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  }
);

function CommentItem({
  comment,
  currentUserId,
  onDeleted,
}: {
  comment: PostComment;
  currentUserId: string;
  onDeleted: (id: number) => void;
}) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const isOwn = comment.senderUserId === currentUserId;

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);

    // Optimistic: remove immediately
    onDeleted(comment.id);

    try {
      const res = await fetch(`/api/iconnect/comments/${comment.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
    } catch {
      // Rollback not possible cleanly without parent re-fetch.
      // The comment is already removed from UI. Show error toast.
      toast({
        variant: 'destructive',
        title: 'Failed to delete comment',
        description: 'Please refresh to see the current state.',
      });
    } finally {
      setDeleting(false);
    }
  }, [deleting, comment.id, onDeleted, toast]);

  return (
    <div className="group flex gap-2">
      <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
        <AvatarImage src={comment.sender?.avatarUrl || undefined} />
        <AvatarFallback className="text-[10px]">
          {getInitials(comment.sender?.name || null)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium truncate">
            {comment.sender?.name || 'Unknown'}
          </span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(comment.createdAt)}
          </span>
          {isOwn && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ml-auto p-1 text-muted-foreground hover:text-destructive min-h-[24px] min-w-[24px] flex items-center justify-center"
              aria-label="Delete comment"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        <p className="text-sm leading-relaxed break-words">{comment.content}</p>
      </div>
    </div>
  );
}

function CommentForm({
  postId,
  onCommentAdded,
}: {
  postId: number;
  onCommentAdded: (comment: PostComment) => void;
}) {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setContent('');
    setSubmitting(true);

    try {
      const res = await fetch(`/api/iconnect/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) throw new Error('Failed to post');

      const json = await res.json();
      if (json.success && json.data?.comment) {
        onCommentAdded(json.data.comment);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to post comment',
        description: 'Please try again.',
      });
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }, [content, submitting, postId, onCommentAdded, toast]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex items-center gap-2">
      <Input
        ref={inputRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write a comment..."
        disabled={submitting}
        className="flex-1 h-9 text-sm"
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={handleSubmit}
        disabled={!content.trim() || submitting}
        className="h-9 w-9 shrink-0"
        aria-label="Post comment"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

function CommentsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="flex gap-2">
          <Skeleton className="h-6 w-6 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskChecklist({ items }: { items: FeedTaskItem[] }) {
  return (
    <div className="space-y-2 rounded-lg bg-muted/30 p-3">
      {items.map((item) => (
        <TaskChecklistItem key={item.id} item={item} />
      ))}
    </div>
  );
}

function TaskChecklistItem({ item }: { item: FeedTaskItem }) {
  const { toast } = useToast();
  const [completed, setCompleted] = useState(item.completed);
  const [toggling, setToggling] = useState(false);
  const lastToggleRef = useRef(0);

  const handleToggle = useCallback(async () => {
    // Debounce: ignore clicks within 500ms of last toggle
    const now = Date.now();
    if (now - lastToggleRef.current < 500) return;
    lastToggleRef.current = now;

    if (toggling) return;

    const prev = completed;
    setCompleted(!prev);
    setToggling(true);

    try {
      const res = await fetch(`/api/iconnect/tasks/${item.id}/toggle`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        setCompleted(prev);
        toast({
          variant: 'destructive',
          title: 'Failed to update task',
          description: 'Please try again.',
        });
      }
    } catch {
      setCompleted(prev);
      toast({
        variant: 'destructive',
        title: 'Failed to update task',
        description: 'Please try again.',
      });
    } finally {
      setToggling(false);
    }
  }, [toggling, completed, item.id, toast]);

  return (
    <label
      className={cn(
        'flex items-center gap-2.5 cursor-pointer group min-h-[44px] py-1',
        toggling && 'opacity-70'
      )}
    >
      <div className="relative shrink-0">
        <Checkbox
          checked={completed}
          onCheckedChange={handleToggle}
          disabled={toggling}
          className="h-5 w-5"
        />
        {toggling && (
          <Loader2 className="absolute inset-0 h-5 w-5 animate-spin text-primary" />
        )}
      </div>
      <span
        className={cn(
          'text-sm leading-snug break-words min-w-0',
          completed && 'line-through text-muted-foreground'
        )}
      >
        {item.label}
      </span>
    </label>
  );
}
