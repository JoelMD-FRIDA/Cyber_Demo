import Handlebars from "handlebars";
import fs from "fs";
import path from "path";

const templates = new Map<string, HandlebarsTemplateDelegate>();

const TEMPLATES_DIR = path.join(process.cwd(), "src", "templates");

function loadTemplatesFromDisk(): void {
  if (!fs.existsSync(TEMPLATES_DIR)) return;

  const files = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".html"));
  for (const file of files) {
    const name = path.basename(file, ".html");
    const source = fs.readFileSync(path.join(TEMPLATES_DIR, file), "utf-8");
    templates.set(name, Handlebars.compile(source));
  }
}

export function registerTemplate(name: string, source: string): void {
  templates.set(name, Handlebars.compile(source));
}

export function renderTemplate(name: string, variables: Record<string, unknown>): string {
  const template = templates.get(name);
  if (!template) {
    throw new Error(`Template "${name}" not found. Registered: ${[...templates.keys()].join(", ")}`);
  }
  return template(variables);
}

export function getRegisteredTemplates(): string[] {
  return [...templates.keys()];
}

loadTemplatesFromDisk();
