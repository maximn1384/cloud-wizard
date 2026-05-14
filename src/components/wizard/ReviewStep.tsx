import { Title2, Text, makeStyles, tokens } from '@fluentui/react-components';
import { DocumentSearch20Regular } from '@fluentui/react-icons';

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

export function ReviewStep() {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <DocumentSearch20Regular />
        <Title2>Review Recommendations</Title2>
      </div>
      <Text>
        Review AI-proposed schema changes and source-to-destination mapping.
        Accept, reject, or edit individual recommendations before approval.
      </Text>
      {/* Phase 5 will implement the full review & mapping UI */}
    </div>
  );
}
