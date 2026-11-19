const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const creditsPath = path.join(rootDir, 'CREDITS.md');

function getPackageJson() {
    return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
}

function getNpmDeps() {
    console.log('Fetching npm dependencies...');
    try {
        const lsOutput = execFileSync('npm', ['ls', '--depth=0', '--json'], { cwd: rootDir }).toString();
        const data = JSON.parse(lsOutput);
        const deps = [];

        for (const [name, info] of Object.entries(data.dependencies || {})) {
            console.log(`Fetching license for ${name}...`);
            let license = 'MIT';
            try {
                license = execFileSync('npm', ['view', name, 'license'], { cwd: rootDir }).toString().trim() || 'MIT';
            } catch (e) {
                // fallback
            }
            deps.push({
                name,
                version: info.version,
                license,
                source: `https://www.npmjs.com/package/${name}`
            });
        }

        return deps.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        console.error('Error fetching npm dependencies:', e.message);
        return [];
    }
}

function generateMarkdown() {
    const pkgJson = getPackageJson();
    const npmDeps = getNpmDeps();

    let content = fs.readFileSync(creditsPath, 'utf8');

    // Update Version
    content = content.replace(/- \*\*Version:\*\* .*/, `- **Version:** ${pkgJson.version}`);

    // Update npm deps table
    const npmTableStart = content.indexOf('| Package |');
    const npmTableEnd = content.indexOf('*License information for the npm packages');
    if (npmTableStart !== -1 && npmTableEnd !== -1) {
        let newNpmTable = '| Package | Version | License* | Source |\n|---------|---------|----------|--------|\n';
        npmDeps.forEach(d => {
            newNpmTable += `| \`${d.name}\` | ${d.version} | ${d.license} | ${d.source} |\n`;
        });
        newNpmTable += '\n';
        content = content.substring(0, npmTableStart) + newNpmTable + content.substring(npmTableEnd);
    }

    fs.writeFileSync(creditsPath, content);
    console.log('CREDITS.md successfully updated!');
}

generateMarkdown();
