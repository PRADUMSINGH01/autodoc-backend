import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';

dotenv.config();

const app = initializeApp({
    credential: cert({
        projectId: "autodocs-9dc95",
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
})

if (!app) {
    console.error("firebase is not working ");
}


export const db = getFirestore(app, "autodocs")
export const auth = getAuth(app)
