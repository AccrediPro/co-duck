/**
 * @fileoverview Clerk Webhook Handler for User Synchronization
 *
 * This module handles incoming webhooks from Clerk to keep user data
 * synchronized between Clerk's authentication system and our database.
 *
 * @module api/webhooks/clerk
 *
 * ## Webhook Events Handled
 * - `user.created` - New user registration, creates user record
 * - `user.updated` - User profile changes, syncs to database
 * - `user.deleted` - User deletion, removes from database
 *
 * ## Security
 * - Webhooks are verified using Svix signature validation
 * - Requires CLERK_WEBHOOK_SECRET environment variable
 * - All requests without valid Svix headers are rejected
 *
 * ## Configuration
 * Set up webhook endpoint in Clerk Dashboard:
 * 1. Go to Clerk Dashboard > Webhooks
 * 2. Add endpoint: https://your-domain.com/api/webhooks/clerk
 * 3. Subscribe to: user.created, user.updated, user.deleted
 * 4. Copy signing secret to CLERK_WEBHOOK_SECRET env var
 *
 * @see https://clerk.com/docs/integration/webhooks
 */

import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';
import { WelcomeEmail } from '@/lib/emails';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';
import { claimCoachInvite } from '@/lib/claim-invite';

/**
 * Handles incoming Clerk webhook events for user synchronization.
 *
 * This endpoint receives webhook events from Clerk whenever user data changes.
 * It verifies the webhook signature using Svix and then processes the event
 * to keep our database in sync with Clerk's user data.
 *
 * ## Request Flow
 * 1. Extract Svix headers for signature verification
 * 2. Parse request body as JSON
 * 3. Verify signature using Svix library
 * 4. Route to appropriate handler based on event type
 * 5. Return success/error response
 *
 * ## Response Codes
 * - 200: Webhook processed successfully
 * - 400: Missing headers, invalid signature, or missing required data
 * - 500: Database operation failed
 *
 * @param req - The incoming HTTP request from Clerk
 * @returns Response indicating success or failure of webhook processing
 *
 * @example
 * // Clerk sends POST request with JSON body:
 * // {
 * //   "type": "user.created",
 * //   "data": {
 * //     "id": "user_xxx",
 * //     "email_addresses": [{ "email_address": "user@example.com" }],
 * //     "first_name": "John",
 * //     "last_name": "Doe",
 * //     "image_url": "https://..."
 * //   }
 * // }
 */
