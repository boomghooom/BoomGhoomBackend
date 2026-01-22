// Mention Parser Utility
export class MentionParser {
  private static readonly MENTION_REGEX = /@(\w+)/g;

  static parse(content: string): string[] {
    const mentions: string[] = [];
    const matches = content.matchAll(this.MENTION_REGEX);
    
    for (const match of matches) {
      if (match[1]) {
        mentions.push(match[1]);
      }
    }
    
    return [...new Set(mentions)]; // Remove duplicates
  }

  static extractUserIds(content: string, userMap: Map<string, string>): string[] {
    const usernames = this.parse(content);
    const userIds: string[] = [];
    
    for (const username of usernames) {
      const userId = userMap.get(username);
      if (userId) {
        userIds.push(userId);
      }
    }
    
    return userIds;
  }

  static replaceMentions(content: string, replacer: (username: string) => string): string {
    return content.replace(this.MENTION_REGEX, (match, username) => {
      return replacer(username);
    });
  }
}
