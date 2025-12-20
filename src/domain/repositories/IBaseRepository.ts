export interface IPaginationOptions {
  page: number;
  limit: number;
  sort?: Record<string, 1 | -1>;
}

export interface IPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface IBaseRepository<T, CreateDTO, UpdateDTO> {
  create(data: CreateDTO): Promise<T>;
  findById(id: string): Promise<T | null>;
  findOne(query: Record<string, unknown>): Promise<T | null>;
  findMany(query: Record<string, unknown>): Promise<T[]>;
  findPaginated(
    query: Record<string, unknown>,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<T>>;
  updateById(id: string, data: UpdateDTO): Promise<T | null>;
  deleteById(id: string): Promise<boolean>;
  count(query: Record<string, unknown>): Promise<number>;
  exists(query: Record<string, unknown>): Promise<boolean>;
}

