/**
 * Utility to convert HTML-formatted summaries to Slack-friendly formatting
 */

/**
 * Converts HTML formatted text to Slack-friendly markdown-like format
 * Removes HTML tags and converts basic formatting
 * 
 * @param html HTML formatted string
 * @returns String formatted for Slack
 */
export function convertHtmlToSlackFormat(html: string): string {
  if (!html) return '';
  
  // Check if the content is already plain text (no HTML tags)
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    // Clean up any HTML entities that might be present
    return html
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  
  // Create a cleaner version with line breaks preserved
  let slackText = html;
  
  // Replace basic HTML tags with appropriate Slack formatting
  slackText = slackText
    // Strip complete HTML structure
    .replace(/<html>[\s\S]*?<body>/gi, '')
    .replace(/<\/body>[\s\S]*?<\/html>/gi, '')
    .replace(/<head>[\s\S]*?<\/head>/gi, '')
    .replace(/<style>[\s\S]*?<\/style>/gi, '')
    
    // Handle headings - convert to bold with newlines
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '*$1*\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '*$1*\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '*$1*\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '*$1*\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '*$1*\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '*$1*\n')
    
    // Handle paragraphs - add newlines
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    
    // Handle lists - convert to dashes with proper formatting
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
    
    // Remove list containers (ul/ol) but keep a newline
    .replace(/<\/?ul[^>]*>/gi, '\n')
    .replace(/<\/?ol[^>]*>/gi, '\n')
    
    // Handle text formatting
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '*$1*')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '*$1*')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '_$1_')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '_$1_')
    
    // Handle line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    
    // Remove all other HTML tags
    .replace(/<[^>]*>/g, '')
    
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    
    // Fix repeated newlines (no more than 2)
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    
    // Trim extra whitespace
    .trim();
  
  // Ensure each list item is properly formatted with a bullet
  // Make sure items are on separate lines with proper indentation
  slackText = slackText
    // Make sure bullet points are properly formatted
    .replace(/^•\s*/gm, '• ')
    .replace(/([^\n])•\s*/g, '$1\n• ');
  
  return slackText;
}