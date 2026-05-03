import { Router, Request, Response } from 'express';
import { db } from '../firebase/firebase';

const router = Router();

// Lazy load the webhooks instance
let webhooksInstance: any = null;

async function getWebhooks() {
  if (!webhooksInstance) {
    // Dynamically import the ESM-only @octokit/webhooks package
    const { Webhooks } = await import('@octokit/webhooks');
    webhooksInstance = new Webhooks({
      secret: process.env.GITHUB_WEBHOOK_SECRET || 'development_secret',
    });

    // Handle 'installation.created' event
    webhooksInstance.on('installation.created', async ({ payload }: any) => {
      console.log(`GitHub App installed: Installation ID ${payload.installation.id}`);
      
      const installerGithubId = payload.sender.id;
      const installationId = payload.installation.id;

      try {
        const uid = `github:${installerGithubId}`;
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
          await userRef.update({ installationId });
          console.log(`Successfully mapped Installation ID ${installationId} to user ${uid}`);
        } else {
          console.warn(`Received installation for GitHub ID ${installerGithubId}, but user not found in database.`);
        }
      } catch (error) {
        console.error('Error handling installation.created:', error);
      }
    });

    // Handle 'push' event
    webhooksInstance.on('push', async ({ payload }: any) => {
      console.log(`Push event received for repo: ${payload.repository.full_name}`);
      const installationId = payload.installation?.id;
      
      if (!installationId) {
        console.log('Push event ignored: No installation ID present.');
        return;
      }

      console.log(`[Queue] Adding job to clone repo ${payload.repository.full_name} and generate docs...`);
    });
  }
  return webhooksInstance;
}

// Webhook endpoint
router.post('/github', async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const eventName = req.headers['x-github-event'] as string;
  const id = req.headers['x-github-delivery'] as string;

  if (!signature || !eventName || !id) {
    res.status(400).send('Missing GitHub headers');
    return;
  }

  try {
    const webhooks = await getWebhooks();
    await webhooks.verifyAndReceive({
      id,
      name: eventName,
      payload: (req as any).rawBody || req.body,
      signature,
    });
    
    res.status(200).send('Webhook received successfully');
  } catch (error: any) {
    console.error('Webhook verification failed:', error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

export default router;
