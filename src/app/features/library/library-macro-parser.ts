export interface ParsedMacroInput {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export function parseMacroInput(input: string): ParsedMacroInput | null {
  const raw = input.trim();
  if (!raw) {
    return null;
  }

  const jsonParsed = parseMacroJson(raw);
  if (jsonParsed) {
    return jsonParsed;
  }

  const normalized = raw.replace(/\u00a0/g, ' ');
  const parsed: ParsedMacroInput = {
    kcal: extractMacroValue(normalized, [
      /\b(?:kcal|kalorien|kalorie|calories?)\b\s*(?:[:=\-])?\s*(-?\d+(?:[.,]\d+)?)/i,
      /(-?\d+(?:[.,]\d+)?)\s*(?:kcal)\b/i
    ]),
    protein: extractMacroValue(normalized, [
      /\b(?:protein|eiweiss|eiweiß|p)\b\s*(?:[:=\-])?\s*(-?\d+(?:[.,]\d+)?)/i,
      /(-?\d+(?:[.,]\d+)?)\s*g?\s*(?:protein|eiweiss|eiweiß)\b/i
    ]),
    carbs: extractMacroValue(normalized, [
      /\b(?:carbs?|kohlenhydrate|kh|c)\b\s*(?:[:=\-])?\s*(-?\d+(?:[.,]\d+)?)/i,
      /(-?\d+(?:[.,]\d+)?)\s*g?\s*(?:carbs?|kohlenhydrate|kh)\b/i
    ]),
    fat: extractMacroValue(normalized, [
      /\b(?:fett|fat|f)\b\s*(?:[:=\-])?\s*(-?\d+(?:[.,]\d+)?)/i,
      /(-?\d+(?:[.,]\d+)?)\s*g?\s*(?:fett|fat)\b/i
    ])
  };

  return hasMacroValues(parsed) ? parsed : null;
}

export function roundOneDecimal(value: number): number {
  return Number(value.toFixed(1));
}

function parseMacroJson(input: string): ParsedMacroInput | null {
  try {
    const payload: unknown = JSON.parse(input);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const getValue = (keys: string[]): number | undefined => {
      for (const key of keys) {
        const value = parseNumericValue(record[key]);
        if (value !== undefined) {
          return value;
        }
      }
      return undefined;
    };

    const parsed: ParsedMacroInput = {
      kcal: getValue(['kcal', 'calories', 'kalorien']),
      protein: getValue(['protein', 'eiweiss', 'eiweiß', 'p']),
      carbs: getValue(['carbs', 'carbohydrates', 'kohlenhydrate', 'kh', 'c']),
      fat: getValue(['fat', 'fett', 'f'])
    };

    return hasMacroValues(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractMacroValue(input: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const value = parseNumericValue(match[1]);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function parseNumericValue(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const token = value.trim().match(/-?\d+(?:[.,]\d+)?/);
  if (!token?.[0]) {
    return undefined;
  }

  const numeric = Number(token[0].replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function hasMacroValues(parsed: ParsedMacroInput): boolean {
  return parsed.kcal !== undefined
    || parsed.protein !== undefined
    || parsed.carbs !== undefined
    || parsed.fat !== undefined;
}
