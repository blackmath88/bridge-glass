export type Command = { label: string; undo(): void; redo(): void }

export class History {
  private undoStack: Command[] = []
  private redoStack: Command[] = []

  constructor(private readonly changed: () => void = () => undefined) {}

  push(cmd: Command) {
    this.undoStack.push(cmd)
    if (this.undoStack.length > 200) this.undoStack.shift()
    this.redoStack = []
    this.changed()
  }

  undo() {
    const cmd = this.undoStack.pop()
    if (!cmd) return
    cmd.undo()
    this.redoStack.push(cmd)
    this.changed()
  }

  redo() {
    const cmd = this.redoStack.pop()
    if (!cmd) return
    cmd.redo()
    this.undoStack.push(cmd)
    this.changed()
  }

  get canUndo() { return this.undoStack.length > 0 }
  get canRedo() { return this.redoStack.length > 0 }

  clear() {
    this.undoStack = []
    this.redoStack = []
    this.changed()
  }
}
