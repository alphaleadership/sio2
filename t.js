const fs = require("fs").promises;
const path = require("path");
const { marked } = require("marked");
const yaml = require("js-yaml");
const { GoogleGenerativeAI } = require("@google/generative-ai");
async function getGeminiLeaksSummary(apiKey,content) {
  if (!apiKey) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt =
      "fait moi et résumée compatible pour un humain normal du contenu suivant :"+content;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error fetching Gemini leaks summary:", error);
    return null;
  }
}
class NewsletterComposer {
  constructor(options = {}) {
    this.templatesDir =
      options.templatesDir || path.join(__dirname, "../templates");
    this.newslettersDir =
      options.newslettersDir || path.join(process.cwd(), "../newsletters");
    this.archiveDir =
      options.archiveDir || path.join(process.cwd(), "../newsletters/archive");
    this.outputDir =
      options.outputDir || path.join(process.cwd(), "../newsletters/output");
  }
  /**    * Parse newsletter markdown file with frontmatter    */
  async parseNewsletterFile(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      // Check if file has frontmatter
      if (content.startsWith("---")) {
        const parts = content.split("---");
        if (parts.length >= 3) {
          const frontmatter = yaml.load(parts[1]);
          const markdownContent = parts.slice(2).join("---").trim();
          return {
            metadata: frontmatter,
            content: markdownContent,
            htmlContent: marked(markdownContent),
          };
        }
      }
      // No frontmatter, treat as pure markdown
      return {
        metadata: {},
        content: content,
        htmlContent: marked(content),
      };
    } catch (error) {
      throw new Error(
        `Failed to parse newsletter file ${filePath}: ${error.message}`
      );
    }
  }
  /**    * Load email template and substitute variables    */
  async loadTemplate(templateName, variables = {}) {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.html`);
      let template = await fs.readFile(templatePath, "utf-8");
      // Replace template variables
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, "g");
        template = template.replace(regex, value || "");
      }
      return template;
    } catch (error) {
      throw new Error(
        `Failed to load template ${templateName}: ${error.message}`
      );
    }
  }
  /**    * Compose newsletter from markdown file    */
  async composeNewsletter(newsletterFile, templateName = "newsletter") {
    try {
      const newsletter = await this.parseNewsletterFile(
        path.join(this.newslettersDir, newsletterFile)
      );
      // Prepare template variables
      const variables = {
        subject: newsletter.metadata.subject || "Newsletter",
        date: newsletter.metadata.date || new Date().toLocaleDateString(),
        content: newsletter.htmlContent,
        website_url: newsletter.metadata.website_url || "#",
        github_url: newsletter.metadata.github_url || "#",
        preferences_url: newsletter.metadata.preferences_url || "#",
        unsubscribe_url: newsletter.metadata.unsubscribe_url || "#",
        ...(newsletter.metadata.variables || {}),
      };
      const geminiSummary = await getGeminiLeaksSummary(
        process.env.GEMINI_API_KEY,variables.content
      );
      if (geminiSummary) {
        variables.gemini_leaks_summary = `<div class=\"gemini-leaks-summary\"><h3>Résumé des fuites Gemini</h3><p>${geminiSummary}</p></div>`;
        variables.content = variables.gemini_leaks_summary + variables.content;
      }
      const htmlContent = await this.loadTemplate(templateName, variables);
      return {
        subject: variables.subject,
        htmlContent,
        textContent: newsletter.content,
        metadata: newsletter.metadata,
        scheduledAt: newsletter.metadata.scheduled_at
          ? new Date(newsletter.metadata.scheduled_at)
          : null,
      };
    } catch (error) {
      throw new Error(`Failed to compose newsletter: ${error.message}`);
    }
  }
  /**    * Generate preview HTML file    */
  async generatePreview(newsletterFile, outputPath = null) {
    try {
      const composed = await this.composeNewsletter(newsletterFile);
      if (!outputPath) {
        const fileName = path.basename(newsletterFile, ".md");
        outputPath = path.join(this.outputDir, `${fileName}-preview.html`);
      } // Ensure output directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, composed.htmlContent);
      return {
        previewPath: outputPath,
        subject: composed.subject,
        scheduledAt: composed.scheduledAt,
      };
    } catch (error) {
      throw new Error(`Failed to generate preview: ${error.message}`);
    }
  } /**    * Archive newsletter after sending    */
  async archiveNewsletter(newsletterFile, sentAt = new Date()) {
    try {
      const fileName = path.basename(newsletterFile);
      const archiveFileName = `${
        sentAt.toISOString().split("T")[0]
      }-${fileName}`;
      const archivePath = path.join(this.archiveDir, archiveFileName);
      await fs.mkdir(this.archiveDir, { recursive: true });
      // Copy file to archive with timestamp
      const content = await fs.readFile(
        path.join(this.newslettersDir, newsletterFile),
        "utf-8"
      );
      const archivedContent = `--- archived_at: ${sentAt.toISOString()} original_file: ${fileName} ---  ${content}`;
      await fs.writeFile(archivePath, archivedContent);
      return archivePath;
    } catch (error) {
      throw new Error(`Failed to archive newsletter: ${error.message}`);
    }
  }
  /**    * List available newsletter files    */
  async listNewsletters() {
    try {
      const files = await fs.readdir(this.newslettersDir);
      const newsletters = [];
      for (const file of files) {
        if (file.endsWith(".md") && !file.startsWith(".")) {
          const filePath = path.join(this.newslettersDir, file);
          const stats = await fs.stat(filePath);
          try {
            const parsed = await this.parseNewsletterFile(filePath);
            newsletters.push({
              file,
              path: filePath,
              subject: parsed.metadata.subject || file.replace(".md", ""),
              date: parsed.metadata.date || stats.mtime.toLocaleDateString(),
              scheduledAt: parsed.metadata.scheduled_at
                ? new Date(parsed.metadata.scheduled_at)
                : null,
              status: parsed.metadata.status || "draft",
              modifiedAt: stats.mtime,
            });
          } catch (error) {
            // Skip files that can't be parsed             console.log(error)
            console.warn(`Skipping invalid newsletter file: ${file}`);
          }
        }
      }
      return newsletters.sort((a, b) => b.modifiedAt - a.modifiedAt);
    } catch (error) {
      throw new Error(`Failed to list newsletters: ${error.message}`);
    }
  }
  /**    * Create newsletter template    */ async createNewsletterTemplate(
    fileName,
    options = {}
  ) {
    try {
      const filePath = path.join(this.newslettersDir, `${fileName}.md`); // Check if file already exists
      try {
        await fs.access(filePath);
        throw new Error(`Newsletter file ${fileName}.md already exists`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const template = `--- subject: ${
        options.subject || "Newsletter Title"
      } date: ${
        options.date || new Date().toLocaleDateString()
      } status: draft scheduled_at: ${options.scheduledAt || ""} website_url: ${
        options.websiteUrl || "https://example.com"
      } github_url: ${
        options.githubUrl || "https://github.com/username"
      } preferences_url: ${
        options.preferencesUrl || "https://example.com/preferences"
      } unsubscribe_url: ${
        options.unsubscribeUrl || "https://example.com/unsubscribe"
      } variables:   author: ${options.author || "Newsletter Team"} ---  # ${
        options.subject || "Newsletter Title"
      }  Welcome to this edition of our newsletter!  ## 🚀 What's New  Add your content here...  ## 📚 Featured Articles  ### Article Title  Brief description of the article.  [Read more →](https://example.com/article)  ## 💡 Tips & Tricks  Share some useful tips with your subscribers.  ## 🔗 Interesting Links  - [Link 1](https://example.com) - [Link 2](https://example.com)  ---  Thanks for reading! Have feedback? Reply to this email. `;
      await fs.mkdir(this.newslettersDir, { recursive: true });
      await fs.writeFile(filePath, template);
      return filePath;
    } catch (error) {
      throw new Error(`Failed to create newsletter template: ${error.message}`);
    }
  }
}
module.exports = NewsletterComposer;
