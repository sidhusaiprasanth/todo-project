export interface Todo {
  id: string;
  text: string;
  quantity?: string;
  completed: boolean;
  createdAt: number;
}

export type FilterType = 'all' | 'active' | 'completed';
