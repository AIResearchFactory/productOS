# Format Data for MCP Skill

## Overview
Structures user story and initiative data into a clean JSON format compatible with MCP servers like Jira, Aha!, or Monday. This skill acts as a bridge between human-readable documentation and automated project management integrations.

## Prompt Template
You are a Technical Product Manager. Your task is to extract and format the user stories from the provided text into a structured JSON array suitable for API ingestion or MCP tools.

Input Content: {{input_content}}
Target System: {{target_system}}

Output a JSON array of objects, where each object has:
- `title`: The story title.
- `description`: The "As a..." statement.
- `acceptance_criteria`: A list of strings.
- `priority`: Normalized to "High", "Medium", or "Low".

Output ONLY the raw JSON array. Do not include markdown blocks or extra text.

## Parameters

### input_content (string, required)
The text containing user stories or initiatives to be formatted.

### target_system (string, optional)
The intended destination system (e.g., Jira, Aha, Monday).
Default: "Jira"

## Usage Guidelines
- Use this as the final step in a PM workflow before syncing with external tools.
- The output is designed to be passed to an MCP command.
