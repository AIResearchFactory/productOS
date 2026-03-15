# Competitive analysis workflow Example

```prompt
Please create a workflow for a high-concurrency competitive research.

Input: A list of competitors from {{competitors_file}}.

Execution Logic:

1. Parallel Extraction: Immediately parse the input file for all competitor names and URLs. Treat each competitor as an independent execution thread to be processed in parallel.

2. Individual Deep-Dives: For each competitor identified, execute the following tasks using your best available research tools. Output a unique Markdown file for each competitor (e.g., competitive-analysis/competitor_name.md). Each task in this list should be a separate step in the workflow:

- Real Features vs. Marketing: Cross-reference marketing pages with technical docs/support KBs. Distinguish between 'GA' features vs. 'Coming Soon' or 'Enterprise-only' requests.
- Pricing & Packaging: Extract hidden details from help docs/forums. Break down cost-per-seat and identify mandatory implementation or add-on fees.
- Support Matrix: Table format showing tiers (Email, 24/7 Phone, CSM) and associated SLAs.
- Complexity Assessment: Rate 'Time-to-Value' and 'Implementation Complexity' (1-10). Note if certified consultants are required.
- User Sentiment: Summarize G2/Capterra reviews. Highlight the 'top 3 technical limitations' and 'top 3 praised features.'
- SWOT Analysis: Synthesize the above into a matrix. Specifically identify their technical vulnerabilities as our Opportunities.

3. Aggregated Summary: Once all individual files are generated, synthesize the data into a Master Summary File (competitive-analysis/00_executive_summary.md) including:

- Executive Summary & Strategic Recommendations.
- Feature Comparison Matrix: A side-by-side table of all competitors.
- Pricing Landscape: A comparative view of market costs.
- Market Positioning: Main target personas and messaging for each.
- Common Weaknesses: A summary of shared vulnerabilities across the field.

Requirements:
- All files must be saved in the competitive-analysis/ directory.
- The process must prioritize speed by analyzing competitors concurrently rather than sequentially.
- Use public websites, white-papers, technical blogs, demo videos, and API documentation.
```