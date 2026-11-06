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
    path: test.info().outputPath("demo.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Minha VPN não conecta" }).click();
  await expect(
    page.getByRole("heading", { name: "VPN não conecta", exact: true }),
  ).toBeVisible();
  if (test.info().project.name === "desktop")
    await page.screenshot({
      path: test.info().outputPath("orientacao-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.getByRole("button", { name: "Início", exact: true }).click();
  await page
    .getByRole("region", { name: "Continuar de onde parou" })
    .getByRole("button", { name: /VPN não conecta/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "VPN não conecta", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ver fonte: Guia de acesso remoto" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Conteúdo fictício");
  await page.getByRole("button", { name: "Fechar fonte" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ver fonte: Guia de acesso remoto" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
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
  await expect(
    page.getByRole("button", { name: "P Pessoas & Cultura", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("button", { name: "T Tecnologia", exact: true }),
  ).not.toHaveAttribute("aria-current", "true");
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
  await expect(
    page.getByRole("region", { name: "Continuar de onde parou" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".view-surface")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  if (isMobile)
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.getByLabel("Trocar espaço ou equipe").click();
  await expect(
    page.getByRole("navigation", { name: "Espaços e equipes" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".organization-picker")
      .evaluate(
        (el) => getComputedStyle(el, "::details-content").transitionDuration,
      ),
  ).toBe("0s");
  await page.getByLabel("Trocar espaço ou equipe").click();
  await expect(page.locator(".organization-picker")).not.toHaveAttribute(
    "open",
    "",
  );
  if (isMobile)
    await page
      .getByRole("button", { name: "Fechar menu", exact: true })
      .click({ position: { x: 380, y: 20 } });
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

test("sidebar controls and saved color theme work on desktop and mobile", async ({
  page,
  isMobile,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Ativar modo escuro", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Ativar modo claro", exact: true }),
  ).toBeVisible();
  if (isMobile)
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  const sidebar = page.locator(".sidebar");
  expect(await sidebar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: test.info().outputPath("dark-theme.png"),
    animations: "disabled",
  });
  if (!isMobile) {
    await expect(
      page.getByRole("button", { name: "Mostrar menu lateral", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Recolher menu lateral", exact: true })
      .click();
    await expect(sidebar).toBeHidden();
    await page
      .getByRole("button", { name: "Mostrar menu lateral", exact: true })
      .click();
    await expect(sidebar).toBeVisible();
  } else {
    await page
      .getByRole("button", { name: "Recolher menu lateral", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Ativar modo claro", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("theme switching works with reduced motion and without View Transitions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Ativar modo escuro", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => {
    Object.defineProperty(document, "startViewTransition", {
      value: undefined,
      configurable: true,
    });
  });
  await page
    .getByRole("button", { name: "Ativar modo claro", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(() => localStorage.getItem("knowflow-theme")),
  ).toBe("light");
});

test("editorial login keeps sign-in and signup usable across screen sizes", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", {
      name: "O conhecimento da sua equipe, no mesmo lugar.",
    }),
  ).toBeVisible();
  await expect(page.locator(".knowledge-scene")).toHaveCount(0);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("editorial-login.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByLabel("Seu nome")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("settings separates people, teams and workspace with a scoped invitation dialog", async ({
  page,
  isMobile,
}) => {
  await page.goto("/demo");
  if (isMobile)
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  const sections = page.getByRole("navigation", {
    name: "Seções das configurações",
  });
  await expect(
    sections.getByRole("button", { name: "Pessoas e convites" }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("button", { name: "Convidar pessoa", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Convidar pessoa" }),
  ).toContainText("Tecnologia");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await sections.getByRole("button", { name: "Equipes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Equipes da organização" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Criar equipe", exact: true }),
  ).toBeVisible();
  await sections
    .getByRole("button", { name: "Espaço de trabalho", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Criar outro espaço de trabalho" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("dark mode keeps hover surfaces and dialog headers dark and readable", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Hover needs a mouse pointer");
  await page.addInitScript(() =>
    localStorage.setItem("knowflow-theme", "dark"),
  );
  await page.goto("/demo");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const target of [
    page.locator(".how-row > div").first(),
    page.locator(".document-row").first(),
    page.getByRole("button", { name: "Minhas conversas", exact: true }),
  ]) {
    await target.hover();
    await expect
      .poll(() =>
        target.evaluate((el) => {
          const rgb = getComputedStyle(el)
            .backgroundColor.match(/\d+/g)!
            .slice(0, 3)
            .map(Number);
          return Math.max(...rgb);
        }),
      )
      .toBeLessThan(80);
  }
  await page
    .getByRole("button", { name: "Minha VPN não conecta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Minhas conversas", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", {
      name: "Excluir conversa: VPN não conecta",
      exact: true,
    })
    .click();
  const header = page.getByRole("dialog").locator(".modal-header");
  expect(
    await header.evaluate((el) =>
      Math.max(
        ...getComputedStyle(el)
          .backgroundColor.match(/\d+/g)!
          .slice(0, 3)
          .map(Number),
      ),
    ),
  ).toBeLessThan(80);
  await page.screenshot({
    path: test.info().outputPath("dark-dialog.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("team picker overlays navigation without changing sidebar geometry", async ({
  page,
  isMobile,
}) => {
  await page.goto("/demo");
  if (isMobile)
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  const sidebar = page.locator(".sidebar");
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  const before = await nav.boundingBox();
  const width = await sidebar.evaluate((el) => el.clientWidth);
  await page.getByLabel("Trocar espaço ou equipe").click();
  await expect(
    page.getByRole("navigation", { name: "Espaços e equipes" }),
  ).toBeVisible();
  const after = await nav.boundingBox();
  expect(after!.y).toBeCloseTo(before!.y, 0);
  expect(await sidebar.evaluate((el) => el.clientWidth)).toBe(width);
  expect(await sidebar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page
    .getByRole("navigation", { name: "Espaços e equipes" })
    .getByRole("link", { name: /Pessoas & Cultura/ })
    .click();
  await expect(page.locator(".breadcrumb")).toContainText("Pessoas & Cultura");
});

test("document rows retain side spacing on wide screens", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop breakpoint regression");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/demo");
  const row = page.locator(".document-row").first();
  await row.hover();
  const bounds = await row.boundingBox();
  const icon = await row.locator(".file-icon").boundingBox();
  const arrow = await row.locator(":scope > svg").boundingBox();
  expect(icon!.x - bounds!.x).toBeGreaterThanOrEqual(12);
  expect(
    bounds!.x + bounds!.width - arrow!.x - arrow!.width,
  ).toBeGreaterThanOrEqual(12);
});

test("theme toggle stays separate from the page crossfade on repeated switches", async ({
  page,
}) => {
  await page.goto("/demo");
  const toggle = page.locator(".theme-toggle");
  expect(
    await toggle.evaluate((el) => getComputedStyle(el).viewTransitionName),
  ).toBe("theme-toggle");
  for (let i = 0; i < 4; i++) {
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      i % 2 === 0 ? "dark" : "light",
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.getAnimations().filter((a) => a.playState === "running")
              .length,
        ),
      )
      .toBe(0);
    await expect(toggle.locator("svg")).toHaveCount(1);
  }
});
