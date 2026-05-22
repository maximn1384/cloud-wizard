import { useState, useEffect, useCallback } from 'react';
import {
  Title2,
  Text,
  Button,
  Card,
  Badge,
  Checkbox,
  Textarea,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Rocket20Regular,
  ArrowLeft20Regular,
  ArrowRight20Regular,
  Database20Regular,
  TableSimple20Regular,
  Wrench20Regular,
  Shield20Regular,
  Search20Regular,
  Clock20Regular,
} from '@fluentui/react-icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useRunStore } from '../../stores/runStore';
import { useUiStore } from '../../stores/uiStore';
import { api } from '../../services/api';
import type { BacklogItem, BacklogCategory, BacklogItemStatus } from '../../types/run';

const CATEGORY_ICON: Record<BacklogCategory, React.ReactElement> = {
  solution: <Rocket20Regular />,
  schema: <Database20Regular />,
  data: <TableSimple20Regular />,
  forms: <Wrench20Regular />,
  'business-rules': <Wrench20Regular />,
  security: <Shield20Regular />,
  sla: <Clock20Regular />,
  navigation: <Wrench20Regular />,
  validation: <Search20Regular />,
};

const STATUS_BADGE: Record<BacklogItemStatus, { color: 'informative' | 'success' | 'danger' | 'warning' | 'subtle'; label: string }> = {
  pending: { color: 'subtle', label: 'Pending' },
  ready: { color: 'informative', label: 'Ready' },
  'in-progress': { color: 'warning', label: 'Running...' },
  completed: { color: 'success', label: 'Done' },
  failed: { color: 'danger', label: 'Failed' },
  skipped: { color: 'subtle', label: 'Manual' },
};

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '960px' },
  header: { display: 'flex', alignItems: 'center', gap: '8px', color: tokens.colorBrandForeground1 },
  toolbar: { display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 0' },
  itemCard: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' },
  itemHeader: { display: 'flex', alignItems: 'center', gap: '8px' },
  itemName: { flex: 1, fontWeight: 600 },
  itemDesc: { color: tokens.colorNeutralForeground2, fontSize: '0.9em' },
  progressMsg: {
    padding: '4px 8px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: '0.85em',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    maxHeight: '120px',
    overflowY: 'auto' as const,
  },
  summary: {
    display: 'flex', gap: '16px', padding: '12px',
    backgroundColor: tokens.colorNeutralBackground2, borderRadius: tokens.borderRadiusMedium,
    flexWrap: 'wrap',
  },
  actions: { display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '8px' },
  emptyState: { padding: '32px', textAlign: 'center' as const, color: tokens.colorNeutralForeground2 },
});

