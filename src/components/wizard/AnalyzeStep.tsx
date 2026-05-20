import { useState, useEffect, useCallback } from 'react';
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
  Textarea,
  Field,
  Tab,
  TabList,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  BrainCircuit20Regular,
  Play20Regular,
  ArrowRight20Regular,
  ArrowLeft20Regular,
  History20Regular,
  ArrowSync20Regular,
} from '@fluentui/react-icons';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRunStore } from '../../stores/runStore';
import { useUiStore } from '../../stores/uiStore';
import { api } from '../../services/api';
import type { RunVersion } from '../../types/run';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    maxWidth: '960px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: tokens.colorBrandForeground1,
  },
  controls: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  versionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  draftCard: {
    padding: '20px',
    minHeight: '300px',
  },
  markdown: {
    '& h1': { fontSize: '1.5rem', fontWeight: 600, marginTop: '1em' },
    '& h2': { fontSize: '1.25rem', fontWeight: 600, marginTop: '1em' },
    '& h3': { fontSize: '1.1rem', fontWeight: 600, marginTop: '0.8em' },
    '& table': {
      borderCollapse: 'collapse',
      width: '100%',
      margin: '1em 0',
    },
    '& th, & td': {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      padding: '6px 10px',
      textAlign: 'left',
    },
    '& th': {
      backgroundColor: tokens.colorNeutralBackground2,
      fontWeight: 600,
    },
    '& code': {
      backgroundColor: tokens.colorNeutralBackground2,
      padding: '2px 6px',
      borderRadius: tokens.borderRadiusSmall,
      fontFamily: tokens.fontFamilyMonospace,
      fontSize: '0.9em',
    },
    '& pre': {
      backgroundColor: tokens.colorNeutralBackground2,
      padding: '12px',
      borderRadius: tokens.borderRadiusMedium,
      overflow: 'auto',
    },
    '& ul, & ol': { paddingLeft: '1.5em' },
    '& li': { margin: '0.25em 0' },
    '& blockquote': {
      borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
      paddingLeft: '12px',
      color: tokens.colorNeutralForeground2,
      margin: '0.5em 0',
    },
  },
  feedbackSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'space-between',
    marginTop: '8px',
  },
});

