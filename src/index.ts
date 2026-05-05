import express, { Request, Response } from 'express';
import cors from 'cors';
import { z } from 'zod';
const app = express();
const PORT = process.env.PORT || 5000;

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

import authRoutes from '../routes/auth.routes';
import githubRoutes from '../routes/github.routes';
import webhookRoutes from '../routes/webhook.routes';
import waitlistRoutes from '../routes/waitlist.routes';
import RateLimiter from '../utils/rate-limit';

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Initialize background workers
import '../workers/main.worker';
