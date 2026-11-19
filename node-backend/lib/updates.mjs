import semver from 'semver';

/**
 * Checks for latest application updates against NPM registry and GitHub releases.
 * 
 * @param {string} currentVersion - Currently running package version (e.g. '0.4.5')
 * @param {object} [options]
 * @param {string} [options.packageName='productos']
 * @param {string} [options.repo='AIResearchFactory/productOS']
 * @param {function} [options.fetchFn=fetch]
 * @returns {Promise<{
 *   available: boolean,
 *   currentVersion: string,
 *   latestVersion: string,
 *   version: string,
 *   source: string,
 *   releaseNotes?: string,
 *   updateCommand?: string,
 *   releaseUrl?: string,
 *   error?: string
 * }>}
 */
export async function checkVersionUpdate(currentVersion, options = {}) {
  const packageName = options.packageName || 'productos';
  const repo = options.repo || 'AIResearchFactory/productOS';
  const fetchFn = options.fetchFn || fetch;
  const timeoutMs = options.timeoutMs || 4000;

  // Clean current version
  const cleanCurrent = semver.clean(currentVersion) || semver.coerce(currentVersion)?.version || '0.0.0';

  let latestVersion = null;
  let source = 'none';
  let releaseNotes = '';
  let releaseUrl = `https://github.com/${repo}/releases`;

  // 1. Try NPM registry
  try {
    const npmRes = await fetchFn(`https://registry.npmjs.org/${packageName}/latest`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (npmRes.ok) {
      const npmData = await npmRes.json();
      if (npmData && npmData.version) {
        latestVersion = semver.clean(npmData.version) || npmData.version;
        source = 'npm';
        releaseNotes = npmData.description || '';
      }
    }
  } catch (err) {
    // NPM check failed, fall through to GitHub
  }

  // 2. If NPM failed or didn't return version, fallback to GitHub releases
  if (!latestVersion) {
    try {
      const ghRes = await fetchFn(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'productOS-update-checker',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (ghRes.ok) {
        const ghData = await ghRes.json();
        const tag = ghData.tag_name || '';
        const parsed = semver.clean(tag) || semver.coerce(tag)?.version;
        if (parsed) {
          latestVersion = parsed;
          source = 'github';
          releaseNotes = ghData.body || '';
          releaseUrl = ghData.html_url || releaseUrl;
        }
      }
    } catch (err) {
      // GitHub check also failed
    }
  }

  // If both failed, return current version as latest (no update available)
  if (!latestVersion) {
    return {
      available: false,
      currentVersion: cleanCurrent,
      latestVersion: cleanCurrent,
      version: cleanCurrent,
      source: 'offline',
      updateCommand: `npm install -g ${packageName}`,
      releaseUrl,
      error: 'Could not reach update servers',
    };
  }

  const isUpdateAvailable = semver.gt(latestVersion, cleanCurrent);

  return {
    available: isUpdateAvailable,
    currentVersion: cleanCurrent,
    latestVersion,
    version: latestVersion,
    source,
    releaseNotes,
    releaseUrl,
    updateCommand: `npm install -g ${packageName}@latest`,
  };
}
