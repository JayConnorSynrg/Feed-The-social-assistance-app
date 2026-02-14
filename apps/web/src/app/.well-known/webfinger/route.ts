import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const WEBFINGER_ACCOUNT_REGEX = /^acct:feed@(.+)$/;

function extractDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return '';
  }
}

async function getResourceCount(): Promise<number | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { count, error } = await supabase
      .from('resources')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Failed to fetch resource count:', error);
      return null;
    }

    return count;
  } catch (error) {
    console.error('Error querying resource count:', error);
    return null;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const resource = searchParams.get('resource');

  // Validate resource parameter exists
  if (!resource) {
    return NextResponse.json(
      { error: 'Missing required parameter: resource' },
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // Validate resource format
  const match = WEBFINGER_ACCOUNT_REGEX.exec(resource);
  if (!match) {
    return NextResponse.json(
      { error: 'Invalid resource format. Expected: acct:feed@{domain}' },
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const requestedDomain = match[1];

  // Get this instance's domain
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const instanceDomain = extractDomainFromUrl(appUrl);

  // Verify domain matches this instance
  if (requestedDomain !== instanceDomain) {
    return NextResponse.json(
      { error: 'Resource not found on this instance' },
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // Fetch resource count (optional)
  const resourceCount = await getResourceCount();

  // Build JRD response
  const jrd = {
    subject: resource,
    aliases: [appUrl],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: `${appUrl}/api/federation/instance`,
      },
      {
        rel: 'http://webfinger.net/rel/profile-page',
        type: 'text/html',
        href: appUrl,
      },
      {
        rel: 'http://schemas.google.com/g/2010#updates-from',
        type: 'application/atom+xml',
        href: `${appUrl}/api/federation/resources`,
      },
    ],
    properties: {
      'http://feed.org/ns/instance-type': 'community',
      ...(resourceCount !== null && {
        'http://feed.org/ns/resource-count': resourceCount.toString(),
      }),
    },
  };

  return NextResponse.json(jrd, {
    status: 200,
    headers: {
      'Content-Type': 'application/jrd+json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=3600',
    },
  });
}
