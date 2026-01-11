-- Migration: 006_update_extraction_prompt.sql
-- Description: Update extraction prompt for improved structured output
-- Date: 2026-01-11

-- Update the extraction prompt with improved instructions for structured JSON output
UPDATE prompts
SET user_prompt_template = 'You are an expert document analyst. Your task is to extract all structured content from a document and reformat it into a structured JSON object.

INPUT: A document that may contain tables, lists, sections, or other structured content.

CRITICAL: You MUST extract EACH distinct section/row/cell separately. Do NOT combine or concatenate content from different sections.

OUTPUT: A structured JSON object with the following format:
{
  "title": "<Title of the document, if available>",
  "language": "<primary language code, e.g., ''en''>",
  "pages": [
    {
      "pageNumber": <1-indexed page number>,
      "text": "<VERBATIM text content for this page>",
      "headings": ["<section headings found on this page>"]
    }
  ],
  "fullText": "<Complete extracted text if pages are not applicable>"
}

EXTRACTION RULES:
1. Identify Document Title: Extract the main title if present.
2. Identify All Sections: Extract all major sections with their headings.
3. **TABLE PARSING CRITICAL**: If the document contains tables:
   - Each ROW is a separate entry
   - Each COLUMN/CELL contains distinct content
   - Extract the text from EACH CELL separately
   - Do NOT read across multiple columns or combine text from adjacent cells
4. Extract Content VERBATIM: Copy text exactly as it appears. Do NOT summarize or paraphrase.
5. Keep Items Separate: Each section/row/cell should contain ONLY its own content.
6. Preserve Original Wording: Maintain exact phrasing, punctuation, and formatting.
7. **VERIFY COMPLETENESS**: Count sections and table rows. Ensure all content is captured.

CRITICAL REQUIREMENTS:
- The structure MUST preserve the document''s organization.
- Each content field MUST be copied VERBATIM from the source.
- Do NOT combine, merge, or concatenate content from different sections/cells.
- Do NOT summarize, shorten, or paraphrase any text.
- Return ONLY valid JSON, no markdown formatting or explanation.',
    temperature = 0.1,
    max_tokens = 65536,
    updated_at = NOW()
WHERE function_name = 'extraction';
