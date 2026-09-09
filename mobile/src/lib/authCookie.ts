import type { Session } from "@supabase/supabase-js";

import { supabaseProjectRef } from "@/lib/config";

// The website authenticates API routes via @supabase/ssr cookie sessions.
// It never reads an Authorization header, so we synthesize the exact cookie
// format @supabase/ssr writes in the browser:
//   sb-<projectRef>-auth-token = "base64-" + base64url(JSON.stringify(session))
// chunked into <name>.0, <name>.1, ... when longer than 3180 chars.

const MAX_CHUNK_SIZE = 3180; // must match @supabase/ssr's chunker

function base64url(input: string): string {
  const utf8 = unescape(encodeURIComponent(input));
  let b64: string;
  if (typeof btoa === "function") {
    b64 = btoa(utf8);
  } else {
    const BufferImpl = (globalThis as any).Buffer;
    b64 = BufferImpl.from(utf8, "binary").toString("base64");
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Build the Cookie header value that the site's API routes expect. */
export function buildAuthCookie(session: Session): string {
  const name = `sb-${supabaseProjectRef}-auth-token`;
  const value = "base64-" + base64url(JSON.stringify(session));
  // base64url charset is cookie-safe, so encodeURIComponent(value) === value
  // and chunking is a plain slice.
  if (value.length <= MAX_CHUNK_SIZE) {
    return `${name}=${value}`;
  }
  const parts: string[] = [];
  for (let i = 0, offset = 0; offset < value.length; i++, offset += MAX_CHUNK_SIZE) {
    parts.push(`${name}.${i}=${value.slice(offset, offset + MAX_CHUNK_SIZE)}`);
  }
  return parts.join("; ");
}