export function GenerateStep() {
  const styles = useStyles();
  const { runId } = useParams();
  const navigate = useNavigate();
  const setStep = useUiStore((s) => s.setStep);
  const run = useRunStore((s) => s.runs.find((r) => r.id === runId));
  const setRun = useRunStore((s) => s.setRun);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [isDeploying, setIsDeploying] = useState(false);
  const [progressMessages, setProgressMessages] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStep('generate'); }, [setStep]);

  const currentVersion = run?.versions.find((v) => v.id === run?.currentVersionId);
  const backlog: BacklogItem[] = currentVersion?.solutionDesign?.backlog ?? [];
  const isApproved = !!currentVersion?.approval;

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleDeploy = useCallback((itemIds: string[]) => {
    if (!runId || !run?.environment.url || itemIds.length === 0) return;
    setIsDeploying(true);
    setError(null);
    setProgressMessages({});

    api.deployItems(
      runId,
      run.environment.url,
      itemIds,
      userNotes,
      (event) => {
        if ((event.type === 'item-status' || event.type === 'item-progress') && event.itemId) {
          setProgressMessages((prev) => ({
            ...prev,
            [event.itemId!]: [...(prev[event.itemId!] ?? []), event.message ?? ''],
          }));
        }
        if (event.type === 'done') {
          api.getRun(runId).then((updated) => setRun(updated));
          setIsDeploying(false);
        }
      },
      (errMsg) => { setError(errMsg); setIsDeploying(false); }
    );
  }, [runId, run, userNotes, setRun]);

  const completedCount = backlog.filter((i) => i.status === 'completed').length;
  const mcpCount = backlog.filter((i) => i.deploymentMethod === 'mcp').length;
  const manualCount = backlog.filter((i) => i.deploymentMethod === 'manual').length;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Rocket20Regular />
        <Title2>Deploy to Environment</Title2>
      </div>

      {!isApproved && (
        <MessageBar intent="warning">
          <MessageBarBody><MessageBarTitle>Not approved</MessageBarTitle>Approve the current version before deploying.</MessageBarBody>
        </MessageBar>
      )}
      {error && (
        <MessageBar intent="error">
          <MessageBarBody><MessageBarTitle>Error</MessageBarTitle>{error}</MessageBarBody>
        </MessageBar>
      )}

      {backlog.length === 0 ? (
        <div className={styles.emptyState}>
          <Text size={400}>No deployment backlog found.</Text>
          <br /><Text size={200}>Run Solution Design to generate a deployment backlog.</Text>
        </div>
      ) : (
        <>
          <div className={styles.summary}>
            <Text><strong>{backlog.length}</strong> items</Text>
            <Text>🔧 {mcpCount} automated</Text>
            <Text>📋 {manualCount} manual</Text>
            <Text>✅ {completedCount}/{backlog.length} done</Text>
            <Text>→ <strong>{run?.environment.url}</strong></Text>
          </div>

          <div className={styles.toolbar}>
            <Button size="small" onClick={() => setSelected(new Set(backlog.map((i) => i.id)))}>Select All</Button>
            <Button size="small" onClick={() => setSelected(new Set())}>Clear</Button>
            <div style={{ flex: 1 }} />
            <Button
              appearance="primary"
              icon={isDeploying ? <Spinner size="tiny" /> : <Rocket20Regular />}
              disabled={isDeploying || selected.size === 0 || !isApproved}
              onClick={() => handleDeploy(Array.from(selected))}
            >
              Deploy Selected ({selected.size})
            </Button>
          </div>

          {backlog.map((item) => {
            const catIcon = CATEGORY_ICON[item.category] ?? <Database20Regular />;
            const sb = STATUS_BADGE[item.status] ?? STATUS_BADGE.pending;
            const msgs = progressMessages[item.id] ?? [];

            return (
              <Card key={item.id} className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <Checkbox
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    disabled={isDeploying || item.status === 'completed'}
                  />
                  {catIcon}
                  <span className={styles.itemName}>{item.name}</span>
                  <Badge appearance="outline"
                    color={item.deploymentMethod === 'mcp' ? 'brand' : 'subtle'}
                  >
                    {item.deploymentMethod.toUpperCase()}
                  </Badge>
                  <Badge appearance="filled" color={sb.color}>
                    {item.status === 'in-progress' && <Spinner size="extra-tiny" />}
                    {sb.label}
                  </Badge>
                  {item.deploymentMethod === 'mcp' && item.status !== 'completed' && !isDeploying && (
                    <Button size="small" appearance="subtle"
                      onClick={() => handleDeploy([item.id])}
                      disabled={!isApproved}
                    >Deploy</Button>
                  )}
                </div>

                <Text className={styles.itemDesc}>{item.description}</Text>

                {item.dependencies.length > 0 && (
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    Depends on: {item.dependencies.join(', ')}
                  </Text>
                )}

                <Button size="small" appearance="transparent"
                  onClick={() => setExpandedNotes((p) => { const n = new Set(p); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; })}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {expandedNotes.has(item.id) ? '▼ Notes' : '▶ Add notes'}
                </Button>

                {expandedNotes.has(item.id) && (
                  <Textarea
                    value={userNotes[item.id] ?? item.userNotes ?? ''}
                    onChange={(_, d) => setUserNotes((p) => ({ ...p, [item.id]: d.value }))}
                    placeholder="Add guidance or overrides for this item..."
                    rows={2}
                    disabled={isDeploying}
                  />
                )}

                {item.deploymentMethod === 'manual' && item.manualInstructions && (
                  <div className={styles.progressMsg}>📋 {item.manualInstructions}</div>
                )}

                {msgs.length > 0 && (
                  <div className={styles.progressMsg}>{msgs.join('\n')}</div>
                )}

                {item.result && (
                  <div className={styles.progressMsg}>
                    {item.result.success ? '✅' : '⚠️'} {item.result.details}
                  </div>
                )}
              </Card>
            );
          })}
        </>
      )}

      <div className={styles.actions}>
        <Button icon={<ArrowLeft20Regular />} onClick={() => navigate(`/runs/${runId}/approve`)}>
          Back to Approve
        </Button>
        <Button appearance="primary" icon={<ArrowRight20Regular />} iconPosition="after"
          onClick={() => navigate(`/runs/${runId}/logs`)}
        >View Logs</Button>
      </div>
    </div>
  );
}
