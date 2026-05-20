import { useState, useEffect } from 'react';
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
  Textarea,
  Spinner,
  Tab,
  TabList,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  DesignIdeas20Regular,
  ArrowRight20Regular,
  ArrowLeft20Regular,
  History20Regular,
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
  versionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  card: {
    padding: '20px',
    minHeight: '200px',
  },
  guidanceSection: {
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
  },
  guidanceTextarea: {
    marginTop: '8px',
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
  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'space-between',
    marginTop: '8px',
  },
  designButtonGroup: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  spinnerContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
});

export function SolutionDesignStep() {
  const styles = useStyles();
  const { runId } = useParams();
  const navigate = useNavigate();
  const setStep = useUiStore((s) => s.setStep);

  const run = useRunStore((s) => s.runs.find((r) => r.id === runId));
  const updateRun = useRunStore((s) => s.updateRun);

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [guidance, setGuidance] = useState('');
  const [isDesigning, setIsDesigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStep('design');
  }, [setStep]);

  useEffect(() => {
    if (run?.currentVersionId && !selectedVersionId) {
      setSelectedVersionId(run.currentVersionId);
    }
  }, [run?.currentVersionId, selectedVersionId]);

  const versions = run?.versions ?? [];
  const currentVersion =
    versions.find((v) => v.id === selectedVersionId) ?? versions[versions.length - 1];
  const requirementsDraft = currentVersion?.requirementsDraft;
  const solutionDesign = currentVersion?.solutionDesign;

  const handleDesign = async () => {
    if (!runId) return;
    setIsDesigning(true);
    setError(null);

    try {
      const version = await api.design(runId, guidance || undefined);
      updateRun({ ...run!, versions: run!.versions.map((v) => (v.id === version.id ? version : v)), currentVersionId: version.id });
      setGuidance('');
      setSelectedVersionId(version.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Design failed';
      setError(message);
    } finally {
      setIsDesigning(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <DesignIdeas20Regular />
        <Title2>Solution Design</Title2>
      </div>
      <Text>
        Transform the requirements into a concrete Dynamics 365 solution design. The
        Solution-Architect agent will produce field definitions, entity mappings,
        relationships, and MCP-ready deployment steps.
      </Text>

      {versions.length === 0 && (
        <MessageBar intent="warning">
          <MessageBarBody>
            <MessageBarTitle>No analysis yet</MessageBarTitle>
            Run analysis on the previous step before designing a solution.
          </MessageBarBody>
        </MessageBar>
      )}

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>
            <MessageBarTitle>Design failed</MessageBarTitle>
            {error}
          </MessageBarBody>
        </MessageBar>
      )}

      {versions.length > 1 && (
        <div className={styles.versionBar}>
          <History20Regular />
          <Text weight="semibold">Versions:</Text>
          <TabList
            selectedValue={currentVersion?.id ?? versions[0].id}
            onTabSelect={(_, d) => setSelectedVersionId(d.value as string)}
            size="small"
          >
            {versions.map((v, i) => (
              <Tab key={v.id} value={v.id}>
                v{i + 1}
              </Tab>
            ))}
          </TabList>
          {currentVersion?.id === run?.currentVersionId && (
            <Badge appearance="filled" color="brand">
              current
            </Badge>
          )}
        </div>
      )}

      {requirementsDraft && (
        <Card className={styles.card}>
          <CardHeader
            header={
              <Title3>
                Requirements Draft (Reference) —{' '}
                <span style={{ color: tokens.colorNeutralForeground2 }}>
                  {requirementsDraft.agentName}
                </span>
              </Title3>
            }
          />
          <div
            className={styles.markdown}
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
              paddingTop: '12px',
              marginTop: '8px',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {requirementsDraft.markdown}
            </ReactMarkdown>
          </div>
        </Card>
      )}

      <div className={styles.guidanceSection}>
        <Text weight="semibold">Design Guidance (optional)</Text>
        <Text size={200} style={{ marginBottom: '8px', color: tokens.colorNeutralForeground2 }}>
          Provide design preferences, priorities, or constraints for the Solution-Architect agent.
          Examples: "Prefer custom entities," "Map to native Account table," "Prioritize workflow X"
        </Text>
        <Textarea
          className={styles.guidanceTextarea}
          value={guidance}
          onChange={(_, data) => setGuidance(data.value)}
          placeholder="Enter any design guidance here..."
          disabled={isDesigning}
          rows={4}
        />
      </div>

      {isDesigning && (
        <div className={styles.spinnerContainer}>
          <Spinner size="small" />
          <Text>Generating solution design...</Text>
        </div>
      )}

      {solutionDesign && (
        <Card className={styles.card}>
          <CardHeader
            header={
              <Title3>
                Solution Design —{' '}
                <span style={{ color: tokens.colorNeutralForeground2 }}>
                  {solutionDesign.agentName} ·{' '}
                  {new Date(solutionDesign.generatedAt).toLocaleString()}
                </span>
              </Title3>
            }
          />
          <div className={styles.markdown}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {solutionDesign.markdown}
            </ReactMarkdown>
          </div>
        </Card>
      )}

      {!solutionDesign && !isDesigning && (
        <MessageBar intent="info">
          <MessageBarBody>
            <MessageBarTitle>No solution design yet</MessageBarTitle>
            Click "Design Solution" below to generate a design based on the requirements.
          </MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.designButtonGroup}>
        <Button
          appearance="primary"
          onClick={handleDesign}
          disabled={isDesigning || !requirementsDraft}
        >
          {solutionDesign ? 'Re-design' : 'Design Solution'}
        </Button>
      </div>

      <div className={styles.actions}>
        <Button
          icon={<ArrowLeft20Regular />}
          onClick={() => navigate(`/runs/${runId}/analyze`)}
        >
          Back to Analyze
        </Button>
        <Button
          appearance="primary"
          icon={<ArrowRight20Regular />}
          iconPosition="after"
          onClick={() => navigate(`/runs/${runId}/approve`)}
          disabled={!solutionDesign}
        >
          Continue to Approve
        </Button>
      </div>
    </div>
  );
}
