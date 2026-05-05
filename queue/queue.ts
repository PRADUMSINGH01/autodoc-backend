import getRedisConfig from "./index";
import { Queue, QueueOptions } from "bullmq";

const defaultRedisConfig = getRedisConfig();

const QUEUE_CONFIG: QueueOptions = {
    connection: defaultRedisConfig
}
// 1. For cloning and scanning structure
export const analysisQueue = new Queue("repo-analysis", QUEUE_CONFIG);
// 2. For the heavy AI/LLM work
export const docGenQueue = new Queue("doc-generation", QUEUE_CONFIG);
// 3. For emails and API callbacks
export const notificationQueue = new Queue("notifications", QUEUE_CONFIG);