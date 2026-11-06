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
  await expect(
    page.getByRole("button", { name: "Minha VPN não conecta", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".suggestions")).toHaveCount(0);
  const originalTeamUrl = page.url();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Seções das configurações" })
    .getByRole("button", { name: "Equipes", exact: true })
    .click();
  const teamForm = page.locator(".settings-section").filter({
    has: page.getByRole("heading", { name: "Criar equipe", exact: true }),
  });
  await teamForm.getByLabel("Nome", { exact: true }).fill("Operações");
  await teamForm
    .getByLabel("Descrição", { exact: true })
    .fill("Procedimentos de operações");
  await teamForm
    .getByRole("button", { name: "Criar equipe", exact: true })
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
    name: "invalid.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("invalid"),
  });
  await page
    .getByRole("button", { name: "Enviar para a base", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "PDF",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
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
  await page.getByLabel("Sua pergunta").fill("VPN simular indisponibilidade");
  await page
    .getByRole("button", { name: "Buscar orientação", exact: true })
    .click();
  await expect(page.locator(".notice.error")).toContainText(
    "Não foi possível consultar o Toqan",
  );
  await expect(
    page.getByRole("button", { name: "Buscar orientação", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Sua pergunta")).toHaveValue(
    "VPN simular indisponibilidade",
  );
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
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Continuar conversa")).toBeEnabled();
  await page
    .getByLabel("Continuar conversa")
    .fill("A internet funciona, mas a VPN ainda não resolveu.");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(page.getByLabel("Continuar conversa")).toHaveValue("");
  await expect(
    page.getByRole("status").filter({ hasText: "Consultando os documentos" }),
  ).toBeVisible();
  await expect(
    page.getByText("A internet funciona, mas a VPN ainda não resolveu.", {
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page.getByText("Resultado informado: respondida pelo chat", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("A internet funciona, mas a VPN ainda não resolveu.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Funcionou", exact: true }).click();
  await expect(
    page.getByText("Resultado informado: funcionou", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Minhas conversas", exact: true })
    .first()
    .click();
  await page.locator(".conversation-list-item").filter({ hasText: "Minha VPN não conecta" }).click();
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
  await page.getByLabel("Status", { exact: true }).selectOption("resolved");
  await expect(page.getByRole("status")).toContainText(
    "A equipe propôs uma solução",
  );
  await page
    .getByRole("button", {
      name: "Confirmar resolução e encerrar",
      exact: true,
    })
    .click();
  await expect(
    page.locator(".request-title").getByText("Encerrada", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Base de conhecimento", exact: true })
    .click();
  const fileUrl = await page
    .getByRole("link", { name: "Baixar Guia VPN.txt", exact: true })
    .getAttribute("href");
  const file = await page.request.get(fileUrl!);
  expect(file.status()).toBe(200);
  expect(await file.text()).toContain("Antes de acessar a VPN");
  await page
    .getByRole("button", { name: "Excluir Guia VPN.txt", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar exclusão", exact: true })
    .click();
  await expect(page.getByText("Guia VPN.txt", { exact: true })).toHaveCount(0);
  expect((await page.request.get(fileUrl!)).status()).toBe(404);
  await request.post("http://127.0.0.1:5545/process");
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill("pilot@example.test");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("local-test-password-123");
  await page
    .getByRole("button", { name: "Entrar no meu espaço", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "O que você precisa resolver hoje?" }),
  ).toBeVisible();
  await request.post("http://127.0.0.1:5545/seed-conversations", {
    data: { teamId: new URL(originalTeamUrl).pathname.split("/").at(-1) },
  });
  await page.goto(originalTeamUrl);
  await page
    .getByRole("button", { name: "Minhas conversas", exact: true })
    .click();
  await expect(page.locator(".conversation-list-row")).toHaveCount(10);
  await expect(
    page.getByRole("navigation", { name: "Paginação das conversas" }),
  ).toContainText("31 conversas");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Próxima", exact: true }).click();
    await expect(
      page.getByRole("navigation", { name: "Paginação das conversas" }),
    ).toContainText(`Página ${i + 2} de 4`);
  }
  await expect(page.locator(".conversation-list-row")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Excluir conversa: Histórico 30",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Excluir conversa definitivamente",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Paginação das conversas" }),
  ).toContainText("Página 3 de 3");
  await expect(page.locator(".conversation-list-row")).toHaveCount(10);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.getByLabel("Trocar espaço ou equipe").click();
  await page
    .getByRole("navigation", { name: "Espaços e equipes" })
    .getByRole("link", { name: "Equipe de teste Operações" })
    .click();
  await expect(page.locator(".breadcrumb")).toContainText("Operações");
  await expect(page.locator(".suggestions")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("invitations, member permissions, role changes and revoked downloads", async ({
  page,
  browser,
}) => {
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  try {
    for (const [target, email, name] of [
      [page, "owner-roles@example.test", "Gestora Teste"],
    ] as const) {
      await target.goto("http://localhost:3100/login");
      await target
        .getByRole("button", { name: "Criar conta", exact: true })
        .click();
      await target.getByLabel("Seu nome").fill(name);
      await target.getByLabel("Email", { exact: true }).fill(email);
      await target
        .getByLabel("Senha", { exact: true })
        .fill("roles-test-password-123");
      await target
        .getByRole("button", { name: "Criar conta", exact: true })
        .click();
      await expect(
        target.getByRole("heading", {
          name: "Um espaço para o que sua equipe sabe.",
        }),
      ).toBeVisible();
    }
    await page.getByLabel("Nome da organização").fill("Equipe de permissões");
    await page
      .getByRole("button", { name: "Criar organização", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "O que você precisa resolver hoje?" }),
    ).toBeVisible();
    const teamUrl = page.url();
    await page
      .getByRole("button", { name: "Base de conhecimento", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Adicionar documento", exact: true })
      .click();
    await page.locator("input[type=file]").setInputFiles({
      name: "Permissões.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Documento fictício restrito aos membros da equipe."),
    });
    await page
      .getByRole("button", { name: "Enviar para a base", exact: true })
      .click();
    const download = page.getByRole("link", {
      name: "Baixar Permissões.txt",
      exact: true,
    });
    await expect(download).toBeVisible();
    const downloadUrl = new URL((await download.getAttribute("href"))!, teamUrl)
      .href;
    await page
      .getByRole("button", { name: "Configurações", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Convidar pessoa", exact: true })
      .click();
    await page
      .getByLabel("Email", { exact: true })
      .fill("member-roles@example.test");
    await page.getByLabel(/^Papel/).selectOption("member");
    await page
      .getByRole("button", { name: "Gerar convite", exact: true })
      .click();
    const invite = page.getByLabel("Link de convite · válido por 7 dias");
    await expect(invite).toBeVisible();
    const inviteUrl = await invite.inputValue();
    expect((await member.request.get(downloadUrl)).status()).toBe(401);
    await member.goto(inviteUrl);
    await expect(
      member.getByRole("button", {
        name: "Entrar para aceitar convite",
        exact: true,
      }),
    ).toBeVisible();
    await member
      .getByRole("button", { name: "Entrar para aceitar convite", exact: true })
      .click();
    await expect(member).toHaveURL(/\/login\?invite=/);
    await member
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await member.getByLabel("Seu nome").fill("Membro Teste");
    await member
      .getByLabel("Email", { exact: true })
      .fill("member-roles@example.test");
    await member
      .getByLabel("Senha", { exact: true })
      .fill("roles-test-password-123");
    await member
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await expect(member).toHaveURL(inviteUrl);
    await member
      .getByRole("button", { name: "Aceitar convite", exact: true })
      .click();
    await expect(member).toHaveURL(teamUrl);
    await member
      .getByRole("button", { name: "Base de conhecimento", exact: true })
      .click();
    await expect(
      member.getByRole("button", { name: "Adicionar documento", exact: true }),
    ).toHaveCount(0);
    expect((await member.request.get(downloadUrl)).status()).toBe(200);
    await member.goto(inviteUrl);
    await member
      .getByRole("button", { name: "Aceitar convite", exact: true })
      .click();
    await expect(
      member
        .getByRole("alert")
        .filter({ hasText: "Convite inválido, expirado ou já utilizado." }),
    ).toBeVisible();
    await memberContext.clearCookies();
    await member.goto(inviteUrl);
    await member
      .getByRole("link", { name: "Entrar ou criar minha conta", exact: true })
      .click();
    await member
      .getByLabel("Email", { exact: true })
      .fill("member-roles@example.test");
    await member
      .getByLabel("Senha", { exact: true })
      .fill("roles-test-password-123");
    await member
      .getByRole("button", { name: "Entrar no meu espaço", exact: true })
      .click();
    await expect(member).toHaveURL(inviteUrl);
    await member
      .getByRole("button", { name: "Aceitar convite", exact: true })
      .click();
    await expect(member.locator(".error-text[role=alert]")).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: "Configurações", exact: true })
      .click();
    const memberRow = page
      .locator(".member-row")
      .filter({ hasText: "member-roles@example.test" });
    const rowBefore = await memberRow.boundingBox();
    await memberRow.getByLabel("Gerenciar Membro Teste").click();
    const rowAfter = await memberRow.boundingBox();
    expect(rowAfter!.height).toBeCloseTo(rowBefore!.height, 0);
    const menuBox = await memberRow.locator(".member-menu-items").boundingBox();
    const triggerBox = await memberRow
      .getByLabel("Gerenciar Membro Teste")
      .boundingBox();
    expect(menuBox!.y).toBeGreaterThanOrEqual(
      triggerBox!.y + triggerBox!.height,
    );
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(
      rowAfter!.x + rowAfter!.width + 1,
    );

    await memberRow
      .getByRole("button", { name: "Tornar gestor", exact: true })
      .click();
    await expect(memberRow.getByText("Gestor", { exact: true })).toBeVisible();
    await member.goto(teamUrl);
    await member
      .getByRole("button", { name: "Base de conhecimento", exact: true })
      .click();
    await expect(
      member.getByRole("button", { name: "Adicionar documento", exact: true }),
    ).toBeVisible();
    await memberRow
      .getByRole("button", { name: "Tornar membro", exact: true })
      .click();
    await expect(memberRow.getByText("Membro", { exact: true })).toBeVisible();
    await memberRow
      .getByRole("button", { name: "Remover da equipe", exact: true })
      .click();
    await expect(memberRow).toHaveCount(0);
    expect((await member.request.get(downloadUrl)).status()).toBe(403);
  } finally {
    await memberContext.close();
  }
});

test("received invitations remain available after a direct signup and creating a separate workspace", async ({
  page,
  browser,
}) => {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": "192.0.2.31" });
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": "192.0.2.32" },
  });
  const member = await context.newPage();
  try {
    await page.goto("/login");
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await page.getByLabel("Seu nome").fill("Gestora Convites");
    await page
      .getByLabel("Email", { exact: true })
      .fill("owner-pending@example.test");
    await page
      .getByLabel("Senha", { exact: true })
      .fill("pending-test-password-123");
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await page.getByLabel("Nome da organização").fill("Equipe existente");
    await page
      .getByRole("button", { name: "Criar organização", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "O que você precisa resolver hoje?" }),
    ).toBeVisible();
    const invitedTeam = page.url();
    await page
      .getByRole("button", { name: "Configurações", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Convidar pessoa", exact: true })
      .click();
    await page
      .getByLabel("Email", { exact: true })
      .fill("pending-member@example.test");
    await page
      .getByRole("button", { name: "Gerar convite", exact: true })
      .click();
    await expect(
      page.getByLabel("Link de convite · válido por 7 dias"),
    ).toBeVisible();
    // The recipient signs up directly, without carrying an invite token in the URL.
    await member.goto("http://localhost:3100/login");
    await member
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await member.getByLabel("Seu nome").fill("Pessoa Convidada");
    await member
      .getByLabel("Email", { exact: true })
      .fill("pending-member@example.test");
    await member
      .getByLabel("Senha", { exact: true })
      .fill("pending-test-password-123");
    await member
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await expect(
      member.getByRole("region", { name: "Convites recebidos" }),
    ).toContainText("Equipe existente");
    await expect(
      member.getByRole("button", { name: "Entrar na equipe", exact: true }),
    ).toBeVisible();
    // A previously created organization must not prevent accepting the existing invitation.
    await member.getByLabel("Nome da organização").fill("Espaço separado");
    await member
      .getByRole("button", { name: "Criar organização", exact: true })
      .click();
    await expect(
      member.getByRole("region", { name: "Convites recebidos" }),
    ).toContainText("Equipe existente");
    await expect(
      member.getByRole("button", {
        name: "Minha VPN não conecta",
        exact: true,
      }),
    ).toHaveCount(0);
    await member
      .getByRole("button", { name: "Entrar na equipe", exact: true })
      .click();
    await expect(member).toHaveURL(invitedTeam);
    await member.getByLabel("Trocar espaço ou equipe").click();
    await member
      .getByRole("navigation", { name: "Espaços e equipes" })
      .getByRole("link", { name: "Espaço separado Geral" })
      .click();
    await expect(member.locator(".breadcrumb")).toContainText(
      "Espaço separado",
    );
    await member.getByLabel("Trocar espaço ou equipe").click();
    await member
      .getByRole("navigation", { name: "Espaços e equipes" })
      .getByRole("link", { name: "Equipe existente Geral" })
      .click();
    await expect(member).toHaveURL(invitedTeam);
    await expect(member.locator(".breadcrumb")).toContainText(
      "Equipe existente",
    );
    await expect(
      member.getByRole("region", { name: "Convites recebidos" }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});
