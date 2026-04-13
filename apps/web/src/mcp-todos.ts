import fs from 'node:fs/promises'
import path from 'node:path'

const todosPath = path.resolve(process.cwd(), 'mcp-todos.json')
const defaultTodos: Todo[] = [
  {
    id: 1,
    title: 'Buy groceries',
  },
]

// In-memory todos storage
let todos: Todo[] = [...defaultTodos]
let hasLoadedTodos = false

// Subscription callbacks per userID
let subscribers: ((todos: Todo[]) => void)[] = []

export type Todo = {
  id: number
  title: string
}

function isTodo(value: unknown): value is Todo {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<Todo>
  return typeof candidate.id === 'number' && typeof candidate.title === 'string'
}

async function loadTodos() {
  if (hasLoadedTodos) {
    return
  }
  hasLoadedTodos = true

  try {
    const raw = await fs.readFile(todosPath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.every(isTodo)) {
      todos = parsed
      return
    }

    console.warn('[mcp-todos] Invalid todos payload shape. Resetting to defaults.')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code
    if (code === 'ENOENT') {
      await persistTodos()
      return
    }
    console.warn('[mcp-todos] Failed to load todos file. Resetting to defaults.', error)
  }

  todos = [...defaultTodos]
  await persistTodos()
}

async function persistTodos() {
  await fs.writeFile(todosPath, JSON.stringify(todos, null, 2))
}

// Get the todos for a user
export async function getTodos(): Promise<Todo[]> {
  await loadTodos()
  return todos
}

// Add an item to the todos
export async function addTodo(title: string): Promise<Todo> {
  await loadTodos()
  const todo = { id: todos.length + 1, title }
  todos.push(todo)
  await persistTodos()
  notifySubscribers()
  return todo
}

// Subscribe to cart changes for a user
export async function subscribeToTodos(callback: (todos: Todo[]) => void) {
  await loadTodos()
  subscribers.push(callback)
  callback(todos)
  return () => {
    subscribers = subscribers.filter((cb) => cb !== callback)
  }
}

// Notify all subscribers of a user's cart
function notifySubscribers() {
  for (const cb of subscribers) {
    try {
      cb(todos)
    } catch (error) {
      console.warn('[mcp-todos] Subscriber callback failed.', error)
    }
  }
}
