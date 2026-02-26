import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "@arco-design/web-react";
import zhCN from "@arco-design/web-react/es/locale/zh-CN";
import "@arco-design/web-react/dist/css/arco.css";
import "./sidepanel.css";
import { SidePanelApp } from "@App/pages/sidepanel/SidePanelApp.tsx";

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <SidePanelApp />
    </ConfigProvider>
  );
}
// log
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  process.env.NODE_ENV === "development" ? (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ) : (
    <App />
  )
);