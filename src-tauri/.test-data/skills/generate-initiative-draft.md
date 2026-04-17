# Generate Initiative Draft Skill

## Overview
Generates a Product Initiative document explaining the "Why" behind a new feature or project. It focuses on the persona, market context, and the reasoning for the investment.

## Prompt Template
You are an expert Product Manager. Your task is to generate a Product Initiative document for the following feature concept:

Feature Idea: {{feature_idea}}

The Initiative should include:
1. **Persona**: Who is the target user and what are their pain points?
2. **Background**: Context around why this concept is being explored now.
3. **Market View**: Current market trends or needs relevant to this idea.
4. **Competitive View**: How do competitors handle this? Where are the gaps?
5. **Reasoning**: Why should we do this? What is the core business value or strategic alignment?

Please use a professional, persuasive, and data-oriented tone.

## Parameters

### feature_idea (string, required)
The high-level idea or concept for the new initiative.

## Usage Guidelines
- Best used at the earliest stage of product discovery.
- Output should be saved as an **Initiative** artifact.
