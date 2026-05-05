/**
 * @fileoverview Infrastructure Layer: Queue Orchestration
 * 
 * This module initializes and manages the connection to the Redis persistence layer.
 * By utilizing a centralized Queue system (BullMQ), we decouple the API's request-response 
 * cycle from heavy computational tasks, ensuring high availability and system resilience.
 * 
 * Rationale:
 * - Decoupling: Offloads long-running processes (AI Analysis) from the main event loop.
 * - Persistence: Tasks are stored in Redis, ensuring they survive system restarts.
 */



import { ConnectionOptions } from 'bullmq';


function getRedisConfig() {
    try {
        if (!process.env.REDIS_HOST || !process.env.REDIS_PORT || !process.env.REDIS_PASSWORD) {
            console.error("Please provide REDIS_HOST, REDIS_PORT, REDIS_PASSWORD,  environment variables");
            process.exit(1);
        }

        const RedisConnection: ConnectionOptions = {
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD,
            tls: {}, // Mandatory for Upstash SSL connections
            maxRetriesPerRequest: null,
        }


        return RedisConnection
    } catch (error) {
        console.error("Error in getting Redis connection config", error);
        process.exit(1);
    }
}
export default getRedisConfig;