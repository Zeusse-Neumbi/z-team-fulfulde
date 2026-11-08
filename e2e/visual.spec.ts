import { expect, test } from "@playwright/test";
import { launchExtension, openMock, openPanel, startOnPanel } from "./extension";

async function layoutProblems(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const clipped = Array.from(
      document.querySelectorAll("h1,h2,h3,p,dd,dt,button,label,span"),
    )
      .filter((element) => {
        const style = getComputedStyle(element);
        const hidden =
          style.overflow === "hidden" ||
          style.overflow === "clip" ||
          style.overflowX === "hidden" ||
          style.overflowX === "clip" ||
          style.overflowY === "hidden" ||
          style.overflowY === "clip";
        return (
          hidden &&
          (element.scrollWidth > element.clientWidth + 2 ||
            element.scrollHeight > element.clientHeight + 2)
        );
      })
      .map((element) => ({
        tag: element.tagName,
        text: (element.textContent ?? "").trim().slice(0, 50),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }));
    return { overflow, clipped };
  });
}

test("the journey does not overflow or clip at mobile and desktop widths", async () => {
  const { context, extensionId } = await launchExtension();

  try {
    const page = await openMock(context);
    const panel = await openPanel(context, extensionId);
    await startOnPanel(panel);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    let result = await layoutProblems(page);
    expect(result.overflow, JSON.stringify(result)).toBeLessThanOrEqual(2);
    expect(result.clipped, JSON.stringify(result)).toEqual([]);

    await page.locator("#to-fees").click();
    await page.waitForTimeout(400);
    result = await layoutProblems(page);
    expect(result.overflow, JSON.stringify(result)).toBeLessThanOrEqual(2);
    expect(result.clipped, JSON.stringify(result)).toEqual([]);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);
    result = await layoutProblems(page);
    expect(result.overflow, JSON.stringify(result)).toBeLessThanOrEqual(2);
    expect(result.clipped, JSON.stringify(result)).toEqual([]);
  } finally {
    await context.close();
  }
});
