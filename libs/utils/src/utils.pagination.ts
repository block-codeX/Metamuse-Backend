import { FilterQuery, Model, SortOrder } from "mongoose"
import { NotFoundError, ValidationError } from "./utils.errors"

export interface PaginatedDocs<T> {
    docs: T[]
    totalDocs: number
    limit: number
    page: number
    totalPages: number
    next: number | null
    prev: number | null
}


export async function paginate<T>(
    model: Model<T>,
    query: FilterQuery<T> = {},
    options: { page: number, limit: number, sortField?: string, sortOrder?: SortOrder },
    fieldsToExclude: string[] = []
): Promise<PaginatedDocs<T>> {
    const { page, limit, sortField, sortOrder } = options;
    if (page < 1) throw new ValidationError('Invalid page number')
    if (limit < 1) throw new ValidationError('Invalid limit')
    const sortOptions = (sortField && sortOrder) ? { [sortField]: sortOrder || -1 } : {};
    const totalDocs = await model.countDocuments(query).exec();
    const totalPages = Math.ceil(totalDocs / limit)
    const skips = (page - 1) * limit
    if (page > 1 && page > totalPages) throw new NotFoundError('Page not found')
    const docs = await model
      .find(query)
      .select(fieldsToExclude)
      .sort(sortOptions)
      .skip(skips)
      .limit(limit)
      .exec();
    const next = docs.length === limit ? page + 1 : null
    const prev = page > 1 ? page - 1 : null
    return { docs, totalDocs, next, prev, limit, page, totalPages }
}

export interface PaginatedQuery {
    page?: number
    limit?: number
    sortField?: string
    sortOrder?: SortOrder
}