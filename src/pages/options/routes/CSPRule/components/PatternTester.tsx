import { useState } from "react";
import { Card, Input, Button, Space, Typography, Tag, Collapse, Alert, Divider, Tooltip } from "@arco-design/web-react";
import { IconCheck, IconClose, IconQuestionCircle } from "@arco-design/web-react/icon";
import { useTranslation } from "react-i18next";
import { PatternMatcher, type MatchResult } from "@App/pkg/utils/patternMatcher";

const { Title, Text } = Typography;
const CollapseItem = Collapse.Item;

const PatternTester: React.FC = () => {
  const { t } = useTranslation();
  const [pattern, setPattern] = useState("");
  const [testUrl, setTestUrl] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [patternValidation, setPatternValidation] = useState<{ valid: boolean; error?: string; type?: string } | null>(
    null
  );

  const handlePatternChange = (value: string) => {
    setPattern(value);
    if (value.trim()) {
      const validation = PatternMatcher.validatePattern(value);
      setPatternValidation(validation);
    } else {
      setPatternValidation(null);
    }
    setResult(null);
  };

  const handleTest = () => {
    if (!pattern.trim() || !testUrl.trim()) {
      return;
    }

    const matchResult = PatternMatcher.match(pattern, testUrl);
    setResult(matchResult);
  };

  const handleClear = () => {
    setPattern("");
    setTestUrl("");
    setResult(null);
    setPatternValidation(null);
  };

  const getPatternTypeColor = (type: string) => {
    switch (type) {
      case "exact":
        return "blue";
      case "wildcard":
        return "green";
      case "regex":
        return "orange";
      case "domain":
        return "purple";
      default:
        return "gray";
    }
  };

  const examples = PatternMatcher.getPatternExamples();

  return (
    <Card className="pattern-tester">
      <div className="mb-4">
        <Space className="w-full justify-between items-center">
          <Title heading={6}>{t("csp_rule_page.pattern_tester.title")}</Title>
          <Tooltip content={t("csp_rule_page.pattern_tester.tooltip")}>
            <IconQuestionCircle className="text-gray-400 cursor-help" />
          </Tooltip>
        </Space>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Text className="font-medium">{t("csp_rule_page.pattern_tester.pattern_label")}</Text>
            {patternValidation && (
              <Tag color={patternValidation.valid ? "green" : "red"} size="small">
                {patternValidation.type || "invalid"}
              </Tag>
            )}
            {patternValidation && !patternValidation.valid && (
              <Text type="error" size="small">
                {patternValidation.error}
              </Text>
            )}
          </div>
          <Input
            placeholder={t("csp_rule_page.pattern_tester.pattern_placeholder")}
            value={pattern}
            onChange={handlePatternChange}
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <Text className="font-medium block mb-2">{t("csp_rule_page.pattern_tester.url_label")}</Text>
          <Input
            placeholder={t("csp_rule_page.pattern_tester.url_placeholder")}
            value={testUrl}
            onChange={setTestUrl}
            style={{ width: "100%" }}
          />
        </div>

        <Space>
          <Button type="primary" onClick={handleTest} disabled={!pattern.trim() || !testUrl.trim()}>
            {t("csp_rule_page.pattern_tester.test_button")}
          </Button>
          <Button onClick={handleClear}>{t("csp_rule_page.pattern_tester.clear_button")}</Button>
        </Space>

        {result && (
          <div className="mt-4">
            <Alert
              type={result.matched ? "success" : "error"}
              icon={result.matched ? <IconCheck /> : <IconClose />}
              content={
                <div>
                  <Text bold>
                    {result.matched
                      ? t("csp_rule_page.pattern_tester.match_success")
                      : t("csp_rule_page.pattern_tester.match_failed")}
                  </Text>
                  <Tag color={getPatternTypeColor(result.matchType)} className="ml-2">
                    {result.matchType}
                  </Tag>
                </div>
              }
            />

            <Collapse className="mt-3" defaultActiveKey={["details"]}>
              <CollapseItem header={t("csp_rule_page.pattern_tester.match_details")} name="details">
                <div className="space-y-2">
                  {result.details.map((detail, index) => (
                    <Text key={index} className="block text-sm">
                      {detail}
                    </Text>
                  ))}
                </div>
              </CollapseItem>
              {result.capturedGroups && result.capturedGroups.length > 0 && (
                <CollapseItem header={t("csp_rule_page.pattern_tester.captured_groups")} name="groups">
                  <div className="space-y-1">
                    {result.capturedGroups.map((group, index) => (
                      <Text key={index} className="block text-sm">
                        Group {index + 1}: {group}
                      </Text>
                    ))}
                  </div>
                </CollapseItem>
              )}
            </Collapse>
          </div>
        )}
      </div>

      <Divider />

      <div>
        <Title heading={6} className="mb-3">
          {t("csp_rule_page.pattern_tester.examples_title")}
        </Title>
        <Collapse>
          {examples.map((example, index) => (
            <CollapseItem
              header={
                <Space>
                  <Tag color={getPatternTypeColor(example.type)}>{example.type}</Tag>
                  <Text>{t(`csp_rule_page.pattern_tester.example_type_${example.type}`)}</Text>
                </Space>
              }
              name={index.toString()}
              key={index}
            >
              <div className="space-y-2">
                {example.patterns.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">{p}</code>
                    <Text type="secondary" size="small">
                      {example.descriptions[i]}
                    </Text>
                  </div>
                ))}
              </div>
            </CollapseItem>
          ))}
        </Collapse>
      </div>
    </Card>
  );
};

export default PatternTester;
