import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const emailsDir = path.join(__dirname, "..", "emails");

const compiledCache = new Map();

export const renderTemplate = async (fileName, data = {}) => {
  if (!fileName) {
    throw new Error("Template fileName is required");
  }

  let compiledFn = compiledCache.get(fileName);

  if (!compiledFn) {
    const filePath = path.join(emailsDir, fileName);
    const rawHtml = await fs.readFile(filePath, "utf-8");
    compiledFn = Handlebars.compile(rawHtml);
    compiledCache.set(fileName, compiledFn);
  }

  return compiledFn(data);
};