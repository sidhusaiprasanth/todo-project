'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { FilterType } from '@/types/todo';

interface GroceryItem {
  id: string;
  text: string;
  quantity?: string;
  completed: boolean;
  created_at: string;
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

interface ItemRowProps {
  item: GroceryItem;
  isDeleting: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

function ItemRow({ item, isDeleting, onToggle, onDelete }: ItemRowProps) {
  const [bouncing, setBouncing] = useState(false);

  const handleToggle = () => {
    if (!item.completed) {
      setBouncing(true);
      setTimeout(() => setBouncing(false), 300);
    }
    onToggle(item.id, item.completed);
  };

  return (
    <div
      data-testid="todo-item"
      className={`flex items-center gap-3 px-5 py-4 group border-b border-[#1e2636] last:border-0 transition-all duration-300 hover:bg-[#1e2636] ${
        isDeleting ? 'animate-slide-out' : 'animate-slide-in'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        aria-label={item.completed ? 'Mark as incomplete' : 'Mark as complete'}
        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 focus:ring-offset-[#1a1f2e] ${
          item.completed
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-[#3a4a5c] hover:border-emerald-500'
        }`}
      >
        {item.completed && (
          <svg
            className={`w-3 h-3 text-white ${bouncing ? 'animate-check-bounce' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Item text */}
      <span
        className={`flex-1 text-sm leading-relaxed transition-all duration-300 ${
          item.completed
            ? 'line-through text-gray-600'
            : 'text-gray-200'
        }`}
      >
        {item.text}
      </span>

      {/* Quantity badge */}
      {item.quantity && (
        <span className="flex-shrink-0 text-xs font-medium text-emerald-400 bg-emerald-900/40 px-2 py-0.5 rounded-full border border-emerald-800/50">
          {item.quantity}
        </span>
      )}

      {/* Delete button */}
      <button
        onClick={() => onDelete(item.id)}
        aria-label="Delete todo"
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-900/30 transition-all duration-200 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function TodoApp() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [quantityValue, setQuantityValue] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('grocery_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setItems(data as GroceryItem[]);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchItems();

    const channel = supabase
      .channel('grocery')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grocery_items' },
        () => fetchItems()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addTodo = async () => {
    const text = inputValue.trim();
    if (!text) return;
    const quantity = quantityValue.trim() || undefined;

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempItem: GroceryItem = {
      id: tempId,
      text,
      quantity,
      completed: false,
      created_at: new Date().toISOString(),
    };
    setItems(prev => [tempItem, ...prev]);
    setInputValue('');
    setQuantityValue('');
    inputRef.current?.focus();

    await supabase.from('grocery_items').insert({ text, quantity, completed: false });
    // Real-time subscription will sync the actual row
  };

  const toggleTodo = async (id: string, currentCompleted: boolean) => {
    // Optimistic update
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, completed: !currentCompleted } : item))
    );
    await supabase
      .from('grocery_items')
      .update({ completed: !currentCompleted })
      .eq('id', id);
  };

  const deleteTodo = async (id: string) => {
    setDeletingIds(prev => new Set(prev).add(id));
    setTimeout(async () => {
      setItems(prev => prev.filter(item => item.id !== id));
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await supabase.from('grocery_items').delete().eq('id', id);
    }, 300);
  };

  const clearCompleted = async () => {
    setItems(prev => prev.filter(item => !item.completed));
    await supabase.from('grocery_items').delete().eq('completed', true);
  };

  const clearAll = async () => {
    if (!window.confirm('Clear all items from the list?')) return;
    setItems([]);
    await supabase
      .from('grocery_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
  };

  const filteredItems = items.filter(item => {
    if (filter === 'active') return !item.completed;
    if (filter === 'completed') return item.completed;
    return true;
  });

  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;
  const remainingCount = totalCount - completedCount;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-start justify-center p-4 pt-12 sm:pt-20 animate-fade-up">
      <div className="w-full max-w-lg">
        <div className="bg-[#161b27] border border-[#1e2636] rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-br from-[#0d1f14] to-[#0f1117] px-6 pt-8 pb-6 border-b border-[#1e2636]">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h1 className="text-2xl font-bold text-emerald-400 tracking-tight flex items-center gap-2">
                  <span>🛒</span> CartList
                </h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  {loading
                    ? 'Loading...'
                    : totalCount === 0
                    ? 'Nothing here yet — add an item!'
                    : `${completedCount} of ${totalCount} completed`}
                </p>
              </div>
              {totalCount > 0 && (
                <div className="bg-emerald-900/30 border border-emerald-800/50 rounded-xl px-4 py-2 text-center min-w-[64px]">
                  <span className="text-emerald-400 text-xl font-bold leading-none">{remainingCount}</span>
                  <p className="text-emerald-700 text-[10px] mt-0.5 uppercase tracking-wide">left</p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {totalCount > 0 && (
              <div className="mt-3 mb-5 bg-[#1e2636] rounded-full h-1.5">
                <div
                  className="bg-emerald-500 rounded-full h-1.5 transition-all duration-700 ease-out animate-progress-glow"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}

            {/* Input row */}
            <div className={`flex gap-2 ${totalCount === 0 ? 'mt-4' : ''}`}>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTodo()}
                placeholder="Add an item..."
                className="flex-1 bg-[#1e2636] text-white placeholder:text-gray-500 border border-[#2a3347] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-600 focus:bg-[#1e2a38] transition-all duration-200 min-w-0"
              />
              <input
                type="text"
                value={quantityValue}
                onChange={e => setQuantityValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTodo()}
                placeholder="Qty"
                className="w-20 flex-shrink-0 bg-[#1e2636] text-white placeholder:text-gray-500 border border-[#2a3347] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:bg-[#1e2a38] transition-all duration-200"
              />
              <button
                onClick={addTodo}
                disabled={!inputValue.trim()}
                className="flex-shrink-0 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-5 py-2.5 rounded-xl text-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
              >
                Add
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex border-b border-[#1e2636]">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex-1 py-3 text-sm font-medium transition-all duration-200 relative focus:outline-none ${
                  filter === key ? 'text-emerald-400' : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                {label}
                {filter === key && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-emerald-500 rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto overscroll-contain bg-[#1a1f2e]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 gap-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse-dot"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
                <p className="text-gray-600 text-sm">Loading items...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="w-14 h-14 bg-emerald-900/20 border border-emerald-900/30 rounded-2xl flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-emerald-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <p className="text-gray-600 text-sm font-medium">
                  {filter === 'all'
                    ? 'No items yet — add one above!'
                    : filter === 'active'
                    ? 'No active items.'
                    : 'No completed items.'}
                </p>
              </div>
            ) : (
              filteredItems.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isDeleting={deletingIds.has(item.id)}
                  onToggle={toggleTodo}
                  onDelete={deleteTodo}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-5 py-3.5 bg-[#161b27] border-t border-[#1e2636] flex items-center justify-between">
              <span className="text-xs text-gray-600">
                {completedCount} of {totalCount} completed
              </span>
              <div className="flex items-center gap-3">
                {completedCount > 0 && (
                  <button
                    onClick={clearCompleted}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors duration-150 focus:outline-none"
                  >
                    Clear completed
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="text-xs text-red-700 hover:text-red-400 transition-colors duration-150 focus:outline-none"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
