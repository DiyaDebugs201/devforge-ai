const { validationResult }     = require('express-validator');
const { generateTests, extractJSON } = require('../services/aiService');
const TestHistory              = require('../models/TestHistory');
const { asyncHandler }         = require('../middleware/errorHandler');

// ── extract function name from code ──────────────────────────────────────
function extractFunctionName(code) {
  const patterns = [
    // export default function name(
    /export\s+default\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
    // export function name(
    /export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
    // function name(
    /^(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/m,
    // const/let/var name = async function(
    /(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?function/,
    // const/let/var name = (...) =>
    /(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?\(/,
    // const/let/var name = async (...) =>  OR  name = param =>
    /(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*async\s+[A-Za-z_$]/,
    // module.exports = function name(
    /module\.exports\s*=\s*(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/,
    // exports.name =
    /exports\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/,
  ];

  for (const pattern of patterns) {
    const m = code.match(pattern);
    if (m?.[1]) return m[1];
  }
  return 'myFunction';
}

// ── build a minimal but real test file as fallback ───────────────────────
function buildFallbackTestFile(functionName, language, importStatement) {
  const ext = language === 'typescript' ? 'ts' : 'js';
  return `${importStatement}

/**
 * Test suite for ${functionName}
 * NOTE: AI was unable to generate structured output.
 * These are placeholder tests — please fill in actual assertions.
 */

describe('${functionName}', () => {
  // Happy path
  it('should return expected result for valid input', () => {
    // TODO: replace with actual test
    expect(typeof ${functionName}).toBe('function');
  });

  // Edge case — null input
  it('should handle null input gracefully', () => {
    expect(() => ${functionName}(null)).not.toThrow();
  });

  // Edge case — undefined input
  it('should handle undefined input gracefully', () => {
    expect(() => ${functionName}(undefined)).not.toThrow();
  });
});
`;
}

// ── POST /api/tests/generate ─────────────────────────────────────────────
const generateTestSuite = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { functionCode, language = 'javascript' } = req.body;

  const trimmed = functionCode.trim();
  if (trimmed.length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Function code is too short to generate tests for.',
    });
  }

  const functionName   = extractFunctionName(trimmed);
  const importStatement = language === 'typescript'
    ? `import { ${functionName} } from './${functionName}';`
    : `const { ${functionName} } = require('./${functionName}');`;

  // ── call AI ──────────────────────────────────────────────────────
  const rawResponse = await generateTests(trimmed, language);

  // ── parse AI output ───────────────────────────────────────────────
  let parsed = null;
  try {
    parsed = typeof rawResponse === 'string'
      ? extractJSON(rawResponse)
      : rawResponse;
  } catch (parseErr) {
    console.error('Test JSON parse error:', parseErr.message);
  }

  // ── build output, filling every field defensively ─────────────────
  let output;

  if (parsed && typeof parsed === 'object') {
    // ── fullTestFile ── most important field; must be a non-empty string
    let fullTestFile = '';

    if (typeof parsed.fullTestFile === 'string' && parsed.fullTestFile.trim().length > 20) {
      // AI gave us a real file — unescape any escaped newlines
      fullTestFile = parsed.fullTestFile
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .trim();
    } else if (typeof parsed.fullTestFile === 'object' && parsed.fullTestFile !== null) {
      // Occasionally AI returns the file broken into an object — stringify it
      fullTestFile = JSON.stringify(parsed.fullTestFile, null, 2);
    }

    // If still empty, reconstruct from testCases
    if (!fullTestFile && Array.isArray(parsed.testCases) && parsed.testCases.length > 0) {
      const caseCode = parsed.testCases
        .map((tc) => {
          const code = typeof tc.code === 'string' ? tc.code.replace(/\\n/g, '\n') : '';
          return code;
        })
        .filter(Boolean)
        .join('\n\n');

      if (caseCode.trim()) {
        fullTestFile = `${importStatement}\n\n${caseCode}`;
      }
    }

    // Last resort — build placeholder
    if (!fullTestFile) {
      fullTestFile = buildFallbackTestFile(
        parsed.functionName || functionName,
        language,
        parsed.importStatement || importStatement
      );
    }

    // ── testCases array ──────────────────────────────────────────────
    const testCases = Array.isArray(parsed.testCases)
      ? parsed.testCases
          .filter((tc) => tc && typeof tc === 'object')
          .map((tc) => ({
            name:     String(tc.name     || 'unnamed test'),
            category: ['happy-path', 'edge-case', 'error', 'boundary'].includes(tc.category)
              ? tc.category
              : 'happy-path',
            code: typeof tc.code === 'string'
              ? tc.code.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
              : '',
          }))
      : [];

    output = {
      fullTestFile,
      testCases,
      estimatedCoverage: typeof parsed.estimatedCoverage === 'number'
        ? Math.min(100, Math.max(0, Math.round(parsed.estimatedCoverage)))
        : Math.min(95, 50 + testCases.length * 5),
      importStatement: (typeof parsed.importStatement === 'string' && parsed.importStatement.trim())
        ? parsed.importStatement
        : importStatement,
      functionName: (typeof parsed.functionName === 'string' && parsed.functionName.trim())
        ? parsed.functionName
        : functionName,
    };
  } else {
    // AI returned pure prose / unparseable — use raw as file content
    console.warn('Could not parse AI response as JSON, using raw text as test file');
    const rawAsFile = typeof rawResponse === 'string' && rawResponse.trim().length > 20
      ? `// Generated test file\n// Note: Please review and adjust as needed\n\n${rawResponse.trim()}`
      : buildFallbackTestFile(functionName, language, importStatement);

    output = {
      fullTestFile:      rawAsFile,
      testCases:         [],
      estimatedCoverage: 0,
      importStatement,
      functionName,
    };
  }

  // ── save to history ───────────────────────────────────────────────
  let historyEntry;
  try {
    historyEntry = await TestHistory.create({
      userId: req.user._id,
      input:  { functionCode: trimmed, language, functionName: output.functionName },
      output: {
        fullTestFile:      output.fullTestFile,
        testCases:         output.testCases,
        estimatedCoverage: output.estimatedCoverage,
        importStatement:   output.importStatement,
      },
    });
  } catch (dbErr) {
    console.error('Failed to save TestHistory:', dbErr.message);
    // Don't fail the request if DB save fails — user still gets their output
  }

  return res.status(200).json({
    success: true,
    data: {
      ...output,
      language,
      historyId: historyEntry?._id || null,
    },
  });
});

module.exports = { generateTestSuite };
