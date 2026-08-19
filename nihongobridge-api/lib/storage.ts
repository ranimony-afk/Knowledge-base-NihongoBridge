import { questions } from "@nihongobridge/knowledge";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";

import { getDatabase } from "@/lib/db";

let client: S3Client | undefined;
let bucketReady: Promise<void> | undefined;

function storageClient(): S3Client {
  if (client) return client;
  const endpoint = process.env.MINIO_ENDPOINT;
  const accessKeyId = process.env.MINIO_ACCESS_KEY;
  const secretAccessKey = process.env.MINIO_SECRET_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("MINIO_ENDPOINT, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY are required");
  }
  client = new S3Client({
    endpoint,
    region: process.env.MINIO_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

function audioBucket(): string {
  return process.env.MINIO_AUDIO_BUCKET ?? "audio";
}

async function ensureAudioBucket(): Promise<void> {
  bucketReady ??= (async () => {
    try {
      await storageClient().send(new HeadBucketCommand({ Bucket: audioBucket() }));
    } catch (error) {
      if (!isNotFound(error)) throw error;
      await storageClient().send(new CreateBucketCommand({ Bucket: audioBucket() }));
    }
    if (process.env.MINIO_PUBLIC_READ !== "false") {
      await storageClient().send(
        new PutBucketPolicyCommand({
          Bucket: audioBucket(),
          Policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: { AWS: ["*"] },
                Action: ["s3:GetObject"],
                Resource: [`arn:aws:s3:::${audioBucket()}/*`],
              },
            ],
          }),
        }),
      );
    }
  })();
  try {
    await bucketReady;
  } catch (error) {
    bucketReady = undefined;
    throw error;
  }
}

export async function uploadAudio(key: string, body: Uint8Array): Promise<string> {
  await ensureAudioBucket();
  await storageClient().send(
    new PutObjectCommand({
      Bucket: audioBucket(),
      Key: key,
      Body: body,
      ContentType: "audio/mpeg",
      CacheControl: "public, max-age=86400",
    }),
  );
  return publicAudioUrl(key);
}

export async function getQuestionAudio(
  questionId: string,
  range?: string | undefined,
): Promise<{
  body: ReadableStream<Uint8Array>;
  status: 200 | 206;
  headers: Record<string, string>;
} | null> {
  const [question] = await getDatabase()
    .select({ audioUrl: questions.audioUrl })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!question?.audioUrl) return null;

  const key = objectKeyFromUrl(question.audioUrl) ?? `questions/${questionId}.mp3`;
  try {
    const object = await storageClient().send(
      new GetObjectCommand({
        Bucket: audioBucket(),
        Key: key,
        ...(range ? { Range: range } : {}),
      }),
    );
    if (!object.Body) throw new Error("Object storage returned no audio body");
    const body = object.Body.transformToWebStream() as ReadableStream<Uint8Array>;
    return {
      body,
      status: object.ContentRange ? 206 : 200,
      headers: {
        "Accept-Ranges": object.AcceptRanges ?? "bytes",
        "Content-Type": object.ContentType ?? "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
        ...(object.ContentLength !== undefined
          ? { "Content-Length": String(object.ContentLength) }
          : {}),
        ...(object.ContentRange ? { "Content-Range": object.ContentRange } : {}),
        ...(object.ETag ? { ETag: object.ETag } : {}),
      },
    };
  } catch (error) {
    if (isInvalidRange(error)) throw new StorageHttpError("Requested audio range is invalid", 416);
    if (!isNotFound(error)) throw error;
  }

  if (!allowedAudioUrl(question.audioUrl)) {
    throw new StorageHttpError("Audio source host is not allowed", 403);
  }
  const upstream = await fetch(question.audioUrl, {
    ...(range ? { headers: { Range: range } } : {}),
    cache: "no-store",
  });
  if (upstream.status === 404) return null;
  if (upstream.status === 416) {
    throw new StorageHttpError("Requested audio range is invalid", 416);
  }
  if (!upstream.ok || !upstream.body) {
    throw new Error(`Upstream audio returned HTTP ${upstream.status}`);
  }
  const headers: Record<string, string> = {
    "Accept-Ranges": upstream.headers.get("accept-ranges") ?? "bytes",
    "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
    "Cache-Control": "public, max-age=86400",
  };
  for (const name of ["content-length", "content-range", "etag"] as const) {
    const value = upstream.headers.get(name);
    if (value) headers[canonicalHeader(name)] = value;
  }
  return {
    body: upstream.body,
    status: upstream.status === 206 ? 206 : 200,
    headers,
  };
}

function publicAudioUrl(key: string): string {
  const endpoint = (
    process.env.MINIO_PUBLIC_URL ??
    process.env.MINIO_ENDPOINT ??
    "http://localhost:9000"
  ).replace(/\/$/, "");
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${endpoint}/${encodeURIComponent(audioBucket())}/${encodedKey}`;
}

function allowedAudioUrl(value: string): boolean {
  try {
    const host = new URL(value).host.toLowerCase();
    const configured = (process.env.AUDIO_PROXY_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    for (const endpoint of [process.env.MINIO_PUBLIC_URL, process.env.MINIO_ENDPOINT]) {
      if (!endpoint) continue;
      configured.push(new URL(endpoint).host.toLowerCase());
    }
    return new Set(configured).has(host);
  } catch {
    return false;
  }
}

function objectKeyFromUrl(value: string): string | null {
  try {
    const path = new URL(value).pathname.split("/").filter(Boolean);
    const bucketIndex = path.indexOf(audioBucket());
    if (bucketIndex < 0 || bucketIndex === path.length - 1) return null;
    return path.slice(bucketIndex + 1).map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = Reflect.get(error, "name");
  const status = Reflect.get(Reflect.get(error, "$metadata") ?? {}, "httpStatusCode");
  return name === "NoSuchKey" || name === "NotFound" || status === 404;
}

function isInvalidRange(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = Reflect.get(error, "name");
  const status = Reflect.get(Reflect.get(error, "$metadata") ?? {}, "httpStatusCode");
  return name === "InvalidRange" || status === 416;
}

function canonicalHeader(name: "content-length" | "content-range" | "etag"): string {
  if (name === "etag") return "ETag";
  return name === "content-length" ? "Content-Length" : "Content-Range";
}

export class StorageHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function resetStorageClient(): void {
  client?.destroy();
  client = undefined;
  bucketReady = undefined;
}
