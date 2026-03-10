import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WGER_START_URL = 'https://wger.de/api/v2/exerciseinfo/?language=2&limit=200';

const EQUIPMENT_PRIORITY = ['dumbbell', 'barbell', 'cable', 'bands', 'bodyweight', 'machine', 'other'];

const EQUIPMENT_TOKENS = {
  dumbbell: ['dumbbell', 'kettlebell'],
  barbell: ['barbell', 'sz-bar', 'ez-bar', 'hex bar', 'trap bar'],
  cable: ['cable'],
  bands: ['band', 'trx', 'suspension'],
  bodyweight: ['bodyweight', 'none (bodyweight exercise)', 'pull-up bar'],
  machine: ['machine', 'smith', 'lever'],
  other: []
};

const MUSCLE_ALIASES = new Map([
  ['anterior deltoid', 'front_delts'],
  ['deltoid anterior', 'front_delts'],
  ['lateral deltoid', 'side_delts'],
  ['middle deltoid', 'side_delts'],
  ['posterior deltoid', 'rear_delts'],
  ['deltoid posterior', 'rear_delts'],
  ['shoulders', 'shoulders'],
  ['biceps brachii', 'biceps'],
  ['biceps', 'biceps'],
  ['triceps brachii', 'triceps'],
  ['triceps', 'triceps'],
  ['brachialis', 'brachialis'],
  ['brachioradialis', 'forearms'],
  ['forearms', 'forearms'],
  ['pectoralis major', 'chest'],
  ['pectorals', 'chest'],
  ['chest', 'chest'],
  ['latissimus dorsi', 'lats'],
  ['latissimus', 'lats'],
  ['lats', 'lats'],
  ['trapezius', 'traps'],
  ['upper trapezius', 'traps'],
  ['erector spinae', 'lower_back'],
  ['lower back', 'lower_back'],
  ['rectus abdominis', 'abs'],
  ['abs', 'abs'],
  ['obliquus externus abdominis', 'obliques'],
  ['obliques', 'obliques'],
  ['gluteus maximus', 'glutes'],
  ['gluteus medius', 'glutes'],
  ['gluteus minimus', 'glutes'],
  ['glutes', 'glutes'],
  ['quadriceps femoris', 'quads'],
  ['quadriceps', 'quads'],
  ['quads', 'quads'],
  ['biceps femoris', 'hamstrings'],
  ['hamstrings', 'hamstrings'],
  ['gastrocnemius', 'calves'],
  ['soleus', 'calves'],
  ['calves', 'calves'],
  ['hip flexors', 'hip_flexors'],
  ['serratus anterior', 'serratus_anterior'],
  ['teres major', 'teres_major'],
  ['neck', 'neck'],
  ['adductors', 'adductors'],
  ['abductors', 'abductors']
]);

