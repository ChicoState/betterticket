export interface CommentRecord {
  id: string;
  ticketId: string;
  authorId: string;
  parentCommentId: string | null;
  body: string;
  isSpotlighted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentRepository {
  list(ticketId: string): Promise<CommentRecord[]>;
  findById(id: string): Promise<CommentRecord | null>;
  create(input: {
    ticketId: string;
    authorId: string;
    body: string;
    parentCommentId?: string;
  }): Promise<CommentRecord>;
  update(id: string, body: string): Promise<CommentRecord | null>;
  softDelete(id: string): Promise<CommentRecord | null>;
  setSpotlight(id: string, isSpotlighted: boolean): Promise<CommentRecord | null>;
  toggleHelpful(commentId: string, userId: string): Promise<boolean>;
  helpfulCount(commentId: string): Promise<number>;
}