export async function POST(req: Request) {
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1: Retrieve and validate webhook secret
  // ─────────────────────────────────────────────────────────────────────────────
  // The webhook secret is used to verify that requests are actually from Clerk.
  // Without this, malicious actors could forge webhook calls.
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: Extract Svix headers for signature verification
  // ─────────────────────────────────────────────────────────────────────────────
  // Svix (Clerk's webhook provider) includes these headers for verification:
  // - svix-id: Unique identifier for this webhook delivery
  // - svix-timestamp: Unix timestamp when webhook was sent (prevents replay attacks)
  // - svix-signature: HMAC signature of the payload
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // Reject requests missing any required Svix headers
  // This prevents processing of forged or malformed requests
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occurred -- no svix headers', {
      status: 400,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3: Parse and verify the webhook payload
  // ─────────────────────────────────────────────────────────────────────────────
  // We need to stringify the parsed JSON to ensure consistent formatting
  // for signature verification (Clerk signs the raw JSON string)
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create Svix instance with our secret for verification
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the webhook signature
  // This ensures the request actually came from Clerk and hasn't been tampered with
  // The verify() method checks:
  // 1. Signature matches the HMAC of the payload
  // 2. Timestamp is within acceptable window (prevents replay attacks)
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occurred', {
      status: 400,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4: Route to appropriate event handler
  // ─────────────────────────────────────────────────────────────────────────────
  const eventType = evt.type;

  // ─────────────────────────────────────────────────────────────────────────────
  // Handler: user.created
  // ─────────────────────────────────────────────────────────────────────────────
  // Triggered when a new user signs up through Clerk.
  // Creates a corresponding user record in our database.
  //
  // Note: New users are assigned 'client' role by default.
  // Coach role is assigned through the onboarding flow.
  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    // Extract primary email - Clerk stores emails as an array
    // The first email is typically the primary/verified one
    const email = email_addresses[0]?.email_address;

    // Construct full name from first and last name
    // Filter(Boolean) removes null/undefined values before joining
    const name = [first_name, last_name].filter(Boolean).join(' ') || null;

    // Email is required for user creation - reject if missing
    if (!email) {
      return new Response('No email address found', { status: 400 });
    }

    try {
      // Insert new user record with Clerk's user ID as our primary key
      // This ensures 1:1 mapping between Clerk users and our user records
      await db.insert(users).values({
        id,
        email,
        name,
        avatarUrl: image_url || null,
        role: 'client', // Default role - coaches upgrade via onboarding
      });

      console.log(`User created: ${id}`);

      // Check if this new user has a pending coach invite
      const claimed = await claimCoachInvite(id, email, name);
      if (claimed) {
        console.log(`Coach invite claimed for user: ${id}`);
      }

      // Send welcome email (non-blocking)
      sendEmail({
        to: email,
        subject: 'Welcome to AccrediPro CoachHub!',
        react: WelcomeEmail({
          name: name || 'there',
          unsubscribeUrl: getUnsubscribeUrl(id, 'marketing'),
        }),
      }).catch((err) => {
        console.error('Failed to send welcome email:', err);
      });
    } catch (error) {
      console.error('Error creating user in database:', error);
      return new Response('Error creating user', { status: 500 });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Handler: user.updated
  // ─────────────────────────────────────────────────────────────────────────────
  // Triggered when user updates their profile in Clerk.
  // Syncs email, name, and avatar changes to our database.
  //
  // Note: This does NOT update the role field - role changes are managed
  // internally through the coach onboarding flow, not from Clerk.
  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    const email = email_addresses[0]?.email_address;
    const name = [first_name, last_name].filter(Boolean).join(' ') || null;

    if (!email) {
      return new Response('No email address found', { status: 400 });
    }

    try {
      // Check if user has a custom avatar uploaded to Supabase — preserve it
      const existingUser = await db.query.users.findFirst({ where: eq(users.id, id) });
      const hasCustomAvatar = existingUser?.avatarUrl?.includes('supabase.co/storage');

      // Update user fields that are managed by Clerk
      // We explicitly don't update 'role' here as it's application-managed
      await db
        .update(users)
        .set({
          email,
          name,
          avatarUrl: hasCustomAvatar ? existingUser!.avatarUrl : (image_url || null),
        })
        .where(eq(users.id, id));

      console.log(`User updated: ${id}`);
    } catch (error) {
      console.error('Error updating user in database:', error);
      return new Response('Error updating user', { status: 500 });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Handler: user.deleted
  // ─────────────────────────────────────────────────────────────────────────────
  // Triggered when a user is deleted from Clerk (either by admin or self-deletion).
  // Removes the user record from our database.
  //
  // IMPORTANT: This performs a hard delete. Related data (sessions, bookings, etc.)
  // may be preserved or cascade-deleted depending on database foreign key constraints.
  // Review schema.ts for cascade behavior.
  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    if (!id) {
      return new Response('No user id found', { status: 400 });
    }

    try {
      // Hard delete the user record
      // Foreign key constraints in schema.ts determine cascade behavior
      await db.delete(users).where(eq(users.id, id));
      console.log(`User deleted: ${id}`);
    } catch (error) {
      console.error('Error deleting user from database:', error);
      return new Response('Error deleting user', { status: 500 });
    }
  }

  // Return success for all processed webhooks
  // Note: We return 200 even for unhandled event types to prevent Clerk
  // from retrying (which would create unnecessary load)
  return new Response('Webhook received', { status: 200 });
}
