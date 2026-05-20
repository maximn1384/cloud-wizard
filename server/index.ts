import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runsRouter } from './routes/runs';
import { uploadRouter } from './routes/upload';
import { aiRouter } from './routes/ai';
import { mcpRouter } from './routes/mcp';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ],
}));
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/runs', runsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/ai', aiRouter);
app.use('/api/mcp', mcpRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[server] Cloud Wizard API running on http://localhost:${PORT}`);
});
