export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return "今天 " + date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  } else if (days === 1) {
    return "昨天 " + date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString("zh-CN");
  }
};
