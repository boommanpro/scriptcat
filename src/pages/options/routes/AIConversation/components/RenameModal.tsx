import { useState } from "react";
import { Modal, Input } from "@arco-design/web-react";

interface RenameModalProps {
  visible: boolean;
  currentTitle: string;
  onOk: (newTitle: string) => void;
  onCancel: () => void;
}

export const RenameModal = ({ visible, currentTitle, onOk, onCancel }: RenameModalProps) => {
  const [newTitle, setNewTitle] = useState(currentTitle);

  const handleOk = () => {
    onOk(newTitle);
    setNewTitle(currentTitle); // Reset for next use
  };

  const handleCancel = () => {
    onCancel();
    setNewTitle(currentTitle); // Reset for next use
  };

  return (
    <Modal title="重命名会话" visible={visible} onOk={handleOk} onCancel={handleCancel} okText="确定" cancelText="取消">
      <Input placeholder="请输入新的会话名称" value={newTitle} onChange={setNewTitle} maxLength={100} autoFocus />
    </Modal>
  );
};
