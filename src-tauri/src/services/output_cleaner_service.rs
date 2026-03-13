use regex::Regex;

/// Service that strips internal AI "thinking" noise from responses before they are written
/// to workflow output files. This is provider-agnostic and handles patterns emitted by
/// Claude, Gemini CLI, and other models that expose chain-of-thought text.
pub struct OutputCleanerService;

impl OutputCleanerService {
    /// Clean AI output before writing it to a project file or artifact.
    /// Removes all known thinking/planning/tool-use noise patterns.
    pub fn clean(raw: &str) -> String {
        let mut cleaned = raw.to_string();

        // ── XML-style thinking blocks (Claude extended thinking, o1-style) ──────────
        // <thinking>...</thinking>  (case-insensitive, greedy within block)
        for tag in &["thought", "thinking", "reasoning", "reflection", "scratchpad", "planning"] {
            let pattern = format!(r"(?si)<{tag}>.*?</{tag}>");
            if let Ok(re) = Regex::new(&pattern) {
                cleaned = re.replace_all(&cleaned, "").to_string();
            }
        }

        // ── Claude Code CLI header/footer artifacts ───────────────────────────────
        cleaned = cleaned.replace("---output---", "");

        // Tool use chatter:  [using tool browser_use] / [Tool: web_search] etc.
        if let Ok(re) = Regex::new(r"(?i)\[(?:using )?tool[^\]]*\]") {
            cleaned = re.replace_all(&cleaned, "").to_string();
        }

        // ── Gemini CLI verbose prefixes ───────────────────────────────────────────
        // Lines that start with "Thinking..." or "Let me think..."
        if let Ok(re) = Regex::new(r"(?im)^(thinking\.\.\.|let me think.*|i('m| am) thinking.*|planning:.*|reasoning:.*)\n?") {
            cleaned = re.replace_all(&cleaned, "").to_string();
        }

        // ── OpenAI o3/o1 "chain-of-thought" fenced blocks ────────────────────────
        // ```thinking\n...\n```
        if let Ok(re) = Regex::new(r"(?si)```(?:thinking|reasoning|scratchpad)\n.*?\n```") {
            cleaned = re.replace_all(&cleaned, "").to_string();
        }

        // ── Internal monologue lines (heuristic) ─────────────────────────────────
        // Lines that start with "[Thinking]" / "[Planning]" / "(thinking)" etc.
        if let Ok(re) = Regex::new(r"(?im)^\s*[\[\(](?:thinking|planning|reasoning|internal)[\]\)].*\n?") {
            cleaned = re.replace_all(&cleaned, "").to_string();
        }

        // ── Collapse excessive blank lines left behind by removals ────────────────
        if let Ok(re) = Regex::new(r"\n{3,}") {
            cleaned = re.replace_all(&cleaned, "\n\n").to_string();
        }

        cleaned.trim().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_removes_thinking_block() {
        let input = "<thinking>I need to plan this carefully.\nStep 1: do X\n</thinking>\n\nHere is the answer.";
        let result = OutputCleanerService::clean(input);
        assert!(!result.contains("<thinking>"));
        assert!(result.contains("Here is the answer."));
    }

    #[test]
    fn test_removes_tool_use_chatter() {
        let input = "[using tool web_search]\nThe results show that...\n[Tool: browser]";
        let result = OutputCleanerService::clean(input);
        assert!(!result.contains("[using tool"));
        assert!(result.contains("The results show that"));
    }

    #[test]
    fn test_removes_fenced_thinking_block() {
        let input = "```thinking\nLet me reason about this...\n```\n\n# Report\nContent here.";
        let result = OutputCleanerService::clean(input);
        assert!(!result.contains("Let me reason about this"));
        assert!(result.contains("# Report"));
    }

    #[test]
    fn test_removes_output_separator() {
        let input = "---output---\n\nFinal content.";
        let result = OutputCleanerService::clean(input);
        assert!(!result.contains("---output---"));
        assert!(result.contains("Final content."));
    }

    #[test]
    fn test_preserves_clean_content() {
        let input = "# Competitive Analysis\n\n## Symantec\n\nSymantec is a leader in DLP.";
        let result = OutputCleanerService::clean(input);
        assert_eq!(result, input.trim());
    }

    #[test]
    fn test_collapses_excessive_blank_lines() {
        let input = "Line one.\n\n\n\n\nLine two.";
        let result = OutputCleanerService::clean(input);
        assert!(!result.contains("\n\n\n"));
    }
}
