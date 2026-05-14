import { useCallback, useState } from 'react';
import { Title2, Text, Button, Spinner, makeStyles, tokens } from '@fluentui/react-components';
import { Add20Regular, Rocket20Regular } from '@fluentui/react-icons';
import { useRunStore } from '../../stores/runStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '24px',
    textAlign: 'center',
  },
  icon: {
    fontSize: '48px',
    color: tokens.colorBrandForeground1,
  },
});

export function HomePage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const handleNewRun = useCallback(async () => {
    setCreating(true);
    try {
      const run = await api.createRun('New Migration Run');
      const store = useRunStore.getState();
      store.setRuns([...store.runs, run]);
      store.setActiveRun(run.id);
      navigate(`/runs/${run.id}/connect`);
    } catch (err) {
      console.error('Failed to create run:', err);
    } finally {
      setCreating(false);
    }
  }, [navigate]);

  return (
    <div className={styles.root}>
      <Rocket20Regular className={styles.icon} />
      <Title2>Cloud Wizard</Title2>
      <Text size={400} style={{ maxWidth: 480 }}>
        AI-assisted migration from Dynamics 365 on-premise to Dynamics 365
        cloud. Create a new run to get started.
      </Text>
      <Button
        icon={creating ? <Spinner size="tiny" /> : <Add20Regular />}
        appearance="primary"
        size="large"
        onClick={handleNewRun}
        disabled={creating}
      >
        New Migration Run
      </Button>
    </div>
  );
}
