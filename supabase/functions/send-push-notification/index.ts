import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';

type PushRequest =
  | { kind: 'test' }
  | {
      kind: 'community_post';
      actorUserId: string;
      day: string;
      postType: 'gym_checkin' | 'protein_milestone' | 'steps_milestone';
    };

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const vapidPublicKey = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY') ?? '';
const vapidPrivateKey = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY') ?? '';
const vapidSubject = Deno.env.get('WEB_PUSH_CONTACT_EMAIL') ?? 'mailto:hello@trackerbroo.app';
const appWebUrl = Deno.env.get('APP_WEB_URL') ?? 'http://localhost:4200';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json({ error: 'Supabase env vars are missing.' }, 500);
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return json({ error: 'VAPID keys are missing.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const {
    data: { user }
  } = await userClient.auth.getUser();

  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: PushRequest;
  try {
    body = (await req.json()) as PushRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  let targetUserIds: string[] = [];
  let title = 'Tracker Broo';
  let message = 'Neues Update';
  let url = `${appWebUrl.replace(/\/$/, '')}/community`;

  if (body.kind === 'test') {
    targetUserIds = [user.id];
    title = 'Push ist aktiv';
    message = 'Tracker Broo kann dir jetzt kurze Updates schicken.';
    url = `${appWebUrl.replace(/\/$/, '')}/profile`;
  } else if (body.kind === 'community_post') {
    if (body.actorUserId !== user.id) {
      return json({ error: 'Forbidden' }, 403);
    }

    const { data: actorProfile } = await serviceClient
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const actorName = String(actorProfile?.display_name || 'Ein Broo');

    const { data: subscriberRows, error: subscriberError } = await serviceClient
      .from('push_subscriptions')
      .select('user_id')
      .neq('user_id', user.id);

    if (subscriberError) {
      return json({ error: subscriberError.message }, 500);
    }

    targetUserIds = Array.from(new Set((subscriberRows || []).map(row => String(row.user_id))));

    if (body.postType === 'gym_checkin') {
      title = `${actorName} war im Gym`;
      message = 'Öffne Tracker Broo und zieh direkt mit.';
    } else if (body.postType === 'protein_milestone') {
      title = `${actorName} hat das Protein-Ziel erreicht`;
      message = 'Im Board wartet ein neues Consistency-Update.';
    } else {
      title = `${actorName} hat das Schrittziel erreicht`;
      message = 'Im Board wartet ein neues Consistency-Update.';
    }

    url = `${appWebUrl.replace(/\/$/, '')}/community`;
  } else {
    return json({ error: 'Unsupported push payload' }, 400);
  }

  if (targetUserIds.length === 0) {
    return json({ sent: 0, removed: 0 }, 200);
  }

  const { data: subscriptions, error: subscriptionsError } = await serviceClient
    .from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth')
    .in('user_id', targetUserIds);

  if (subscriptionsError) {
    return json({ error: subscriptionsError.message }, 500);
  }

  const payload = JSON.stringify({
    notification: {
      title,
      body: message,
      tag: body.kind === 'test' ? 'trackerbroo-test' : `trackerbroo-${body.kind}-${Date.now()}`,
      data: {
        url,
        onActionClick: {
          default: {
            operation: 'openWindow',
            url
          }
        }
      }
    }
  });

  let sent = 0;
  const staleSubscriptionIds: string[] = [];

  for (const subscription of (subscriptions || []) as PushSubscriptionRow[]) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        },
        payload,
        { TTL: 60 }
      );
      sent += 1;
    } catch (error) {
      const statusCode = getStatusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        staleSubscriptionIds.push(subscription.id);
      } else {
        console.error('Push send failed', error);
      }
    }
  }

  if (staleSubscriptionIds.length > 0) {
    await serviceClient
      .from('push_subscriptions')
      .delete()
      .in('id', staleSubscriptionIds);
  }

  return json({ sent, removed: staleSubscriptionIds.length }, 200);
});

function json(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

function getStatusCode(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const candidate = error as { statusCode?: unknown; status?: unknown };
  if (typeof candidate.statusCode === 'number') {
    return candidate.statusCode;
  }
  if (typeof candidate.status === 'number') {
    return candidate.status;
  }
  return null;
}
