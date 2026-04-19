import type { ReaderContentDto } from "@lib/api-schemas";

/**
 * Canonical reader body for UI — validated by `readerContentSchema` (see `api-schemas.ts`)
 * and produced server-side as `ArticleReaderContentDto`. Prefer discriminating on `bodyKind`.
 */
export type ReaderContent = ReaderContentDto;
