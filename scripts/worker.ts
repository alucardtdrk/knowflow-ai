import { processNextJob } from "../src/features/documents/worker";
let running = true;
process.on("SIGINT", () => {
  running = false;
});
process.on("SIGTERM", () => {
  running = false;
});
console.log("KnowFlow: aguardando documentos.");
while (running) {
  try {
    if (!(await processNextJob()))
      await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch {
    console.error("Trabalhador sem conexão. Nova tentativa em 5 segundos.");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
process.exit(0);
