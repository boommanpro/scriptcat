import { Card, Typography, Collapse, Table, Tag, Space, Button, Divider, Alert } from "@arco-design/web-react";
import { useTranslation } from "react-i18next";
import { IconBook, IconExperiment } from "@arco-design/web-react/icon";

const { Title, Paragraph, Text } = Typography;
const CollapseItem = Collapse.Item;

interface PatternGuideProps {
  onOpenTester?: () => void;
}

const PatternGuide: React.FC<PatternGuideProps> = ({ onOpenTester }) => {
  const { t } = useTranslation();

  const domainMatchColumns = [
    {
      title: t("csp_rule_page.guide.format"),
      dataIndex: "format",
      render: (text: string) => <code className="bg-gray-100 px-2 py-1 rounded">{text}</code>,
    },
    {
      title: t("csp_rule_page.guide.example"),
      dataIndex: "example",
      render: (text: string) => <code className="bg-gray-100 px-2 py-1 rounded">{text}</code>,
    },
    {
      title: t("csp_rule_page.guide.description"),
      dataIndex: "description",
    },
  ];

  const domainMatchData = [
    {
      format: "domain",
      example: "example.com",
      description: t("csp_rule_page.guide.domain_normal"),
    },
    {
      format: "*.domain",
      example: "*.example.com",
      description: t("csp_rule_page.guide.domain_wildcard"),
    },
    {
      format: "domain:port",
      example: "example.com:8080",
      description: t("csp_rule_page.guide.domain_port"),
    },
    {
      format: "//domain",
      example: "//example.com",
      description: t("csp_rule_page.guide.domain_protocol_any"),
    },
    {
      format: "schema://domain",
      example: "https://example.com",
      description: t("csp_rule_page.guide.domain_protocol_specific"),
    },
  ];

  const pathMatchColumns = [
    {
      title: t("csp_rule_page.guide.pattern"),
      dataIndex: "pattern",
      render: (text: string) => <code className="bg-gray-100 px-2 py-1 rounded">{text}</code>,
    },
    {
      title: t("csp_rule_page.guide.matches"),
      dataIndex: "matches",
      render: (matches: string[]) => (
        <div className="space-y-1">
          {matches.map((m, i) => (
            <div key={i}>
              <Tag color="green" size="small">
                ✓
              </Tag>{" "}
              <code className="text-xs">{m}</code>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: t("csp_rule_page.guide.not_matches"),
      dataIndex: "notMatches",
      render: (notMatches: string[]) => (
        <div className="space-y-1">
          {notMatches.map((m, i) => (
            <div key={i}>
              <Tag color="red" size="small">
                ✗
              </Tag>{" "}
              <code className="text-xs">{m}</code>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const pathMatchData = [
    {
      pattern: "example.com/path",
      matches: ["https://example.com/path", "https://example.com/path/", "https://example.com/path/sub"],
      notMatches: ["https://example.com/path-other", "https://example.com/other"],
    },
    {
      pattern: "*://example.com/*",
      matches: ["http://example.com/any", "https://example.com/any/path", "https://example.com/"],
      notMatches: ["https://sub.example.com/path", "https://other.com/path"],
    },
    {
      pattern: "*.example.com/*",
      matches: ["https://www.example.com/path", "https://api.example.com/test", "https://sub.example.com/"],
      notMatches: ["https://example.com/path", "https://other.com/path"],
    },
    {
      pattern: "**.example.com/*",
      matches: [
        "https://example.com/path",
        "https://www.example.com/path",
        "https://api.example.com/test",
        "https://deep.sub.example.com/",
      ],
      notMatches: ["https://other.com/path"],
    },
  ];

  const wildcardColumns = [
    {
      title: t("csp_rule_page.guide.wildcard"),
      dataIndex: "wildcard",
      render: (text: string) => <code className="bg-gray-100 px-2 py-1 rounded text-lg">{text}</code>,
    },
    {
      title: t("csp_rule_page.guide.meaning"),
      dataIndex: "meaning",
    },
    {
      title: t("csp_rule_page.guide.regex_equivalent"),
      dataIndex: "regex",
      render: (text: string) => <code className="text-xs">{text}</code>,
    },
  ];

  const wildcardData = [
    {
      wildcard: "*",
      meaning: t("csp_rule_page.guide.wildcard_single"),
      regex: "[^/?]*",
    },
    {
      wildcard: "**.",
      meaning: t("csp_rule_page.guide.wildcard_double_domain"),
      regex: "(?:[^/]+\\.)?",
    },
    {
      wildcard: "**",
      meaning: t("csp_rule_page.guide.wildcard_double"),
      regex: ".*",
    },
  ];

  return (
    <Card className="pattern-guide">
      <div className="flex justify-between items-center mb-4">
        <Space>
          <IconBook />
          <Title heading={5} className="m-0">
            {t("csp_rule_page.guide.title")}
          </Title>
        </Space>
        {onOpenTester && (
          <Button type="primary" icon={<IconExperiment />} onClick={onOpenTester}>
            {t("csp_rule_page.guide.open_tester")}
          </Button>
        )}
      </div>

      <Alert type="info" content={t("csp_rule_page.guide.intro")} className="mb-4" />

      <Collapse defaultActiveKey={["domain", "path", "wildcard", "regex"]}>
        <CollapseItem
          header={
            <Space>
              <Tag color="purple">Domain</Tag>
              <Text>{t("csp_rule_page.guide.domain_matching")}</Text>
            </Space>
          }
          name="domain"
        >
          <Paragraph>{t("csp_rule_page.guide.domain_intro")}</Paragraph>
          <Table columns={domainMatchColumns} data={domainMatchData} pagination={false} size="small" />
        </CollapseItem>

        <CollapseItem
          header={
            <Space>
              <Tag color="green">Wildcard</Tag>
              <Text>{t("csp_rule_page.guide.path_matching")}</Text>
            </Space>
          }
          name="path"
        >
          <Paragraph>{t("csp_rule_page.guide.path_intro")}</Paragraph>
          <Table columns={pathMatchColumns} data={pathMatchData} pagination={false} size="small" />
        </CollapseItem>

        <CollapseItem
          header={
            <Space>
              <Tag color="blue">Wildcard</Tag>
              <Text>{t("csp_rule_page.guide.wildcard_rules")}</Text>
            </Space>
          }
          name="wildcard"
        >
          <Paragraph>{t("csp_rule_page.guide.wildcard_intro")}</Paragraph>
          <Table columns={wildcardColumns} data={wildcardData} pagination={false} size="small" />
        </CollapseItem>

        <CollapseItem
          header={
            <Space>
              <Tag color="orange">Regex</Tag>
              <Text>{t("csp_rule_page.guide.regex_matching")}</Text>
            </Space>
          }
          name="regex"
        >
          <Paragraph>{t("csp_rule_page.guide.regex_intro")}</Paragraph>
          <div className="space-y-2">
            <div>
              <Text bold>{t("csp_rule_page.guide.regex_format")}:</Text>
              <code className="bg-gray-100 px-2 py-1 rounded ml-2">/pattern/flags</code>
            </div>
            <div className="space-y-1">
              <Text>{t("csp_rule_page.guide.regex_examples")}:</Text>
              <div className="pl-4 space-y-1">
                <div>
                  <code className="bg-gray-100 px-2 py-1 rounded">/https?:\/\/example\.com\/.*/i</code>
                  <Text type="secondary" className="ml-2">
                    {t("csp_rule_page.guide.regex_example1")}
                  </Text>
                </div>
                <div>
                  <code className="bg-gray-100 px-2 py-1 rounded">/^https:\/\/([a-z]+\.)?example\.com/i</code>
                  <Text type="secondary" className="ml-2">
                    {t("csp_rule_page.guide.regex_example2")}
                  </Text>
                </div>
                <div>
                  <code className="bg-gray-100 px-2 py-1 rounded">/\.example\.(com|org)\/.*/</code>
                  <Text type="secondary" className="ml-2">
                    {t("csp_rule_page.guide.regex_example3")}
                  </Text>
                </div>
              </div>
            </div>
          </div>
        </CollapseItem>
      </Collapse>

      <Divider />

      <div>
        <Title heading={6}>{t("csp_rule_page.guide.best_practices")}</Title>
        <ul className="list-disc pl-6 space-y-2">
          <li>{t("csp_rule_page.guide.tip1")}</li>
          <li>{t("csp_rule_page.guide.tip2")}</li>
          <li>{t("csp_rule_page.guide.tip3")}</li>
          <li>{t("csp_rule_page.guide.tip4")}</li>
          <li>{t("csp_rule_page.guide.tip5")}</li>
        </ul>
      </div>

      <Divider />

      <div>
        <Title heading={6}>{t("csp_rule_page.guide.quick_reference")}</Title>
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gray-50">
            <Text bold>{t("csp_rule_page.guide.match_all")}</Text>
            <div className="mt-2">
              <code className="bg-gray-100 px-2 py-1 rounded">*</code>
              <span className="mx-2">{t("csp_rule_page.guide.or")}</span>
              <code className="bg-gray-100 px-2 py-1 rounded">*://*/*</code>
            </div>
          </Card>
          <Card className="bg-gray-50">
            <Text bold>{t("csp_rule_page.guide.match_domain")}</Text>
            <div className="mt-2">
              <code className="bg-gray-100 px-2 py-1 rounded">example.com</code>
              <span className="mx-2">{t("csp_rule_page.guide.or")}</span>
              <code className="bg-gray-100 px-2 py-1 rounded">*://example.com/*</code>
            </div>
          </Card>
          <Card className="bg-gray-50">
            <Text bold>{t("csp_rule_page.guide.match_subdomain")}</Text>
            <div className="mt-2">
              <code className="bg-gray-100 px-2 py-1 rounded">*.example.com</code>
              <span className="mx-2">{t("csp_rule_page.guide.or")}</span>
              <code className="bg-gray-100 px-2 py-1 rounded">*://*.example.com/*</code>
            </div>
          </Card>
          <Card className="bg-gray-50">
            <Text bold>{t("csp_rule_page.guide.match_path")}</Text>
            <div className="mt-2">
              <code className="bg-gray-100 px-2 py-1 rounded">example.com/path/*</code>
            </div>
          </Card>
        </div>
      </div>
    </Card>
  );
};

export default PatternGuide;
