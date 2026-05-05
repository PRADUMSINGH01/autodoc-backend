import { Router, Request, Response } from 'express';
import { db } from '../firebase/firebase';
import { z } from 'zod';

const router = Router();

// Strict email schema with lowercase normalization
const WaitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Please provide a valid email address.' }),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { email } = WaitlistSchema.parse(req.body);

    // Duplicate check — don't save the same email twice
    const existing = await db
      .collection('waitlist')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({
        error: "You're already on the waitlist! We'll be in touch soon.",
      });
    }

    // Save to Firestore
    await db.collection('waitlist').add({
      email,
      timestamp: new Date().toISOString(),
      source: 'website',
    });

    return res.status(201).json({
      message: "You're on the list! We'll notify you when we launch. 🎉",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('[Waitlist] Error saving email:', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

export default router;
