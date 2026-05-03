import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../firebase/firebase';
import userSchema from '../schema/user.schema';

const router = Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// 1. Redirect user to GitHub for authorization
router.get('/github/login', (req: Request, res: Response) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).send('GitHub Client ID not configured');
  }
  
  const redirectUri = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=user:email`;
  res.redirect(redirectUri);
});

// 2. GitHub redirects back to this callback URL
router.get('/github/callback', async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string;

  if (!code) {
    res.status(400).send('No code provided');
    return;
  }

  try {
    // 3. Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code
      })
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Failed to get access token from GitHub');
    }

    // 4. Fetch user profile from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const githubUser = await userResponse.json();

    // Fetch primary email (since email might be private in the main profile)
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const emails = await emailResponse.json();
    const primaryEmailObj = emails.find((e: any) => e.primary) || emails[0];
    
    if (!primaryEmailObj || !primaryEmailObj.email) {
      throw new Error('No email found for GitHub user');
    }

    const email = primaryEmailObj.email;
    // We can use the github id as the uid, or let firebase generate one. 
    // It's safer to use a predictable ID for OAuth users like 'github:12345'
    const uid = `github:${githubUser.id}`;
    const name = githubUser.name || githubUser.login || 'GitHub User';

    // 5. Handle Firestore user record
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      const newUser = {
        email,
        name,
        authProvider: "github",
        accesstoken: accessToken,
        refreshtoken: "",
        idToken: "",
      };
      
      const validatedUser = userSchema.parse(newUser);
      await userRef.set(validatedUser);
    } else {
      const existingData = userDoc.data() as any;
      const updateData = {
        ...existingData,
        updatedAt: new Date(),
        accesstoken: accessToken
      };
      const validatedUser = userSchema.parse(updateData);
      await userRef.set(validatedUser);
    }

    // 6. Generate a standard JWT session token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }
    const sessionToken = jwt.sign(
      { uid, email, name },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // 7. Redirect back to frontend dashboard with the token
    res.redirect(`${FRONTEND_URL}/dashboard?token=${sessionToken}`);

  } catch (error) {
    console.error("GitHub Callback Error:", error);
    res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }
});

// 3. Logout - Clear GitHub access token from Firestore
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

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
    const decoded = jwt.verify(token, jwtSecret) as { uid: string };
    const userRef = db.collection('users').doc(decoded.uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      await userRef.update({ accesstoken: '' });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
});

export default router;
