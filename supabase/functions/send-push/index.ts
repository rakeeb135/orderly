// ============================================================
// ORDY: send-push Edge Function
// Sends web push notifications to a seller's subscribed devices.
//
// Auth model:
//   - Authenticated caller (seller JWT): must match seller_id
//   - Anon caller: must supply order_id that belongs to seller_id,
//     and the order must have been created within the last 5 minutes
//     (prevents spam from a single captured order id)
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@ordy.lk';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    if (!vapidPublicKey || !vapidPrivateKey) {
      return json({ error: 'VAPID keys not configured' }, 500);
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const body = await req.json();
    const { seller_id, title, message, link = '/orders', order_id } = body;

    if (!seller_id || !title || !message) {
      return json({ error: 'Missing required fields: seller_id, title, message' }, 400);
    }

    // ── Auth check ─────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const admin = createClient(supabaseUrl, serviceKey!);

    const isAnonCall = !token || token === anonKey;

    if (!isAnonCall) {
      // Authenticated path: verify the caller owns this seller row.
      const { data: { user }, error: authErr } = await admin.auth.getUser(token);
      if (authErr || !user) return json({ error: 'Invalid session' }, 401);

      const { data: seller, error: sellerErr } = await admin
        .from('sellers')
        .select('id')
        .eq('id', seller_id)
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (sellerErr || !seller) return json({ error: 'Not authorized for this seller' }, 403);
    } else {
      // Anon path: must supply a valid, recent order_id for this seller.
      if (!order_id) return json({ error: 'Not authorized' }, 401);

      const { data: order, error: orderErr } = await admin
        .from('orders')
        .select('id, seller_id, created_at')
        .eq('id', order_id)
        .eq('seller_id', seller_id)
        .maybeSingle();

      if (orderErr || !order) return json({ error: 'Not authorized' }, 403);

      const ageMs = Date.now() - new Date(order.created_at).getTime();
      if (ageMs > 5 * 60 * 1000) {
        return json({ error: 'Order too old for push trigger' }, 429);
      }
    }

    // ── Fetch subscriptions ────────────────────────────────────
    const { data: subscriptions, error: fetchErr } = await admin
      .from('push_subscriptions')
      .select('*')
      .eq('seller_id', seller_id);

    if (fetchErr) throw new Error(`Failed to fetch subscriptions: ${fetchErr.message}`);

    if (!subscriptions || subscriptions.length === 0) {
      return json({ sent: 0, message: 'No subscriptions for this seller' }, 200);
    }

    const payload = JSON.stringify({
      title,
      body: message,
      link,
      order_id,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          await admin
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id);
          return { id: sub.id, status: 'sent' };
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await admin.from('push_subscriptions').delete().eq('id', sub.id);
            return { id: sub.id, status: 'deleted_expired' };
          }
          console.error('Push failed:', err);
          return { id: sub.id, status: 'failed', error: err.message };
        }
      })
    );

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value.status === 'sent').length;
    const expired = results.filter((r) => r.status === 'fulfilled' && r.value.status === 'deleted_expired').length;
    const failed = results.filter((r) => r.status === 'fulfilled' && r.value.status === 'failed').length;

    return json({ sent, expired, failed, total: subscriptions.length }, 200);
  } catch (err: any) {
    console.error('send-push error:', err);
    return json({ error: err.message || 'Unknown error' }, 500);
  }
});

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}