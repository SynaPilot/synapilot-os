import * as XLSX from 'xlsx';
import type { Database } from '@/integrations/supabase/types';

type ContactRole = Database['public']['Enums']['contact_role'];

export type TransformedContact = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role?: ContactRole | null;
  source?: string | null;
  city?: string | null;
  postal_code?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  organization_id: string;
};

const FIELD_ALIASES: Record<string, string[]> = {
  full_name: ['nom', 'prenom', 'nom complet', 'name', 'contact', 'nom_prenom', 'nomprenom'],
  email: ['email', 'mail', 'e-mail', 'courriel', 'adresse mail'],
  phone: ['telephone', 'tel', 'phone', 'portable', 'mobile', 'numero', 'tel portable'],
  city: ['ville', 'city', 'commune', 'localite'],
  postal_code: ['code postal', 'cp', 'codepostal', 'postal_code', 'zip', 'code_postal'],
  notes: ['notes', 'commentaire', 'remarque', 'observation'],
  source: ['source', 'origine', 'provenance'],
  role: ['role', 'type', 'categorie', 'profil', 'statut contact'],
  tags: ['tags', 'etiquettes', 'labels'],
};

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeRole(raw: string): ContactRole {
  const lower = raw.toLowerCase().trim();
  if (lower === 'acheteur' || lower === 'buyer') return 'acheteur';
  if (lower === 'vendeur' || lower === 'seller' || lower === 'proprietaire') return 'vendeur';
  if (lower === 'locataire' || lower === 'tenant') return 'locataire';
  return 'prospect';
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+\s]/g, '').trim();
}

function processText(
  text: string,
  onError: (msg: string) => void,
): { headers: string[]; rows: string[][] } | null {
  try {
    const firstLine = text.split('\n')[0] ?? '';
    const commaCount = (firstLine.match(/,/g) ?? []).length;
    const semicolonCount = (firstLine.match(/;/g) ?? []).length;
    const separator = semicolonCount > commaCount ? ';' : ',';

    const workbook = XLSX.read(text, { type: 'string', FS: separator });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      onError('Le fichier est vide');
      return null;
    }

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][];

    if (data.length < 1 || !data[0] || data[0].length === 0) {
      onError('Le fichier est vide');
      return null;
    }

    const headers = (data[0]).map(String);
    const rawRows = data.slice(1);

    if (rawRows.length > 3000) {
      onError('Fichier trop volumineux (max 3 000 lignes)');
      return null;
    }

    const rows = rawRows.map((row) =>
      headers.map((_, i) => String(row[i] ?? ''))
    );

    return { headers, rows };
  } catch {
    onError('Erreur lors de la lecture du fichier');
    return null;
  }
}

export async function parseCSVWithSheetJS(
  file: File,
  onError: (msg: string) => void,
): Promise<{ headers: string[]; rows: string[][] } | null> {
  return new Promise((resolve) => {
    const utfReader = new FileReader();

    utfReader.onload = (e) => {
      const text = e.target?.result as string;
      if (text.includes('\uFFFD')) {
        // Try latin1 fallback
        const latin1Reader = new FileReader();
        latin1Reader.onload = (e2) => {
          resolve(processText(e2.target?.result as string, onError));
        };
        latin1Reader.onerror = () => {
          onError('Impossible de lire le fichier');
          resolve(null);
        };
        latin1Reader.readAsText(file, 'latin1');
      } else {
        resolve(processText(text, onError));
      }
    };

    utfReader.onerror = () => {
      const latin1Reader = new FileReader();
      latin1Reader.onload = (e) => resolve(processText(e.target?.result as string, onError));
      latin1Reader.onerror = () => {
        onError('Impossible de lire le fichier');
        resolve(null);
      };
      latin1Reader.readAsText(file, 'latin1');
    };

    utfReader.readAsText(file, 'UTF-8');
  });
}

export function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const normalized = normalizeString(header);
    let matched = '__ignore__';
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(normalized)) {
        matched = field;
        break;
      }
    }
    mapping[header] = matched;
  }
  return mapping;
}

export function validateAndTransformRows(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string>,
  organizationId: string,
): { valid: TransformedContact[]; invalid: number } {
  const fieldToIndex: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    const field = mapping[headers[i]];
    if (field && field !== '__ignore__') {
      fieldToIndex[field] = i;
    }
  }

  const getValue = (row: string[], field: string): string => {
    const idx = fieldToIndex[field];
    if (idx === undefined) return '';
    return String(row[idx] ?? '').trim();
  };

  const valid: TransformedContact[] = [];
  let invalid = 0;

  for (const row of rows) {
    const full_name = getValue(row, 'full_name');
    if (!full_name) {
      invalid++;
      continue;
    }

    const rawRole = getValue(row, 'role');
    const rawTags = getValue(row, 'tags');
    const rawPhone = getValue(row, 'phone');

    const contact: TransformedContact = {
      full_name,
      email: fieldToIndex['email'] !== undefined ? getValue(row, 'email') || null : null,
      phone: rawPhone ? normalizePhone(rawPhone) || null : null,
      role: rawRole ? normalizeRole(rawRole) : null,
      source: fieldToIndex['source'] !== undefined ? getValue(row, 'source') || null : null,
      city: fieldToIndex['city'] !== undefined ? getValue(row, 'city') || null : null,
      postal_code: fieldToIndex['postal_code'] !== undefined ? getValue(row, 'postal_code') || null : null,
      notes: fieldToIndex['notes'] !== undefined ? getValue(row, 'notes') || null : null,
      tags: rawTags ? rawTags.split(/[,;]/).map((t) => t.trim()).filter(Boolean) : null,
      organization_id: organizationId,
    };

    valid.push(contact);
  }

  return { valid, invalid };
}
