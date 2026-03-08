export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface ParsePaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

export type ParsePaginationResult =
  | { ok: true; value: PaginationParams }
  | { ok: false; message: string };

export function parsePaginationQuery(
  rawLimit: string | undefined,
  rawOffset: string | undefined,
  options: ParsePaginationOptions = {},
): ParsePaginationResult {
  const defaultLimit = options.defaultLimit ?? 50;
  const maxLimit = options.maxLimit ?? 200;

  const parsedLimit = rawLimit === undefined ? defaultLimit : Number(rawLimit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    return { ok: false, message: '"limit" must be a positive integer.' };
  }

  const parsedOffset = rawOffset === undefined ? 0 : Number(rawOffset);
  if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
    return { ok: false, message: '"offset" must be a non-negative integer.' };
  }

  return {
    ok: true,
    value: {
      limit: Math.min(parsedLimit, maxLimit),
      offset: parsedOffset,
    },
  };
}
