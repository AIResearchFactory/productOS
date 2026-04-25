import { useState, useCallback, useEffect } from 'react';
import { appApi } from '../api/app';
import { useToast } from './use-toast';

const UPDATE_CHECK_TIMEOUT = 30000; // 30 seconds
const MIN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes between checks
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff
const UPDATE_POLICY_URL = 'https://github.com/AIResearchFactory/productOS/releases/latest/download/policy.json';

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

export function useUpdateChecker() {
    const [isChecking, setIsChecking] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [lastCheck, setLastCheck] = useState<number | null>(null);
    const { toast } = useToast();

    const handleUpdatePrompt = useCallback(async (update: any) => {
        const shouldUpdate = await appApi.ask(
            `A new version ${update.version} is available!\n\nWould you like to download and install it now?`,
            {
                title: 'Update Available',
                kind: 'info'
            }
        );

        if (!shouldUpdate) return;

        let attemptsRemaining = 2;
        let success = false;

        while (attemptsRemaining > 0 && !success) {
            try {
                const attemptNumber = 3 - attemptsRemaining;
                toast({
                    title: attemptNumber === 1 ? 'Downloading Update' : 'Retrying Download',
                    description: attemptNumber === 1
                        ? 'Please wait while the update is being downloaded and installed...'
                        : 'The first attempt failed. Retrying one more time...',
                });

                await update.downloadAndInstall();
                success = true;

                const shouldRelaunch = await appApi.ask(
                    'Update installed successfully!\n\nWould you like to restart the application now?',
                    {
                        title: 'Update Installed',
                        kind: 'info'
                    }
                );

                if (shouldRelaunch) {
                    await appApi.relaunch();
                }
            } catch (error) {
                attemptsRemaining--;
                if (attemptsRemaining > 0) {
                    const tryAgain = await appApi.ask(
                        'The update download failed. Would you like to try one more time?',
                        {
                            title: 'Update Failed',
                            kind: 'warning'
                        }
                    );
                    if (!tryAgain) break;
                } else {
                    toast({
                        title: 'Update Failed',
                        description: 'Failed to download or install after 2 attempts. Please download manually.',
                        variant: 'destructive',
                        duration: 10000
                    });
                }
            }
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
                    if (Date.now() - lastCheckTs < 24 * 60 * 60 * 1000) return;
                }
            } catch (error) {
                if (lastCheck && (Date.now() - lastCheck < MIN_CHECK_INTERVAL)) return;
            }
        }

        setIsChecking(true);
        let lastError: Error | null = null;
        const maxAttempts = 2;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Update check timed out')), UPDATE_CHECK_TIMEOUT)
                );

                const update = await Promise.race([appApi.checkUpdate(), timeoutPromise]);
                setLastCheck(Date.now());
                try { await appApi.updateLastCheck(); } catch (e) {}

                if (update?.available) {
                    setUpdateAvailable(true);
                    if (showNoUpdateMessage) {
                        await handleUpdatePrompt(update);
                    }
                } else {
                    setUpdateAvailable(false);
                    if (showNoUpdateMessage) {
                        await appApi.message('You are running the latest version!', {
                            title: 'No Updates Available',
                            kind: 'info'
                        });
                    }
                }

                setIsChecking(false);
                return;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');
                if (attempt < maxAttempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
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
            if (typeof window !== 'undefined' && !(window as Window & { __TAURI__?: unknown }).__TAURI__ && window.location.protocol.startsWith('http')) {
                return;
            }

            const response = await fetch(`${UPDATE_POLICY_URL}?t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) return;

            const policy = await response.json();
            const minSupported = policy?.min_supported_version;
            if (!minSupported) return;

            const currentVersion = await appApi.getAppVersion();
            if (currentVersion === 'Unknown') return;

            if (compareVersions(currentVersion, minSupported) < 0) {
                await appApi.message(
                    policy?.message || `This version (${currentVersion}) is no longer supported. Please update to ${minSupported}.`,
                    { title: 'Update Required', kind: 'warning' }
                );

                const shouldUpdateNow = await appApi.ask(
                    `Your version (${currentVersion}) is below minimum (${minSupported}). Check for updates now?`,
                    { title: 'Update Required', kind: 'warning' }
                );

                if (shouldUpdateNow) {
                    await checkAppForUpdates(true);
                }
            }
        } catch (error) {
            // Silence policy check warnings in non-Tauri environments as they often fail due to CORS
            // This is non-critical background information.
            if (window.location.protocol.startsWith('http')) return;
            
            console.warn('Policy check failed:', error);
        }
    }, [checkAppForUpdates]);

    // Cleanup on unmount if needed
    useEffect(() => {
        return () => {
            // No cleanup needed currently
        };
    }, []);

    return {
        isChecking,
        updateAvailable,
        checkAppForUpdates,
        enforceUpdatePolicy
    };
}
