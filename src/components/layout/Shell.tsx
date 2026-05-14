import { makeStyles } from '@fluentui/react-components';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { WizardStepper } from './WizardStepper';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },
});

export function Shell() {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <Sidebar />
      <div className={styles.main}>
        <WizardStepper />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
