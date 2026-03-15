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

const GYM_BODIES = [
  'Broo hat sich heute direkt ins Gym verlaufen.',
  'Broo tut so, als müsste heute noch Bankai freigeschaltet werden.',
  'Broo trainiert, als würde Guy-sensei gleich um die Ecke stehen.',
  'Broo hebt heute, als wäre Kaioken aktiviert.',
  'Broo macht so ernst, als wäre die Schwerkraft gerade hochgedreht worden.',
  'Broo trainiert, als wäre das nächste Gate fast offen.',
  'Broo hebt, als wäre Haki plötzlich Pflichtfach.',
  'Broo trainiert, als hätte Urahara nur trocken "nochmal" gesagt.',
  'Broo ist heute im reinen Trainings-Arc unterwegs.',
  'Broo hebt, als würde gleich Ultra Instinct beantragt.',
  'Broo trainiert, als wäre Gear Second fürs Warm-up nötig.',
  'Broo macht heute keine Filler-Einheit.',
  'Broo benimmt sich, als müsse heute noch ein Zanpakuto erwachen.',
  'Broo hebt, als hätte Vegeta das Programm geschrieben.',
  'Broo trainiert, als würde Levi die Technik kontrollieren.',
  'Broo macht heute ernst wie Rock Lee ohne Fußgewichte.',
  'Broo hebt, als hätte Jiraiya gesagt, Talent reicht nicht.',
  'Broo trainiert, als wäre das hier die geheime Kammer unter Hogwarts.',
  'Broo pumpt, als hätte Snape persoenlich "nochmal" gesagt.',
  'Broo hebt, als wuerde er gleich ein Sternenabzeichen fuers Gym bekommen.',
  'Broo trainiert, als muesste Charizard impressed werden.',
  'Broo macht heute so ernst, als waere das Bankai-Training zu kurz gewesen.',
  'Broo hebt, als haette Beerus schlechte Laune.',
  'Broo trainiert, als waere One For All gerade noch zu laut im Koerper.',
  'Broo ist heute tiefer im Training als ein Bleach-Flashback.',
  'Broo macht Ruecken, als waere ODM-Training wieder Pflicht.',
  'Broo hebt, als haette Kakashi endlich die Ausreden gestrichen.',
  'Broo trainiert, als wuerde Might Guy gleich applaudieren.',
  'Broo macht heute auf Hauptcharakter mit Muskelkater.',
  'Broo hebt, als haette Garp gesagt, jetzt wird nicht gejammert.',
  'Broo trainiert, als muesste er morgen gegen seinen Rivalen antreten.',
  'Broo ist heute im Gym wie ein Pokemon mit zu viel XP.',
  'Broo macht die Einheit, als waere Rasengan allein nicht genug.',
  'Broo hebt, als muesste heute noch der naechste Modus freigeschaltet werden.',
  'Broo trainiert, als haette Zoro den Weg diesmal wirklich gefunden.',
  'Broo macht heute Schultertag wie ein echter Shinigami im Stress.',
  'Broo hebt, als waere Hollowfizierung nur der Anfang.',
  'Broo trainiert, als muesste Dumbledore ueberzeugt werden.',
  'Broo macht Brust, als wuerde gleich der Opening-Song einsetzen.',
  'Broo hebt, als haette Roshi die Hantel selber hingestellt.',
  'Broo trainiert, als waere die Zeit im Hyperbolic Time Chamber knapp.',
  'Broo macht heute mehr Druck als ein voll geladenes Kamehameha.',
  'Broo hebt, als wuerde Aizawa jeden Satz bewerten.',
  'Broo trainiert, als waeren die Titanen schon vor dem Tor.',
  'Broo macht heute auf Elite-Vier, aber mit Kurzhanteln.',
  'Broo hebt, als muesste ein Patronus aus dem Lat-Tag entstehen.',
  'Broo trainiert, als haette Sanji heute Beintraining angeordnet.',
  'Broo macht heute ernst wie ein Captain vor dem Bankai.',
  'Broo hebt, als waere das nur das Ende vom Warm-up.',
  'Broo trainiert, als wuerde Guy-sensei sagen: Das reicht noch lange nicht.'
] as const;

