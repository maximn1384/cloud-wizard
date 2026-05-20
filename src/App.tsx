import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { HomePage } from './components/wizard/HomePage';
import { ConnectStep } from './components/wizard/ConnectStep';
import { UploadStep } from './components/wizard/UploadStep';
import { AnalyzeStep } from './components/wizard/AnalyzeStep';
import { SolutionDesignStep } from './components/wizard/SolutionDesignStep';
import { ApproveStep } from './components/wizard/ApproveStep';
import { GenerateStep } from './components/wizard/GenerateStep';
import { LogsStep } from './components/wizard/LogsStep';

function App() {
  return (
    <FluentProvider theme={webLightTheme}>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<HomePage />} />
            <Route path="runs/:runId/connect" element={<ConnectStep />} />
            <Route path="runs/:runId/upload" element={<UploadStep />} />
            <Route path="runs/:runId/analyze" element={<AnalyzeStep />} />
            <Route path="runs/:runId/design" element={<SolutionDesignStep />} />
            <Route path="runs/:runId/approve" element={<ApproveStep />} />
            <Route path="runs/:runId/generate" element={<GenerateStep />} />
            <Route path="runs/:runId/logs" element={<LogsStep />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FluentProvider>
  );
}

export default App;
