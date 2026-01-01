import { Model, Document, FilterQuery, UpdateQuery } from 'mongoose';
import {
  IBaseRepository,
  IPaginationOptions,
  IPaginatedResult,
} from '../../../domain/repositories/IBaseRepository.js';
import { PaginationDefaults } from '../../../shared/constants/index.js';

export class BaseRepository<
  T,
  TDocument extends Document,
  CreateDTO,
  UpdateDTO,
> implements IBaseRepository<T, CreateDTO, UpdateDTO>
{
  protected model: Model<TDocument>;

  constructor(model: Model<TDocument>) {
    this.model = model;
  }

  async create(data: CreateDTO, session?: import('mongoose').ClientSession): Promise<T> {
    const document = new this.model(data);
    const saved = session ? await document.save({ session }) : await document.save();
    return saved.toObject() as T;
  }

  async findById(id: string): Promise<T | null> {
    const document = await this.model.findById(id);
    return document ? (document.toObject() as T) : null;
  }

  async findOne(query: FilterQuery<TDocument>): Promise<T | null> {
    const document = await this.model.findOne(query);
    return document ? (document.toObject() as T) : null;
  }

  async findMany(query: FilterQuery<TDocument>): Promise<T[]> {
    const documents = await this.model.find(query);
    return documents.map((doc) => doc.toObject() as T);
  }

  async findPaginated(
    query: FilterQuery<TDocument>,
    options: IPaginationOptions,
    populateOptions?: { path: string; select?: string } | Array<{ path: string; select?: string }>
  ): Promise<IPaginatedResult<T>> {
    const page = Math.max(1, options.page || PaginationDefaults.PAGE);
    const limit = Math.min(
      options.limit || PaginationDefaults.LIMIT,
      PaginationDefaults.MAX_LIMIT
    );
    const skip = (page - 1) * limit;

    let queryBuilder = this.model
      .find(query)
      .sort(options.sort || { createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Apply populate if provided
    if (populateOptions) {
      if (Array.isArray(populateOptions)) {
        populateOptions.forEach((pop) => {
          queryBuilder = queryBuilder.populate(pop.path, pop.select);
        });
      } else {
        queryBuilder = queryBuilder.populate(populateOptions.path, populateOptions.select);
      }
    }

    const [documents, total] = await Promise.all([
      queryBuilder,
      this.model.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: documents.map((doc) => doc.toObject() as T),
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async updateById(id: string, data: UpdateDTO): Promise<T | null> {
    const document = await this.model.findByIdAndUpdate(
      id,
      data as UpdateQuery<TDocument>,
      { new: true, runValidators: true }
    );
    return document ? (document.toObject() as T) : null;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id);
    return result !== null;
  }

  async count(query: FilterQuery<TDocument>): Promise<number> {
    return this.model.countDocuments(query);
  }

  async exists(query: FilterQuery<TDocument>): Promise<boolean> {
    const result = await this.model.exists(query);
    return result !== null;
  }

  // Utility method for transactions
  async withTransaction<R>(
    operation: (session: import('mongoose').ClientSession) => Promise<R>
  ): Promise<R> {
    const session = await this.model.startSession();
    try {
      session.startTransaction();
      const result = await operation(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}

