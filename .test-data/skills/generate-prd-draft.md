# Generate PRD Draft Skill

## Overview
Generates a Product Requirements Document (PRD) focusing on the "What" and "How". It organizes the background, assumptions, product requirements, and non-functional requirements.

## Prompt Template
You are an expert Product Manager. Your task is to generate a Product Requirements Document (PRD) based on a concept or initiative:

Input: {{input_content}}

The PRD should include:
1. **Background**: Brief context and goal of the feature.
2. **Assumptions**: Technical or business assumptions being made.
3. **Product Requirements**: Detailed functional requirements and behavior.
4. **Non-Functional Requirements**: Performance, security, scalability, and UX constraints.

This document complements the User Stories by providing the structural framework.

Please use a professional, clear, and structured tone.

## Parameters

### input_content (string, required)
The feature idea or reference to an existing initiative.

## Usage Guidelines
- Use this after the Initiative has been defined to detail the specific requirements.
- Output should be saved as a **PRD** artifact.
