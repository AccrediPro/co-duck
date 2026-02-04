import { Skeleton } from '@/components/ui/skeleton';

export default function ConversationLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:h-screen">
      {/* Chat Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1 h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-8" />
      </div>

      {/* Messages Area */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Other user's message */}
        <div className="flex justify-start">
          <div className="max-w-[70%]">
            <Skeleton className="h-16 w-64 rounded-2xl" />
            <Skeleton className="mt-1 h-3 w-16" />
          </div>
        </div>

        {/* Own message */}
        <div className="flex justify-end">
          <div className="max-w-[70%]">
            <Skeleton className="h-12 w-48 rounded-2xl" />
            <Skeleton className="ml-auto mt-1 h-3 w-16" />
          </div>
        </div>

        {/* Other user's message */}
        <div className="flex justify-start">
          <div className="max-w-[70%]">
            <Skeleton className="h-20 w-72 rounded-2xl" />
            <Skeleton className="mt-1 h-3 w-16" />
          </div>
        </div>

        {/* Own message */}
        <div className="flex justify-end">
          <div className="max-w-[70%]">
            <Skeleton className="h-10 w-40 rounded-2xl" />
            <Skeleton className="ml-auto mt-1 h-3 w-16" />
          </div>
        </div>
      </div>

      {/* Message Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
    </div>
  );
}
