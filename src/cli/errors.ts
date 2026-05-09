export class KGraphError extends Error {
  constructor(
    message: string,
    public readonly exitCode = 1
  ) {
    super(message);
    this.name = "KGraphError";
  }
}

export async function runCommand(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (error instanceof KGraphError) {
      console.error(`Error: ${error.message}`);
      process.exitCode = error.exitCode;
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`Unexpected error: ${message}`);
    process.exitCode = 1;
  }
}
