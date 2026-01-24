import type { Context } from '@netlify/functions';
import { authenticateRequest, createErrorResponse, createSuccessResponse } from './lib/auth';

interface WebSearchInput {
  query: string;
  url?: string;
  max_results?: number;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface WebSearchResponse {
  query: string;
  url?: string;
  results: SearchResult[];
  raw_content?: string;
}

// Extract text content from HTML
function extractTextFromHtml(html: string): string {
  // Remove script and style tags with their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

// Extract title from HTML
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1]!.trim() : 'Untitled';
}

// Extract meta description from HTML
function extractDescription(html: string): string {
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (metaMatch) return metaMatch[1]!.trim();
  
  const ogMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) return ogMatch[1]!.trim();
  
  return '';
}

// Fetch and parse a URL
async function fetchUrl(url: string): Promise<{ title: string; content: string; description: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GenAIWidgets/1.0; +https://genaiwidgets.netlify.app)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const title = extractTitle(html);
  const description = extractDescription(html);
  const content = extractTextFromHtml(html);

  return { title, content, description };
}

// Use DuckDuckGo Instant Answer API for search (free, no API key required)
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GenAIWidgets/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo API error: ${response.status}`);
  }

  const data = await response.json() as {
    AbstractText?: string;
    AbstractURL?: string;
    AbstractSource?: string;
    RelatedTopics?: Array<{
      Text?: string;
      FirstURL?: string;
      Result?: string;
    }>;
  };

  const results: SearchResult[] = [];

  // Add abstract if available
  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.AbstractSource || 'Summary',
      url: data.AbstractURL,
      snippet: data.AbstractText,
    });
  }

  // Add related topics
  if (data.RelatedTopics) {
    for (const topic of data.RelatedTopics) {
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 50),
          url: topic.FirstURL,
          snippet: topic.Text,
        });
      }
    }
  }

  return results.slice(0, 10);
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405);
  }

  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    const authError = authResult as { success: false; error: string; status: number };
    return createErrorResponse(authError.error, authError.status);
  }

  try {
    const input = await req.json() as WebSearchInput;

    if (!input.query || typeof input.query !== 'string') {
      return createErrorResponse('Query is required', 400);
    }

    const response: WebSearchResponse = {
      query: input.query,
      url: input.url,
      results: [],
    };

    // If a specific URL is provided, fetch and extract content from it
    if (input.url) {
      try {
        const { title, content, description } = await fetchUrl(input.url);
        
        // Truncate content to avoid huge responses
        const maxContentLength = 8000;
        const truncatedContent = content.length > maxContentLength 
          ? content.substring(0, maxContentLength) + '...[truncated]'
          : content;

        response.results.push({
          title,
          url: input.url,
          snippet: description || truncatedContent.substring(0, 300),
        });
        response.raw_content = truncatedContent;

        console.log(`[tool-web-search] Fetched URL: ${input.url}, content length: ${content.length}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[tool-web-search] URL fetch error:`, error);
        return createErrorResponse(`Failed to fetch URL: ${errorMessage}`, 400);
      }
    } else {
      // Perform web search using DuckDuckGo
      try {
        const searchResults = await searchDuckDuckGo(input.query);
        response.results = searchResults;

        console.log(`[tool-web-search] Search query: "${input.query}", results: ${searchResults.length}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[tool-web-search] Search error:`, error);
        return createErrorResponse(`Search failed: ${errorMessage}`, 500);
      }
    }

    return createSuccessResponse(response);
  } catch (error) {
    console.error('[tool-web-search] Error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
