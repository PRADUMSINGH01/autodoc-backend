import { Router, Request, Response } from 'express';
import { db } from '../firebase/firebase';
import addJob from '../jobs/repo-analysis';

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

    // Helper: Save installationId to user's Firestore document
    async function saveInstallation(senderGithubId: number, installationId: number, eventName: string) {
      try {
        const uid = `github:${senderGithubId}`;
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
          await userRef.update({ installationId });
          console.log(`[${eventName}] Mapped Installation ID ${installationId} to user ${uid}`);
        } else {
          console.warn(`[${eventName}] GitHub ID ${senderGithubId} not found in database.`);
        }
      } catch (error) {
        console.error(`[${eventName}] Error:`, error);
      }
    }

    // Handle 'installation.created' — first-time app install
    webhooksInstance.on('installation.created', async ({ payload }: any) => {
      console.log(`✅ App installed! Installation ID: ${payload.installation.id}`);
      await saveInstallation(payload.sender.id, payload.installation.id, 'installation.created');
    });

    // Handle 'installation_repositories.added' — user adds repos to existing install
    webhooksInstance.on('installation_repositories.added', async ({ payload }: any) => {
      const repoNames = payload.repositories_added.map((r: any) => r.full_name).join(', ');
      console.log(`✅ Repos added to installation ${payload.installation.id}: ${repoNames}`);
      await saveInstallation(payload.sender.id, payload.installation.id, 'installation_repositories.added');
    });

    // Handle 'installation_repositories.removed' — user removes repos from install
    webhooksInstance.on('installation_repositories.removed', async ({ payload }: any) => {
      const repoNames = payload.repositories_removed.map((r: any) => r.full_name).join(', ');
      console.log(`⚠️ Repos removed from installation ${payload.installation.id}: ${repoNames}`);
    });

    // Handle 'push' event
    webhooksInstance.on('push', async ({ payload }: any) => {
      console.log(`📦 Push event for: ${payload.repository.full_name}`);
      const installationId = payload.installation?.id;
      
      if (!installationId) {
        console.log('Push event ignored: No installation ID present.');
        return;
      }

      console.log(`[Queue] Adding job to clone ${payload.repository.full_name} and generate docs...`);
      
      try {
        const { createAppAuth } = await import('@octokit/auth-app');
        const auth = createAppAuth({
          appId: process.env.GITHUB_APP_ID || '',
          privateKey: process.env.GITHUB_APP_PRIVATE_KEY || '',
        });

        const installationAuthentication = await auth({
          type: "installation",
          installationId: installationId,
        });

        const jobId = `repo-${payload.repository.id}-commit-${payload.after}`;

        await addJob({
            repoId: payload.repository.id.toString(),
            ownerId: `github:${payload.sender.id}`,
            projectId: payload.repository.id.toString(), // Assuming repoId as projectId for now
            githubToken: installationAuthentication.token,
            githubOwner: payload.repository.owner.login,
            githubRepo: payload.repository.name,
            gitProvider: 'github',
            commitSha: payload.after,
            jobId: jobId
        });
        
        console.log(`✅ Job added successfully: ${jobId}`);
      } catch (error) {
        console.error("Failed to add job from webhook:", error);
      }
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
