export class PuppeteerUnavailableError extends Error {
  constructor() {
    super("Puppeteer is disabled for this application");
    this.name = "PuppeteerUnavailableError";
  }
}
