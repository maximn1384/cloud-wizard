import {
  makeStyles,
  tokens,
  Text,
  Badge,
} from '@fluentui/react-components';
import {
  PlugConnected20Regular,
  ArrowUpload20Regular,
  BrainCircuit20Regular,
  DesignIdeas20Regular,
  CheckmarkCircle20Regular,
  Rocket20Regular,
  ClipboardTextLtr20Regular,
} from '@fluentui/react-icons';
import type { WizardStep } from '../../stores/uiStore';
import { useUiStore } from '../../stores/uiStore';
import { useNavigate, useParams } from 'react-router-dom';

const STEP_META: Record<
  WizardStep,
  { label: string; icon: React.ReactElement }
> = {
  connect: { label: 'Connect', icon: <PlugConnected20Regular /> },
  upload: { label: 'Upload', icon: <ArrowUpload20Regular /> },
  analyze: { label: 'Analyze', icon: <BrainCircuit20Regular /> },
  design: { label: 'Design', icon: <DesignIdeas20Regular /> },
  approve: { label: 'Approve', icon: <CheckmarkCircle20Regular /> },
  generate: { label: 'Generate', icon: <Rocket20Regular /> },
  logs: { label: 'Logs', icon: <ClipboardTextLtr20Regular /> },
};

const useStyles = makeStyles({
  stepper: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '12px 24px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    overflowX: 'auto',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3Hover,
    },
  },
  stepActive: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  connector: {
    width: '20px',
    height: '1px',
    backgroundColor: tokens.colorNeutralStroke2,
    flexShrink: 0,
  },
});

export function WizardStepper() {
  const styles = useStyles();
  const currentStep = useUiStore((s) => s.currentStep);
  const setStep = useUiStore((s) => s.setStep);
  const allSteps = useUiStore((s) => s.steps());
  const navigate = useNavigate();
  const { runId } = useParams();

  const handleStepClick = (step: WizardStep) => {
    setStep(step);
    if (runId) {
      navigate(`/runs/${runId}/${step}`);
    }
  };

  return (
    <div className={styles.stepper}>
      {allSteps.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div
            className={`${styles.step} ${
              step === currentStep ? styles.stepActive : ''
            }`}
            onClick={() => handleStepClick(step)}
          >
            {STEP_META[step].icon}
            <Text size={200} weight={step === currentStep ? 'semibold' : 'regular'}>
              {STEP_META[step].label}
            </Text>
            <Badge
              size="small"
              appearance={step === currentStep ? 'filled' : 'outline'}
              color={step === currentStep ? 'brand' : 'informative'}
            >
              {i + 1}
            </Badge>
          </div>
          {i < allSteps.length - 1 && <div className={styles.connector} />}
        </div>
      ))}
    </div>
  );
}
