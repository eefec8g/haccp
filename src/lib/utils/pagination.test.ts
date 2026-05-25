import { describe, it, expect } from 'vitest';
import { buildPaginated } from './pagination';

describe('[buildPaginated]', () => {
  it('should compute totalPages from total/pageSize', () => {
    const result = buildPaginated([1, 2, 3], 27, { page: 1, pageSize: 10 });

    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('should clamp totalPages to 1 minimum even when total is 0', () => {
    const result = buildPaginated([], 0, { page: 1, pageSize: 25 });

    expect(result.totalPages).toBe(1);
    expect(result.items).toEqual([]);
  });

  it('should compute the last page correctly when total is exactly divisible', () => {
    const result = buildPaginated([1, 2, 3, 4, 5], 50, {
      page: 5,
      pageSize: 10,
    });

    expect(result.totalPages).toBe(5);
    expect(result.page).toBe(5);
  });

  it('should preserve items reference and total field', () => {
    const items = [{ id: 'a' }, { id: 'b' }] as const;
    const result = buildPaginated(items, 2, { page: 1, pageSize: 25 });

    expect(result.items).toBe(items);
    expect(result.total).toBe(2);
  });
});
