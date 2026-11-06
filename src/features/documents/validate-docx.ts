import { fromBuffer } from "yauzl";
import { AppError } from "@/lib/errors";

// Stream the archive before Mammoth allocates extracted entries in memory.
export async function validateDocx(data: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    fromBuffer(
      Buffer.from(data),
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip) {
          reject(new AppError("DOCX inválido."));
          return;
        }
        let count = 0,
          total = 0,
          hasDocument = false,
          failed = false;
        const fail = () => {
          if (!failed) {
            failed = true;
            zip.close();
            reject(
              new AppError(
                "DOCX inválido ou muito extenso após descompactação.",
              ),
            );
          }
        };
        zip.on("error", fail);
        zip.on("end", () => {
          if (!failed) {
            if (hasDocument) resolve();
            else
              reject(new AppError("O arquivo não contém um documento Word."));
          }
        });
        zip.on("entry", (entry) => {
          if (
            ++count > 512 ||
            entry.uncompressedSize > 16 * 1024 * 1024 ||
            total + entry.uncompressedSize > 50 * 1024 * 1024 ||
            entry.isEncrypted()
          ) {
            fail();
            return;
          }
          if (entry.fileName === "word/document.xml") hasDocument = true;
          if (entry.fileName.endsWith("/")) {
            zip.readEntry();
            return;
          }
          zip.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) {
              fail();
              return;
            }
            let bytes = 0;
            stream.on("error", fail);
            stream.on("data", (chunk: Buffer) => {
              bytes += chunk.length;
              total += chunk.length;
              if (bytes > 16 * 1024 * 1024 || total > 50 * 1024 * 1024) {
                stream.destroy();
                fail();
              }
            });
            stream.on("end", () => {
              if (!failed) zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    );
  });
}
