import { Request, Response, NextFunction } from 'express';
import { postService } from '../../application/services/PostService.js';
import { sendSuccess, sendPaginated, sendCreated, sendNoContent } from '../../shared/utils/response.js';

export class PostController {
  async createPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, mediaUrls, mediaTypes, eventId, privacy } = req.body;
      const post = await postService.createPost({
        authorId: req.userId!,
        content,
        mediaUrls,
        mediaTypes,
        eventId,
        privacy,
      });
      sendCreated(res, post, 'Post created successfully');
    } catch (error) {
      next(error);
    }
  }

  async getPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await postService.getPost(req.params.postId, req.userId!);
      sendSuccess(res, post);
    } catch (error) {
      next(error);
    }
  }

  async updatePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, privacy } = req.body;
      const post = await postService.updatePost(req.params.postId, req.userId!, {
        content,
        privacy,
      });
      sendSuccess(res, post, { message: 'Post updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async deletePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await postService.deletePost(req.params.postId, req.userId!);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async getUserPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await postService.getUserPosts(
        req.params.userId,
        req.userId!,
        { page: Number(page), limit: Number(limit) }
      );
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
    } catch (error) {
      next(error);
    }
  }

  async likePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await postService.likePost(req.params.postId, req.userId!);
      sendSuccess(res, null, { message: 'Post liked' });
    } catch (error) {
      next(error);
    }
  }

  async unlikePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await postService.unlikePost(req.params.postId, req.userId!);
      sendSuccess(res, null, { message: 'Post unliked' });
    } catch (error) {
      next(error);
    }
  }

  async createComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, parentCommentId } = req.body;
      const comment = await postService.createComment({
        postId: req.params.postId,
        authorId: req.userId!,
        content,
        parentCommentId,
      });
      sendCreated(res, comment, 'Comment created successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await postService.deleteComment(req.params.commentId, req.body.postId, req.userId!);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  }

  async getPostComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await postService.getPostComments(req.params.postId, {
        page: Number(page),
        limit: Number(limit),
      });
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
    } catch (error) {
      next(error);
    }
  }

  async sharePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content } = req.body;
      const post = await postService.sharePost(req.params.postId, req.userId!, content);
      sendCreated(res, post, 'Post shared successfully');
    } catch (error) {
      next(error);
    }
  }

  async searchByHashtag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await postService.searchByHashtag(req.params.hashtag, {
        page: Number(page),
        limit: Number(limit),
      });
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const postController = new PostController();
