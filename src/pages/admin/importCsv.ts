// Client-side CSV parsing + column mapping for the CRM user import.
// Kept dependency-free: a small quote-aware parser + forgiving header aliases
// (Spanish/English) so a spreadsheet exported to CSV "just works".

export interface ImportRow {
  name: string;
  email: string;
  phone?: string;
  status?: 'active' | 'suspended';
  kycStatus?: 'none' | 'pending' | 'verified';
  virtualBalance?: number;
  createdAt?: number;
}

// Quote-aware CSV → array of {header: value}. Handles quoted commas/newlines and "" escapes.
export function parseCsv(input: string): Record<string, string>[] {
  const s = input.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? '').trim();
      });
      return obj;
    });
}

const ALIASES: Record<string, keyof ImportRow> = {
  name: 'name', nombre: 'name', 'nombre completo': 'name', cliente: 'name', 'full name': 'name',
  email: 'email', correo: 'email', 'correo electronico': 'email', 'correo electrónico': 'email', 'e-mail': 'email', mail: 'email',
  phone: 'phone', telefono: 'phone', 'teléfono': 'phone', celular: 'phone', movil: 'phone', 'móvil': 'phone', tel: 'phone',
  status: 'status', estado: 'status',
  kyc: 'kycStatus', kycstatus: 'kycStatus', 'kyc status': 'kycStatus', verificacion: 'kycStatus', 'verificación': 'kycStatus',
  saldo: 'virtualBalance', balance: 'virtualBalance', virtualbalance: 'virtualBalance', 'saldo virtual': 'virtualBalance',
  createdat: 'createdAt', fecha: 'createdAt', 'fecha de registro': 'createdAt', registrado: 'createdAt', alta: 'createdAt',
};

function mapStatus(v: string): 'active' | 'suspended' {
  const s = v.toLowerCase();
  return s.startsWith('susp') || s === 'inactivo' ? 'suspended' : 'active';
}
function mapKyc(v: string): 'none' | 'pending' | 'verified' {
  const s = v.toLowerCase();
  if (s.startsWith('verif')) return 'verified';
  if (s.startsWith('pend')) return 'pending';
  return 'none';
}

// Map raw CSV rows to canonical import rows, normalizing values.
export function mapRows(raw: Record<string, string>[]): ImportRow[] {
  return raw.map((r) => {
    const picked: Partial<Record<keyof ImportRow, string>> = {};
    for (const key in r) {
      const canon = ALIASES[key.toLowerCase().trim()];
      if (canon && !picked[canon]) picked[canon] = r[key];
    }
    const row: ImportRow = { name: picked.name ?? '', email: (picked.email ?? '').toLowerCase() };
    if (picked.phone) row.phone = picked.phone;
    if (picked.status) row.status = mapStatus(picked.status);
    if (picked.kycStatus) row.kycStatus = mapKyc(picked.kycStatus);
    if (picked.virtualBalance != null && String(picked.virtualBalance).trim() !== '') {
      const n = Number(String(picked.virtualBalance).replace(/[^0-9.\-]/g, ''));
      if (Number.isFinite(n)) row.virtualBalance = n;
    }
    if (picked.createdAt) {
      const t = Date.parse(picked.createdAt);
      if (!Number.isNaN(t)) row.createdAt = t;
    }
    return row;
  });
}

export const CSV_TEMPLATE =
  'nombre,email,telefono,saldo,estado,kyc\n' +
  'Juan Pérez,juan.perez@example.com,+51 999 111 222,10000,activo,verificado\n' +
  'María López,maria.lopez@example.com,+51 988 333 444,5000,activo,pendiente\n';
