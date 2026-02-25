use anyhow::Result;
use futures::stream::Stream;
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use async_trait::async_trait;
use crate::models::llm::LlmProvider;
use crate::models::chat::ChatRequest;
use serde_json::{Value, json};
use crate::models::ai::{Message, ToolCall, ChatResponse, Tool};

const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";
const CLAUDE_API_VERSION: &str = "2023-06-01";

#[derive(Debug, Serialize)]
struct ClaudeApiRequest {
    model: String,
    messages: Vec<ClaudeApiMessage>,
    max_tokens: u32,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<Tool>>,
}

#[derive(Debug, Serialize)]
struct ClaudeApiMessage {
    role: String,
    content: Value, // Can be String or Vec<ClaudeContentBlock>
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
enum ClaudeContentBlock {
    Text { text: String },
    ToolUse { id: String, name: String, input: Value },
    ToolResult { tool_use_id: String, content: String, #[serde(default)] is_error: bool },
}



#[derive(Debug, Deserialize)]
struct ClaudeApiResponse {
    content: Vec<ClaudeContentBlockResponse>,
}

#[derive(Debug, Deserialize)]
struct ClaudeContentBlockResponse {
    #[serde(rename = "type")]
    content_type: String,
    text: Option<String>,
    name: Option<String>,
    input: Option<Value>,
    id: Option<String>,
}

pub struct ClaudeService {
    api_key: String,
    model: String,
    client: reqwest::Client,
}

impl ClaudeService {
    pub fn new(api_key: String, model: String) -> Self {
        let client = reqwest::Client::new();
        Self { api_key, model, client }
    }

    pub async fn send_message_sync(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        tools: Option<Vec<Tool>>,
    ) -> Result<ChatResponse> {
        let mut headers = HeaderMap::new();
        headers.insert("x-api-key", HeaderValue::from_str(&self.api_key)?);
        headers.insert("anthropic-version", HeaderValue::from_static(CLAUDE_API_VERSION));
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        let mut api_messages = Vec::new();
        for msg in messages {
            let mut content_blocks = Vec::new();
            
            // Add text content
            if !msg.content.is_empty() {
                content_blocks.push(ClaudeContentBlock::Text { text: msg.content });
            }

            // Add tool calls (if any)
            if let Some(tool_calls) = msg.tool_calls {
                for tc in tool_calls {
                    content_blocks.push(ClaudeContentBlock::ToolUse {
                        id: tc.id,
                        name: tc.function.name,
                        input: serde_json::from_str(&tc.function.arguments).unwrap_or(json!({})),
                    });
                }
            }

            // Add tool results (if any)
            if let Some(tool_results) = msg.tool_results {
                for tr in tool_results {
                    content_blocks.push(ClaudeContentBlock::ToolResult {
                        tool_use_id: tr.tool_use_id,
                        content: tr.content,
                        is_error: tr.is_error,
                    });
                }
            }

            api_messages.push(ClaudeApiMessage {
                role: msg.role,
                content: json!(content_blocks),
            });
        }

        let api_request = ClaudeApiRequest {
            model: self.model.clone(),
            messages: api_messages,
            max_tokens: 4096,
            stream: false,
            system: system_prompt,
            tools,
        };

        let response = self.client.post(CLAUDE_API_URL).headers(headers).json(&api_request).send().await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            anyhow::bail!("Claude API error: {}", error_text);
        }

        let api_response: ClaudeApiResponse = response.json().await?;
        let mut content_text = String::new();
        let mut tool_calls = Vec::new();

        for block in api_response.content {
            match block.content_type.as_str() {
                "text" => {
                    if let Some(t) = block.text {
                        content_text.push_str(&t);
                    }
                }
                "tool_use" => {
                    if let (Some(name), Some(input), Some(id)) = (block.name, block.input, block.id) {
                        tool_calls.push(ToolCall {
                            id,
                            tool_type: "function".to_string(),
                            function: crate::models::ai::ToolFunction {
                                name,
                                arguments: input.to_string(),
                            },
                        });
                    }
                }
                _ => {}
            }
        }

        Ok(ChatResponse {
            content: content_text,
            tool_calls: if tool_calls.is_empty() { None } else { Some(tool_calls) },
        })
    }
}

#[async_trait]
impl LlmProvider for ClaudeService {
    fn id(&self) -> String { "anthropic".to_string() }

    async fn chat_stream(&self, _request: ChatRequest) -> Result<Pin<Box<dyn Stream<Item = Result<String>> + Send>>> {
        Err(anyhow::anyhow!("Streaming not fully implemented for tools yet"))
    }

    async fn chat_sync(&self, request: ChatRequest) -> Result<String> {
        let messages = request.messages.into_iter().map(|m| Message {
            role: m.role,
            content: m.content,
            tool_calls: None,
            tool_results: None,
        }).collect();
        self.send_message_sync(messages, request.system_prompt, None).await.map(|r| r.content)
    }
}
