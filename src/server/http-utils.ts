import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

export interface ApiErrorBody {
  code: string;
  message: string;
  request_id: string;
  details?: unknown;
}

export const getRequestId = (req: IncomingMessage): string => {
  const header = req.headers["x-request-id"];
  if (typeof header === "string" && header.length > 0) {
    return header;
  }
  return randomUUID();
};

export const sendJson = (
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  requestId?: string,
  extraHeaders?: Record<string, string>
) => {
  if (requestId) {
    res.setHeader("x-request-id", requestId);
  }
  if (extraHeaders) {
    for (const [name, value] of Object.entries(extraHeaders)) {
      res.setHeader(name, value);
    }
  }
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

export const sendError = (
  res: ServerResponse,
  statusCode: number,
  error: ApiErrorBody
) => {
  sendJson(res, statusCode, { error }, error.request_id);
};

export const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const raw = await readRawBody(req);
  return parseJsonBody(raw);
};

export const readRawBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return "";
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
};

export const parseJsonBody = (raw: string): unknown => {
  if (raw.length === 0) {
    return {};
  }
  return JSON.parse(raw) as unknown;
};
