Please create a workflow with a task-based structure
The first step would be to read the input file ({{competitors_file}} parameter) and extracts competitor names/URLs
Then each step analyzes ALL competitors for a specific task type listed below, making it flexible for any number of competitors in the input file.
Each task should use the best available skill that you have for the task.
The deep-dive competitive analysis and data extraction tasks are:
- Real Features vs. Marketing: Cross-reference their main marketing page with their technical documentation and support knowledge base. Identify features that are currently 'General Availability' versus those listed as 'Coming Soon' or only available via 'Enterprise' custom requests.
- Pricing & Packaging: Extract hidden pricing details from help docs or forum discussions. Break down the cost per user/seat and identify any mandatory 'implementation fees' or 'add-on' costs.
- Support Matrix: Create a table showing their support tiers (e.g., Email, 24/7 Phone, Dedicated Success Manager) and the associated response-time SLAs.
- Complexity Assessment: Based on demo videos and user manuals, rate the 'Time-to-Value' and 'Implementation Complexity' on a scale of 1-10. Note if it requires specialized certified consultants.
- User Sentiment (G2/Capterra): Summarize recent reviews. Specifically highlight the 'top 3 technical limitations' mentioned by verified users and the 'top 3 most praised features.'
- SWOT Analysis: Synthesize the above into a SWOT matrix, focusing specifically on their technical vulnerabilities as an Opportunity for us.
Use the competitor public website and product documentation, Published white-papers and technical blog posts, Product demo videos and marketing materials, Third-party customer reviews (G2), Public integrations marketplace and API documentationAll outputs should be saved in a competitive-analysis/ directory.
After this analysis, the last step would be to create an executive summary, feature comparison matrix, pricing landscape, market positioning, common weaknesses, strategic recommendations in a new file including all following details (but not limited to them): competitor name, competitor website, documentation link if available, main target persona, main messaging, main capabilities, SWOT, if there are any user reviews and comments include a summary of those as well.
