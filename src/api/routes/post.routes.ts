import { Router } from 'express';
import { postController } from '../controllers/post.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Post CRUD
router.post('/', postController.createPost.bind(postController));
router.get('/:postId', postController.getPost.bind(postController));
router.put('/:postId', postController.updatePost.bind(postController));
router.delete('/:postId', postController.deletePost.bind(postController));

// User posts
router.get('/user/:userId', postController.getUserPosts.bind(postController));

// Likes
router.post('/:postId/like', postController.likePost.bind(postController));
router.delete('/:postId/like', postController.unlikePost.bind(postController));

// Comments
router.post('/:postId/comments', postController.createComment.bind(postController));
router.get('/:postId/comments', postController.getPostComments.bind(postController));
router.delete('/comments/:commentId', postController.deleteComment.bind(postController));

// Share
router.post('/:postId/share', postController.sharePost.bind(postController));

// Hashtag search
router.get('/hashtag/:hashtag', postController.searchByHashtag.bind(postController));

export default router;
