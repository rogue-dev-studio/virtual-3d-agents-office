import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS = path.join("docs", "qa", "screens");

function ensureShots() {
  fs.mkdirSync(SHOTS, { recursive: true });
}

async function waitForReady(page, query = "?quality=low") {
  await page.goto(`/${query}`);
  await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 60_000 });
}

test.describe("office smoke", () => {
  test.beforeAll(ensureShots);

  test("boots, renders 3D and reports live state", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await waitForReady(page);

    const canvas = page.locator("#scene");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box.width).toBeGreaterThan(200);
    expect(box.height).toBeGreaterThan(200);

    const ready = await page.evaluate(() => {
      const office = window.__office;
      if (!office) return null;
      return {
        agents: office.agents.length,
        rooms: office.world.rooms.length,
        drawCalls: office.renderer.info.render.calls,
        triangles: office.renderer.info.render.triangles,
      };
    });
    expect(ready).not.toBeNull();
    expect(ready.agents).toBe(9);
    expect(ready.drawCalls).toBeGreaterThan(0);
    expect(ready.triangles).toBeGreaterThan(1000);

    await expect(page.locator("#stats .stat").first()).toBeVisible();
    await expect(page.locator("#roster .agent-row")).toHaveCount(9);

    const errors2 = errors.filter((text) => !/favicon|ResizeObserver/.test(text));
    expect(errors2).toEqual([]);
  });

  test("agents move during a shift", async ({ page }) => {
    await waitForReady(page);
    const result = await page.evaluate(() => {
      const office = window.__office;
      const start = office.agents.map((agent) => [agent.position.x, agent.position.y, agent.floor]);
      // Drive simulated time directly so the check does not depend on headless frame rate.
      for (let i = 0; i < 400; i += 1) {
        office.simulation.update(0.1);
        for (const agent of office.agents) agent.update(0.1);
      }
      const end = office.agents.map((agent) => [agent.position.x, agent.position.y, agent.floor]);
      return {
        moved: start.filter((entry, index) => {
          const other = end[index];
          return Math.hypot(entry[0] - other[0], entry[1] - other[1]) > 0.5 || entry[2] !== other[2];
        }).length,
        finite: office.agents.every((agent) => Number.isFinite(agent.position.x) && Number.isFinite(agent.position.y)),
        summary: office.simulation.summary(),
      };
    });
    expect(result.moved).toBeGreaterThan(0);
    expect(result.finite).toBe(true);
    expect(result.summary).toBeTruthy();
  });

  test("dashboard, detail, credits and help are usable", async ({ page }) => {
    await waitForReady(page);

    await page.locator("#roster .agent-row").first().click();
    await expect(page.locator("#detail")).not.toHaveClass(/hidden/);
    await expect(page.locator("#detail-body h3")).toBeVisible();
    await page.locator("#detail-close").click();
    await expect(page.locator("#detail")).toHaveClass(/hidden/);

    await page.locator("#btn-credits").click();
    await expect(page.locator("#credits")).not.toHaveClass(/hidden/);
    await expect(page.locator("#credits-body .credit-group")).toHaveCount(3);
    await page.locator("#credits-close").click();
    await expect(page.locator("#credits")).toHaveClass(/hidden/);

    await page.locator("#btn-help").click();
    await expect(page.locator("#help")).not.toHaveClass(/hidden/);
    await expect(page.locator("#help-body .help-grid")).toBeVisible();
    await page.locator("#help-close").click();

    await page.locator('[data-floor="L1"]').click();
    await expect(page.locator('[data-floor="L1"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("surfaces a missing asset instead of breaking", async ({ page }) => {
    await page.route("**/assets/furniture/desk.glb", (route) => route.abort());
    await page.goto("/?quality=low");
    await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 60_000 });
    await expect(page.locator("#asset-issues")).not.toHaveClass(/hidden/);
    await expect(page.locator("#asset-issues")).toContainText(/desk/i);
    const alive = await page.evaluate(() => Boolean(window.__office));
    expect(alive).toBe(true);
  });

  test("captures reference screenshots", async ({ page }, testInfo) => {
    await waitForReady(page);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SHOTS, `${testInfo.project.name}-overview.png`) });

    await page.locator('[data-floor="L1"]').click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SHOTS, `${testInfo.project.name}-floor1.png`) });

    await page.locator('[data-floor="L2"]').click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SHOTS, `${testInfo.project.name}-floor2.png`) });

    await page.locator('[data-floor="all"]').click();
    await page.locator("#btn-credits").click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, `${testInfo.project.name}-credits.png`) });
  });
});
