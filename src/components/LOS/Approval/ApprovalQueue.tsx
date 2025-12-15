interface ApprovalQueueProps {
  orgId: string;
  userId: string;
}

export default function ApprovalQueue({ orgId, userId }: ApprovalQueueProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Approval Queue</h2>
    </div>
  );
}
