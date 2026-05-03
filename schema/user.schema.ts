import z from "zod"

const userSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6).max(16).optional(),
    name: z.string().min(3).max(100),
    authProvider: z.enum(["email", "github"]).default("email"),
    memberShipType: z.enum(["free", "pro", "enterprise"]).default("free"),
    isActive: z.boolean().default(true),
    createdAt: z.preprocess((val) => (val && typeof (val as any).toDate === 'function' ? (val as any).toDate() : val), z.date().default(() => new Date())),
    updatedAt: z.preprocess((val) => (val && typeof (val as any).toDate === 'function' ? (val as any).toDate() : val), z.date().default(() => new Date())),
    accesstoken: z.string().default(() => ""),
    refreshtoken: z.string().default(() => ""),
    idToken: z.string().default(() => ""),
    installationId: z.number().optional(),
}).superRefine((data, ctx) => {
    if (data.authProvider === "email" && !data.password) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Password is required for email authentication",
            path: ["password"]
        });
    }
});

export default userSchema