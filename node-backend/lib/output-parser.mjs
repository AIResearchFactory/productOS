import fs from 'node:fs/promises';
import path from 'node:path';

export class OutputParserService {
  static parseFileChanges(output) {
    const changes = [];
    const re = /^\s*(?:\*\*)?(?:FILE|UPDATE|MODIFY|CHANGE):\s*(.+?)(?:\*\*)?\s*$[\s\S]*?```[^\n]*\n([\s\S]*?)\n```/gim;
    
    let match;
    while ((match = re.exec(output)) !== null) {
      let rawPath = match[1].trim();
      const cleanPath = rawPath.replace(/^[*_`'" ]+|[*_`'" ]+$/g, '');
      const content = match[2];
      
      if (cleanPath) {
        changes.push({ path: cleanPath, content });
      }
    }
    return changes;
  }

  static parseArtifactChanges(output) {
    const changes = [];
    const re = /^\s*(?:\*\*)?ARTIFACT:\s*(.+?):\s*(.+?)(?:\*\*)?\s*$[\s\S]*?```[^\n]*\n([\s\S]*?)\n```/gim;
    
    let match;
    while ((match = re.exec(output)) !== null) {
      const artifactType = match[1].trim().toLowerCase();
      const title = match[2].trim();
      const content = match[3];
      
      if (artifactType && title) {
        changes.push({ artifactType, title, content });
      }
    }
    return changes;
  }

  static parseNotifications(output) {
    const notifications = [];
    
    // 1. NOTIFY: format
    const notifyRe = /^\s*NOTIFY:\s*(.*)$/gm;
    let match;
    while ((match = notifyRe.exec(output)) !== null) {
      const msg = match[1].trim();
      if (msg) notifications.push(msg);
    }

    // 2. XML format
    const xmlRe = /<send_(?:telegram|whatsapp)_message>\s*<message>(.*?)<\/message>\s*<\/send_(?:telegram|whatsapp)_message>/gs;
    while ((match = xmlRe.exec(output)) !== null) {
      const msg = match[1].trim();
      if (msg) notifications.push(msg);
    }

    return notifications;
  }

  static parseGenerationMetadata(output) {
    let cost = 0;
    let tokensIn = 0;
    let tokensOut = 0;
    let tokensCacheRead = 0;
    let tokensCacheWrite = 0;
    let tokensReasoning = 0;
    let found = false;

    const costMatch = /(?:cost|usage\s+cost|price):?\s*\$?\s*(\d+\.?\d*)/i.exec(output);
    if (costMatch) {
      cost = parseFloat(costMatch[1]);
      found = true;
    }

    const inTokenPatterns = [
      /(?:input|prompt|context)(?:_|\s+)?tokens:?\s*(\d+)/i,
      /tokens\s+in:?\s*(\d+)/i,
      /in\s+tokens:?\s*(\d+)/i,
      /tokens:?\s*(\d+)\s+in/i,
      /tokens:?\s*(\d+)/i,
    ];
    for (const re of inTokenPatterns) {
      const m = re.exec(output);
      if (m) {
        tokensIn = parseInt(m[1], 10);
        found = true;
        break;
      }
    }

    const outTokenPatterns = [
      /(?:output|completion|response)(?:_|\s+)?tokens:?\s*(\d+)/i,
      /tokens\s+out:?\s*(\d+)/i,
      /out\s+tokens:?\s*(\d+)/i,
      /tokens:?\s*(\d+)\s+out/i,
      /(\d+)\s+out/i,
    ];
    for (const re of outTokenPatterns) {
      const m = re.exec(output);
      if (m) {
        tokensOut = parseInt(m[1], 10);
        found = true;
        break;
      }
    }

    // Caching and reasoning omitted for brevity, but could be added similarly

    if (found) {
      return {
        confidence: 1.0,
        cost_usd: cost,
        model_used: 'cli-extracted',
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        tokens_cache_read: tokensCacheRead,
        tokens_cache_write: tokensCacheWrite,
        tokens_reasoning: tokensReasoning,
      };
    }
    return null;
  }

  static async applyChanges(projectPath, changes) {
    for (const change of changes) {
      let filePath = change.path;

      // Strip absolute paths — the AI should only write within the project directory.
      // If the AI returns an absolute path that starts with the project path, strip it.
      // Otherwise, treat it as relative (the intended behavior).
      if (path.isAbsolute(filePath)) {
        if (filePath.startsWith(projectPath)) {
          filePath = path.relative(projectPath, filePath);
        } else {
          // Safety: absolute path outside project — make it relative by taking basename only
          console.warn(`[OutputParser] Redirecting absolute path outside project: ${filePath}`);
          filePath = path.basename(filePath);
        }
      }

      const fullPath = path.resolve(projectPath, filePath);

      // Double-check we haven't escaped the project directory (path traversal guard)
      if (!fullPath.startsWith(path.resolve(projectPath))) {
        console.warn(`[OutputParser] Blocked path traversal attempt: ${change.path}`);
        continue;
      }

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, change.content, 'utf8');
    }
  }

  static async applyArtifactChanges(projectId, changes, artifactService) {
    for (const change of changes) {
      // In Node, we'll need an artifact service to handle this
      // For now, let's assume it's passed in
      if (artifactService && artifactService.createArtifact) {
        const artifact = await artifactService.createArtifact(projectId, change.artifactType, change.title);
        artifact.content = change.content;
        await artifactService.saveArtifact(artifact);
      }
    }
  }
}
