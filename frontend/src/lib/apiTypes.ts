export type LaravelPaginator<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export function isPaginator<T>(v: unknown): v is LaravelPaginator<T> {
  return Boolean(v && typeof v === 'object' && Array.isArray((v as LaravelPaginator<T>).data));
}
