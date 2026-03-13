import { Drawer, Empty, Space, Tag } from "@arco-design/web-react";
import { formatTime } from "../utils/format";

interface ConversationDetailDrawerProps {
  visible: boolean;
  session: any;
  onClose: () => void;
}

export const ConversationDetailDrawer = ({ visible, session, onClose }: ConversationDetailDrawerProps) => {
  return (
    <Drawer
      title={`对话详情 - ${session?.title || "未选择会话"}`}
      visible={visible}
      width={800}
      onCancel={onClose}
      footer={null}
    >
      {session && (
        <div className="conversation-detail">
          <div className="detail-header">
            <Space>
              <Tag color="arcoblue">
                {"消息数量:"} {session.messages?.length || 0}
              </Tag>
              <Tag color="green">
                {"创建时间:"} {formatTime(session.createdAt)}
              </Tag>
              <Tag color="orangered">
                {"更新时间:"} {formatTime(session.updatedAt)}
              </Tag>
            </Space>
          </div>
          <div className="detail-messages">
            {!session.messages || session.messages.length === 0 ? (
              <Empty description="暂无消息" />
            ) : (
              session.messages.map((msg: any, index: number) => (
                <div key={index} className={`detail-message ${msg.role}`}>
                  <div className="message-role">
                    {msg.role === "user" ? "用户" : msg.role === "assistant" ? "AI助手" : "系统"}
                  </div>
                  <div className="message-content">
                    <pre>{msg.content}</pre>
                  </div>
                  <div className="message-time">{formatTime(msg.timestamp)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
};
