import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  CvFileStorage,
  StoredCvFile
} from "@/modules/ai-cv-analyzer/ai-cv-analyzer.types";

export class LocalCvFileStorage implements CvFileStorage {
  private readonly rootPath: string;

  constructor(storagePath: string) {
    this.rootPath = path.resolve(storagePath);
  }

  async saveFile(input: {
    userId: string;
    fileId: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<StoredCvFile> {
    const storageKey = path.posix.join(
      "cv",
      input.userId,
      `${input.fileId}.pdf`
    );
    const absolutePath = this.toAbsolutePath(storageKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return {
      storageDriver: "LOCAL",
      storageKey
    };
  }

  async readFile(storageKey: string): Promise<Buffer> {
    return readFile(this.toAbsolutePath(storageKey));
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      await unlink(this.toAbsolutePath(storageKey));
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }

  private toAbsolutePath(storageKey: string) {
    const absolutePath = path.resolve(this.rootPath, storageKey);
    const rootWithSeparator = `${this.rootPath}${path.sep}`;

    if (
      absolutePath !== this.rootPath &&
      !absolutePath.startsWith(rootWithSeparator)
    ) {
      throw new Error("Resolved CV storage path escapes the configured root");
    }

    return absolutePath;
  }
}

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
