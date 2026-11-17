import type { db } from "@adapters/db/client";
import { feedItemTranslations } from "@kyomi/db";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { AppError } from "@shared/errors/app";
import { sha256Hex } from "./hash";

type DB = typeof db;

export type FeedItemTranslation = typeof feedItemTranslations.$inferSelect;

type TranslationRequest = {
  feedItemId: string;
  sourceText: string;
  sourceLanguage: string;
  targetLanguage: string;
  modelId: string;
};

function translationIdentity(input: {
  feedItemId: string;
  sourceContentHash: string;
  sourceLanguage: string;
  targetLanguage: string;
  modelId: string;
}) {
  return and(
    eq(feedItemTranslations.feedItemId, input.feedItemId),
    eq(feedItemTranslations.sourceContentHash, input.sourceContentHash),
    eq(feedItemTranslations.sourceLanguage, input.sourceLanguage),
    eq(feedItemTranslations.targetLanguage, input.targetLanguage),
    eq(feedItemTranslations.modelId, input.modelId),
  );
}

export async function findOrQueueFeedItemTranslation(
  database: DB,
  input: TranslationRequest,
): Promise<{ translation: FeedItemTranslation; created: boolean }> {
  const sourceText = input.sourceText.trim();

  if (!sourceText) {
    throw new AppError("No content available to translate", {
      status: 400,
      code: "TRANSLATION_CONTENT_MISSING",
    });
  }

  const sourceContentHash = await sha256Hex(sourceText);

  const existing = await database
    .select()
    .from(feedItemTranslations)
    .where(
      translationIdentity({
        feedItemId: input.feedItemId,
        sourceContentHash,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        modelId: input.modelId,
      }),
    )
    .limit(1);

  if (existing[0]) {
    return { translation: existing[0], created: false };
  }

  const now = new Date();

  const [inserted] = await database
    .insert(feedItemTranslations)
    .values({
      id: crypto.randomUUID(),
      feedItemId: input.feedItemId,
      sourceContentHash,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      sourceText,
      status: "queued",
      provider: "cloudflare",
      modelId: input.modelId,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    return { translation: inserted, created: true };
  }

  // Another request created the exact same translation between our read and insert.
  const raced = await database
    .select()
    .from(feedItemTranslations)
    .where(
      translationIdentity({
        feedItemId: input.feedItemId,
        sourceContentHash,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        modelId: input.modelId,
      }),
    )
    .limit(1);

  if (!raced[0]) {
    throw new AppError("Failed to create translation request", {
      status: 500,
      code: "TRANSLATION_CREATE_FAILED",
    });
  }

  return { translation: raced[0], created: false };
}

export const TRANSLATION_LEASE_MS = 45_000;

export async function claimFeedItemTranslation(
  database: DB,
  translationId: string,
  now = new Date(),
): Promise<{ translation: FeedItemTranslation; leaseToken: string } | null> {
  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + TRANSLATION_LEASE_MS);

  const [translation] = await database
    .update(feedItemTranslations)
    .set({
      status: "processing",
      leaseToken,
      leaseExpiresAt,
      attempts: sql`${feedItemTranslations.attempts} + 1`,
      lastAttemptAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(feedItemTranslations.id, translationId),
        or(
          eq(feedItemTranslations.status, "queued"),
          and(
            eq(feedItemTranslations.status, "processing"),
            lt(feedItemTranslations.leaseExpiresAt, now),
          ),
        ),
      ),
    )
    .returning();

  return translation ? { translation, leaseToken } : null;
}

export async function markFeedItemTranslationReady(
  database: DB,
  input: {
    translationId: string;
    leaseToken: string;
    translatedText: string;
  },
): Promise<boolean> {
  const [updated] = await database
    .update(feedItemTranslations)
    .set({
      status: "ready",
      translatedText: input.translatedText,
      leaseToken: null,
      leaseExpiresAt: null,
      errorCode: null,
      errorMessage: null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(feedItemTranslations.id, input.translationId),
        eq(feedItemTranslations.leaseToken, input.leaseToken),
        eq(feedItemTranslations.status, "processing"),
      ),
    )
    .returning({ id: feedItemTranslations.id });

  return updated !== undefined;
}

export async function requeueFeedItemTranslation(
  database: DB,
  input: {
    translationId: string;
    leaseToken: string;
    errorCode: string;
  },
): Promise<boolean> {
  const [updated] = await database
    .update(feedItemTranslations)
    .set({
      status: "queued",
      leaseToken: null,
      leaseExpiresAt: null,
      errorCode: input.errorCode,
      errorMessage: "Translation will be retried.",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(feedItemTranslations.id, input.translationId),
        eq(feedItemTranslations.leaseToken, input.leaseToken),
        eq(feedItemTranslations.status, "processing"),
      ),
    )
    .returning({ id: feedItemTranslations.id });

  return updated !== undefined;
}

export async function markFeedItemTranslationFailed(
  database: DB,
  input: {
    translationId: string;
    leaseToken: string;
    errorCode: string;
  },
): Promise<boolean> {
  const now = new Date();

  const [updated] = await database
    .update(feedItemTranslations)
    .set({
      status: "failed",
      leaseToken: null,
      leaseExpiresAt: null,
      errorCode: input.errorCode,
      errorMessage: "Translation could not be completed.",
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(feedItemTranslations.id, input.translationId),
        eq(feedItemTranslations.leaseToken, input.leaseToken),
        eq(feedItemTranslations.status, "processing"),
      ),
    )
    .returning({ id: feedItemTranslations.id });

  return updated !== undefined;
}
