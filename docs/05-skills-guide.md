# Skills Guide

[← Previous: Projects Guide](04-projects-guide.md) | [Back to Documentation Home](README.md) | [Next: Workflows Guide →](06-workflows-guide.md)

---

## Table of Contents
- [What are Skills?](#what-are-skills)
- [Why Use Skills?](#why-use-skills)
- [Understanding Skill Components](#understanding-skill-components)
- [Creating a Custom Skill](#creating-a-custom-skill)
- [Using Skills](#using-skills)
- [Managing Skills](#managing-skills)
- [Skill Examples](#skill-examples)
- [Best Practices](#best-practices)

---

## What are Skills?

**Skills** are reusable AI agent templates that perform specific tasks consistently. Think of them as specialized AI assistants that are experts in particular areas.

### The Problem Skills Solve

Without skills, every time you need AI help, you have to:
- Explain what you want in detail
- Describe the format you need
- Hope for consistent results
- Repeat the same instructions across projects

**With skills**, you:
- Define the task once
- Reuse it across all projects
- Get consistent, high-quality results
- Build a library of specialized agents

### Real-World Analogy

Think of skills like hiring specialists:
- Instead of explaining to a generalist every time, you have a **Research Specialist** who knows exactly how to conduct research
- A **Competitive Analyst** who always delivers competitor analysis in your preferred format
- A **PRD Writer** who creates Product Requirements Documents following your template

---

## Why Use Skills?

### 1. Consistency
Get the same quality output every time, regardless of who uses the skill or when.

**Without skills**:
- Different team members get different results
- Quality varies based on how well you prompt
- Hard to maintain standards

**With skills**:
- Everyone gets the same high-quality output
- Consistent format and structure
- Reliable results

### 2. Efficiency
Save time by not repeating instructions.

**Without skills**:
- Re-explain the task every time
- Adjust prompts until you get it right
- Waste time on formatting instructions

**With skills**:
- One-click activation
- No need to explain
- Immediate, correct results

### 3. Specialization
Create AI agents that are experts in specific domains.

**Examples**:
- **Research Assistant** - Thorough, academic-style research
- **Competitive Analyst** - Business intelligence focus
- **Technical Writer** - Clear, structured documentation
- **Code Reviewer** - Security and best practices focus

### 4. Reusability
Use the same skill across multiple projects.

**Example**: Create a "Competitive Analyst" skill once, use it for:
- Q1 competitive analysis
- Q2 competitive analysis
- New market entry research
- Feature comparison studies

### 5. Sharing
Share skills with your team for consistent results across the organization.

---

## Understanding Skill Components

Every skill has four main components:

### 1. Name and Description

**Name**: Short, clear identifier
- Example: "Research Assistant", "Competitive Analyst", "PRD Generator"

**Description**: Brief explanation of what the skill does
- Example: "Conducts thorough research on topics and provides comprehensive, well-structured analysis with citations"

### 2. Role

Defines **who** the AI agent is. This sets the expertise level and perspective.

**Examples**:
- "You are a senior product manager with 10 years of experience in SaaS products"
- "You are an expert market researcher specializing in competitive intelligence"
- "You are a technical writer who creates clear, user-friendly documentation"

**Why it matters**: The role shapes how the AI approaches tasks and the depth of analysis.

### 3. Tasks

Defines **what** the AI agent does. Be specific about the steps and approach.

**Example for Research Assistant**:
```
Your tasks are to:
1. Conduct comprehensive research on the given topic
2. Gather information from multiple perspectives
3. Analyze and synthesize findings
4. Identify key insights and patterns
5. Provide citations and sources where applicable
6. Present findings in a clear, structured format
```

### 4. Output Format

Defines **how** results should be presented. Specify structure, style, and format.

**Example**:
```
Provide your research in the following format:

## Executive Summary
Brief overview of key findings (2-3 paragraphs)

## Detailed Analysis
### Topic 1
- Key points
- Supporting evidence
- Sources

### Topic 2
...

## Key Insights
- Insight 1
- Insight 2
...

## Recommendations
Based on the research, recommend...
```

---

## Creating a Custom Skill

Let's create a "Competitive Analyst" skill step by step.

### Step 1: Open the Skills Tab

1. Click the **"Skills"** tab in the left sidebar
2. Click the **"+ New Skill"** button
3. The skill editor opens

### Step 2: Basic Information

**Name**: `Competitive Analyst`

**Description**: `Analyzes competitors' products, features, pricing, and positioning to provide strategic insights`

### Step 3: Define the Role

In the **Role** section, write:

```
You are a senior competitive intelligence analyst with 15 years of 
experience in the SaaS industry. You have deep expertise in market 
analysis, competitive positioning, and strategic planning. You 
understand business models, pricing strategies, and product 
differentiation.
```

**Tips**:
- Be specific about expertise level
- Mention relevant industry experience
- Include key competencies

### Step 4: Define the Tasks

In the **Tasks** section, write:

```
Your tasks are to:

1. Research the specified competitor thoroughly
2. Analyze their product features and capabilities
3. Evaluate their pricing model and tiers
4. Assess their market positioning and messaging
5. Identify their target customers and use cases
6. Compare their strengths and weaknesses
7. Identify opportunities and threats they present
8. Provide strategic recommendations
```

**Tips**:
- Use numbered lists for clarity
- Be specific about what to analyze
- Include the depth of analysis needed

### Step 5: Define the Output Format

In the **Output** section, write:

```
Provide your analysis in the following format:

## Company Overview
- Company name and website
- Founded date and size
- Key leadership
- Funding and valuation (if public)

## Product Analysis
### Core Features
- Feature 1: Description
- Feature 2: Description
...

### Unique Capabilities
What sets them apart from others

## Pricing Analysis
### Pricing Tiers
| Tier | Price | Key Features |
|------|-------|--------------|
| ... | ... | ... |

### Pricing Strategy
Analysis of their pricing approach

## Market Positioning
- Target customers
- Key messaging
- Brand positioning
- Marketing channels

## Competitive Assessment
### Strengths
- Strength 1
- Strength 2
...

### Weaknesses
- Weakness 1
- Weakness 2
...

### Opportunities (for us)
- Opportunity 1
- Opportunity 2
...

### Threats (from them)
- Threat 1
- Threat 2
...

## Strategic Recommendations
Based on this analysis, we should consider...
```

### Step 6: Add Examples (Optional)

Examples help the AI understand what you want. Add 1-2 examples:

**Example 1**:
- **Input**: "Analyze Notion as a competitor"
- **Expected Output**: (Show a sample of the desired output format)

### Step 7: Save the Skill

1. Click **"Save Skill"**
2. The skill is now available in your skills library
3. You can assign it to projects

---

## Using Skills

### Assigning Skills to Projects

**Method 1: During Project Creation**
1. When creating a new project
2. In the "Assign Skills" section
3. Select the skills you want to use
4. Click "Create Project"

**Method 2: In Project Settings**
1. Open an existing project
2. Go to Project Settings
3. In the "Assigned Skills" section
4. Add or remove skills
5. Click "Save"

### Using Skills in Chat

Once a skill is assigned to a project:

**Implicit use** (AI automatically uses appropriate skills):
```
You: Can you analyze our competitor Acme Corp?

AI: [Uses Competitive Analyst skill automatically]
```

**Explicit use** (specify which skill to use):
```
You: Using the Competitive Analyst skill, analyze Acme Corp

AI: [Uses specified skill]
```

### Using Skills in Workflows

Skills are the building blocks of workflows:

1. Create a workflow
2. Add an "Agent" step
3. Select the skill to use
4. Configure parameters
5. Connect to other steps

[Learn more in the Workflows Guide →](06-workflows-guide.md)

---

## Managing Skills

### Editing Skills

1. Click the **"Skills"** tab
2. Select the skill you want to edit
3. Make your changes
4. Click **"Save"**

**Note**: Changes affect all projects using this skill.

### Viewing Skill Usage

The skill editor shows:
- Which projects use this skill
- Which workflows use this skill
- Last modified date

This helps you understand the impact of changes.

### Deleting Skills

1. Select the skill
2. Click **"Delete"**
3. Confirm deletion

**Warning**: You cannot delete skills that are:
- Assigned to active projects
- Used in workflows

Remove them from projects/workflows first.

### Organizing Skills

**Best practices**:
- Use clear, descriptive names
- Group related skills (e.g., all research skills)
- Keep a "templates" folder for skill variations
- Document your skills library

---

## Skill Examples

### Example 1: Research Assistant

**Role**:
```
You are an expert research assistant with a PhD in information 
science. You excel at finding, analyzing, and synthesizing 
information from multiple sources.
```

**Tasks**:
```
1. Conduct thorough research on the given topic
2. Gather information from diverse, credible sources
3. Analyze and synthesize findings
4. Identify patterns and key insights
5. Present information clearly and objectively
6. Provide citations for all claims
```

**Output**:
```
## Research Summary
Brief overview of findings

## Detailed Findings
### Subtopic 1
- Key point 1 [Source]
- Key point 2 [Source]

### Subtopic 2
...

## Key Insights
- Insight 1
- Insight 2

## Sources
1. Source 1
2. Source 2
```

### Example 2: PRD Generator

**Role**:
```
You are a senior product manager who writes clear, comprehensive 
Product Requirements Documents (PRDs) that align stakeholders and 
guide development teams.
```

**Tasks**:
```
1. Understand the feature or product being specified
2. Define the problem and user needs
3. Outline functional and non-functional requirements
4. Specify user stories and acceptance criteria
5. Consider edge cases and constraints
6. Define success metrics
```

**Output**:
```
# [Feature Name] PRD

## Overview
Brief description of the feature

## Problem Statement
What problem does this solve?

## User Needs
- Need 1
- Need 2

## Requirements
### Functional Requirements
1. Requirement 1
2. Requirement 2

### Non-Functional Requirements
1. Performance
2. Security
3. Accessibility

## User Stories
As a [user type], I want [goal] so that [benefit]

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Success Metrics
- Metric 1: Target
- Metric 2: Target

## Out of Scope
What we're NOT building

## Open Questions
- Question 1
- Question 2
```

### Example 3: Document Summarizer

**Role**:
```
You are an expert at distilling complex documents into clear, 
concise summaries that capture the essential information.
```

**Tasks**:
```
1. Read and understand the full document
2. Identify the main points and key arguments
3. Extract critical data and insights
4. Eliminate redundancy and unnecessary details
5. Present a clear, structured summary
6. Maintain the original meaning and context
```

**Output**:
```
## Executive Summary
One paragraph overview

## Key Points
- Point 1
- Point 2
- Point 3

## Important Details
### Category 1
Details...

### Category 2
Details...

## Action Items (if applicable)
- Action 1
- Action 2

## Conclusion
Final takeaway
```

### Example 4: Code Reviewer

**Role**:
```
You are a senior software engineer with expertise in code quality, 
security, and best practices. You provide constructive, actionable 
feedback on code.
```

**Tasks**:
```
1. Review code for correctness and functionality
2. Check for security vulnerabilities
3. Assess code quality and maintainability
4. Identify performance issues
5. Suggest improvements and best practices
6. Provide specific, actionable recommendations
```

**Output**:
```
## Code Review Summary
Overall assessment

## Strengths
- What's done well
- Good practices observed

## Issues Found
### Critical
- Issue 1: Description and fix
- Issue 2: Description and fix

### Important
- Issue 1: Description and fix

### Minor
- Issue 1: Description and fix

## Recommendations
1. Recommendation 1
2. Recommendation 2

## Best Practices
Suggestions for improvement
```

---

## Best Practices

### Skill Design

**Be specific**:
- ❌ "You are a researcher"
- ✅ "You are a senior market researcher with 10 years of experience in competitive intelligence for SaaS companies"

**Define clear outputs**:
- Always specify the exact format you want
- Use templates and examples
- Include section headings and structure

**Test and iterate**:
- Create the skill
- Test it on real tasks
- Refine based on results
- Update as needed

### Skill Organization

**Naming conventions**:
- Use clear, descriptive names
- Be consistent (e.g., all end with "Assistant" or "Analyst")
- Avoid abbreviations

**Skill library**:
- Start with 3-5 core skills
- Add more as you identify patterns
- Don't create too many similar skills
- Consolidate when possible

**Documentation**:
- Keep notes on when to use each skill
- Document any special considerations
- Share skill guidelines with your team

### Using Skills Effectively

**Match skills to tasks**:
- Use Research Assistant for broad research
- Use Competitive Analyst for competitor-specific work
- Use PRD Generator for product specifications

**Combine skills**:
- Use multiple skills in workflows
- Research → Analysis → Documentation
- Each skill does what it does best

**Provide context**:
- Even with skills, provide relevant context
- Reference project goals
- Include specific requirements

---

## What's Next?

Now that you understand skills, learn how to:

1. **[Build Workflows](06-workflows-guide.md)** - Combine skills into automated processes
2. **[Configure Settings](07-settings-guide.md)** - Optimize your productOS setup
3. **[Share Your Work](08-data-portability.md)** - Share skills with your team

---

[← Previous: Projects Guide](04-projects-guide.md) | [Back to Documentation Home](README.md) | [Next: Workflows Guide →](06-workflows-guide.md)