import { test, expect } from "@playwright/test";
test("explores a clearly labelled portfolio demonstration", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "O que você precisa resolver hoje?" }),
  ).toBeVisible();
  await expect(
    page.getByText("Ambiente demonstrativo", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/demo-${test.info().project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Minha VPN não conecta" }).click();
  await expect(
    page.getByRole("heading", { name: "VPN não conecta", exact: true }),
  ).toBeVisible();
  if (test.info().project.name === "desktop")
    await page.screenshot({
      path: "docs/screenshots/orientacao-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
  await page
    .getByRole("button", { name: "Ver fonte: Guia de acesso remoto" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Conteúdo fictício");
  await page.getByRole("button", { name: "Fechar fonte" }).click();
  await page.getByRole("button", { name: "Não resolveu", exact: true }).click();
  await expect(page.getByText("Confira a mensagem de erro")).toBeVisible();
  await page.getByRole("button", { name: "Preparar solicitação" }).click();
  await page
    .getByLabel("Resumo para a equipe")
    .fill("Exemplo: minha VPN não conecta após verificar a rede.");
  await page
    .getByRole("button", { name: "Confirmar solicitação de exemplo" })
    .click();
  await expect(
    page.getByText("Solicitação de exemplo registrada"),
  ).toBeVisible();
});
test("real app requires authentication and demo cannot process arbitrary questions", async ({
  page,
}) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/demo");
  await page
    .getByPlaceholder("Descreva sua dúvida ou o que precisa resolver...")
    .fill("Como construir uma aeronave?");
  await page.getByRole("button", { name: "Buscar orientação" }).click();
  await expect(
    page.getByText(
      "A demonstração usa exemplos preparados. Entre na aplicação para consultar seus documentos.",
    ),
  ).toBeVisible();
});

test("demo keeps requests and conversations scoped to the selected team", async ({
  page,
  isMobile,
}) => {
  await page.goto("/demo");
  if (isMobile)
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page
    .getByRole("button", { name: "P Pessoas & Cultura", exact: true })
    .click();
  if (isMobile)
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.getByRole("button", { name: "Solicitações", exact: true }).click();
  await expect(
    page.getByText("Tudo em dia por aqui", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Acesso à pasta compartilhada", { exact: true }),
  ).toHaveCount(0);
});

test("polished navigation preserves keyboard access and reduced motion", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo");
  await expect(page.locator(".view-surface")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "O que você precisa resolver hoje?" }),
  ).toBeVisible();
  if (!isMobile) await expect(page.locator(".knowledge-scene")).toBeVisible();
  expect(
    await page
      .locator(".view-surface")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.getByLabel("Sua pergunta", { exact: true }).focus();
  await page.keyboard.type("Minha VPN não conecta");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Buscar orientação", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText(
    "A demonstração usa exemplos preparados",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (!isMobile) {
    await page.setViewportSize({ width: 1280, height: 640 });
    await page.locator(".user-row").scrollIntoViewIfNeeded();
    await expect(page.locator(".user-row")).toBeInViewport();
  }
});
