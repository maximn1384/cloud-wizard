import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Title2,
  Title3,
  Text,
  Button,
  Card,
  CardHeader,
  Badge,
  Spinner,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  makeStyles,
  tokens,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
} from '@fluentui/react-components';
import {
  ArrowUpload20Regular,
  Document20Regular,
  Delete20Regular,
  ArrowRight20Regular,
  ArrowLeft20Regular,
  TableSimple20Regular,
  Link20Regular,
} from '@fluentui/react-icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useRunStore } from '../../stores/runStore';
import { useUiStore } from '../../stores/uiStore';
import { api } from '../../services/api';
import type { SourceFile, SourceTable } from '../../types/run';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '900px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: tokens.colorBrandForeground1,
  },
  dropZone: {
    border: `2px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: '48px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      borderColor: tokens.colorBrandStroke1,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  dropZoneActive: {
    border: `2px dashed ${tokens.colorBrandStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: '48px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    backgroundColor: tokens.colorBrandBackground2,
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tableSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sampleTable: {
    maxHeight: '200px',
    overflow: 'auto',
  },
  relationships: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '4px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'space-between',
    marginTop: '8px',
  },
});

export function UploadStep() {
  const styles = useStyles();
  const { runId } = useParams();
  const navigate = useNavigate();
  const setStep = useUiStore((s) => s.setStep);

  const run = useRunStore((s) => s.runs.find((r) => r.id === runId));
  const addSourceFiles = useRunStore((s) => s.addSourceFiles);
  const removeSourceFile = useRunStore((s) => s.removeSourceFile);
  const updateRunStatus = useRunStore((s) => s.updateRunStatus);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStep('upload');
  }, [setStep]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!runId) return;
      const excelFiles = Array.from(files).filter(
        (f) =>
          f.name.endsWith('.xlsx') ||
          f.name.endsWith('.xls') ||
          f.name.endsWith('.csv')
      );
      if (excelFiles.length === 0) {
        setError('Please upload Excel (.xlsx, .xls) or CSV files.');
        return;
      }

      setUploading(true);
      setError(null);
      try {
        const result = await api.uploadFiles(runId, excelFiles);
        addSourceFiles(runId, result);
        updateRunStatus(runId, 'uploaded');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [runId, addSourceFiles, updateRunStatus]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleRemoveFile = useCallback(
    async (fileId: string) => {
      if (!runId) return;
      try {
        await fetch(`/api/upload/${runId}/${fileId}`, { method: 'DELETE' });
        removeSourceFile(runId, fileId);
      } catch {
        // silent fail for remove
      }
    },
    [runId, removeSourceFile]
  );

  const sourceFiles = run?.sourceFiles ?? [];
  const hasFiles = sourceFiles.length > 0;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <ArrowUpload20Regular />
        <Title2>Upload Source Data</Title2>
      </div>
      <Text>
        Upload Excel files containing the source application data. The system
        will parse table structures, detect column types, and identify
        relationships automatically.
      </Text>

      {/* Drop zone */}
      <div
        className={dragOver ? styles.dropZoneActive : styles.dropZone}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <ArrowUpload20Regular style={{ fontSize: '32px' }} />
        <Text size={400} weight="semibold">
          {uploading ? 'Uploading...' : 'Drag & drop Excel files here'}
        </Text>
        <Text size={200}>or click to browse (.xlsx, .xls, .csv)</Text>
        {uploading && <Spinner size="small" />}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>
            <MessageBarTitle>Upload Error</MessageBarTitle>
            {error}
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Uploaded files list */}
      {hasFiles && (
        <div className={styles.fileList}>
          <Title3>Uploaded Files</Title3>
          {sourceFiles.map((sf) => (
            <div key={sf.id} className={styles.fileItem}>
              <div className={styles.fileInfo}>
                <Document20Regular />
                <Text weight="semibold">{sf.fileName}</Text>
                <Badge appearance="outline" size="small">
                  {sf.tables.length} table{sf.tables.length !== 1 ? 's' : ''}
                </Badge>
                <Badge appearance="outline" size="small" color="informative">
                  {sf.tables.reduce((s, t) => s + t.rowCount, 0)} rows
                </Badge>
              </div>
              <Button
                icon={<Delete20Regular />}
                appearance="subtle"
                size="small"
                onClick={() => handleRemoveFile(sf.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Parsed data review */}
      {hasFiles && (
        <div className={styles.tableSection}>
          <Title3>Parsed Tables</Title3>
          <Accordion multiple collapsible>
            {sourceFiles.flatMap((sf) =>
              sf.tables.map((table, idx) => (
                <AccordionItem
                  key={`${sf.id}-${idx}`}
                  value={`${sf.id}-${idx}`}
                >
                  <AccordionHeader>
                    <div className={styles.tableHeader}>
                      <TableSimple20Regular />
                      <Text weight="semibold">
                        {table.sheetName}
                      </Text>
                      <Badge size="small" appearance="outline">
                        {table.columns.length} cols
                      </Badge>
                      <Badge size="small" appearance="outline" color="informative">
                        {table.rowCount} rows
                      </Badge>
                      {table.detectedKeys.length > 0 && (
                        <Badge size="small" appearance="filled" color="success">
                          PK: {table.detectedKeys.join(', ')}
                        </Badge>
                      )}
                    </div>
                  </AccordionHeader>
                  <AccordionPanel>
                    <TablePreview table={table} />
                    {table.detectedRelationships.length > 0 && (
                      <div className={styles.relationships}>
                        <Link20Regular />
                        <Text size={200} weight="semibold">
                          Detected relationships:
                        </Text>
                        {table.detectedRelationships.map((rel, i) => (
                          <Badge key={i} appearance="outline" size="small">
                            {rel.sourceColumn} → {rel.targetTable}.
                            {rel.targetColumn} ({Math.round(rel.confidence * 100)}%)
                          </Badge>
                        ))}
                      </div>
                    )}
                  </AccordionPanel>
                </AccordionItem>
              ))
            )}
          </Accordion>
        </div>
      )}

      {/* Navigation */}
      <div className={styles.actions}>
        <Button
          icon={<ArrowLeft20Regular />}
          appearance="subtle"
          onClick={() => {
            if (runId) navigate(`/runs/${runId}/connect`);
          }}
        >
          Back
        </Button>
        <Button
          appearance="primary"
          icon={<ArrowRight20Regular />}
          iconPosition="after"
          onClick={() => {
            if (runId) {
              setStep('analyze');
              navigate(`/runs/${runId}/analyze`);
            }
          }}
          disabled={!hasFiles}
        >
          Next: AI Analysis
        </Button>
      </div>

      {!hasFiles && (
        <MessageBar intent="info">
          <MessageBarBody>
            Upload at least one Excel file to proceed to the analysis step.
          </MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}

/**
 * Preview component showing columns + sample rows for a parsed table.
 */
function TablePreview({ table }: { table: SourceTable }) {
  return (
    <div style={{ overflow: 'auto', maxHeight: '250px', marginTop: '8px' }}>
      <Table size="small">
        <TableHeader>
          <TableRow>
            {table.columns.map((col) => (
              <TableHeaderCell key={col.name}>
                <div>
                  <Text size={200} weight="semibold">
                    {col.name}
                  </Text>
                  <br />
                  <Badge size="small" appearance="ghost">
                    {col.inferredType}
                  </Badge>
                </div>
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.sampleRows.map((row, i) => (
            <TableRow key={i}>
              {table.columns.map((col) => (
                <TableCell key={col.name}>
                  <Text size={200}>
                    {row[col.name] === null || row[col.name] === undefined
                      ? '—'
                      : String(row[col.name])}
                  </Text>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
