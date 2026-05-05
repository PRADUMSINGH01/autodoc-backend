/**
 * @fileoverview Domain Layer: Agent Orchestration Job
 *
 * This module triggers the autonomous AI Agent to analyze a repository.
 * Instead of manual processing, it interfaces with the 'Main Agent API'
 * which makes high-level decisions on how to generate documentation.
 */

// 1. DATA PREPARATION
// We collect the Repo ID, owner details, and any specific API keys/tokens
// required for the Agent to access the repository.

// 2. AGENT API INVOCATION
// Call the 'Main Agent' endpoint.
// We pass the repository details and wait for the Agent to 'decide'
// the best documentation strategy (e.g., focus on API vs. focus on Architecture).

// 3. NOTE CAPTURE
// The Agent returns a set of 'Generated Notes' and structural insights.
// We capture these and prepare them for persistence.

// 4. PERSISTENCE & NOTIFICATION
// Store the resulting notes in the database (FireStore) and
// update the frontend via a Api  and  email once note hosted on Url .



import { analysisQueue } from '../queue/queue'

interface RepoAnalysisJob {
    repoId: string;
    ownerId: string;
    projectId: string;
    githubToken: string;
    githubOwner: string;
    githubRepo: string;
    gitProvider: string;
    commitSha: string;
    jobId: string;
}

async function addJob({ repoId, ownerId, projectId, githubToken, githubOwner, githubRepo, gitProvider, commitSha, jobId }: RepoAnalysisJob) {

    try {
        const job = await analysisQueue.add('repo-analysis', {
            repoId,
            ownerId,
            projectId,
            githubToken,
            githubOwner,
            githubRepo,
            gitProvider,
            commitSha
        }, {
            jobId,
            removeOnComplete: true,
            removeOnFail: 50
        })

        return `Job Added ${job.id}`

    } catch (error) {
        console.error("Error adding job to analysisQueue:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Failed to add job to analysisQueue");
    }
}

export default addJob