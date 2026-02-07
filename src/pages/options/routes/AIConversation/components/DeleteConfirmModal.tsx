import { Modal } from "@arco-design/web-react";

interface DeleteConfirmModalProps {
  visible: boolean;
  sessionTitle?: string;
  onOk: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal = ({ visible, sessionTitle, onOk, onCancel }: DeleteConfirmModalProps) => {
  return (
    <Modal
      title="确认删除"
      visible={visible}
      onOk={onOk}
      onCancel={onCancel}
      okText="删除"
      cancelText="取消"
      okButtonProps={{ status: "danger" }}
    >
      <p>
        {"确定要删除会话 "}
        {sessionTitle}
        {" 吗？"}
      </p>
      <p className="text-gray-500 text-sm">{"此操作不可恢复。"}</p>
    </Modal>
  );
};
