import { expect, test } from "@playwright/test";
import { launchExtension, openPanel } from "./extension";

test("the extension loads and the side panel renders", async () => {
  const { context, extensionId } = await launchExtension();

  try {
    const panel = await openPanel(context, extensionId);
    await expect(panel.getByRole("heading", { name: "Assistant Fulfulde" })).toBeVisible();
    await expect(panel.getByText("Rien — traitement local")).toBeVisible();
  } finally {
    await context.close();
  }
});
