import express, { Request, Response } from 'express';
import cors from 'cors';
import { z } from 'zod';
import authRoutes from '../routes/auth.routes';
import githubRoutes from '../routes/github.routes';
import webhookRoutes from '../routes/webhook.routes';
import waitlistRoutes from '../routes/waitlist.routes';
import RateLimiter from '../utils/rate-limit';

const app = express();
// Cloud Run provides PORT env var (usually 8080). Fall back to 5000 locally.
const PORT = parseInt(process.env.PORT || '5000', 10);

app.use(cors());
// Capture raw body for webhook signature verification
app.use(express.json({
  verify: (req: Request, res: Response, buf: Buffer) => {
    (req as any).rawBody = buf.toString();
  }
}));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', RateLimiter.authLimiter, authRoutes);
app.use('/api/github', RateLimiter.standardLimiter, githubRoutes);
app.use('/api/webhook', RateLimiter.standardLimiter, webhookRoutes);
app.use('/api/waitlist', RateLimiter.standardLimiter, waitlistRoutes);

// Example route with Zod validation
const RepoSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1)
});
app.use(RateLimiter.standardLimiter);

app.post('/api/repos', RateLimiter.authLimiter, (req: Request, res: Response) => {
  try {
    const data = RepoSchema.parse(req.body);
    res.status(201).json({ message: 'Repo added successfully', data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Must listen on 0.0.0.0 for Google Cloud Run (not just localhost)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on 0.0.0.0:${PORT}`);
});

// Initialize background workers AFTER server starts
// Wrapped in try/catch so a Redis misconfiguration never crashes the HTTP server
try {
  require('../workers/main.worker');
  console.log('[Workers] Background workers initialized.');
} catch (err) {
  console.error('[Workers] Failed to initialize workers (Redis may be unavailable):', err);
  console.error('[Workers] HTTP server will continue running without background workers.');
}
