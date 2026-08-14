import { Page } from '@playwright/test';

/**
 * Base class for all page objects. Page objects expose methods and locators
 * only — assertions belong in the spec.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /**
   * Navigates to a path relative to the `ui` project's baseURL (from .env).
   * Never pass an absolute URL here.
   */
  protected async navigate(relativePath: string): Promise<void> {
    await this.page.goto(relativePath);
  }
}
