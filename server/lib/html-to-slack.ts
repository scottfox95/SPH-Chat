/**
 * Formats HTML content to Slack-compatible markdown
 * @param html HTML content
 * @returns Slack-compatible markdown
 */
export function formatHtmlForSlack(html: string): string {
  // Maximum character limit for Slack messages (to avoid hitting the limit)
  const MAX_CHAR_LIMIT = 3000;
  
  let formatted = html
    // Replace headers with bold text
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '*$1*\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '*$1*\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '*$1*\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '*$1*\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '*$1*\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '*$1*\n')
    
    // Replace paragraph tags
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    
    // Replace list items
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
    
    // Remove unordered list containers
    .replace(/<\/?ul[^>]*>/gi, '')
    
    // Remove ordered list containers
    .replace(/<\/?ol[^>]*>/gi, '')
    
    // Replace bold tags
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '*$1*')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '*$1*')
    
    // Replace italic tags
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '_$1_')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '_$1_')
    
    // Replace line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    
    // Replace divs with new lines
    .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
    
    // Replace horizontal rules
    .replace(/<hr[^>]*>/gi, '---\n')
    
    // Remove all other HTML tags
    .replace(/<[^>]*>/g, '')
    
    // Replace non-breaking spaces with regular spaces
    .replace(/&nbsp;/g, ' ')
    
    // Replace ampersands
    .replace(/&amp;/g, '&')
    
    // Replace quotes
    .replace(/&quot;/g, '"')
    
    // Replace other common HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    
    // Fix multiple consecutive new lines (no more than 2)
    .replace(/\n{3,}/g, '\n\n')
    
    // Trim whitespace
    .trim();
  
  // Truncate if over character limit
  if (formatted.length > MAX_CHAR_LIMIT) {
    formatted = formatted.substring(0, MAX_CHAR_LIMIT - 100) + 
      '\n\n... _Summary truncated due to length. View complete summary on the web interface._';
  }
  
  return formatted;
}