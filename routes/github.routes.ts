import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../firebase/firebase';

const router = Router();

// Middleware: Verify JWT and attach user info to the request
function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { uid: string; email: string; name: string };
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/github/repos - Fetch all repos for the authenticated user
router.get('/repos', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { uid } = (req as any).user;

    // Retrieve the user's GitHub access token from Firestore
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = userDoc.data() as any;
    const githubAccessToken = userData.accesstoken;
    const installationId = userData.installationId;

    if (!githubAccessToken) {
      res.status(400).json({ error: 'No GitHub access token found. Please re-authenticate with GitHub.' });
      return;
    }

    // 1. Fetch personal repositories from GitHub API
    const userReposResponse = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: `Bearer ${githubAccessToken}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!userReposResponse.ok) {
      throw new Error(`GitHub API responded with ${userReposResponse.status}`);
    }

    const repos = await userReposResponse.json();

    // 2. If the user has installed the GitHub App, fetch the installed repos
    const installedRepoIds = new Set<number>();
    
    if (installationId && process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY) {
      try {
        // Dynamically import to avoid ESM/CJS conflicts
        const { createAppAuth } = await import('@octokit/auth-app');
        const auth = createAppAuth({
          appId: process.env.GITHUB_APP_ID,
          privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
        });

        // Generate an installation access token
        const installationAuthentication = await auth({
          type: "installation",
          installationId: installationId,
        });

        // Fetch repos accessible to this installation
        const installedReposResponse = await fetch('https://api.github.com/installation/repositories?per_page=100', {
          headers: {
            Authorization: `Bearer ${installationAuthentication.token}`,
            Accept: 'application/vnd.github.v3+json'
          }
        });

        if (installedReposResponse.ok) {
          const installedData = await installedReposResponse.json();
          installedData.repositories.forEach((repo: any) => installedRepoIds.add(repo.id));
        }
      } catch (err) {
        console.error("Failed to fetch installed repos. The installation might have been revoked.", err);
      }
    }

    // 3. Return a clean subset of data to the frontend, including the connection status
    const cleanRepos = repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      updated_at: repo.updated_at,
      private: repo.private,
      default_branch: repo.default_branch,
      isConnected: installedRepoIds.has(repo.id), // NEW: Tell frontend if the app is connected
      owner: {
        login: repo.owner.login,
        avatar_url: repo.owner.avatar_url,
      }
    }));

    res.json({ repos: cleanRepos, total: cleanRepos.length });

  } catch (error) {
    console.error('Error fetching repos:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// GET /api/github/user - Fetch the authenticated user's profile
router.get('/user', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { uid, email, name } = (req as any).user;
    res.json({ uid, email, name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

export default router;
