/**
 * Robust JSON extraction, cleaning, and repair utilities for LLM outputs.
 */

export function repairJson(jsonStr: string): string;

export function cleanJsonContent(raw: string): string;

export function extractAndParseJson<T = any>(raw: string, fallback?: T): T;
