/* eslint-disable react/jsx-no-literals */
import { Modal, Table, Space, Tag, Button, Tooltip, Popconfirm, Empty } from "@arco-design/web-react";
import { IconEdit, IconDelete, IconCheck, IconPlus } from "@arco-design/web-react/icon";
import type { AIConfig } from "@App/pkg/ai";

interface AIConfigModalProps {
  visible: boolean;
  configs: AIConfig[];
  onAddConfig: () => void;
  onEditConfig: (config: AIConfig) => void;
  onDeleteConfig: (id: string) => void;
  onSetDefault: (id: string) => void;
  onClose: () => void;
}

export const AIConfigModal = ({
  visible,
  configs,
  onAddConfig,
  onEditConfig,
  onDeleteConfig,
  onSetDefault,
  onClose,
}: AIConfigModalProps) => {
  const columns = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: AIConfig) => (
        <Space>
          <span>{name}</span>
          {record.isDefault && (
            <Tag color="arcoblue" size="small">
              <IconCheck /> 默认
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "模型",
      dataIndex: "model",
      key: "model",
      width: 250,
    },
    {
      title: "API端点",
      dataIndex: "apiEndpoint",
      key: "apiEndpoint",
      width: 280,
      render: (endpoint: string) => (
        <Tooltip content={endpoint}>
          <span className="truncate block w-full">{endpoint}</span>
        </Tooltip>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_: any, record: AIConfig) => (
        <Space>
          {!record.isDefault && (
            <Tooltip content="设为默认">
              <Button type="text" size="small" onClick={() => onSetDefault(record.id)}>
                设为默认
              </Button>
            </Tooltip>
          )}
          <Tooltip content="编辑">
            <Button type="text" size="small" icon={<IconEdit />} onClick={() => onEditConfig(record)} />
          </Tooltip>
          {!record.isDefault && (
            <Tooltip content="删除">
              <Popconfirm title="确定要删除此配置吗？" onOk={() => onDeleteConfig(record.id)}>
                <Button type="text" size="small" status="danger" icon={<IconDelete />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Modal title="AI配置管理" visible={visible} onCancel={onClose} footer={null} style={{ width: "1100px" }}>
      <div className="ai-config-modal">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-500">共 {configs.length} 个配置</div>
          <Button icon={<IconPlus />} onClick={onAddConfig}>
            新增配置
          </Button>
        </div>

        {configs.length === 0 ? (
          <Empty description="暂无AI配置" />
        ) : (
          <Table data={configs} rowKey="id" size="small" border={true} columns={columns} />
        )}
      </div>
    </Modal>
  );
};
