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
  });
  await page.getByRole("button", { name: "Minha VPN não conecta" }).click();
  await expect(
    page.getByRole("heading", { name: "VPN não conecta", exact: true }),
  ).toBeVisible();
  if (test.info().project.name === "desktop")
    await page.screenshot({
      path: "docs/screenshots/orientacao-desktop.png",
      fullPage: true,
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
