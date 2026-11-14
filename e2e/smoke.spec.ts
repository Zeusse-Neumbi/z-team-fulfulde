import { expect, test } from "@playwright/test";
import { launchExtension, openPanel } from "./extension";

test("the extension loads and the side panel renders", async () => {
  const { context, extensionId } = await launchExtension();

  try {
    const panel = await openPanel(context, extensionId);
    await expect(panel.getByRole("heading", { name: "Z-Team Lingua" })).toBeVisible();
    await expect(panel.getByText("Rien — traitement local")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("the panel always states which Fulfulde pack the build carries", async () => {
  const { context, extensionId } = await launchExtension();

  try {
    const panel = await openPanel(context, extensionId);
    // The fixture build is the only build the harness ships, so it must say
    // TEST. The submission build carries `packSource: "mt"` and says MT.
    const source = panel.locator(".pack-source");
    await expect(source).toBeVisible();
    await expect(source).toContainText("TEST");
    await expect(source).toHaveAttribute("role", "status");
  } finally {
    await context.close();
  }
});
