import { Title2, Text, makeStyles, tokens } from '@fluentui/react-components';
import { ClipboardTextLtr20Regular } from '@fluentui/react-icons';

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

export function LogsStep() {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <ClipboardTextLtr20Regular />
        <Title2>Execution Logs</Title2>
      </div>
      <Text>
        View the complete audit trail of all analysis calls, user edits,
        approvals, and MCP execution steps for this migration run.
      </Text>
      {/* Phase 8 will implement the full log viewer */}
    </div>
  );
}
