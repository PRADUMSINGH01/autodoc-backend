
import rateLimit from "express-rate-limit";
// ... existing imports

class RateLimiter {
    // 1. Change to an object for better API responses
    private static readonly DEFAULT_MESSAGE = {
        status: 429,
        error: "Too Many Requests",
        message: "You have exceeded the rate limit. Please try again later."
    };

    private static CreateRateLimiter(requestsLimit: number, timeFrameMinutes: number) {
        return rateLimit({
            windowMs: timeFrameMinutes * 60 * 1000,
            max: requestsLimit,
            message: RateLimiter.DEFAULT_MESSAGE,
            standardHeaders: 'draft-7', // Draft-7 is the widely supported 2024+ standard
            legacyHeaders: false,
            // Pro-tip: Add a handler to ensure the status code is strictly 429
            handler: (req, res, next, options) => {
                res.status(options.statusCode).json(options.message);
            }
        });
    }

    // AUTH: Very strict (5 tries per 15 mins)
    public static get authLimiter() {
        return this.CreateRateLimiter(5, 15);
    }

    // STANDARD: For general browsing (100 requests per 15 mins)
    public static get standardLimiter() {
        return this.CreateRateLimiter(100, 15);
    }

    // API: For heavy documentation generation (20 requests per minute)
    public static get apiLimiter() {
        return this.CreateRateLimiter(20, 1);
    }
}

export default RateLimiter; 