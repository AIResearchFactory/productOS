use anyhow::anyhow;
use crate::models::ai::ProviderType;

pub struct AIErrorService;

impl AIErrorService {
    /// Map various AI provider error strings to user-friendly, actionable anyhow::Errors
    pub fn map_error(
        err_msg: &str,
        provider_type: &ProviderType,
        model_alias: Option<&str>,
    ) -> anyhow::Error {
        let err_lower = err_msg.to_lowercase();
        let provider_name = match provider_type {
            ProviderType::Ollama => "Ollama",
            ProviderType::ClaudeCode => "Claude Code",
            ProviderType::HostedApi => "Hosted API",
            ProviderType::GeminiCli => "Gemini",
            ProviderType::OpenAiCli => "OpenAI",
            ProviderType::LiteLlm => "LiteLLM",
            ProviderType::AutoRouter => "Auto-Router",
            ProviderType::Custom(id) => id,
        };

        // 1. Quota / Capacity Errors (Common across providers)
        if err_msg.contains("429") 
            || err_lower.contains("insufficient_quota") 
            || err_lower.contains("exceeded your current quota")
            || err_lower.contains("rate_limit_reached")
            || err_lower.contains("billing hard limit_reached")
            || err_lower.contains("insufficient_funds")
            || err_lower.contains("credit_balance_is_too_low")
            || err_lower.contains("resource_exhausted")
            || err_lower.contains("quota exceeded")
            || err_lower.contains("rate limit exceeded")
            || err_lower.contains("capacity exhausted")
        {
            return anyhow!(
                "{} API capacity exhausted (429). Check your billing dashboard or try switching models.\n\nDetails: {}",
                provider_name,
                err_msg
            );
        }

        // 2. Authentication Errors
        if err_msg.contains("401")
            || err_lower.contains("not logged")
            || err_lower.contains("not authenticated")
            || err_lower.contains("login required")
            || err_lower.contains("please login")
            || err_lower.contains("unauthorized")
            || err_lower.contains("authentication failed")
            || err_lower.contains("invalid api key")
        {
            let advice = match provider_type {
                ProviderType::OpenAiCli => "\nGo to Settings → OpenAI (ChatGPT Login) and click 'Login / Refresh Session'.",
                ProviderType::ClaudeCode => "\nRun 'claude login' in your terminal or check your API key in Settings.",
                ProviderType::GeminiCli => "\nCheck your Gemini API key in Settings or run 'gemini --auth'.",
                _ => "\nPlease check your API key or authentication settings.",
            };
            return anyhow!(
                "{} is not authenticated yet.{}\n\nDetails: {}",
                provider_name,
                advice,
                err_msg
            );
        }

        // 3. Model Not Found Errors
        if err_msg.contains("404")
            || err_lower.contains("model_not_found")
            || err_lower.contains("model not found")
            || err_lower.contains("unknown model")
            || err_lower.contains("invalid model")
        {
            let model_info = model_alias.map(|m| format!(" '{}'", m)).unwrap_or_default();
            return anyhow!(
                "{} model not found (404). Your model alias{} might be invalid.\n\nDetails: {}",
                provider_name,
                model_info,
                err_msg
            );
        }

        // 4. Permission / Forbidden Errors
        if err_msg.contains("403") || err_lower.contains("permission_denied") || err_lower.contains("forbidden") {
            return anyhow!(
                "{} permission denied (403). Check if your API key has access to the requested model.\n\nDetails: {}",
                provider_name,
                err_msg
            );
        }

        // Generic Fallback
        anyhow!("{} error: {}", provider_name, err_msg)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ai::ProviderType;

    #[test]
    fn test_openai_quota_error() {
        let err = AIErrorService::map_error("Error 429: insufficient_quota", &ProviderType::OpenAiCli, None);
        assert!(err.to_string().contains("OpenAI API capacity exhausted"));
    }

    #[test]
    fn test_gemini_quota_error() {
        let err = AIErrorService::map_error("RESOURCE_EXHAUSTED: Quota exceeded", &ProviderType::GeminiCli, None);
        assert!(err.to_string().contains("Gemini API capacity exhausted"));
    }

    #[test]
    fn test_claude_auth_error() {
        let err = AIErrorService::map_error("unauthorized: invalid api key", &ProviderType::ClaudeCode, None);
        assert!(err.to_string().contains("Claude Code is not authenticated"));
        assert!(err.to_string().contains("claude login"));
    }

    #[test]
    fn test_model_not_found() {
        let err = AIErrorService::map_error("model_not_found", &ProviderType::Ollama, Some("mistral-wrong"));
        assert!(err.to_string().contains("Ollama model not found"));
        assert!(err.to_string().contains("'mistral-wrong'"));
    }
}