const FOOD_BODIES = [
  'Broo denkt, der Kuehlschrank sei ein Saiyajin-Trainingspartner.',
  'Broo laedt Protein nach, als waere der Tank komplett leer.',
  'Broo isst, als waere Recovery heute eine Vollzeitaufgabe.',
  'Broo futtert, als waere Kamehameha ohne Essen keine Option.',
  'Broo macht Protein, als muesste morgen wieder hart gelevelt werden.',
  'Broo laedt heute Stats nach, als gaebe es Senzu-Bohnen nur noch auf Reserve.',
  'Broo isst, als waere das der Bossfight nach dem Bossfight.',
  'Broo macht heute auf grenzenlosen Appetit mit Zielsetzung.',
  'Broo hat gerade Protein geladen wie andere Leute Mana.',
  'Broo isst, als wuerde selbst Son Goku kurz respektvoll nicken.',
  'Broo macht Makros, als haette Bulma den Ernaehrungsplan geschrieben.',
  'Broo laedt den Tank, als waere Kaioken nicht gratis.',
  'Broo isst, als muesste morgen wieder unter hoher Schwerkraft trainiert werden.',
  'Broo hat das Protein heute ernst genommen wie Vegeta seinen Stolz.',
  'Broo futtert, als waere Frieza nur mit Meal Prep zu schlagen.',
  'Broo macht heute auf Hauptcharakter mit endlosem Hunger.',
  'Broo isst, als waeren drei Training-Arcs gleichzeitig offen.',
  'Broo laedt Protein nach, als haette Roshi nur genickt und weitergekocht.',
  'Broo macht Makros, als wuerde Shenlong sonst nicht antworten.',
  'Broo isst, als sei das hier die geheime Technik vor der naechsten Form.',
  'Broo futtert, als haette die grosse Halle gerade auf Protein umgestellt.',
  'Broo isst, als waere Butterbier heute nur das Aufwaermen.',
  'Broo macht heute auf Gryffindor-Hunger mit Struktur.',
  'Broo laedt Makros, als haette Hermine den Plan korrigiert.',
  'Broo isst, als haette Snape aus Versehen einen brauchbaren Shake gebraut.',
  'Broo futtert, als wuerde Dobby sonst wieder Sorgen machen.',
  'Broo macht Protein, als kaeme gleich die Eulenpost mit der naechsten Einheit.',
  'Broo isst, als sei die Kueche heute auf Zaubertrank-Niveau unterwegs.',
  'Broo laedt heute mehr nach als ein Relaxo vor dem Winterschlaf.',
  'Broo futtert, als waere Bisasam nicht das Einzige mit Growth.',
  'Broo isst, als haette Glurak persoenlich das Meal Prep bewacht.',
  'Broo macht Protein, als wuerde Professor Eich danach Fragen stellen.',
  'Broo laedt den Tank, als waere das naechste Arena-Badge vom Huhn abhaengig.',
  'Broo isst, als muesste Pikachu gleich wieder Strom liefern.',
  'Broo macht Makros, als gaebe es EP direkt aus der Pfanne.',
  'Broo futtert, als haette Sanji kurz den Loeffel aus der Hand gegeben.',
  'Broo isst, als waere das Fleisch gerade strategisch wichtig.',
  'Broo laedt Protein nach, als muesste morgen wieder Haki sitzen.',
  'Broo macht heute auf Strohhut-Appetit mit sauberem Protein.',
  'Broo isst, als waere die Kombuese heute im Full-Power-Modus.',
  'Broo laedt den Tank, als haette Nami die Portionen nicht begrenzen koennen.',
  'Broo futtert, als waeren Titanen draussen und Meal Prep drinnen.',
  'Broo isst, als wuerde ODM ohne Kalorien einfach nicht funktionieren.',
  'Broo macht Protein, als sei das hier die Versorgung hinter den Mauern.',
  'Broo laedt den Tank, als waere Levi mit dem Portionierer zu streng gewesen.',
  'Broo isst, als haette Bankai heute Kalorienverbrauch angemeldet.',
  'Broo macht Makros, als muesste Chakra dringend aufgefuellt werden.',
  'Broo laedt Protein nach, als haette Kakashi wieder das Fruehstueck verpasst.',
  'Broo isst, als waere Ramen heute ausnahmsweise vernuenftig geworden.',
  'Broo macht heute so saubere Makros, dass sogar Snorlax klatschen wuerde.'
] as const;

