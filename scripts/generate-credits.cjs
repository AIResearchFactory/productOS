const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const creditsPath = path.join(rootDir, 'CREDITS.md');

function getPackageJson() {
    return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
}

function getRustDeps() {
    console.log('Fetching Rust dependencies...');
    try {
        const metadataOutput = execSync('cargo metadata --format-version 1', { cwd: path.join(rootDir, 'src-tauri') }).toString();
        const metadata = JSON.parse(metadataOutput);
        
        // Find the root package (productos)
        const rootPkg = metadata.packages.find(p => p.name === 'productos');
        if (!rootPkg) return [];

        const deps = rootPkg.dependencies
            .filter(d => !d.kind || d.kind === null) // only normal dependencies
            .map(d => {
                const pkg = metadata.packages.find(p => p.name === d.name);
                return {
                    name: d.name,
                    version: pkg ? pkg.version : d.req,
                    license: pkg ? (pkg.license || 'MIT/Apache-2.0') : 'MIT/Apache-2.0',
                    source: `https://crates.io/crates/${d.name}`
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
        
        return deps;
    } catch (e) {
        console.error('Error fetching Rust dependencies:', e.message);
        return [];
    }
}

function getNpmDeps() {
    console.log('Fetching npm dependencies...');
    try {
        const lsOutput = execSync('npm ls --depth=0 --json').toString();
        const data = JSON.parse(lsOutput);
        const deps = [];
        
        for (const [name, info] of Object.entries(data.dependencies || {})) {
            console.log(`Fetching license for ${name}...`);
            let license = 'MIT';
            try {
                license = execSync(`npm view ${name} license`).toString().trim();
            } catch (e) {
                // fallback
            }
            deps.push({
                name,
                version: info.version,
                license: license,
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
    const rustDeps = getRustDeps();
    const npmDeps = getNpmDeps();

    let content = fs.readFileSync(creditsPath, 'utf8');

    // Update Version
    content = content.replace(/- \*\*Version:\*\* .*/, `- **Version:** ${pkgJson.version}`);

    // Update Rust deps table
    const rustTableStart = content.indexOf('| Crate |');
    const rustTableEnd = content.indexOf('*All Rust crates are listed');
    if (rustTableStart !== -1 && rustTableEnd !== -1) {
        let newRustTable = '| Crate | Version | License | Source |\n|-------|---------|---------|--------|\n';
        rustDeps.forEach(d => {
            newRustTable += `| \`${d.name}\` | ${d.version} | ${d.license} | ${d.source} |\n`;
        });
        newRustTable += '\n';
        content = content.substring(0, rustTableStart) + newRustTable + content.substring(rustTableEnd);
    }

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
