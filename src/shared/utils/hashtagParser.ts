// Hashtag Parser Utility
export class HashtagParser {
  private static readonly HASHTAG_REGEX = /#(\w+)/g;

  static parse(content: string): string[] {
    const hashtags: string[] = [];
    const matches = content.matchAll(this.HASHTAG_REGEX);
    
    for (const match of matches) {
      if (match[1]) {
        // Normalize to lowercase
        hashtags.push(match[1].toLowerCase());
      }
    }
    
    return [...new Set(hashtags)]; // Remove duplicates
  }

  static replaceHashtags(content: string, replacer: (hashtag: string) => string): string {
    return content.replace(this.HASHTAG_REGEX, (match, hashtag) => {
      return replacer(hashtag);
    });
  }

  static extractWithPositions(content: string): Array<{ hashtag: string; start: number; end: number }> {
    const results: Array<{ hashtag: string; start: number; end: number }> = [];
    const matches = content.matchAll(this.HASHTAG_REGEX);
    
    for (const match of matches) {
      if (match[1] && match.index !== undefined) {
        results.push({
          hashtag: match[1].toLowerCase(),
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
    
    return results;
  }
}
