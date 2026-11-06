import { test, expect } from "@playwright/test";
test("real authenticated path: organization, upload, source, guidance and request", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Seu nome").fill("Pessoa de Teste");
  await page.getByLabel("Email", { exact: true }).fill("pilot@example.test");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("local-test-password-123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Um espaço para o que sua equipe sabe.",
    }),
  ).toBeVisible();
  await page.getByLabel("Nome da organização").fill("Equipe de teste");
  await page
    .getByRole("button", { name: "Criar organização", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "O que você precisa resolver hoje?" }),
  ).toBeVisible();
  const originalTeamUrl = page.url();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  const teamForm = page
    .locator(".settings-section")
    .filter({
      has: page.getByRole("heading", { name: "Criar equipe", exact: true }),
    });
  await teamForm.getByLabel("Nome", { exact: true }).fill("Operações");
  await teamForm
    .getByLabel("Descrição", { exact: true })
    .fill("Procedimentos de operações");
  await teamForm
    .getByRole("button", { name: "Criar espaço", exact: false })
    .click();
  await expect(page.locator(".breadcrumb")).toContainText("Operações");
  await page.getByRole("button", { name: "G Geral", exact: true }).click();
  await expect(page).toHaveURL(originalTeamUrl);
  await expect(page.locator(".breadcrumb")).toContainText("Geral");
  await page
    .getByRole("button", { name: "Base de conhecimento", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Adicionar documento", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "Guia VPN.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Antes de acessar a VPN, verifique a conexão com a internet abrindo uma página no navegador. Se falhar, anote a mensagem de erro e abra uma solicitação para a equipe.",
    ),
  });
  await page
    .getByRole("button", { name: "Enviar para a base", exact: true })
    .click();
  await expect(page.getByText("Guia VPN.txt", { exact: true })).toBeVisible();
  await request.post("http://127.0.0.1:5545/process");
  try {
    await expect(async () => {
      await page
        .getByRole("button", { name: "Atualizar status", exact: true })
        .click();
      await expect(page.getByText("Disponível", { exact: true })).toBeVisible();
    }).toPass({ timeout: 45000 });
  } catch (e) {
    console.log(
      await (await request.get("http://127.0.0.1:5545/diagnostics")).text(),
    );
    throw e;
  }
  await page.getByRole("button", { name: "Início", exact: true }).click();
  await page
    .getByLabel("Sua pergunta")
    .fill("Minha VPN não conecta. Como resolver?");
  await page
    .getByRole("button", { name: "Buscar orientação", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Verifique a conexão com a internet",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ver fonte: Guia VPN.txt", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Parágrafo 1");
  await page.getByRole("button", { name: "Fechar fonte", exact: true }).click();
  await page.getByRole("button", { name: "Funcionou", exact: true }).click();
  await expect(
    page.getByText("Resultado informado: funcionou", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Minhas conversas", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: /Minha VPN não conecta/ }).click();
  await expect(
    page.getByText("Resultado informado: funcionou", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preparar solicitação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar e criar solicitação", exact: true })
    .click();
  await expect(
    page.getByText(
      "Solicitação registrada. Acompanhe o atendimento nesta equipe.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: /Minha VPN não conecta/ }).click();
  await expect(
    page.getByText("Etapa: Verifique a conexão com a internet", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Responsável", { exact: true })
    .selectOption({ label: "Pessoa de Teste" });
  await page
    .getByLabel("Adicionar comentário")
    .fill("Confirmamos a resolução com a pessoa solicitante.");
  await page
    .getByRole("button", { name: "Enviar comentário", exact: true })
    .click();
  await expect(
    page.getByText("Confirmamos a resolução com a pessoa solicitante.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("closed");
  await expect(
    page.locator(".request-title").getByText("Encerrada", { exact: true }),
  ).toBeVisible();
});
