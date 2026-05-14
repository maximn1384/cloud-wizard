import { useState, useEffect, useCallback } from 'react';
import {
  Title2,
  Text,
  Input,
  Button,
  Field,
  Card,
  CardHeader,
  Badge,
  Spinner,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  makeStyles,
  tokens,
  Persona,
} from '@fluentui/react-components';
import {
  PlugConnected20Regular,
  Checkmark20Regular,
  Dismiss20Regular,
  ArrowRight20Regular,
  Edit20Regular,
  PersonAccounts20Regular,
  SignOut20Regular,
} from '@fluentui/react-icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useRunStore } from '../../stores/runStore';
import { useUiStore } from '../../stores/uiStore';
import { api } from '../../services/api';
import { signIn, signOut, getAccount } from '../../services/auth';
import type { AccountInfo } from '@azure/msal-browser';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '720px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: tokens.colorBrandForeground1,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  urlRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'end',
  },
  urlInput: {
    flex: 1,
  },
  statusCard: {
    padding: '16px',
  },
  statusHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tableList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '8px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    marginTop: '8px',
  },
});

export function ConnectStep() {
  const styles = useStyles();
  const { runId } = useParams();
  const navigate = useNavigate();
  const setStep = useUiStore((s) => s.setStep);

  const run = useRunStore((s) => s.runs.find((r) => r.id === runId));
  const setEnvironment = useRunStore((s) => s.setEnvironment);
  const updateRunStatus = useRunStore((s) => s.updateRunStatus);

  const [runName, setRunName] = useState(run?.name ?? 'New Migration Run');
  const [envUrl, setEnvUrl] = useState(run?.environment.url ?? '');
  const [testing, setTesting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    valid: boolean;
    tables?: string[];
    error?: string;
  } | null>(null);
  const [editingName, setEditingName] = useState(!run?.name || run.name === 'New Migration Run');
  const [savingName, setSavingName] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  // Check if already signed in on mount
  useEffect(() => {
    getAccount().then(setAccount);
  }, []);

  // Sync step
  useEffect(() => {
    setStep('connect');
  }, [setStep]);

  // Initialize from existing run
  useEffect(() => {
    if (run?.environment.validated) {
      setConnectionResult({ valid: true });
    }
  }, [run?.environment.validated]);

  const handleSaveName = useCallback(async () => {
    if (!runId || !runName.trim()) return;
    setSavingName(true);
    try {
      const updated = await api.updateRun(runId, { name: runName.trim() });
      useRunStore.getState().setRun(updated);
      setEditingName(false);
    } catch {
      // keep editing on error
    } finally {
      setSavingName(false);
    }
  }, [runId, runName]);

  const handleTestConnection = useCallback(async () => {
    if (!envUrl.trim() || !runId || !account) return;
    setTesting(true);
    setConnectionResult(null);
    try {
      const result = await api.testConnection(runId, envUrl.trim());
      setConnectionResult(result);
      if (result.valid) {
        setEnvironment(runId, {
          url: envUrl.trim(),
          validated: true,
          validatedAt: new Date().toISOString(),
        });
        updateRunStatus(runId, 'connected');
      }
    } catch (err) {
      setConnectionResult({
        valid: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  }, [envUrl, runId, setEnvironment, updateRunStatus]);

  const handleNext = () => {
    if (runId) {
      setStep('upload');
      navigate(`/runs/${runId}/upload`);
    }
  };

  const isConnected = connectionResult?.valid === true || run?.environment.validated;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <PlugConnected20Regular />
        <Title2>Connect to Target Environment</Title2>
      </div>
      <Text>
        Configure the target Dynamics 365 cloud environment for this migration
        run. Sign in with your Microsoft account, provide the environment URL,
        and validate the connection before proceeding.
      </Text>

      {/* Authentication */}
      <Card className={styles.statusCard}>
        <CardHeader
          header={
            <div className={styles.statusHeader}>
              <PersonAccounts20Regular />
              <Text weight="semibold">Microsoft Account</Text>
            </div>
          }
        />
        {account ? (
          <div className={styles.urlRow}>
            <Persona
              name={account.name ?? account.username}
              secondaryText={account.username}
              size="medium"
            />
            <Button
              icon={<SignOut20Regular />}
              appearance="subtle"
              size="small"
              onClick={async () => {
                await signOut();
                setAccount(null);
                setConnectionResult(null);
              }}
            >
              Sign Out
            </Button>
          </div>
        ) : (
          <Button
            appearance="primary"
            icon={signingIn ? <Spinner size="tiny" /> : <PersonAccounts20Regular />}
            disabled={signingIn}
            onClick={async () => {
              setSigningIn(true);
              const acct = await signIn();
              setAccount(acct);
              setSigningIn(false);
            }}
          >
            {signingIn ? 'Signing in...' : 'Sign in with Microsoft'}
          </Button>
        )}
      </Card>

      <div className={styles.form}>
        {/* Run Name */}
        <Field label="Run Name" required>
          {editingName ? (
            <div className={styles.urlRow}>
              <Input
                className={styles.urlInput}
                value={runName}
                onChange={(_, d) => setRunName(d.value)}
                placeholder="e.g. Customer Service Migration"
              />
              <Button
                appearance="primary"
                size="small"
                onClick={handleSaveName}
                disabled={savingName || !runName.trim()}
              >
                {savingName ? <Spinner size="tiny" /> : 'Save'}
              </Button>
            </div>
          ) : (
            <div className={styles.urlRow}>
              <Text size={400} weight="semibold">
                {run?.name ?? runName}
              </Text>
              <Button
                icon={<Edit20Regular />}
                appearance="subtle"
                size="small"
                onClick={() => setEditingName(true)}
              />
            </div>
          )}
        </Field>

        {/* Environment URL */}
        <Field
          label="Dynamics 365 Environment URL"
          required
          hint="e.g. https://yourorg.crm.dynamics.com"
          validationState={
            connectionResult
              ? connectionResult.valid
                ? 'success'
                : 'error'
              : undefined
          }
          validationMessage={
            connectionResult && !connectionResult.valid
              ? connectionResult.error
              : undefined
          }
        >
          <div className={styles.urlRow}>
            <Input
              className={styles.urlInput}
              value={envUrl}
              onChange={(_, d) => {
                setEnvUrl(d.value);
                setConnectionResult(null);
              }}
              placeholder="https://yourorg.crm.dynamics.com"
              disabled={testing}
            />
            <Button
              appearance="primary"
              onClick={handleTestConnection}
              disabled={testing || !envUrl.trim() || !account}
              icon={testing ? <Spinner size="tiny" /> : undefined}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </Field>
      </div>

      {/* Connection result */}
      {connectionResult && (
        <>
          {connectionResult.valid ? (
            <MessageBar intent="success">
              <MessageBarBody>
                <MessageBarTitle>Connected</MessageBarTitle>
                Environment validated successfully.
                {connectionResult.tables && (
                  <> Found {connectionResult.tables.length} customizable tables.</>
                )}
              </MessageBarBody>
            </MessageBar>
          ) : (
            <MessageBar intent="error">
              <MessageBarBody>
                <MessageBarTitle>Connection Failed</MessageBarTitle>
                {connectionResult.error}
              </MessageBarBody>
            </MessageBar>
          )}
        </>
      )}

      {/* Tables preview when connected */}
      {connectionResult?.valid && connectionResult.tables && (
        <Card className={styles.statusCard}>
          <CardHeader
            header={
              <div className={styles.statusHeader}>
                <Checkmark20Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />
                <Text weight="semibold">Available Tables</Text>
                <Badge appearance="filled" color="informative">
                  {connectionResult.tables.length}
                </Badge>
              </div>
            }
          />
          <div className={styles.tableList}>
            {connectionResult.tables.slice(0, 30).map((t) => (
              <Badge key={t} appearance="outline" size="small">
                {t}
              </Badge>
            ))}
            {connectionResult.tables.length > 30 && (
              <Badge appearance="outline" size="small" color="subtle">
                +{connectionResult.tables.length - 30} more
              </Badge>
            )}
          </div>
        </Card>
      )}

      {/* Navigation */}
      <div className={styles.actions}>
        <Button
          appearance="primary"
          icon={<ArrowRight20Regular />}
          iconPosition="after"
          onClick={handleNext}
          disabled={!isConnected}
        >
          Next: Upload Source Data
        </Button>
      </div>

      {!isConnected && (
        <MessageBar intent="info">
          <MessageBarBody>
            You must validate the environment connection before proceeding to
            the next step.
          </MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}
