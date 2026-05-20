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
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  CheckmarkCircle20Regular,
  CheckmarkCircle20Filled,
  LockClosed20Regular,
  ArrowRight20Regular,
  ArrowLeft20Regular,
  Warning20Regular,
} from '@fluentui/react-icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useRunStore } from '../../stores/runStore';
import { useUiStore } from '../../stores/uiStore';
import { api } from '../../services/api';
import { getAccount } from '../../services/auth';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    maxWidth: '880px',
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
  lockBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: tokens.colorPaletteGreenBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
  },
  approvedIcon: {
    color: tokens.colorPaletteGreenForeground1,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'space-between',
    marginTop: '8px',
  },
});

export function ApproveStep() {
  const styles = useStyles();
  const { runId } = useParams();
  const navigate = useNavigate();
  const setStep = useUiStore((s) => s.setStep);

  const run = useRunStore((s) => s.runs.find((r) => r.id === runId));
  const setRun = useRunStore((s) => s.setRun);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setStep('approve');
  }, [setStep]);

  const versions = run?.versions ?? [];
  const currentVersion =
    versions.find((v) => v.id === run?.currentVersionId) ??
    versions[versions.length - 1];

  const draft = currentVersion?.requirementsDraft;
  const design = currentVersion?.solutionDesign;
  const approval = currentVersion?.approval ?? null;
  const isApproved = !!approval;

  const handleApprove = useCallback(async () => {
    if (!runId || !currentVersion) return;
    setSubmitting(true);
    setError(null);
    try {
      const account = await getAccount();
      const approvedBy =
        account?.username ?? account?.name ?? 'unknown';
      await api.approve(runId, currentVersion.id, approvedBy);
      const updated = await api.getRun(runId);
      setRun(updated);
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setSubmitting(false);
    }
  }, [runId, currentVersion, setRun]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <CheckmarkCircle20Regular />
        <Title2>Approve for Deployment</Title2>
      </div>
      <Text>
        Review the solution design summary and approve to proceed with generation.
        Approval locks this version and enables artifact generation in your Dynamics
        365 environment.
      </Text>

      {!currentVersion && (
        <MessageBar intent="warning">
          <MessageBarBody>
            <MessageBarTitle>No version to approve</MessageBarTitle>
            Run analysis first to produce a version that can be approved.
          </MessageBarBody>
        </MessageBar>
      )}

      {currentVersion && (
        <Card className={styles.summaryCard}>
          <CardHeader
            header={
              <Title3>
                Version v{currentVersion.versionNumber}{' '}
                {isApproved && (
                  <Badge appearance="filled" color="success" icon={<LockClosed20Regular />}>
                    locked
                  </Badge>
                )}
              </Title3>
            }
          />
          <div className={styles.summaryGrid}>
            <span className={styles.label}>Run</span>
            <span>{run?.name}</span>

            <span className={styles.label}>Environment</span>
            <span>{run?.environment.url || <em>not set</em>}</span>

            <span className={styles.label}>Source files</span>
            <span>{run?.sourceFiles.length ?? 0}</span>

            <span className={styles.label}>Migration-Analyst</span>
            <span>{draft ? new Date(draft.generatedAt).toLocaleString() : '—'}</span>

            <span className={styles.label}>Solution-Architect</span>
            <span>{design ? new Date(design.generatedAt).toLocaleString() : '—'}</span>

            {design?.userGuidance && (
              <>
                <span className={styles.label}>Design guidance</span>
                <span>{design.userGuidance}</span>
              </>
            )}
          </div>
        </Card>
      )}

      {isApproved && approval && (
        <div className={styles.lockBanner}>
          <CheckmarkCircle20Filled className={styles.approvedIcon} />
          <div>
            <Text weight="semibold">Approved</Text>
            <br />
            <Text size={200}>
              by <strong>{approval.approvedBy}</strong> on{' '}
              {new Date(approval.approvedAt).toLocaleString()}
            </Text>
          </div>
        </div>
      )}

      {!draft && currentVersion && (
        <MessageBar intent="warning">
          <MessageBarBody>
            <MessageBarTitle>No requirements draft</MessageBarTitle>
            Run analysis on the previous step before approving.
          </MessageBarBody>
        </MessageBar>
      )}

      {!design && currentVersion && (
        <MessageBar intent="warning">
          <MessageBarBody>
            <MessageBarTitle>No solution design</MessageBarTitle>
            Run solution design before approving.
          </MessageBarBody>
        </MessageBar>
      )}

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>
            <MessageBarTitle>Approval failed</MessageBarTitle>
            {error}
          </MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.actions}>
        <Button
          icon={<ArrowLeft20Regular />}
          onClick={() => navigate(`/runs/${runId}/design`)}
        >
          Back to Solution Design
        </Button>

        {!isApproved ? (
          <Dialog open={confirmOpen} onOpenChange={(_, d) => setConfirmOpen(d.open)}>
            <DialogTrigger disableButtonEnhancement>
              <Button
                appearance="primary"
                icon={<CheckmarkCircle20Regular />}
                disabled={!design || submitting}
              >
                Approve for Generation
              </Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>
                  <Warning20Regular style={{ verticalAlign: 'middle', marginRight: 8 }} />
                  Confirm approval
                </DialogTitle>
                <DialogContent>
                  <Text>
                    You are about to approve <strong>v{currentVersion?.versionNumber}</strong> of{' '}
                    <strong>{run?.name}</strong>. This locks the version — no
                    further edits or re-analysis are allowed. Generation can then
                    apply the schema to:
                  </Text>
                  <br />
                  <br />
                  <Text>
                    <strong>{run?.environment.url}</strong>
                  </Text>
                </DialogContent>
                <DialogActions>
                  <Button
                    appearance="secondary"
                    disabled={submitting}
                    onClick={() => setConfirmOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    appearance="primary"
                    icon={submitting ? <Spinner size="tiny" /> : <CheckmarkCircle20Regular />}
                    disabled={submitting}
                    onClick={handleApprove}
                  >
                    {submitting ? 'Approving…' : 'Approve & Lock'}
                  </Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
        ) : (
          <Button
            appearance="primary"
            icon={<ArrowRight20Regular />}
            iconPosition="after"
            onClick={() => navigate(`/runs/${runId}/generate`)}
          >
            Continue to Generate
          </Button>
        )}
      </div>
    </div>
  );
}
