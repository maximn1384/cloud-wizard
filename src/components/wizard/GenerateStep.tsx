import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Title2,
  Title3,
  Text,
  Button,
  Card,
  CardHeader,
  Badge,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Rocket20Regular,
  ArrowLeft20Regular,
  ArrowRight20Regular,
  CheckmarkCircle20Filled,
} from '@fluentui/react-icons';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRunStore } from '../../stores/runStore';
import { useUiStore } from '../../stores/uiStore';
import { api } from '../../services/api';

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
  summaryCard: {
    padding: '20px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: '180px 1fr',
    gap: '8px 16px',
    marginTop: '8px',
  },
  label: {
    color: tokens.colorNeutralForeground2,
    fontWeight: 600,
  },
  reportCard: {
    padding: '20px',
    minHeight: '200px',
    maxHeight: '500px',
    overflowY: 'auto' as const,
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
    '& th': { backgroundColor: tokens.colorNeutralBackground2, fontWeight: 600 },
    '& code': {
      backgroundColor: tokens.colorNeutralBackground3,
      padding: '2px 4px',
      borderRadius: '3px',
      fontSize: '0.9em',
    },
    '& pre': {
      backgroundColor: tokens.colorNeutralBackground3,
      padding: '12px',
      borderRadius: tokens.borderRadiusMedium,
      overflowX: 'auto',
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
  spinnerContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '20px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  completedBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: tokens.colorPaletteGreenBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
  },
  completedIcon: {
    color: tokens.colorPaletteGreenForeground1,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'space-between',
    marginTop: '8px',
  },
});

export function GenerateStep() {
  const styles = useStyles();
  const { runId } = useParams();
  const navigate = useNavigate();
  const setStep = useUiStore((s) => s.setStep);

  const run = useRunStore((s) => s.runs.find((r) => r.id === runId));
  const setRun = useRunStore((s) => s.setRun);

  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<AbortController | null>(null);
  const streamEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setStep('generate');
  }, [setStep]);

  // Auto-scroll to bottom as streaming text arrives
  useEffect(() => {
    if (isGenerating && streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamText, isGenerating]);

  const versions = run?.versions ?? [];
  const currentVersion =
    versions.find((v) => v.id === run?.currentVersionId) ??
    versions[versions.length - 1];

  const design = currentVersion?.solutionDesign;
  const approval = currentVersion?.approval;
  const generationResult = (currentVersion as any)?.generationResult;
  const isApproved = !!approval;
  const isCompleted = !!generationResult && !isGenerating;

  const handleGenerate = useCallback(() => {
    if (!runId) return;
    setIsGenerating(true);
    setStreamText('');
    setError(null);

    const controller = api.generateStream(
      runId,
      (delta) => {
        setStreamText((prev) => prev + delta);
      },
      async () => {
        const updated = await api.getRun(runId);
        setRun(updated);
        setIsGenerating(false);
      },
      (errMsg) => {
        setError(errMsg);
        setIsGenerating(false);
      }
    );
    streamRef.current = controller;
  }, [runId, setRun]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Rocket20Regular />
        <Title2>Generate Artifacts</Title2>
      </div>
      <Text>
        The Solution-Builder agent will execute the approved design in your target
        Dynamics 365 environment using Dataverse MCP tools. The agent inspects the
        environment, deploys schema changes, creates relationships, and verifies
        results — adapting if it encounters issues.
      </Text>

      {!isApproved && (
        <MessageBar intent="warning">
          <MessageBarBody>
            <MessageBarTitle>Not approved</MessageBarTitle>
            The current version must be approved before generation can proceed.
            Go back to the Approve step.
          </MessageBarBody>
        </MessageBar>
      )}

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>
            <MessageBarTitle>Generation failed</MessageBarTitle>
            {error}
          </MessageBarBody>
        </MessageBar>
      )}

      {currentVersion && (
        <Card className={styles.summaryCard}>
          <CardHeader
            header={
              <Title3>
                Deployment Target{' '}
                {isCompleted && (
                  <Badge appearance="filled" color="success">
                    deployed
                  </Badge>
                )}
              </Title3>
            }
          />
          <div className={styles.summaryGrid}>
            <span className={styles.label}>Environment</span>
            <span>{run?.environment.url || <em>not set</em>}</span>

            <span className={styles.label}>Design agent</span>
            <span>{design?.agentName ?? '—'}</span>

            <span className={styles.label}>Design generated</span>
            <span>{design ? new Date(design.generatedAt).toLocaleString() : '—'}</span>

            <span className={styles.label}>Approved by</span>
            <span>
              {approval
                ? `${approval.approvedBy} on ${new Date(approval.approvedAt).toLocaleString()}`
                : '—'}
            </span>

            {isCompleted && (
              <>
                <span className={styles.label}>Deployed at</span>
                <span>{new Date(generationResult.generatedAt).toLocaleString()}</span>
              </>
            )}
          </div>
        </Card>
      )}

      {isGenerating && (
        <Card className={styles.reportCard}>
          <CardHeader
            header={
              <Title3>
                <span style={{ color: tokens.colorBrandForeground1 }}>
                  ● Solution-Builder is deploying...
                </span>
              </Title3>
            }
          />
          <div className={styles.markdown}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {streamText || '_Connecting to agent..._'}
            </ReactMarkdown>
            <div ref={streamEndRef} />
          </div>
        </Card>
      )}

      {isCompleted && (
        <>
          <div className={styles.completedBanner}>
            <CheckmarkCircle20Filled className={styles.completedIcon} />
            <div>
              <Text weight="semibold">Deployment Complete</Text>
              <br />
              <Text size={200}>
                The Solution-Builder agent has finished deploying to{' '}
                <strong>{generationResult.environmentUrl}</strong>
              </Text>
            </div>
          </div>

          <Card className={styles.reportCard}>
            <CardHeader
              header={
                <Title3>
                  Deployment Report —{' '}
                  <span style={{ color: tokens.colorNeutralForeground2 }}>
                    {generationResult.agentName} ·{' '}
                    {new Date(generationResult.generatedAt).toLocaleString()}
                  </span>
                </Title3>
              }
            />
            <div className={styles.markdown}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {generationResult.markdown}
              </ReactMarkdown>
            </div>
          </Card>
        </>
      )}

      {!isGenerating && !isCompleted && isApproved && (
        <Button
          appearance="primary"
          icon={<Rocket20Regular />}
          onClick={handleGenerate}
          size="large"
        >
          Deploy to Environment
        </Button>
      )}

      {!isGenerating && isCompleted && (
        <Button
          appearance="secondary"
          icon={<Rocket20Regular />}
          onClick={handleGenerate}
        >
          Re-deploy
        </Button>
      )}

      <div className={styles.actions}>
        <Button
          icon={<ArrowLeft20Regular />}
          onClick={() => navigate(`/runs/${runId}/approve`)}
        >
          Back to Approve
        </Button>
        <Button
          appearance="primary"
          icon={<ArrowRight20Regular />}
          iconPosition="after"
          onClick={() => navigate(`/runs/${runId}/logs`)}
          disabled={!isCompleted}
        >
          View Logs
        </Button>
      </div>
    </div>
  );
}
