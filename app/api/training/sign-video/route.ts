// ---------------------------------------------------------------------------
// GET /api/training/sign-video?key=training/vol1/en/module_01/v1.1.mp4
//
// Returns a short-lived (default 4h) Cloudflare R2 signed URL for an authorised
// user. Used by both the Next.js portal training page and the EASE mobile app.
//
// Auth: Supabase session cookie (portal) OR `Authorization: Bearer <access_token>`
//       (EASE). Only authenticated users can request a signed URL.
//
// AP-TRAINING-SIGN-1 — authentication alone used to be the whole gate, which
// made `training_modules.required_role` unenforceable: any signed-in portal or
// EASE user could pass any training/**.mp4 key and get a playable URL. Both
// clients receive every video row straight from the database (the portal via
// /api/training/catalog, EASE by reading the tables directly), so the
// restricted keys were in reach. Prod bore this out — one broker completed all
// three videos of the admin+office_manager module and one agent started one.
//
// The key is now resolved to its video and that video's module, and the
// module's required_role is enforced against the caller's role AS READ FROM
// `profiles`. Authorization happens before the signer is ever touched.
//
// Key safety: the `key` parameter MUST begin with `training/`. Any other path
// is rejected so this endpoint cannot be abused to sign URLs for arbitrary
// bucket contents.
//
// Required env vars (set in Vercel + .env.local):
//   CLOUDFLARE_R2_ACCOUNT_ID        (or use R2_ENDPOINT directly)
//   CLOUDFLARE_R2_ACCESS_KEY_ID
//   CLOUDFLARE_R2_SECRET_ACCESS_KEY
//   CLOUDFLARE_R2_BUCKET            default: hartfelt-training
//   CLOUDFLARE_R2_ENDPOINT          optional override for the S3 endpoint
//   TRAINING_SIGNED_URL_TTL_SEC     optional, default 14400 (4 hours)
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  resolveCallerRole,
  resolveVideoByKey,
  roleMayAccessModule,
} from '@/lib/training/video-authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_TTL_SEC = 60 * 60 * 4; // 4 hours
const TRAINING_KEY_PREFIX = 'training/';

function getR2Client(): { client: S3Client; bucket: string } {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const endpoint =
    process.env.CLOUDFLARE_R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET || 'hartfelt-training';

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Cloudflare R2 env vars missing: need CLOUDFLARE_R2_ENDPOINT (or _ACCOUNT_ID), _ACCESS_KEY_ID, _SECRET_ACCESS_KEY'
    );
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // R2 doesn't use path-style routing the same way MinIO does, but s3-presigner
    // signs correctly with virtual-hosted-style via `forcePathStyle: false`.
    forcePathStyle: false,
  });

  return { client, bucket };
}

async function getAuthedUser(
  request: NextRequest
): Promise<{ userId: string } | null> {
  // 1. Bearer token (mobile / curl)
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data.user) return null;
      return { userId: data.user.id };
    } catch {
      return null;
    }
  }

  // 2. SSR cookie (portal)
  try {
    const stubResponse = NextResponse.json({});
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            stubResponse.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            stubResponse.cookies.delete(name);
          },
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return { userId: user.id };
  } catch {
    return null;
  }
}

function sanitizeKey(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith(TRAINING_KEY_PREFIX)) return null;
  // Prevent path traversal and anything weird.
  if (trimmed.includes('..') || trimmed.includes('//')) return null;
  if (!/^[A-Za-z0-9_./-]+$/.test(trimmed)) return null;
  // Only allow .mp4 extension for now — keeps the endpoint narrowly scoped.
  if (!trimmed.toLowerCase().endsWith('.mp4')) return null;
  return trimmed;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = sanitizeKey(searchParams.get('key'));
    if (!key) {
      return NextResponse.json(
        { error: 'invalid or missing key' },
        { status: 400 }
      );
    }

    // --- AP-TRAINING-SIGN-1 authorization boundary --------------------------
    // A service client is required here: training_videos / training_modules
    // are readable by `authenticated`, but the caller's own role must come
    // from `profiles` under service role so no caller can influence it.
    // Nothing below this block runs for an unauthorized caller — in
    // particular getR2Client() and getSignedUrl() are never reached.
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const video = await resolveVideoByKey(admin, key);
    if (!video) {
      // Unrecognised key — deny. This endpoint previously signed anything
      // shaped like training/**.mp4.
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const role = await resolveCallerRole(admin, user.userId);
    if (!roleMayAccessModule(video.requiredRole, role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    // ------------------------------------------------------------------------

    const ttlSec = (() => {
      const raw = process.env.TRAINING_SIGNED_URL_TTL_SEC;
      const parsed = raw ? parseInt(raw, 10) : NaN;
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 24 * 60 * 60) {
        return DEFAULT_TTL_SEC;
      }
      return parsed;
    })();

    const { client, bucket } = getR2Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: 'video/mp4',
    });
    const signedUrl = await getSignedUrl(client, command, { expiresIn: ttlSec });

    return NextResponse.json(
      {
        url: signedUrl,
        key,
        bucket,
        expires_in: ttlSec,
      },
      {
        headers: {
          // The signed URL itself is short-lived, so don't let CDNs cache our
          // response across users.
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (err) {
    console.error('sign-video error:', err);
    return NextResponse.json(
      { error: 'failed to sign video url' },
      { status: 500 }
    );
  }
}
