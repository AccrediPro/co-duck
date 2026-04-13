'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, LayoutList } from 'lucide-react';
import { PostCard } from './post-card';
import type { PostCardRef, PostComment } from './post-card';
export type { PostCardRef, PostComment } from './post-card';
import { CreatePostForm } from './create-post-form';
import { useSocket } from '@/hooks/useSocket';

export interface FeedTaskItem {
  id: number;
  postId: number;
  label: string;
  completed: boolean;
  completedAt: string | null;
}

export interface FeedPost {
  id: number;
  conversationId: number;
  type: 'text' | 'image' | 'task';
  content: string | null;
  imageUrl: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  taskItems?: FeedTaskItem[];
}

interface OtherUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

interface FeedViewProps {
  initialPosts: FeedPost[];
  initialHasMore: boolean;
  conversationId: number;
  currentUserId: string;
  otherUser: OtherUser;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function FeedView({
  initialPosts,
  initialHasMore,
  conversationId,
  currentUserId,
  otherUser,
}: FeedViewProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  // Mark posts as read on mount
  useEffect(() => {
    fetch('/api/iconnect/posts/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }).catch(() => {
      // Silently ignore — non-critical
    });
  }, [conversationId]);

  const loadOlderPosts = useCallback(async () => {
    if (loadingMore || !hasMore || posts.length === 0) return;

    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const lastPostId = posts[posts.length - 1].id;
      const res = await fetch(
        `/api/iconnect/posts?conversationId=${conversationId}&before=${lastPostId}&limit=20`
      );
      if (!res.ok) {
        setLoadMoreError(true);
        return;
      }

      const json = await res.json();
      if (json.success && json.data) {
        setPosts((prev) => [...prev, ...json.data.posts]);
        setHasMore(json.data.hasMore);
      }
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, posts, conversationId]);

  const prependPost = useCallback((newPost: FeedPost) => {
    setPosts((prev) => [newPost, ...prev]);
  }, []);

  // Socket.io: listen for real-time new posts and comments from the other user
  const { socket } = useSocket();
  const seenPostIds = useRef(new Set<number>());
  const postCardRefs = useRef(new Map<number, PostCardRef>());

  // Track existing post IDs to avoid duplicates
  useEffect(() => {
    seenPostIds.current = new Set(posts.map((p) => p.id));
  }, [posts]);

  useEffect(() => {
    if (!socket) return;

    const handleNewPost = (data: { conversationId: number; post: FeedPost }) => {
      // Only handle posts for THIS conversation
      if (data.conversationId !== conversationId) return;
      // Deduplicate (in case we already added this post ourselves)
      if (seenPostIds.current.has(data.post.id)) return;

      setPosts((prev) => [data.post, ...prev]);

      // Auto-mark as read since the user is viewing this feed
      fetch('/api/iconnect/posts/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      }).catch(() => {
        // Non-critical
      });
    };

    socket.on('iconnect:new_post', handleNewPost);
    return () => {
      socket.off('iconnect:new_post', handleNewPost);
    };
  }, [socket, conversationId]);

  // Socket.io: listen for real-time comment events
  useEffect(() => {
    if (!socket) return;

    const handleNewComment = (data: { comment: PostComment; postId: number }) => {
      const ref = postCardRefs.current.get(data.postId);
      if (ref) {
        ref.addComment(data.comment);
      }
    };

    const handleCommentDeleted = (data: { commentId: number; postId: number }) => {
      const ref = postCardRefs.current.get(data.postId);
      if (ref) {
        ref.removeComment(data.commentId);
      }
    };

    socket.on('iconnect:new_comment', handleNewComment);
    socket.on('iconnect:comment_deleted', handleCommentDeleted);
    return () => {
      socket.off('iconnect:new_comment', handleNewComment);
      socket.off('iconnect:comment_deleted', handleCommentDeleted);
    };
  }, [socket]);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard/iconnect')}
          aria-label="Back to iConnect"
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={otherUser.avatarUrl || undefined} />
          <AvatarFallback className="text-sm">{getInitials(otherUser.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">
            {otherUser.name || 'Unknown User'}
          </h1>
          <p className="text-xs text-muted-foreground">iConnect Feed</p>
        </div>
      </div>

      {/* Create post */}
      <CreatePostForm conversationId={conversationId} onPostCreated={prependPost} />

      {/* Feed */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <LayoutList className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No posts yet</h3>
          <p className="mt-2 max-w-md text-muted-foreground">
            Start the conversation by creating a post!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              ref={(r) => {
                if (r) {
                  postCardRefs.current.set(post.id, r);
                } else {
                  postCardRefs.current.delete(post.id);
                }
              }}
              post={post}
              currentUserId={currentUserId}
            />
          ))}

          {/* Load older */}
          {hasMore && (
            <div className="flex flex-col items-center gap-2 pb-4 pt-2">
              {loadMoreError && <p className="text-sm text-destructive">Failed to load posts.</p>}
              <Button variant="outline" onClick={loadOlderPosts} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : loadMoreError ? (
                  'Retry'
                ) : (
                  'Load older posts'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
