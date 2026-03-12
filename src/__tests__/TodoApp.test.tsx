import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TodoApp from '../components/TodoApp';

// ─── In-memory Supabase mock ──────────────────────────────────────────────────

type DbRow = {
  id: string;
  text: string;
  quantity?: string;
  completed: boolean;
  created_at: string;
};

let mockDb: DbRow[] = [];
let nextId = 1;

// Chainable query builder that resolves when awaited
function buildQuery(action: string, payload?: unknown) {
  const filters: { field: string; op: 'eq' | 'neq'; value: unknown }[] = [];

  const builder = {
    eq(field: string, value: unknown) { filters.push({ field, op: 'eq', value }); return builder; },
    neq(field: string, value: unknown) { filters.push({ field, op: 'neq', value }); return builder; },
    order() { return builder; },
    then(resolve: (v: { data: DbRow[]; error: null }) => void) {
      if (action === 'select') {
        const result = [...mockDb];
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve({ data: result, error: null });
        return;
      }
      if (action === 'insert') {
        const p = payload as { text: string; quantity?: string; completed: boolean };
        const row: DbRow = {
          id: String(nextId++),
          text: p.text,
          quantity: p.quantity,
          completed: p.completed ?? false,
          created_at: new Date().toISOString(),
        };
        mockDb.unshift(row);
        resolve({ data: [row], error: null });
        return;
      }
      if (action === 'update') {
        const p = payload as Partial<DbRow>;
        for (const f of filters) {
          if (f.op === 'eq' && f.field === 'id') {
            mockDb = mockDb.map(r => (r.id === f.value ? { ...r, ...p } : r));
          }
        }
        resolve({ data: mockDb, error: null });
        return;
      }
      if (action === 'delete') {
        for (const f of filters) {
          if (f.op === 'eq')  mockDb = mockDb.filter(r => (r as Record<string, unknown>)[f.field] !== f.value);
          if (f.op === 'neq') mockDb = mockDb.filter(r => (r as Record<string, unknown>)[f.field] === f.value);
        }
        resolve({ data: mockDb, error: null });
        return;
      }
      resolve({ data: [], error: null });
    },
  };
  return builder;
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (_table: string) => ({
      select: () => buildQuery('select'),
      insert: (payload: unknown) => buildQuery('insert', payload),
      update: (payload: unknown) => buildQuery('update', payload),
      delete: () => buildQuery('delete'),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  },
}));

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockDb = [];
  nextId = 1;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function addItem(user: ReturnType<typeof userEvent.setup>, text: string) {
  const input = screen.getByPlaceholderText(/add an item/i);
  await user.type(input, text);
  await user.keyboard('{Enter}');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TodoApp', () => {
  describe('Empty state', () => {
    it('renders empty state when no items exist', async () => {
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
    });

    it('renders empty state for Active filter when all items are complete', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      await addItem(user, 'Done task');
      await user.click(screen.getByLabelText('Mark as complete'));
      await user.click(screen.getByRole('button', { name: 'Active' }));
      expect(screen.getByText(/no active items/i)).toBeInTheDocument();
    });

    it('renders empty state for Completed filter when no items are complete', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      await addItem(user, 'Pending task');
      await user.click(screen.getByRole('button', { name: 'Completed' }));
      expect(screen.getByText(/no completed items/i)).toBeInTheDocument();
    });
  });

  describe('Adding items', () => {
    it('adds a new item on Enter key press', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      await addItem(user, 'Buy groceries');
      expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    });

    it('adds a new item on Add button click', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      const input = screen.getByPlaceholderText(/add an item/i);
      await user.type(input, 'Read a book');
      await user.click(screen.getByRole('button', { name: /^add$/i }));
      expect(screen.getByText('Read a book')).toBeInTheDocument();
    });

    it('does not add a whitespace-only item', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      const input = screen.getByPlaceholderText(/add an item/i);
      await user.type(input, '   ');
      await user.keyboard('{Enter}');
      expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
    });

    it('clears the input field after adding', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      const input = screen.getByPlaceholderText(/add an item/i);
      await user.type(input, 'Clean house');
      await user.keyboard('{Enter}');
      expect(input).toHaveValue('');
    });
  });

  describe('Completing items', () => {
    it('marks an item as complete when checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      await addItem(user, 'Walk the dog');
      await user.click(screen.getByLabelText('Mark as complete'));
      expect(screen.getByText('Walk the dog')).toHaveClass('line-through');
    });

    it('unmarks a completed item when checkbox is clicked again', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      await addItem(user, 'Water plants');
      await user.click(screen.getByLabelText('Mark as complete'));
      await user.click(screen.getByLabelText('Mark as incomplete'));
      expect(screen.getByText('Water plants')).not.toHaveClass('line-through');
    });
  });

  describe('Deleting items', () => {
    it('removes an item after delete is clicked', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      await addItem(user, 'Clean the house');

      const item = screen.getByText('Clean the house').closest('[data-testid="todo-item"]')!;
      await user.click(within(item).getByLabelText('Delete todo'));

      await waitFor(
        () => expect(screen.queryByText('Clean the house')).not.toBeInTheDocument(),
        { timeout: 600 }
      );
    });
  });

  describe('Filter tabs', () => {
    it('All filter shows every item', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      await addItem(user, 'Task A');
      await addItem(user, 'Task B');
      const checkboxes = screen.getAllByLabelText('Mark as complete');
      await user.click(checkboxes[0]);

      await user.click(screen.getByRole('button', { name: 'All' }));
      expect(screen.getByText('Task A')).toBeInTheDocument();
      expect(screen.getByText('Task B')).toBeInTheDocument();
    });

    it('Active filter shows only incomplete items', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      await addItem(user, 'Active task');
      await addItem(user, 'Done task');
      await user.click(screen.getAllByLabelText('Mark as complete')[0]);

      await user.click(screen.getByRole('button', { name: 'Active' }));
      expect(screen.getByText('Active task')).toBeInTheDocument();
      expect(screen.queryByText('Done task')).not.toBeInTheDocument();
    });

    it('Completed filter shows only completed items', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      await addItem(user, 'Pending task');
      await addItem(user, 'Finished task');
      await user.click(screen.getAllByLabelText('Mark as complete')[0]);

      await user.click(screen.getByRole('button', { name: 'Completed' }));
      expect(screen.getByText('Finished task')).toBeInTheDocument();
      expect(screen.queryByText('Pending task')).not.toBeInTheDocument();
    });
  });

  describe('Counter', () => {
    it('displays correct completed count', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      await addItem(user, 'Task 1');
      await addItem(user, 'Task 2');
      expect(screen.getAllByText(/0 of 2 completed/i).length).toBeGreaterThanOrEqual(1);
    });

    it('updates counter when an item is completed', async () => {
      const user = userEvent.setup();
      render(<TodoApp />);
      await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
      await addItem(user, 'Task A');
      await addItem(user, 'Task B');
      await user.click(screen.getAllByLabelText('Mark as complete')[0]);
      expect(screen.getAllByText(/1 of 2 completed/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});
