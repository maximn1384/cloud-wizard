import { Title2, Text, makeStyles, tokens } from '@fluentui/react-components';
import { BrainCircuit20Regular } from '@fluentui/react-icons';

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

export function AnalyzeStep() {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <BrainCircuit20Regular />
        <Title2>AI Analysis</Title2>
      </div>
      <Text>
        Run AI analysis using Azure Foundry to generate Dataverse schema
        recommendations aligned to native Dynamics 365 tables (Account,
        Contact, Case, etc.).
      </Text>
      {/* Phase 4 will implement the full analysis UI */}
    </div>
  );
}
