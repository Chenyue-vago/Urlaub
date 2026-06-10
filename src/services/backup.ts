import { NewVacationRecord, VacationRecord } from '../types';

// 备份文件 v2：直接存记录数组（无 id/userId/createdAt，导入时由 DB 重新生成）。
// v1 是旧 localStorage 时代的格式（data 下挂各个 storage key），导入时兼容。
export interface BackupFile {
  schemaVersion: 2;
  exportedAt: string;
  records: NewVacationRecord[];
}

export function buildBackup(records: VacationRecord[]): BackupFile {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    records: records.map((r) => ({
      startDate: r.startDate,
      endDate: r.endDate,
      workDays: r.workDays,
      description: r.description,
      type: r.type,
      isCarryOver: r.isCarryOver ?? false,
      year: r.year,
    })),
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// 旧版本把本地化后缀写进 description；v1 导入时清理（与已删除的 migrateRecord 一致）。
function cleanLegacyDescription(original: string): { description: string; carryOverHinted: boolean } {
  const carryOverHinted =
    original.includes('（结转优先）') || /\(carry-over first\)/i.test(original);
  const cleaned = original
    .replace(/（结转优先）/g, '')
    .replace(/（合同假期）/g, '')
    .replace(/（法定假期）/g, '')
    .replace(/\s*\(carry-over first\)/gi, '')
    .replace(/\s*\(contractual\)/gi, '')
    .replace(/\s*\(statutory\)/gi, '')
    .replace(/\s*\(\d+年部分\)/g, '')
    .replace(/\s*\(Part of \d+\)/gi, '')
    .trim();
  const isPlaceholderOnly = cleaned === '假期' || cleaned === 'Vacation';
  return { description: isPlaceholderOnly ? '' : cleaned, carryOverHinted };
}

function validateRecord(raw: unknown): NewVacationRecord {
  if (!raw || typeof raw !== 'object') throw new Error('invalid record');
  const r = raw as Record<string, unknown>;
  const startDate = String(r.startDate ?? '');
  const endDate = String(r.endDate ?? '');
  const workDays = Number(r.workDays);
  const type = r.type;
  const year = Number(r.year);
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
    throw new Error('invalid record dates');
  }
  if (!Number.isFinite(workDays) || workDays <= 0) {
    throw new Error('invalid record workDays');
  }
  if (type !== 'statutory' && type !== 'contractual') {
    throw new Error('invalid record type');
  }
  if (!Number.isInteger(year)) {
    throw new Error('invalid record year');
  }
  return {
    startDate,
    endDate,
    workDays,
    description: String(r.description ?? ''),
    type,
    isCarryOver: r.isCarryOver === true,
    year,
  };
}

function parseLegacyV1(data: Record<string, unknown>): NewVacationRecord[] {
  const rawJson = data['urlaub_manager_data'];
  if (typeof rawJson !== 'string') throw new Error('legacy backup has no records');
  const parsed = JSON.parse(rawJson);
  if (!Array.isArray(parsed)) throw new Error('legacy backup records not an array');
  return parsed.map((raw) => {
    const r = raw as Record<string, unknown>;
    const { description, carryOverHinted } = cleanLegacyDescription(String(r.description ?? ''));
    const record = validateRecord({ ...r, description });
    if (carryOverHinted && record.type !== 'contractual') {
      record.isCarryOver = true;
    }
    return record;
  });
}

// 解析备份文件（v1 或 v2），任何非预期结构都抛错，由调用方提示用户。
export function parseBackup(parsed: unknown): NewVacationRecord[] {
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid backup file');
  const root = parsed as Record<string, unknown>;

  let records: NewVacationRecord[];
  if (Array.isArray(root.records)) {
    records = root.records.map(validateRecord);
  } else if (root.data && typeof root.data === 'object') {
    records = parseLegacyV1(root.data as Record<string, unknown>);
  } else {
    throw new Error('unrecognised backup format');
  }

  if (records.length === 0) throw new Error('backup contains no records');
  return records;
}
