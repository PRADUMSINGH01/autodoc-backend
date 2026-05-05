import { scanRepository } from './github-scanner';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testScanner() {
    console.log("--- Starting Scanner Test ---");

    // You can replace these with a real owner/repo/token/commitSha if you have them
    // For testing public repos, GitHub might allow it without a token (but limited rate)
    // or you might need a valid token.
    const owner = "expressjs";
    const repo = "express";
    const commitSha = "master"; // or a specific hash
    const token = process.env.GITHUB_TOKEN || ""; // Try to get from env or use empty

    if (!token) {
        console.warn("⚠️ No GITHUB_TOKEN found in .env. Attempting public request (may fail or be rate-limited).");
    }

    try {
        console.log(`Testing with ${owner}/${repo} at ${commitSha}...`);
        const xmlResult = await scanRepository(owner, repo, token, commitSha);

        console.log("✅ Success! Scanner returned XML context.");
        console.log(`Result length: ${xmlResult.length} characters.`);

        // Show the entire XML
        console.log("\n--- Full XML Output ---");
        console.log(xmlResult);
        console.log("--- End of XML Output ---\n");

        // 4. Send the COMPLETE repository context to Gemini for Professional Documentation
        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyCxvIEWPWEcbxIVIh_tbQiYnp5_De1AKHw";
        
        console.log(`\n[Gemini] Sending COMPLETE repository context (${xmlResult.length} characters) to Gemini 2.5 Flash...`);
        console.log(`[Gemini] Requesting professional-grade documentation suite...`);
        
        let response;
        try {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are a world-class Technical Documentation Engineer. Your task is to generate the "Ultimate Professional Documentation" for the following repository.
                            
                            The documentation must be in high-quality MDX and include the following sections:
                            1. **Executive Summary**: High-level value proposition.
                            2. **Architecture Deep-Dive**: Explain how the core modules interact.
                            3. **API Reference**: Detail the primary interfaces, methods, and types found in the code.
                            4. **Getting Started & Usage**: Provide clear, copy-pasteable code examples for common use cases.
                            5. **Security & Performance**: Analyze the project's security posture and performance optimizations.
                            6. **Contribution Guide**: How to set up, lint, and test.
                            
                            Use clear headings, professional tone, and technical precision. Use the full context provided below to ensure 100% accuracy.
                            
                            Repository Context (Full):
                            ${xmlResult}
                            
                            Generate the professional documentation suite now:`
                        }]
                    }]
                })
            });
        } catch (fetchErr: any) {
            console.error("DEBUG: Fetch itself failed!");
            console.error(fetchErr);
            throw fetchErr;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API Error: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json() as any;
        const generatedDocs = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedDocs) {
            const outputPath = path.resolve(__dirname, '../documentation.mdx');
            const fs = require('fs');
            fs.writeFileSync(outputPath, generatedDocs);
            console.log(`✅ Success! Documentation generated and saved to: ${outputPath}`);
        } else {
            console.warn("⚠️ Gemini returned no content.");
        }

    } catch (error: any) {
        console.error("❌ Test Failed:");
        console.error(error.message);
    }
}

testScanner();
