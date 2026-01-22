// Post Domain Entities
export interface IPost {
  _id: string;
  authorId: string;
  content: string;
  mediaUrls: string[];
  mediaTypes: ('image' | 'video')[];
  eventId?: string;
  mentions: string[];
  hashtags: string[];
  privacy: 'public' | 'friends_only' | 'private';
  likeCount: number;
  commentCount: number;
  shareCount: number;
  originalPostId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface IComment {
  _id: string;
  postId: string;
  authorId: string;
  content: string;
  parentCommentId?: string;
  mentions: string[];
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface ILike {
  _id: string;
  userId: string;
  targetId: string;
  targetType: 'post' | 'comment';
  createdAt: Date;
}

// DTOs
export interface ICreatePostDTO {
  authorId: string;
  content: string;
  mediaUrls?: string[];
  mediaTypes?: ('image' | 'video')[];
  eventId?: string;
  privacy?: 'public' | 'friends_only' | 'private';
}

export interface IUpdatePostDTO {
  content?: string;
  privacy?: 'public' | 'friends_only' | 'private';
}

export interface ICreateCommentDTO {
  postId: string;
  authorId: string;
  content: string;
  parentCommentId?: string;
}
