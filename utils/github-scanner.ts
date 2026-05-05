import AdmZip from 'adm-zip';

const MAX_ZIP_SIZE = 100 * 1024 * 1024; // 100MB zip limit
const MAX_UNCOMPRESSED_SIZE = 300 * 1024 * 1024; // 300MB limit for extracted text
const ALLOWED_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.html', '.css', '.scss', '.yaml', '.yml', '.env.example'
]);
const IGNORED_FOLDERS = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'out', 'vendor'];

export async function scanRepository(owner: string, repo: string, token: string, commitSha: string): Promise<string> {
    console.log(`[Scanner] Fetching metadata for ${owner}/${repo}...`);
    // 1. Fetch Repo Metadata for size check
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AutoDocs-Scanner'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const metadataRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers
    });
    
    if (!metadataRes.ok) throw new Error(`Failed to fetch repo metadata: ${metadataRes.statusText}`);
    const metadata = await metadataRes.json();
    
    // GitHub API returns size in KB. Let's block repos > 500MB
    if (metadata.size > 500_000) { 
        throw new Error(`Repository is too large to process (${Math.round(metadata.size / 1024)}MB).`);
    }

    console.log(`[Scanner] Downloading zipball for ${commitSha}...`);
    // 2. Download Zipball
    const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${commitSha}`;
    const zipRes = await fetch(zipUrl, {
        headers
    });

    if (!zipRes.ok) throw new Error(`Failed to download zipball: ${zipRes.statusText}`);
    
    const arrayBuffer = await zipRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length > MAX_ZIP_SIZE) {
        throw new Error(`Downloaded zip exceeds the maximum allowed size of ${MAX_ZIP_SIZE / 1024 / 1024}MB.`);
    }

    console.log(`[Scanner] Extracting and filtering files in memory...`);
    // 3. Extract and Filter in Memory
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    
    let totalExtractedSize = 0;
    let fileCount = 0;
    let xmlContext = "<repository_context>\n";

    for (const entry of zipEntries) {
        if (entry.isDirectory) continue;

        // The first part of the path is usually the owner-repo-commit folder added by GitHub
        const parts = entry.entryName.split('/');
        parts.shift(); // Remove the root folder
        const relativePath = parts.join('/');
        
        // Skip files in ignored folders
        if (IGNORED_FOLDERS.some(folder => relativePath.includes(`/${folder}/`) || relativePath.startsWith(`${folder}/`))) {
            continue;
        }

        // Only process allowed extensions
        const extMatch = relativePath.match(/\.[^.]+$/);
        const ext = extMatch ? extMatch[0].toLowerCase() : '';
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            continue;
        }
        
        // Prevent huge individual files
        if (entry.header.size > 2 * 1024 * 1024) continue; // Skip files > 2MB
        
        totalExtractedSize += entry.header.size;
        if (totalExtractedSize > MAX_UNCOMPRESSED_SIZE) {
            throw new Error(`Uncompressed content exceeds safety limit of ${MAX_UNCOMPRESSED_SIZE / 1024 / 1024}MB.`);
        }

        const content = entry.getData().toString('utf8');
        
        xmlContext += `  <file path="${relativePath}">\n`;
        // Basic escaping so the LLM doesn't confuse code brackets with our XML structure
        const safeContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        xmlContext += `${safeContent}\n`;
        xmlContext += `  </file>\n`;
        
        fileCount++;
    }

    xmlContext += "</repository_context>";
    console.log(`[Scanner] Successfully processed ${fileCount} files. Total text size: ${(totalExtractedSize / 1024 / 1024).toFixed(2)}MB`);
    
    return xmlContext;
}
