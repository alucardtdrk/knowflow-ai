import { requireActor } from "@/lib/access";
import { downloadDocument } from "@/features/documents/service";
import { AppError } from "@/lib/errors";
import { z } from "zod";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await context.params).id);
    const url = new URL(request.url);
    const scope = {
      organizationId: z.uuid().parse(url.searchParams.get("organizationId")),
      teamId: z.uuid().parse(url.searchParams.get("teamId")),
    };
    const { title, data } = await downloadDocument(
      await requireActor(),
      scope,
      id,
    );
    return new Response(Buffer.from(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(title)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof AppError ? e.message : "Arquivo indisponível." },
      { status: e instanceof AppError ? e.status : 400 },
    );
  }
}
