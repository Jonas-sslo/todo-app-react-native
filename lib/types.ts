export type uuid = string;

export type Filter = "all" | "done" | "pending";

export type TodoItem = { id: uuid; text: string; status: Filter, createdAt: Date };