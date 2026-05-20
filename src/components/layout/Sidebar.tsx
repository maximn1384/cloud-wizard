import { useEffect, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Divider,
  Badge,
} from '@fluentui/react-components';
import {
  Navigation20Regular,
  Add20Regular,
} from '@fluentui/react-icons';
import { useRunStore } from '../../stores/runStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const useStyles = makeStyles({
  sidebar: {
    width: '260px',
    minWidth: '260px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  sidebarCollapsed: {
    width: '48px',
    minWidth: '48px',
  },
  header: {
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  runList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 8px',
  },
  runItem: {
    padding: '8px 12px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3Hover,
    },
  },
  runItemActive: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  footer: {
    padding: '12px',
  },
});

export function Sidebar() {
  const styles = useStyles();
  const navigate = useNavigate();
  const runs = useRunStore((s) => s.runs);
  const activeRunId = useRunStore((s) => s.activeRunId);
  const setActiveRun = useRunStore((s) => s.setActiveRun);
  const setRuns = useRunStore((s) => s.setRuns);

  // Load runs from API on mount (merge, don't overwrite if backend restarted)
  useEffect(() => {
    api.listRuns().then((apiRuns) => {
      if (apiRuns.length > 0) {
        setRuns(apiRuns);
      }
    }).catch(console.error);
  }, [setRuns]);

  const handleNewRun = useCallback(async () => {
    try {
      const run = await api.createRun('New Migration Run');
      useRunStore.getState().setRuns([...useRunStore.getState().runs, run]);
      useRunStore.getState().setActiveRun(run.id);
      navigate(`/runs/${run.id}/connect`);
    } catch (err) {
      console.error('Failed to create run:', err);
    }
  }, [navigate]);

  const handleSelectRun = (id: string) => {
    setActiveRun(id);
    navigate(`/runs/${id}/connect`);
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <Text weight="semibold" size={400}>
          Cloud Wizard
        </Text>
        <Button
          icon={<Navigation20Regular />}
          appearance="subtle"
          size="small"
        />
      </div>
      <Divider />
      <div className={styles.runList}>
        {runs.map((run) => (
          <div
            key={run.id}
            className={`${styles.runItem} ${
              run.id === activeRunId ? styles.runItemActive : ''
            }`}
            onClick={() => handleSelectRun(run.id)}
          >
            <Text weight="semibold" size={300}>
              {run.name}
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Badge
                size="small"
                appearance="filled"
                color={
                  run.status === 'completed'
                    ? 'success'
                    : run.status === 'error'
                      ? 'danger'
                      : run.status === 'draft'
                        ? 'informative'
                        : 'brand'
                }
              >
                {run.status}
              </Badge>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {new Date(run.updatedAt).toLocaleDateString()}
              </Text>
            </div>
          </div>
        ))}
        {runs.length === 0 && (
          <Text
            size={200}
            style={{
              padding: '16px 12px',
              color: tokens.colorNeutralForeground3,
            }}
          >
            No migration runs yet
          </Text>
        )}
      </div>
      <Divider />
      <div className={styles.footer}>
        <Button
          icon={<Add20Regular />}
          appearance="primary"
          style={{ width: '100%' }}
          onClick={handleNewRun}
        >
          New Run
        </Button>
      </div>
    </div>
  );
}
