import { spawnSync } from 'child_process';
import fs from 'fs';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PREV_VERSION = process.env.PREV_VERSION;
const CURRENT_VERSION = process.env.CURRENT_VERSION;

const TAG_RE = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const COMMIT_RE = /^[0-9a-f]{7,40}$/i;

function validateRef(ref, label, { allowCommit = false } = {}) {
    if (!ref) {
        throw new Error(`Invalid ${label}: "${ref}"`);
    }
    if (TAG_RE.test(ref)) return;
    if (allowCommit && COMMIT_RE.test(ref)) return;
    throw new Error(`Invalid ${label}: "${ref}"`);
}

async function generateNotes() {
    console.log(`Generating release notes from ${PREV_VERSION} to ${CURRENT_VERSION}...`);

    // 1. Validate version inputs and get git commit history without shell interpolation
    let gitLog = '';
    try {
        validateRef(PREV_VERSION, 'PREV_VERSION', { allowCommit: true });
        validateRef(CURRENT_VERSION, 'CURRENT_VERSION');

        const git = spawnSync(
            'git',
            ['log', `${PREV_VERSION}..${CURRENT_VERSION}`, '--pretty=format:%h - %an: %s', '--no-merges'],
            { encoding: 'utf-8' }
        );

        if (git.status !== 0) {
            throw new Error((git.stderr || '').trim() || 'git log failed');
        }

        gitLog = (git.stdout || '').trim();
    } catch (err) {
        console.error('Failed to retrieve git log:', err.message);
        process.exit(1);
    }

    if (!gitLog) {
        console.log('No commits found between versions. Writing basic release notes.');
        const basicContent = `No major modifications since the last release. Minor bug fixes and dependency updates.`;
        fs.writeFileSync('RELEASE_NOTES.md', basicContent);
        return;
    }

    // 2. Format prompt
    const systemPrompt = `You are a product manager generating release notes for the productOS application.
Analyze the following raw git commit log and transform it into user-facing release notes.

The output must be formatted as Markdown and strictly follow this structure:
1. High-Level Summary: A brief paragraph describing what changed, focusing on core customer values.
2. New Capabilities & Improvements: A bulleted list of the main changes, phrased as problem solutions (e.g., "Resolved an issue where...", or "You can now do X to solve Y...").
3. Special Thanks & Contributors: A short section attributing the updates to the authors found in the log.

Do not include internal technical details, refactoring jargon, or commit hashes. Focus entirely on the user impact and value.

Git Log:
${gitLog}
`;

    if (!OPENAI_API_KEY) {
        console.log('No OPENAI_API_KEY provided. Falling back to raw git log.');
        const fallback = `## Raw Commit Log\n\n${gitLog.split('\\n').map(l => '- ' + l).join('\\n')}`;
        fs.writeFileSync('RELEASE_NOTES.md', fallback);
        return;
    }

    // 3. Call LLM API (OpenAI)
    try {
        console.log('Sending git log to OpenAI API...');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are an expert product manager writing customer-facing release notes.' },
                    { role: 'user', content: systemPrompt }
                ],
                temperature: 0.3,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('LLM API Error:', response.status, errText);
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        const generatedMarkdown = data.choices[0].message.content.trim();

        fs.writeFileSync('RELEASE_NOTES.md', generatedMarkdown);
        console.log('Successfully wrote AI generated Release Notes to RELEASE_NOTES.md.');
    } catch (error) {
        console.error('Failed to generate AI release notes:', error.message);
        const fallback = `## Raw Commit Log\\n\\n${gitLog.split('\\n').map(l => '- ' + l).join('\\n')}`;
        fs.writeFileSync('RELEASE_NOTES.md', fallback);
    }
}

generateNotes();
