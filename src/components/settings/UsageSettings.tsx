import React from 'react';
import { RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UsageStatistics, Project } from '@/api/tauri';

interface UsageSettingsProps {
    usageStats: UsageStatistics | null;
    projectsList: Project[];
    selectedProjectId: string;
    onProjectIdChange: (id: string) => void;
    onRefresh: () => void;
}

const UsageSettings: React.FC<UsageSettingsProps> = ({
    usageStats,
    projectsList,
    selectedProjectId,
    onProjectIdChange,
    onRefresh
}) => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight">Billing & Usage</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Detailed analytics of your AI interaction costs, token efficiency, and saved time</p>
                        </div>
                        <div className="h-8 border-r border-gray-200 dark:border-gray-800 ml-2" />
                        <div className="flex flex-col gap-1.5 min-w-[180px]">
                            <Label className="text-2xs uppercase font-bold text-gray-400">Filter by Product</Label>
                            <Select value={selectedProjectId} onValueChange={onProjectIdChange}>
                                <SelectTrigger className="h-8 text-xs bg-white/50 dark:bg-gray-800/50">
                                    <SelectValue placeholder="All Products" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Products</SelectItem>
                                    {projectsList.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        className="gap-2"
                    >
                        <RefreshCcw className="w-3.5 h-3.5" />
                        Refresh
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-sm border-2">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-2xs uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 opacity-70">Total Cost</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="flex items-baseline flex-wrap gap-x-2">
                                <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 break-all leading-tight">
                                    {usageStats ? `$${usageStats.totalCostUsd.toFixed(4)}` : '$0.0000'}
                                </span>
                                <span className="text-2xs font-medium text-emerald-600/50 uppercase">USD</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-indigo-500/20 bg-indigo-500/5 shadow-sm border-2">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-2xs uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400 opacity-70">Total Prompts</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="flex flex-col">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                                        {(usageStats?.totalPrompts || 0).toLocaleString()}
                                    </span>
                                </div>
                                <span className="text-2xs font-medium text-indigo-600/50">
                                    {(usageStats?.totalResponses || 0).toLocaleString()} total responses
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-blue-500/20 bg-blue-500/5 shadow-sm border-2">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-2xs uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400 opacity-70">Total Tokens</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="flex flex-col">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                                        {((usageStats?.totalInputTokens || 0) + (usageStats?.totalOutputTokens || 0)).toLocaleString()}
                                    </span>
                                </div>
                                <span className="text-2xs font-medium text-blue-600/50">
                                    {usageStats?.totalInputTokens.toLocaleString()} in / {usageStats?.totalOutputTokens.toLocaleString()} out
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-purple-500/20 bg-purple-500/5 shadow-sm border-2">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-2xs uppercase tracking-wider font-bold text-purple-600 dark:text-purple-400 opacity-70">Cache Efficiency</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="flex flex-col">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
                                        {usageStats?.totalInputTokens ? Math.round((usageStats.totalCacheReadTokens / usageStats.totalInputTokens) * 100) : 0}%
                                    </span>
                                </div>
                                <span className="text-2xs font-medium text-purple-600/50">
                                    {usageStats?.totalCacheReadTokens.toLocaleString()} tokens cached
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-500/20 bg-amber-500/5 shadow-sm border-2">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-2xs uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400 opacity-70">Est. Time Saved</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="flex flex-col">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                                        {usageStats ? (usageStats.totalTimeSavedMinutes / 60).toFixed(1) : '0.0'}
                                    </span>
                                    <span className="text-2xs font-medium text-amber-600/50 uppercase">HOURS</span>
                                </div>
                                <span className="text-2xs font-medium text-amber-600/50">
                                    {usageStats?.totalToolCalls || 0} tool calls executed
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 shadow-sm border-2 overflow-hidden">
                    <CardHeader className="p-4 border-b border-gray-100 dark:border-gray-800">
                        <CardTitle className="text-sm font-semibold">Usage by Provider</CardTitle>
                        <CardDescription className="text-xs">Detailed breakdown including caching and reasoning performance</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 dark:bg-gray-800/50 text-2xs uppercase tracking-wider text-gray-500 font-bold">
                                        <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">Provider</th>
                                        <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-right">Prompts</th>
                                        <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-right">Tokens (In / Out)</th>
                                        <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-right">Cache (R / W)</th>
                                        <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-right">Reasoning</th>
                                        <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-right">Cost (USD)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usageStats?.providerBreakdown?.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/30 dark:hover:bg-hover:bg-gray-800/30 transition-colors border-b border-gray-100 dark:border-gray-800">
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{item.provider}</td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex flex-col">
                                                    <span className="font-mono">{item.promptCount.toLocaleString()}</span>
                                                    <span className="text-2xs text-gray-400">{item.responseCount.toLocaleString()} responses</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex flex-col">
                                                    <span className="font-mono">{item.totalInputTokens.toLocaleString()}</span>
                                                    <span className="text-2xs text-gray-400">{item.totalOutputTokens.toLocaleString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-purple-600 dark:text-purple-400">{item.totalCacheReadTokens.toLocaleString()}</span>
                                                    <span className="text-2xs text-gray-400">{item.totalCacheCreationTokens.toLocaleString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">
                                                {item.totalReasoningTokens.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                                ${item.totalCostUsd.toFixed(4)}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!usageStats?.providerBreakdown || usageStats.providerBreakdown.length === 0) && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-10 text-center text-gray-400 italic">
                                                No usage data recorded yet
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
};

export default UsageSettings;
