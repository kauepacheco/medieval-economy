export class GameError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "GameError";
  }
}