export function AnalyzeStep() {
  const styles = useStyles();
  const { runId } = useParams();
  const navigate = useNavigate();
  const setStep = useUiStore((s) => s.setStep);

  const run = useRunStore((s) => s.runs.find((r) => r.id === runId));
  const setRun = useRunStore((s) => s.setRun);

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  useEffect(() => {
    setStep('analyze');
  }, [setStep]);

  // Default to current version on load
  useEffect(() => {
    if (run?.currentVersionId && !selectedVersionId) {
      setSelectedVersionId(run.currentVersionId);
    }
  }, [run?.currentVersionId, selectedVersionId]);

  const versions = run?.versions ?? [];
  const currentVersion: RunVersion | undefined =
    versions.find((v) => v.id === selectedVersionId) ?? versions[versions.length - 1];

  const handleAnalyze = useCallback(async () => {
    if (!runId) return;
    setAnalyzing(true);
    setError(null);
    try {
      const newVersion = await api.analyze(runId, feedback.trim() || undefined);
      const updated = await api.getRun(runId);
      setRun(updated);
      setSelectedVersionId(newVersion.id);
      setFeedback('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [runId, feedback, setRun]);

  const hasFiles = (run?.sourceFiles ?? []).length > 0;
  const hasVersions = versions.length > 0;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <BrainCircuit20Regular />
        <Title2>AI Analysis — Requirements Draft</Title2>
      </div>
      <Text>
        Run the <strong>Migration-Analyst</strong> agent on Azure AI Foundry. It will
        analyze your uploaded source data and produce a structured requirements
        specification draft (entities, attributes, relationships, business processes,
        data quality issues, and open questions).
      </Text>

      {!hasFiles && (
        <MessageBar intent="warning">
          <MessageBarBody>
            <MessageBarTitle>No source data</MessageBarTitle>
            Upload Excel files first on the previous step.
          </MessageBarBody>
        </MessageBar>
      )}

      {hasFiles && (
        <Card className={styles.draftCard}>
          <CardHeader
            header={
              <div className={styles.controls}>
                <Title3>
                  {hasVersions
                    ? `Re-analyze (creates v${versions.length + 1})`
                    : 'Run Analysis'}
                </Title3>
              </div>
            }
          />
          <div className={styles.feedbackSection}>
            <Field
              label={
                hasVersions
                  ? 'Feedback for re-analysis (optional)'
                  : 'Initial guidance (optional)'
              }
              hint="Tell the agent what to focus on, correct, or refine in this iteration."
            >
              <Textarea
                value={feedback}
                onChange={(_, d) => setFeedback(d.value)}
                placeholder={
                  hasVersions
                    ? 'e.g. "Treat the Status field on Cases as a lifecycle state with values New, Open, Resolved"'
                    : 'e.g. "Focus on customer service entities"'
                }
                rows={3}
                disabled={analyzing}
              />
            </Field>
            <div>
              <Button
                appearance="primary"
                icon={
                  analyzing ? (
                    <Spinner size="tiny" />
                  ) : hasVersions ? (
                    <ArrowSync20Regular />
                  ) : (
                    <Play20Regular />
                  )
                }
                onClick={handleAnalyze}
                disabled={analyzing || !hasFiles}
              >
                {analyzing
                  ? 'Analyzing... (may take 30-60s)'
                  : hasVersions
                    ? 'Re-analyze'
                    : 'Run Analysis'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>
            <MessageBarTitle>Analysis Failed</MessageBarTitle>
            {error}
          </MessageBarBody>
        </MessageBar>
      )}

      {versions.length > 1 && (
        <div className={styles.versionBar}>
          <History20Regular />
          <Text weight="semibold">Versions:</Text>
          <TabList
            selectedValue={selectedVersionId ?? versions[versions.length - 1].id}
            onTabSelect={(_, d) => setSelectedVersionId(d.value as string)}
            size="small"
          >
            {versions.map((v) => (
              <Tab key={v.id} value={v.id}>
                v{v.versionNumber}
              </Tab>
            ))}
          </TabList>
        </div>
      )}

      {currentVersion?.requirementsDraft && (
        <Card className={styles.draftCard}>
          <CardHeader
            header={
              <div className={styles.controls}>
                <Title3>Requirements Draft — v{currentVersion.versionNumber}</Title3>
                <Badge appearance="filled" color="brand">
                  {currentVersion.requirementsDraft.agentName}
                </Badge>
                <Badge appearance="outline" size="small">
                  {new Date(currentVersion.requirementsDraft.generatedAt).toLocaleString()}
                </Badge>
              </div>
            }
          />
          {currentVersion.requirementsDraft.userFeedback && (
            <MessageBar intent="info" style={{ marginBottom: '12px' }}>
              <MessageBarBody>
                <MessageBarTitle>User feedback applied</MessageBarTitle>
                {currentVersion.requirementsDraft.userFeedback}
              </MessageBarBody>
            </MessageBar>
          )}
          <div className={styles.markdown}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {currentVersion.requirementsDraft.markdown}
            </ReactMarkdown>
          </div>
        </Card>
      )}

      {hasFiles && !hasVersions && !analyzing && (
        <MessageBar intent="info">
          <MessageBarBody>
            Click <strong>Run Analysis</strong> to generate the first requirements
            draft. Subsequent runs will create new versions you can compare.
          </MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.actions}>
        <Button
          icon={<ArrowLeft20Regular />}
          appearance="subtle"
          onClick={() => {
            if (runId) navigate(`/runs/${runId}/upload`);
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
              setStep('review');
              navigate(`/runs/${runId}/design`);
            }
          }}
          disabled={!hasVersions}
        >
          Next: Review
        </Button>
      </div>
    </div>
  );
}
