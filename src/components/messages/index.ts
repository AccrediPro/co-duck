/**
 * @fileoverview Messaging system UI components.
 *
 * This module exports all components for the coaching platform's messaging feature,
 * including conversation lists, chat views, and message composition.
 *
 * ## Component Overview
 *
 * ### Conversation List Components
 * - `ConversationsList` - Full inbox view with search
 * - `ConversationRow` - Individual conversation preview item
 *
 * ### Chat View Components
 * - `ChatView` - Main chat interface with message history and input
 * - `MessageBubble` - Individual message display (text or system)
 * - `MessageInput` - Auto-resizing text input with send button
 * - `ChatContextPanel` - Coach-only sidebar with client context
 *
 * ### Integration Components
 * - `MessageButton` - "Message Coach" button for profile pages
 *
 * ## Usage Patterns
 *
 * Server components fetch data, client components handle interaction:
 *
 * ```tsx
 * // In page.tsx (server component)
 * const { conversations } = await getConversations();
 * return <ConversationsList initialConversations={conversations} />;
 * ```
 *
 * @module components/messages
 */

export { ConversationRow } from './conversation-row';
export { ConversationsList } from './conversations-list';
export { MessageBubble } from './message-bubble';
export { MessageInput } from './message-input';
export { ChatView } from './chat-view';
export { MessageButton } from './message-button';
export { ChatContextPanel } from './chat-context-panel';