const STEPS_BODIES = [
  'Broo macht Schritte, als wuerde er bald gegen Gaara fighten.',
  'Broo laeuft, als waeren die Fussgewichte gerade gefallen.',
  'Broo hat heute eindeutig Rock-Lee-Beine aktiviert.',
  'Broo macht Schritte, als wuerde Guy-sensei mitzaehlen.',
  'Broo bewegt sich, als waere Taijutsu heute Pflichtfach.',
  'Broo laeuft, als haette Shunpo gerade freigeschaltet.',
  'Broo macht heute mehr Beinarbeit als der Rest vom Team.',
  'Broo laeuft, als waere Stillstehen eine verbotene Technik.',
  'Broo bewegt sich, als waere Geschwindigkeit heute alles.',
  'Broo macht Schritte, als haette Kakashi das Aufwaermen verdoppelt.',
  'Broo laeuft, als muesste gleich das naechste Gate aufgehen.',
  'Broo hat heute mehr Fussarbeit als ein ganzer Lee-Flashback.',
  'Broo bewegt sich, als wuerde Sanji das Tempo vorgeben.',
  'Broo laeuft heute mit mehr Beinarbeit als Kuechendienst.',
  'Broo macht Schritte, als waere Diable Jambe nur fuers Gehen da.',
  'Broo ist unterwegs, als haette die Kombuese keinen Sitzplatz mehr.',
  'Broo laeuft, als wuerde ein Titan hintenrum naeher kommen.',
  'Broo macht Schritte, als waere das ODM-Training wieder auf dem Plan.',
  'Broo bewegt sich, als muesste noch rechtzeitig die Mauer erreicht werden.',
  'Broo laeuft, als wuerde Levi die Schrittzahl kontrollieren.',
  'Broo macht heute so viele Schritte, als gaebe es draussen nur Titanenprobleme.',
  'Broo bewegt sich, als haette Armin endlich einen sehr nervoesen Plan gemacht.',
  'Broo laeuft, als waere der Besen gerade nicht verfuegbar.',
  'Broo macht Schritte, als haette McGonagall Gehen zur Pflicht gemacht.',
  'Broo bewegt sich, als wuerde Filch schon wieder irgendwo meckern.',
  'Broo laeuft, als sei das Schloss mal wieder viel zu gross.',
  'Broo macht Schritte, als muesste noch schnell zur grossen Halle gesprintet werden.',
  'Broo bewegt sich, als waere Apparieren heute gesperrt.',
  'Broo laeuft, als gaebe es EP pro Schritt.',
  'Broo macht Schritte, als waere Sprinten gegen Pikachu keine gute Idee.',
  'Broo bewegt sich, als haette Mauzi die Route falsch erklaert.',
  'Broo laeuft, als muesste noch vor Sonnenuntergang die Arena erreicht werden.',
  'Broo macht Schritte, als haette Professor Eich keine Geduld mehr.',
  'Broo bewegt sich, als waere Glurak heute kein Taxi.',
  'Broo laeuft, als muesste er vor Team Rocket nur knapp nicht peinlich wirken.',
  'Broo macht Schritte, als wuerde Bankai nur mit Cardio starten.',
  'Broo bewegt sich, als haette ein Captain "schneller" gesagt.',
  'Broo laeuft, als waere Sonido ploetzlich freigeschaltet.',
  'Broo macht Schritte, als muesste noch rechtzeitig zum naechsten Einsatz geportet werden.',
  'Broo bewegt sich, als wuerde ein Shinigami zu spaet zur Arbeit kommen.',
  'Broo laeuft, als waeren sieben Dragon Balls ueber die Stadt verteilt.',
  'Broo macht Schritte, als haette Bulma gesagt, Auto faellt aus.',
  'Broo bewegt sich, als waere Nimbus heute im Service.',
  'Broo laeuft, als muesste vor dem Training noch die Welt umrundet werden.',
  'Broo macht Schritte, als haette Beerus schlechte Laune und alle bleiben lieber mobil.',
  'Broo bewegt sich, als waere Kaioken fuers Gehen erlaubt.',
  'Broo laeuft, als wuerde Dobby sagen, selber gehen ist besser.',
  'Broo macht Schritte, als haette Hermine den Lift verzaubert und verschwinden lassen.',
  'Broo bewegt sich, als waere jeder Flur heute ein eigener Bossrun.',
  'Broo laeuft, als haetten die Fussgewichte wirklich endgueltig den Boden beruehrt.'
] as const;

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabasePublishableKey =
  Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
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

  if (!supabaseUrl || !supabasePublishableKey || !supabaseServiceRoleKey) {
    console.error('Push function missing env vars', {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasPublishableKey: Boolean(supabasePublishableKey),
      hasServiceRoleKey: Boolean(supabaseServiceRoleKey)
    });
    return json({ error: 'Supabase env vars are missing.' }, 500);
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return json({ error: 'VAPID keys are missing.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const userClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  if (!accessToken) {
    console.error('Push function missing bearer token');
    return json({ error: 'Missing bearer token' }, 401);
  }

  const {
    data: claimsData,
    error: claimsError
  } = await userClient.auth.getClaims(accessToken);
  const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null;
  if (!userId) {
    console.error('Push auth getClaims failed', {
      claimsError,
      tokenPrefix: accessToken.slice(0, 16),
      authHeaderPresent: Boolean(authHeader),
      hasPublishableKey: Boolean(supabasePublishableKey)
    });
    return json({ error: claimsError?.message || 'Unauthorized' }, 401);
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
    targetUserIds = [userId];
    title = 'Push ist aktiv';
    message = 'Broo hat Push jetzt wirklich eingeschaltet.';
    url = `${appWebUrl.replace(/\/$/, '')}/profile`;
  } else if (body.kind === 'community_post') {
    if (body.actorUserId !== userId) {
      return json({ error: 'Forbidden' }, 403);
    }

    const { data: actorProfile } = await serviceClient
      .from('profiles')
      .select('display_name')
      .eq('user_id', userId)
      .maybeSingle();

    const actorName = String(actorProfile?.display_name || 'Ein Broo');

    const { data: subscriberRows, error: subscriberError } = await serviceClient
      .from('push_subscriptions')
      .select('user_id')
      .neq('user_id', userId);

    if (subscriberError) {
      return json({ error: subscriberError.message }, 500);
    }

    targetUserIds = Array.from(new Set((subscriberRows || []).map(row => String(row.user_id))));

    if (body.postType === 'gym_checkin') {
      title = `${actorName} war im Gym`;
      message = pickRandom(GYM_BODIES);
    } else if (body.postType === 'protein_milestone') {
      title = `${actorName} hat das Protein-Ziel erreicht`;
      message = pickRandom(FOOD_BODIES);
    } else {
      title = `${actorName} hat das Schrittziel erreicht`;
      message = pickRandom(STEPS_BODIES);
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

function pickRandom(values: readonly string[]): string {
  return values[Math.floor(Math.random() * values.length)] ?? 'Broo hat wieder geliefert.';
}
