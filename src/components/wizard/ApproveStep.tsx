import { Title2, Text, makeStyles, tokens } from '@fluentui/react-components';
import { CheckmarkCircle20Regular } from '@fluentui/react-icons';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: tokens.colorBrandForeground1,
  },
});

export function ApproveStep() {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <CheckmarkCircle20Regular />
        <Title2>Approve Version</Title2>
      </div>
      <Text>
        Review the final schema and mapping plan. Explicit approval is required
        before any changes are made to the target Dynamics 365 environment.
      </Text>
      {/* Phase 6 will implement the full approval UI */}
    </div>
  );
}
