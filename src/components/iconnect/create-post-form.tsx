'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, ImagePlus, X, Plus, ListChecks, Type } from 'lucide-react';
import type { FeedPost } from './feed-view';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_TASK_ITEMS = 10;

interface CreatePostFormProps {
  conversationId: number;
  onPostCreated: (post: FeedPost) => void;
}

export function CreatePostForm({ conversationId, onPostCreated }: CreatePostFormProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'task'>('text');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Text mode state
  const [textContent, setTextContent] = useState('');

  // Image mode state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Task mode state
  const [taskDescription, setTaskDescription] = useState('');
  const [taskItems, setTaskItems] = useState<string[]>(['']);

  const resetForm = useCallback(() => {
    setTextContent('');
    setImageFile(null);
    setImagePreview(null);
    setImageCaption('');
    setImageUploadError(null);
    setTaskDescription('');
    setTaskItems(['']);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: 'Please upload a JPG, PNG, or WebP image.',
        });
        return;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: 'Image must be under 5MB.',
        });
        return;
      }

      setImageFile(file);
      setImageUploadError(null);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    },
    [toast]
  );

  const removeImage = useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [imagePreview]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: 'Please upload a JPG, PNG, or WebP image.',
        });
        return;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: 'Image must be under 5MB.',
        });
        return;
      }

      setImageFile(file);
      setImageUploadError(null);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    },
    [toast]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const addTaskItem = useCallback(() => {
    if (taskItems.length >= MAX_TASK_ITEMS) return;
    setTaskItems((prev) => [...prev, '']);
  }, [taskItems.length]);

  const removeTaskItem = useCallback(
    (index: number) => {
      if (taskItems.length <= 1) return;
      setTaskItems((prev) => prev.filter((_, i) => i !== index));
    },
    [taskItems.length]
  );

  const updateTaskItem = useCallback((index: number, value: string) => {
    setTaskItems((prev) => prev.map((item, i) => (i === index ? value : item)));
  }, []);

  const canSubmit = useCallback(() => {
    if (isSubmitting) return false;
    switch (activeTab) {
      case 'text':
        return textContent.trim().length > 0;
      case 'image':
        return imageFile !== null;
      case 'task':
        return taskItems.some((item) => item.trim().length > 0);
      default:
        return false;
    }
  }, [isSubmitting, activeTab, textContent, imageFile, taskItems]);

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    setIsSubmitting(true);

    try {
      let body: Record<string, unknown>;

      if (activeTab === 'text') {
        body = {
          conversationId,
          type: 'text',
          content: textContent.trim(),
        };
      } else if (activeTab === 'image') {
        // Upload image first
        setImageUploadError(null);
        const formData = new FormData();
        formData.append('file', imageFile!);

        let uploadJson;
        try {
          const uploadRes = await fetch('/api/upload/iconnect', {
            method: 'POST',
            body: formData,
          });
          uploadJson = await uploadRes.json();
          if (!uploadRes.ok || !uploadJson.success) {
            const msg = uploadJson.error?.message || 'Upload failed. Try again.';
            setImageUploadError(msg);
            throw new Error(msg);
          }
        } catch (uploadErr) {
          if (!imageUploadError) {
            setImageUploadError('Upload failed. Try again.');
          }
          throw uploadErr;
        }

        body = {
          conversationId,
          type: 'image',
          imageUrl: uploadJson.data.url,
          content: imageCaption.trim() || undefined,
        };
      } else {
        // Task
        const validItems = taskItems
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .map((label) => ({ label }));

        if (validItems.length === 0) {
          throw new Error('At least one task item is required');
        }

        body = {
          conversationId,
          type: 'task',
          content: taskDescription.trim() || undefined,
          taskItems: validItems,
        };
      }

      const res = await fetch('/api/iconnect/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to create post');
      }

      onPostCreated(json.data.post as FeedPost);
      resetForm();
      toast({ title: 'Post created' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="px-3 pb-3 pt-4 sm:px-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'text' | 'image' | 'task')}>
          <TabsList className="mb-3 w-full">
            <TabsTrigger value="text" className="flex-1 gap-1.5">
              <Type className="h-4 w-4" />
              Text
            </TabsTrigger>
            <TabsTrigger value="image" className="flex-1 gap-1.5">
              <ImagePlus className="h-4 w-4" />
              Image
            </TabsTrigger>
            <TabsTrigger value="task" className="flex-1 gap-1.5">
              <ListChecks className="h-4 w-4" />
              Task
            </TabsTrigger>
          </TabsList>

          {/* Text tab */}
          <TabsContent value="text">
            <Textarea
              placeholder="Share an update..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[80px] resize-none"
              maxLength={5000}
              disabled={isSubmitting}
            />
          </TabsContent>

          {/* Image tab */}
          <TabsContent value="image">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageSelect}
              disabled={isSubmitting}
            />

            {imagePreview ? (
              <div className="relative mb-3">
                <div className="relative overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-64 w-full bg-muted object-contain"
                  />
                  {isSubmitting && activeTab === 'image' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <div className="flex items-center gap-2 rounded-md bg-background/90 px-3 py-2 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm font-medium">Uploading...</span>
                      </div>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute right-2 top-2 h-7 w-7"
                    onClick={removeImage}
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove image</span>
                  </Button>
                </div>
                {imageUploadError && (
                  <p className="mt-1.5 text-sm text-destructive">{imageUploadError}</p>
                )}
                <Textarea
                  placeholder="Add a caption (optional)"
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="mt-2 min-h-[60px] resize-none"
                  maxLength={5000}
                  disabled={isSubmitting}
                />
              </div>
            ) : (
              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 px-4 py-8 transition-colors hover:border-muted-foreground/50 hover:bg-muted"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Click or drag an image</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  JPG, PNG, WebP &middot; Max 5MB
                </p>
              </div>
            )}
          </TabsContent>

          {/* Task tab */}
          <TabsContent value="task">
            <Textarea
              placeholder="Task description (optional)"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="mb-3 min-h-[60px] resize-none"
              maxLength={5000}
              disabled={isSubmitting}
            />

            <div className="space-y-2">
              {taskItems.map((item, index) => (
                <div key={index} className="flex min-w-0 items-center gap-2">
                  <Input
                    placeholder={`Item ${index + 1}`}
                    value={item}
                    onChange={(e) => updateTaskItem(index, e.target.value)}
                    maxLength={500}
                    disabled={isSubmitting}
                    className="min-w-0 flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (index === taskItems.length - 1 && taskItems.length < MAX_TASK_ITEMS) {
                          addTaskItem();
                        }
                      }
                    }}
                  />
                  {taskItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeTaskItem(index)}
                      disabled={isSubmitting}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remove item</span>
                    </Button>
                  )}
                </div>
              ))}

              {taskItems.length < MAX_TASK_ITEMS && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={addTaskItem}
                  disabled={isSubmitting}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add item
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Submit */}
          <div className="mt-3 flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit()}
              size="sm"
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Post
                </>
              )}
            </Button>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