function toAsciiLower(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slugifyMuscle(value) {
  const normalized = toAsciiLower(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'core';
}

function canonicalMuscle(rawName) {
  const clean = toAsciiLower(rawName);
  if (!clean) {
    return 'core';
  }

  const mapped = MUSCLE_ALIASES.get(clean);
  if (mapped) {
    return mapped;
  }

  return slugifyMuscle(clean);
}

function mapEquipment(equipmentItems) {
  const names = (equipmentItems || []).map(item => toAsciiLower(item?.name));

  for (const key of EQUIPMENT_PRIORITY) {
    const tokens = EQUIPMENT_TOKENS[key];
    if (tokens.some(token => names.some(name => name.includes(token)))) {
      return key;
    }
  }

  if (names.length === 0) {
    return 'bodyweight';
  }

  return 'other';
}

function pickExerciseName(exercise) {
  const translations = Array.isArray(exercise.translations) ? exercise.translations : [];
  const english = translations.find(item => item?.language === 2 && String(item?.name || '').trim().length > 0);
  if (english) {
    return String(english.name).trim();
  }

  const withName = translations.find(item => String(item?.name || '').trim().length > 0);
  return withName ? String(withName.name).trim() : null;
}

function normalizeSourceKey(name, equipment) {
  return `${toAsciiLower(name)}|${equipment}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'trackerbroo-wger-import/1.0'
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`wger request failed (${response.status}): ${body.slice(0, 220)}`);
  }

  return response.json();
}

async function fetchAllWgerExercises() {
  const rows = [];
  let next = WGER_START_URL;

  while (next) {
    const page = await fetchJson(next);
    rows.push(...(page.results || []));
    next = page.next;
  }

  return rows;
}

function mapWgerExercise(exercise) {
  const name = pickExerciseName(exercise);
  if (!name) {
    return null;
  }

  const equipment = mapEquipment(exercise.equipment);

  const primaryAndSupport = [...(exercise.muscles || []), ...(exercise.muscles_secondary || [])]
    .map(item => canonicalMuscle(item?.name_en || item?.name))
    .filter(Boolean);

  const uniqueMuscles = [...new Set(primaryAndSupport)];
  const primaryMuscle = uniqueMuscles[0] || 'core';
  const secondaryMuscles = uniqueMuscles.slice(1, 6);

  const images = [...new Set((exercise.images || []).map(item => item?.image).filter(Boolean))].slice(0, 8);

  return {
    externalUuid: String(exercise.uuid || '').trim(),
    name,
    equipment,
    primary_muscle: primaryMuscle,
    secondary_muscles: secondaryMuscles,
    images,
    type: equipment
  };
}

async function loadExistingSystemExerciseIds(client) {
  const map = new Map();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await client
      .from('training_exercises')
      .select('id,name,equipment')
      .eq('is_system', true)
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const rows = data || [];
    for (const row of rows) {
      map.set(normalizeSourceKey(row.name, row.equipment), row.id);
    }

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return map;
}

async function upsertInChunks(client, rows, chunkSize = 200) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await client
      .from('training_exercises')
      .upsert(chunk, { onConflict: 'id' });

    if (error) {
      throw error;
    }

    process.stdout.write(`\rUpserted ${Math.min(index + chunk.length, rows.length)}/${rows.length}`);
  }

  process.stdout.write('\n');
}

async function main() {
  const localEnvironmentPath = resolve(process.cwd(), 'src/environments/environment.ts');
  let fallbackUrl = null;
  let fallbackAnon = null;

  try {
    const envFile = readFileSync(localEnvironmentPath, 'utf8');
    const urlMatch = envFile.match(/supabaseUrl:\s*'([^']+)'/);
    const anonMatch = envFile.match(/supabaseAnonKey:\s*'([^']+)'/);
    fallbackUrl = urlMatch?.[1] || null;
    fallbackAnon = anonMatch?.[1] || null;
  } catch {
    fallbackUrl = null;
    fallbackAnon = null;
  }

  const supabaseUrl = process.env.SUPABASE_URL || fallbackUrl;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL. Set env var or add supabaseUrl to src/environments/environment.ts.');
  }

  if (!serviceRoleKey) {
    if (fallbackAnon) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Found only publishable anon key in environment.ts, which cannot bypass RLS for system imports.');
    }
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Set env var before running this script.');
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log('Fetching exercises from wger...');
  const sourceRows = await fetchAllWgerExercises();
  console.log(`Fetched ${sourceRows.length} rows from wger.`);

  const mapped = sourceRows
    .map(mapWgerExercise)
    .filter(Boolean);

  const byKey = new Map();
  for (const row of mapped) {
    const key = normalizeSourceKey(row.name, row.equipment);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    if ((row.images?.length || 0) > (existing.images?.length || 0)) {
      byKey.set(key, row);
    }
  }

  const deduped = [...byKey.values()];
  console.log(`Prepared ${deduped.length} unique exercises for upsert.`);

  const existingIdMap = await loadExistingSystemExerciseIds(client);

  const nowIso = new Date().toISOString();
  const payload = deduped.map(row => {
    const key = normalizeSourceKey(row.name, row.equipment);
    const existingId = existingIdMap.get(key);
    const stableId = existingId || (row.externalUuid || randomUUID());

    return {
      id: stableId,
      owner_id: null,
      name: row.name,
      equipment: row.equipment,
      primary_muscle: row.primary_muscle,
      secondary_muscles: row.secondary_muscles,
      images: row.images,
      type: row.type,
      is_system: true,
      updated_at: nowIso
    };
  });

  await upsertInChunks(client, payload);

  console.log('Import finished.');
  console.log(`System exercises upserted: ${payload.length}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
