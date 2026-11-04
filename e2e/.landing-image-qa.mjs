import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const output = path.resolve('../docs/landing-image-review-2026-10-19');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto('http://127.0.0.1:3020/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1, name: 'Clean starts here.' })).toBeVisible();
    await expect(page.locator('#who-we-serve a')).toHaveCount(4);
    await expect(page.locator('#services article')).toHaveCount(5);
    const heroSources = [];
    for (const radio of await page.getByRole('radio').all()) {
      await radio.check();
      const hero = page.locator('img[alt^="Cleaning for "]');
      await hero.evaluate(image => image.decode());
      const source = await hero.getAttribute('src');
      expect(source).toContain('_next%2Fstatic%2Fmedia%2F');
      heroSources.push(source);
    }
    expect(new Set(heroSources).size).toBe(4);
    await page.getByRole('radio').first().check();
    await page.locator('img[alt^="Cleaning for "]').evaluate(image => image.decode());
    for (let y = 0; y < await page.evaluate(() => document.body.scrollHeight); y += 600) {
      await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
      await page.waitForTimeout(100);
    }
    await page.waitForFunction(() => [...document.querySelectorAll('main img')].every(image => image.complete && image.naturalWidth > 0));
    const slider = page.getByRole('slider', { name: 'Reveal the clean space' });
    await slider.focus();
    await slider.press('Home');
    await expect(slider).toHaveValue('0');
    await expect(slider).toHaveAttribute('aria-valuetext', '100% of the clean scene revealed');
    await slider.press('End');
    await expect(slider).toHaveValue('100');
    await slider.fill('52');
    const images = await page.locator('main img').evaluateAll(images => images.map(image => ({
      alt: image.alt,
      source: image.currentSrc,
      width: image.clientWidth,
      height: image.clientHeight,
      sizes: image.sizes,
      transform: getComputedStyle(image).transform,
      complete: image.complete && image.naturalWidth > 0,
    })));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    expect(errors).toEqual([]);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: path.join(output, `homepage-${width}.png`), fullPage: true });
    results.push({ width, deviceScaleFactor: 2, heroChoices: heroSources.length, overflow, errors, images });
    console.log(JSON.stringify({ width, images: images.length, heroChoices: heroSources.length, overflow, errors }));
    await context.close();
  }
  fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
