/**
 * @fileoverview Execution Layer: Background Consumer Lifecycle
 * 
 * This script serves as the 'Consumer' in the Producer-Consumer design pattern. 
 * It manages the lifecycle of background workers, listening for events from the 
 * defined queues and executing the corresponding domain-layer jobs.
 * 
 * Architectural Features:
 * - Event-Driven: Responds to 'completed', 'failed', and 'stalled' states.
 * - Fault Tolerance: Implements retry logic and error reporting for robust processing.
 * - Scalability: Can be deployed as an independent microservice to handle peak loads.
 */

import { Worker, Job } from 'bullmq';
import getRedisConfig from '../queue/index';
import { scanRepository } from '../utils/github-scanner';

const connection = getRedisConfig();

// Define the worker for the 'repo-analysis' queue
export const repoAnalysisWorker = new Worker('repo-analysis', async (job: Job) => {
    console.log(`[Worker] Processing job ${job.id} for repo ${job.data.githubRepo}`);
    
    const { repoId, ownerId, projectId, githubToken, githubOwner, githubRepo, gitProvider, commitSha } = job.data;

    // TODO: Implement the actual cloning and analysis logic here.
    // 1. Download, extract and filter the repository
    console.log(`[Worker] Starting safe download and scan for ${githubOwner}/${githubRepo}...`);
    
    try {
        const repoContextXml = await scanRepository(githubOwner, githubRepo, githubToken, commitSha);
        console.log(`[Worker] Successfully built repository context XML. Length: ${repoContextXml.length} characters.`);
        
        // TODO: Pass repoContextXml to the AI Agent (Gemini/LangGraph)
        
    } catch (error: any) {
        console.error(`[Worker] Failed to process repository: ${error.message}`);
        throw error;
    }
    
    console.log(`[Worker] Finished processing job ${job.id}`);
    
    return {
        status: 'success',
        message: 'Repository cloned and analyzed (simulated)',
        repoId
    };
}, {
    connection,
    concurrency: 5 // Process up to 5 jobs concurrently
});

// Event Listeners for Lifecycle Management
repoAnalysisWorker.on('completed', (job: Job, returnvalue: any) => {
    console.log(`✅ [Worker] Job ${job.id} completed.`, returnvalue);
});

repoAnalysisWorker.on('failed', (job: Job | undefined, error: Error) => {
    console.error(`❌ [Worker] Job ${job?.id} failed with error:`, error.message);
});

repoAnalysisWorker.on('error', err => {
    console.error('[Worker] Redis connection error:', err);
});

console.log('🚀 Worker initialized and listening for jobs on "repo-analysis" queue.');
