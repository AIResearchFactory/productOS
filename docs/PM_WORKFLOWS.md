# PM-Domain Specific Workflows

ProductOS now supports first-class Product Management (PM) workflows that move from high-level feature ideas to structured artifacts like PRDs and User Stories.

## Out-of-the-Box PM Skills

We've added 4 specialized PM skills that are available immediately:

1.  **PRD Generator (`generate-prd-draft`)**: Generates an initial PRD draft from a feature concept.
2.  **PRD Refiner (`refine-prd-contextually`)**: Analyzes the PRD in the context of your project (reading all project files) and asks clarifying questions.
3.  **User Story Generator (`generate-user-stories`)**: Breaks down your refined PRD into detailed user stories with acceptance criteria.
4.  **Data Formatter (`format-data`)**: Structures your user stories into JSON for easy ingestion by MCP tools (Jira, Aha, etc.).

## Artifact Integration

Steps in a PM workflow can now produce **Artifacts**. Artifacts are structured documents (Markdown + JSON) that are tracked within your project's `requirements`, `insights`, or `decisions` directories.

When a workflow step generates an artifact, it will:
- appear in the **Artifacts** section of the app.
- be versioned and searchable.
- contain metadata linking it to the workflow and project.

## How to Create a PM Workflow

1.  Open the **Magic Workflow Builder**.
2.  Enter a prompt like: *"I want to create a PRD for an AI-powered A/B testing recommendation engine and then generate user stories."*
3.  The AI will automatically architect a workflow using the new PM skills and prescribe artifact generation for the PRD and User Stories.
4.  Run the workflow.
5.  Check your **Requirements** or **Artifacts** tab to see the results.

## Interactive Refinement

For skills that ask clarifying questions (like the **PRD Refiner**), the workflow will present the questions in the chat. You can answer them, and the workflow will proceed with the refined context.

---

*ProductOS: Local-first, PM-driven development.*
