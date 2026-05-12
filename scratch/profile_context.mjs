import { getProjectContext } from '../node-backend/lib/context.mjs';
import { getProjectsDir } from '../node-backend/lib/paths.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

async function test() {
    const projectsDir = await getProjectsDir();
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    // Find a directory that contains .metadata/project.json
    let targetProject = null;
    for (const entry of entries) {
        if (entry.isDirectory()) {
            try {
                await fs.access(path.join(projectsDir, entry.name, '.metadata', 'project.json'));
                targetProject = entry.name;
                break;
            } catch {}
        }
    }
    
    if (targetProject) {
        console.log(`Testing context for project: ${targetProject}`);
        const start = Date.now();
        const context = await getProjectContext(targetProject);
        const end = Date.now();
        console.log(`Context length: ${context.length} characters`);
        console.log(`Time taken: ${end - start}ms`);
    } else {
        console.log('No valid projects found in ' + projectsDir);
    }
}

test();
