export interface Run {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: RunStatus;
  environment: EnvironmentConfig;
  sourceFiles: SourceFile[];
  versions: RunVersion[];
  currentVersionId: string | null;
}

export type RunStatus =
  | 'draft'
  | 'connected'
  | 'uploaded'
  | 'analyzing'
  | 'analyzed'
  | 'approved'
  | 'generating'
  | 'completed'
  | 'error';

export interface EnvironmentConfig {
  url: string;
  validated: boolean;
  validatedAt: string | null;
}

export interface SourceFile {
  id: string;
  fileName: string;
  uploadedAt: string;
  tables: SourceTable[];
}

export interface SourceTable {
  fileName: string;
  sheetName: string;
  columns: SourceColumn[];
  sampleRows: Record<string, unknown>[];
  rowCount: number;
  detectedKeys: string[];
  detectedRelationships: ForeignKeyHint[];
}

export interface SourceColumn {
  name: string;
  inferredType: string;
  sampleValues: unknown[];
  nullable: boolean;
}

export interface ForeignKeyHint {
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  confidence: number;
}

export interface RunVersion {
  id: string;
  runId: string;
  versionNumber: number;
  createdAt: string;
  analysis: AnalysisResult | null;
  userEdits: UserEdit[];
  approval: Approval | null;
  generationJob: Job | null;
}

export interface AnalysisResult {
  recommendedSchema: DataverseSchemaProposal;
  mappings: SourceToDestMapping[];
  assumptions: string[];
  risks: Risk[];
  clarifyingQuestions: string[];
  nativeTableAlignment: NativeTableMapping[];
}

export interface DataverseSchemaProposal {
  tables: ProposedTable[];
  relationships: ProposedRelationship[];
}

export interface ProposedTable {
  logicalName: string;
  displayName: string;
  isNative: boolean;
  fields: ProposedField[];
}

export interface ProposedField {
  logicalName: string;
  displayName: string;
  type: string;
  required: boolean;
  isNew: boolean;
  description: string;
}

export interface ProposedRelationship {
  name: string;
  parentTable: string;
  childTable: string;
  parentField: string;
  childField: string;
  type: 'one-to-many' | 'many-to-one' | 'many-to-many';
}

export interface SourceToDestMapping {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  destinationTable: string;
  destinationColumn: string;
  transform: string | null;
  enabled: boolean;
}

export interface NativeTableMapping {
  sourceTable: string;
  nativeTable: string;
  confidence: number;
  reasoning: string;
}

export interface Risk {
  severity: 'high' | 'medium' | 'low';
  description: string;
  mitigation: string;
}

export interface UserEdit {
  id: string;
  timestamp: string;
  type: 'mapping-change' | 'field-change' | 'table-change' | 'feedback';
  description: string;
  payload: Record<string, unknown>;
}

export interface Approval {
  versionId: string;
  approvedAt: string;
  approvedBy: string;
}

export interface Job {
  id: string;
  type: 'analyze' | 'generate';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  steps: JobStep[];
  error: string | null;
}

export interface JobStep {
  id: string;
  action: string;
  target: string;
  details: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string | null;
  completedAt: string | null;
  output: string | null;
  error: string | null;
}

export interface LogEntry {
  id: string;
  runId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'analysis' | 'edit' | 'approval' | 'mcp' | 'system';
  message: string;
  details: Record<string, unknown> | null;
}
