import { setReplyVote, type VoteState } from "./ticket-api.js";
import { VoteControls } from "./VoteControls.js";

export interface TicketReplyVoteProps extends VoteState {
  ticketId: string;
  replyId: string;
  canVote?: boolean;
}

export function TicketReplyVote({
  ticketId,
  replyId,
  upvotes,
  downvotes,
  userVote,
  canVote = false
}: TicketReplyVoteProps) {
  return (
    <VoteControls
      subject="reply"
      initialState={{ upvotes, downvotes, userVote }}
      canVote={canVote}
      saveVote={(value) => setReplyVote(ticketId, replyId, value)}
    />
  );
}
