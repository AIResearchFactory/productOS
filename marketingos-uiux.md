# marketingOS inside productOS — UI/UX v0

## Product framing
- productOS = build
- marketingOS = launch and grow
- Primary workflow: product item -> launch workspace

## Design principles
- Fast to understand
- Opinionated, not bloated
- Campaigns and launches are first-class
- AI assists, but structure leads
- Everything tied to a product item or campaign

## Primary users
- Founder
- Product manager
- Product marketer
- Small startup operator

## Core MVP surfaces

### 1. Dashboard
Purpose: quick operational overview

Sections:
- Top bar
  - Workspace switcher
  - Search
  - Create button
  - Notifications
  - User menu
- Left nav
  - Home
  - Launches
  - Campaigns
  - Assets
  - Calendar
  - Insights
  - Brand
- Main area
  - Hero card: current active launch
  - KPI row
    - Launches this month
    - Assets pending review
    - Published this week
    - Conversion snapshot
  - Upcoming milestones
  - AI recommendations
  - Recent activity

### 2. Launch Workspace
Purpose: convert a shipped/ready feature into GTM execution

Sections:
- Header
  - Launch name
  - Status badge
  - Linked product item
  - Owner
  - CTA: Generate assets
- Tabs
  - Brief
  - Messaging
  - Assets
  - Checklist
  - Timeline
  - Results

#### Brief tab
- Goal
- Audience
- Problem solved
- Key value props
- Channels
- Success metric
- AI summary panel

#### Messaging tab
- Core message
- 3 value prop cards
- ICP-specific angle cards
- Objections and answers
- Tone selector
- CTA selector

#### Assets tab
- Asset list with filters
- Types:
  - Email
  - Landing page
  - Social post
  - Release note
  - Internal enablement
- Status chips: Draft / Review / Approved / Scheduled / Published
- Right-side AI actions panel

#### Checklist tab
- Auto-generated launch checklist
- Sections:
  - Messaging
  - Content
  - Website
  - Internal alignment
  - Analytics
- Owner + due date per item

#### Timeline tab
- Calendar/list hybrid
- Milestones:
  - Draft ready
  - Review
  - Publish
  - Follow-up

#### Results tab
- KPI cards
- Channel performance list
- Learnings box
- Recommended next steps

### 3. Campaigns
Purpose: ongoing marketing work beyond one launch

Views:
- Table
- Kanban
- Calendar

Campaign card fields:
- Name
- Goal
- Audience
- Channel mix
- Status
- Owner
- KPI progress

### 4. Assets Library
Purpose: all content in one place

Features:
- Search/filter
- Sort by campaign/channel/status
- Grid/list toggle
- Version history
- Linked campaign/product item

Asset detail:
- Editor center
- Context panel right
- Approval / comments area
- Variant switcher

### 5. Insights
Purpose: explain performance and next actions

Sections:
- KPI overview
- Channel comparison
- Top assets
- Underperforming assets
- AI insight feed
- Recommendations queue

## Navigation model
- Primary left nav
- Context tabs within object pages
- Sticky action bar on object pages

## Key UX flow
1. User marks feature as ready in productOS
2. CTA appears: Create launch workspace
3. marketingOS pre-fills brief from product context
4. User reviews messaging
5. User generates assets
6. User assigns checklist
7. User publishes / tracks status
8. User reviews results

## Wireframe notes

### Dashboard wireframe
- Left nav vertical
- Top summary strip
- Large current launch card on upper left
- Recommendations panel on upper right
- Bottom: milestones and recent activity

### Launch workspace wireframe
- Header with title + actions
- Horizontal tabs
- Two-column content on most tabs
- Main editable panel + right context/AI panel

## Visual style
- Clean, B2B, slightly Linear/Notion-inspired
- Neutral base with one accent color
- Strong typography hierarchy
- Rounded cards, subtle borders
- Dense but readable

## Suggested design tokens
- Background: #0B1020 or light variant depending theme
- Surface: #12172A
- Border: #242B45
- Text primary: #F5F7FF
- Text secondary: #A8B0CC
- Accent: #6D5EF9
- Success: #22C55E
- Warning: #F59E0B
- Danger: #EF4444

## Component list
- Sidebar
- Topbar
- KPI card
- Launch card
- Campaign card
- Asset row
- Status badge
- Recommendation card
- Timeline item
- Empty state
- AI action panel

## MVP prototype recommendation
Build first:
- Dashboard
- Launch Workspace / Brief
- Launch Workspace / Assets
- Insights page

## Crisp UX summary
- Core object = Launch
- Secondary object = Campaign
- Every launch links back to product context
- AI is embedded as actions and summaries, not a full-screen gimmick
