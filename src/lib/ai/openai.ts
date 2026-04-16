/**
 * @fileoverview OpenAI Client Singleton (P0-10)
 *
 * Lazy singleton for the OpenAI SDK. Reads OPENAI_API_KEY from env.
 * Throws a clear error when the key is missing so failures surface loudly
 * instead of producing confusing 500s from the SDK.
 *
 * @module lib/ai/openai
 */

import OpenAI from 'openai';

let client: OpenAI | null = null;

/**
 * Returns the shared OpenAI client, instantiating it on first use.
 *
 * @throws {Error} When OPENAI_API_KEY is not set
 */
export function getOpenAI(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. AI Session Notes requires an OpenAI API key.');
  }

  client = new OpenAI({ apiKey });
  return client;
}

/**
 * True when the OpenAI key is configured. Useful for feature gating UI.
 */
export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
