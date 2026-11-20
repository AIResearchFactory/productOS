import { useState, useCallback, useEffect, useRef } from 'react';
import { appApi } from '../api/app';
import { useToast } from './use-toast';

const UPDATE_CHECK_TIMEOUT = 30000; // 30 seconds
const MIN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes between checks
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

const compareVersions = (a: string, b: string): number => {
    const normalize = (v: string) => v.replace(/^v/i, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
    const av = normalize(a);
    const bv = normalize(b);
    const len = Math.max(av.length, bv.length);
    for (let i = 0; i < len; i++) {
        const ai = av[i] || 0;
        const bi = bv[i] || 0;
        if (ai > bi) return 1;
        if (ai < bi) return -1;
    }
    return 0;
};

function sanitizeGithubReleaseUrl(rawUrl?: string): string | null {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol === 'https:' && parsed.hostname === 'github.com') {
            return parsed.toString();
        }
    } catch {
        // invalid URL
    }
    return null;
}

export function useUpdateChecker() {
    const [isChecking, setIsChecking] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [lastCheck, setLastCheck] = useState<number | null>(null);
    const timeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
    const { toast } = useToast();

    const handleUpdatePrompt = useCallback(async (update: any) => {
        const version = update?.version || update?.latestVersion || 'latest';
        const updateCommand = update?.updateCommand || 'npm install -g productos@latest';
        const releaseUrl = sanitizeGithubReleaseUrl(update?.releaseUrl);

        const copyCommand = await appApi.ask(
            `A new version (${version}) of productOS is available!\n\nUpdate command:\n  ${updateCommand}\n\nCopy the update command to your clipboard?`
        );

        if (copyCommand) {
            try {
                await navigator.clipboard.writeText(updateCommand);
                toast({
                    title: 'Update Command Copied',
                    description: `Run "${updateCommand}" in your terminal to update productOS.`,
                });
            } catch {
                toast({
                    title: 'Update Available',
                    description: `Run "${updateCommand}" in your terminal to update.`,
                });
            }
        } else if (releaseUrl) {
            toast({
                title: `Version ${version} Available`,
                description: `Run "${updateCommand}" or view release notes on GitHub.`,
            });
        }
    }, [toast]);

    const checkAppForUpdates = useCallback(async (showNoUpdateMessage = true) => {
        if (isChecking) return;

        // Threshold check for automatic checks
        if (!showNoUpdateMessage) {
            try {
                const config = await appApi.getAppConfig();
                if (config?.last_update_check) {
                    const lastCheckTs = new Date(config.last_update_check).getTime();
                    if (!Number.isNaN(lastCheckTs) && Date.now() - lastCheckTs < 24 * 60 * 60 * 1000) return;
                }
            } catch {
                if (lastCheck && (Date.now() - lastCheck < MIN_CHECK_INTERVAL)) return;
            }
        }

        setIsChecking(true);
        let lastError: Error | null = null;
        const maxAttempts = 2;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            let timeoutId: ReturnType<typeof setTimeout> | null = null;
            try {
                const timeoutPromise = new Promise<never>((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error('Update check timed out')), UPDATE_CHECK_TIMEOUT);
                    timeoutIdsRef.current.add(timeoutId);
                });

                const update = await Promise.race([appApi.checkUpdate(), timeoutPromise]);
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutIdsRef.current.delete(timeoutId);
                }

                setLastCheck(Date.now());
                try { await appApi.updateLastCheck(); } catch { /* ignore */ }

                if (update?.available) {
                    setUpdateAvailable(true);
                    if (showNoUpdateMessage) {
                        await handleUpdatePrompt(update);
                    }
                } else {
                    setUpdateAvailable(false);
                    if (showNoUpdateMessage) {
                        await appApi.message('You are running the latest version!');
                    }
                }

                setIsChecking(false);
                return;
            } catch (error) {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutIdsRef.current.delete(timeoutId);
                }
                lastError = error instanceof Error ? error : new Error('Unknown error');
                if (attempt < maxAttempts - 1) {
                    await new Promise<void>(resolve => {
                        const retryId = setTimeout(() => {
                            timeoutIdsRef.current.delete(retryId);
                            resolve();
                        }, RETRY_DELAYS[attempt]);
                        timeoutIdsRef.current.add(retryId);
                    });
                }
            }
        }

        setUpdateAvailable(false);
        setIsChecking(false);

        if (showNoUpdateMessage && lastError) {
            toast({
                title: 'Update Check Failed',
                description: lastError.message,
                variant: 'destructive'
            });
        }
    }, [isChecking, lastCheck, handleUpdatePrompt, toast]);

    const enforceUpdatePolicy = useCallback(async () => {
        try {
            if (typeof window !== 'undefined' && window.location.protocol.startsWith('http') && !window.location.hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
                return;
            }

            const policy = await appApi.getUpdatePolicy();
            const minSupported = policy?.min_supported_version;
            if (!minSupported) return;

            const currentVersion = await appApi.getAppVersion();
            if (currentVersion === 'Unknown') return;

            if (compareVersions(currentVersion, minSupported) < 0) {
                await appApi.message(
                    policy?.message || `This version (${currentVersion}) is no longer supported. Please update to ${minSupported}.`
                );

                const shouldUpdateNow = await appApi.ask(
                    `Your version (${currentVersion}) is below minimum (${minSupported}). Check for updates now?`
                );

                if (shouldUpdateNow) {
                    await checkAppForUpdates(true);
                }
            }
        } catch (error) {
            if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) return;
            console.warn('Policy check failed:', error);
        }
    }, [checkAppForUpdates]);

    useEffect(() => {
        return () => {
            timeoutIdsRef.current.forEach((id) => clearTimeout(id));
            timeoutIdsRef.current.clear();
        };
    }, []);

    return {
        isChecking,
        updateAvailable,
        checkAppForUpdates,
        enforceUpdatePolicy
    };
}
