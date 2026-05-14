import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { runStorage } from '../services/runStorage';
import type { SourceFile, SourceTable, SourceColumn, ForeignKeyHint } from '../../src/types/run';

export const uploadRouter = Router();

// Store files in memory (no disk I/O needed — we parse immediately)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

/**
 * Infer a simple type from sample values.
 */
function inferType(values: unknown[]): string {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'string';

  let hasNumber = false;
  let hasDate = false;
  let hasBool = false;

  for (const v of nonNull.slice(0, 20)) {
    if (typeof v === 'number') hasNumber = true;
    else if (typeof v === 'boolean') hasBool = true;
    else if (v instanceof Date) hasDate = true;
    else if (typeof v === 'string') {
      if (!isNaN(Number(v)) && v.trim() !== '') hasNumber = true;
      else if (!isNaN(Date.parse(v)) && v.length > 6) hasDate = true;
    }
  }

  if (hasBool) return 'boolean';
  if (hasDate && !hasNumber) return 'datetime';
  if (hasNumber) return 'number';
  return 'string';
}

/**
 * Detect potential primary key columns.
 */
function detectKeys(columns: SourceColumn[], rows: Record<string, unknown>[]): string[] {
  const keys: string[] = [];
  for (const col of columns) {
    const name = col.name.toLowerCase();
    // Pattern-based detection
    if (name === 'id' || name.endsWith('id') || name.endsWith('_id') || name === 'key') {
      // Check uniqueness in sample
      const values = rows.map((r) => r[col.name]);
      const unique = new Set(values.filter((v) => v !== null && v !== undefined));
      if (unique.size === values.length || unique.size >= values.length * 0.95) {
        keys.push(col.name);
      }
    }
  }
  return keys;
}

/**
 * Detect potential FK relationships across tables within the same upload.
 */
function detectRelationships(
  table: SourceTable,
  allTables: SourceTable[]
): ForeignKeyHint[] {
  const hints: ForeignKeyHint[] = [];

  for (const col of table.columns) {
    const name = col.name.toLowerCase();
    // Look for "TableNameId" or "table_name_id" patterns
    for (const other of allTables) {
      if (other.sheetName === table.sheetName && other.fileName === table.fileName) continue;
      const otherName = other.sheetName.toLowerCase().replace(/\s+/g, '');
      if (
        name === `${otherName}id` ||
        name === `${otherName}_id` ||
        name === `fk_${otherName}`
      ) {
        hints.push({
          sourceColumn: col.name,
          targetTable: other.sheetName,
          targetColumn: other.detectedKeys[0] ?? 'id',
          confidence: 0.7,
        });
      }
    }
  }

  return hints;
}

/**
 * Parse a single Excel workbook buffer into SourceTable[].
 */
function parseWorkbook(buffer: Buffer, fileName: string): SourceTable[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const tables: SourceTable[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
    });

    if (rows.length === 0) continue;

    // Build columns from first row keys
    const headerKeys = Object.keys(rows[0]);
    const columns: SourceColumn[] = headerKeys.map((name) => {
      const values = rows.map((r) => r[name]);
      const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
      return {
        name,
        inferredType: inferType(values),
        sampleValues: nonNull.slice(0, 5),
        nullable: nonNull.length < values.length,
      };
    });

    const sampleRows = rows.slice(0, 5);
    const detectedKeys = detectKeys(columns, rows);

    tables.push({
      fileName,
      sheetName,
      columns,
      sampleRows,
      rowCount: rows.length,
      detectedKeys,
      detectedRelationships: [], // filled in second pass
    });
  }

  return tables;
}

// Upload Excel files for a run
uploadRouter.post('/:runId', upload.array('files', 20), async (req, res) => {
  const { runId } = req.params;
  const run = runStorage.get(runId);

  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  // Parse all files
  const sourceFiles: SourceFile[] = [];
  const allTables: SourceTable[] = [];

  for (const file of files) {
    const tables = parseWorkbook(file.buffer, file.originalname);
    allTables.push(...tables);

    sourceFiles.push({
      id: uuidv4(),
      fileName: file.originalname,
      uploadedAt: new Date().toISOString(),
      tables,
    });
  }

  // Second pass: detect cross-table relationships
  for (const sf of sourceFiles) {
    for (const table of sf.tables) {
      table.detectedRelationships = detectRelationships(table, allTables);
    }
  }

  // Update run
  run.sourceFiles = [...run.sourceFiles, ...sourceFiles];
  run.status = 'uploaded';
  run.updatedAt = new Date().toISOString();
  runStorage.save(run);

  runStorage.addLog(runId, {
    id: uuidv4(),
    runId,
    timestamp: new Date().toISOString(),
    level: 'info',
    category: 'system',
    message: `Uploaded ${files.length} file(s) with ${allTables.length} table(s)`,
    details: {
      files: files.map((f) => f.originalname),
      totalRows: allTables.reduce((sum, t) => sum + t.rowCount, 0),
    },
  });

  res.json(sourceFiles);
});

// Remove a source file from a run
uploadRouter.delete('/:runId/:fileId', (req, res) => {
  const { runId, fileId } = req.params;
  const run = runStorage.get(runId);

  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  run.sourceFiles = run.sourceFiles.filter((f) => f.id !== fileId);
  if (run.sourceFiles.length === 0 && run.status === 'uploaded') {
    run.status = 'connected';
  }
  run.updatedAt = new Date().toISOString();
  runStorage.save(run);

  res.json({ success: true });
});
