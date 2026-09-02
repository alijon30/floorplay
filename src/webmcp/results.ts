export interface ToolResult { content: { type: 'text'; text: string }[] }

export function ok(payload: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...payload }) }] };
}

export function fail(error: string, hint?: string, extra: Record<string, unknown> = {}): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error, ...(hint ? { hint } : {}), ...extra }) }] };
}

export function parseResult(r: ToolResult): Record<string, unknown> {
  return JSON.parse(r.content[0]?.text ?? '{}') as Record<string, unknown>;
}

export interface JsonSchemaProp {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: (string | number)[];
  items?: JsonSchemaProp;
  properties?: Record<string, JsonSchemaProp>;
  required?: string[];
  minimum?: number;
  maximum?: number;
}

export interface JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProp>;
  required?: string[];
  additionalProperties?: boolean;
}

function checkValue(path: string, prop: JsonSchemaProp, v: unknown, errors: string[]): void {
  switch (prop.type) {
    case 'string': if (typeof v !== 'string') { errors.push(`${path}: expected string`); return; } break;
    case 'boolean': if (typeof v !== 'boolean') { errors.push(`${path}: expected boolean`); return; } break;
    case 'number': if (typeof v !== 'number' || Number.isNaN(v)) { errors.push(`${path}: expected number`); return; } break;
    case 'integer': if (typeof v !== 'number' || !Number.isInteger(v)) { errors.push(`${path}: expected integer`); return; } break;
    case 'array':
      if (!Array.isArray(v)) { errors.push(`${path}: expected array`); return; }
      if (prop.items) v.forEach((item, i) => checkValue(`${path}[${i}]`, prop.items!, item, errors));
      return;
    case 'object':
      if (typeof v !== 'object' || v === null || Array.isArray(v)) { errors.push(`${path}: expected object`); return; }
      if (prop.properties) checkObject(path, prop.properties, prop.required ?? [], v as Record<string, unknown>, errors);
      return;
  }
  if (prop.enum && !prop.enum.includes(v as string | number)) errors.push(`${path}: must be one of ${prop.enum.join(', ')}`);
  if (typeof v === 'number') {
    if (prop.minimum !== undefined && v < prop.minimum) errors.push(`${path}: must be >= ${prop.minimum}`);
    if (prop.maximum !== undefined && v > prop.maximum) errors.push(`${path}: must be <= ${prop.maximum}`);
  }
}

function checkObject(prefix: string, props: Record<string, JsonSchemaProp>, required: string[], obj: Record<string, unknown>, errors: string[]): void {
  for (const key of required) if (obj[key] === undefined) errors.push(`${prefix ? prefix + '.' : ''}${key}: required`);
  for (const [key, prop] of Object.entries(props)) {
    if (obj[key] === undefined) continue;
    checkValue(`${prefix ? prefix + '.' : ''}${key}`, prop, obj[key], errors);
  }
}

export function validateInput(schema: JsonSchema, input: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; errors: string[] } {
  const obj = input === undefined || input === null ? {} : input;
  if (typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['input: expected object'] };
  const errors: string[] = [];
  checkObject('', schema.properties, schema.required ?? [], obj as Record<string, unknown>, errors);
  return errors.length ? { ok: false, errors } : { ok: true, value: obj as Record<string, unknown> };
}
