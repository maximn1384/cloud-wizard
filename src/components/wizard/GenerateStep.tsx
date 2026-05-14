import { Title2, Text, makeStyles, tokens } from '@fluentui/react-components';
import { Rocket20Regular } from '@fluentui/react-icons';

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

export function GenerateStep() {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Rocket20Regular />
        <Title2>Generate Artifacts</Title2>
      </div>
      <Text>
        Execute the approved plan using MCP tools to create solutions, schema
        changes, and migrate data in the target Dynamics 365 environment.
      </Text>
      {/* Phase 7 will implement the full generation UI */}
    </div>
  );
}
