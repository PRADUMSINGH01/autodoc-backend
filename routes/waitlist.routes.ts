import { Router, Request, Response } from 'express';
import { db } from '../firebase/firebase';
import { z } from 'zod';

const router = Router();

const WaitlistSchema = z.object({
  email: z.string().email(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { email } = WaitlistSchema.parse(req.body);

    // Save to Firestore in a 'waitlist' collection
    await db.collection('waitlist').add({
      email,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ message: 'Thank you for joining our waitlist!' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid email address' });
    } else {
      console.error('Waitlist error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
