import type { TutorChatRequest } from "@/types/tutor";

interface StreamEnvelope {
  data?: {
    text?: string;
    message?: string;
  };
  error?: string;
}

function parseFrame(frame: string): { event: string; payload: StreamEnvelope } | null {
  let event = "message";
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  return { event, payload: JSON.parse(data.join("\n")) as StreamEnvelope };
}

export async function readTutorStream(
  response: Response,
  onToken: (text: string) => void,
): Promise<string> {
  if (!response.ok) {
    let message = `Tutor request failed with HTTP ${response.status}`;
    try {
      const body = await response.json() as StreamEnvelope;
      if (body.error) message = body.error;
    } catch {
      // Keep the status-only message when the response is not JSON.
    }
    throw new Error(message);
  }
  if (!response.body) throw new Error("Tutor response did not include a stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let complete = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const parsed = parseFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (parsed?.event === "token" && parsed.payload.data?.text) {
          complete += parsed.payload.data.text;
          onToken(parsed.payload.data.text);
        }
        if (parsed?.event === "done" && parsed.payload.data?.message) {
          complete = parsed.payload.data.message;
        }
        if (parsed?.event === "error") {
          throw new Error(parsed.payload.error ?? "Hana-sensei could not finish the response");
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
  return complete;
}

export async function requestTutorReply(options: {
  endpoint: string;
  token?: string;
  body: TutorChatRequest;
  signal: AbortSignal;
  onToken: (text: string) => void;
}): Promise<string> {
  const headers = new Headers({
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  });
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  const response = await fetch(options.endpoint, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(options.body),
    signal: options.signal,
  });
  return readTutorStream(response, options.onToken);
}
