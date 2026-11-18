export const voteBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["value"],
  properties: { value: { enum: [-1, 1] } }
} as const;
export const voteStateResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["upvotes", "downvotes", "userVote"],
  properties: {
    upvotes: { type: "integer", minimum: 0 },
    downvotes: { type: "integer", minimum: 0 },
    userVote: { enum: [-1, 1, null] }
  }
} as const;
